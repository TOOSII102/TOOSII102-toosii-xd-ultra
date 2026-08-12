'use strict';

const { ownerOnly } = require('../../middleware/ownerOnly');

const DEFAULT_REPOSITORY = 'https://github.com/TOOSII102/TOOSII102-toosii-xd-ultra';

module.exports = {
    name: 'repo',
    aliases: ['repository'],
    description: 'Show the configured bot repository link.',
    category: 'owner',
    execute: ownerOnly(async (sock, msg, args, ctx) => {
        const repository = process.env.REPOSITORY_URL || DEFAULT_REPOSITORY;
        await sock.sendMessage(ctx.from, { text: `Repository: ${repository}` }, { quoted: msg });
    })
};
