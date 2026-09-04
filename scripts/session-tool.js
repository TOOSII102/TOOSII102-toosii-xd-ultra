'use strict';

// Inspect or build a SESSION_ID without printing secret material.
//
//   node scripts/session-tool.js check          reads SESSION_ID from .env
//   node scripts/session-tool.js check <file>   reads the string from a file
//   node scripts/session-tool.js build <creds>  encodes a creds.json into a SESSION_ID
//
// The bot expects SESSION_PREFIX followed by base64 of a Baileys creds.json.

const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch { /* optional */ }

const { SESSION_PREFIX } = require('../config');

const REQUIRED_KEYS = ['noiseKey', 'signedIdentityKey', 'signedPreKey', 'registrationId', 'me'];

function fail(message) {
    console.error(`FAIL  ${message}`);
    process.exit(1);
}

function readCandidate(argument) {
    if (argument) {
        const file = path.resolve(argument);
        if (!fs.existsSync(file)) fail(`No such file: ${file}`);
        return fs.readFileSync(file, 'utf-8').trim();
    }
    const fromEnv = process.env.SESSION_ID;
    if (!fromEnv || !fromEnv.trim()) fail('SESSION_ID is not set in .env, and no file was given.');
    return fromEnv.trim();
}

function summarise(creds) {
    const id = creds?.me?.id || '(missing)';
    const [rawNumber] = String(id).split(':');
    const digits = String(rawNumber).replace(/\D/g, '');
    const masked = digits.length > 5
        ? `${digits.slice(0, 3)}${'*'.repeat(Math.max(digits.length - 5, 0))}${digits.slice(-2)}`
        : '(short)';
    return {
        account: masked,
        name: creds?.me?.name || '(not set)',
        registered: creds?.registered === true,
        platform: creds?.platform || '(not set)',
        keys: REQUIRED_KEYS.filter((key) => creds?.[key] !== undefined)
    };
}

function check(argument) {
    const value = readCandidate(argument);

    console.log(`Length          ${value.length} characters`);

    if (!value.startsWith(SESSION_PREFIX)) {
        console.log(`Prefix          missing (expected "${SESSION_PREFIX}")`);
        fail(`The string must begin with "${SESSION_PREFIX}". Session IDs from other bots will not work here.`);
    }
    console.log(`Prefix          ok ("${SESSION_PREFIX}")`);

    const payload = value.slice(SESSION_PREFIX.length);
    if (!payload) fail('Nothing follows the prefix.');

    let decoded;
    try {
        decoded = Buffer.from(payload, 'base64').toString('utf-8');
    } catch (error) {
        fail(`The part after the prefix is not valid base64: ${error.message}`);
    }

    let creds;
    try {
        creds = JSON.parse(decoded);
    } catch (error) {
        fail(`Decoded payload is not JSON: ${error.message}. It may be truncated — session strings are long and are easy to cut off when copying.`);
    }

    const missing = REQUIRED_KEYS.filter((key) => creds?.[key] === undefined);
    if (!creds?.me?.id) fail('Decoded credentials have no me.id, so the bot will reject them.');

    const info = summarise(creds);
    console.log(`Account         ${info.account}`);
    console.log(`Display name    ${info.name}`);
    console.log(`Registered      ${info.registered}`);
    console.log(`Platform        ${info.platform}`);
    console.log(`Credential keys ${info.keys.length}/${REQUIRED_KEYS.length} present`);

    if (missing.length) {
        console.log(`Missing keys    ${missing.join(', ')}`);
        fail('The credentials are incomplete. Generate a fresh session.');
    }
    if (!info.registered) {
        console.log('\nWARNING  registered is false. This session has not completed linking and will not connect.');
    }

    console.log('\nPASS  This SESSION_ID is well formed and can be loaded by the bot.');
}

function build(credsPath) {
    if (!credsPath) fail('Usage: node scripts/session-tool.js build <path-to-creds.json>');
    const file = path.resolve(credsPath);
    if (!fs.existsSync(file)) fail(`No such file: ${file}`);

    const raw = fs.readFileSync(file, 'utf-8');
    let creds;
    try {
        creds = JSON.parse(raw);
    } catch (error) {
        fail(`That file is not valid JSON: ${error.message}`);
    }
    if (!creds?.me?.id) fail('That creds.json has no me.id.');

    const encoded = SESSION_PREFIX + Buffer.from(JSON.stringify(creds)).toString('base64');
    const outputPath = path.join(process.cwd(), 'session-id.txt');
    fs.writeFileSync(outputPath, encoded, { mode: 0o600 });

    const info = summarise(creds);
    console.log(`Built a SESSION_ID for account ${info.account} (${encoded.length} characters).`);
    console.log(`Written to ${outputPath} with owner-only permissions.`);
    console.log('Treat that file as a password: it grants full access to the linked WhatsApp account.');
}

const [, , mode, argument] = process.argv;
if (mode === 'check') check(argument);
else if (mode === 'build') build(argument);
else {
    console.log('Usage:');
    console.log('  node scripts/session-tool.js check           validate SESSION_ID from .env');
    console.log('  node scripts/session-tool.js check <file>    validate a session string in a file');
    console.log('  node scripts/session-tool.js build <creds>   encode a creds.json into a SESSION_ID');
    process.exit(1);
}
