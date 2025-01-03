const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const selfsigned = require('selfsigned');
const StunTurnServer = require('./stun-server');

// 获取正确的资源路径
function getAssetPath(relativePath) {
    const base = global.APP_ROOT || __dirname;
    return path.join(base, relativePath);
}

// 确保build目录存在
function ensureBuildDirectory() {
    const buildPath = getAssetPath('build/Release');
    try {
        if (!fs.existsSync(buildPath)) {
            fs.mkdirSync(buildPath, { recursive: true });
        }
    } catch (err) {
        console.error('创建目录失败:', err);
        // 继续执行，因为在打包后的环境中可能不需要这个目录
    }
}

// 获取本机局域网IP地址
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // 跳过内部地址和非IPv4地址
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1'; // 如果没找到，返回localhost
}

const LOCAL_IP = getLocalIP();

// 确保必要的目录存在
ensureBuildDirectory();

// 修改 mouse_control 模块的加载
const platform = process.platform;
const arch = process.arch;

console.log('当前平台:', platform, arch);
console.log('程序目录:', process.cwd());
console.log('__dirname:', __dirname);

// 获取可执行文件所在目录
const exePath = process.pkg ? process.execPath : __dirname;
const exeDir = path.dirname(exePath);
console.log('可执行文件目录:', exeDir);

// 获取native模块的搜索路径
function getNativeModulePaths() {
    const paths = [
        path.join('./mouse_control.node'),
        // 直接在可执行文件目录下查找
        path.join(exeDir, 'mouse_control.node'),
        // 在build/Release目录下查找
        path.join(exeDir, 'build', 'Release', 'mouse_control.node'),
        // 在平台特定目录下查找
        path.join(exeDir, 'build', `${platform}-${arch}`, 'mouse_control.node'),
        // 在当前工作目录下查找
        path.join(process.cwd(), 'mouse_control.node'),
        // 在上级目录的build目录下查找
        path.join(exeDir, '..', 'build', 'Release', 'mouse_control.node')
    ];

    // 添加所有可能的架构路径
    const possibleArchs = ['x64', 'x86', 'arm64'];
    for (const arch of possibleArchs) {
        paths.push(
            path.join(exeDir, 'build', `${platform}-${arch}`, 'mouse_control.node'),
            path.join(process.cwd(), 'build', `${platform}-${arch}`, 'mouse_control.node')
        );
    }

    return paths;
}

// 尝试多个可能的路径
const possiblePaths = getNativeModulePaths();

console.log('尝试加载以下路径:');
possiblePaths.forEach(p => console.log('  -', p));
console.log('当前工作目录:', process.cwd());
console.log('可执行文件目录:', exeDir);

let mouseControl;
let loadError;

// 尝试加载模块
try {
    for (const modulePath of possiblePaths) {
        try {
            console.log('尝试加载模块:', modulePath);
            // 检查文件是否存在
            if (fs.existsSync(modulePath)) {
                console.log('文件存在:', modulePath);
            } else {
                console.log('文件不存在:', modulePath);
                continue;
            }
            mouseControl = require(modulePath);
            console.log('成功加载模块:', modulePath);
            break;
        } catch (err) {
            console.log('加载失败:', modulePath, err.message);
            loadError = err;
        }
    }

    if (!mouseControl) {
        throw new Error('无法加载鼠标控制模块，所有路径都失败');
    }
} catch (err) {
    console.error('加载鼠标控制模块失败:', err);
    console.error('最后一次尝试的错误:', loadError);
    process.exit(1);
}

// 存储活跃的连接
const clients = new Map();

// 生成唯一的客户端ID
function generateClientId() {
    return crypto.randomBytes(16).toString('hex');
}

// 生成随机6位数字密码
function generatePassword() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

let sharePassword = null;
let isSharing = false;
let sharingClient = null;  // 记录哪个客户端在共享
let controllingClient = null;

// 向所有客户端广播消息
function broadcast(message, exclude = null, filter = null) {
    wss.clients.forEach(client => {
        if (client !== exclude &&
            client.readyState === WebSocket.OPEN &&
            (!filter || filter(client))) {
            client.send(JSON.stringify(message));
        }
    });
}

