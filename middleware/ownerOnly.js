'use strict';

const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '..', 'session');

// Get owner from session credentials
function getOwnerFromSession() {
    try {
        const credsPath = path.join(SESSION_DIR, 'creds.json');
        if (fs.existsSync(credsPath)) {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            
            if (creds.me && creds.me.id) {
                return creds.me.id;
            }
            
            if (creds.registered) {
                for (const key of Object.keys(creds)) {
                    if (typeof creds[key] === 'string' && 
                        (creds[key].includes('@s.whatsapp.net') || 
                         creds[key].includes('@lid'))) {
                        return creds[key];
                    }
                }
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

// Get both the owner's phone number and LID
function getOwnerIdentifiers() {
    const owner = getOwner();
    if (!owner) return { phone: null, lid: null };
    
    // Extract number from owner JID
    const ownerNumber = owner.split('@')[0].replace(/[^0-9]/g, '');
    
    return {
        jid: owner,
        phone: ownerNumber,
        // The LID is the owner's LID - we can't know it without storing it
        // We'll check both formats
    };
}

// Check if sender is the owner (handles both phone and LID formats)
function isOwner(sender) {
    const owner = getOwner();
    if (!owner) return false;
    
    // Clean sender
    const senderNumber = sender.split('@')[0].replace(/[^0-9]/g, '');
    const ownerNumber = owner.split('@')[0].replace(/[^0-9]/g, '');
    
    // Check if sender matches the owner's number OR owner's full JID
    // This handles both 254780719665@s.whatsapp.net and 268286071726080@lid
    const isMatch = sender === owner || 
                    senderNumber === ownerNumber ||
                    sender.includes(ownerNumber) ||
                    ownerNumber.includes(senderNumber);
    
    return isMatch;
}

// Middleware wrapper for owner-only commands
function ownerOnly(executeFn) {
    return async (sock, msg, args, ctx) => {
        const sender = ctx.sender || ctx.from;
        const owner = getOwner();
        const ownerIdentifiers = getOwnerIdentifiers();
        
        // No owner found
        if (!owner) {
            await sock.sendMessage(ctx.from, {
                text: `❌ *No Owner Found*\n\nNo session owner detected.\n\nPlease re-pair the bot by deleting the session folder and restarting.\n\nCommand: rm -rf session && npm start`
            }, { quoted: msg });
            return;
        }
        
        // Check if sender is the owner
        if (!isOwner(sender)) {
            await sock.sendMessage(ctx.from, {
                text: `❌ *Access Denied*\n\nYou are not authorized to use this command.\n\nOnly the bot deployer/owner can execute this command.\n\nOwner: ${owner}`
            }, { quoted: msg });
            return;
        }
        
        return executeFn(sock, msg, args, ctx);
    };
}

// Force refresh owner cache
function refreshOwner() {
    cachedOwner = null;
    cacheTime = 0;
    return getOwner();
}

module.exports = {
    isOwner,
    ownerOnly,
    getOwner,
    refreshOwner,
    getOwnerIdentifiers
};
