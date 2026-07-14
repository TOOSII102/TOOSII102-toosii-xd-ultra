const fs = require('fs');
const path = require('path');
const { SESSION_ID, SESSION_PREFIX } = require('../config');

const SESSION_DIR = path.join(__dirname, '..', 'session');
const CREDS_PATH = path.join(SESSION_DIR, 'creds.json');

function loadSessionFromId() {
    if (!SESSION_ID) {
        console.log('[Session] No SESSION_ID set — you will need to pair via QR/code on first run.');
        return false;
    }

    if (!SESSION_ID.startsWith(SESSION_PREFIX)) {
        console.error(`[Session] SESSION_ID does not start with expected prefix "${SESSION_PREFIX}". Check config.js.`);
        return false;
    }

    try {
        const b64 = SESSION_ID.slice(SESSION_PREFIX.length);
        const credsJson = Buffer.from(b64, 'base64').toString('utf-8');

        const parsed = JSON.parse(credsJson);
        if (!parsed?.me?.id) {
            throw new Error('Decoded session has no me.id — likely corrupted or incomplete.');
        }

        if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
        fs.writeFileSync(CREDS_PATH, credsJson);
        console.log('[Session] Loaded session for', parsed.me.id);
        return true;
    } catch (err) {
        console.error('[Session] Failed to decode SESSION_ID:', err.message);
        return false;
    }
}

module.exports = { loadSessionFromId, SESSION_DIR };
