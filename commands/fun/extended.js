'use strict';

const crypto = require('crypto');

const TRUTHS = [
    'What is a skill you would like to improve this year?',
    'What is the kindest thing someone has done for you?',
    'What is one habit you would like to build?'
];
const DARES = [
    'Share one genuine compliment with someone in this chat.',
    'Describe your ideal weekend in three words.',
    'Recommend a song or book you enjoyed recently.'
];
const WOULD_YOU_RATHER = [
    'Would you rather explore the ocean or outer space?',
    'Would you rather have more time or more energy?',
    'Would you rather learn a language or a musical instrument?'
];
const NEVER_HAVE_I_EVER = [
    'Never have I ever learned something difficult without giving up.',
    'Never have I ever tried a food I thought I would dislike.',
    'Never have I ever helped someone solve a problem.'
];
const PICKUP_LINES = [
    'Are you a good idea? Because this conversation just improved.',
    'You must be a library book, because you have all the information I need.',
    'Is your name Wi-Fi? Because I feel a strong connection.'
];
const ROASTS = [
    'Your loading bar has more ambition than your to-do list.',
    'You are not late; you are operating on an alternate time zone.',
    'Your keyboard has seen more action than your plan for the day.'
];
const MEMES = [
    'Meme: Me: I will sleep early. Also me at 2 a.m.: one more tutorial.',
    'Meme: The bug disappeared after I added a console.log. Science is mysterious.',
    'Meme: When the code works on the first try: suspicious silence.'
];
const ZEN_QUOTES = [
    'Slow progress is still progress.',
    'A clear mind begins with a single focused task.',
    'Be patient with work that is worth doing well.'
];
const QUIZZES = [
    { question: 'What is 9 × 7?', answer: '63' },
    { question: 'Which planet is known as the Red Planet?', answer: 'Mars' },
    { question: 'How many bits are in one byte?', answer: '8' }
];

function pick(values) {
    return values[crypto.randomInt(values.length)];
}

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function command(name, aliases, description, execute) {
    return { name, aliases, description, category: 'fun', execute };
}

module.exports = [
    command('truth', ['todtruth'], 'Show a friendly truth question.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, `Truth:\n${pick(TRUTHS)}`)),
    command('dare', ['todare'], 'Show a friendly dare.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, `Dare:\n${pick(DARES)}`)),
    command('wyr', ['wouldyourather'], 'Show a would-you-rather question.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, pick(WOULD_YOU_RATHER))),
    command('paranoia', ['whois'], 'Show a light conversation prompt.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, 'Paranoia prompt: Who in this chat would be best at organizing a surprise party?')),
    command('nhie', ['neverhaveiever'], 'Show a family-friendly never-have-I-ever prompt.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, pick(NEVER_HAVE_I_EVER))),
    command('pickupline', ['pline'], 'Show a lighthearted pickup line.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, pick(PICKUP_LINES))),
    command('zenquote', ['zen'], 'Show a short calming quote.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, pick(ZEN_QUOTES))),
    command('roast', ['lightroast'], 'Show a playful, non-targeted roast.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, pick(ROASTS))),
    command('meme', ['textmeme'], 'Show a text-based programming meme.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, pick(MEMES))),
    command('quiz', ['quickquiz'], 'Show a short quiz question and answer.', async (sock, msg, args, ctx) => {
        const quiz = pick(QUIZZES);
        return reply(sock, msg, ctx, `Quiz\n${quiz.question}\nAnswer: ${quiz.answer}`);
    }),
    command('ship', ['compatibility'], 'Generate a playful compatibility score for two names.', async (sock, msg, args, ctx) => {
        const names = args.join(' ').split(/[,&]+/).map((name) => name.trim()).filter(Boolean);
        if (names.length < 2) return reply(sock, msg, ctx, `Usage: ${ctx.prefix}ship <name 1>, <name 2>`);
        const source = names.slice(0, 2).join('|').toLowerCase();
        const score = [...source].reduce((total, character) => (total * 31 + character.charCodeAt(0)) % 101, 0);
        return reply(sock, msg, ctx, `Compatibility: ${names[0]} + ${names[1]} = ${score}%`);
    }),
    command('tod', ['truthordare'], 'Pick either a truth or a dare.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, Math.random() < 0.5 ? `Truth:\n${pick(TRUTHS)}` : `Dare:\n${pick(DARES)}`))
];
