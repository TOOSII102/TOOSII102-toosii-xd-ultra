'use strict';

const { requestJson } = require('../../lib/keithApi');

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

        try {
            const data = await requestJson('/search/lyrics', { query });
            const entries = Array.isArray(data?.result) ? data.result : [];
            const song = entries.find((entry) => typeof entry?.lyrics === 'string' && entry.lyrics.trim());
            if (!song) return reply(sock, msg, ctx, `No lyrics were found for "${query}".`);

            const header = `${song.song || query}${song.artist ? ` — ${song.artist}` : ''}`;
            const body = song.lyrics.trim();
            const budget = MAX_REPLY_LENGTH - header.length - 40;
            const truncated = body.length > budget;
            return reply(sock, msg, ctx, `${header}\n\n${body.slice(0, budget)}${truncated ? '\n\n[Lyrics truncated.]' : ''}`);
        } catch (error) {
            return reply(sock, msg, ctx, `Lyrics lookup failed: ${failure(error)}`);
        }
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

    command('movie', ['filminfo', 'moviesearch'], 'Look up public information about a film.', async (sock, msg, args, ctx) => {
        let title;
        try {
            title = getQuery(args, `${ctx.prefix}movie <title>`);
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
        try {
            const data = await requestJson('/news/bbc');
            const stories = data?.result?.topStories;
            if (!Array.isArray(stories) || !stories.length) throw new Error('No headlines were returned.');
            const lines = stories
                .filter((story) => typeof story?.title === 'string' && story.title.trim())
                .slice(0, 6)
                .map((story, index) => `${index + 1}. ${story.title.trim()}${story.url ? `\n   ${story.url}` : ''}`);
            if (!lines.length) throw new Error('No headlines were returned.');
            return reply(sock, msg, ctx, `BBC headlines\n\n${lines.join('\n')}`.slice(0, MAX_REPLY_LENGTH));
        } catch (error) {
            return reply(sock, msg, ctx, `News lookup failed: ${failure(error)}`);
        }
    })
];
