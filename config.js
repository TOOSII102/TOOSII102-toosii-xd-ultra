try { require('dotenv').config(); } catch (_) { /* dotenv not installed */ }

module.exports = {
    PREFIX: process.env.PREFIX || '.',
    BOT_NAME: process.env.BOT_NAME || 'TOOSII-XD-ULTRA',
    OWNER_NUMBER: process.env.OWNER_NUMBER || '',
    SESSION_ID: process.env.SESSION_ID || '',
    SESSION_PREFIX: process.env.SESSION_PREFIX || 'TOOSII-XD:',
    SESSION_DIR: './session'
};
