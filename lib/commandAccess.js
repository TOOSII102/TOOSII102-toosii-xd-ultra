'use strict';

function getCommandAccess(mode, isOwner, category) {
    if (isOwner) return { allowed: true, reason: null };
    if (mode === 'private') {
        return { allowed: false, reason: 'This bot is currently in private mode. Only the bot owner can run commands.' };
    }
    if (category === 'owner') {
        return { allowed: false, reason: 'This command is restricted to the bot owner.' };
    }
    return { allowed: true, reason: null };
}

module.exports = { getCommandAccess };
