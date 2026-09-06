'use strict';

// Movie, TV and anime commands backed by the Dave Tech Movie API.
//
// Feature films are far larger than WhatsApp allows: a 360p film is commonly
// 700MB+ against a 64MB cap. So these commands send metadata and a direct link
// by default, and only upload the file when it is genuinely small enough.

const movieApi = require('../../lib/movieApi');
const { fetchMedia, sendVideo, MAX_BYTES } = require('../../lib/mediaSender');
const { checkRateLimit } = require('../../lib/rateLimiter');

const MAX_QUERY_LENGTH = 100;

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
    return {
        name,
        aliases,
        description,
        category: 'download',
        execute: async (sock, msg, args, ctx) => {
            try {
                const verdict = await checkRateLimit(ctx.sender || ctx.from, 'media');
                if (!verdict.allowed) throw new Error(verdict.reason || 'Please wait a moment before trying again.');
                await execute(sock, msg, args, ctx);
            } catch (error) {
                await reply(sock, msg, ctx, error?.message || 'That command is unavailable right now.');
            }
        }
    };
}

function describe(entry) {
    const year = entry.year || (entry.release_date ? String(entry.release_date).slice(0, 4) : null);
    const kind = entry.subject_type === 2 ? 'TV' : entry.subject_type === 1 ? 'Movie' : null;
    return [entry.title, year ? `(${year})` : null, kind ? `[${kind}]` : null].filter(Boolean).join(' ');
}

function resultList(results, prefix, commandName) {
    const lines = results.slice(0, 8).map((entry, index) =>
        `${index + 1}. ${describe(entry)}\n   id: ${entry.subject_id}`);
    return [
        ...lines,
        '',
        `Get details : ${prefix}${commandName} <id>`
    ].join('\n');
}

// A search term or an id both land here: digits mean a direct lookup.
function looksLikeId(value) {
    return /^\d{6,25}$/.test(value.trim());
}

async function sendDetails(sock, msg, ctx, subjectId) {
    const info = await movieApi.item(subjectId);
    if (!info?.title) throw new Error('No details were found for that id.');

    const files = await movieApi.downloads(subjectId, 360).catch(() => []);
    const smallest = files[0] || null;

    const caption = [
        `▸ *Title*    : ${info.title}`,
        info.release_date ? `▸ *Released* : ${info.release_date}` : null,
        info.duration ? `▸ *Duration* : ${info.duration}` : null,
        Array.isArray(info.genre) && info.genre.length ? `▸ *Genre*    : ${info.genre.join(', ')}` : null,
        info.country_name ? `▸ *Country*  : ${info.country_name}` : null,
        info.language ? `▸ *Language* : ${info.language}` : null,
        '',
        info.description ? String(info.description).slice(0, 400) : null,
        '',
        files.length
            ? `▸ *Available*: ${files.map((f) => `${f.quality} (${movieApi.formatBytes(f.bytes)})`).join(', ')}`
            : '▸ *Available*: no downloadable files listed',
        smallest ? `\nDownload (${smallest.quality}):\n${smallest.url}` : null
    ].filter((line) => line !== null).join('\n');

    const poster = info.cover?.url;
    if (poster) {
        try {
            const image = await fetchMedia(poster, 'file');
            if (image.mimetype.startsWith('image/')) {
                await sock.sendMessage(ctx.from, { image: image.buffer, mimetype: image.mimetype, caption }, { quoted: msg });
                return;
            }
        } catch {
            // Fall through to a text reply if the poster cannot be fetched.
        }
    }
    await reply(sock, msg, ctx, caption);
}

