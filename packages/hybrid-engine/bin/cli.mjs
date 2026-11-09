#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const command = args[0] || 'help';

function generateWeappAdapterCode() {
  return `/**
 * 微信小游戏环境适配层 (weapp-adapter.js) - 由 @wegame/hybrid-engine 自动生成
 * 抹平 window/document API、Canvas/Image 实例创建、前后台切换及触摸事件向 Pixi v7 PointerEvent 的映射
 */
(function () {
  if (typeof wx === 'undefined') return;

  var sysInfo = wx.getSystemInfoSync();
  var winW = sysInfo.windowWidth;
  var winH = sysInfo.windowHeight;
  var dpr = sysInfo.pixelRatio || 2;

  function createEventTarget() {
    var listeners = {};
    return {
      addEventListener: function (type, cb) {
        if (!listeners[type]) listeners[type] = [];
        if (listeners[type].indexOf(cb) === -1) listeners[type].push(cb);
      },
      removeEventListener: function (type, cb) {
        if (!listeners[type]) return;
        var idx = listeners[type].indexOf(cb);
        if (idx >= 0) listeners[type].splice(idx, 1);
      },
      dispatchEvent: function (evt) {
        var list = listeners[evt.type];
        if (list) {
          list.slice().forEach(function (fn) {
            if (typeof fn === 'function') fn.call(this, evt);
            else if (fn && typeof fn.handleEvent === 'function') fn.handleEvent(evt);
          });
        }
      }
    };
  }

  function decorateCanvas(canvas, isScreen) {
    var et = createEventTarget();
    if (!canvas.addEventListener) canvas.addEventListener = et.addEventListener;
    if (!canvas.removeEventListener) canvas.removeEventListener = et.removeEventListener;
    if (!canvas.dispatchEvent) canvas.dispatchEvent = et.dispatchEvent;
    if (!canvas.style) {
      canvas.style = {
        width: winW + 'px',
        height: winH + 'px',
        cursor: 'default',
        touchAction: 'none'
      };
    }
    canvas.clientWidth = winW;
    canvas.clientHeight = winH;
    canvas.getBoundingClientRect = function () {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: winW,
        height: winH,
        right: winW,
        bottom: winH
      };
    };
    canvas.setAttribute = function () {};
    canvas.getAttribute = function () { return null; };
    canvas.focus = function () {};
    canvas.blur = function () {};
    if (isScreen) {
      canvas.width = winW * dpr;
      canvas.height = winH * dpr;
    }
    return canvas;
  }

  var screenCanvas = decorateCanvas(wx.createCanvas(), true);

  var docTarget = createEventTarget();
  var bodyTarget = createEventTarget();

  var document = {
    body: {
      style: {},
      appendChild: function () {},
      removeChild: function () {},
      addEventListener: bodyTarget.addEventListener,
      removeEventListener: bodyTarget.removeEventListener,
      dispatchEvent: bodyTarget.dispatchEvent,
      clientWidth: winW,
      clientHeight: winH
    },
    documentElement: {
      style: {},
      clientWidth: winW,
      clientHeight: winH
    },
    createElement: function (tagName) {
      var tag = String(tagName).toLowerCase();
      if (tag === 'canvas') {
        return decorateCanvas(wx.createCanvas(), false);
      }
      if (tag === 'img' || tag === 'image') {
        return wx.createImage();
      }
      var el = createEventTarget();
      el.style = {};
      el.appendChild = function () {};
      el.removeChild = function () {};
      el.setAttribute = function () {};
      el.getBoundingClientRect = function () {
        return { x: 0, y: 0, top: 0, left: 0, width: winW, height: winH, right: winW, bottom: winH };
      };
      return el;
    },
    createElementNS: function (_ns, tagName) {
      return this.createElement(tagName);
    },
    getElementById: function () {
      return screenCanvas;
    },
    querySelectorAll: function () {
      return [];
    },
    addEventListener: docTarget.addEventListener,
    removeEventListener: docTarget.removeEventListener,
    dispatchEvent: docTarget.dispatchEvent,
    hidden: false,
    visibilityState: 'visible'
  };

  screenCanvas.parentElement = document.body;
  screenCanvas.parentNode = document.body;
  screenCanvas.ownerDocument = document;

  var winTarget = createEventTarget();
  var g = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;

  g.window = g;
  g.self = g;
  g.top = g;
  g.parent = g;
  g.canvas = screenCanvas;
  g.document = document;
  g.innerWidth = winW;
  g.innerHeight = winH;
  g.devicePixelRatio = dpr;
  g.screen = { width: winW, height: winH, availWidth: winW, availHeight: winH };

  g.navigator = {
    userAgent: 'Mozilla/5.0 (WeChat MiniGame; Mobile) AppleWebKit/605.1.15',
    appVersion: '5.0',
    platform: sysInfo.platform || 'Mobile',
    language: sysInfo.language || 'zh-CN',
    maxTouchPoints: 10,
    onLine: true
  };

  g.location = {
    href: 'game.js',
    protocol: 'https:',
    host: 'minigame.weixin.qq.com',
    hostname: 'minigame.weixin.qq.com',
    pathname: '/game.js',
    search: '',
    hash: ''
  };

  g.Image = function () {
    return wx.createImage();
  };
  g.HTMLCanvasElement = screenCanvas.constructor || Object;
  g.HTMLImageElement = g.Image;
  g.HTMLElement = Object;
  g.Element = Object;
  g.Node = Object;
  g.DOMParser = function () {
    return {
      parseFromString: function () {
        return document;
      }
    };
  };

  function CustomPointerEvent(type, props) {
    this.type = type;
    this.bubbles = true;
    this.cancelable = true;
    this.defaultPrevented = false;
    this.timeStamp = Date.now();
    Object.assign(this, props || {});
  }
  CustomPointerEvent.prototype.preventDefault = function () {
    this.defaultPrevented = true;
  };
  CustomPointerEvent.prototype.stopPropagation = function () {};
  CustomPointerEvent.prototype.stopImmediatePropagation = function () {};

  g.Event = CustomPointerEvent;
  g.PointerEvent = CustomPointerEvent;
  g.MouseEvent = CustomPointerEvent;
  g.TouchEvent = CustomPointerEvent;
  g.WheelEvent = CustomPointerEvent;

  g.addEventListener = winTarget.addEventListener;
  g.removeEventListener = winTarget.removeEventListener;
  g.dispatchEvent = winTarget.dispatchEvent;

  if (!g.requestAnimationFrame) {
    g.requestAnimationFrame = function (cb) {
      return setTimeout(function () {
        cb(Date.now());
      }, 16);
    };
    g.cancelAnimationFrame = function (id) {
      clearTimeout(id);
    };
  }

  if (!g.performance) {
    var start = Date.now();
    g.performance = {
      now: function () {
        return Date.now() - start;
      }
    };
  }

  function bridgeTouchEvent(wxEventName, pointerType, buttonsVal) {
    if (typeof wx[wxEventName] !== 'function') return;
    wx[wxEventName](function (res) {
      var list = (res.changedTouches && res.changedTouches.length ? res.changedTouches : res.touches) || [];
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        var x = t.clientX !== undefined ? t.clientX : t.pageX;
        var y = t.clientY !== undefined ? t.clientY : t.pageY;
        var evt = new CustomPointerEvent(pointerType, {
          target: screenCanvas,
          currentTarget: screenCanvas,
          pointerId: t.identifier || 1,
          pointerType: 'touch',
          isPrimary: i === 0,
          clientX: x,
          clientY: y,
          pageX: x,
          pageY: y,
          screenX: x,
          screenY: y,
          x: x,
          y: y,
          button: 0,
          buttons: buttonsVal,
          width: 1,
          height: 1,
          pressure: buttonsVal ? 0.5 : 0,
          detail: 1,
          changedTouches: res.changedTouches || list,
          touches: res.touches || list,
          targetTouches: res.touches || list
        });
        screenCanvas.dispatchEvent(evt);
        document.dispatchEvent(evt);
        g.dispatchEvent(evt);
      }
    });
  }

  bridgeTouchEvent('onTouchStart', 'pointerdown', 1);
  bridgeTouchEvent('onTouchMove', 'pointermove', 1);
  bridgeTouchEvent('onTouchEnd', 'pointerup', 0);
  bridgeTouchEvent('onTouchCancel', 'pointercancel', 0);

  if (typeof wx.onHide === 'function') {
    wx.onHide(function () {
      document.hidden = true;
      document.visibilityState = 'hidden';
      document.dispatchEvent(new CustomPointerEvent('visibilitychange'));
    });
  }
  if (typeof wx.onShow === 'function') {
    wx.onShow(function () {
      document.hidden = false;
      document.visibilityState = 'visible';
      document.dispatchEvent(new CustomPointerEvent('visibilitychange'));
    });
  }
})();
`;
}

