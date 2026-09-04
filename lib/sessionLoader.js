const fs = require('fs');
const path = require('path');
const { SESSION_ID, SESSION_PREFIX } = require('../config');

// Overridable so the test suites can operate on a throwaway directory. Running
// the tests used to wipe the live session/ and log a production bot out.
const SESSION_DIR = process.env.SESSION_DIR
    ? path.resolve(process.env.SESSION_DIR)
    : path.join(__dirname, '..', 'session');
const CREDS_PATH = path.join(SESSION_DIR, 'creds.json');

const PLACEHOLDER_MARKER = 'PASTE_YOUR_SESSION_STRING_HERE';

/**
 * Takes the pasted SESSION_ID (from the session generator) and writes it out
 * as creds.json inside ./session, so useMultiFileAuthState can pick it up.
 */
function loadSessionFromId() {
    if (!SESSION_ID || SESSION_ID.includes(PLACEHOLDER_MARKER)) {
        console.log('[Session] No real SESSION_ID set in .env — pairing code will be used instead.');
        return false;
    }

    if (!SESSION_ID.startsWith(SESSION_PREFIX)) {
        console.error(`[Session] SESSION_ID does not start with expected prefix "${SESSION_PREFIX}". Check config.js.`);
        return false;
    }

    try {
        const b64 = SESSION_ID.slice(SESSION_PREFIX.length);
        const credsJson = Buffer.from(b64, 'base64').toString('utf-8');

        // Sanity check it's real creds data before writing
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
