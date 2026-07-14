const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const chalk = require('chalk');
const readline = require('readline');

const { PREFIX, BOT_NAME, OWNER_NUMBER, SESSION_ID } = require('./config');
const { loadSessionFromId, SESSION_DIR } = require('./lib/sessionLoader');
const { loadCommands } = require('./lib/commandLoader');

const logger = pino({ level: 'silent' });

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

async function start() {
    // Try to hydrate ./session from SESSION_ID before Baileys reads it
    loadSessionFromId();

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    const commands = loadCommands();

    // If we already have a session (from .env SESSION_ID or a prior pairing),
    // state.creds.registered will be true and we skip pairing entirely.
    const needsPairing = !state.creds.registered;

    const sock = makeWASocket({
        version,
        logger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false, // panel consoles usually can't render QR well — use pairing code instead
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    // No SESSION_ID found in .env and not yet linked -> request a pairing code
    if (needsPairing) {
        if (SESSION_ID) {
            console.log(chalk.yellow(`[${BOT_NAME}] SESSION_ID was set but invalid/expired — falling back to pairing code.`));
        } else {
            console.log(chalk.cyan(`[${BOT_NAME}] No SESSION_ID found in .env — pairing required.`));
        }

        let phoneNumber = OWNER_NUMBER;
        if (!phoneNumber) {
            phoneNumber = await ask('Enter WhatsApp number to link (international format, no + or spaces, e.g. 254700000000): ');
        }

        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
                console.log(chalk.green(`[${BOT_NAME}] Pairing code: `) +