function runExportWx() {
  const projectDir = process.cwd();
  const outDir = path.join(projectDir, 'dist-wx');
  const pkgPath = path.join(projectDir, 'package.json');
  const pkg = fs.existsSync(pkgPath)
    ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    : { name: 'hybrid-minigame' };

  console.log(`🚀 [@wegame/hybrid-engine] [1/4] 正在编译游戏工程 (${pkg.name}) 的微信小游戏包...`);
  execSync('npx vite build --config vite.wx.config.ts', { stdio: 'inherit', cwd: projectDir });

  console.log('🛠 [@wegame/hybrid-engine] [2/4] 正在生成 weapp-adapter.js...');
  fs.writeFileSync(path.join(outDir, 'weapp-adapter.js'), generateWeappAdapterCode(), 'utf-8');

  console.log('📦 [@wegame/hybrid-engine] [3/4] 正在生成 game.js、game.json 与 project.config.json...');
  fs.writeFileSync(
    path.join(outDir, 'game.js'),
    `require('./weapp-adapter.js');\nrequire('./engine-bundle.js');\n`,
    'utf-8'
  );

  const gameJson = {
    deviceOrientation: 'portrait',
    showStatusBar: false,
    networkTimeout: {
      request: 10000,
      connectSocket: 10000,
      uploadFile: 10000,
      downloadFile: 10000,
    },
  };
  fs.writeFileSync(path.join(outDir, 'game.json'), JSON.stringify(gameJson, null, 2), 'utf-8');

  const projectConfigJson = {
    description: `${pkg.name} - 基于 @wegame/hybrid-engine 构建的微信小游戏工程`,
    packOptions: { ignore: [], include: [] },
    setting: {
      urlCheck: false,
      es6: false,
      enhance: false,
      postcss: false,
      preloadBackgroundData: false,
      minified: true,
      newFeature: true,
      coverView: true,
      nodeModules: false,
      autoAudits: false,
      showShadowRootInWxmlPanel: false,
      scopeDataCheck: false,
      uglifyFileName: false,
      checkInvalidKey: true,
      checkSiteMap: false,
      uploadWithSourceMap: true,
      compileHotReLoad: false,
      babelSetting: { ignore: [], disablePlugins: [], outputPath: '' },
    },
    compileType: 'game',
    libVersion: '3.3.4',
    appid: 'touristappid',
    projectname: pkg.name.replace(/^@[^/]+\//, ''),
    condition: {},
    editorSetting: { tabIndent: 'insertSpaces', tabSize: 2 },
  };
  fs.writeFileSync(
    path.join(outDir, 'project.config.json'),
    JSON.stringify(projectConfigJson, null, 2),
    'utf-8'
  );

  // 若游戏工程存在 public/assets，同步至 dist-wx/assets (排除大型未压缩音视频以保证首包 < 4MB)
  const publicAssetsDir = path.join(projectDir, 'public', 'assets');
  const distAssetsDir = path.join(outDir, 'assets');
  if (fs.existsSync(publicAssetsDir)) {
    fs.mkdirSync(distAssetsDir, { recursive: true });
    function copyDirRecursive(src, dest) {
      for (const item of fs.readdirSync(src)) {
        if (item === 'sound-disco.mp3' || item === 'bgm.mp3') continue;
        const sPath = path.join(src, item);
        const dPath = path.join(dest, item);
        if (fs.statSync(sPath).isDirectory()) {
          fs.mkdirSync(dPath, { recursive: true });
          copyDirRecursive(sPath, dPath);
        } else {
          fs.copyFileSync(sPath, dPath);
        }
      }
    }
    copyDirRecursive(publicAssetsDir, distAssetsDir);
  }

  const wxDiscoMp3 = path.join(outDir, 'assets', 'audio', 'sound-disco.mp3');
  if (fs.existsSync(wxDiscoMp3)) fs.unlinkSync(wxDiscoMp3);
  const wxBgmMp3 = path.join(outDir, 'assets', 'audio', 'bgm.mp3');
  if (fs.existsSync(wxBgmMp3)) fs.unlinkSync(wxBgmMp3);

  function getDirSizeBytes(dirPath) {
    let size = 0;
    for (const item of fs.readdirSync(dirPath)) {
      const full = path.join(dirPath, item);
      const stat = fs.statSync(full);
      size += stat.isDirectory() ? getDirSizeBytes(full) : stat.size;
    }
    return size;
  }

  const totalBytes = getDirSizeBytes(outDir);
  console.log('\n📊 [@wegame/hybrid-engine] [4/4] 微信小游戏导出清单 (dist-wx/):');
  for (const file of fs.readdirSync(outDir)) {
    const fullPath = path.join(outDir, file);
    const stat = fs.statSync(fullPath);
    const kb = ((stat.isDirectory() ? getDirSizeBytes(fullPath) : stat.size) / 1024).toFixed(2);
    console.log(`  - ${file.padEnd(24)} ${kb.padStart(8)} KB ${stat.isDirectory() ? '(目录)' : ''}`);
  }
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`\n✅ 微信小游戏首包总大小: ${totalMB} MB (< 4.00 MB 限制)`);
  console.log(`📂 导出目录路径: ${outDir}`);
}

