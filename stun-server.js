const Turn = require('node-turn');
const EventEmitter = require('events');

class StunTurnServer extends EventEmitter {
    constructor(options = {}) {
        super();
        this.port = options.port || 3478;
        this.host = options.host || '0.0.0.0';
        this.username = options.username || 'remote-mouse';
        this.credential = options.credential || 'remote-mouse-control';
        this.server = null;
        this.config = {
            listeningPort: this.port,
            listeningIps: [this.host],
            minPort: 49152,
            maxPort: 65535,
            debugLevel: 'ALL',
            authMech: 'long-term',
            realm: 'remote-mouse-control',
            credentials: {
                [this.username]: this.credential
            },
            software: 'remote-mouse-control-turn',
            maxAllocateLifetime: 3600,
            defaultLifetime: 600,
            allowLoopback: true,
            relayAddresses: ['0.0.0.0'],
            listenIps: ['0.0.0.0']
        };
    }

    setupServer() {
        this.server = new Turn(this.config);

        this.server.on('listening', (address) => {
            console.log(`STUN/TURN服务器监听 ${address.address}:${address.port}`);
            this.emit('listening', address);
        });

        this.server.on('error', (err) => {
            console.error('STUN/TURN服务器错误:', err);
            this.emit('error', err);
        });

        this.server.on('connection', (conn) => {
            console.log('新的STUN/TURN连接:', conn.remoteAddress);
            this.emit('connection', conn);
        });

        this.server.on('allocation-created', (allocation) => {
            console.log('创建新的TURN分配:', allocation);
            this.emit('allocation-created', allocation);
        });

        this.server.on('allocation-removed', (allocation) => {
            console.log('移除TURN分配:', allocation);
            this.emit('allocation-removed', allocation);
        });

        this.server.on('binding-request', (request, response) => {
            console.log('收到绑定请求:', request);
            this.emit('binding-request', request);
        });
    }

    start() {
        return new Promise((resolve, reject) => {
            try {
                this.setupServer();
                this.server.start();
                const urls = this.getServerUrl();
                console.log(`STUN/TURN服务器启动在 ${this.host}:${this.port}`);
                console.log('STUN URL:', urls.stunUrl);
                console.log('TURN URL:', urls.turnUrl);
                resolve(urls);
            } catch (err) {
                console.error('启动STUN/TURN服务器失败:', err);
                reject(err);
            }
        });
    }

    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.stop();
                console.log('STUN/TURN服务器已停止');
            }
            resolve();
        });
    }

    getServerUrl() {
        const host = this.host === '0.0.0.0' ? this.getLocalIP() : this.host;
        return {
            stunUrl: `stun:${host}:${this.port}`,
            turnUrl: `turn:${host}:${this.port}`,
            username: this.username,
            credential: this.credential
        };
    }

    getLocalIP() {
        const os = require('os');
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return '127.0.0.1';
    }
}

module.exports = StunTurnServer; 
