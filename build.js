const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const platform = process.platform;
const arch = process.arch;

// 定义支持的架构
const SUPPORTED_ARCHS = {
    win32: ['x64', 'x86', 'arm64'],
    darwin: ['x64', 'arm64'],
    linux: ['x64', 'arm64']
};

// 获取当前平台支持的所有架构
function getSupportedArchs() {
    return SUPPORTED_ARCHS[platform] || ['x64'];
}

// 为指定架构编译native模块
async function buildForArch(targetArch) {
    console.log(`正在为 ${platform}-${targetArch} 编译native模块...`);
    try {
        const env = { ...process.env };
        if (platform === 'win32') {
            // Windows特殊处理
            switch (targetArch) {
                case 'x86':
                    env.npm_config_arch = 'ia32';
                    break;
                case 'arm64':
                    env.npm_config_arch = 'arm64';
                    break;
                default:
                    env.npm_config_arch = 'x64';
            }
        } else {
            env.npm_config_arch = targetArch;
        }

        execSync('node-gyp rebuild', {
            stdio: 'inherit',
            env: env
        });

        // 复制编译后的模块到对应架构的目录
        const archDir = path.join(__dirname, 'build', `${platform}-${targetArch}`);
        if (!fs.existsSync(archDir)) {
            fs.mkdirSync(archDir, { recursive: true });
        }

        const sourceFile = path.join(buildDir, 'mouse_control.node');
        const targetFile = path.join(archDir, 'mouse_control.node');

        fs.copyFileSync(sourceFile, targetFile);
        console.log(`已复制模块到 ${targetFile}`);
    } catch (err) {
        console.error(`编译 ${platform}-${targetArch} 失败:`, err);
        return false;
    }
    return true;
}

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
async function buildAllArchs() {
    const archs = getSupportedArchs();
    let buildSuccess = true;

    for (const targetArch of archs) {
        if (!await buildForArch(targetArch)) {
            buildSuccess = false;
            console.error(`为 ${platform}-${targetArch} 构建失败`);
        }
    }

    if (!buildSuccess) {
        process.exit(1);
    }
}

buildAllArchs().then(() => {
    console.log('所有架构构建完成');
}).catch(err => {
    console.error('构建过程中出现错误:', err);
    process.exit(1);
});

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
