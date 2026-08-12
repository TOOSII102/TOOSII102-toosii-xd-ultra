'use strict';

const { ownerOnly } = require('../middleware/ownerOnly');
const { runRepositoryUpdate } = require('../lib/repositoryUpdate');

function resultMessage(result) {
    switch (result.status) {
        case 'not-repository':
            return 'Update unavailable: the bot directory is not a Git repository.';
        case 'git-unavailable':
            return 'Update unavailable: Git is not installed or cannot be run by this service.';
        case 'working-tree-dirty':
            return 'Update stopped: the deployment has local uncommitted changes. Commit, stash, or discard those changes before updating so no work is overwritten.';
        case 'detached-head':
            return 'Update stopped: the repository is in detached-HEAD mode. Check out a tracked branch before updating.';
        case 'no-upstream':
            return `Update stopped: branch \`${result.branch}\` has no upstream branch. Configure its Git tracking branch before using .update.`;
        case 'no-remote':
            return `Update stopped: no remote is configured for branch \`${result.branch}\`.`;
        case 'fetch-failed':
            return `Update failed while checking the remote:\n\`\`\`\n${result.detail}\n\`\`\``;
        case 'git-error':
            return `Update failed while trying to ${result.step}:\n\`\`\`\n${result.detail}\n\`\`\``;
        case 'merge-failed':
            return `Update stopped before changing the deployment. Only fast-forward updates are allowed:\n\`\`\`\n${result.detail}\n\`\`\``;
        case 'up-to-date':
            return `Already up to date with \`${result.upstream}\`.${result.ahead > 0 ? ` This deployment also has ${result.ahead} local commit${result.ahead === 1 ? '' : 's'}.` : ''}`;
        case 'update-available':
            return `Update available from \`${result.upstream}\`: ${result.behind} incoming commit${result.behind === 1 ? '' : 's'}${result.ahead > 0 ? `; this deployment is also ${result.ahead} commit${result.ahead === 1 ? '' : 's'} ahead` : ''}. Run \`.update\` to install it.`;
        case 'updated-dependency-failed':
            return [
                `Code updated from \`${result.before}\` to \`${result.after}\`, but dependency installation failed.`,
                `The new code should not be restarted until dependencies are fixed:`,
                `\`\`\`\n${result.detail}\n\`\`\``
            ].join('\n');
        case 'updated': {
            const dependencyNote = result.dependencyRefresh === 'completed'
                ? `Dependencies refreshed.\n\`\`\`\n${result.dependencyOutput || 'Dependency installation completed.'}\n\`\`\``
                : 'Dependencies did not change.';
            return [
                `Update installed: \`${result.before}\` → \`${result.after}\` from \`${result.upstream}\`.`,
                dependencyNote,
                'Restart the bot through its deployment manager to activate the new code. This command does not terminate an unmanaged bot process automatically.'
            ].join('\n');
        }
        default:
            return 'Update failed: the update service returned an unknown result.';
    }
}

const command = {
    name: 'update',
    aliases: ['upgrade', 'pull'],
    description: 'Safely update the bot from its tracked Git branch',
    category: 'owner',

    execute: ownerOnly(async (sock, msg, args, ctx) => {
        const mode = String(args[0] || '').trim().toLowerCase();
        const send = async (text) => sock.sendMessage(ctx.from, { text }, { quoted: msg });

        if (mode && !['check', 'status'].includes(mode)) {
            await send(`Usage:\n\`${ctx.prefix || '.'}update\` — install a safe fast-forward update\n\`${ctx.prefix || '.'}update check\` — check whether an update is available`);
            return;
        }

        await send(mode ? 'Checking the tracked Git branch for updates...' : 'Checking and safely applying an update...');
        const result = await runRepositoryUpdate({ apply: !mode });
        await send(resultMessage(result));
    })
};

Object.defineProperty(command, 'resultMessage', { value: resultMessage });
module.exports = command;
