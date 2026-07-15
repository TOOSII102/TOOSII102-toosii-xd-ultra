'use strict';

const crypto = require('crypto');

class AntiDetection {
    constructor() {
        // Human typing patterns (milliseconds per character)
        this.typingSpeeds = {
            slow: [150, 180, 200, 220, 250],
            medium: [80, 100, 120, 140, 160],
            fast: [40, 50, 60, 70, 80]
        };
        
        // Natural reading delays
        this.readDelays = {
            short: [1000, 2000, 3000],
            medium: [4000, 5000, 6000, 7000],
            long: [8000, 10000, 12000, 15000]
        };
        
        // Message templates that look human
        this.messageTemplates = this.buildMessageTemplates();
        
        // Emoji sets for natural messages
        this.emojis = ['😊', '😂', '🔥', '💪', '🙌', '✨', '💯', '🎯', '🚀', '⭐', '❤️', '👍', '👋', '🤝', '💙', '💜', '🧡', '💛', '💚', '🖤'];
        
        // User agents to rotate
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0'
        ];
        
        // Rate limit tracking
        this.rateLimits = new Map();
        this.messageHistory = new Map();
        this.sessionData = new Map();
        
        // Stealth configuration
        this.config = {
            maxMessagesPerMinute: 15,
            maxCallsPerMinute: 3,
            minDelayBetweenMessages: 3000,
            maxDelayBetweenMessages: 8000,
            minDelayBetweenCalls: 10000,
            maxDelayBetweenCalls: 20000,
            enableTypingSimulation: true,
            enableReadReceipts: true,
            enableRandomDelays: true,
            enableMessageVariation: true,
            enableEmojiUsage: true,
            enablePresenceUpdates: true,
            enableBatchSpreading: true,
            safetyBuffer: 0.3 // 30% safety margin
        };
    }

    // ==============================================
    // BUILD HUMAN-LIKE MESSAGE TEMPLATES
    // ==============================================
    buildMessageTemplates() {
        const templates = [];
        
        const greetings = ['Hey', 'Hi', 'Hello', 'Yo', 'Sup', 'Hey there', 'Hi there', 'Good morning', 'Good evening', 'Howdy'];
        const questions = ['how are you?', 'what\'s up?', 'how\'s it going?', 'you good?', 'all good?', 'what\'s new?', 'how have you been?', 'you busy?', 'what\'s happening?'];
        const statements = ['Just checking in', 'Wanted to say hi', 'Thinking of you', 'Hope you\'re well', 'Stay safe', 'Take care', 'Have a great day', 'Wishing you well'];
        const closings = ['Cheers', 'Later', 'Peace', 'Take care', 'See ya', 'Cya', 'Talk soon', 'Catch you later'];
        
        for (const g of greetings) {
            templates.push(g);
            templates.push(g + ' ' + questions[Math.floor(Math.random() * questions.length)]);
            templates.push(g + ', ' + statements[Math.floor(Math.random() * statements.length)]);
            templates.push(g + ' ' + closings[Math.floor(Math.random() * closings.length)]);
        }
        
        for (const s of statements) {
            templates.push(s);
            templates.push(s + ' ' + emojis[Math.floor(Math.random() * emojis.length)]);
        }
        
        return templates;
    }

    // ==============================================
    // GENERATE NATURAL DELAY
    // ==============================================
    getNaturalDelay(type = 'message') {
        const config = this.config;
        if (type === 'message') {
            return Math.floor(Math.random() * (config.maxDelayBetweenMessages - config.minDelayBetweenMessages + 1)) + config.minDelayBetweenMessages;
        } else if (type === 'call') {
            return Math.floor(Math.random() * (config.maxDelayBetweenCalls - config.minDelayBetweenCalls + 1)) + config.minDelayBetweenCalls;
        }
        return Math.floor(Math.random() * 5000) + 1000;
    }

    // ==============================================
    // GENERATE TYPING DELAY
    // ==============================================
    getTypingDelay(messageLength) {
        const speedLevels = ['slow', 'medium', 'fast'];
        const level = speedLevels[Math.floor(Math.random() * speedLevels.length)];
        const speeds = this.typingSpeeds[level];
        const baseSpeed = speeds[Math.floor(Math.random() * speeds.length)];
        
        // Calculate words (approx 5 chars per word)
        const words = Math.max(1, Math.ceil(messageLength / 5));
        
        // Add random variation
        const variation = 0.8 + Math.random() * 0.4;
        return Math.floor(words * baseSpeed * variation);
    }

    // ==============================================
    // GENERATE READ RECEIPT DELAY
    // ==============================================
    getReadReceiptDelay() {
        const levels = ['short', 'medium', 'long'];
        const level = levels[Math.floor(Math.random() * levels.length)];
        const delays = this.readDelays[level];
        return delays[Math.floor(Math.random() * delays.length)];
    }

    // ==============================================
    // GENERATE NATURAL MESSAGE
    // ==============================================
    generateNaturalMessage(phone, context = {}) {
        let message = this.messageTemplates[Math.floor(Math.random() * this.messageTemplates.length)];
        
        // Add emoji randomly
        if (this.config.enableEmojiUsage && Math.random() > 0.6) {
            const emoji = this.emojis[Math.floor(Math.random() * this.emojis.length)];
            if (Math.random() > 0.5) {
                message = emoji + ' ' + message;
            } else {
                message = message + ' ' + emoji;
            }
        }
        
        // Add variation based on context
        if (context.previousMessages && context.previousMessages.length > 0) {
            // Sometimes reference previous conversation
            if (Math.random() > 0.8) {
                const prev = context.previousMessages[context.previousMessages.length - 1];
                if (prev && prev.length > 0) {
                    const responses = ['Yeah, exactly!', 'I agree!', 'That\'s true.', 'Good point!', 'Makes sense.', 'For sure!', 'Definitely!'];
                    message = responses[Math.floor(Math.random() * responses.length)] + ' ' + message;
                }
            }
        }
        
        // Track message history
        if (!this.messageHistory.has(phone)) {
            this.messageHistory.set(phone, []);
        }
        const history = this.messageHistory.get(phone);
        history.push({ message, timestamp: Date.now() });
        if (history.length > 100) history.shift();
        
        return message;
    }

    // ==============================================
    // GET ROTATING USER AGENT
    // ==============================================
    getUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    // ==============================================
    // RATE LIMIT TRACKING
    // ==============================================
    trackRateLimit(phone, action) {
        const key = `${phone}_${action}`;
        const now = Date.now();
        
        if (!this.rateLimits.has(key)) {
            this.rateLimits.set(key, []);
        }
        
        const timestamps = this.rateLimits.get(key);
        timestamps.push(now);
        
        // Keep only last 5 minutes
        const recent = timestamps.filter(t => now - t < 300000);
        this.rateLimits.set(key, recent);
        
        return recent.length;
    }

    // ==============================================
    // CHECK RATE LIMIT
    // ==============================================
    isRateLimited(phone, action) {
        const config = this.config;
        const key = `${phone}_${action}`;
        const now = Date.now();
        
        if (!this.rateLimits.has(key)) return false;
        
        const timestamps = this.rateLimits.get(key);
        const recent = timestamps.filter(t => now - t < 60000);
        
        if (action === 'message') {
            return recent.length >= config.maxMessagesPerMinute;
        } else if (action === 'call') {
            return recent.length >= config.maxCallsPerMinute;
        }
        
        return false;
    }

    // ==============================================
    // SIMULATE HUMAN BEHAVIOR
    // ==============================================
    async simulateHumanBehavior(sock, phone, action = 'typing') {
        const config = this.config;
        
        if (!config.enablePresenceUpdates) return;
        
        try {
            if (action === 'typing' && config.enableTypingSimulation) {
                // Show typing
                await sock.sendPresenceUpdate('composing', phone);
                const typingTime = this.getTypingDelay(20 + Math.random() * 50);
                await this.sleep(Math.min(typingTime, 5000));
                await sock.sendPresenceUpdate('paused', phone);
            } else if (action === 'read' && config.enableReadReceipts) {
                // Simulate reading
                await this.sleep(this.getReadReceiptDelay());
            } else if (action === 'online') {
                // Show online/available
                await sock.sendPresenceUpdate('available', phone);
                await this.sleep(Math.random() * 3000 + 1000);
            }
        } catch (e) {
            // Silently fail - don't let presence errors break the flow
        }
    }

    // ==============================================
    // SEND MESSAGE WITH STEALTH
    // ==============================================
    async sendStealthMessage(sock, phone, message, options = {}) {
        const config = this.config;
        
        // Default options
        const {
            simulateTyping = config.enableTypingSimulation,
            randomDelay = config.enableRandomDelays,
            useNaturalTemplate = config.enableMessageVariation,
            trackRateLimit = true,
            addEmoji = config.enableEmojiUsage,
            simulateRead = config.enableReadReceipts
        } = options;

        // Check rate limits
        if (trackRateLimit && this.isRateLimited(phone, 'message')) {
            throw new Error(`Rate limit exceeded for ${phone}`);
        }

        // Generate natural message if needed
        let finalMessage = message;
        if (useNaturalTemplate && (!message || message.length < 3)) {
            const context = {
                previousMessages: this.messageHistory.get(phone) || []
            };
            finalMessage = this.generateNaturalMessage(phone, context);
        }

        // Add random delay before sending
        if (randomDelay) {
            const delay = this.getNaturalDelay('message');
            await this.sleep(delay);
        }

        // Simulate human behavior
        if (simulateTyping) {
            await this.simulateHumanBehavior(sock, phone, 'typing');
        }

        // Add presence update
        if (Math.random() > 0.7) {
            await this.simulateHumanBehavior(sock, phone, 'online');
        }

        // Track rate limit
        if (trackRateLimit) {
            this.trackRateLimit(phone, 'message');
        }

        // Send the message
        try {
            const jid = phone + '@s.whatsapp.net';
            const result = await sock.sendMessage(jid, {
                text: finalMessage,
                ephemeralExpiration: 86400 // Auto-delete after 24 hours
            });
            
            // Simulate read receipt after sending (if enabled)
            if (simulateRead && Math.random() > 0.5) {
                await this.simulateHumanBehavior(sock, phone, 'read');
            }
            
            // Add post-send delay
            await this.sleep(this.getNaturalDelay('message') / 3);
            
            return { success: true, message: finalMessage, result };
        } catch (error) {
            console.error('[Stealth] Send failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ==============================================
    // SEND BATCH WITH STEALTH
    // ==============================================
    async sendStealthBatch(sock, phone, messages, options = {}) {
        const config = this.config;
        
        const {
            delayBetween = this.getNaturalDelay('message'),
            randomSpread = config.enableRandomDelays,
            simulateTyping = config.enableTypingSimulation,
            trackRateLimit = true,
            maxPerBatch = config.maxMessagesPerMinute,
            safetyMargin = config.safetyBuffer
        } = options;

        // Don't exceed rate limits
        const safeCount = Math.min(messages.length, maxPerBatch * (1 - safetyMargin));
        const messagesToSend = messages.slice(0, Math.floor(safeCount));
        
        const results = [];
        const baseDelay = delayBetween;

        for (let i = 0; i < messagesToSend.length; i++) {
            // Check rate limit before each send
            if (trackRateLimit && this.isRateLimited(phone, 'message')) {
                console.log(`[Stealth] Rate limit reached, stopping batch at ${i} messages`);
                break;
            }

            // Calculate delay with random spread
            let delay = baseDelay;
            if (randomSpread) {
                const spread = 0.5 + Math.random();
                delay = baseDelay * spread;
            }

            // Add longer pauses periodically (every 3-5 messages)
            if (i > 0 && i % Math.floor(3 + Math.random() * 3) === 0) {
                delay += this.getNaturalDelay('message') * (0.5 + Math.random());
            }

            // Add extra delay if we're getting close to rate limit
            const recentCount = this.isRateLimited(phone, 'message');
            if (recentCount > config.maxMessagesPerMinute * 0.7) {
                delay *= 1.5;
            }

            await this.sleep(delay);

            // Send with stealth
            const result = await this.sendStealthMessage(sock, phone, messagesToSend[i], {
                simulateTyping: i % 2 === 0,
                randomDelay: false, // We already added delay
                useNaturalTemplate: false,
                trackRateLimit: false,
                addEmoji: i % 3 === 0,
                simulateRead: i % 4 === 0
            });

            results.push(result);
        }

        return results;
    }

    // ==============================================
    // MAKE STEALTH CALL
    // ==============================================
    async makeStealthCall(sock, phone, options = {}) {
        const config = this.config;
        
        const {
            simulateTyping = true,
            randomDelay = config.enableRandomDelays,
            trackRateLimit = true,
            callDuration = 1000 + Math.random() * 3000
        } = options;

        // Check rate limits
        if (trackRateLimit && this.isRateLimited(phone, 'call')) {
            throw new Error(`Rate limit exceeded for ${phone}`);
        }

        // Add random delay before call
        if (randomDelay) {
            const delay = this.getNaturalDelay('call');
            await this.sleep(delay);
        }

        // Simulate human behavior
        if (simulateTyping && Math.random() > 0.5) {
            await this.simulateHumanBehavior(sock, phone, 'typing');
        }

        // Track rate limit
        if (trackRateLimit) {
            this.trackRateLimit(phone, 'call');
        }

        try {
            const jid = phone + '@s.whatsapp.net';
            
            // Send a call request (WhatsApp doesn't have direct call API)
            // We use a message that looks like a call request
            const callMessages = [
                '📞 Calling...',
                '📱 Ringing...',
                '🔔 Incoming call...',
                '📞 Missed call?',
                '📲 Call me back?'
            ];
            
            const callMessage = callMessages[Math.floor(Math.random() * callMessages.length)];
            
            const result = await sock.sendMessage(jid, {
                text: callMessage,
                ephemeralExpiration: 86400
            });
            
            // Simulate call duration
            await this.sleep(callDuration);
            
            // Send "call ended" message
            if (Math.random() > 0.7) {
                await this.sleep(1000 + Math.random() * 2000);
                await sock.sendMessage(jid, {
                    text: '📞 Call ended',
                    ephemeralExpiration: 86400
                });
            }
            
            return { success: true, duration: callDuration };
        } catch (error) {
            console.error('[Stealth] Call failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ==============================================
    // MAKE STEALTH CALL BATCH
    // ==============================================
    async makeStealthCallBatch(sock, phone, count, options = {}) {
        const config = this.config;
        
        const {
            delayBetween = this.getNaturalDelay('call'),
            randomSpread = config.enableRandomDelays,
            trackRateLimit = true,
            maxPerBatch = config.maxCallsPerMinute,
            safetyMargin = config.safetyBuffer
        } = options;

        // Don't exceed rate limits
        const safeCount = Math.min(count, maxPerBatch * (1 - safetyMargin));
        const results = [];
        const baseDelay = delayBetween;

        for (let i = 0; i < safeCount; i++) {
            // Check rate limit before each call
            if (trackRateLimit && this.isRateLimited(phone, 'call')) {
                console.log(`[Stealth] Rate limit reached, stopping at ${i} calls`);
                break;
            }

            // Calculate delay with random spread
            let delay = baseDelay;
            if (randomSpread) {
                const spread = 0.5 + Math.random();
                delay = baseDelay * spread;
            }

            // Add longer pauses periodically
            if (i > 0 && i % Math.floor(2 + Math.random() * 2) === 0) {
                delay += this.getNaturalDelay('call') * (0.5 + Math.random());
            }

            await this.sleep(delay);

            // Make stealth call
            const result = await this.makeStealthCall(sock, phone, {
                simulateTyping: i % 2 === 0,
                randomDelay: false,
                trackRateLimit: false,
                callDuration: 1000 + Math.random() * 3000 + (i * 200)
            });

            results.push(result);
        }

        return results;
    }

    // ==============================================
    // GET STEALTH STATISTICS
    // ==============================================
    getStats() {
        const stats = {
            totalMessages: 0,
            totalCalls: 0,
            rateLimits: {},
            messageHistory: this.messageHistory.size,
            activeSessions: this.sessionData.size
        };

        for (const [key, timestamps] of this.rateLimits) {
            const [phone, action] = key.split('_');
            if (!stats.rateLimits[phone]) {
                stats.rateLimits[phone] = { messages: 0, calls: 0 };
            }
            stats.rateLimits[phone][action] = timestamps.length;
            if (action === 'message') stats.totalMessages += timestamps.length;
            if (action === 'call') stats.totalCalls += timestamps.length;
        }

        return stats;
    }

    // ==============================================
    // RESET RATE LIMITS (call after ban risk)
    // ==============================================
    resetRateLimits(phone) {
        if (phone) {
            for (const [key] of this.rateLimits) {
                if (key.startsWith(phone)) {
                    this.rateLimits.delete(key);
                }
            }
        } else {
            this.rateLimits.clear();
        }
        console.log('[Stealth] Rate limits reset');
    }

    // ==============================================
    // UTILITY: SLEEP
    // ==============================================
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==============================================
    // UPDATE CONFIG
    // ==============================================
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[Stealth] Config updated');
    }

    // ==============================================
    // GET SAFE PARAMETERS
    // ==============================================
    getSafeParams(action, count) {
        const config = this.config;
        let maxCount;
        let minDelay;
        let maxDelay;
        
        if (action === 'message') {
            maxCount = config.maxMessagesPerMinute;
            minDelay = config.minDelayBetweenMessages;
            maxDelay = config.maxDelayBetweenMessages;
        } else if (action === 'call') {
            maxCount = config.maxCallsPerMinute;
            minDelay = config.minDelayBetweenCalls;
            maxDelay = config.maxDelayBetweenCalls;
        }
        
        const safeCount = Math.min(count, Math.floor(maxCount * (1 - config.safetyBuffer)));
        const safeDelay = Math.max(minDelay, minDelay + Math.random() * (maxDelay - minDelay));
        
        return { safeCount, safeDelay };
    }
}

module.exports = AntiDetection;
