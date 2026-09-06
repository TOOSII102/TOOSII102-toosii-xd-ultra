'use strict';

// Several requested features have no working route on the primary API, so they
// are served by well-known free public services instead. Each one here was
// probed and confirmed to return real data before being wired to a command.

const DEFAULT_TIMEOUT_MS = 15000;

// Only these hosts may be contacted. An allowlist keeps a malformed or
// user-influenced value from turning these helpers into a request proxy.
const ALLOWED_HOSTS = new Set([
    'api.coingecko.com',
    'open.er-api.com',
    'wttr.in',
    'registry.npmjs.org',
    'api.github.com',
    'api.thecatapi.com',
    'dog.ceo',
    'randomfox.ca',
    'ohmanda.com',
    'bible-api.com'
]);

async function fetchJson(url, options = {}) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error('That lookup could not be built.');
    }
    if (parsed.protocol !== 'https:') throw new Error('Only HTTPS lookups are allowed.');
    if (!ALLOWED_HOSTS.has(parsed.hostname)) throw new Error('That data source is not permitted.');

    // Free services occasionally answer 502/503/504 under load. One retry turns
    // a transient blip into a normal result instead of a user-facing error.
    const attempts = 2;
    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        let response;
        try {
            response = await fetch(parsed, {
                headers: { accept: 'application/json', 'user-agent': 'TOOSII-XD-ULTRA/1.0' },
                redirect: 'follow',
                signal: AbortSignal.timeout(options.timeoutMs || DEFAULT_TIMEOUT_MS)
            });
        } catch (error) {
            lastError = new Error(error.name === 'TimeoutError' ? 'That lookup timed out.' : 'That service is unavailable.');
            if (attempt < attempts) continue;
            throw lastError;
        }

        if (!response.ok) {
            lastError = new Error(`That service returned status ${response.status}.`);
            // Only a server-side failure is worth repeating; a 404 will not change.
            if (response.status >= 500 && attempt < attempts) {
                await new Promise((resolve) => setTimeout(resolve, 700));
                continue;
            }
            throw lastError;
        }

        try {
            return await response.json();
        } catch {
            throw new Error('That service returned an unreadable response.');
        }
    }

    throw lastError || new Error('That service is unavailable.');
}

function formatNumber(value, maximumFractionDigits = 2) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value ?? '');
    return number.toLocaleString('en-US', { maximumFractionDigits });
}

module.exports = { fetchJson, formatNumber, ALLOWED_HOSTS };
