'use strict';

const EIGHT_BALL_RESPONSES = [
    'It is certain.', 'Without a doubt.', 'Most likely.', 'Signs point to yes.',
    'Ask again later.', 'Reply hazy, try again.', 'Do not count on it.', 'Very doubtful.'
];
const COMPLIMENTS = [
    'You bring a thoughtful perspective.', 'Your effort is making a difference.',
    'You have excellent problem-solving energy.', 'You are more capable than you give yourself credit for.',
    'Your curiosity is a real strength.'
];

function pick(values) {
    return values[Math.floor(Math.random() * values.length)];
}

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

module.exports = [
    {
        name: '8ball',
        aliases: ['eightball', 'magic8', 'oracle', 'askball', 'ask8'],
        description: 'Ask the magic 8-ball a lighthearted question.',
        category: 'fun',
        execute: async (sock, msg, args, ctx) => {
            const question = args.join(' ').trim();
            if (!question) return reply(sock, msg, ctx, `Usage: ${ctx.prefix}8ball <question>`);
            return reply(sock, msg, ctx, `Magic 8-Ball\nQuestion: ${question}\nAnswer: ${pick(EIGHT_BALL_RESPONSES)}`);
        }
    },
    {
        name: 'compliment',
        aliases: ['praise', 'nice'],
        description: 'Receive a friendly compliment.',
        category: 'fun',
        execute: async (sock, msg, args, ctx) => reply(sock, msg, ctx, `Compliment\n${pick(COMPLIMENTS)}`)
    }
];
