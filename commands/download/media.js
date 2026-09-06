'use strict';

const { requestJson } = require('../../lib/toosiiApi');
const { checkRateLimit } = require('../../lib/rateLimiter');
const { fetchMedia, sendAudio, sendVideo, sendFile } = require('../../lib/mediaSender');

const MAX_URL_LENGTH = 1000;
const PLATFORM_RULES = {
    youtube: {
        pattern: /(^|\.)((youtube\.com)|(youtu\.be))$/i,
        videoRoutes: ['/download/video', '/download/ytmp4', '/download/mp4'],
        audioRoutes: ['/download/audio', '/download/ytmp3', '/download/mp3']
    },
    tiktok: {
        pattern: /(^|\.)((tiktok\.com)|(vt\.tiktok\.com))$/i,
        videoRoutes: ['/download/tiktokdl3']
    },
    instagram: {
        pattern: /(^|\.)instagram\.com$/i,
        videoRoutes: ['/download/instadl', '/download/instagramdl']
    },
    facebook: {
        pattern: /(^|\.)((facebook\.com)|(fb\.watch)|(fb\.me))$/i,
        videoRoutes: ['/download/fbdown', '/download/fbdl']
    },
    twitter: {
        pattern: /(^|\.)((twitter\.com)|(x\.com)|(t\.co))$/i,
        videoRoutes: ['/download/twitter']
    },
    mediafire: {
        pattern: /(^|\.)mediafire\.com$/i,
        videoRoutes: ['/download/mfire']
    },
    soundcloud: {
        pattern: /(^|\.)soundcloud\.com$/i,
        audioRoutes: ['/download/soundcloud'],
        videoRoutes: ['/download/soundcloud']
    },
    pinterest: {
        pattern: /(^|\.)((pinterest\.com)|(pin\.it))$/i,
        videoRoutes: ['/download/pindl3']
    }
};

