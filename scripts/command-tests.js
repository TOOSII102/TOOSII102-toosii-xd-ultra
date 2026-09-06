'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.join(__dirname, '..');
// Never point at the real session/: this directory gets deleted on cleanup, and
// doing that to a live session logs the bot out of WhatsApp.
const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toosii-session-test-'));
process.env.SESSION_DIR = sessionDir;
const credsPath = path.join(sessionDir, 'creds.json');
const modeFile = path.join(root, 'data', 'bot-mode.test.json');
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
    process.env.BOT_MODE_FILE = modeFile;
    process.env.BOT_MODE = 'public';
    fs.rmSync(modeFile, { force: true });

    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(credsPath, JSON.stringify({ me: { id: ownerJid } }), { mode: 0o600 });

    try {
        const { loadCommands } = require('../lib/commandLoader');
        const { getBotMode } = require('../lib/botMode');
        const { getCommandAccess } = require('../lib/commandAccess');
        const commands = loadCommands();
        const expectedNames = [
            'ping', 'menu', 'owner', 'mode', 'calc', 'ebinary', 'debinary', 'ebase', 'dbase', 'ehex', 'dhex',
            'uptime', '8ball', 'compliment', 'dice', 'rps', 'dict', 'fruit', 'poem', 'randverse', 'wiki'
        ];
        for (const name of expectedNames) assert.ok(commands.has(name), `missing command: ${name}`);
        assert.ok(commands.has('help') && commands.has('calculate') && commands.has('eightball') && commands.has('wikisearch') && commands.has('botmode'), 'expected aliases to load');
        // An earlier .update was removed in 131ef0a. It was reinstated on request,
        // this time as an owner-only command that refuses to run on a dirty tree
        // or when a fast-forward is not possible.
        assert.ok(commands.has('update') && commands.has('pull'), 'update command and aliases should load');
        assert.strictEqual(commands.get('update').category, 'owner', '.update must stay owner-only');
        assert.ok(commands.has('restart') && commands.get('restart').category === 'owner', '.restart must be owner-only');

        const categories = new Set(commands.catalog.map((command) => command.category));
        for (const category of ['utility', 'fun', 'games', 'education', 'spiritual', 'search', 'owner']) {
            assert.ok(categories.has(category), `missing category: ${category}`);
        }

        const sock = createSocket();
        const incoming = { key: { id: 'test-message', remoteJid: '254700000000@s.whatsapp.net' } };
        const ownerCtx = { from: '254700000000@s.whatsapp.net', sender: ownerJid, prefix: '.', commands: commands.catalog, isOwner: true, botMode: 'public' };
        const visitorCtx = { from: '254799999999@s.whatsapp.net', sender: '254799999999@s.whatsapp.net', prefix: '.', commands: commands.catalog, isOwner: false, botMode: 'public' };

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
        assert.match(visitorMenu, /║ ▸ \.calc\n/, 'menu should list the primary command name');
        assert.doesNotMatch(visitorMenu, /Safely calculate|\.calculate|—/, 'menu should not include descriptions or aliases');

        const ownerMenu = await execute(commands, 'menu', sock, incoming, [], ownerCtx);
        assert.match(ownerMenu, /\[Owner\]/);
        assert.match(await execute(commands, 'owner', sock, incoming, [], ownerCtx), /You  : OWNER/);

        assert.match(await execute(commands, 'mode', sock, incoming, [], ownerCtx), /Bot mode: public/);
        assert.match(await execute(commands, 'mode', sock, incoming, ['private'], ownerCtx), /changed to private/);
        assert.strictEqual(getBotMode(), 'private', 'private mode should persist to storage');
        assert.strictEqual(getCommandAccess('private', false, 'utility').allowed, false, 'private mode should block visitors from public commands');
        assert.strictEqual(getCommandAccess('private', true, 'utility').allowed, true, 'private mode should allow the owner');
        assert.strictEqual(getCommandAccess('public', false, 'utility').allowed, true, 'public mode should allow public commands');
        assert.strictEqual(getCommandAccess('public', false, 'owner').allowed, false, 'public mode should block owner-category commands');

        assert.match(await execute(commands, 'mode', sock, incoming, [], visitorCtx), /Access denied/);
        assert.match(await execute(commands, 'mode', sock, incoming, ['public'], ownerCtx), /changed to public/);
        assert.strictEqual(getBotMode(), 'public', 'public mode should persist to storage');


        console.log(`Command tests passed: ${commands.catalog.length} commands across ${categories.size} categories, including public/private mode policy.`);
    } finally {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        fs.rmSync(modeFile, { force: true });
        delete process.env.BOT_MODE_FILE;
    }
}

run().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
