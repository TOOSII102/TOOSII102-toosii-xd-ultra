'use strict';

// Client for the Dave Tech Movie API (https://davexmovieapi.zone.id).
// No auth required. Every route used here was probed and confirmed to return
// real data, including MP4 links that serve actual bytes.

const DEFAULT_BASE_URL = 'https://davexmovieapi.zone.id';
const BASE_URL_VARIABLE = 'MOVIE_API_BASE_URL';
const REQUEST_TIMEOUT_MS = 30000;

function getBaseUrl() {
    const configured = process.env[BASE_URL_VARIABLE] || DEFAULT_BASE_URL;
    let parsed;
    try {
        parsed = new URL(configured);
    } catch {
        throw new Error(`${BASE_URL_VARIABLE} must be a valid absolute URL.`);
    }
    if (parsed.protocol !== 'https:') throw new Error(`${BASE_URL_VARIABLE} must use HTTPS.`);
    return parsed;
}

function buildUrl(route, parameters = {}) {
    if (!route.startsWith('/')) throw new Error('API route must begin with /.');
    const url = new URL(route, getBaseUrl());
    for (const [key, value] of Object.entries(parameters)) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    return url;
}

async function request(route, parameters = {}, options = {}) {
    const url = buildUrl(route, parameters);
    let response;
    try {
        response = await fetch(url, {
            headers: { accept: 'application/json', 'user-agent': 'TOOSII-XD-ULTRA/1.0' },
            signal: AbortSignal.timeout(options.timeoutMs || REQUEST_TIMEOUT_MS)
        });
    } catch (error) {
        throw new Error(error.name === 'TimeoutError'
            ? 'The movie service timed out.'
            : 'The movie service is unavailable.');
    }
    if (response.status === 404) throw new Error('Nothing was found for that request.');
    if (!response.ok) throw new Error(`The movie service returned status ${response.status}.`);
    try {
        return await response.json();
    } catch {
        throw new Error('The movie service returned an unreadable response.');
    }
}

// A subject id is an opaque numeric string. Validate it before putting it in a
// path so nothing user-supplied can traverse to another route.
function assertSubjectId(id) {
    const value = String(id ?? '').trim();
    if (!/^\d{6,25}$/.test(value)) throw new Error('That title id is not valid.');
    return value;
}

async function search(query, type = 'ALL', perPage = 20) {
    const payload = await request('/search', { q: query, type, page: 1, per_page: perPage });
    return Array.isArray(payload?.results) ? payload.results : [];
}

async function suggest(query, limit = 10) {
    const payload = await request('/suggest', { q: query, limit });
    return Array.isArray(payload?.suggestions) ? payload.suggestions : [];
}

async function item(subjectId) {
    return request(`/item/${assertSubjectId(subjectId)}`);
}

async function seasons(subjectId) {
    return request(`/item/${assertSubjectId(subjectId)}/seasons`);
}

async function trending(tab = 0) {
    return request('/trending', { tab, page: 1 });
}

async function hot(page = 1) {
    const payload = await request('/hot', { page });
    return Array.isArray(payload?.results) ? payload.results : [];
}

async function animeSearch(query, perPage = 20) {
    const payload = await request('/anime/search', { q: query, page: 1, per_page: perPage });
    return Array.isArray(payload?.results) ? payload.results : [];
}

// Downloads are returned keyed by quality. Flatten them into a list sorted
// smallest first, because WhatsApp caps uploads and the smallest file is the
// one most likely to be sendable.
async function downloads(subjectId, resolution = 360, extra = {}) {
    const payload = await request(`/item/${assertSubjectId(subjectId)}/downloads`, { resolution, ...extra }, { timeoutMs: 60000 });
    const byQuality = payload?.by_quality && typeof payload.by_quality === 'object' ? payload.by_quality : {};
    const list = Array.isArray(payload?.list) ? payload.list : [];

    const seen = new Set();
    const files = [];
    for (const entry of [...Object.values(byQuality), ...list]) {
        if (!entry || typeof entry !== 'object') continue;
        const url = entry.downloadUrl || entry.download_url || entry.url;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        files.push({
            url,
            playbackUrl: entry.playback_url || entry.proxyUrl || entry.proxy_url || null,
            title: entry.title || null,
            quality: entry.quality || (entry.resolution ? `${entry.resolution}p` : 'unknown'),
            resolution: Number(entry.resolution) || 0,
            format: entry.format || 'mp4',
            bytes: Number(entry.file_size || entry.fileSize) || 0
        });
    }
    files.sort((left, right) => (left.bytes || Infinity) - (right.bytes || Infinity));
    return files;
}

async function captions(subjectId, resolution = 360) {
    const payload = await request(`/item/${assertSubjectId(subjectId)}/captions/auto`, { resolution }, { timeoutMs: 60000 });
    return Array.isArray(payload?.captions) ? payload.captions : [];
}

function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return 'unknown size';
    if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
    if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(0)} MB`;
    return `${(value / 1024).toFixed(0)} KB`;
}

module.exports = {
    DEFAULT_BASE_URL,
    request,
    assertSubjectId,
    search,
    suggest,
    item,
    seasons,
    trending,
    hot,
    animeSearch,
    downloads,
    captions,
    formatBytes
};
