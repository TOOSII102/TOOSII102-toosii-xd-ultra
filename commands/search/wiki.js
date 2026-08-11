'use strict';

const MAX_QUERY_LENGTH = 80;
const WIKIPEDIA_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

async function lookupWikipedia(query) {
    const url = `${WIKIPEDIA_URL}${encodeURIComponent(query.replace(/\s+/g, '_'))}`;
    const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(8000)
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Wikipedia returned status ${response.status}.`);
    const result = await response.json();
    return {
        title: String(result.title || query),
        extract: String(result.extract || '').trim(),
        url: result.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`
    };
}

module.exports = {
    name: 'wiki',
    aliases: ['wikisearch'],
    description: 'Look up a concise Wikipedia summary.',
    category: 'search',
    execute: async (sock, msg, args, ctx) => {
        const query = args.join(' ').trim();
        if (!query) return reply(sock, msg, ctx, `Usage: ${ctx.prefix}wiki <topic>`);
        if (query.length > MAX_QUERY_LENGTH) return reply(sock, msg, ctx, `Search terms are limited to ${MAX_QUERY_LENGTH} characters.`);
        try {
            const result = await lookupWikipedia(query);
            if (!result?.extract) return reply(sock, msg, ctx, `No Wikipedia summary was found for "${query}".`);
            const summary = result.extract.length > 900 ? `${result.extract.slice(0, 897)}...` : result.extract;
            return reply(sock, msg, ctx, `Wikipedia: ${result.title}\n${summary}\nSource: ${result.url}`);
        } catch (error) {
            return reply(sock, msg, ctx, `Wikipedia lookup failed: ${error.name === 'TimeoutError' ? 'request timed out.' : error.message}`);
        }
    },
    lookupWikipedia
};
