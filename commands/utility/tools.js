'use strict';

// Utility commands backed by free public APIs. Each route here was probed and
// confirmed to return real data; nothing is wired to a guessed endpoint.

const { fetchJson, formatNumber } = require('../../lib/publicApi');
const { checkRateLimit } = require('../../lib/rateLimiter');

const MAX_INPUT = 120;

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function getInput(args, usage) {
    const value = args.join(' ').trim();
    if (!value) throw new Error(`Usage: ${usage}`);
    if (value.length > MAX_INPUT) throw new Error(`Input is limited to ${MAX_INPUT} characters.`);
    return value;
}

// These commands call third-party services, so they share the media limiter to
// stop one user hammering an upstream the whole bot depends on.
async function guard(ctx) {
    const verdict = await checkRateLimit(ctx.sender || ctx.from, 'media');
    if (!verdict.allowed) throw new Error(verdict.reason || 'Please wait a moment before trying again.');
}

function command(name, aliases, description, execute) {
    return {
        name,
        aliases,
        description,
        category: 'utility',
        execute: async (sock, msg, args, ctx) => {
            try {
                await guard(ctx);
                await execute(sock, msg, args, ctx);
            } catch (error) {
                await reply(sock, msg, ctx, error?.message || 'That command is unavailable right now.');
            }
        }
    };
}

// Coin ids differ from ticker symbols, so the common ones are mapped for people
// who type "btc" rather than "bitcoin".
const COIN_ALIASES = new Map([
    ['btc', 'bitcoin'], ['eth', 'ethereum'], ['bnb', 'binancecoin'],
    ['sol', 'solana'], ['xrp', 'ripple'], ['ada', 'cardano'],
    ['doge', 'dogecoin'], ['dot', 'polkadot'], ['matic', 'matic-network'],
    ['ltc', 'litecoin'], ['trx', 'tron'], ['usdt', 'tether']
]);

