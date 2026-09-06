'use strict';

// Image commands. Each source was probed and returns a direct image URL, which
// is downloaded and sent as a real photo rather than a link.

const { fetchJson } = require('../../lib/publicApi');
const { fetchMedia } = require('../../lib/mediaSender');
const { checkRateLimit } = require('../../lib/rateLimiter');

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

async function sendPhoto(sock, msg, ctx, url, caption) {
    // Send the bytes, not the link: a URL in chat is not what people want from
    // an image command, and some CDNs expire their links quickly.
    const media = await fetchMedia(url, 'file');
    if (!media.mimetype.startsWith('image/')) throw new Error('That source did not return an image.');
    await sock.sendMessage(ctx.from, { image: media.buffer, mimetype: media.mimetype, caption }, { quoted: msg });
}

function command(name, aliases, description, execute) {
    return {
        name,
        aliases,
        description,
        category: 'fun',
        execute: async (sock, msg, args, ctx) => {
            try {
                const verdict = await checkRateLimit(ctx.sender || ctx.from, 'media');
                if (!verdict.allowed) throw new Error(verdict.reason || 'Please wait a moment before trying again.');
                await execute(sock, msg, args, ctx);
            } catch (error) {
                await reply(sock, msg, ctx, error?.message || 'That command is unavailable right now.');
            }
        }
    };
}

module.exports = [
    command('cat', ['kitty'], 'Send a random cat photo.', async (sock, msg, args, ctx) => {
        const data = await fetchJson('https://api.thecatapi.com/v1/images/search');
        const url = Array.isArray(data) ? data[0]?.url : null;
        if (!url) throw new Error('No cat photo was returned.');
        await sendPhoto(sock, msg, ctx, url, 'Random cat 🐱');
    }),

    command('dog', ['puppy'], 'Send a random dog photo.', async (sock, msg, args, ctx) => {
        const data = await fetchJson('https://dog.ceo/api/breeds/image/random');
        if (data?.status !== 'success' || !data.message) throw new Error('No dog photo was returned.');
        await sendPhoto(sock, msg, ctx, data.message, 'Random dog 🐶');
    }),

    command('fox', [], 'Send a random fox photo.', async (sock, msg, args, ctx) => {
        const data = await fetchJson('https://randomfox.ca/floof/');
        if (!data?.image) throw new Error('No fox photo was returned.');
        await sendPhoto(sock, msg, ctx, data.image, 'Random fox 🦊');
    })
];
