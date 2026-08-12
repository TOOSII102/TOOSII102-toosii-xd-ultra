'use strict';

const { requestJson } = require('../../lib/keithApi');
const { checkRateLimit } = require('../../lib/rateLimiter');

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
    }
};

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

    for (const key of ['download_url', 'downloadUrl', 'url', 'video', 'play', 'link', 'media']) {
        const result = findMediaUrl(value[key], depth + 1);
        if (result) return result;
    }
    for (const nested of Object.values(value)) {
        const result = findMediaUrl(nested, depth + 1);
        if (result) return result;
    }
    return null;
}

function extractTitle(value) {
    if (!value || typeof value !== 'object') return null;
    for (const key of ['title', 'name', 'caption', 'description']) {
        if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim().slice(0, 180);
    }
    for (const nested of Object.values(value)) {
        const title = extractTitle(nested);
        if (title) return title;
    }
    return null;
}

async function resolveFromRoutes(routes, source) {
    for (const route of routes) {
        try {
            const data = await requestJson(route, { url: source });
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
    let source;
    try { source = parseSource(args.join(' ').trim(), platform); }
    catch (error) { return reply(sock, msg, ctx, `Media error: ${error.message}`); }

    const limit = checkRateLimit('download', ctx.sender || ctx.from);
    if (!limit.allowed) return reply(sock, msg, ctx, `Media rate limit reached. Try again in ${limit.retryAfterSeconds} seconds.`);

    const result = await resolveMedia(platform, source, kind);
    if (result) {
        const label = `${platform} ${kind}`;
        return reply(sock, msg, ctx, `Resolved ${label} link${result.title ? ` — ${result.title}` : ''}:\n${result.mediaUrl}\n\nOnly download or share media you are authorized to use.`);
    }
    return reply(sock, msg, ctx, `Media services are unavailable. Fallback source link:\n${source}`);
}

module.exports = [
    {
        name: 'ytv',
        aliases: ['youtube', 'youtubevideo', 'play'],
        description: 'Resolve an authorized YouTube video link.',
        category: 'download',
        execute: async (sock, msg, args, ctx) => handleDownload(sock, msg, ctx, args, 'youtube', 'video')
    },
    {
        name: 'yta',
        aliases: ['youtubeaudio', 'ytmp3'],
        description: 'Resolve an authorized YouTube audio link.',
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
        name: 'media',
        aliases: ['dl', 'download'],
        description: 'Resolve a supported public media link.',
        category: 'download',
        execute: async (sock, msg, args, ctx) => {
            let source;
            try {
                source = parseSource(args.join(' ').trim());
                const platform = detectPlatform(source);
                if (!platform) throw new Error('Supported sources are YouTube, TikTok, and Instagram.');
                return handleDownload(sock, msg, ctx, [source], platform, 'video');
            } catch (error) { return reply(sock, msg, ctx, `Media error: ${error.message}`); }
        }
    }
];

module.exports.resolveMedia = resolveMedia;
module.exports.findMediaUrl = findMediaUrl;
module.exports.detectPlatform = detectPlatform;
