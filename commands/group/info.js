'use strict';

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

async function metadata(sock, ctx) {
    if (!ctx.isGroup) throw new Error('This command can only be used in a group.');
    if (typeof sock.groupMetadata !== 'function') throw new Error('Group metadata is unavailable in this connection.');
    return sock.groupMetadata(ctx.from);
}

function command(name, aliases, description, execute) {
    return { name, aliases, description, category: 'group', execute };
}

module.exports = [
    command('groupinfo', ['ginfo'], 'Show basic information about the current group.', async (sock, msg, args, ctx) => {
        try {
            const group = await metadata(sock, ctx);
            return reply(sock, msg, ctx, `Group: ${group.subject || 'Not listed'}\nMembers: ${(group.participants || []).length}\nDescription: ${(group.desc || 'Not listed').slice(0, 500)}`);
        } catch (error) { return reply(sock, msg, ctx, `Group info failed: ${error.message}`); }
    }),
    command('admins', ['groupadmins'], 'List the current group administrators.', async (sock, msg, args, ctx) => {
        try {
            const group = await metadata(sock, ctx);
            const admins = (group.participants || []).filter((participant) => participant.admin).map((participant) => participant.id || participant.lid).filter(Boolean);
            return reply(sock, msg, ctx, admins.length ? `Group admins:\n${admins.map((admin) => `• ${admin.split('@')[0].split(':')[0]}`).join('\n')}` : 'No group administrators were returned.');
        } catch (error) { return reply(sock, msg, ctx, `Admin lookup failed: ${error.message}`); }
    }),
    command('groupstats', ['gstats'], 'Show basic member and administrator counts.', async (sock, msg, args, ctx) => {
        try {
            const group = await metadata(sock, ctx);
            const participants = group.participants || [];
            const admins = participants.filter((participant) => participant.admin).length;
            return reply(sock, msg, ctx, `Group statistics\nMembers: ${participants.length}\nAdministrators: ${admins}\nCreated: ${group.creation ? new Date(group.creation * 1000).toISOString().slice(0, 10) : 'Not listed'}`);
        } catch (error) { return reply(sock, msg, ctx, `Group statistics failed: ${error.message}`); }
    })
];
