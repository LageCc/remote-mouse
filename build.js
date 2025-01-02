const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const platform = process.platform;
const arch = process.arch;

// 检查文件是否存在
function checkFile(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch (err) {
        console.error(`检查文件失败 ${filePath}:`, err);
        return false;
    }
}

// 安全复制文件
function safeCopyFile(src, dest) {
    try {
        if (!checkFile(src)) {
            console.error(`源文件不存在: ${src}`);
            return false;
        }
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(src, dest);
        return true;
    } catch (err) {
        console.error(`复制文件失败 ${src} -> ${dest}:`, err);
        return false;
    }
}

// 复制静态文件
function copyStaticFiles() {
    console.log('复制静态文件...');
    const staticFiles = ['index.html'];

    for (const file of staticFiles) {
        const src = path.join(__dirname, file);
        const dest = path.join(__dirname, 'dist', file);
        if (!safeCopyFile(src, dest)) {
            console.error(`复制 ${file} 失败`);
            process.exit(1);
        }
    }
}

// 确保build目录存在
const buildDir = path.join(__dirname, 'build', 'Release');
const platformDir = path.join(__dirname, 'build', `${platform}-${arch}`);

try {
    fs.mkdirSync(buildDir, { recursive: true });
    fs.mkdirSync(platformDir, { recursive: true });
} catch (err) {
    console.error('创建目录失败:', err);
    process.exit(1);
}

// 编译native模块
console.log('编译native模块...');
try {
    execSync('node-gyp rebuild', { stdio: 'inherit' });
} catch (err) {
    console.error('编译native模块失败:', err);
    process.exit(1);
}

// 复制native模块到dist目录
console.log('复制文件到dist目录...');
const distDir = path.join(__dirname, 'dist', 'build', 'Release');

try {
    fs.mkdirSync(distDir, { recursive: true });
} catch (err) {
    console.error('创建dist目录失败:', err);
    process.exit(1);
}

const sourceFile = path.join(buildDir, 'mouse_control.node');

// 复制到多个位置以确保能找到模块
const copyTargets = [
    path.join(__dirname, 'dist', 'mouse_control.node'),
    path.join(distDir, 'mouse_control.node'),
    path.join(__dirname, 'dist', 'build', `${platform}-${arch}`, 'mouse_control.node')
];

for (const target of copyTargets) {
    const targetDir = path.dirname(target);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    try {
        fs.copyFileSync(sourceFile, target);
        console.log('成功复制到:', target);
    } catch (err) {
        console.warn('复制失败:', target, err);
    }
}

// 复制到平台特定目录
if (!safeCopyFile(sourceFile, path.join(platformDir, 'mouse_control.node'))) {
    console.error('复制到平台特定目录失败');
    process.exit(1);
}

// 复制静态文件
copyStaticFiles();

console.log('构建完成'); 
