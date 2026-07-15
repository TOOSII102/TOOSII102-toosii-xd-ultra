'use strict';

const { OWNER_NUMBER } = require('../config');

// Add your actual LID here
const OWNER_LID = '268286071726080'; // Your LID from the debug log

function isOwner(sender) {
    // Extract number from sender
    let senderNumber = sender.split('@')[0].replace(/[^0-9]/g, '');
    const ownerNumber = OWNER_NUMBER.replace(/[^0-9]/g, '');
    
    // Check by LID or by number
    const isMatch = senderNumber === ownerNumber || 
                    senderNumber === OWNER_LID ||
                    sender.includes(OWNER_LID) ||
                    senderNumber.endsWith(ownerNumber);
    
    return isMatch;
}

function ownerOnly(executeFn) {
    return async (sock, msg, args, ctx) => {
        const sender = ctx.sender || ctx.from;
        
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
    ownerOnly
};
