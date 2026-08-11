'use strict';

const RPS_CHOICES = ['rock', 'paper', 'scissors'];
const RPS_EMOJI = { rock: '🪨', paper: '📄', scissors: '✂️' };
const RPS_WINS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

function pick(values) {
    return values[Math.floor(Math.random() * values.length)];
}

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

module.exports = [
    {
        name: 'dice',
        aliases: ['roll', 'rolldice', 'throwdice'],
        description: 'Roll a six-sided die.',
        category: 'games',
        execute: async (sock, msg, args, ctx) => {
            const value = Math.floor(Math.random() * 6) + 1;
            return reply(sock, msg, ctx, `Dice\nYou rolled: ${value} 🎲`);
        }
    },
    {
        name: 'rps',
        aliases: ['rockpaperscissors', 'roshambo', 'janken'],
        description: 'Play rock, paper, scissors against the bot.',
        category: 'games',
        execute: async (sock, msg, args, ctx) => {
            const input = (args[0] || '').toLowerCase();
            const player = RPS_CHOICES.find((choice) => choice.startsWith(input));
            if (!player) return reply(sock, msg, ctx, `Usage: ${ctx.prefix}rps <rock|paper|scissors>`);
            const bot = pick(RPS_CHOICES);
            const result = player === bot ? 'Draw!' : RPS_WINS[player] === bot ? 'You win!' : 'You lose!';
            return reply(sock, msg, ctx, `Rock Paper Scissors\nYou: ${RPS_EMOJI[player]} ${player}\nBot: ${RPS_EMOJI[bot]} ${bot}\nResult: ${result}`);
        }
    }
];
