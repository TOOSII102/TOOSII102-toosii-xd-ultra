'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const NOTES_FILE = path.join(__dirname, '..', '..', 'data', 'notes.json');
const MAX_TEXT_LENGTH = 1000;
const JOKES = [
    'Why do programmers prefer dark mode? Because light attracts bugs.',
    'A clean function is like a clear instruction: it saves everyone time.',
    'There are 10 kinds of people: those who understand binary and those who do not.'
];
const FACTS = [
    'A byte contains eight bits.',
    'The first web page is still available online.',
    'The word algorithm comes from the name of mathematician al-Khwarizmi.'
];
const QUOTES = [
    'The secret of getting ahead is getting started. — Mark Twain',
    'Well begun is half done. — Aristotle',
    'Learning never exhausts the mind. — Leonardo da Vinci'
];

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function pick(values) {
    return values[crypto.randomInt(values.length)];
}

function requireText(args, usage) {
    const text = args.join(' ').trim();
    if (!text) throw new Error(`Usage: ${usage}`);
    if (text.length > MAX_TEXT_LENGTH) throw new Error(`Input is limited to ${MAX_TEXT_LENGTH} characters.`);
    return text;
}

function normalizeNoteName(value) {
    const name = String(value || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,32}$/.test(name)) throw new Error('Note names may contain 1–32 letters, numbers, underscores, or hyphens.');
    return name;
}

function noteOwner(ctx) {
    return String(ctx.sender || ctx.from || 'unknown').split('@')[0].split(':')[0].replace(/[^0-9a-z_-]/gi, '') || 'unknown';
}

function readNotes() {
    try {
        const parsed = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('[Notes] Failed to read notes:', error.message);
        return {};
    }
}

