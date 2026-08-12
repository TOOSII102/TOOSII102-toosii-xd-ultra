'use strict';

const fs = require('fs');
const path = require('path');
const { OWNER_NUMBER } = require('../config');

const SESSION_DIR = path.join(__dirname, '..', 'session');
const CACHE_DURATION = 60000;
let cachedOwner = null;
let cacheTime = 0;
let runtimeOwnerIds = new Set();
let runtimeOwnerPhone = null;

function splitJid(value) {
    const source = String(value || '').trim().toLowerCase();
    const [user = '', domain = ''] = source.split('@');
    return { user: user.split(':')[0], domain };
}

function normalizePhone(value) {
    const { user, domain } = splitJid(value);
    // A WhatsApp LID is not a phone number. It may be numeric, but must only
    // be matched exactly against the linked runtime LID, never as a phone.
    if (domain === 'lid') return '';
    return user.replace(/[^0-9]/g, '');
}

function normalizeIdentity(value) {
    const { user, domain } = splitJid(value);
    if (!user) return '';
    if (domain === 'lid') return `lid:${user}`;

    const phone = user.replace(/[^0-9]/g, '');
    if (phone && (!domain || domain === 's.whatsapp.net' || domain === 'c.us')) {
        return `phone:${phone}`;
    }
    return domain ? `${user}@${domain}` : '';
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

function setRuntimeOwner(user) {
    const ids = new Set();
    for (const candidate of [user?.id, user?.lid]) {
        const normalized = normalizeIdentity(candidate);
        if (normalized) ids.add(normalized);
    }
    runtimeOwnerIds = ids;
    runtimeOwnerPhone = normalizePhone(user?.id) || normalizePhone(user?.phone) || null;
}

function getOwnerIdentifiers() {
    const sessionJid = getOwner();
    const configuredPhone = normalizePhone(OWNER_NUMBER);
    const sessionIdentity = normalizeIdentity(sessionJid);
    const sessionPhone = normalizePhone(sessionJid);
    const identities = new Set(runtimeOwnerIds);

    if (sessionIdentity) identities.add(sessionIdentity);
    if (configuredPhone) identities.add(`phone:${configuredPhone}`);

    return {
        jid: sessionJid || null,
        phone: runtimeOwnerPhone || sessionPhone || configuredPhone || null,
        identities
    };
}

function hasLinkedOwner() {
    const { jid, identities } = getOwnerIdentifiers();
    return Boolean(jid || identities.size);
}

function isOwner(sender) {
    const senderIdentity = normalizeIdentity(sender);
    if (!senderIdentity) return false;
    return getOwnerIdentifiers().identities.has(senderIdentity);
}

function isOwnerMessage(sender, fromMe) {
    // `fromMe` is asserted by the authenticated Baileys socket, not supplied
    // by a chat participant. This makes self-chat control reliable when JID
    // formats differ between the primary account and linked device.
    return fromMe === true || isOwner(sender);
}

function ownerOnly(executeFn) {
    return async (sock, msg, args, ctx) => {
        if (!hasLinkedOwner()) {
            await sock.sendMessage(ctx.from, {
                text: 'No linked owner session was found. Re-link an account you control before using owner commands.'
            }, { quoted: msg });
            return;
        }

        // `ctx.isOwner` is computed only by the central message router. It
        // covers authenticated fromMe messages when WhatsApp presents the
        // primary account with a phone JID but the linked device with a LID.
        const permitted = ctx?.isOwner === true || isOwner(ctx?.sender || ctx?.from);
        if (!permitted) {
            await sock.sendMessage(ctx.from, {
                text: 'Access denied. This command is restricted to the bot owner.'
            }, { quoted: msg });
            return;
        }

        return executeFn(sock, msg, args, ctx);
    };
}

module.exports = {
    normalizePhone,
    normalizeIdentity,
    isOwner,
    isOwnerMessage,
    ownerOnly,
    getOwner,
    getOwnerIdentifiers,
    hasLinkedOwner,
    setRuntimeOwner
};
