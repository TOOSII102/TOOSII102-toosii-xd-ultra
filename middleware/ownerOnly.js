'use strict';

const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '..', 'session');
const OWNER_FILE = path.join(__dirname, '..', 'data', 'owner.json');

// Get owner from session credentials
function getOwnerFromSession() {
    try {
        const credsPath = path.join(SESSION_DIR, 'creds.json');
        if (fs.existsSync(credsPath)) {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            if (creds.me && creds.me.id) {
                return creds.me.id;
            }
        }
    } catch (e) {
        console.error('[Owner] Failed to read session:', e.message);
    }
    return null;
}

// Cache the owner
let cachedOwner = null;
let cacheTime = 0;
const CACHE_DURATION = 60000;

function getOwner() {
    const now = Date.now();
    if (!cachedOwner || (now - cacheTime) > CACHE_DURATION) {
        cachedOwner = getOwnerFromSession();
        cacheTime = now;
        if (cachedOwner) {
            console.log(`[Owner] Detected owner from session: ${cachedOwner}`);
        } else {
            console.log('[Owner] No owner detected in session');
        }
    }
    return cachedOwner;
}

// Get owner identifiers (phone number and full JID)
function getOwnerIdentifiers() {
    const owner = getOwner();
    if (!owner) return { jid: null, phone: null };
    const phone = owner.split('@')[0].replace(/[^0-9]/g, '');
    return { jid: owner, phone };
}

// Robust isOwner: compare only the numeric phone number
function isOwner(sender) {
    const owner = getOwner();
    if (!owner) return false;

    // Extract numeric part from sender
    const senderNumber = sender.split('@')[0].replace(/[^0-9]/g, '');
    const ownerNumber = owner.split('@')[0].replace(/[^0-9]/g, '');

    // Also check if sender JID equals owner JID (exact match)
    const exactMatch = sender === owner;

    // Check if sender number matches owner number
    const numberMatch = senderNumber === ownerNumber;

    // Also handle the case where sender is a LID that contains the owner number
    const lidMatch = sender.includes(ownerNumber) && sender.includes('@lid');

    return exactMatch || numberMatch || lidMatch;
}

function ownerOnly(executeFn) {
    return async (sock, msg, args, ctx) => {
        const sender = ctx.sender || ctx.from;
        const owner = getOwner();

        if (!owner) {
            await sock.sendMessage(ctx.from, {
                text: `❌ *No Owner Found*\n\nNo session owner detected.\n\nPlease re-pair the bot by deleting the session folder and restarting.`
            }, { quoted: msg });
            return;
        }

        if (!isOwner(sender)) {
            await sock.sendMessage(ctx.from, {
                text: `❌ *Access Denied*\n\nYou are not authorized to use this command.\n\nOnly the bot deployer/owner can execute this command.\n\nOwner: ${owner}`
            }, { quoted: msg });
            return;
        }

        return executeFn(sock, msg, args, ctx);
    };
}

module.exports = {
    isOwner,
    ownerOnly,
    getOwner,
    getOwnerIdentifiers
};
