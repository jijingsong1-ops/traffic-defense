"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
Platform.initialize(canvas,ctx);

// 所有依赖已按 index.html 的 defer 顺序完成加载。
const game = new Game();
game.screen="home";
