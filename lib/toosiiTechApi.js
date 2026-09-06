'use strict';

// Client for the Toosii Tech developer API (toosiitechdevelopertools.zone.id).
// This is the project's own platform and needs no key. Every route used here
// was probed and confirmed to return real data.

const DEFAULT_BASE_URL = 'https://toosiitechdevelopertools.zone.id';
const BASE_URL_VARIABLE = 'TOOSII_TECH_BASE_URL';
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
    const init = {
        headers: { accept: 'application/json', 'user-agent': 'TOOSII-XD-ULTRA/1.0' },
        signal: AbortSignal.timeout(options.timeoutMs || REQUEST_TIMEOUT_MS)
    };
    if (options.body !== undefined) {
        init.method = 'POST';
        init.headers['content-type'] = 'application/json';
        init.body = JSON.stringify(options.body);
    }

    let response;
    try {
        response = await fetch(url, init);
    } catch (error) {
        throw new Error(error.name === 'TimeoutError'
            ? 'The Toosii service timed out.'
            : 'The Toosii service is unavailable.');
    }
    if (!response.ok) throw new Error(`The Toosii service returned status ${response.status}.`);

    let payload;
    try {
        payload = await response.json();
    } catch {
        throw new Error('The Toosii service returned an unreadable response.');
    }
    // Routes answer HTTP 200 even when the operation failed, signalling it in
    // the body, so the envelope has to be checked too.
    if (payload && typeof payload === 'object') {
        if (payload.success === false) throw new Error(payload.error || payload.message || 'That request failed.');
        if (payload.error && !payload.data && !payload.results) throw new Error(String(payload.error));
    }
    return payload;
}

async function searchSpotify(query, limit = 10) {
    const payload = await request('/api/search/spotify', { q: query });
    const results = Array.isArray(payload?.results) ? payload.results : [];
    return results.slice(0, limit);
}

// The downloader takes a Spotify track URL and returns a direct MP3 link.
async function downloadSpotify(trackUrl) {
    const payload = await request('/api/download/spotify', {}, { body: { url: trackUrl }, timeoutMs: 60000 });
    const url = payload?.download_url || payload?.downloadUrl || payload?.url;
    if (!url) throw new Error('No downloadable audio was returned for that track.');
    return { url, title: payload.title || null };
}

async function sports(league = 'eng.1') {
    const payload = await request('/api/v1/sports', { league });
    return {
        league: payload?.league?.name || league,
        events: Array.isArray(payload?.events) ? payload.events : []
    };
}

async function books(query, limit = 5) {
    const payload = await request('/api/v1/books/search', { query, limit });
    const data = payload?.data || payload?.results || [];
    return Array.isArray(data) ? data : (Array.isArray(data?.books) ? data.books : []);
}

async function holidays(country = 'KE', year = new Date().getFullYear()) {
    const payload = await request('/api/v1/holidays', { country, year });
    const data = payload?.data || payload?.holidays || [];
    return Array.isArray(data) ? data : (Array.isArray(data?.holidays) ? data.holidays : []);
}

module.exports = {
    DEFAULT_BASE_URL,
    request,
    searchSpotify,
    downloadSpotify,
    sports,
    books,
    holidays
};
