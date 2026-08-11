'use strict';

const { ownerOnly } = require('../../middleware/ownerOnly');
const { getBotMode, setBotMode, describeMode } = require('../../lib/botMode');

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

module.exports = {
    name: 'mode',
    aliases: ['botmode', 'setmode'],
    description: 'View or change the bot access mode.',
    category: 'owner',
    execute: ownerOnly(async (sock, msg, args, ctx) => {
        const requestedMode = (args[0] || 'status').toLowerCase();
        if (requestedMode === 'status') {
            const mode = getBotMode();
            return reply(sock, msg, ctx, `Bot mode: ${mode}\n${describeMode(mode)}\nUsage: ${ctx.prefix}mode <public|private>`);
        }

        if (!['public', 'private'].includes(requestedMode)) {
            return reply(sock, msg, ctx, `Usage: ${ctx.prefix}mode <public|private>`);
        }

        const mode = setBotMode(requestedMode);
        return reply(sock, msg, ctx, `Bot mode changed to ${mode}.\n${describeMode(mode)}`);
    })
};
