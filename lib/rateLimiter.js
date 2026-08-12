'use strict';

const fs = require('fs');
const path = require('path');

let state = null;

function getStateFile() {
    return process.env.RATE_LIMIT_FILE || path.join(__dirname, '..', 'data', 'rate-limits.json');
}

function positiveInteger(value, fallback, minimum, maximum) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function getPolicy(scope) {
    const normalized = String(scope || '').toLowerCase();
    if (normalized === 'ai') {
        return {
            maxRequests: positiveInteger(process.env.AI_RATE_LIMIT_MAX, 1, 1, 100),
            windowMs: positiveInteger(process.env.AI_RATE_LIMIT_WINDOW_SECONDS, 2, 1, 3600) * 1000
        };
    }
    if (normalized === 'download') {
        return {
            maxRequests: positiveInteger(process.env.MEDIA_RATE_LIMIT_MAX, 1, 1, 100),
            windowMs: positiveInteger(process.env.MEDIA_RATE_LIMIT_WINDOW_SECONDS, 2, 1, 3600) * 1000
        };
    }
    throw new Error(`Unknown rate-limit scope: ${scope}`);
}

function loadState() {
    if (state) return state;
    try {
        const parsed = JSON.parse(fs.readFileSync(getStateFile(), 'utf8'));
        state = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('[RateLimit] Failed to load state:', error.message);
        state = {};
    }
    return state;
}

function saveState() {
    const file = getStateFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tempFile = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tempFile, file);
}

function key(scope, sender) {
    return `${scope}:${String(sender || 'unknown').split('@')[0].split(':')[0]}`;
}

function checkRateLimit(scope, sender, now = Date.now()) {
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
        return { allowed: true, remaining: Infinity, retryAfterSeconds: 0, disabled: true };
    }

    const policy = getPolicy(scope);
    const limits = loadState();
    const identifier = key(scope, sender);
    const timestamps = Array.isArray(limits[identifier]) ? limits[identifier].filter((time) => Number.isFinite(time) && now - time < policy.windowMs) : [];

    if (timestamps.length >= policy.maxRequests) {
        limits[identifier] = timestamps;
        saveState();
        const oldest = Math.min(...timestamps);
        return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds: Math.max(1, Math.ceil((policy.windowMs - (now - oldest)) / 1000)),
            disabled: false
        };
    }

    timestamps.push(now);
    limits[identifier] = timestamps;
    saveState();
    return {
        allowed: true,
        remaining: policy.maxRequests - timestamps.length,
        retryAfterSeconds: 0,
        disabled: false
    };
}

function resetRateLimits(removeFile = false) {
    state = {};
    if (removeFile) fs.rmSync(getStateFile(), { force: true });
}

module.exports = { getPolicy, checkRateLimit, resetRateLimits, getStateFile };
