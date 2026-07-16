'use strict';

const { ownerOnly } = require('../middleware/ownerOnly');
const { PhoneAttacks, CallbombStopCommand } = require('../lib/phoneAttacks');

const phoneAttacks = new PhoneAttacks();
const stopCmd = new CallbombStopCommand(phoneAttacks);

module.exports = {
    name: 'callbomb_stop',
    aliases: ['stopcallbomb'],
    description: 'Stop active callbomb',
    category: 'exploit',

    execute: ownerOnly(async (sock, msg, args, ctx) => {
        await stopCmd.execute(sock, msg, args, ctx);
    })
};
