/**
 * 微信小游戏主入口文件 (对应文章 7.2 节)
 * 1. 先加载 weapp-adapter.js 注入 window/document/canvas 及触摸坐标转换
 * 2. 再加载混合游戏引擎主包 engine-bundle.js
 */
require('./weapp-adapter.js');
require('./engine-bundle.js');
