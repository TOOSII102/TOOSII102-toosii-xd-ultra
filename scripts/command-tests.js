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

async function execute(commands, name, sock, msg, args, ctx) {
    const command = commands.get(name);
    assert.ok(command, `expected command: ${name}`);
    resetMessages();
    await command.execute(sock, msg, args, ctx);
    return latestMessage();
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
        const expectedNames = [
            'ping', 'menu', 'owner', 'update', 'calc', 'ebinary', 'debinary', 'ebase', 'dbase', 'ehex', 'dhex',
            'uptime', '8ball', 'compliment', 'dice', 'rps', 'dict', 'fruit', 'poem', 'randverse', 'wiki'
        ];
        for (const name of expectedNames) assert.ok(commands.has(name), `missing command: ${name}`);
        assert.ok(commands.has('help') && commands.has('calculate') && commands.has('eightball') && commands.has('wikisearch'), 'expected aliases to load');

        const categories = new Set(commands.catalog.map((command) => command.category));
        for (const category of ['utility', 'fun', 'games', 'education', 'spiritual', 'search', 'owner']) {
            assert.ok(categories.has(category), `missing category: ${category}`);
        }

        const sock = createSocket();
        const incoming = { key: { id: 'test-message', remoteJid: '254700000000@s.whatsapp.net' } };
        const ownerCtx = { from: '254700000000@s.whatsapp.net', sender: ownerJid, prefix: '.', commands: commands.catalog };
        const visitorCtx = { from: '254799999999@s.whatsapp.net', sender: '254799999999@s.whatsapp.net', prefix: '.', commands: commands.catalog };

        assert.match(await execute(commands, 'ping', sock, incoming, [], visitorCtx), /Status.*Online/s);
        assert.match(await execute(commands, 'calc', sock, incoming, ['2', '+', '3', '*', '4'], visitorCtx), /Result: 14/);
        assert.match(await execute(commands, 'ebase', sock, incoming, ['hello'], visitorCtx), /aGVsbG8=/);
        assert.match(await execute(commands, 'dbase', sock, incoming, ['aGVsbG8='], visitorCtx), /Text:\nhello/);
        assert.match(await execute(commands, 'uptime', sock, incoming, [], visitorCtx), /Uptime/);
        assert.match(await execute(commands, '8ball', sock, incoming, ['Will', 'tests', 'pass?'], visitorCtx), /Magic 8-Ball/);
        assert.match(await execute(commands, 'compliment', sock, incoming, [], visitorCtx), /Compliment/);
        assert.match(await execute(commands, 'dice', sock, incoming, [], visitorCtx), /You rolled: [1-6]/);
        assert.match(await execute(commands, 'rps', sock, incoming, ['rock'], visitorCtx), /Rock Paper Scissors/);
        assert.match(await execute(commands, 'dict', sock, incoming, ['bot'], visitorCtx), /software program/);
        assert.match(await execute(commands, 'fruit', sock, incoming, [], visitorCtx), /Fruit of the moment/);
        assert.match(await execute(commands, 'poem', sock, incoming, [], visitorCtx), /Poem/);
        assert.match(await execute(commands, 'randverse', sock, incoming, [], visitorCtx), /Reflection/);

        const originalFetch = global.fetch;
        global.fetch = async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                title: 'Node.js',
                extract: 'Node.js is a JavaScript runtime.',
                content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Node.js' } }
            })
        });
        try {
            assert.match(await execute(commands, 'wiki', sock, incoming, ['Node.js'], visitorCtx), /Wikipedia: Node\.js/);
        } finally {
            global.fetch = originalFetch;
        }

        const visitorMenu = await execute(commands, 'menu', sock, incoming, [], visitorCtx);
        for (const category of ['Utility', 'Fun', 'Games', 'Education', 'Spiritual', 'Search']) assert.match(visitorMenu, new RegExp(`\\[${category}\\]`));
        assert.doesNotMatch(visitorMenu, /\[Owner\]/);

        const ownerMenu = await execute(commands, 'menu', sock, incoming, [], ownerCtx);
        assert.match(ownerMenu, /\[Owner\]/);

        const ownerReply = await execute(commands, 'owner', sock, incoming, [], ownerCtx);
        assert.match(ownerReply, /You  : 👑 OWNER/);

        const deniedReply = await execute(commands, 'update', sock, incoming, [], visitorCtx);
        assert.match(deniedReply, /Access Denied/);
        assert.doesNotMatch(deniedReply, /254712345678/);

        delete process.env.OWNER_NUMBER;
        delete require.cache[require.resolve('../config')];
        delete require.cache[require.resolve('../commands/owner')];
        const ownerWithoutConfig = require('../commands/owner');
        resetMessages();
        await ownerWithoutConfig.execute(sock, incoming, [], visitorCtx);
        assert.match(latestMessage(), /No owner set in \.env\./);

        console.log(`Command tests passed: ${commands.catalog.length} commands across ${categories.size} categories verified.`);
    } finally {
        fs.rmSync(sessionDir, { recursive: true, force: true });
    }
}

run().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
