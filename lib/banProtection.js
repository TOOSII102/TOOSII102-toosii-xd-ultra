'use strict';

const fs = require('fs');
const path = require('path');

class BanProtection {
    constructor() {
        this.banList = new Map();
        this.warningLog = [];
        this.blacklist = new Set();
        this.whitelist = new Set();
        this.BAN_FILE = path.join(__dirname, '..', 'data', 'bans.json');
        this.loadBans();
    }

    loadBans() {
        try {
            if (fs.existsSync(this.BAN_FILE)) {
                const data = JSON.parse(fs.readFileSync(this.BAN_FILE, 'utf8'));
                this.blacklist = new Set(data.blacklist || []);
                this.whitelist = new Set(data.whitelist || []);
                console.log(`[BanProtection] Loaded ${this.blacklist.size} blacklisted numbers`);
            }
        } catch (e) {
            console.error('[BanProtection] Failed to load bans:', e.message);
        }
    }

    saveBans() {
        try {
            const data = {
                blacklist: [...this.blacklist],
                whitelist: [...this.whitelist],
                timestamp: Date.now()
            };
            const dir = path.dirname(this.BAN_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.BAN_FILE, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('[BanProtection] Failed to save bans:', e.message);
        }
    }

    isBanned(phone) {
        return this.blacklist.has(phone);
    }

    isWhitelisted(phone) {
        return this.whitelist.has(phone);
    }

    addToBlacklist(phone, reason = 'Suspicious activity') {
        this.blacklist.add(phone);
        this.saveBans();
        console.log(`[BanProtection] Added ${phone} to blacklist - ${reason}`);
    }

    addToWhitelist(phone) {
        this.whitelist.add(phone);
        this.blacklist.delete(phone);
        this.saveBans();
        console.log(`[BanProtection] Added ${phone} to whitelist`);
    }

    removeFromBlacklist(phone) {
        this.blacklist.delete(phone);
        this.saveBans();
        console.log(`[BanProtection] Removed ${phone} from blacklist`);
    }

    checkAndBlock(phone, action, details = '') {
        if (this.isBanned(phone)) {
            console.log(`[BanProtection] Blocked ${phone} - ${action} (banned)`);
            return false;
        }

        if (this.isWhitelisted(phone)) {
            console.log(`[BanProtection] Allowed ${phone} - ${action} (whitelisted)`);
            return true;
        }

        return true;
    }

    getStats() {
        return {
            blacklistSize: this.blacklist.size,
            whitelistSize: this.whitelist.size,
            warningLogSize: this.warningLog.length
        };
    }
}

module.exports = BanProtection;
