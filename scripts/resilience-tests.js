'use strict';

// Proves the message handler survives hostile or malformed public traffic.
// A bot in public mode is driven by strangers, so a single bad message must
// never terminate the process or drop the WhatsApp connection.

const assert = require('assert');
const { loadCommands } = require('../lib/commandLoader');
const { getCommandAccess } = require('../lib/commandAccess');
const { getBotMode } = require('../lib/botMode');

const PREFIX = '.';
const commands = loadCommands();

let fatal = null;
process.on('unhandledRejection', (reason) => { fatal = `unhandledRejection: ${reason}`; });
process.on('uncaughtException', (error) => { fatal = `uncaughtException: ${error.message}`; });

async function safeSend(sock, jid, text, quoted) {
    try {
        await sock.sendMessage(jid, { text }, quoted ? { quoted } : undefined);
        return true;
    } catch {
        return false;
    }
}

// Mirrors the per-message logic in index.js, including its guards.
async function handleMessage(sock, msg, { isOwner = false } = {}) {
    try {
        const senderJid = msg.key?.remoteJid;
        if (!msg.message || senderJid === 'status@broadcast') return 'skipped';

        const participant = msg.key?.participant || senderJid;
        const previewBody =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            '(no text / not a text message)';

        const body = previewBody === '(no text / not a text message)'
            ? (msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '')
            : previewBody;

        if (!body.startsWith(PREFIX)) return 'skipped';

        const args = body.slice(PREFIX.length).trim().split(/\s+/);
        const cmdName = (args.shift() || '').toLowerCase();
        if (!cmdName) return 'skipped';

        const command = commands.get(cmdName);
        if (!command) return 'skipped';

        const ctx = {
            from: senderJid,
            sender: participant,
            isGroup: senderJid ? senderJid.endsWith('@g.us') : false,
            prefix: PREFIX,
            commands: commands.catalog,
            isOwner,
            botMode: getBotMode()
        };

        const access = getCommandAccess(ctx.botMode, isOwner, command.category);
        if (!access.allowed) {
            await safeSend(sock, ctx.from, access.reason, msg);
            return 'denied';
        }

        try {
            await command.execute(sock, msg, args, ctx);
            return 'executed';
        } catch {
            await safeSend(sock, ctx.from, 'That command failed. Please try again.', msg);
            return 'recovered';
        }
    } catch {
        return 'recovered';
    }
}

function makeSock({ sendThrows = false } = {}) {
    return {
        user: { id: '254141193285:4@s.whatsapp.net', name: 'bot' },
        sendMessage: async () => {
            if (sendThrows) throw new Error('connection closed while replying');
            return { key: { id: 'x' } };
        },
        groupMetadata: async () => { throw new Error('metadata unavailable'); }
    };
}

function textMessage(text, overrides = {}) {
    return {
        key: { remoteJid: '254700000009@s.whatsapp.net', fromMe: false, participant: '254700000009@s.whatsapp.net', ...(overrides.key || {}) },
        message: { conversation: text }
    };
}

