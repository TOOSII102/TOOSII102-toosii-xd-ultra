'use strict';

const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '..', 'session');

// Get owner from session credentials (the person who deployed/paird the bot)
function getOwnerFromSession() {
    try {
        const credsPath = path.join(SESSION_DIR, 'creds.json');
        if (fs.existsSync(credsPath)) {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            
            // Check for me.id (the owner who paired the bot)
            if (creds.me && creds.me.id) {
                return creds.me.id;
            }
            
            // Check for registered user
            if (creds.registered) {
                // Try to find the owner JID
                if (creds.me && creds.me.name) {
                    // Some formats store it differently
                    for (const key of Object.keys(creds)) {
                        if (typeof creds[key] === 'string' && 
                            (creds[key].includes('@s.whatsapp.net') || 
                             creds[key].includes('@lid'))) {
                            return creds[key];
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error('[Owner] Failed to read session:', e.message);
    }
    return null;
}

// Cache the owner so we don't read the file every time
let cachedOwner = null;
let cacheTime = 0;
const CACHE_DURATION = 60000; // 1 minute

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

// Check if sender is the owner
function isOwner(sender) {
    const owner = getOwner();
    if (!owner) return false;
    
    // Clean both for comparison
    const senderClean = sender.split('@')[0].replace(/[^0-9]/g, '');
    const ownerClean = owner.split('@')[0].replace(/[^0-9]/g, '');
    
    // Check exact match OR number match
    return sender === owner || senderClean === ownerClean;
}

// Middleware wrapper for owner-only commands
function ownerOnly(executeFn) {
    return async (sock, msg, args, ctx) => {
        const sender = ctx.sender || ctx.from;
        const owner = getOwner();
        
        // No owner found - bot needs to be re-paired
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
        
        // Owner is authorized - execute the command
        return executeFn(sock, msg, args, ctx);
    };
}

// Force refresh owner cache (useful after re-pairing)
function refreshOwner() {
    cachedOwner = null;
    cacheTime = 0;
    return getOwner();
}

module.exports = {
    isOwner,
    ownerOnly,
    getOwner,
    refreshOwner
};
