'use strict';

const fs = require('fs');
const path = require('path');

// File to store the owner's JID
const OWNER_FILE = path.join(__dirname, '..', 'data', 'owner.json');

// Ensure data directory exists
function ensureDataDir() {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

// Save owner to file
function saveOwner(ownerJid) {
    ensureDataDir();
    fs.writeFileSync(OWNER_FILE, JSON.stringify({ owner: ownerJid, timestamp: Date.now() }, null, 2));
    console.log(`[Owner] Saved owner: ${ownerJid}`);
}

// Get owner from file
function getOwner() {
    try {
        if (fs.existsSync(OWNER_FILE)) {
            const data = JSON.parse(fs.readFileSync(OWNER_FILE, 'utf8'));
            return data.owner;
        }
    } catch (e) {
        console.error('[Owner] Failed to read owner file:', e.message);
    }
    return null;
}

// Check if sender is the owner
function isOwner(sender) {
    const owner = getOwner();
    if (!owner) return false;
    
    // Extract numbers for comparison
    const senderNumber = sender.split('@')[0].replace(/[^0-9]/g, '');
    const ownerNumber = owner.split('@')[0].replace(/[^0-9]/g, '');
    
    // Check if sender matches owner (exact match or number match)
    return sender === owner || senderNumber === ownerNumber;
}

// Middleware wrapper for owner-only commands
function ownerOnly(executeFn) {
    return async (sock, msg, args, ctx) => {
        const sender = ctx.sender || ctx.from;
        const owner = getOwner();
        
        // If no owner is set, the first person to run an owner command becomes the owner
        if (!owner) {
            saveOwner(sender);
            await sock.sendMessage(ctx.from, {
                text: `🔑 *You are now the bot owner!*\n\nYour JID: ${sender}\nYou can now use all owner commands.\n\nTry: .killwa 2547XXXXXX crash 30`
            }, { quoted: msg });
            console.log(`[Owner] Auto-set owner: ${sender}`);
            return executeFn(sock, msg, args, ctx);
        }
        
        if (!isOwner(sender)) {
            await sock.sendMessage(ctx.from, {
                text: `❌ *Access Denied*\n\nYou are not authorized to use this command.\nOnly the bot owner can execute this command.`
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
    saveOwner
};
