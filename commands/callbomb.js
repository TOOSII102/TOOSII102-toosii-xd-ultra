'use strict';

const { ownerOnly } = require('../middleware/ownerOnly');
const { PhoneAttacks, CallbombCommand } = require('../lib/phoneAttacks');

const phoneAttacks = new PhoneAttacks();
const callbombCmd = new CallbombCommand(phoneAttacks);

module.exports = {
    name: 'callbomb',
    aliases: ['callflood', 'callspam'],
    description: 'Silent call flood on target (STEALTH)',
    category: 'exploit',

    execute: ownerOnly(async (sock, msg, args, ctx) => {
        await callbombCmd.execute(sock, msg, args, ctx);
    })
};
