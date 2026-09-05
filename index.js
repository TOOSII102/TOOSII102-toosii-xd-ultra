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
const messageStore = require('./lib/messageStore');
const { withFramedReplies } = require('./lib/replyFormat');
const { getBotMode } = require('./lib/botMode');
const { getCommandAccess } = require('./lib/commandAccess');

const logger = pino({ level: process.env.WA_LOG_LEVEL || 'silent' });
const DEBUG_LOGS = process.env.DEBUG_LOGS === 'true';

function debug(message) {
    if (DEBUG_LOGS) console.log(chalk.gray(message));
}

// Sending can reject on its own (rate limits, closed socket, blocked contact).
// Swallow that so a failed reply never takes the connection down with it.
async function safeSend(sock, jid, text, quoted) {
    try {
        await sock.sendMessage(jid, { text }, quoted ? { quoted } : undefined);
        return true;
    } catch (error) {
        console.error(chalk.red('[Send] Could not deliver a reply:'), error?.message || error);
        return false;
    }
}

let reconnectAttempts = 0;

// Message ids already executed, so a redelivery cannot run a command twice.
const handledMessageIds = new Set();
const HANDLED_ID_LIMIT = 2000;

const PLACEHOLDER_NUMBER = '254700000000';
const PLACEHOLDER_SESSION_MARKER = 'PASTE_YOUR_SESSION_STRING_HERE';

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