function writeNotes(notes) {
    fs.mkdirSync(path.dirname(NOTES_FILE), { recursive: true });
    const tempFile = `${NOTES_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(notes, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tempFile, NOTES_FILE);
}

function getPersonalNotes(ctx, create = false) {
    const notes = readNotes();
    const owner = noteOwner(ctx);
    if (create && !notes[owner]) notes[owner] = {};
    return { notes, owner, personal: notes[owner] || {} };
}

function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use a date in YYYY-MM-DD format.');
    const [year, month, day] = value.split('-').map(Number);
    const result = new Date(Date.UTC(year, month - 1, day));
    if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) throw new Error('Provide a valid calendar date.');
    return result;
}

function calculateAge(date) {
    const now = new Date();
    let years = now.getUTCFullYear() - date.getUTCFullYear();
    const birthdayPassed = now.getUTCMonth() > date.getUTCMonth() || (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() >= date.getUTCDate());
    if (!birthdayPassed) years -= 1;
    if (years < 0) throw new Error('Birth date cannot be in the future.');
    return years;
}

function command(name, aliases, description, execute) {
    return { name, aliases, description, category: 'utility', execute };
}

module.exports = [
    command('alive', ['status', 'botstatus'], 'Show whether the bot process is responding.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, `Status: online\nUptime: ${Math.floor(process.uptime())} seconds`)),
    command('charcount', ['countchars'], 'Count characters and words in text.', async (sock, msg, args, ctx) => {
        try {
            const text = requireText(args, `${ctx.prefix}charcount <text>`);
            return reply(sock, msg, ctx, `Characters: ${[...text].length}\nWords: ${text.trim() ? text.trim().split(/\s+/).length : 0}`);
        } catch (error) { return reply(sock, msg, ctx, `Character count error: ${error.message}`); }
    }),
    command('uppercase', ['upper'], 'Convert text to uppercase.', async (sock, msg, args, ctx) => {
        try { return reply(sock, msg, ctx, requireText(args, `${ctx.prefix}uppercase <text>`).toUpperCase()); }
        catch (error) { return reply(sock, msg, ctx, `Text error: ${error.message}`); }
    }),
    command('lowercase', ['lower'], 'Convert text to lowercase.', async (sock, msg, args, ctx) => {
        try { return reply(sock, msg, ctx, requireText(args, `${ctx.prefix}lowercase <text>`).toLowerCase()); }
        catch (error) { return reply(sock, msg, ctx, `Text error: ${error.message}`); }
    }),
    command('reverse', ['rev'], 'Reverse text.', async (sock, msg, args, ctx) => {
        try { return reply(sock, msg, ctx, [...requireText(args, `${ctx.prefix}reverse <text>`)].reverse().join('')); }
        catch (error) { return reply(sock, msg, ctx, `Text error: ${error.message}`); }
    }),
    command('password', ['passgen'], 'Generate a random password.', async (sock, msg, args, ctx) => {
        const requestedLength = Number.parseInt(args[0] || '16', 10);
        const length = Number.isInteger(requestedLength) && requestedLength >= 8 && requestedLength <= 64 ? requestedLength : 16;
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
        const password = Array.from({ length }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
        return reply(sock, msg, ctx, `Generated password (${length} characters):\n${password}`);
    }),
    command('coinflip', ['flip'], 'Flip a virtual coin.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, `Coin flip: ${pick(['Heads', 'Tails'])}`)),
    command('joke', ['randomjoke'], 'Receive a short programming joke.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, pick(JOKES))),
    command('fact', ['randomfact'], 'Receive a short technology fact.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, pick(FACTS))),
    command('qfun', ['quickfun'], 'Receive a short fun prompt.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, 'Quick fun: name one thing you learned today and why it matters.')),
    command('quote', ['dailyquote'], 'Receive an inspirational quote.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, pick(QUOTES))),
    command('numfact', ['numberfact'], 'Receive a fact about a number.', async (sock, msg, args, ctx) => {
        const value = Number.parseInt(args[0], 10);
        if (!Number.isInteger(value) || Math.abs(value) > 1000000) return reply(sock, msg, ctx, `Usage: ${ctx.prefix}numfact <whole number up to 1,000,000>`);
        const parity = Math.abs(value) % 2 === 0 ? 'even' : 'odd';
        return reply(sock, msg, ctx, `${value} is an ${parity} integer. Its square is ${value * value}.`);
    }),
    command('age', ['calculateage'], 'Calculate age from a birth date.', async (sock, msg, args, ctx) => {
        try { return reply(sock, msg, ctx, `Age: ${calculateAge(parseDate(args[0] || ''))} years`); }
        catch (error) { return reply(sock, msg, ctx, `Age error: ${error.message}`); }
    }),
    command('countdown', ['daysuntil'], 'Count days until a date.', async (sock, msg, args, ctx) => {
        try {
            const target = parseDate(args[0] || '');
            const today = new Date();
            const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
            const days = Math.ceil((target.getTime() - start) / 86400000);
            return reply(sock, msg, ctx, days >= 0 ? `Days remaining: ${days}` : `That date was ${Math.abs(days)} days ago.`);
        } catch (error) { return reply(sock, msg, ctx, `Countdown error: ${error.message}`); }
    }),
    command('time', ['worldclock'], 'Show the current time in a supported IANA time zone.', async (sock, msg, args, ctx) => {
        const zone = args[0] || 'UTC';
        try {
            const formatted = new Intl.DateTimeFormat('en-GB', { timeZone: zone, dateStyle: 'full', timeStyle: 'medium' }).format(new Date());
            return reply(sock, msg, ctx, `${zone}: ${formatted}`);
        } catch { return reply(sock, msg, ctx, `Unknown time zone. Example: ${ctx.prefix}time Africa/Nairobi`); }
    }),
    command('notes', ['notehelp'], 'Show personal note commands.', async (sock, msg, args, ctx) => reply(sock, msg, ctx, `Notes are private to your WhatsApp account.\n${ctx.prefix}addnote <name> <text>\n${ctx.prefix}getnote <name>\n${ctx.prefix}getnotes\n${ctx.prefix}updatenote <name> <text>\n${ctx.prefix}delnote <name>\n${ctx.prefix}delallnotes yes`)),
    command('addnote', [], 'Create a personal note.', async (sock, msg, args, ctx) => {
        try {
            const name = normalizeNoteName(args.shift());
            const text = requireText(args, `${ctx.prefix}addnote <name> <text>`);
            const { notes, owner } = getPersonalNotes(ctx, true);
            if (notes[owner][name]) return reply(sock, msg, ctx, `A note named "${name}" already exists. Use ${ctx.prefix}updatenote to change it.`);
            notes[owner][name] = text;
            writeNotes(notes);
            return reply(sock, msg, ctx, `Saved note: ${name}`);
        } catch (error) { return reply(sock, msg, ctx, `Note error: ${error.message}`); }
    }),
    command('getnote', [], 'Read one personal note.', async (sock, msg, args, ctx) => {
        try {
            const name = normalizeNoteName(args[0]);
            const { personal } = getPersonalNotes(ctx);
            return reply(sock, msg, ctx, personal[name] ? `${name}:\n${personal[name]}` : `No note named "${name}" was found.`);
        } catch (error) { return reply(sock, msg, ctx, `Note error: ${error.message}`); }
    }),
    command('getnotes', ['listnotes'], 'List personal note names.', async (sock, msg, args, ctx) => {
        const { personal } = getPersonalNotes(ctx);
        const names = Object.keys(personal).sort();
        return reply(sock, msg, ctx, names.length ? `Your notes:\n${names.map((name) => `• ${name}`).join('\n')}` : 'You have no saved notes.');
    }),
    command('updatenote', [], 'Update a personal note.', async (sock, msg, args, ctx) => {
        try {
            const name = normalizeNoteName(args.shift());
            const text = requireText(args, `${ctx.prefix}updatenote <name> <text>`);
            const { notes, owner } = getPersonalNotes(ctx, true);
            if (!notes[owner][name]) return reply(sock, msg, ctx, `No note named "${name}" was found.`);
            notes[owner][name] = text;
            writeNotes(notes);
            return reply(sock, msg, ctx, `Updated note: ${name}`);
        } catch (error) { return reply(sock, msg, ctx, `Note error: ${error.message}`); }
    }),
    command('delnote', [], 'Delete one personal note.', async (sock, msg, args, ctx) => {
        try {
            const name = normalizeNoteName(args[0]);
            const { notes, owner } = getPersonalNotes(ctx, true);
            if (!notes[owner][name]) return reply(sock, msg, ctx, `No note named "${name}" was found.`);
            delete notes[owner][name];
            writeNotes(notes);
            return reply(sock, msg, ctx, `Deleted note: ${name}`);
        } catch (error) { return reply(sock, msg, ctx, `Note error: ${error.message}`); }
    }),
    command('delallnotes', [], 'Delete all personal notes after confirmation.', async (sock, msg, args, ctx) => {
        if ((args[0] || '').toLowerCase() !== 'yes') return reply(sock, msg, ctx, `Confirm with ${ctx.prefix}delallnotes yes`);
        const { notes, owner } = getPersonalNotes(ctx, true);
        notes[owner] = {};
        writeNotes(notes);
        return reply(sock, msg, ctx, 'Deleted all of your notes.');
    }),
    command('listall', ['categories'], 'List available public categories.', async (sock, msg, args, ctx) => {
        const categories = [...new Set((ctx.commands || []).filter((item) => item.category !== 'owner').map((item) => item.category))];
        return reply(sock, msg, ctx, `Available categories:\n${categories.map((category) => `• ${category}`).join('\n')}`);
    })
];
