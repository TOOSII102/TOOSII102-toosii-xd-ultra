'use strict';

const { requestJson } = require('../../lib/toosiiApi');

const MAX_INPUT_LENGTH = 300;

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function getInput(args, usage) {
    const value = args.join(' ').trim();
    if (!value) throw new Error(`Usage: ${usage}`);
    if (value.length > MAX_INPUT_LENGTH) throw new Error(`Input is limited to ${MAX_INPUT_LENGTH} characters.`);
    return value;
}

function command(name, aliases, description, execute) {
    return { name, aliases, description, category: 'utility', execute };
}

function failure(error) {
    return error?.message || 'The service is unavailable.';
}

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPublicIpv4(value) {
    const match = IPV4_PATTERN.exec(value);
    if (!match) return false;
    const octets = match.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) return false;
    const [a, b] = octets;
    // Refuse private, loopback, link-local and carrier-grade NAT ranges so the
    // command cannot be used to probe the host's own internal network.
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 169 && b === 254) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    return true;
}

const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;

module.exports = [
    command('ipinfo', ['iplookup'], 'Look up the public location of an IPv4 address.', async (sock, msg, args, ctx) => {
        let address;
        try {
            address = getInput(args, `${ctx.prefix}ipinfo <public IPv4 address>`);
            if (!isPublicIpv4(address)) throw new Error('Provide a valid public IPv4 address.');
        } catch (error) {
            return reply(sock, msg, ctx, `IP lookup error: ${failure(error)}`);
        }

        try {
            const data = await requestJson('/ip/lookup', { q: address });
            const result = data?.result;
            if (!result?.ip) throw new Error('The service returned no location data.');
            const place = [result.city, result.state, result.country].filter(Boolean).join(', ') || 'Not listed';
            const coordinates = result.latitude && result.longitude ? `${result.latitude}, ${result.longitude}` : 'Not listed';
            return reply(sock, msg, ctx, `IP: ${result.ip}\nLocation: ${place}\nCoordinates: ${coordinates}\n\nApproximate, based on public registry data.`);
        } catch (error) {
            return reply(sock, msg, ctx, `IP lookup failed: ${failure(error)}`);
        }
    }),

    command('exchange', ['rate', 'forex'], 'Show the USD exchange rate for a currency code.', async (sock, msg, args, ctx) => {
        let code;
        try {
            code = getInput(args, `${ctx.prefix}exchange <currency code, for example KES>`).toUpperCase();
            if (!CURRENCY_PATTERN.test(code)) throw new Error('Use a three-letter currency code such as KES, USD or EUR.');
        } catch (error) {
            return reply(sock, msg, ctx, `Exchange error: ${failure(error)}`);
        }

        try {
            const data = await requestJson('/finance/exchange', { q: code });
            const result = data?.result;
            if (typeof result?.rate !== 'number') throw new Error('The service returned no rate.');
            return reply(sock, msg, ctx, `Exchange rate\n${result.base || 'USD'} 1 = ${result.target || code} ${result.rate.toLocaleString()}\nDate: ${result.date || 'Not listed'}`);
        } catch (error) {
            return reply(sock, msg, ctx, `Exchange lookup failed: ${failure(error)}`);
        }
    }),

    command('ascii', ['asciiart'], 'Render a short word as ASCII art.', async (sock, msg, args, ctx) => {
        let word;
        try {
            word = getInput(args, `${ctx.prefix}ascii <word>`);
            if (word.length > 20) throw new Error('ASCII art is limited to 20 characters.');
            if (!/^[A-Za-z0-9 ]+$/.test(word)) throw new Error('Use letters, numbers and spaces only.');
        } catch (error) {
            return reply(sock, msg, ctx, `ASCII error: ${failure(error)}`);
        }

        try {
            const data = await requestJson('/tools/ascii', { q: word });
            const result = data?.result;
            const art = [
                Array.isArray(result?.arts) ? result.arts.find((item) => typeof item === 'string' && item.trim()) : null,
                result?.result,
                result?.art,
                result?.ascii,
                typeof result === 'string' ? result : null
            ].find((candidate) => typeof candidate === 'string' && candidate.trim());
            if (!art) throw new Error('The service returned no ASCII art.');
            return reply(sock, msg, ctx, `\`\`\`\n${art.slice(0, 1200)}\n\`\`\``);
        } catch (error) {
            return reply(sock, msg, ctx, `ASCII art failed: ${failure(error)}`);
        }
    }),

    command('grammar', ['grammarcheck', 'proofread'], 'Check a sentence for grammar and usage issues.', async (sock, msg, args, ctx) => {
        let text;
        try {
            text = getInput(args, `${ctx.prefix}grammar <sentence>`);
        } catch (error) {
            return reply(sock, msg, ctx, `Grammar error: ${failure(error)}`);
        }

        try {
            const data = await requestJson('/grammarcheck', { q: text });
            const recommendations = data?.result?.recommendations;
            if (!Array.isArray(recommendations) || !recommendations.length) {
                return reply(sock, msg, ctx, `Grammar check\nNo issues were reported for:\n${text}`);
            }
            const lines = recommendations.slice(0, 5).map((item, index) => {
                const advice = String(item?.adviceText || 'Suggested revision.').trim();
                return `${index + 1}. ${advice}`;
            });
            return reply(sock, msg, ctx, `Grammar check\nInput: ${text}\n\n${lines.join('\n')}`);
        } catch (error) {
            return reply(sock, msg, ctx, `Grammar check failed: ${failure(error)}`);
        }
    })
];
