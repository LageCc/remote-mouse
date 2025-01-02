const mouseControl = require('./');

// 获取鼠标位置
const pos = mouseControl.getPosition();
console.log('当前鼠标位置:', pos);

// 移动鼠标
mouseControl.moveTo(100, 100);
console.log('已移动鼠标到: (100, 100)');

// 点击鼠标
mouseControl.click();
console.log('已执行点击');
