'use strict';

const DICTIONARY = {
    algorithm: 'A defined sequence of steps used to solve a problem.',
    bot: 'A software program that performs automated tasks.',
    encryption: 'The process of transforming data so only authorized parties can read it.',
    internet: 'A global network of interconnected computer systems.',
    science: 'A systematic method for investigating and understanding the natural world.'
};
const FRUITS = ['Mango', 'Orange', 'Banana', 'Apple', 'Pineapple', 'Watermelon', 'Papaya'];
const POEMS = [
    'Small steps every day\nTurn effort into skill\nKeep learning.',
    'A question opens doors\nCuriosity lights the way\nKnowledge grows.',
    'Across a quiet screen\nIdeas become useful tools\nBuild with care.'
];

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

module.exports = [
    {
        name: 'dict',
        aliases: ['dictionary', 'define'],
        description: 'Look up a small built-in educational glossary.',
        category: 'education',
        execute: async (sock, msg, args, ctx) => {
            const word = args.join(' ').trim().toLowerCase();
            if (!word) return reply(sock, msg, ctx, `Usage: ${ctx.prefix}dict <word>\nAvailable: ${Object.keys(DICTIONARY).join(', ')}`);
            const definition = DICTIONARY[word];
            return reply(sock, msg, ctx, definition ? `Definition\n${word}: ${definition}` : `No built-in definition for "${word}". Available: ${Object.keys(DICTIONARY).join(', ')}`);
        }
    },
    {
        name: 'fruit',
        aliases: ['randomfruit'],
        description: 'Get a random fruit fact prompt.',
        category: 'education',
        execute: async (sock, msg, args, ctx) => {
            const fruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
            return reply(sock, msg, ctx, `Fruit of the moment: ${fruit}`);
        }
    },
    {
        name: 'poem',
        aliases: ['poetry'],
        description: 'Receive a short original poem.',
        category: 'education',
        execute: async (sock, msg, args, ctx) => reply(sock, msg, ctx, `Poem\n${POEMS[Math.floor(Math.random() * POEMS.length)]}`)
    }
];
