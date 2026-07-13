module.exports = {
    name: 'ping',
    aliases: ['p'],
    description: 'Check that the bot is alive and measure response time',
    category: 'general',
    execute: async (sock, msg, args, ctx) => {
        const start = Date.now();
        const sent = await sock.sendMessage(ctx.from, { text: '🏓 Pinging...' }, { quoted: msg });
        const latency = Date.now() - start;

        await sock.sendMessage(ctx.from, {
            text: `🏓 Pong! ${latency}ms`,
            edit: sent.key
        });
    }
};
