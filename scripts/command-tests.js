'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sessionDir = path.join(root, 'session');
const credsPath = path.join(sessionDir, 'creds.json');
const ownerNumber = '254712345678';
const ownerJid = `${ownerNumber}:0@s.whatsapp.net`;
const sent = [];

function createSocket() {
    return {
        sendMessage: async (to, content, options) => {
            sent.push({ to, content, options });
        }
    };
}

function latestMessage() {
    assert.ok(sent.length > 0, 'expected the command to send a reply');
    return sent.at(-1).content.text;
}

function resetMessages() {
    sent.length = 0;
}

async function run() {
    process.env.BOT_NAME = 'Command Test Bot';
    process.env.OWNER_NUMBER = ownerNumber;
    process.env.PREFIX = '.';

    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(credsPath, JSON.stringify({ me: { id: ownerJid } }), { mode: 0o600 });

    try {
        const { loadCommands } = require('../lib/commandLoader');
        const commands = loadCommands();
        const expectedAliases = ['ping', 'p', 'speed', 'latency', 'menu', 'help', 'commands', 'cmds', 'owner', 'whoowner', 'botowner', 'ownerinfo', 'update', 'upgrade', 'pull'];
        for (const name of expectedAliases) {
            assert.ok(commands.has(name), `missing command or alias: ${name}`);
        }

        const sock = createSocket();
        const incoming = { key: { id: 'test-message' } };
        const ownerCtx = { from: '254700000000@s.whatsapp.net', sender: ownerJid };
        const visitorCtx = { from: '254799999999@s.whatsapp.net', sender: '254799999999@s.whatsapp.net' };

        resetMessages();
        await commands.get('ping').execute(sock, incoming, [], visitorCtx);
        assert.match(latestMessage(), /Status.*Online/s, 'ping should report online status');
        assert.match(latestMessage(), /Command Test Bot/, 'ping should include the configured bot name');

        resetMessages();
        await commands.get('menu').execute(sock, incoming, [], visitorCtx);
        assert.match(latestMessage(), /PUBLIC COMMANDS/, 'visitor menu should show public commands');
        assert.doesNotMatch(latestMessage(), /STEALTH STATUS/, 'visitor menu must not expose owner-only details');

        resetMessages();
        await commands.get('menu').execute(sock, incoming, [], ownerCtx);
        assert.match(latestMessage(), /OWNER/, 'owner menu should identify the owner');
        assert.match(latestMessage(), /AVAILABLE COMMANDS/, 'owner menu should list available commands');

        resetMessages();
        await commands.get('owner').execute(sock, incoming, [], visitorCtx);
        assert.match(latestMessage(), /Owner: 254712345678/, 'owner command should display the configured owner number');
        assert.match(latestMessage(), /User/, 'owner command should classify non-owner callers');

        resetMessages();
        await commands.get('owner').execute(sock, incoming, [], ownerCtx);
        assert.match(latestMessage(), /You  : 👑 OWNER/, 'owner command should recognize the linked-device owner JID');

        resetMessages();
        await commands.get('update').execute(sock, incoming, [], visitorCtx);
        assert.match(latestMessage(), /Access Denied/, 'update command must reject non-owners');
        assert.doesNotMatch(latestMessage(), /254712345678/, 'access denial must not reveal the owner number');

        delete process.env.OWNER_NUMBER;
        delete require.cache[require.resolve('../config')];
        delete require.cache[require.resolve('../commands/owner')];
        const ownerWithoutConfig = require('../commands/owner');

        resetMessages();
        await ownerWithoutConfig.execute(sock, incoming, [], visitorCtx);
        assert.match(latestMessage(), /No owner set in \.env\./, 'owner command should warn when OWNER_NUMBER is not configured');

        console.log(`Command tests passed: ${expectedAliases.length} command names and aliases verified.`);
    } finally {
        fs.rmSync(sessionDir, { recursive: true, force: true });
    }
}

run().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
