'use strict';

// Commands backed by the project's own Toosii Tech developer API.
// Only capabilities that are genuinely new live here: the movie catalogue on
// that platform proxies through to the same upstream the movie commands
// already use directly, so it is not duplicated.

const toosiiTech = require('../../lib/toosiiTechApi');
const { fetchMedia, sendAudio } = require('../../lib/mediaSender');
const { checkRateLimit } = require('../../lib/rateLimiter');

const MAX_QUERY_LENGTH = 100;

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function getQuery(args, usage) {
    const value = args.join(' ').trim();
    if (!value) throw new Error(`Usage: ${usage}`);
    if (value.length > MAX_QUERY_LENGTH) throw new Error(`Input is limited to ${MAX_QUERY_LENGTH} characters.`);
    return value;
}

function command(name, aliases, description, category, execute) {
    return {
        name,
        aliases,
        description,
        category,
        execute: async (sock, msg, args, ctx) => {
            try {
                const verdict = checkRateLimit('download', ctx.sender || ctx.from);
                if (!verdict.allowed) throw new Error(verdict.reason || 'Please wait a moment before trying again.');
                await execute(sock, msg, args, ctx);
            } catch (error) {
                await reply(sock, msg, ctx, error?.message || 'That command is unavailable right now.');
            }
        }
    };
}

function formatDuration(seconds) {
    const total = Number(seconds);
    if (!Number.isFinite(total) || total <= 0) return null;
    const minutes = Math.floor(total / 60);
    return `${minutes}:${String(Math.floor(total % 60)).padStart(2, '0')}`;
}

// Football leagues people are most likely to ask for.
const LEAGUES = new Map([
    ['epl', 'eng.1'], ['pl', 'eng.1'], ['premier', 'eng.1'], ['england', 'eng.1'],
    ['laliga', 'esp.1'], ['spain', 'esp.1'],
    ['seriea', 'ita.1'], ['italy', 'ita.1'],
    ['bundesliga', 'ger.1'], ['germany', 'ger.1'],
    ['ligue1', 'fra.1'], ['france', 'fra.1'],
    ['ucl', 'uefa.champions'], ['champions', 'uefa.champions']
]);

module.exports = [
    command('spotify', ['spotifydl', 'sp'], 'Search Spotify, or download a track as mp3.', 'download',
        async (sock, msg, args, ctx) => {
            const input = getQuery(args, `${ctx.prefix}spotify <song or track link>`);

            // A link downloads; anything else searches.
            if (/^https?:\/\/(open\.)?spotify\.com\//i.test(input)) {
                const track = await toosiiTech.downloadSpotify(input);
                const media = await fetchMedia(track.url, 'audio');
                await sendAudio(sock, ctx.from, msg, media, track.title || 'spotify-track');
                return;
            }

            const results = await toosiiTech.searchSpotify(input, 8);
            if (!results.length) throw new Error(`No tracks found for "${input}".`);

            const lines = results.map((track, index) => {
                const length = formatDuration(track.duration);
                return `${index + 1}. ${track.title}\n   ${track.artist || 'Unknown artist'}${length ? ` — ${length}` : ''}`;
            });
            await reply(sock, msg, ctx, [
                `Spotify results for "${input}"`,
                '',
                ...lines,
                '',
                `To download, send ${ctx.prefix}play <song name> or ${ctx.prefix}spotify <track link>.`
            ].join('\n'));
        }),

    command('sports', ['football', 'scores', 'livescore'], 'Show live and recent football scores.', 'search',
        async (sock, msg, args, ctx) => {
            const requested = (args[0] || 'epl').toLowerCase().replace(/[^a-z0-9.]/g, '');
            const league = LEAGUES.get(requested) || (/^[a-z]{3}\.\d$|^uefa\./.test(requested) ? requested : 'eng.1');

            const data = await toosiiTech.sports(league);
            if (!data.events.length) {
                throw new Error(`No fixtures listed for ${data.league} right now.\nTry: ${[...new Set(LEAGUES.keys())].slice(0, 6).join(', ')}`);
            }

            const lines = data.events.slice(0, 10).map((event) => {
                const teams = Array.isArray(event.teams) ? event.teams : [];
                const score = teams.map((team) => `${team.abbreviation || team.name} ${team.score ?? ''}`.trim()).join('  vs  ');
                const state = event.status?.detail || event.status?.state || '';
                return `▸ ${score || event.shortName || event.name}\n   ${state}`;
            });

            await reply(sock, msg, ctx, [`${data.league}`, '', ...lines].join('\n'));
        }),

    command('book', ['books', 'booksearch'], 'Search for a book.', 'education',
        async (sock, msg, args, ctx) => {
            const query = getQuery(args, `${ctx.prefix}book <title>  e.g. ${ctx.prefix}book things fall apart`);
            const results = await toosiiTech.books(query, 5);
            if (!results.length) throw new Error(`No books found for "${query}".`);

            const lines = results.slice(0, 5).map((book, index) => {
                const authors = Array.isArray(book.authors)
                    ? book.authors.join(', ')
                    : (book.author || book.author_name || 'Unknown author');
                const year = book.year || book.first_publish_year || book.publishYear;
                return `${index + 1}. ${book.title}\n   ${authors}${year ? ` (${year})` : ''}`;
            });
            await reply(sock, msg, ctx, [`Books matching "${query}"`, '', ...lines].join('\n'));
        }),

    command('holidays', ['publicholidays'], 'List public holidays for a country.', 'search',
        async (sock, msg, args, ctx) => {
            // Validate the whole word rather than truncating it: silently turning
            // "toolong" into "TO" would answer about the wrong country.
            const raw = (args[0] || 'KE').trim();
            if (!/^[A-Za-z]{2}$/.test(raw)) {
                throw new Error(`Usage: ${ctx.prefix}holidays <2-letter country code> [year]  e.g. ${ctx.prefix}holidays KE 2026`);
            }
            const country = raw.toUpperCase();
            const year = /^\d{4}$/.test(args[1] || '') ? Number(args[1]) : new Date().getFullYear();

            const results = await toosiiTech.holidays(country, year);
            if (!results.length) throw new Error(`No holidays listed for ${country} in ${year}.`);

            const lines = results.slice(0, 15).map((holiday) =>
                `▸ ${holiday.date || holiday.observed || '?'} — ${holiday.name || holiday.localName || 'Holiday'}`);
            await reply(sock, msg, ctx, [`Public holidays — ${country} ${year}`, '', ...lines].join('\n'));
        })
];
