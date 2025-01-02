const path = require('path');
const fs = require('fs');

// 设置进程错误处理
process.on('uncaughtException', (err) => {
    const errorMsg = `[${new Date().toISOString()}] 未捕获的异常:\n${err.stack}\n`;
    console.error(errorMsg);

    // 直接退出，让批处理脚本处理错误显示
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    const errorMsg = `[${new Date().toISOString()}] 未处理的Promise拒绝:\n${reason}\n`;
    console.error(errorMsg);
});

// 创建日志目录
const logDir = path.join(process.pkg ? path.dirname(process.execPath) : __dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 重定向控制台输出到文件
const logFile = path.join(logDir, 'app.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// 捕获控制台输出
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function () {
    const msg = `[${new Date().toISOString()}] ${Array.from(arguments).join(' ')}\n`;
    logStream.write(msg);
    originalConsoleLog.apply(console, arguments);
};

console.error = function () {
    const msg = `[${new Date().toISOString()}] ERROR: ${Array.from(arguments).join(' ')}\n`;
    logStream.write(msg);
    originalConsoleError.apply(console, arguments);
};

// 设置全局变量来存储应用根目录
global.APP_ROOT = process.pkg ? path.dirname(process.execPath) : __dirname;

// 记录启动信息
const startMsg = `[${new Date().toISOString()}] 应用启动，根目录: ${global.APP_ROOT}\n`;
logStream.write(startMsg);
console.log(startMsg);

try {
    // 启动服务器
    require('./server.js');
} catch (err) {
    console.error('启动服务器失败:', err);
    if (process.platform === 'win32') {
        console.error('\n按任意键继续...');
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', process.exit.bind(process, 1));
    } else {
        process.exit(1);
    }
}
