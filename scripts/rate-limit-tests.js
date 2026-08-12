'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rateLimitFile = path.join(root, 'data', 'rate-limits.test.json');
const sender = '254799999999@s.whatsapp.net';
const otherSender = '254788888888@s.whatsapp.net';
const replies = [];

function socket() {
    return { sendMessage: async (to, content) => replies.push(content.text) };
}

async function invoke(command, args, ctx) {
    replies.length = 0;
    await command.execute(socket(), { key: { id: `test-${command.name}`, remoteJid: ctx.from } }, args, ctx);
    assert.ok(replies.length, 'expected a command response');
    return replies.at(-1);
}

async function run() {
    process.env.RATE_LIMIT_FILE = rateLimitFile;
    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.AI_RATE_LIMIT_MAX = '2';
    process.env.AI_RATE_LIMIT_WINDOW_SECONDS = '60';
    process.env.MEDIA_RATE_LIMIT_MAX = '2';
    process.env.MEDIA_RATE_LIMIT_WINDOW_SECONDS = '60';
    fs.rmSync(rateLimitFile, { force: true });

    try {
        const limiterPath = require.resolve('../lib/rateLimiter');
        delete require.cache[limiterPath];
        let { checkRateLimit, resetRateLimits } = require('../lib/rateLimiter');
        resetRateLimits(true);

        const now = 1000000;
        assert.strictEqual(checkRateLimit('ai', sender, now).allowed, true);
        assert.strictEqual(checkRateLimit('ai', sender, now + 1000).allowed, true);
        const blockedAi = checkRateLimit('ai', sender, now + 2000);
        assert.strictEqual(blockedAi.allowed, false);
        assert.ok(blockedAi.retryAfterSeconds > 0);
        assert.strictEqual(checkRateLimit('ai', otherSender, now + 2000).allowed, true, 'rate limits must be per sender');

        delete require.cache[limiterPath];
        ({ checkRateLimit, resetRateLimits } = require('../lib/rateLimiter'));
        assert.strictEqual(checkRateLimit('ai', sender, now + 3000).allowed, false, 'limits must survive a module reload');
        assert.strictEqual(checkRateLimit('ai', sender, now + 61000).allowed, true, 'limits must expire after the configured window');

        resetRateLimits(true);
        assert.strictEqual(checkRateLimit('download', sender, now).allowed, true);
        assert.strictEqual(checkRateLimit('download', sender, now + 1000).allowed, true);
        assert.strictEqual(checkRateLimit('download', sender, now + 2000).allowed, false);

        resetRateLimits(true);
        const originalFetch = global.fetch;
        let aiFetches = 0;
        let mediaFetches = 0;
        global.fetch = async (url) => {
            const source = String(url);
            if (source.includes('/ai/gpt')) {
                aiFetches += 1;
                return { ok: true, status: 200, json: async () => ({ result: 'AI test response' }) };
            }
            if (source.includes('/download/video')) {
                mediaFetches += 1;
                return { ok: true, status: 200, json: async () => ({ result: { download_url: 'https://cdn.example/video.mp4' } }) };
            }
            throw new Error(`Unexpected request: ${source}`);
        };

        try {
            const { loadCommands } = require('../lib/commandLoader');
            const commands = loadCommands();
            const ctx = { from: sender, sender, isGroup: false, prefix: '.', commands: commands.catalog };
            const ai = commands.get('ai');
            const ytv = commands.get('ytv');

            assert.match(await invoke(ai, ['hello'], ctx), /AI test response/);
            assert.match(await invoke(ai, ['again'], ctx), /AI test response/);
            assert.match(await invoke(ai, ['blocked'], ctx), /AI rate limit reached/);
            assert.strictEqual(aiFetches, 2, 'blocked AI requests must not reach the provider');

            resetRateLimits(true);
            assert.match(await invoke(ytv, ['https://www.youtube.com/watch?v=BaW_jenozKc'], ctx), /https:\/\/cdn.example\/video.mp4/);
            assert.match(await invoke(ytv, ['https://www.youtube.com/watch?v=BaW_jenozKc'], ctx), /https:\/\/cdn.example\/video.mp4/);
            assert.match(await invoke(ytv, ['https://www.youtube.com/watch?v=BaW_jenozKc'], ctx), /Media rate limit reached/);
            assert.strictEqual(mediaFetches, 2, 'blocked media requests must not reach a resolver');
        } finally {
            global.fetch = originalFetch;
        }

        console.log('Rate-limit tests passed: persistence, expiry, per-user isolation, AI protection, and media protection verified.');
    } finally {
        fs.rmSync(rateLimitFile, { force: true });
        delete process.env.RATE_LIMIT_FILE;
        delete process.env.RATE_LIMIT_ENABLED;
        delete process.env.AI_RATE_LIMIT_MAX;
        delete process.env.AI_RATE_LIMIT_WINDOW_SECONDS;
        delete process.env.MEDIA_RATE_LIMIT_MAX;
        delete process.env.MEDIA_RATE_LIMIT_WINDOW_SECONDS;
    }
}

run().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