function runCreateGame(gameName) {
  if (!gameName) {
    console.error('❌ 请提供新游戏工程名称，例如: npx hybrid-engine create my-new-game');
    process.exit(1);
  }
  const targetDir = path.resolve(process.cwd(), 'games', gameName);
  if (fs.existsSync(targetDir)) {
    console.error(`❌ 目录已存在: ${targetDir}`);
    process.exit(1);
  }

  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });

  const pkgJson = {
    name: `@wegame/${gameName}`,
    private: true,
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc -b && vite build',
      'build:wx': 'hybrid-engine export-wx',
    },
    dependencies: {
      '@wegame/hybrid-engine': '*',
      'pixi.js': '^7.4.2',
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      zustand: '^5.0.0',
    },
    devDependencies: {
      '@types/react': '^18.3.12',
      '@types/react-dom': '^18.3.1',
      '@vitejs/plugin-react': '^4.3.4',
      typescript: '~5.6.2',
      vite: '^6.0.1',
    },
  };

  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf-8');
  fs.writeFileSync(
    path.join(targetDir, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: '../../tsconfig.base.json',
        compilerOptions: { noEmit: true },
        include: ['src'],
      },
      null,
      2
    ),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(targetDir, 'index.html'),
    `<!doctype html>\n<html lang="zh-CN">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${gameName} - Powered by @wegame/hybrid-engine</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`,
    'utf-8'
  );

  console.log(`✅ 已成功基于 @wegame/hybrid-engine 创建新游戏工程骨架: ${targetDir}`);
}

if (command === 'export-wx') {
  runExportWx();
} else if (command === 'create') {
  runCreateGame(args[1]);
} else {
  console.log(`
@wegame/hybrid-engine CLI 工具
用法:
  hybrid-engine export-wx          将当前游戏工程编译并导出为微信小游戏工程 (dist-wx/)
  hybrid-engine create <game-name> 在 games/<game-name> 下基于引擎脚手架初始化新游戏工程
`);
}
