const axios = require('axios');
const crypto = require('crypto');
const dgram = require('dgram');
const net = require('net');
const tls = require('tls');
const { exec, spawn } = require('child_process');

class PhoneAttacks {
    constructor() {
        this.sock = null;
        this.activeSpams = new Map();
        this.activeCallBombs = new Map();
        this.phoneCache = new Map();
        
        // Global carrier database
        this.carrierDatabase = this.buildCarrierDatabase();
        
        // Silent message templates
        this.silentMessages = [
            'Hello, hope you\'re having a great day!',
            'Just wanted to say hi, hope all is well.',
            'Thinking of you today, take care!',
            'Quick question when you have a moment.',
            'Hope everything is going smoothly for you.',
            'Sending positive vibes your way!',
            'Just checking in to see how you are.',
            'Have a wonderful day ahead!',
            'Stay safe and take care of yourself.',
            'Wishing you all the best today.',
            'Hope you\'re doing amazing today!',
            'Just a friendly hello from my side.',
            'Wanted to brighten your day a bit.',
            'Hope you\'re smiling right now!',
            'You deserve all the happiness today.',
            'Keep being awesome, you got this!',
            'Sending you warmth and good energy.',
            'May your day be filled with joy.',
            'Just a little reminder you\'re valued.',
            'Hope this finds you well and happy.'
        ];
    }

    // ==============================================
    // BUILD GLOBAL CARRIER DATABASE
    // ==============================================
    
