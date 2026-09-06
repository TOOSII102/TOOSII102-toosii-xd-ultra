'use strict';

// Owner-only maintenance: pull the latest code from GitHub and restart.
// Both are destructive to a running bot, so they are gated on ownership and
// refuse to act on anything they cannot verify first.

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { ownerOnly } = require('../../middleware/ownerOnly');

const REPO_ROOT = path.join(__dirname, '..', '..');
const GIT_TIMEOUT_MS = 60000;

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

// execFile with an argument array, never a shell string, so nothing a user
// types can be interpreted as a command.
function git(args, timeoutMs = GIT_TIMEOUT_MS) {
    return new Promise((resolve) => {
        execFile('git', args, { cwd: REPO_ROOT, timeout: timeoutMs, maxBuffer: 1024 * 1024 },
            (error, stdout, stderr) => {
                resolve({
                    ok: !error,
                    out: String(stdout || '').trim(),
                    err: String(stderr || error?.message || '').trim()
                });
            });
    });
}

// Never echo a credential that may be embedded in a remote URL.
function scrub(text) {
    return String(text || '')
        .replace(/https:\/\/[^@\s]+@/g, 'https://')
        .replace(/gh[pousr]_[A-Za-z0-9]{20,}/g, '***')
        .slice(0, 700);
}

async function isGitRepo() {
    return fs.existsSync(path.join(REPO_ROOT, '.git'));
}

module.exports = [
    {
        name: 'update',
        aliases: ['pull', 'gitpull'],
        description: 'Pull the latest code from GitHub.',
        category: 'owner',
        execute: ownerOnly(async (sock, msg, args, ctx) => {
            if (!await isGitRepo()) {
                return reply(sock, msg, ctx, 'This deployment is not a git checkout, so it cannot self-update.');
            }

            const before = await git(['rev-parse', '--short', 'HEAD']);
            if (!before.ok) return reply(sock, msg, ctx, `Could not read the current commit.\n${scrub(before.err)}`);

            // Refuse to discard uncommitted edits made on the host.
            const dirty = await git(['status', '--porcelain']);
            if (dirty.ok && dirty.out) {
                return reply(sock, msg, ctx,
                    'There are uncommitted changes here, so the update was stopped to avoid losing them.\n\n' +
                    `${dirty.out.split('\n').slice(0, 10).join('\n')}`);
            }

            await reply(sock, msg, ctx, `Updating from ${before.out}...`);

            const fetched = await git(['fetch', '--all', '--prune']);
            if (!fetched.ok) return reply(sock, msg, ctx, `Fetch failed.\n${scrub(fetched.err)}`);

            const pulled = await git(['pull', '--ff-only']);
            if (!pulled.ok) {
                return reply(sock, msg, ctx,
                    'Pull failed. The local branch has diverged from the remote, so a fast-forward was not possible.\n\n' +
                    scrub(pulled.err));
            }

            const after = await git(['rev-parse', '--short', 'HEAD']);
            if (before.out === after.out) {
                return reply(sock, msg, ctx, `Already up to date at ${after.out}.`);
            }

            const log = await git(['log', '--oneline', `${before.out}..${after.out}`]);
            const changed = await git(['diff', '--name-only', `${before.out}..${after.out}`]);
            const needsInstall = changed.ok && /(^|\n)package(-lock)?\.json/.test(changed.out);

            return reply(sock, msg, ctx, [
                `Updated ${before.out} -> ${after.out}`,
                '',
                log.ok && log.out ? log.out.split('\n').slice(0, 10).join('\n') : 'Updated.',
                '',
                needsInstall
                    ? 'Dependencies changed: run npm install before restarting.'
                    : `Run ${ctx.prefix}restart to load the new code.`
            ].join('\n'));
        })
    },

    {
        name: 'restart',
        aliases: ['reboot'],
        description: 'Restart the bot process.',
        category: 'owner',
        execute: ownerOnly(async (sock, msg, args, ctx) => {
            // Exiting only helps when a supervisor will start the process again.
            // Without one the bot would simply stop, so say so rather than
            // silently going offline.
            const supervised = Boolean(
                process.env.PM2_HOME || process.env.pm_id ||
                process.env.DYNO || process.env.RENDER ||
                process.env.KUBERNETES_SERVICE_HOST ||
                process.env.RESTART_SUPERVISED === 'true'
            );

            if (!supervised) {
                return reply(sock, msg, ctx, [
                    'No process supervisor was detected, so restarting would stop the bot for good.',
                    '',
                    'Run it under pm2, systemd, Docker with a restart policy, or a host like Render,',
                    'then this command will work. To override the check, set RESTART_SUPERVISED=true.'
                ].join('\n'));
            }

            await reply(sock, msg, ctx, 'Restarting now. Reconnecting in a few seconds.');

            // Give the reply time to reach WhatsApp before the process dies.
            setTimeout(() => process.exit(0), 1500);
            return true;
        })
    }
];
