"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const ratio = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = CONFIG.width * ratio;
canvas.height = CONFIG.height * ratio;
ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

// 所有依赖已按 index.html 的 defer 顺序完成加载。
const game = new Game();