// A bot serving the public must never die from one bad message. Baileys emits
// events without awaiting the handler, so any rejection that escapes would
// otherwise terminate the process on Node 18+.
process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('[Guard] Unhandled rejection (ignored, bot stays online):'), reason);
});
process.on('uncaughtException', (error) => {
    console.error(chalk.red('[Guard] Uncaught exception (ignored, bot stays online):'), error);
});

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
        markOnlineOnConnect: true,
        // Without an explicit keepalive the server stops seeing traffic and drops
        // the socket with status 408 after roughly a minute, which shows up as a
        // connect/disconnect loop where the bot never answers a command.
        keepAliveIntervalMs: 25000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        retryRequestDelayMs: 1000,
        // Baileys asks for the original when a recipient could not decrypt one of
        // our messages. Returning a stub makes the resend arrive empty, so the
        // other device never sees the reply. Serve the real message instead.
        getMessage: async (key) => messageStore.recall(key) || undefined
    });

    // Capture both phone-JID and LID identities supplied by Baileys. This is
    // required because WhatsApp may represent self-chat messages differently
    // from the linked device identity stored in creds.json.
    setRuntimeOwner(sock.user);

    // Every reply leaves through one place, so the house style is applied here
    // instead of being repeated in each of the 100+ commands.
    let activeCommandTitle = null;
    withFramedReplies(sock, BOT_NAME, () => activeCommandTitle);

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

    // Keep a copy of everything we send. WhatsApp asks for the original when a
    // recipient's device fails to decrypt it and requests a resend.
    sock.ev.on('messages.upsert', ({ messages }) => {
        for (const msg of messages || []) {
            if (msg?.key?.fromMe && msg.message) messageStore.remember(msg.key, msg.message);
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            reconnectAttempts = 0;
            setRuntimeOwner(sock.user);
            console.log(chalk.green(`[${BOT_NAME}] Connected.`));
            console.log(chalk.cyan(`[${BOT_NAME}] Loaded ${commands.catalog.length} commands across ${new Set(commands.catalog.map((command) => command.category)).size} categories.`));
            console.log(chalk.cyan(`[${BOT_NAME}] Access mode: ${getBotMode()}. Use .mode <public|private> as the owner to change it.`));
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const errorMsg = lastDisconnect?.error?.message || 'no message';

            // WhatsApp reports a "conflict" stream error as 401, the same code it
            // uses for a real logout. A conflict only means another device took
            // over the session, and the credentials stay valid, so treating it as
            // a logout retires a session that is still perfectly good.
            const isConflict = /conflict|replaced/i.test(errorMsg);
            const loggedOut = statusCode === DisconnectReason.loggedOut && !isConflict;
            const shouldReconnect = !loggedOut;
            console.log(chalk.red(`[${BOT_NAME}] Connection closed. Status: ${statusCode}, Reason: ${errorMsg}, Reconnect: ${shouldReconnect}`));

            if (!shouldReconnect) {
                console.log(chalk.yellow(`[${BOT_NAME}] The device was unlinked from WhatsApp. Delete ./session and link again.`));
                return;
            }

            if (isConflict) {
                console.log(chalk.yellow(`[${BOT_NAME}] Another device took over this session. Reconnecting; close other instances if this repeats.`));
            }

            // Back off between attempts. Reconnecting in a tight loop is what gets
            // an account rate-limited or banned, and start() returns a promise, so
            // it must be caught or a failed retry would terminate the process.
            reconnectAttempts += 1;
            const delay = Math.min(2000 * (2 ** (reconnectAttempts - 1)), 60000);
            console.log(chalk.yellow(`[${BOT_NAME}] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts}).`));
            setTimeout(() => {
                start().catch((error) => {
                    console.error(chalk.red(`[${BOT_NAME}] Reconnect attempt failed:`), error?.message || error);
                });
            }, delay);
        }
    });

    // ==============================================
    // 💬 MESSAGE HANDLER (with self‑detection)
    // ==============================================
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // Baileys uses 'append' for more than history replay. A message that
        // initially failed to decrypt and was recovered through the retry path is
        // emitted as 'append', and so is anything delivered while the bot was
        // offline. Ignoring those silently drops real commands, which is why the
        // bot answered in self-chat but often not from another phone.
        if (type !== 'notify' && type !== 'append') return;
        debug(`[Debug] messages.upsert fired — type: ${type}, count: ${messages.length}`);

        for (const msg of messages) {
          try {
            // A redelivery of the same id must not run a command twice. The check
            // happens here, but the id is only recorded once a command actually
            // runs: WhatsApp often delivers an undecryptable placeholder first and
            // the real content in a later retry under the same id, so recording it
            // on arrival would discard the copy that carries the command.
            if (msg?.key?.id && handledMessageIds.has(msg.key.id)) {
                debug(`[Debug] Skipping duplicate message ${msg.key.id}`);
                continue;
            }

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
            const cmdName = (args.shift() || '').toLowerCase();
            if (!cmdName) continue; // a bare prefix is not a command
            const command = commands.get(cmdName);

            if (!command) {
                debug(`[Debug] Command not found: ${cmdName}`);
                continue;
            }

            debug(`[Debug] Executing command: ${cmdName}`);

            // Record only now, so a placeholder that carried no readable command
            // never blocks the retry that does.
            if (msg.key?.id) {
                handledMessageIds.add(msg.key.id);
                if (handledMessageIds.size > HANDLED_ID_LIMIT) {
                    const oldest = handledMessageIds.values().next().value;
                    if (oldest !== undefined) handledMessageIds.delete(oldest);
                }
            }

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
                activeCommandTitle = command.name;
                await safeSend(sock, ctx.from, access.reason, msg);
                activeCommandTitle = null;
                continue;
            }

            try {
                activeCommandTitle = command.name;
                await command.execute(sock, msg, args, ctx);
            } catch (err) {
                console.error(chalk.red(`[Commands] Error running "${cmdName}":`), err);
                // Report the failure without leaking internals to the chat.
                await safeSend(sock, ctx.from, `⚠️ That command failed. Please try again.`, msg);
            } finally {
                activeCommandTitle = null;
            }
          } catch (err) {
            // One malformed message must never stop the remaining ones.
            console.error(chalk.red('[Handler] Skipped a message after an error:'), err?.message || err);
          }
        }
    });
}

start().catch(err => {
    console.error(chalk.red('[Fatal]'), err);
    process.exit(1);
});
