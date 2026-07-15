'use strict';

class DeviceRotation {
    constructor() {
        this.devices = [
            { 
                name: 'iPhone 14 Pro', 
                browser: 'Safari', 
                os: 'iOS 16.4',
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1'
            },
            { 
                name: 'Samsung Galaxy S23', 
                browser: 'Chrome', 
                os: 'Android 13',
                userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36'
            },
            { 
                name: 'Google Pixel 7', 
                browser: 'Chrome', 
                os: 'Android 14',
                userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36'
            },
            { 
                name: 'OnePlus 11', 
                browser: 'Chrome', 
                os: 'Android 13',
                userAgent: 'Mozilla/5.0 (Linux; Android 13; OnePlus 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36'
            },
            { 
                name: 'Xiaomi 13 Pro', 
                browser: 'Chrome', 
                os: 'Android 14',
                userAgent: 'Mozilla/5.0 (Linux; Android 14; Xiaomi13Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36'
            },
            { 
                name: 'MacBook Pro', 
                browser: 'Safari', 
                os: 'macOS 14.2',
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
            },
            { 
                name: 'Windows PC', 
                browser: 'Chrome', 
                os: 'Windows 11',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Safari/537.36'
            },
            { 
                name: 'Linux PC', 
                browser: 'Firefox', 
                os: 'Ubuntu 22.04',
                userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0'
            }
        ];
        
        this.currentDeviceIndex = Math.floor(Math.random() * this.devices.length);
        this.deviceHistory = [];
        this.maxHistory = 20;
        this.rotationInterval = 30; // minutes
        this.lastRotation = Date.now();
    }

    getCurrentDevice() {
        return this.devices[this.currentDeviceIndex];
    }

    getCurrentUserAgent() {
        return this.getCurrentDevice().userAgent;
    }

    getBrowser() {
        return this.getCurrentDevice().browser;
    }

    getOS() {
        return this.getCurrentDevice().os;
    }

    getDeviceName() {
        return this.getCurrentDevice().name;
    }

    rotateDevice() {
        // Don't use the same device twice in a row
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * this.devices.length);
        } while (newIndex === this.currentDeviceIndex && this.devices.length > 1);
        
        this.currentDeviceIndex = newIndex;
        this.lastRotation = Date.now();
        
        // Track history
        this.deviceHistory.push({
            device: this.getDeviceName(),
            timestamp: this.lastRotation
        });
        
        if (this.deviceHistory.length > this.maxHistory) {
            this.deviceHistory.shift();
        }
        
        console.log(`[DeviceRotation] Rotated to: ${this.getDeviceName()} (${this.getOS()})`);
        return this.getCurrentDevice();
    }

    shouldRotate() {
        const elapsed = (Date.now() - this.lastRotation) / 60000; // minutes
        return elapsed >= this.rotationInterval;
    }

    getHistory() {
        return this.deviceHistory;
    }

    getStats() {
        return {
            currentDevice: this.getDeviceName(),
            currentOS: this.getOS(),
            currentBrowser: this.getBrowser(),
            rotationInterval: this.rotationInterval,
            lastRotation: new Date(this.lastRotation).toISOString(),
            historySize: this.deviceHistory.length,
            totalDevices: this.devices.length
        };
    }

    updateRotationInterval(minutes) {
        this.rotationInterval = minutes;
        console.log(`[DeviceRotation] Rotation interval updated to ${minutes} minutes`);
    }
}

module.exports = DeviceRotation;