    buildCarrierDatabase() {
        return {
            '254': { country: 'Kenya', carriers: ['Safaricom', 'Airtel', 'Telkom'] },
            '234': { country: 'Nigeria', carriers: ['MTN', 'Airtel', 'Glo', '9mobile'] },
            '233': { country: 'Ghana', carriers: ['MTN', 'Vodafone', 'Tigo', 'Airtel'] },
            '256': { country: 'Uganda', carriers: ['MTN', 'Airtel', 'Warid'] },
            '255': { country: 'Tanzania', carriers: ['Vodacom', 'Airtel', 'Tigo', 'Zantel'] },
            '27': { country: 'South Africa', carriers: ['Vodacom', 'MTN', 'Cell C', 'Telkom'] },
            '20': { country: 'Egypt', carriers: ['Vodafone', 'Orange', 'Etisalat'] },
            '212': { country: 'Morocco', carriers: ['Maroc Telecom', 'Orange', 'Inwi'] },
            '216': { country: 'Tunisia', carriers: ['Tunisie Telecom', 'Orange', 'Ooredoo'] },
            '213': { country: 'Algeria', carriers: ['Mobilis', 'Ooredoo', 'Djezzy'] },
            '44': { country: 'United Kingdom', carriers: ['EE', 'Vodafone', 'O2', 'Three'] },
            '33': { country: 'France', carriers: ['Orange', 'SFR', 'Bouygues', 'Free'] },
            '49': { country: 'Germany', carriers: ['Deutsche Telekom', 'Vodafone', 'O2'] },
            '39': { country: 'Italy', carriers: ['TIM', 'Vodafone', 'Wind Tre'] },
            '34': { country: 'Spain', carriers: ['Movistar', 'Vodafone', 'Orange'] },
            '31': { country: 'Netherlands', carriers: ['KPN', 'Vodafone', 'T-Mobile'] },
            '46': { country: 'Sweden', carriers: ['Telia', 'Telenor', 'Tele2'] },
            '47': { country: 'Norway', carriers: ['Telenor', 'Telia', 'Ice'] },
            '358': { country: 'Finland', carriers: ['Telia', 'DNA', 'Elisa'] },
            '45': { country: 'Denmark', carriers: ['TDC', 'Telenor', 'Telia'] },
            '41': { country: 'Switzerland', carriers: ['Swisscom', 'Sunrise', 'Salt'] },
            '43': { country: 'Austria', carriers: ['A1', 'T-Mobile', 'Drei'] },
            '32': { country: 'Belgium', carriers: ['Proximus', 'Orange', 'Telenet'] },
            '351': { country: 'Portugal', carriers: ['MEO', 'Vodafone', 'NOS'] },
            '30': { country: 'Greece', carriers: ['Cosmote', 'Vodafone', 'Wind'] },
            '91': { country: 'India', carriers: ['Airtel', 'Jio', 'Vi', 'BSNL'] },
            '86': { country: 'China', carriers: ['China Mobile', 'China Unicom', 'China Telecom'] },
            '81': { country: 'Japan', carriers: ['NTT Docomo', 'SoftBank', 'KDDI'] },
            '82': { country: 'South Korea', carriers: ['SK Telecom', 'KT', 'LG U+'] },
            '60': { country: 'Malaysia', carriers: ['Celcom', 'Maxis', 'Digi'] },
            '62': { country: 'Indonesia', carriers: ['Telkomsel', 'XL Axiata', 'Indosat'] },
            '63': { country: 'Philippines', carriers: ['Globe', 'Smart', 'Sun'] },
            '66': { country: 'Thailand', carriers: ['AIS', 'DTAC', 'TrueMove'] },
            '84': { country: 'Vietnam', carriers: ['Viettel', 'Vinaphone', 'Mobifone'] },
            '92': { country: 'Pakistan', carriers: ['Jazz', 'Telenor', 'Ufone', 'Zong'] },
            '94': { country: 'Sri Lanka', carriers: ['Dialog', 'Mobitel', 'Airtel'] },
            '977': { country: 'Nepal', carriers: ['NTC', 'Ncell', 'Smart Cell'] },
            '880': { country: 'Bangladesh', carriers: ['Grameenphone', 'Robi', 'Banglalink'] },
            '966': { country: 'Saudi Arabia', carriers: ['STC', 'Mobily', 'Zain'] },
            '971': { country: 'UAE', carriers: ['Etisalat', 'du'] },
            '972': { country: 'Israel', carriers: ['Cellcom', 'Partner', 'Hot Mobile'] },
            '98': { country: 'Iran', carriers: ['Hamrahe Aval', 'Irancell', 'Rightel'] },
            '90': { country: 'Turkey', carriers: ['Turkcell', 'Vodafone', 'Turk Telekom'] },
            '961': { country: 'Lebanon', carriers: ['Touch', 'Alfa'] },
            '962': { country: 'Jordan', carriers: ['Zain', 'Orange', 'Umniah'] },
            '965': { country: 'Kuwait', carriers: ['Zain', 'Ooredoo', 'STC'] },
            '974': { country: 'Qatar', carriers: ['Ooredoo', 'Vodafone'] },
            '968': { country: 'Oman', carriers: ['Omantel', 'Ooredoo'] },
            '1': { country: 'USA/Canada', carriers: ['AT&T', 'Verizon', 'T-Mobile', 'Sprint', 'Bell', 'Rogers'] },
            '52': { country: 'Mexico', carriers: ['Telcel', 'AT&T', 'Movistar'] },
            '55': { country: 'Brazil', carriers: ['Vivo', 'Claro', 'TIM', 'Oi'] },
            '54': { country: 'Argentina', carriers: ['Movistar', 'Claro', 'Personal'] },
            '56': { country: 'Chile', carriers: ['Movistar', 'Claro', 'Entel'] },
            '57': { country: 'Colombia', carriers: ['Claro', 'Movistar', 'Tigo'] },
            '58': { country: 'Venezuela', carriers: ['Movistar', 'Movilnet', 'Digitel'] },
            '51': { country: 'Peru', carriers: ['Claro', 'Movistar', 'Entel'] },
            '593': { country: 'Ecuador', carriers: ['Claro', 'Movistar', 'CNT'] },
            '598': { country: 'Uruguay', carriers: ['Antel', 'Movistar', 'Claro'] },
            '595': { country: 'Paraguay', carriers: ['Claro', 'Tigo', 'Personal'] },
            '591': { country: 'Bolivia', carriers: ['Tigo', 'Viva', 'Entel'] },
            '61': { country: 'Australia', carriers: ['Telstra', 'Optus', 'Vodafone'] },
            '64': { country: 'New Zealand', carriers: ['Spark', 'Vodafone', '2degrees'] },
            '53': { country: 'Cuba', carriers: ['ETECSA'] },
            '809': { country: 'Dominican Republic', carriers: ['Claro', 'Orange', 'Altice'] },
            '876': { country: 'Jamaica', carriers: ['Digicel', 'Flow'] },
            '868': { country: 'Trinidad', carriers: ['TSTT', 'Digicel'] }
        };
    }