async function run() {
    const sock = makeSock();

    // Malformed and hostile envelopes that a stranger can realistically produce.
    const hostile = [
        { name: 'bare prefix', msg: textMessage('.') },
        { name: 'prefix and spaces', msg: textMessage('.    ') },
        { name: 'unknown command', msg: textMessage('.definitelynotacommand') },
        { name: 'no message body', msg: { key: { remoteJid: 'x@s.whatsapp.net' }, message: null } },
        { name: 'status broadcast', msg: { key: { remoteJid: 'status@broadcast' }, message: { conversation: '.ping' } } },
        { name: 'missing key', msg: { message: { conversation: '.ping' } } },
        { name: 'empty conversation', msg: textMessage('') },
        { name: 'very long input', msg: textMessage(`.calc ${'9'.repeat(5000)}`) },
        { name: 'unicode flood', msg: textMessage(`.ascii ${'🙂'.repeat(500)}`) },
        { name: 'newline injection', msg: textMessage('.calc 1+1\n.calc 2+2') },
        { name: 'null bytes', msg: textMessage('.calc \u0000\u0000') },
        { name: 'prototype pollution attempt', msg: textMessage('.__proto__') },
        { name: 'constructor probe', msg: textMessage('.constructor') },
        { name: 'toString probe', msg: textMessage('.toString') },
        { name: 'path traversal', msg: textMessage('.../../etc/passwd') },
        { name: 'image caption command', msg: { key: { remoteJid: 'g@g.us', participant: 'p@s.whatsapp.net' }, message: { imageMessage: { caption: '.ping' } } } }
    ];

    for (const entry of hostile) {
        const outcome = await handleMessage(sock, entry.msg);
        assert.ok(['skipped', 'executed', 'denied', 'recovered'].includes(outcome), `${entry.name} returned ${outcome}`);
        assert.strictEqual(fatal, null, `${entry.name} produced a fatal error: ${fatal}`);
    }

    // A command that throws must be contained, not propagated.
    const exploding = { name: 'boom', category: 'utility', execute: async () => { throw new Error('command exploded'); } };
    commands.set('boom', exploding);
    assert.strictEqual(await handleMessage(sock, textMessage('.boom')), 'recovered');
    assert.strictEqual(fatal, null, 'a throwing command must not be fatal');

    // A command that rejects without a message must also be contained.
    commands.set('boom2', { name: 'boom2', category: 'utility', execute: () => Promise.reject(new Error('async reject')) });
    assert.strictEqual(await handleMessage(sock, textMessage('.boom2')), 'recovered');
    assert.strictEqual(fatal, null, 'a rejecting command must not be fatal');

    // If sending the reply itself fails, the handler must still not throw.
    const failingSock = makeSock({ sendThrows: true });
    assert.strictEqual(await handleMessage(failingSock, textMessage('.boom')), 'recovered');
    // A normal command whose reply cannot be delivered surfaces as recovered,
    // because commands call sendMessage directly and it rejects on a dead socket.
    assert.strictEqual(await handleMessage(failingSock, textMessage('.ping')), 'recovered');
    assert.strictEqual(fatal, null, 'a failed reply must not be fatal');

    // Group commands that depend on metadata must not crash when it is unavailable.
    const groupMsg = {
        key: { remoteJid: '120363000000000000@g.us', participant: '254700000009@s.whatsapp.net', fromMe: false },
        message: { conversation: '.groupinfo' }
    };
    const groupOutcome = await handleMessage(failingSock, groupMsg);
    assert.ok(['executed', 'recovered', 'denied'].includes(groupOutcome));
    assert.strictEqual(fatal, null, 'a group metadata failure must not be fatal');

    // Sustained traffic from many different strangers, as in a public group.
    const flood = [];
    for (let i = 0; i < 120; i += 1) {
        const sender = `2547000${String(i).padStart(5, '0')}@s.whatsapp.net`;
        flood.push(handleMessage(sock, {
            key: { remoteJid: '120363000000000000@g.us', participant: sender, fromMe: false },
            message: { conversation: i % 3 === 0 ? '.ping' : i % 3 === 1 ? '.' : '.unknowncmd' }
        }));
    }
    const results = await Promise.all(flood);
    assert.strictEqual(results.length, 120);
    assert.strictEqual(fatal, null, `sustained traffic produced a fatal error: ${fatal}`);

    // The process-level guards must exist so a stray rejection cannot kill the bot.
    const source = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.js'), 'utf-8');
    assert.match(source, /process\.on\('unhandledRejection'/, 'index.js must guard unhandled rejections');
    assert.match(source, /process\.on\('uncaughtException'/, 'index.js must guard uncaught exceptions');
    assert.match(source, /start\(\)\.catch\(/, 'reconnect must not leave an unhandled rejection');
    assert.doesNotMatch(source, /if \(shouldReconnect\) start\(\);/, 'reconnect must use backoff, not an immediate retry');

    console.log('Resilience tests passed: malformed envelopes, throwing commands, failed replies, and 120 concurrent public requests all handled without a fatal error.');
}

run().catch((error) => {
    console.error('Resilience tests failed:', error.message);
    process.exit(1);
});
