'use strict';

const MAX_INPUT_LENGTH = 1200;

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function input(args) {
    const value = args.join(' ').trim();
    if (!value) throw new Error('Provide text after the command.');
    if (value.length > MAX_INPUT_LENGTH) throw new Error(`Input is limited to ${MAX_INPUT_LENGTH} characters.`);
    return value;
}

function decodeBinary(value) {
    const groups = value.trim().split(/\s+/);
    if (!groups.length || groups.some((group) => !/^[01]{8}$/.test(group))) {
        throw new Error('Use space-separated 8-bit binary groups.');
    }
    return Buffer.from(groups.map((group) => Number.parseInt(group, 2))).toString('utf8');
}

module.exports = [
    {
        name: 'ebinary',
        aliases: ['binaryencode'],
        description: 'Encode text as 8-bit binary.',
        category: 'utility',
        execute: async (sock, msg, args, ctx) => {
            try {
                const value = input(args);
                const encoded = [...Buffer.from(value, 'utf8')].map((byte) => byte.toString(2).padStart(8, '0')).join(' ');
                return reply(sock, msg, ctx, `Binary:\n${encoded}`);
            } catch (error) { return reply(sock, msg, ctx, `Encoding error: ${error.message}`); }
        }
    },
    {
        name: 'debinary',
        aliases: ['binarydecode'],
        description: 'Decode 8-bit binary text.',
        category: 'utility',
        execute: async (sock, msg, args, ctx) => {
            try { return reply(sock, msg, ctx, `Text:\n${decodeBinary(input(args))}`); }
            catch (error) { return reply(sock, msg, ctx, `Decoding error: ${error.message}`); }
        }
    },
    {
        name: 'ebase',
        aliases: ['base64encode'],
        description: 'Encode text as Base64.',
        category: 'utility',
        execute: async (sock, msg, args, ctx) => {
            try { return reply(sock, msg, ctx, `Base64:\n${Buffer.from(input(args), 'utf8').toString('base64')}`); }
            catch (error) { return reply(sock, msg, ctx, `Encoding error: ${error.message}`); }
        }
    },
    {
        name: 'dbase',
        aliases: ['base64decode'],
        description: 'Decode Base64 text.',
        category: 'utility',
        execute: async (sock, msg, args, ctx) => {
            try {
                const value = input(args);
                if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) throw new Error('Provide valid Base64 text.');
                return reply(sock, msg, ctx, `Text:\n${Buffer.from(value, 'base64').toString('utf8')}`);
            } catch (error) { return reply(sock, msg, ctx, `Decoding error: ${error.message}`); }
        }
    },
    {
        name: 'ehex',
        aliases: ['hexencode'],
        description: 'Encode text as hexadecimal.',
        category: 'utility',
        execute: async (sock, msg, args, ctx) => {
            try { return reply(sock, msg, ctx, `Hex:\n${Buffer.from(input(args), 'utf8').toString('hex')}`); }
            catch (error) { return reply(sock, msg, ctx, `Encoding error: ${error.message}`); }
        }
    },
    {
        name: 'dhex',
        aliases: ['hexdecode'],
        description: 'Decode hexadecimal text.',
        category: 'utility',
        execute: async (sock, msg, args, ctx) => {
            try {
                const value = input(args);
                if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) throw new Error('Provide an even-length hexadecimal string.');
                return reply(sock, msg, ctx, `Text:\n${Buffer.from(value, 'hex').toString('utf8')}`);
            } catch (error) { return reply(sock, msg, ctx, `Decoding error: ${error.message}`); }
        }
    }
];
