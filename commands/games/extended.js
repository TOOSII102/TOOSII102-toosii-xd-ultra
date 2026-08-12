'use strict';

const crypto = require('crypto');

const riddles = new Map();
const triviaGames = new Map();
const wordChains = new Map();
const RIDDLES = [
    { question: 'What has keys but cannot open locks?', answer: 'piano' },
    { question: 'What has hands but cannot clap?', answer: 'clock' },
    { question: 'What gets wetter as it dries?', answer: 'towel' }
];
const TRIVIA = [
    { question: 'What is the largest planet in our solar system?', answer: 'jupiter' },
    { question: 'Which ocean is the largest?', answer: 'pacific' },
    { question: 'What is H2O commonly called?', answer: 'water' }
];
const START_WORDS = ['planet', 'garden', 'puzzle', 'river', 'school'];

function pick(values) {
    return values[crypto.randomInt(values.length)];
}

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function key(ctx) {
    return ctx.from || 'unknown';
}

function normalizeAnswer(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
}

function command(name, aliases, description, execute) {
    return { name, aliases, description, category: 'games', execute };
}

module.exports = [
    command('riddle', [], 'Start a riddle for this chat.', async (sock, msg, args, ctx) => {
        const item = pick(RIDDLES);
        riddles.set(key(ctx), item);
        return reply(sock, msg, ctx, `Riddle\n${item.question}\nAnswer with ${ctx.prefix}riddleanswer <answer>`);
    }),
    command('riddleanswer', ['riddlecheck'], 'Answer the active riddle.', async (sock, msg, args, ctx) => {
        const item = riddles.get(key(ctx));
        if (!item) return reply(sock, msg, ctx, `No riddle is active. Start one with ${ctx.prefix}riddle`);
        const answer = normalizeAnswer(args.join(' '));
        if (!answer) return reply(sock, msg, ctx, `Usage: ${ctx.prefix}riddleanswer <answer>`);
        if (answer === item.answer) {
            riddles.delete(key(ctx));
            return reply(sock, msg, ctx, 'Correct. You solved the riddle.');
        }
        return reply(sock, msg, ctx, 'Not quite. Try again.');
    }),
    command('trivia', [], 'Start a trivia question for this chat.', async (sock, msg, args, ctx) => {
        const item = pick(TRIVIA);
        triviaGames.set(key(ctx), item);
        return reply(sock, msg, ctx, `Trivia\n${item.question}\nAnswer with ${ctx.prefix}triviaanswer <answer>`);
    }),
    command('triviaanswer', [], 'Answer the active trivia question.', async (sock, msg, args, ctx) => {
        const item = triviaGames.get(key(ctx));
        if (!item) return reply(sock, msg, ctx, `No trivia question is active. Start one with ${ctx.prefix}trivia`);
        const answer = normalizeAnswer(args.join(' '));
        if (!answer) return reply(sock, msg, ctx, `Usage: ${ctx.prefix}triviaanswer <answer>`);
        if (answer === item.answer) {
            triviaGames.delete(key(ctx));
            return reply(sock, msg, ctx, 'Correct. You answered the trivia question.');
        }
        return reply(sock, msg, ctx, 'That answer is not correct. Try again.');
    }),
    command('triviaend', [], 'End the active trivia question.', async (sock, msg, args, ctx) => {
        if (!triviaGames.delete(key(ctx))) return reply(sock, msg, ctx, 'No trivia question is active.');
        return reply(sock, msg, ctx, 'Trivia question ended.');
    }),
    command('wordchain', [], 'Start a word-chain game.', async (sock, msg, args, ctx) => {
        const word = pick(START_WORDS);
        wordChains.set(key(ctx), { lastWord: word, used: new Set([word]) });
        return reply(sock, msg, ctx, `Word chain started with "${word}". Reply using ${ctx.prefix}wcplay <word> beginning with "${word.at(-1)}".`);
    }),
    command('wcplay', ['wordplay'], 'Play a word in the active word chain.', async (sock, msg, args, ctx) => {
        const game = wordChains.get(key(ctx));
        if (!game) return reply(sock, msg, ctx, `No word chain is active. Start one with ${ctx.prefix}wordchain`);
        const word = normalizeAnswer(args.join(' ')).replace(/ /g, '');
        if (!/^[a-z]{2,30}$/.test(word)) return reply(sock, msg, ctx, `Usage: ${ctx.prefix}wcplay <single word>`);
        if (word[0] !== game.lastWord.at(-1)) return reply(sock, msg, ctx, `Your word must start with "${game.lastWord.at(-1)}".`);
        if (game.used.has(word)) return reply(sock, msg, ctx, 'That word has already been used.');
        game.used.add(word);
        game.lastWord = word;
        return reply(sock, msg, ctx, `Accepted: ${word}\nNext word must start with "${word.at(-1)}".`);
    }),
    command('wcend', [], 'End the active word-chain game.', async (sock, msg, args, ctx) => {
        if (!wordChains.delete(key(ctx))) return reply(sock, msg, ctx, 'No word chain is active.');
        return reply(sock, msg, ctx, 'Word chain ended.');
    })
];
