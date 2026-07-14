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

// ==============================================
// IMPORT WHATSAPP KILLER MODULE
// ==============================================
const { WhatsAppKiller, WhatsAppKillerStop } = require('./commands/whatsappKiller');

// ==============================================
// IMPORT PHONE ATTACKS MODULE
// ==============================================
const { 
    PhoneAttacks, 
    SpamCommand, 
    CallbombCommand, 
    PhoneInfoCommand,
    SpamStopCommand,
    CallbombStopCommand 
} = require('./commands/phoneAttacks');

const logger = pino({ level: 'silent' });

const PLACEHOLDER_NUMBER = '254700000000';
const PLACEHOLDER_SESSION_MARKER = 'PASTE_YOUR_SESSION_STRING_HERE';

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

async function start() {
    // Try to hydrate ./session from SESSION_ID before Baileys reads it
    loadSessionFromId();

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(chalk.cyan(`[${BOT_NAME}] Using WA protocol version ${version.join('.')} (latest: ${isLatest})`));

    // ==============================================
    // LOAD COMMANDS AND REGISTER ALL MODULES
    // ==============================================
    const commands = loadCommands();
    
    // Initialize WhatsApp Killer
    const killer = new WhatsAppKiller();
    commands.set('killwa', killer);
    commands.set('killwa_stop', new WhatsAppKillerStop(killer));
    
    // Initialize Silent Phone Attacks
    const phoneAttacks = new PhoneAttacks();
    commands.set('spam', new SpamCommand(phoneAttacks));
    commands.set('callbomb', new CallbombCommand(phoneAttacks));
    commands.set('phoneinfo', new PhoneInfoCommand(phoneAttacks));
    commands.set('spam_stop', new SpamStopCommand(phoneAttacks));
    commands.set('callbomb_stop', new CallbombStopCommand(phoneAttacks));

    // ==============================================
    // PAIRING LOGIC
    // ==============================================
    const needsPairing = !state.creds.registered;

    let phoneNumber = null;
    if (needsPairing) {
        const hadRealSessionId = SESSION_ID && !SESSION_ID.includes(PLACEHOLDER_SESSION_MARKER);

        if (hadRealSessionId) {
            console.log(chalk.yellow(`[${BOT_NAME}] SESSION_ID was set but invalid/expired — falling back to pairing code.`));
        } else {
            console.log(chalk.cyan(`[${BOT_NAME}] No SESSION_ID configured — pairing required.`));
        }

        phoneNumber = OWNER_NUMBER;
        const isPlaceholderNumber = !phoneNumber || phoneNumber.replace(/[^0-9]/g, '') === PLACEHOLDER_NUMBER;

        if (isPlaceholderNumber) {
            phoneNumber = await ask('Enter the WhatsApp number to link (international format, no + or spaces, e.g. 254712345678): ');
        } else {
            console.log(chalk.cyan(`[${BOT_NAME}] Using OWNER_NUMBER from .env: ${phoneNumber}`));
        }

        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        if (phoneNumber.length < 7) {
            console.error(chalk.red(`[${BOT_NAME}] "${phoneNumber}" doesn't look like a full international number (too short). Restart and enter it again, e.g. countrycode + number, no + or spaces.`));
            process.exit(1);
        }
    }

    // ==============================================
    // CREATE SOCKET
    // ==============================================
    const sock = makeWASocket({
        version,
        logger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        browser: Browsers.macOS('Safari'),
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    // ==============================================
    // PAIRING CODE REQUEST
    // ==============================================
    if (needsPairing && phoneNumber) {
        try {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(chalk.green(`[${BOT_NAME}] Pairing code: `) + chalk.bold.white(code));
            console.log(chalk.cyan('On your phone: WhatsApp > Linked Devices > Link a Device > Link with phone number instead, then enter this code within 60 seconds.'));
        } catch (err) {
            const statusCode = err?.output?.statusCode || err?.data?.statusCode || 'unknown';
            console.error(chalk.red('[Pairing] Failed to generate pairing code:'), err.message, chalk.gray(`(status: ${statusCode})`));
            if (statusCode === 405 || statusCode === 428) {
                console.log(chalk.yellow('[Pairing] This status often means WhatsApp is rejecting the connection from this server\'s IP address (common on shared/datacenter hosting). This is not something the bot code can fix — it needs a different network/IP, or a VPS with a residential-style IP.'));
            }
            console.log(chalk.yellow('[Pairing] Restart the bot to try again.'));
        }
    }

    // ==============================================
    // EVENT HANDLERS
    // ==============================================
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log(chalk.green(`[${BOT_NAME}] Connected ✅`));
            console.log(chalk.cyan(`[${BOT_NAME}] Commands loaded:`));
            console.log(chalk.gray(`  └─ .killwa, .killwa_stop - Force close WhatsApp`));
            console.log(chalk.gray(`  └─ .spam, .spam_stop - Silent message spam`));
            console.log(chalk.gray(`  └─ .callbomb, .callbomb_stop - Silent call flooding`));
            console.log(chalk.gray(`  └─ .phoneinfo - Global phone number lookup`));
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const errorMsg = lastDisconnect?.error?.message || 'no message';
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(chalk.red(`[${BOT_NAME}] Connection closed. Status: ${statusCode}, Reason: ${errorMsg}, Reconnect: ${shouldReconnect}`));
            if (shouldReconnect) start();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        console.log(chalk.gray(`[Debug] messages.upsert fired — type: ${type}, count: ${messages.length}`));

        for (const msg of messages) {
            const ownJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : null;
            const isSelfChat = ownJid && msg.key.remoteJid === ownJid;
            const previewBody =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                '(no text / not a text message)';

            console.log(chalk.gray(
                `[Debug] from=${msg.key.remoteJid} fromMe=${msg.key.fromMe} isSelfChat=${isSelfChat} hasMessage=${!!msg.message} body="${previewBody}"`
            ));

            if (!msg.message) continue;

            if (msg.key.fromMe && !isSelfChat) continue;

            const body = previewBody === '(no text / not a text message)'
                ? (msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '')
                : previewBody;

            if (!body.startsWith(PREFIX)) continue;

            const args = body.slice(PREFIX.length).trim().split(/\s+/);
            const cmdName = args.shift().toLowerCase();
            const command = commands.get(cmdName);

            if (!command) continue;

            const ctx = {
                from: msg.key.remoteJid,
                sender: msg.key.participant || msg.key.remoteJid,
                isGroup: msg.key.remoteJid.endsWith('@g.us'),
                prefix: PREFIX
            };

            try {
                await command.execute(sock, msg, args, ctx);
            } catch (err) {
                console.error(chalk.red(`[Commands] Error running "${cmdName}":`), err);
                await sock.sendMessage(ctx.from, { text: `⚠️ Error running .${cmdName}: ${err.message}` }, { quoted: msg });
            }
        }
    });
}

// ==============================================
// START THE BOT
// ==============================================
start().catch(err => {
    console.error(chalk.red('[Fatal]'), err);
    process.exit(1);
});