// 转发WebRTC信令到指定客户端
function forwardWebRTCSignal(fromClient, toClient, signal) {
    if (toClient && toClient.readyState === WebSocket.OPEN) {
        toClient.send(JSON.stringify({
            type: 'webrtc',
            signal: signal,
            from: clients.get(fromClient).id
        }));
    }
}

// 发送系统状态
function sendSystemStatus(ws) {
    ws.send(JSON.stringify({
        type: 'systemStatus',
        isSharing,
        connectedClients: clients.size,
        hasController: !!controllingClient
    }));
}

// 开始共享会话
function startSharing(ws) {
    if (isSharing) {
        ws.send(JSON.stringify({
            type: 'error',
            message: '已经有其他用户在共享中'
        }));
        return false;
    }

    isSharing = true;
    sharePassword = generatePassword();
    sharingClient = ws;

    console.log('共享已开启，密码：', sharePassword);

    // 确保密码被正确发送
    ws.send(JSON.stringify({
        type: 'sharingStarted',
        password: sharePassword,
        isSharing: true
    }));

    // 添加调试日志
    console.log('已发送共享密码:', {
        type: 'sharingStarted',
        password: sharePassword,
        isSharing: true
    });

    broadcast({
        type: 'sharingStatusChanged',
        isSharing: true
    }, ws);

    // 广播系统状态更新
    broadcast({
        type: 'systemStatus',
        isSharing: true,
        connectedClients: clients.size,
        hasController: !!controllingClient
    });

    return true;
}

// 停止共享会话
function stopSharing(ws) {
    if (ws !== sharingClient) {
        ws.send(JSON.stringify({
            type: 'error',
            message: '你不是共享发起者'
        }));
        return false;
    }

    isSharing = false;
    sharePassword = null;
    sharingClient = null;
    controllingClient = null;

    ws.send(JSON.stringify({ type: 'sharingStopped' }));
    broadcast({
        type: 'sharingStatusChanged',
        isSharing: false
    }, ws);

    // 广播系统状态更新
    broadcast({
        type: 'systemStatus',
        isSharing: false,
        connectedClients: clients.size,
        hasController: false
    });

    return true;
}

// 生成自签名证书
function generateCertificate() {
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = selfsigned.generate(attrs, {
        algorithm: 'sha256',
        days: 365,
        keySize: 2048,
        extensions: [{
            name: 'subjectAltName',
            altNames: [
                { type: 2, value: 'localhost' },
                { type: 2, value: LOCAL_IP }
            ]
        }]
    });
    return {
        key: pems.private,
        cert: pems.cert
    };
}

// 获取证书
const certificates = generateCertificate();

const httpServer = http.createServer((req, res) => {
    // 重定向到HTTPS
    res.writeHead(301, { 'Location': `https://${req.headers.host}${req.url}` });
    res.end();
});

