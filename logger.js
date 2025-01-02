const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.logPath = path.join(this.logDir, 'app.log');

        // 确保日志目录存在
        if (!fs.existsSync(this.logDir)) {
            try {
                fs.mkdirSync(this.logDir, { recursive: true });
            } catch (err) {
                console.error('创建日志目录失败:', err);
            }
        }
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${type}] ${message}\n`;

        // 同时输出到控制台和文件
        console.log(logMessage);
        try {
            fs.appendFileSync(this.logPath, logMessage);
        } catch (err) {
            console.error('写入日志文件失败:', err);
        }
    }

    error(message) {
        this.log(message, 'ERROR');
    }

    info(message) {
        this.log(message, 'INFO');
    }
}

module.exports = new Logger();
