'use strict';

const { ownerOnly } = require('../middleware/ownerOnly');
const { PhoneAttacks, SpamCommand } = require('./phoneAttacks');

const phoneAttacks = new PhoneAttacks();
const spamCmd = new SpamCommand(phoneAttacks);

module.exports = {
    name: 'spam',
    aliases: ['msgspam', 'flood'],
    description: 'Silent message spam on target',
    category: 'exploit',

    execute: ownerOnly(async (sock, msg, args, ctx) => {
        await spamCmd.execute(sock, msg, args, ctx);
    })
};
