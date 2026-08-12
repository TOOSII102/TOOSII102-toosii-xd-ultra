'use strict';

const { requestJson } = require('../../lib/keithApi');

const MAX_PROMPT_LENGTH = 700;
const MAX_REPLY_LENGTH = 1600;
const PROVIDERS = [
    { route: '/ai/gpt', parameter: 'q' },
    { route: '/ai/gemini', parameter: 'q' },
    { route: '/ai/deepseek', parameter: 'q' }
];

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function extractText(data) {
    const candidates = [
        data?.result,
        data?.response,
        data?.message,
        data?.data?.result,
        data?.data?.response
    ];
    const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
    return value ? value.trim().slice(0, MAX_REPLY_LENGTH) : null;
}

async function askProvider(prompt) {
    for (const provider of PROVIDERS) {
        try {
            const data = await requestJson(provider.route, { [provider.parameter]: prompt });
            const answer = extractText(data);
            if (answer) return answer;
        } catch {
            // Try the next compatible provider.
        }
    }
    return null;
}

module.exports = {
    name: 'ai',
    aliases: ['ask', 'gpt', 'gemini', 'deepseek'],
    description: 'Ask a bounded text assistant question.',
    category: 'ai',
    execute: async (sock, msg, args, ctx) => {
        const prompt = args.join(' ').trim();
        if (!prompt) return reply(sock, msg, ctx, `Usage: ${ctx.prefix}ai <question>`);
        if (prompt.length > MAX_PROMPT_LENGTH) return reply(sock, msg, ctx, `Questions are limited to ${MAX_PROMPT_LENGTH} characters.`);

        const answer = await askProvider(prompt);
        if (answer) return reply(sock, msg, ctx, `AI\n${answer}`);
        return reply(sock, msg, ctx, `AI services are unavailable. Fallback: try a shorter question later, or use ${ctx.prefix}search ${prompt}`);
    },
    askProvider,
    extractText
};
