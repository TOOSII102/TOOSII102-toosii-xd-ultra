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

const { PREFIX, BOT_NAME } = require('./config');
const { loadSessionFromId, SESSION_DIR } = require('./lib/sessionLoader');
const { loadCommands } = require('./lib/commandLoader');

const logger = pino({ level: 'silent' });

async function start() {
    // Try to hydrate ./session from SESSION_ID before Baileys reads it
    loadSessionFromId();

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    const commands = loadCommands();

    const sock = makeWASocket({
        version,
        logger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: !state.creds.registered,
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log(chalk.green(`[${BOT_NAME}] Connected ✅`));
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(chalk.red(`[${BOT_NAME}] Connection closed. Reconnect: ${shouldReconnect}`));
            if (shouldReconnect) start();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;

            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                msg.message.imageMessage?.caption ||
                msg.message.videoMessage?.caption ||
                '';

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

start().catch(err => {
    console.error(chalk.red('[Fatal]'), err);
    process.exit(1);
});