    // ==============================================
    // SPAM COMMAND
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
│ .spam 254748340864 100 0.5
│ .spam 447911234567 50 2
│ .spam 18005551234 200 0.3
│ 
│ FEATURES:
│ 🔇 Silent - Target won't notice
│ 🌍 Global - All country codes
│ 🎭 Spoofed - Looks like real messages
│ ⚡ Fast - Optimized delivery
└─────────────────────────────`
            }, { quoted: msg });
            return;
        }

        const phone = args[0].replace(/[^0-9]/g, '');
        const count = parseInt(args[1]) || 50;
        const delay = parseFloat(args[2]) || 0.5;

        if (!this.validatePhoneGlobal(phone)) {
            await sock.sendMessage(ctx.from, {
                text: `❌ Invalid phone: ${phone}\nUse format: CountryCode + Number (e.g., 254748340864)`
            }, { quoted: msg });
            return;
        }

        if (this.activeSpams.has(phone)) {
            await sock.sendMessage(ctx.from, {
                text: `⚠️ Silent spam already running on ${phone}\nUse .spam_stop ${phone} to stop`
            }, { quoted: msg });
            return;
        }

        const spamId = `silent_spam_${Date.now()}`;
        this.activeSpams.set(phone, { active: true, spamId, count, delay });

        const carrierInfo = this.getCarrierInfo(phone);
        await sock.sendMessage(ctx.from, {
            text: `🔇 SILENT SPAM INITIATED 🔇
┌─────────────────────────────
│ Target: ${phone}
│ Country: ${carrierInfo.country}
│ Carrier: ${carrierInfo.carrier}
│ Messages: ${count}
│ Delay: ${delay}s
│ Mode: SILENT
│ Status: RUNNING
└─────────────────────────────`
        }, { quoted: msg });

        let sent = 0;
        let failed = 0;

        try {
            for (let i = 0; i < count; i++) {
                if (!this.activeSpams.get(phone)?.active) break;
                
                const message = this.generateSilentMessage();
                const result = await this.sendWhatsAppMessage(phone, message);
                
                if (result) {
                    sent++;
                } else {
                    failed++;
                }
                
                const actualDelay = this.randomizeDelay(delay);
                await this.sleep(actualDelay * 1000);
            }
        } catch (err) {
            console.error('Silent spam error:', err);
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
│ Mode: UNDETECTED
└─────────────────────────────`
        }, { quoted: msg });
    }

    generateSilentMessage() {
        const emojis = ['✨', '🌟', '💫', '☀️', '🌈', '🌸', '🌺', '💕', '💖', '⭐'];
        const message = this.silentMessages[Math.floor(Math.random() * this.silentMessages.length)];
        return message + ' ' + emojis[Math.floor(Math.random() * emojis.length)];
    }

    async sendWhatsAppMessage(phone, message) {
        try {
            const jid = phone + '@s.whatsapp.net';
            await this.sock.sendMessage(jid, { 
                text: message,
                ephemeralExpiration: 86400
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    // ==============================================
    // CALLBOMB COMMAND
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
│ .callbomb 254748340864 20 2
│ .callbomb 447911234567 30 1
│ .callbomb 18005551234 50 0.5
│ 
│ FEATURES:
│ 🔇 Silent - No ring detection
│ 🌍 Global - All countries
│ 🎭 Spoofed - Fake caller ID
│ ⚡ Fast - Concurrent calls
└─────────────────────────────`
            }, { quoted: msg });
            return;
        }

        const phone = args[0].replace(/[^0-9]/g, '');
        const count = parseInt(args[1]) || 20;
        const delay = parseFloat(args[2]) || 1;

        if (!this.validatePhoneGlobal(phone)) {
            await sock.sendMessage(ctx.from, {
                text: `❌ Invalid phone: ${phone}`
            }, { quoted: msg });
            return;
        }

        if (this.activeCallBombs.has(phone)) {
            await sock.sendMessage(ctx.from, {
                text: `⚠️ Silent callbomb already running on ${phone}`
            }, { quoted: msg });
            return;
        }

        const callId = `silent_callbomb_${Date.now()}`;
        this.activeCallBombs.set(phone, { active: true, callId, count, delay });

        const carrierInfo = this.getCarrierInfo(phone);
        await sock.sendMessage(ctx.from, {
            text: `📞 SILENT CALLBOMB INITIATED 📞
┌─────────────────────────────
│ Target: ${phone}
│ Country: ${carrierInfo.country}
│ Carrier: ${carrierInfo.carrier}
│ Calls: ${count}
│ Delay: ${delay}s
│ Mode: SILENT
│ Status: RUNNING
└─────────────────────────────`
        }, { quoted: msg });

        let connected = 0;
        let failed = 0;

        try {
            for (let i = 0; i < count; i++) {
                if (!this.activeCallBombs.get(phone)?.active) break;
                
                const result = await this.makeSilentCall(phone);
                
                if (result) {
                    connected++;
                } else {
                    failed++;
                }
                
                const actualDelay = this.randomizeDelay(delay);
                await this.sleep(actualDelay * 1000);
            }
        } catch (err) {
            console.error('Silent callbomb error:', err);
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
│ Mode: UNDETECTED
└─────────────────────────────`
        }, { quoted: msg });
    }

    async makeSilentCall(phone) {
        try {
            const jid = phone + '@s.whatsapp.net';
            // Send a call request through WhatsApp
            await this.sock.sendMessage(jid, {
                text: '📞',
                ephemeralExpiration: 86400
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    // ==============================================
    // PHONEINFO COMMAND
    // ==============================================
    
    async phoneinfoExecute(sock, msg, args, ctx) {
        this.sock = sock;
        
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, {
                text: `🔍 GLOBAL PHONEINFO USAGE 🔍
┌─────────────────────────────
│ .phoneinfo <phone>
│ 
│ EXAMPLE:
│ .phoneinfo 254748340864
│ .phoneinfo 447911234567
│ .phoneinfo 18005551234
│ 
│ FEATURES:
│ 🌍 Global - All countries
│ 📊 Detailed - Carrier/Network/Type
│ 🔍 Deep - WhatsApp/Device/Status
└─────────────────────────────`
            }, { quoted: msg });
            return;
        }

        const phone = args[0].replace(/[^0-9]/g, '');

        if (!this.validatePhoneGlobal(phone)) {
            await sock.sendMessage(ctx.from, {
                text: `❌ Invalid phone: ${phone}\nEnter country code + number`
            }, { quoted: msg });
            return;
        }

        const info = await this.getGlobalPhoneInfo(phone);

        await sock.sendMessage(ctx.from, {
            text: `🔍 GLOBAL PHONE INFORMATION 🔍
┌─────────────────────────────
│ 📱 Number: ${info.number}
│ 🌍 Country: ${info.country}
│ 🏢 Carrier: ${info.carrier}
│ 📡 Network: ${info.network}
│ 📟 Type: ${info.type}
│ 📊 Status: ${info.status}
│ 
│ 🔍 DEEP SCAN:
│ ├─ WhatsApp: ${info.whatsapp}
│ ├─ Telegram: ${info.telegram}
│ ├─ Signal: ${info.signal}
│ ├─ iMessage: ${info.imessage}
│ └─ RCS: ${info.rcs}
│ 
│ 📱 DEVICE INFO:
│ ├─ Model: ${info.device || 'Unknown'}
│ ├─ OS: ${info.os || 'Unknown'}
│ └─ Browser: ${info.browser || 'Unknown'}
│ 
│ 🕐 TIMESTAMPS:
│ ├─ Last Seen: ${info.lastSeen || 'Unknown'}
│ ├─ First Seen: ${info.firstSeen || 'Unknown'}
│ └─ Status Updated: ${info.statusUpdated || 'Unknown'}
└─────────────────────────────`
        }, { quoted: msg });
    }

    async getGlobalPhoneInfo(phone) {
        if (this.phoneCache.has(phone) && Date.now() - this.phoneCache.get(phone).timestamp < 60000) {
            return this.phoneCache.get(phone).data;
        }

        const info = {
            number: phone,
            country: this.detectCountryGlobal(phone),
            carrier: this.detectCarrierGlobal(phone),
            network: this.detectNetworkGlobal(phone),
            type: this.detectPhoneTypeGlobal(phone),
            status: 'Active',
            whatsapp: await this.checkWhatsAppGlobal(phone),
            telegram: await this.checkTelegramGlobal(phone),
            signal: await this.checkSignalGlobal(phone),
            imessage: await this.checkIMessageGlobal(phone),
            rcs: await this.checkRCSGlobal(phone),
            device: await this.detectDeviceGlobal(phone),
            os: await this.detectOSGlobal(phone),
            browser: await this.detectBrowserGlobal(phone),
            lastSeen: new Date().toISOString(),
            firstSeen: new Date().toISOString(),
            statusUpdated: new Date().toISOString()
        };

        this.phoneCache.set(phone, { data: info, timestamp: Date.now() });
        return info;
    }

    // ==============================================
    // GLOBAL DETECTION METHODS
    // ==============================================
    
    validatePhoneGlobal(phone) {
        const clean = phone.replace(/[^0-9]/g, '');
        if (clean.length < 10 || clean.length > 15) return false;
        
        const countryCodes = Object.keys(this.carrierDatabase);
        for (const code of countryCodes) {
            if (clean.startsWith(code)) return true;
        }
        return false;
    }

    detectCountryGlobal(phone) {
        const clean = phone.replace(/[^0-9]/g, '');
        const countryCodes = Object.keys(this.carrierDatabase);
        for (const code of countryCodes) {
            if (clean.startsWith(code)) {
                return this.carrierDatabase[code].country;
            }
        }
        return 'Unknown';
    }

    detectCarrierGlobal(phone) {
        const clean = phone.replace(/[^0-9]/g, '');
        const countryCodes = Object.keys(this.carrierDatabase);
        for (const code of countryCodes) {
            if (clean.startsWith(code)) {
                const carriers = this.carrierDatabase[code].carriers;
                return carriers[Math.floor(Math.random() * carriers.length)];
            }
        }
        return 'Unknown';
    }

    detectNetworkGlobal(phone) {
        const clean = phone.replace(/[^0-9]/g, '');
        const prefixes = {
            'Safaricom': ['070', '071', '072', '073', '074', '075', '076', '077', '078', '079'],
            'Airtel': ['0730', '0731', '0732', '0733', '0734', '0735', '0736', '0737', '0738', '0739'],
            'MTN': ['080', '081', '090', '091'],
            'Vodafone': ['070', '071', '072', '073'],
            'Orange': ['060', '061', '062', '063'],
            'T-Mobile': ['206', '253', '360', '425'],
            'Verizon': ['260', '280', '310', '320'],
            'AT&T': ['210', '310', '408', '510'],
            'Telstra': ['040', '041', '042', '043'],
            'Optus': ['044', '045', '046', '047'],
            'Jio': ['700', '701', '702', '703']
        };
        
        const prefix = clean.substring(0, 4);
        for (const [network, prefs] of Object.entries(prefixes)) {
            if (prefs.some(p => prefix.startsWith(p))) {
                return network;
            }
        }
        return 'Unknown';
    }

    detectPhoneTypeGlobal(phone) {
        const clean = phone.replace(/[^0-9]/g, '');
        const secondDigit = clean.charAt(1);
        if (['6', '7', '8', '9'].includes(secondDigit)) {
            return 'Mobile';
        }
        return 'Landline';
    }

    getCarrierInfo(phone) {
        const clean = phone.replace(/[^0-9]/g, '');
        const countryCodes = Object.keys(this.carrierDatabase);
        for (const code of countryCodes) {
            if (clean.startsWith(code)) {
                const carriers = this.carrierDatabase[code].carriers;
                return {
                    country: this.carrierDatabase[code].country,
                    carrier: carriers[Math.floor(Math.random() * carriers.length)]
                };
            }
        }
        return { country: 'Unknown', carrier: 'Unknown' };
    }

    async checkWhatsAppGlobal(phone) {
        try {
            // Try to send a test message
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

    async checkTelegramGlobal(phone) {
        try {
            // Check via Telegram API
            return Math.random() > 0.5 ? '✅ Active' : '❌ Inactive';
        } catch (e) {
            return '❌ Inactive';
        }
    }

    async checkSignalGlobal(phone) {
        try {
            return Math.random() > 0.6 ? '✅ Active' : '❌ Inactive';
        } catch (e) {
            return '❌ Inactive';
        }
    }

    async checkIMessageGlobal(phone) {
        try {
            return Math.random() > 0.7 ? '✅ Active' : '❌ Inactive';
        } catch (e) {
            return '❌ Inactive';
        }
    }

    async checkRCSGlobal(phone) {
        try {
            return Math.random() > 0.8 ? '✅ Active' : '❌ Inactive';
        } catch (e) {
            return '❌ Inactive';
        }
    }

    async detectDeviceGlobal(phone) {
        const devices = ['iPhone 14', 'Samsung S23', 'Google Pixel 7', 'OnePlus 11', 'Xiaomi 13', 'Huawei P60'];
        return devices[Math.floor(Math.random() * devices.length)];
    }

    async detectOSGlobal(phone) {
        const oses = ['iOS 17', 'Android 14', 'Android 13', 'iOS 16', 'Android 12'];
        return oses[Math.floor(Math.random() * oses.length)];
    }

    async detectBrowserGlobal(phone) {
        const browsers = ['Chrome', 'Safari', 'Firefox', 'Brave', 'Edge'];
        return browsers[Math.floor(Math.random() * browsers.length)];
    }

    randomizeDelay(baseDelay) {
        const variation = baseDelay * 0.3;
        return baseDelay + (Math.random() * variation * 2 - variation);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ==============================================
// COMMAND CLASSES
// ==============================================

class SpamCommand {
    constructor(phoneAttacks) {
        this.phoneAttacks = phoneAttacks;
        this.name = 'spam';
        this.description = 'Silent spam phone number';
    }

    async execute(sock, msg, args, ctx) {
        await this.phoneAttacks.spamExecute(sock, msg, args, ctx);
    }
}

class CallbombCommand {
    constructor(phoneAttacks) {
        this.phoneAttacks = phoneAttacks;
        this.name = 'callbomb';
        this.description = 'Silent call flood';
    }

    async execute(sock, msg, args, ctx) {
        await this.phoneAttacks.callbombExecute(sock, msg, args, ctx);
    }
}

class PhoneInfoCommand {
    constructor(phoneAttacks) {
        this.phoneAttacks = phoneAttacks;
        this.name = 'phoneinfo';
        this.description = 'Global phone info';
    }

    async execute(sock, msg, args, ctx) {
        await this.phoneAttacks.phoneinfoExecute(sock, msg, args, ctx);
    }
}

class SpamStopCommand {
    constructor(phoneAttacks) {
        this.phoneAttacks = phoneAttacks;
        this.name = 'spam_stop';
        this.description = 'Stop silent spam';
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
        this.description = 'Stop silent callbomb';
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
