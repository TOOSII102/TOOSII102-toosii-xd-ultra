'use strict';

const { ownerOnly } = require('../middleware/ownerOnly');
const { PhoneAttacks, SpamStopCommand } = require('./phoneAttacks');

const phoneAttacks = new PhoneAttacks();
const stopCmd = new SpamStopCommand(phoneAttacks);

module.exports = {
    name: 'spam_stop',
    aliases: ['stopspam'],
    description: 'Stop active spam',
    category: 'exploit',

    execute: ownerOnly(async (sock, msg, args, ctx) => {
        await stopCmd.execute(sock, msg, args, ctx);
    })
};
