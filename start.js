const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// 获取可执行文件的路径
const getExecutablePath = () => {
    const platform = os.platform();
    const arch = os.arch();
    const extension = platform === 'win32' ? '.exe' : '';
    const execPath = path.join(__dirname, 'dist', `remote-mouse-control-${platform}-${arch}${extension}`);

    if (!fs.existsSync(execPath)) {
        throw new Error(`可执行文件不存在: ${execPath}`);
    }

    return execPath;
};

// 启动应用
const startApp = () => {
    try {
        const execPath = getExecutablePath();
        console.log('启动应用:', execPath);

        const child = spawn(execPath, [], {
            stdio: 'inherit'
        });

        child.on('error', (err) => {
            console.error('启动失败:', err);
            process.exit(1);
        });

        child.on('exit', (code) => {
            if (code !== 0) {
                console.error(`应用异常退出，退出码: ${code}`);
                process.exit(code);
            }
        });

        process.on('SIGINT', () => {
            child.kill('SIGINT');
            process.exit();
        });
    } catch (err) {
        console.error('启动失败:', err.message);
        process.exit(1);
    }
};

startApp();
