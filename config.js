try { require('dotenv').config(); } catch (_) { /* dotenv not installed, env vars can still be set manually */ }

module.exports = {
    // Prefix used before every command, e.g. ".ping"
    PREFIX: process.env.PREFIX || '.',

    // Bot identity
    BOT_NAME: process.env.BOT_NAME || 'TOOSII-XD-ULTRA',

    // Owner number in international format, no '+' or spaces, e.g. 254700000000
    OWNER_NUMBER: process.env.OWNER_NUMBER || '',

    // Paste the session string produced by the session generator here,
    // OR set it as an env var called SESSION_ID.
    SESSION_ID: process.env.SESSION_ID || '',

    // Must match the SESSION_PREFIX used by whichever session generator produced SESSION_ID
    SESSION_PREFIX: process.env.SESSION_PREFIX || 'TOOSII-XD:',

    // Session directory
    SESSION_DIR: './session'
};