// Platforms whose upstream resolver is known to be failing. They stay listed so
// the command exists, but the reply says so plainly instead of implying a
// transient glitch.
const UNRELIABLE_PLATFORMS = new Set(['soundcloud']);

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function parseSource(value, expectedPlatform = null) {
    if (!value || value.length > MAX_URL_LENGTH) throw new Error('Provide a valid URL no longer than 1,000 characters.');
    let url;
    try { url = new URL(value); } catch { throw new Error('Provide a complete HTTP or HTTPS URL.'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported.');

    if (expectedPlatform && !PLATFORM_RULES[expectedPlatform].pattern.test(url.hostname)) {
        throw new Error(`Provide a public ${expectedPlatform} URL.`);
    }
    return url.toString();
}

// Users expect .play <song name> to work, not just .play <url>. Resolve a plain
// search term to a YouTube video first, then hand off to the normal resolver.
async function searchYouTube(term) {
    const data = await requestJson('/search/yts', { query: term }, { timeoutMs: 20000 });
    const entries = Array.isArray(data?.result) ? data.result : [];
    const match = entries.find((entry) => typeof entry?.url === 'string' && /^https?:\/\//i.test(entry.url))
        || entries.find((entry) => typeof entry?.id === 'string' && entry.id.trim());
    if (!match) return null;
    const url = match.url || `https://youtube.com/watch?v=${match.id}`;
    return {
        url,
        title: typeof match.title === 'string' ? match.title.trim() : null,
        duration: typeof match.duration === 'string' ? match.duration.trim() : null
    };
}

function looksLikeUrl(value) {
    return /^https?:\/\//i.test(value.trim());
}

function detectPlatform(value) {
    const url = new URL(value);
    return Object.entries(PLATFORM_RULES).find(([, rule]) => rule.pattern.test(url.hostname))?.[0] || null;
}

function findMediaUrl(value, depth = 0) {
    if (depth > 5 || value == null) return null;
    if (typeof value === 'string') return /^https?:\/\//i.test(value) ? value : null;
    if (Array.isArray(value)) {
        for (const item of value) {
            const result = findMediaUrl(item, depth + 1);
            if (result) return result;
        }
        return null;
    }
    if (typeof value !== 'object') return null;

    for (const key of ['download_url', 'downloadUrl', 'downloadLink', 'hd', 'sd', 'video', 'play', 'media', 'audio', 'url', 'link', 'thumb', 'image']) {
        const result = findMediaUrl(value[key], depth + 1);
        if (result) return result;
    }
    for (const nested of Object.values(value)) {
        const result = findMediaUrl(nested, depth + 1);
        if (result) return result;
    }
    return null;
}

// Some resolvers return titles still HTML-escaped (&#xdb4; &amp; &quot;).
function decodeEntities(value) {
    return value
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
            const code = Number.parseInt(hex, 16);
            return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
        })
        .replace(/&#(\d+);/g, (_, dec) => {
            const code = Number.parseInt(dec, 10);
            return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
        })
        .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

function extractTitle(value) {
    if (!value || typeof value !== 'object') return null;
    for (const key of ['title', 'name', 'caption', 'description']) {
        if (typeof value[key] === 'string' && value[key].trim()) {
            const decoded = decodeEntities(value[key]).replace(/\s+/g, ' ').trim();
            if (decoded) return decoded.slice(0, 180);
        }
    }
    for (const nested of Object.values(value)) {
        const title = extractTitle(nested);
        if (title) return title;
    }
    return null;
}

// Some single-route platforms (Pinterest) fail intermittently upstream rather
// than consistently, so a lone attempt under-reports what actually works.
const RETRY_ATTEMPTS = 2;

async function resolveFromRoutes(routes, source) {
    const attempts = [];
    for (let pass = 0; pass < RETRY_ATTEMPTS; pass += 1) attempts.push(...routes);
    for (const route of attempts) {
        try {
            const data = await requestJson(route, { url: source }, { timeoutMs: 30000 });
            // A few resolvers answer status:true while nesting the real failure in
            // result.message/result.error, which would otherwise look like success.
            if (typeof data?.result?.error === 'string' && data.result.error.trim()) continue;
            const mediaUrl = findMediaUrl(data);
            if (mediaUrl) return { mediaUrl, title: extractTitle(data), route };
        } catch {
            // Continue through the documented fallback endpoints.
        }
    }
    return null;
}

async function resolveMedia(platform, source, kind = 'video') {
    const rule = PLATFORM_RULES[platform];
    const routes = kind === 'audio' ? rule.audioRoutes : rule.videoRoutes;
    if (!routes?.length) return null;
    return resolveFromRoutes(routes, source);
}

async function handleDownload(sock, msg, ctx, args, platform, kind = 'video') {
    const input = args.join(' ').trim();
    if (!input) {
        const usage = platform === 'youtube'
            ? `Usage: ${ctx.prefix}${kind === 'audio' ? 'yta' : 'play'} <song name or YouTube URL>`
            : `Usage: ${ctx.prefix}${platform} <${platform} URL>`;
        return reply(sock, msg, ctx, usage);
    }

    const limit = checkRateLimit('download', ctx.sender || ctx.from);
    if (!limit.allowed) return reply(sock, msg, ctx, `Media rate limit reached. Try again in ${limit.retryAfterSeconds} seconds.`);

    let source;
    let searched = null;
    if (platform === 'youtube' && !looksLikeUrl(input)) {
        try {
            searched = await searchYouTube(input);
        } catch (error) {
            return reply(sock, msg, ctx, `Search failed: ${error.message}`);
        }
        if (!searched) return reply(sock, msg, ctx, `No YouTube result was found for "${input}".`);
        source = searched.url;
    } else {
        try { source = parseSource(input, platform); }
        catch (error) { return reply(sock, msg, ctx, `Media error: ${error.message}`); }
    }

    const result = await resolveMedia(platform, source, kind);
    const title = result?.title || searched?.title || null;
    if (!result && UNRELIABLE_PLATFORMS.has(platform)) {
        return reply(sock, msg, ctx, `The ${platform} resolver is currently unavailable upstream.${title ? `\nFound: ${title}` : ''}\nSource link:\n${source}`);
    }
    if (!result) {
        return reply(sock, msg, ctx, `Media services are unavailable.${title ? `\nFound: ${title}` : ''}\nFallback source link:\n${source}`);
    }

    // Deliver the actual file. Falling back to the bare link only happens when
    // the upload genuinely cannot be done, so the link stays a last resort
    // rather than the normal outcome.
    const heading = title ? `${title}` : `${platform} ${kind}`;
    try {
        const isFile = platform === 'mediafire' || platform === 'pinterest';
        const fetchKind = kind === 'audio' ? 'audio' : (isFile ? 'file' : 'video');
        const media = await fetchMedia(result.mediaUrl, fetchKind, source);
        if (kind === 'audio') {
            await sendAudio(sock, ctx.from, msg, media, title || `${platform}-audio`);
        } else if (isFile) {
            // These are arbitrary files or images rather than streamable video.
            await sendFile(sock, ctx.from, msg, media, title || platform, title || undefined);
        } else {
            const caption = [heading, searched?.duration ? `Duration: ${searched.duration}` : null]
                .filter(Boolean).join('\n');
            await sendVideo(sock, ctx.from, msg, media, title || `${platform}-video`, caption);
        }
        return true;
    } catch (error) {
        return reply(sock, msg, ctx, `Could not upload the file: ${error.message}${title ? `\nFound: ${title}` : ''}\nDirect link:\n${result.mediaUrl}`);
    }
}

module.exports = [
    {
        name: 'ytv',
        aliases: ['youtube', 'youtubevideo'],
        description: 'Download a YouTube video by name or link.',
        category: 'download',
        execute: async (sock, msg, args, ctx) => handleDownload(sock, msg, ctx, args, 'youtube', 'video')
    },
    {
        // .play is what people reach for to hear a song, so it must deliver
        // audio. It used to be an alias of .ytv and therefore sent video.
        name: 'play',
        aliases: ['song', 'music'],
        description: 'Play a song: sends the audio plus an mp3 document.',
        category: 'download',
        execute: async (sock, msg, args, ctx) => handleDownload(sock, msg, ctx, args, 'youtube', 'audio')
    },
    {
        name: 'yta',
        aliases: ['youtubeaudio', 'ytmp3'],
        description: 'Download YouTube audio: sends the audio plus an mp3 document.',
        category: 'download',
        execute: async (sock, msg, args, ctx) => handleDownload(sock, msg, ctx, args, 'youtube', 'audio')
    },
    {
        name: 'tiktok',
        aliases: ['tt', 'tiktokdl'],
        description: 'Resolve an authorized public TikTok media link.',
        category: 'download',
        execute: async (sock, msg, args, ctx) => handleDownload(sock, msg, ctx, args, 'tiktok', 'video')
    },
    {
        name: 'ig',
        aliases: ['instagram', 'instadl'],
        description: 'Resolve an authorized public Instagram media link.',
        category: 'download',
        execute: async (sock, msg, args, ctx) => handleDownload(sock, msg, ctx, args, 'instagram', 'video')
    },
    {
        name: 'fb',
        aliases: ['facebook', 'fbdl'],
        description: 'Resolve an authorized public Facebook video link.',
        category: 'download',
        execute: async (sock, msg, args, ctx) => handleDownload(sock, msg, ctx, args, 'facebook', 'video')
    },
    {
        name: 'twitter',
        aliases: ['x', 'twdl'],
        description: 'Resolve an authorized public X or Twitter video link.',
        category: 'download',
        execute: async (sock, msg, args, ctx) => handleDownload(sock, msg, ctx, args, 'twitter', 'video')
    },
    {
        name: 'mediafire',
        aliases: ['mfire'],
        description: 'Resolve a public MediaFire file link.',
        category: 'download',
        execute: async (sock, msg, args, ctx) => handleDownload(sock, msg, ctx, args, 'mediafire', 'video')
    },
    {
        name: 'soundcloud',
        aliases: ['scdl'],
        description: 'Resolve a public SoundCloud audio link.',
        category: 'download',
        execute: async (sock, msg, args, ctx) => handleDownload(sock, msg, ctx, args, 'soundcloud', 'audio')
    },
    {
        name: 'pinterest',
        aliases: ['pin', 'pindl'],
        description: 'Resolve a public Pinterest media link.',
        category: 'download',
        execute: async (sock, msg, args, ctx) => handleDownload(sock, msg, ctx, args, 'pinterest', 'video')
    },
    {
        name: 'media',
        aliases: ['dl', 'download'],
        description: 'Resolve a supported public media link.',
        category: 'download',
        execute: async (sock, msg, args, ctx) => {
            let source;
            try {
                source = parseSource(args.join(' ').trim());
                const platform = detectPlatform(source);
                if (!platform) throw new Error('Supported sources are YouTube, TikTok, Instagram, Facebook, X, MediaFire, SoundCloud, and Pinterest.');
                return handleDownload(sock, msg, ctx, [source], platform, 'video');
            } catch (error) { return reply(sock, msg, ctx, `Media error: ${error.message}`); }
        }
    }
];

module.exports.resolveMedia = resolveMedia;
module.exports.findMediaUrl = findMediaUrl;
module.exports.detectPlatform = detectPlatform;
module.exports.decodeEntities = decodeEntities;
module.exports.searchYouTube = searchYouTube;
module.exports.looksLikeUrl = looksLikeUrl;
