'use strict';

const crypto = require('crypto');

class FingerprintManager {
    constructor() {
        this.fingerprints = this.buildFingerprintDatabase();
        this.currentIndex = Math.floor(Math.random() * this.fingerprints.length);
        this.history = [];
        this.maxHistory = 20;
        this.rotationInterval = 15;
        this.lastRotation = Date.now();
        this.rotationCount = 0;
    }

    buildFingerprintDatabase() {
        return [
            {
                name: 'iPhone 14 Pro',
                os: 'iOS 16.4',
                browser: 'Safari',
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
                platform: 'iPhone',
                languages: ['en-US', 'en'],
                screenResolution: '2532x1170',
                timezone: 'America/New_York',
                deviceMemory: 6,
                hardwareConcurrency: 6
            },
            {
                name: 'iPhone 15 Pro Max',
                os: 'iOS 17.2',
                browser: 'Safari',
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
                platform: 'iPhone',
                languages: ['en-US', 'en-GB'],
                screenResolution: '2796x1290',
                timezone: 'Europe/London',
                deviceMemory: 8,
                hardwareConcurrency: 8
            },
            {
                name: 'Samsung Galaxy S23 Ultra',
                os: 'Android 13',
                browser: 'Chrome',
                userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
                platform: 'Android',
                languages: ['en-US', 'en'],
                screenResolution: '3088x1440',
                timezone: 'America/Los_Angeles',
                deviceMemory: 12,
                hardwareConcurrency: 8
            },
            {
                name: 'Samsung Galaxy S24',
                os: 'Android 14',
                browser: 'Chrome',
                userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.164 Mobile Safari/537.36',
                platform: 'Android',
                languages: ['en-US', 'en'],
                screenResolution: '3120x1440',
                timezone: 'America/Chicago',
                deviceMemory: 12,
                hardwareConcurrency: 8
            },
            {
                name: 'Google Pixel 8 Pro',
                os: 'Android 14',
                browser: 'Chrome',
                userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.164 Mobile Safari/537.36',
                platform: 'Android',
                languages: ['en-US', 'en'],
                screenResolution: '2992x1344',
                timezone: 'America/Denver',
                deviceMemory: 12,
                hardwareConcurrency: 8
            },
            {
                name: 'OnePlus 12',
                os: 'Android 14',
                browser: 'Chrome',
                userAgent: 'Mozilla/5.0 (Linux; Android 14; OnePlus 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.164 Mobile Safari/537.36',
                platform: 'Android',
                languages: ['en-US', 'en'],
                screenResolution: '3168x1440',
                timezone: 'America/Phoenix',
                deviceMemory: 12,
                hardwareConcurrency: 8
            },
            {
                name: 'Xiaomi 14 Pro',
                os: 'Android 14',
                browser: 'Chrome',
                userAgent: 'Mozilla/5.0 (Linux; Android 14; Xiaomi14Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.164 Mobile Safari/537.36',
                platform: 'Android',
                languages: ['en-US', 'en'],
                screenResolution: '3200x1440',
                timezone: 'Asia/Shanghai',
                deviceMemory: 12,
                hardwareConcurrency: 8
            },
            {
                name: 'MacBook Pro M3',
                os: 'macOS 14.3',
                browser: 'Safari',
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
                platform: 'MacIntel',
                languages: ['en-US', 'en'],
                screenResolution: '3024x1964',
                timezone: 'America/New_York',
                deviceMemory: 16,
                hardwareConcurrency: 12
            },
            {
                name: 'MacBook Air M2',
                os: 'macOS 14.2',
                browser: 'Safari',
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
                platform: 'MacIntel',
                languages: ['en-US', 'en'],
                screenResolution: '2560x1664',
                timezone: 'America/Los_Angeles',
                deviceMemory: 16,
                hardwareConcurrency: 8
            },
            {
                name: 'Windows 11 PC',
                os: 'Windows 11',
                browser: 'Chrome',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Safari/537.36',
                platform: 'Win32',
                languages: ['en-US', 'en'],
                screenResolution: '1920x1080',
                timezone: 'America/New_York',
                deviceMemory: 16,
                hardwareConcurrency: 16
            },
            {
                name: 'Windows 11 PC (Edge)',
                os: 'Windows 11',
                browser: 'Edge',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Safari/537.36 Edg/120.0.2210.133',
                platform: 'Win32',
                languages: ['en-US', 'en'],
                screenResolution: '1920x1080',
                timezone: 'America/Chicago',
                deviceMemory: 32,
                hardwareConcurrency: 16
            },
            {
                name: 'Ubuntu 22.04 (Firefox)',
                os: 'Linux',
                browser: 'Firefox',
                userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
                platform: 'Linux x86_64',
                languages: ['en-US', 'en'],
                screenResolution: '2560x1440',
                timezone: 'Europe/London',
                deviceMemory: 16,
                hardwareConcurrency: 12
            },
            {
                name: 'Ubuntu 22.04 (Chrome)',
                os: 'Linux',
                browser: 'Chrome',
                userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Safari/537.36',
                platform: 'Linux x86_64',
                languages: ['en-US', 'en'],
                screenResolution: '2560x1440',
                timezone: 'America/Los_Angeles',
                deviceMemory: 32,
                hardwareConcurrency: 16
            }
        ];
    }

