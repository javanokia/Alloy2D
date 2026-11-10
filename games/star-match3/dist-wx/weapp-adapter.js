/**
 * 微信小游戏环境适配层 (weapp-adapter.js) - 由 alloy2d 自动生成
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
