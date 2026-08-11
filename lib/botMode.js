'use strict';

const fs = require('fs');
const path = require('path');

const VALID_MODES = new Set(['public', 'private']);

function getModeFilePath() {
    return process.env.BOT_MODE_FILE || path.join(__dirname, '..', 'data', 'bot-mode.json');
}

function normalizeMode(value) {
    const mode = String(value || '').trim().toLowerCase();
    return VALID_MODES.has(mode) ? mode : null;
}

function defaultMode() {
    return normalizeMode(process.env.BOT_MODE) || 'public';
}

function getBotMode() {
    try {
        const parsed = JSON.parse(fs.readFileSync(getModeFilePath(), 'utf8'));
        return normalizeMode(parsed?.mode) || defaultMode();
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('[Mode] Failed to read saved mode:', error.message);
        return defaultMode();
    }
}

function setBotMode(value) {
    const mode = normalizeMode(value);
    if (!mode) throw new Error('Mode must be either public or private.');

    const modeFile = getModeFilePath();
    fs.mkdirSync(path.dirname(modeFile), { recursive: true });
    const tempFile = `${modeFile}.${process.pid}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify({ mode }, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tempFile, modeFile);
    return mode;
}

function describeMode(mode) {
    return mode === 'private'
        ? 'Private: only the linked bot owner can execute commands.'
        : 'Public: everyone can use public categories; owner-category commands remain restricted.';
}

module.exports = { VALID_MODES, normalizeMode, getBotMode, setBotMode, describeMode, getModeFilePath };
