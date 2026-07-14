'use strict';

const { OWNER_NUMBER } = require('../config');

function isOwner(sender) {
    const senderNumber = sender.split('@')[0].replace(/[^0-9]/g, '');
    const ownerNumber = OWNER_NUMBER.replace(/[^0-9]/g, '');
    return senderNumber === ownerNumber;
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
