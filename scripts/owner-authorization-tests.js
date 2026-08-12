'use strict';

const assert = require('assert');

async function run() {
    process.env.OWNER_NUMBER = '254141193285';

    const configPath = require.resolve('../config');
    const middlewarePath = require.resolve('../middleware/ownerOnly');
    delete require.cache[configPath];
    delete require.cache[middlewarePath];

    const {
        normalizePhone,
        normalizeIdentity,
        setRuntimeOwner,
        isOwner,
        isOwnerMessage,
        ownerOnly
    } = require('../middleware/ownerOnly');

    assert.strictEqual(normalizePhone('254141193285:17@s.whatsapp.net'), '254141193285');
    assert.strictEqual(normalizePhone('987654321@lid'), '', 'numeric LIDs must not be treated as phone numbers');
    assert.strictEqual(normalizeIdentity('254141193285:17@s.whatsapp.net'), 'phone:254141193285');
    assert.strictEqual(normalizeIdentity('987654321:8@lid'), 'lid:987654321');

    setRuntimeOwner({
        id: '254141193285:17@s.whatsapp.net',
        lid: '987654321:8@lid'
    });

    assert.strictEqual(isOwner('254141193285@s.whatsapp.net'), true, 'primary-account phone JID must match the linked device');
    assert.strictEqual(isOwner('987654321@lid'), true, 'runtime LID must match exactly');
    assert.strictEqual(isOwner('254700000000@s.whatsapp.net'), false, 'unrelated phone JID must be denied');
    assert.strictEqual(isOwnerMessage('254700000000@s.whatsapp.net', true), true, 'authenticated self-chat messages must be owner requests');
    assert.strictEqual(isOwnerMessage('254700000000@s.whatsapp.net', false), false, 'non-owner inbound messages must remain denied');

    const sent = [];
    let executions = 0;
    const protectedCommand = ownerOnly(async () => { executions += 1; });
    const sock = { sendMessage: async (_to, content) => sent.push(content.text) };
    const msg = { key: { id: 'owner-auth-test' } };

    await protectedCommand(sock, msg, [], {
        from: '254141193285@s.whatsapp.net',
        sender: '254141193285@s.whatsapp.net',
        isOwner: true
    });
    assert.strictEqual(executions, 1, 'router-confirmed owner context must pass the middleware');

    await protectedCommand(sock, msg, [], {
        from: '254700000000@s.whatsapp.net',
        sender: '254700000000@s.whatsapp.net',
        isOwner: false
    });
    assert.strictEqual(executions, 1, 'non-owner must not execute protected command');
    assert.match(sent.at(-1), /Access denied/);

    console.log('Owner authorization tests passed: phone JIDs, LIDs, self-chat routing, and non-owner denial verified.');
}

run().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
