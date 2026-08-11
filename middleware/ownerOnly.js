'use strict';

const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '..', 'session');
const CACHE_DURATION = 60000;
let cachedOwner = null;
let cacheTime = 0;

function normalizePhone(value) {
    return String(value || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function getOwnerFromSession() {
    try {
        const credsPath = path.join(SESSION_DIR, 'creds.json');
        if (!fs.existsSync(credsPath)) return null;
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        return creds?.me?.id || null;
    } catch (error) {
        console.error('[Owner] Failed to read the linked session:', error.message);
        return null;
    }
}

function getOwner() {
    const now = Date.now();
    if (!cachedOwner || now - cacheTime > CACHE_DURATION) {
        cachedOwner = getOwnerFromSession();
        cacheTime = now;
    }
    return cachedOwner;
}

function getOwnerIdentifiers() {
    const jid = getOwner();
    return { jid, phone: normalizePhone(jid) || null };
}

function isOwner(sender) {
    const { phone: ownerPhone } = getOwnerIdentifiers();
    const senderPhone = normalizePhone(sender);
    return Boolean(ownerPhone) && senderPhone === ownerPhone;
}

function ownerOnly(executeFn) {
    return async (sock, msg, args, ctx) => {
        if (!getOwner()) {
            await sock.sendMessage(ctx.from, {
                text: 'No linked owner session was found. Re-link an account you control before using owner commands.'
            }, { quoted: msg });
            return;
        }

        if (!isOwner(ctx.sender || ctx.from)) {
            await sock.sendMessage(ctx.from, {
                text: 'Access denied. This command is restricted to the bot owner.'
            }, { quoted: msg });
            return;
        }

        return executeFn(sock, msg, args, ctx);
    };
}

module.exports = { normalizePhone, isOwner, ownerOnly, getOwner, getOwnerIdentifiers };
