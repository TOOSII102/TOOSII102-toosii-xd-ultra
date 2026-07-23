'use strict';

const { ownerOnly } = require('../middleware/ownerOnly');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'update',
    aliases: ['upgrade', 'pull'],
    description: 'Update bot from GitHub repository',
    category: 'owner',

    execute: ownerOnly(async (sock, msg, args, ctx) => {
        const chatId = ctx.from;

        // Helper to send messages
        const send = async (text) => {
            await sock.sendMessage(chatId, { text }, { quoted: msg });
        };

        // 1. Check if we're in a git repo
        const gitDir = path.join(process.cwd(), '.git');
        if (!fs.existsSync(gitDir)) {
            await send('❌ Not a git repository. Please clone the bot from GitHub first.');
            return;
        }

        // 2. Check git availability
        try {
            await execPromise('git --version');
        } catch (err) {
            await send('❌ Git is not installed or not available on this system.');
            return;
        }

        await send('🔍 Checking for updates...');

        try {
            // 3. Fetch remote updates (dry-run to see if changes exist)
            const { stdout: fetchOutput } = await execPromise('git fetch --dry-run');
            if (!fetchOutput.includes('updates')) {
                await send('✅ Already up to date.');
                return;
            }

            // 4. Pull changes
            await send('⬇️ Pulling latest changes...');
            const { stdout: pullOutput } = await execPromise('git pull');

            // 5. Check if package.json changed
            const { stdout: packageChanged } = await execPromise('git diff --name-only HEAD@{1} HEAD | grep package.json || true');
            let npmOutput = '';
            if (packageChanged.trim()) {
                await send('📦 package.json changed. Running `npm install`...');
                const { stdout } = await execPromise('npm install --no-audit --no-fund');
                npmOutput = stdout.slice(-500); // last 500 chars
            }

            // 6. Success message
            const successMsg = [
                `✅ Update successful!`,
                ``,
                `📦 Changes pulled:`,
                `\`\`\`\n${pullOutput.slice(0, 800)}\n\`\`\``,
                npmOutput ? `📥 npm install output:\n\`\`\`\n${npmOutput}\n\`\`\`` : '',
                ``,
                `🔄 Bot will restart in 5 seconds.`
            ].filter(Boolean).join('\n');

            await send(successMsg);

            // 7. Exit after a short delay to allow message to be delivered
            setTimeout(() => {
                // Graceful exit – process manager (PM2, systemd, etc.) will restart
                process.exit(0);
            }, 5000);

        } catch (error) {
            // If anything fails, report the error and stay alive
            await send(`❌ Update failed:\n\n\`\`\`\n${error.message}\n\`\`\``);
        }
    })
};
