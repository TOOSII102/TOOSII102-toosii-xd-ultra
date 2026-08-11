'use strict';

const REFLECTIONS = [
    'Let your words be kind and your actions be useful.',
    'Patience gives difficult work room to become possible.',
    'Choose honesty, even when it requires more effort.',
    'Gratitude turns ordinary moments into meaningful ones.',
    'Peace grows when we listen before we react.'
];

module.exports = {
    name: 'randverse',
    aliases: ['reflection', 'dailyreflection'],
    description: 'Receive a short spiritual reflection.',
    category: 'spiritual',
    execute: async (sock, msg, args, ctx) => {
        const reflection = REFLECTIONS[Math.floor(Math.random() * REFLECTIONS.length)];
        await sock.sendMessage(ctx.from, { text: `Reflection\n${reflection}` }, { quoted: msg });
    }
};
