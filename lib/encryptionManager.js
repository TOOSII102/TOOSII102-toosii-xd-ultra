'use strict';

const crypto = require('crypto');

class EncryptionManager {
    constructor() {
        this.key = crypto.randomBytes(32);
        this.iv = crypto.randomBytes(16);
        this.enabled = true;
        this.methods = ['xor', 'base64', 'aes', 'hex'];
        this.currentMethod = 'aes';
        this.salt = crypto.randomBytes(16);
    }

    encryptMessage(message, method = null) {
        if (!this.enabled) return message;
        const selectedMethod = method || this.currentMethod;
        switch (selectedMethod) {
            case 'xor': return this.xorEncrypt(message);
            case 'base64': return this.base64Encode(message);
            case 'aes': return this.aesEncrypt(message);
            case 'hex': return this.hexEncode(message);
            default: return this.aesEncrypt(message);
        }
    }

    decryptMessage(encrypted, method = null) {
        if (!this.enabled) return encrypted;
        const selectedMethod = method || this.currentMethod;
        switch (selectedMethod) {
            case 'xor': return this.xorDecrypt(encrypted);
            case 'base64': return this.base64Decode(encrypted);
            case 'aes': return this.aesDecrypt(encrypted);
            case 'hex': return this.hexDecode(encrypted);
            default: return this.aesDecrypt(encrypted);
        }
    }

    xorEncrypt(message) {
        const key = this.key.slice(0, 16);
        let encrypted = '';
        for (let i = 0; i < message.length; i++) {
            encrypted += String.fromCharCode(message.charCodeAt(i) ^ key[i % key.length]);
        }
        return this.base64Encode(encrypted);
    }

    xorDecrypt(encrypted) {
        const decoded = this.base64Decode(encrypted);
        const key = this.key.slice(0, 16);
        let decrypted = '';
        for (let i = 0; i < decoded.length; i++) {
            decrypted += String.fromCharCode(decoded.charCodeAt(i) ^ key[i % key.length]);
        }
        return decrypted;
    }

    base64Encode(message) {
        return Buffer.from(message, 'utf8').toString('base64');
    }

    base64Decode(encoded) {
        return Buffer.from(encoded, 'base64').toString('utf8');
    }

    aesEncrypt(message) {
        const cipher = crypto.createCipheriv('aes-256-cbc', this.key, this.iv);
        let encrypted = cipher.update(message, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    aesDecrypt(encrypted) {
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, this.iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    hexEncode(message) {
        return Buffer.from(message, 'utf8').toString('hex');
    }

    hexDecode(encoded) {
        return Buffer.from(encoded, 'hex').toString('utf8');
    }

    rotateKey() {
        this.key = crypto.randomBytes(32);
        this.iv = crypto.randomBytes(16);
        this.salt = crypto.randomBytes(16);
        console.log('[EncryptionManager] Encryption key rotated');
    }

    setMethod(method) {
        if (this.methods.includes(method)) {
            this.currentMethod = method;
            console.log(`[EncryptionManager] Encryption method set to: ${method}`);
            return true;
        }
        return false;
    }

    toggleEncryption(state) {
        this.enabled = state !== undefined ? state : !this.enabled;
        console.log(`[EncryptionManager] Encryption ${this.enabled ? 'enabled' : 'disabled'}`);
        return this.enabled;
    }

    generateObfuscatedPayload(baseMessage) {
        const randomPrefix = crypto.randomBytes(4).toString('hex');
        const randomSuffix = crypto.randomBytes(4).toString('hex');
        const payload = `${randomPrefix}${baseMessage}${randomSuffix}`;
        return this.encryptMessage(payload);
    }

    extractPayload(encrypted) {
        const decrypted = this.decryptMessage(encrypted);
        if (decrypted.length >= 16) {
            return decrypted.substring(8, decrypted.length - 8);
        }
        return decrypted;
    }
}

module.exports = EncryptionManager;
