'use strict';

const { requestJson } = require('../../lib/keithApi');

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function command(name, aliases, description, execute) {
    return { name, aliases, description, category: 'fun', execute };
}

function failure(error) {
    return error?.message || 'The service is unavailable.';
}

function extractLine(result) {
    if (typeof result === 'string' && result.trim()) return result.trim();
    if (result && typeof result === 'object') {
        for (const key of ['text', 'question', 'result', 'value', 'quote']) {
            if (typeof result[key] === 'string' && result[key].trim()) return result[key].trim();
        }
    }
    return null;
}

// Several of these endpoints duplicate locally generated commands that already
// exist offline. These variants are explicitly API backed, so they carry
// distinct names and degrade with a clear message instead of a silent fallback.
async function simplePrompt(sock, msg, ctx, route, label) {
    try {
        const data = await requestJson(route);
        const line = extractLine(data?.result);
        if (!line) throw new Error('The service returned no prompt.');
        return reply(sock, msg, ctx, `${label}\n\n${line.slice(0, 900)}`);
    } catch (error) {
        return reply(sock, msg, ctx, `${label} failed: ${failure(error)}`);
    }
}

module.exports = [
    command('pickup', ['rizz', 'pickupline2'], 'Send a light-hearted pick-up line.', async (sock, msg, args, ctx) => simplePrompt(sock, msg, ctx, '/fun/pickuplines', 'Pick-up line')),

    command('wyr2', ['wouldyourather2'], 'Pose a would-you-rather dilemma.', async (sock, msg, args, ctx) => simplePrompt(sock, msg, ctx, '/fun/would-you-rather', 'Would you rather')),

    command('funjoke', ['apijoke'], 'Tell a setup-and-punchline joke.', async (sock, msg, args, ctx) => {
        try {
            const data = await requestJson('/fun/jokes');
            const result = data?.result;
            const setup = typeof result?.setup === 'string' ? result.setup.trim() : null;
            const punchline = typeof result?.punchline === 'string' ? result.punchline.trim() : null;
            if (setup && punchline) return reply(sock, msg, ctx, `${setup}\n\n${punchline}`);
            const line = extractLine(result);
            if (!line) throw new Error('The service returned no joke.');
            return reply(sock, msg, ctx, line.slice(0, 900));
        } catch (error) {
            return reply(sock, msg, ctx, `Joke failed: ${failure(error)}`);
        }
    })
];