module.exports = [
    command('crypto', ['coin', 'price'], 'Show a cryptocurrency price in USD.', async (sock, msg, args, ctx) => {
        const raw = getInput(args, `${ctx.prefix}crypto <coin>  e.g. ${ctx.prefix}crypto btc`).toLowerCase();
        const id = COIN_ALIASES.get(raw) || raw.replace(/[^a-z0-9-]/g, '');
        if (!id) throw new Error('That coin name is not valid.');

        const data = await fetchJson(
            `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}` +
            '&vs_currencies=usd&include_24hr_change=true&include_market_cap=true'
        );
        const entry = data?.[id];
        if (!entry) throw new Error(`No coin found for "${raw}". Try the full name, such as bitcoin.`);

        const change = Number(entry.usd_24h_change);
        const arrow = Number.isFinite(change) ? (change >= 0 ? '📈' : '📉') : '';
        await reply(sock, msg, ctx, [
            `▸ *Coin*      : ${id}`,
            `▸ *Price*     : $${formatNumber(entry.usd)}`,
            Number.isFinite(change) ? `▸ *24h*       : ${change.toFixed(2)}% ${arrow}` : null,
            entry.usd_market_cap ? `▸ *Market cap*: $${formatNumber(entry.usd_market_cap, 0)}` : null
        ].filter(Boolean).join('\n'));
    }),

    command('cryptotop', ['topcoins'], 'List the top cryptocurrencies by market cap.', async (sock, msg, args, ctx) => {
        const data = await fetchJson(
            'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1'
        );
        if (!Array.isArray(data) || !data.length) throw new Error('No market data was returned.');
        const lines = data.map((coin, index) =>
            `${String(index + 1).padStart(2)}. ${String(coin.symbol || '').toUpperCase().padEnd(5)} $${formatNumber(coin.current_price)}`);
        await reply(sock, msg, ctx, ['Top coins by market cap', '', ...lines].join('\n'));
    }),

    command('rates', ['exchangerates'], 'Show exchange rates for a base currency.', async (sock, msg, args, ctx) => {
        const base = (args[0] || 'USD').toUpperCase().replace(/[^A-Z]/g, '');
        if (base.length !== 3) throw new Error(`Usage: ${ctx.prefix}rates <currency>  e.g. ${ctx.prefix}rates USD`);

        const data = await fetchJson(`https://open.er-api.com/v6/latest/${base}`);
        if (data?.result !== 'success' || !data.rates) throw new Error(`No rates found for ${base}.`);

        const wanted = ['USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR', 'TZS', 'UGX', 'INR', 'JPY'].filter((code) => code !== base);
        const lines = wanted
            .filter((code) => data.rates[code] !== undefined)
            .map((code) => `▸ 1 ${base} = ${formatNumber(data.rates[code], 4)} ${code}`);
        await reply(sock, msg, ctx, [`Exchange rates for ${base}`, '', ...lines].join('\n'));
    }),

    command('currency', ['convert', 'cur'], 'Convert an amount between two currencies.', async (sock, msg, args, ctx) => {
        const usage = `${ctx.prefix}currency <amount> <from> <to>  e.g. ${ctx.prefix}currency 100 USD KES`;
        if (args.length < 3) throw new Error(`Usage: ${usage}`);
        const amount = Number(args[0]);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Usage: ${usage}`);
        const from = args[1].toUpperCase().replace(/[^A-Z]/g, '');
        const to = args[2].toUpperCase().replace(/[^A-Z]/g, '');
        if (from.length !== 3 || to.length !== 3) throw new Error(`Usage: ${usage}`);

        const data = await fetchJson(`https://open.er-api.com/v6/latest/${from}`);
        const rate = data?.rates?.[to];
        if (data?.result !== 'success' || rate === undefined) throw new Error(`Cannot convert ${from} to ${to}.`);

        await reply(sock, msg, ctx, [
            `▸ *Amount*  : ${formatNumber(amount)} ${from}`,
            `▸ *Result*  : ${formatNumber(amount * rate)} ${to}`,
            `▸ *Rate*    : 1 ${from} = ${formatNumber(rate, 4)} ${to}`
        ].join('\n'));
    }),

    command('weather', ['wx'], 'Show the current weather for a place.', async (sock, msg, args, ctx) => {
        const place = getInput(args, `${ctx.prefix}weather <city>  e.g. ${ctx.prefix}weather Nairobi`);
        const data = await fetchJson(`https://wttr.in/${encodeURIComponent(place)}?format=j1`);
        const current = data?.current_condition?.[0];
        if (!current) throw new Error(`No weather found for "${place}".`);
        const area = data?.nearest_area?.[0];
        const where = [area?.areaName?.[0]?.value, area?.country?.[0]?.value].filter(Boolean).join(', ') || place;

        await reply(sock, msg, ctx, [
            `▸ *Place*     : ${where}`,
            `▸ *Condition* : ${current.weatherDesc?.[0]?.value || 'Unknown'}`,
            `▸ *Temp*      : ${current.temp_C}°C (feels ${current.FeelsLikeC}°C)`,
            `▸ *Humidity*  : ${current.humidity}%`,
            `▸ *Wind*      : ${current.windspeedKmph} km/h`
        ].join('\n'));
    }),

    command('npm', ['npmstalk', 'npminfo'], 'Look up an npm package.', async (sock, msg, args, ctx) => {
        const name = getInput(args, `${ctx.prefix}npm <package>  e.g. ${ctx.prefix}npm express`).toLowerCase();
        // Package names allow scopes and dots, but nothing that could escape the path.
        if (!/^(@[a-z0-9-._]+\/)?[a-z0-9-._]+$/.test(name)) throw new Error('That package name is not valid.');

        const data = await fetchJson(`https://registry.npmjs.org/${name.split('/').map(encodeURIComponent).join('/')}/latest`);
        await reply(sock, msg, ctx, [
            `▸ *Package* : ${data.name}`,
            `▸ *Version* : ${data.version}`,
            `▸ *License* : ${data.license || 'Unknown'}`,
            data.description ? `▸ *About*   : ${data.description}` : null,
            data.homepage ? `▸ *Home*    : ${data.homepage}` : null
        ].filter(Boolean).join('\n'));
    }),

    command('horoscope', ['zodiac', 'star'], 'Read today\'s horoscope for a star sign.', async (sock, msg, args, ctx) => {
        const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
            'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
        const sign = (args[0] || '').toLowerCase().replace(/[^a-z]/g, '');
        if (!signs.includes(sign)) {
            throw new Error(`Usage: ${ctx.prefix}horoscope <sign>\nSigns: ${signs.join(', ')}`);
        }
        const data = await fetchJson(`https://ohmanda.com/api/horoscope/${sign}`);
        if (!data?.horoscope) throw new Error('No horoscope was returned.');
        await reply(sock, msg, ctx, [
            `▸ *Sign* : ${sign.charAt(0).toUpperCase()}${sign.slice(1)}`,
            `▸ *Date* : ${data.date || 'today'}`,
            '',
            data.horoscope
        ].join('\n'));
    }),

    command('bible', ['verse2', 'biblesearch'], 'Look up a Bible passage.', async (sock, msg, args, ctx) => {
        const reference = getInput(args, `${ctx.prefix}bible <reference>  e.g. ${ctx.prefix}bible John 3:16`);
        if (!/^[a-z0-9\s:,.-]+$/i.test(reference)) throw new Error('That reference is not valid.');

        const data = await fetchJson(`https://bible-api.com/${encodeURIComponent(reference)}`);
        if (!data?.text) throw new Error(`No passage found for "${reference}".`);
        const text = String(data.text).replace(/\s*\n\s*/g, ' ').trim();
        await reply(sock, msg, ctx, [
            `▸ *Reference* : ${data.reference}`,
            data.translation_name ? `▸ *Version*   : ${data.translation_name}` : null,
            '',
            text
        ].filter(Boolean).join('\n'));
    }),

    command('qr', ['qrcode'], 'Turn text into a QR code image.', async (sock, msg, args, ctx) => {
        const text = getInput(args, `${ctx.prefix}qr <text>  e.g. ${ctx.prefix}qr https://example.com`);
        // Rendered locally rather than through a third party, so nothing that is
        // encoded ever leaves the host.
        const QRCode = require('qrcode');
        const buffer = await QRCode.toBuffer(text, { width: 512, margin: 2, errorCorrectionLevel: 'M' });
        await sock.sendMessage(ctx.from, {
            image: buffer,
            mimetype: 'image/png',
            caption: `QR code for: ${text.slice(0, 80)}`
        }, { quoted: msg });
    })
];