module.exports = [
    command('movie', ['film', 'movies'], 'Search for a movie, or look one up by id.', async (sock, msg, args, ctx) => {
        const input = getQuery(args, `${ctx.prefix}movie <title>  e.g. ${ctx.prefix}movie Inception`);
        if (looksLikeId(input)) return sendDetails(sock, msg, ctx, input);

        const results = await movieApi.search(input, 'MOVIE');
        if (!results.length) throw new Error(`No movie found for "${input}".`);
        await reply(sock, msg, ctx, [`Movies matching "${input}"`, '', resultList(results, ctx.prefix, 'movie')].join('\n'));
    }),

    command('series', ['tv', 'tvshow'], 'Search for a TV series, or look one up by id.', async (sock, msg, args, ctx) => {
        const input = getQuery(args, `${ctx.prefix}series <title>  e.g. ${ctx.prefix}series Breaking Bad`);
        if (looksLikeId(input)) return sendDetails(sock, msg, ctx, input);

        const results = await movieApi.search(input, 'TV_SERIES');
        if (!results.length) throw new Error(`No series found for "${input}".`);
        await reply(sock, msg, ctx, [`Series matching "${input}"`, '', resultList(results, ctx.prefix, 'series')].join('\n'));
    }),

    command('anime', ['animesearch'], 'Search anime by title.', async (sock, msg, args, ctx) => {
        const input = getQuery(args, `${ctx.prefix}anime <title>  e.g. ${ctx.prefix}anime Naruto`);
        if (looksLikeId(input)) return sendDetails(sock, msg, ctx, input);

        const results = await movieApi.animeSearch(input);
        if (!results.length) throw new Error(`No anime found for "${input}".`);
        await reply(sock, msg, ctx, [`Anime matching "${input}"`, '', resultList(results, ctx.prefix, 'anime')].join('\n'));
    }),

    command('episodes', ['seasons'], 'List seasons and episodes for a series.', async (sock, msg, args, ctx) => {
        const id = getQuery(args, `${ctx.prefix}episodes <id>  (get the id from ${ctx.prefix}series)`);
        const data = await movieApi.seasons(id);
        const list = Array.isArray(data?.seasons) ? data.seasons : [];
        if (!list.length) throw new Error('No seasons were listed for that id.');

        const lines = list.slice(0, 12).map((season) => {
            const qualities = Array.isArray(season.resolutions)
                ? [...new Set(season.resolutions.map((r) => `${r.resolution}p`))].join('/')
                : '';
            return `▸ Season ${season.season_number}: ${season.max_episodes} episodes${qualities ? ` — ${qualities}` : ''}`;
        });
        await reply(sock, msg, ctx, [
            `Seasons available: ${data.season_count ?? list.length}`,
            '',
            ...lines,
            '',
            `Download: ${ctx.prefix}getmovie ${id} 360 <season> <episode>`
        ].join('\n'));
    }),

    command('trending', ['populartv'], 'Show what is trending now.', async (sock, msg, args, ctx) => {
        const data = await movieApi.trending(0);
        const sections = Array.isArray(data?.sections) ? data.sections : [];
        const items = sections.flatMap((section) => Array.isArray(section.items) ? section.items : []);
        if (!items.length) throw new Error('No trending titles were returned.');

        const seen = new Set();
        const lines = [];
        for (const entry of items) {
            if (!entry?.title || seen.has(entry.title)) continue;
            seen.add(entry.title);
            lines.push(`${lines.length + 1}. ${describe(entry)}\n   id: ${entry.subject_id}`);
            if (lines.length >= 10) break;
        }
        await reply(sock, msg, ctx, ['Trending now', '', ...lines].join('\n'));
    }),

    command('hotmovies', ['hot'], 'Show hot movies right now.', async (sock, msg, args, ctx) => {
        const results = await movieApi.hot(1);
        if (!results.length) throw new Error('No hot titles were returned.');
        const lines = results.slice(0, 10).map((entry, index) =>
            `${index + 1}. ${describe(entry)}\n   id: ${entry.subject_id}`);
        await reply(sock, msg, ctx, ['Hot right now', '', ...lines].join('\n'));
    }),

    command('subtitles', ['captions', 'subs'], 'List subtitle languages for a title.', async (sock, msg, args, ctx) => {
        const id = getQuery(args, `${ctx.prefix}subtitles <id>  (get the id from ${ctx.prefix}movie)`);
        const found = await movieApi.captions(id, 360);
        if (!found.length) throw new Error('No subtitles were found for that title.');

        const languages = [...new Set(found.map((caption) => caption.lanName || caption.lan).filter(Boolean))];
        const english = found.find((caption) => caption.lan === 'en');
        await reply(sock, msg, ctx, [
            `▸ *Subtitles* : ${found.length} tracks`,
            `▸ *Languages* : ${languages.slice(0, 20).join(', ')}`,
            english?.url ? `\nEnglish track:\n${english.url}` : null
        ].filter(Boolean).join('\n'));
    }),

    command('getmovie', ['dlmovie', 'moviedl'], 'Get a download link, or the file when it is small enough.', async (sock, msg, args, ctx) => {
        const usage = `${ctx.prefix}getmovie <id> [resolution] [season] [episode]`;
        const id = (args[0] || '').trim();
        if (!looksLikeId(id)) throw new Error(`Usage: ${usage}\nGet the id from ${ctx.prefix}movie or ${ctx.prefix}series.`);

        const allowed = [360, 480, 720, 1080];
        const resolution = allowed.includes(Number(args[1])) ? Number(args[1]) : 360;
        const extra = {};
        if (args[2] && /^\d{1,3}$/.test(args[2])) extra.season = Number(args[2]);
        if (args[3] && /^\d{1,4}$/.test(args[3])) extra.episode = Number(args[3]);

        const files = await movieApi.downloads(id, resolution, extra);
        if (!files.length) throw new Error('No downloadable files were found for that title and resolution.');

        // Prefer the requested resolution, else the smallest available.
        const chosen = files.find((file) => file.resolution === resolution) || files[0];

        // Uploading a multi-hundred-megabyte film would fail after a long wait,
        // so only attempt it when the reported size is within WhatsApp's limit.
        if (chosen.bytes && chosen.bytes <= MAX_BYTES) {
            try {
                const media = await fetchMedia(chosen.url, 'video');
                await sendVideo(sock, ctx.from, msg, media, chosen.title || 'movie',
                    `${chosen.title || 'Download'} — ${chosen.quality}`);
                return;
            } catch (error) {
                await reply(sock, msg, ctx, `The upload failed (${error.message}). Direct link below.`);
            }
        }

        await reply(sock, msg, ctx, [
            `▸ *File*     : ${chosen.title || 'Download'}`,
            `▸ *Quality*  : ${chosen.quality}`,
            `▸ *Size*     : ${movieApi.formatBytes(chosen.bytes)}`,
            chosen.bytes > MAX_BYTES
                ? `\nThis is larger than WhatsApp's ${Math.round(MAX_BYTES / 1024 / 1024)}MB limit, so here is the direct link.`
                : '',
            `\nDownload:\n${chosen.url}`,
            chosen.playbackUrl ? `\nStream:\n${chosen.playbackUrl}` : null,
            files.length > 1
                ? `\nOther qualities: ${files.filter((f) => f !== chosen).map((f) => `${f.quality} (${movieApi.formatBytes(f.bytes)})`).join(', ')}`
                : null
        ].filter(Boolean).join('\n'));
    })
];