    getCurrentFingerprint() {
        return this.fingerprints[this.currentIndex];
    }

    getCurrentUserAgent() {
        return this.getCurrentFingerprint().userAgent;
    }

    getCurrentOS() {
        return this.getCurrentFingerprint().os;
    }

    getCurrentBrowser() {
        return this.getCurrentFingerprint().browser;
    }

    getCurrentDeviceName() {
        return this.getCurrentFingerprint().name;
    }

    getFullFingerprint() {
        return { ...this.getCurrentFingerprint() };
    }

    rotateFingerprint() {
        let newIndex;
        let attempts = 0;
        const maxAttempts = 10;
        do {
            newIndex = Math.floor(Math.random() * this.fingerprints.length);
            attempts++;
        } while (newIndex === this.currentIndex && this.fingerprints.length > 1 && attempts < maxAttempts);
        
        this.currentIndex = newIndex;
        this.lastRotation = Date.now();
        this.rotationCount++;
        
        this.history.push({
            fingerprint: this.getCurrentDeviceName(),
            timestamp: this.lastRotation,
            userAgent: this.getCurrentUserAgent()
        });
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        
        console.log(`[FingerprintManager] Rotated to: ${this.getCurrentDeviceName()} (${this.getCurrentOS()})`);
        return this.getCurrentFingerprint();
    }

    shouldRotate() {
        const elapsed = (Date.now() - this.lastRotation) / 60000;
        return elapsed >= this.rotationInterval;
    }

    autoRotate() {
        if (this.shouldRotate()) {
            return this.rotateFingerprint();
        }
        return null;
    }

    getStats() {
        return {
            currentDevice: this.getCurrentDeviceName(),
            currentOS: this.getCurrentOS(),
            currentBrowser: this.getCurrentBrowser(),
            rotationInterval: this.rotationInterval,
            lastRotation: new Date(this.lastRotation).toISOString(),
            historySize: this.history.length,
            totalFingerprints: this.fingerprints.length,
            rotationCount: this.rotationCount
        };
    }

    updateRotationInterval(minutes) {
        this.rotationInterval = minutes;
        console.log(`[FingerprintManager] Rotation interval updated to ${minutes} minutes`);
    }

    getPlugins() {
        const plugins = ['Chrome PDF Plugin', 'Chrome PDF Viewer', 'Native Client'];
        return plugins.slice(0, Math.floor(Math.random() * 3) + 1);
    }

    getCanvasFingerprint() {
        return crypto.randomBytes(16).toString('hex');
    }

    getWebGLFingerprint() {
        return crypto.randomBytes(8).toString('hex');
    }
}

module.exports = FingerprintManager;
