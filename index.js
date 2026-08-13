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
const { isOwnerMessage, setRuntimeOwner } = require('./middleware/ownerOnly');
const { getBotMode } = require('./lib/botMode');
const { getCommandAccess } = require('./lib/commandAccess');

const logger = pino({ level: 'silent' });
const DEBUG_LOGS = process.env.DEBUG_LOGS === 'true';

function debug(message) {
    if (DEBUG_LOGS) console.log(chalk.gray(message));
}

const PLACEHOLDER_NUMBER = '254700000000';
const PLACEHOLDER_SESSION_MARKER = 'PASTE_YOUR_SESSION_STRING_HERE';

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

async function start() {
    loadSessionFromId();

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(chalk.cyan(`[${BOT_NAME}] Using WA protocol version ${version.join('.')} (latest: ${isLatest})`));

    // ==============================================
    // 📋 LOAD BASIC COMMANDS (ping, menu, owner)
    // ==============================================
    const commands = loadCommands();   // Only loads files with { name, execute }


    // ==============================================
    // 🔗 PAIRING LOGIC
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
            console.error(chalk.red(`[${BOT_NAME}] "${phoneNumber}" doesn't look like a full international number.`));
            process.exit(1);
        }
    }

    // ==============================================
    // 🚀 CREATE SOCKET
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

    // Capture both phone-JID and LID identities supplied by Baileys. This is
    // required because WhatsApp may represent self-chat messages differently
    // from the linked device identity stored in creds.json.
    setRuntimeOwner(sock.user);

    // ==============================================
    // 🔑 PAIRING CODE REQUEST
    // ==============================================
    if (needsPairing && phoneNumber) {
        try {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(chalk.green(`[${BOT_NAME}] Pairing code: `) + chalk.bold.white(code));
            console.log(chalk.cyan('On your phone: WhatsApp > Linked Devices > Link a Device > Link with phone number instead, then enter this code within 60 seconds.'));
        } catch (err) {
            const statusCode = err?.output?.statusCode || err?.data?.statusCode || 'unknown';
            console.error(chalk.red('[Pairing] Failed to generate pairing code:'), err.message, chalk.gray(`(status: ${statusCode})`));
            console.log(chalk.yellow('[Pairing] Restart the bot to try again.'));
        }
    }

    // ==============================================
    // 📡 EVENT HANDLERS
    // ==============================================
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            setRuntimeOwner(sock.user);
            console.log(chalk.green(`[${BOT_NAME}] Connected.`));
            console.log(chalk.cyan(`[${BOT_NAME}] Loaded ${commands.catalog.length} commands across ${new Set(commands.catalog.map((command) => command.category)).size} categories.`));
            console.log(chalk.cyan(`[${BOT_NAME}] Access mode: ${getBotMode()}. Use .mode <public|private> as the owner to change it.`));
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const errorMsg = lastDisconnect?.error?.message || 'no message';
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(chalk.red(`[${BOT_NAME}] Connection closed. Status: ${statusCode}, Reason: ${errorMsg}, Reconnect: ${shouldReconnect}`));
            if (shouldReconnect) start();
        }
    });

    // ==============================================
    // 💬 MESSAGE HANDLER (with self‑detection)
    // ==============================================
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // Only execute newly received messages; `append` commonly contains history replay.
        if (type !== 'notify') return;
        debug(`[Debug] messages.upsert fired — count: ${messages.length}`);

        for (const msg of messages) {
            const senderJid = msg.key.remoteJid;
            const participant = msg.key.participant || senderJid;

            // Ignore WhatsApp status updates and incomplete envelope records.
            if (!msg.message || senderJid === 'status@broadcast') continue;

            const botJid = sock.user?.id || null;
            const botNumber = botJid ? botJid.split('@')[0].replace(/[^0-9]/g, '') : '';
            const senderNumber = participant ? participant.split('@')[0].replace(/[^0-9]/g, '') : '';

            const isBotJid = participant === botJid;
            const isBotNumber = senderNumber === botNumber;
            const isFromMe = msg.key.fromMe;

            const isSelf = isFromMe && (isBotJid || isBotNumber);

            const previewBody =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                '(no text / not a text message)';

            debug(`[Debug] from=${senderJid} | fromMe=${msg.key.fromMe} | isSelf=${isSelf}`);

            const body = previewBody === '(no text / not a text message)'
                ? (msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '')
                : previewBody;

            if (!body.startsWith(PREFIX)) {
                debug(`[Debug] Skipping: No prefix (${PREFIX})`);
                continue;
            }

            if (isSelf) {
                debug('[Debug] Allowing a prefixed self-chat command from the linked account');
            }

            const args = body.slice(PREFIX.length).trim().split(/\s+/);
            const cmdName = args.shift().toLowerCase();
            const command = commands.get(cmdName);

            if (!command) {
                debug(`[Debug] Command not found: ${cmdName}`);
                continue;
            }

            debug(`[Debug] Executing command: ${cmdName}`);

            const sender = participant || senderJid;
            const owner = isOwnerMessage(sender, isFromMe);
            const botMode = getBotMode();
            const access = getCommandAccess(botMode, owner, command.category);
            const ctx = {
                from: senderJid,
                sender,
                isGroup: senderJid ? senderJid.endsWith('@g.us') : false,
                prefix: PREFIX,
                commands: commands.catalog,
                isOwner: owner,
                botMode
            };

            if (!access.allowed) {
                await sock.sendMessage(ctx.from, { text: access.reason }, { quoted: msg });
                continue;
            }

            try {
                await command.execute(sock, msg, args, ctx);
            } catch (err) {
                console.error(chalk.red(`[Commands] Error running "${cmdName}":`), err);
                await sock.sendMessage(ctx.from, { text: `⚠️ Error running .${cmdName}: ${err.message}` }, { quoted: msg });
            }
        }
    });
}

start().catch(err => {
    console.error(chalk.red('[Fatal]'), err);
    process.exit(1);
});
