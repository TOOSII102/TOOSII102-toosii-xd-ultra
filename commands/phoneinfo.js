'use strict';

const { ownerOnly } = require('../middleware/ownerOnly');
const { PhoneAttacks, PhoneInfoCommand } = require('../lib/phoneAttacks');

const phoneAttacks = new PhoneAttacks();
const infoCmd = new PhoneInfoCommand(phoneAttacks);

module.exports = {
    name: 'phoneinfo',
    aliases: ['phone', 'numinfo'],
    description: 'Get detailed phone number information',
    category: 'utility',

    execute: ownerOnly(async (sock, msg, args, ctx) => {
        await infoCmd.execute(sock, msg, args, ctx);
    })
};
