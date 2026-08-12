'use strict';

const { requestJson } = require('../../lib/keithApi');

const MAX_QUERY_LENGTH = 100;
const BLOCKED_TERMS = ['porn', 'hentai', 'xnxx', 'xvideos', 'onlyfans', 'nude', 'nsfw'];

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function isSafeResult(item) {
    const text = `${item?.title || ''} ${item?.snippet || ''} ${item?.link || ''}`.toLowerCase();
    return !BLOCKED_TERMS.some((term) => text.includes(term));
}

function safeText(value, limit) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

module.exports = {
    name: 'search',
    aliases: ['websearch', 'google'],
    description: 'Search the web for concise, filtered public results.',
    category: 'search',
    execute: async (sock, msg, args, ctx) => {
        const query = args.join(' ').trim();
        if (!query) return reply(sock, msg, ctx, `Usage: ${ctx.prefix}search <query>`);
        if (query.length > MAX_QUERY_LENGTH) return reply(sock, msg, ctx, `Search terms are limited to ${MAX_QUERY_LENGTH} characters.`);
        if (BLOCKED_TERMS.some((term) => query.toLowerCase().includes(term))) return reply(sock, msg, ctx, 'That search term is not available through this command.');

        const fallback = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        try {
            const data = await requestJson('/search/google', { q: query });
            const items = Array.isArray(data?.result?.items) ? data.result.items.filter(isSafeResult).slice(0, 3) : [];
            if (!items.length) throw new Error('No suitable results were returned.');
            const results = items.map((item, index) => {
                const title = safeText(item.title, 120) || 'Untitled result';
                const link = safeText(item.link, 240) || fallback;
                const snippet = safeText(item.snippet, 260);
                return `${index + 1}. ${title}\n${link}${snippet ? `\n${snippet}` : ''}`;
            });
            return reply(sock, msg, ctx, `Search: ${query}\n\n${results.join('\n\n')}`);
        } catch {
            return reply(sock, msg, ctx, `Search service is unavailable. Fallback:\n${fallback}`);
        }
    }
};
