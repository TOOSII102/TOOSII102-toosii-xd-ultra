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
    // A live session is the source of truth. Baileys rotates keys constantly and
    // writes them back to creds.json, so the SESSION_ID string in .env goes stale
    // the moment the bot connects. Overwriting a working creds.json with that
    // stale copy resets the ratchet state and logs the device out, which also
    // happens on every reconnect and after .update or .restart.
    if (fs.existsSync(CREDS_PATH)) {
        try {
            const existing = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf-8'));
            if (existing?.me?.id) {
                console.log('[Session] Keeping the existing session for', existing.me.id);
                return true;
            }
            console.warn('[Session] creds.json has no me.id; treating it as unusable.');
        } catch (error) {
            console.warn('[Session] creds.json could not be read:', error.message);
        }
        // Only reached when the file is corrupt, so replacing it loses nothing.
    }

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
        // Write to a temp file and rename, so an interrupted write cannot leave a
        // half-written creds.json that no longer authenticates.
        const tempPath = `${CREDS_PATH}.${process.pid}.tmp`;
        fs.writeFileSync(tempPath, credsJson, { mode: 0o600 });
        fs.renameSync(tempPath, CREDS_PATH);
        console.log('[Session] Loaded session for', parsed.me.id);
        return true;
    } catch (err) {
        console.error('[Session] Failed to decode SESSION_ID:', err.message);
        return false;
    }
}

module.exports = { loadSessionFromId, SESSION_DIR };
