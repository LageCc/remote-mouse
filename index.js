const path = require('path');
const fs = require('fs');

// 设置进程错误处理
process.on('uncaughtException', (err) => {
    const errorMsg = `[${new Date().toISOString()}] 未捕获的异常:\n${err.stack}\n`;
    console.error(errorMsg);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    const errorMsg = `[${new Date().toISOString()}] 未处理的Promise拒绝:\n${reason}\n`;
    console.error(errorMsg);
});

// 设置全局变量来存储应用根目录
global.APP_ROOT = process.pkg ? path.dirname(process.execPath) : __dirname;

// 记录启动信息
const startMsg = `[${new Date().toISOString()}] 应用启动，根目录: ${global.APP_ROOT}\n`;
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
