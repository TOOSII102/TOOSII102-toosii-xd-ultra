'use strict';

const DEFAULT_BASE_URL = 'https://apiskeith2-production-3020.up.railway.app';
const REQUEST_TIMEOUT_MS = 8000;

function getBaseUrl() {
    const configured = process.env.KEITH_API_BASE_URL || DEFAULT_BASE_URL;
    let parsed;
    try {
        parsed = new URL(configured);
    } catch {
        throw new Error('KEITH_API_BASE_URL must be a valid absolute URL.');
    }
    if (parsed.protocol !== 'https:') throw new Error('KEITH_API_BASE_URL must use HTTPS.');
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

async function requestJson(route, parameters = {}, options = {}) {
    const url = buildUrl(route, parameters);
    // Some upstream endpoints (dictionary, AI tutors) routinely take longer than
    // the default budget, so callers may extend it per request.
    const timeoutMs = Number.isFinite(options.timeoutMs)
        ? Math.min(Math.max(options.timeoutMs, 1000), 30000)
        : REQUEST_TIMEOUT_MS;
    let response;
    try {
        response = await fetch(url, {
            headers: { accept: 'application/json', 'user-agent': 'TOOSII-XD-ULTRA/1.0' },
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (error) {
        if (error.name === 'TimeoutError') throw new Error('The API request timed out.');
        throw new Error('The API service is unavailable.');
    }
    if (!response.ok) throw new Error(`The API service returned status ${response.status}.`);
    let payload;
    try {
        payload = await response.json();
    } catch {
        throw new Error('The API service returned invalid JSON.');
    }
    // The upstream service answers HTTP 200 even when a provider fails. It signals the
    // real outcome in the body, using several shapes across endpoints:
    //   { status: false, error: '...' }        most endpoints
    //   { success: false, message: '...' }     soundcloud and friends
    //   { status: true, result: { status: false, message: '...' } }  nested resolvers
    assertPayloadSucceeded(payload);
    assertPayloadSucceeded(payload && typeof payload === 'object' ? payload.result : null);
    return payload;
}

function assertPayloadSucceeded(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
    if (payload.status !== false && payload.success !== false) return;
    const detail = [payload.error, payload.message]
        .find((candidate) => typeof candidate === 'string' && candidate.trim());
    throw new Error(detail ? detail.trim() : 'The API service reported a failed request.');
}

module.exports = { DEFAULT_BASE_URL, REQUEST_TIMEOUT_MS, getBaseUrl, buildUrl, requestJson, assertPayloadSucceeded };