const server = https.createServer({
    key: certificates.key,
    cert: certificates.cert
}, (req, res) => {
    if (req.url === '/') {
        fs.readFile(getAssetPath('index.html'), (err, data) => {
            if (err) {
                console.error('加载index.html失败:', err);
                res.writeHead(500);
                res.end('Error loading index.html');
                return;
            }
            try {
                const html = data.toString().replace(
                    /wss?:\/\/localhost:8080/g,
                    `wss://${LOCAL_IP}:8080`
                );
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-cache'
                });
                res.end(html);
            } catch (err) {
                console.error('处理HTML失败:', err);
                res.writeHead(500);
                res.end('Internal Server Error');
            }
        });
    } else if (req.url === '/status') {
        // 添加状态检查端点
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            isSharing,
            connectedClients: clients.size,
            hasController: !!controllingClient
        }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('客户端已连接');
    const clientId = generateClientId();
    let authenticated = false;

    // 存储客户端信息
    clients.set(ws, {
        id: clientId,
        authenticated: false,
        isSharing: false,
        isController: false
    });

    ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        isSharing: isSharing,
        sharePassword: ws === sharingClient ? sharePassword : null
    }));

    // 发送系统状态
    sendSystemStatus(ws);

    ws.on('message', (message) => {
        try {
            const command = JSON.parse(message);

            switch (command.type) {
                case 'webrtc':
                    // 转发WebRTC信令
                    if (command.to) {
                        const targetClient = Array.from(wss.clients).find(client =>
                            clients.get(client).id === command.to
                        );
                        if (targetClient) {
                            forwardWebRTCSignal(ws, targetClient, command.signal);
                        }
                    }
                    break;

                case 'startSharing':
                    startSharing(ws);
                    break;

                case 'stopSharing':
                    if (stopSharing(ws)) {
                        authenticated = false;
                    }
                    break;

                case 'authenticate':
                    if (!isSharing) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: '当前没有共享会话'
                        }));
                        return;
                    }
                    if (controllingClient && controllingClient !== ws) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: '已有其他用户在控制中'
                        }));
                        return;
                    }
                    if (command.password === sharePassword) {
                        authenticated = true;
                        controllingClient = ws;
                        clients.get(ws).isController = true;
                        ws.send(JSON.stringify({
                            type: 'authenticated',
                            sharingClientId: clients.get(sharingClient).id
                        }));
                        broadcast({
                            type: 'systemStatus',
                            isSharing,
                            connectedClients: clients.size,
                            hasController: true
                        });
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: '密码错误'
                        }));
                    }
                    break;

                case 'move':
                    if (!authenticated && !isSharing) return;
                    mouseControl.moveTo(command.x, command.y);
                    break;

                case 'click':
                    if (!authenticated && !isSharing) return;
                    mouseControl.click();
                    break;

                case 'getPosition':
                    if (!authenticated && !isSharing) return;
                    const pos = mouseControl.getPosition();
                    ws.send(JSON.stringify({
                        type: 'position',
                        x: pos.x,
                        y: pos.y
                    }));
                    break;

                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
            }
        } catch (err) {
            console.error('错误:', err);
            ws.send(JSON.stringify({
                type: 'error',
                message: err.message
            }));
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket错误:', error);
    });

    ws.on('close', () => {
        console.log('客户端已断开连接');
        const clientInfo = clients.get(ws);
        clients.delete(ws);

        if (ws === sharingClient) {
            isSharing = false;
            sharePassword = null;
            sharingClient = null;
            controllingClient = null;
            broadcast({
                type: 'sharingStatusChanged',
                isSharing: false
            });
        }

        if (ws === controllingClient) {
            controllingClient = null;
        }

        // 广播系统状态更新
        broadcast({
            type: 'systemStatus',
            isSharing,
            connectedClients: clients.size,
            hasController: !!controllingClient
        });
    });
});

const PORT = process.env.PORT || 8080;
const HTTP_PORT = process.env.HTTP_PORT || 8081;

// 启动HTTP服务器（用于重定向）
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`HTTP服务器已启动在 http://${LOCAL_IP}:${HTTP_PORT}`);
});

// 启动HTTPS服务器
server.listen(PORT, '0.0.0.0', () => {
    console.log(`远程控制服务器已启动在 https://${LOCAL_IP}:${PORT}`);
}).on('error', (err) => {
    console.error('服务器启动失败:', err);
    if (err.code === 'EADDRINUSE') {
        console.error(`端口 ${PORT} 已被占用`);
    }
    process.exit(1);
});

process.on('SIGTERM', () => {
    server.close(() => {
        console.log('服务器正常关闭');
        process.exit(0);
    });
});

// 创建STUN/TURN服务器实例
const stunServer = new StunTurnServer({
    port: 3478,
    host: '0.0.0.0',
    username: 'remote-mouse',
    credential: 'remote-mouse-control'
});

// 启动STUN服务器
let stunUrl;
let turnConfig;
stunServer.start().then(url => {
    stunUrl = url.stunUrl;
    turnConfig = {
        urls: url.turnUrl,
        username: url.username,
        credential: url.credential
    };
    console.log('STUN服务器URL:', stunUrl);
    console.log('TURN服务器配置:', turnConfig);
}).catch(err => {
    console.error('STUN/TURN服务器启动失败:', err);
}); 
