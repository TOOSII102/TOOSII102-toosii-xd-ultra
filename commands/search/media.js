'use strict';

const { requestJson } = require('../../lib/toosiiApi');

const MAX_QUERY_LENGTH = 80;
const MAX_REPLY_LENGTH = 1500;

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function getQuery(args, usage) {
    const value = args.join(' ').trim();
    if (!value) throw new Error(`Usage: ${usage}`);
    if (value.length > MAX_QUERY_LENGTH) throw new Error(`Search terms are limited to ${MAX_QUERY_LENGTH} characters.`);
    return value;
}


const LYRIC_ROUTES = ['/search/lyrics', '/search/lyrics2', '/search/lyrics3'];
const NEWS_SOURCES = [
    { route: '/news/bbc', label: 'BBC' },
    { route: '/news/citizen', label: 'Citizen Digital' },
    { route: '/news/kbc', label: 'KBC' },
    { route: '/news/tech', label: 'Technology' }
];

// Try each route in turn, returning the first one the extractor accepts.
async function firstResult(routes, query, extract) {
    for (const route of routes) {
        try {
            const data = await requestJson(route, { query, q: query }, { timeoutMs: 15000 });
            const value = extract(data?.result, route);
            if (value) return value;
        } catch {
            // Try the next variant.
        }
    }
    return null;
}

// News payloads nest stories under different keys per source, so accept any
// array whose entries carry a usable title.
function collectHeadlines(result) {
    if (!result || typeof result !== 'object') return [];
    const stories = [];
    for (const value of Object.values(result)) {
        if (!Array.isArray(value)) continue;
        for (const entry of value) {
            const title = typeof entry?.title === 'string' ? entry.title.trim()
                : typeof entry?.headline === 'string' ? entry.headline.trim()
                : typeof entry?.text === 'string' ? entry.text.trim() : '';
            if (!title || title.length < 12) continue;
            const url = typeof entry?.url === 'string' ? entry.url
                : typeof entry?.link === 'string' ? entry.link : null;
            if (!stories.some((story) => story.title === title)) stories.push({ title, url });
        }
    }
    return stories;
}

function command(name, aliases, description, execute) {
    return { name, aliases, description, category: 'search', execute };
}

function failure(error) {
    return error?.message || 'The service is unavailable.';
}

// Accepts "John 3:16", "john3:16" and "John 3:16-18".
const VERSE_PATTERN = /^[1-3]?\s*[A-Za-z]{2,20}\.?\s*\d{1,3}:\d{1,3}(?:-\d{1,3})?$/;

module.exports = [
    command('lyrics', ['songlyrics'], 'Find song lyrics by title or artist.', async (sock, msg, args, ctx) => {
        let query;
        try {
            query = getQuery(args, `${ctx.prefix}lyrics <song title>`);
        } catch (error) {
            return reply(sock, msg, ctx, `Lyrics error: ${failure(error)}`);
        }

        // Three upstream variants exist and fail independently. The first returns a
        // list of matches, the others return the lyrics as a bare string.
        const found = await firstResult(LYRIC_ROUTES, query, (result, route) => {
            if (Array.isArray(result)) {
                const song = result.find((entry) => typeof entry?.lyrics === 'string' && entry.lyrics.trim());
                return song ? { title: song.song || query, artist: song.artist || null, body: song.lyrics.trim() } : null;
            }
            if (typeof result === 'string' && result.trim()) {
                return { title: query, artist: null, body: result.trim() };
            }
            return null;
        });

        if (!found) return reply(sock, msg, ctx, `No lyrics were found for "${query}".`);

        const header = `${found.title}${found.artist ? ` — ${found.artist}` : ''}`;
        const budget = MAX_REPLY_LENGTH - header.length - 40;
        const truncated = found.body.length > budget;
        return reply(sock, msg, ctx, `${header}\n\n${found.body.slice(0, budget)}${truncated ? '\n\n[Lyrics truncated.]' : ''}`);
    }),

    command('verse', ['bibleverse', 'scripture'], 'Look up a Bible passage by reference.', async (sock, msg, args, ctx) => {
        let reference;
        try {
            reference = getQuery(args, `${ctx.prefix}verse <reference, for example John 3:16>`);
            if (!VERSE_PATTERN.test(reference)) throw new Error('Use a reference such as John 3:16 or John 3:16-18.');
        } catch (error) {
            return reply(sock, msg, ctx, `Verse error: ${failure(error)}`);
        }

        try {
            const data = await requestJson('/search/bible', { q: reference.replace(/\s+/g, '') });
            const result = data?.result;
            const text = typeof result?.text === 'string' ? result.text.trim() : null;
            if (!text) return reply(sock, msg, ctx, `No passage was found for "${reference}".`);
            const translation = result?.translation?.name || 'Public domain translation';
            return reply(sock, msg, ctx, `${result.reference || reference}\n\n${text.slice(0, MAX_REPLY_LENGTH)}\n\n— ${translation}`);
        } catch (error) {
            return reply(sock, msg, ctx, `Verse lookup failed: ${failure(error)}`);
        }
    }),

    // Renamed from 'movie' when the Dave Tech movie API was added: that source
    // also provides downloads, so it takes the plain .movie name while this one
    // keeps the IMDb-style ratings lookup under .movieinfo.
    command('movieinfo', ['filminfo', 'moviesearch', 'imdb'], 'Look up ratings and public information about a film.', async (sock, msg, args, ctx) => {
        let title;
        try {
            title = getQuery(args, `${ctx.prefix}movieinfo <title>`);
        } catch (error) {
            return reply(sock, msg, ctx, `Movie error: ${failure(error)}`);
        }

        try {
            const data = await requestJson('/search/movie', { q: title });
            const result = data?.result;
            if (!result?.Title) return reply(sock, msg, ctx, `No film named "${title}" was found.`);
            const lines = [
                `Title: ${result.Title}`,
                `Year: ${result.Year || 'Not listed'}`,
                `Genre: ${result.Genre || 'Not listed'}`,
                `Rating: ${result.imdbRating || 'Not listed'}`,
                result.Plot ? `\nPlot: ${String(result.Plot).slice(0, 600)}` : null
            ].filter(Boolean);
            return reply(sock, msg, ctx, lines.join('\n'));
        } catch (error) {
            return reply(sock, msg, ctx, `Movie lookup failed: ${failure(error)}`);
        }
    }),

    command('news', ['headlines'], 'Show current BBC world headlines.', async (sock, msg, args, ctx) => {
        // Each source nests its stories under a different key, so collect from any
        // array of story-like objects and move on to the next source if empty.
        for (const source of NEWS_SOURCES) {
            let data;
            try {
                data = await requestJson(source.route, {}, { timeoutMs: 15000 });
            } catch {
                continue;
            }
            const lines = collectHeadlines(data?.result).slice(0, 6)
                .map((story, index) => `${index + 1}. ${story.title}${story.url ? `\n   ${story.url}` : ''}`);
            if (lines.length) {
                return reply(sock, msg, ctx, `${source.label} headlines\n\n${lines.join('\n')}`.slice(0, MAX_REPLY_LENGTH));
            }
        }
        return reply(sock, msg, ctx, 'News is unavailable right now. Please try again shortly.');
    })
];
