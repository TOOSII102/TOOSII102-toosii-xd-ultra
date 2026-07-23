'use strict';

const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '..', 'session');

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
        }
    }
    return cachedOwner;
}

function getOwnerIdentifiers() {
    const owner = getOwner();
    if (!owner) return { jid: null, phone: null };
    const phone = owner.split('@')[0].replace(/[^0-9]/g, '');
    return { jid: owner, phone };
}

function isOwner(sender) {
    const owner = getOwner();
    if (!owner) return false;

    // Extract JUST the phone number from sender
    const senderNumber = sender.split('@')[0].replace(/[^0-9]/g, '');
    const ownerNumber = owner.split('@')[0].replace(/[^0-9]/g, '');

    console.log(`[Owner Check] Sender: ${senderNumber} | Owner: ${ownerNumber}`);

    // Compare only the phone numbers
    return senderNumber === ownerNumber;
}

function ownerOnly(executeFn) {
    return async (sock, msg, args, ctx) => {
        const sender = ctx.sender || ctx.from;
        const owner = getOwner();

        if (!owner) {
            await sock.sendMessage(ctx.from, {
                text: `❌ *No Owner Found*\n\nPlease re-pair the bot by deleting the session folder and restarting.`
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
