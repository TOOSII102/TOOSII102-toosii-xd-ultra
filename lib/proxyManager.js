'use strict';

const crypto = require('crypto');

class ProxyManager {
    constructor() {
        this.proxies = [];
        this.currentIndex = 0;
        this.rotationInterval = 5; // minutes
        this.lastRotation = Date.now();
        this.proxyHistory = [];
        this.maxHistory = 50;
        this.enabled = false;
    }

    loadProxies(proxyList) {
        this.proxies = proxyList.map(p => {
            if (typeof p === 'string') {
                return this.parseProxyString(p);
            }
            return p;
        }).filter(p => p !== null);
        console.log(`[ProxyManager] Loaded ${this.proxies.length} proxies`);
        this.enabled = this.proxies.length > 0;
        return this.proxies;
    }

    parseProxyString(proxyStr) {
        try {
            const url = new URL(proxyStr);
            return {
                protocol: url.protocol.replace(':', ''),
                host: url.hostname,
                port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
                auth: url.username ? { username: url.username, password: url.password } : null,
                url: proxyStr
            };
        } catch (e) {
            console.error('[ProxyManager] Invalid proxy format:', proxyStr);
            return null;
        }
    }

    getCurrentProxy() {
        if (!this.enabled || this.proxies.length === 0) return null;
        return this.proxies[this.currentIndex % this.proxies.length];
    }

    getNextProxy() {
        if (!this.enabled || this.proxies.length === 0) return null;
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        const proxy = this.getCurrentProxy();
        this.recordProxyUsage(proxy);
        return proxy;
    }

    rotateProxy() {
        return this.getNextProxy();
    }

    shouldRotate() {
        const elapsed = (Date.now() - this.lastRotation) / 60000;
        return elapsed >= this.rotationInterval;
    }

    autoRotate() {
        if (this.shouldRotate() && this.enabled) {
            this.lastRotation = Date.now();
            return this.rotateProxy();
        }
        return null;
    }

    recordProxyUsage(proxy) {
        this.proxyHistory.push({
            proxy: proxy,
            timestamp: Date.now(),
            success: true
        });
        if (this.proxyHistory.length > this.maxHistory) {
            this.proxyHistory.shift();
        }
    }

    getStats() {
        return {
            totalProxies: this.proxies.length,
            currentIndex: this.currentIndex,
            currentProxy: this.getCurrentProxy(),
            historySize: this.proxyHistory.length,
            rotationInterval: this.rotationInterval,
            enabled: this.enabled
        };
    }

    updateRotationInterval(minutes) {
        this.rotationInterval = minutes;
        console.log(`[ProxyManager] Rotation interval updated to ${minutes} minutes`);
    }

    getAxiosProxy() {
        const proxy = this.getCurrentProxy();
        if (!proxy) return null;
        return {
            protocol: proxy.protocol,
            host: proxy.host,
            port: proxy.port,
            auth: proxy.auth
        };
    }

    getBaileysProxy() {
        const proxy = this.getCurrentProxy();
        if (!proxy) return null;
        let url = `${proxy.protocol}://`;
        if (proxy.auth) {
            url += `${proxy.auth.username}:${proxy.auth.password}@`;
        }
        url += `${proxy.host}:${proxy.port}`;
        return url;
    }
}

module.exports = ProxyManager;
