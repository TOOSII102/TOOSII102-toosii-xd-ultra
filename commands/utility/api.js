'use strict';

const { requestJson } = require('../../lib/toosiiApi');

const MAX_TEXT_LENGTH = 600;

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function getText(args, usage) {
    const text = args.join(' ').trim();
    if (!text) throw new Error(`Usage: ${usage}`);
    if (text.length > MAX_TEXT_LENGTH) throw new Error(`Input is limited to ${MAX_TEXT_LENGTH} characters.`);
    return text;
}

function command(name, aliases, description, execute) {
    return { name, aliases, description, category: 'utility', execute };
}

module.exports = [
    command('shorten', ['tinyurl'], 'Shorten an HTTPS or HTTP URL.', async (sock, msg, args, ctx) => {
        let original;
        try {
            original = getText(args, `${ctx.prefix}shorten <url>`);
            const url = new URL(original);
            if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS URL.');
        } catch (error) {
            return reply(sock, msg, ctx, `URL error: ${error.message}`);
        }

        try {
            const data = await requestJson('/shortener/tinyurl', { url: original });
            const shortened = data?.result?.shortened;
            if (!shortened || typeof shortened !== 'string') throw new Error('The API returned no shortened URL.');
            return reply(sock, msg, ctx, `Short URL:\n${shortened}`);
        } catch (error) {
            return reply(sock, msg, ctx, `Shortening is unavailable. Fallback: use the original URL.\n${original}`);
        }
    }),
    command('fancy', ['fancytext'], 'Convert text using a remote display style.', async (sock, msg, args, ctx) => {
        const candidateStyle = Number.parseInt(args[0], 10);
        const style = Number.isInteger(candidateStyle) ? candidateStyle : 3;
        const textArgs = Number.isInteger(candidateStyle) ? args.slice(1) : args;
        let text;
        try {
            if (style < 1 || style > 100) throw new Error('Style must be between 1 and 100.');
            text = getText(textArgs, `${ctx.prefix}fancy [style] <text>`);
        } catch (error) {
            return reply(sock, msg, ctx, `Fancy text error: ${error.message}`);
        }

        try {
            const data = await requestJson('/fancytext', { q: text, style });
            const result = data?.result;
            if (!result || typeof result !== 'string') throw new Error('The API returned no styled text.');
            return reply(sock, msg, ctx, result.slice(0, MAX_TEXT_LENGTH));
        } catch {
            return reply(sock, msg, ctx, `Fancy-text service is unavailable. Fallback (plain text):\n${text}`);
        }
    }),
    command('translate', ['tr'], 'Translate text into a language code.', async (sock, msg, args, ctx) => {
        const language = String(args[0] || '').toLowerCase();
        let text;
        try {
            if (!/^[a-z]{2,5}(?:-[a-z]{2,5})?$/.test(language)) throw new Error('Use a language code such as en, fr, sw, or es.');
            text = getText(args.slice(1), `${ctx.prefix}translate <language code> <text>`);
        } catch (error) {
            return reply(sock, msg, ctx, `Translation error: ${error.message}`);
        }

        try {
            const data = await requestJson('/translate', { text, to: language });
            const translated = data?.result?.translatedText;
            if (!translated || typeof translated !== 'string') throw new Error('The API returned no translated text.');
            return reply(sock, msg, ctx, `Translation (${language}):\n${translated.slice(0, MAX_TEXT_LENGTH)}`);
        } catch {
            return reply(sock, msg, ctx, `Translation is unavailable. Fallback (original text):\n${text}`);
        }
    })
];
