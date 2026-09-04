'use strict';

const { requestJson } = require('../../lib/toosiiApi');
const { checkRateLimit } = require('../../lib/rateLimiter');

const MAX_QUESTION_LENGTH = 400;
const MAX_ANSWER_LENGTH = 1500;

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function getInput(args, usage) {
    const value = args.join(' ').trim();
    if (!value) throw new Error(`Usage: ${usage}`);
    if (value.length > MAX_QUESTION_LENGTH) throw new Error(`Input is limited to ${MAX_QUESTION_LENGTH} characters.`);
    return value;
}

function command(name, aliases, description, execute) {
    return { name, aliases, description, category: 'education', execute };
}

function failure(error) {
    return error?.message || 'The service is unavailable.';
}

// The tutor endpoints answer in markdown headings such as "### Question 1".
// WhatsApp has no heading syntax, so flatten them into plain labelled lines.
function tidyMarkdown(value) {
    return String(value)
        .replace(/^\s*#{1,6}\s*/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, MAX_ANSWER_LENGTH);
}

// The tutor endpoints are AI backed, so they share the AI rate-limit budget.
async function askTutor(sock, msg, ctx, args, route, label) {
    let question;
    try {
        question = getInput(args, `${ctx.prefix}${label.toLowerCase()} <question>`);
    } catch (error) {
        return reply(sock, msg, ctx, `${label} error: ${failure(error)}`);
    }

    const limit = checkRateLimit('ai', ctx.sender || ctx.from);
    if (!limit.allowed) return reply(sock, msg, ctx, `${label} rate limit reached. Try again in ${limit.retryAfterSeconds} seconds.`);

    try {
        const data = await requestJson(route, { q: question }, { timeoutMs: 25000 });
        const answer = typeof data?.result === 'string' ? tidyMarkdown(data.result) : null;
        if (!answer) throw new Error('The service returned no answer.');
        return reply(sock, msg, ctx, `${label}\n\n${answer}`);
    } catch (error) {
        return reply(sock, msg, ctx, `${label} failed: ${failure(error)}`);
    }
}

module.exports = [
    command('meaning', ['worddef', 'lookupword'], 'Look up an English dictionary definition.', async (sock, msg, args, ctx) => {
        let word;
        try {
            word = getInput(args, `${ctx.prefix}meaning <word>`);
            if (!/^[A-Za-z][A-Za-z' -]{0,40}$/.test(word)) throw new Error('Provide a single English word.');
        } catch (error) {
            return reply(sock, msg, ctx, `Dictionary error: ${failure(error)}`);
        }

        try {
            const data = await requestJson('/education/dictionary', { q: word }, { timeoutMs: 25000 });
            const result = data?.result;
            if (!result?.word) throw new Error('No entry was found for that word.');

            const phonetic = (result.phonetics || []).map((item) => item?.text).find((text) => typeof text === 'string' && text.trim());
            const lines = [`Word: ${result.word}`];
            if (phonetic) lines.push(`Pronunciation: ${phonetic}`);

            const meanings = Array.isArray(result.meanings) ? result.meanings.slice(0, 3) : [];
            if (!meanings.length) throw new Error('No definitions were returned.');
            for (const meaning of meanings) {
                const definition = meaning?.definitions?.[0]?.definition;
                if (!definition) continue;
                lines.push('', `${meaning.partOfSpeech || 'definition'}: ${definition}`);
                const example = meaning?.definitions?.[0]?.example;
                if (example) lines.push(`Example: ${example}`);
            }
            return reply(sock, msg, ctx, lines.join('\n').slice(0, MAX_ANSWER_LENGTH));
        } catch (error) {
            return reply(sock, msg, ctx, `Dictionary lookup failed: ${failure(error)}`);
        }
    }),

    command('physics', ['phy'], 'Ask a physics study question.', async (sock, msg, args, ctx) => askTutor(sock, msg, ctx, args, '/education/physics', 'Physics')),

    command('chemistry', ['chem'], 'Ask a chemistry study question.', async (sock, msg, args, ctx) => askTutor(sock, msg, ctx, args, '/education/chemistry', 'Chemistry')),

    command('solve', ['mathsolve', 'maths'], 'Solve or explain a maths problem.', async (sock, msg, args, ctx) => askTutor(sock, msg, ctx, args, '/education/maths', 'Maths'))
];
