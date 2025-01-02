const fs = require('fs');
const path = require('path');

// 创建 dist 目录（如果不存在）
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// 复制 mouse_control.node
try {
    const sourceNodePath = path.join(__dirname, 'build', 'Release', 'mouse_control.node');
    const targetNodePath = path.join(__dirname, 'mouse_control.node');
    const distNodePath = path.join(distDir, 'mouse_control.node');

    // 复制到根目录
    fs.copyFileSync(sourceNodePath, targetNodePath);
    console.log('Successfully copied mouse_control.node to root directory');

    // 复制到 dist 目录
    fs.copyFileSync(sourceNodePath, distNodePath);
    console.log('Successfully copied mouse_control.node to dist directory');
} catch (err) {
    console.error('Error copying mouse_control.node:', err);
    process.exit(1);
}

// 复制 index.html
try {
    const sourceHtmlPath = path.join(__dirname, 'index.html');
    const targetHtmlPath = path.join(distDir, 'index.html');

    fs.copyFileSync(sourceHtmlPath, targetHtmlPath);
    console.log('Successfully copied index.html to dist directory');
} catch (err) {
    console.error('Error copying index.html:', err);
    process.exit(1);
} 
