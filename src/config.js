"use strict";

// 配置区：经济、难度、敌人、塔型与关卡均为数据驱动。
const CONFIG = {
  version: "v0.8.1", width: 1280, height: 820, lives: 20, roadWidth: 34,
  towerRadius: 19, spacing: 56, siteRoadOffset: 48, maxLevel: 4, sellRatio: 0.7,
  towerUpgradeRange: 10, towerFinalRange: 6,
  soldierScale: .64, soldierSpeed: 88, soldierLeash: 76, soldierCatch: 23, audioVolume: .22,
  levelsPerChapter: 8, firstPreparation: 30, waveReward: 34,
  enemyGrowth: 1.14, spawnInterval: 0.62, projectileSpeed: 430,
  fixedStep: 1 / 60, saveKey: "traffic-defense-campaign-v1"
};
const COLORS = { bg: "#102d34", panel: "#1b3d44", muted: "#a2bbb9", ink: "#f7f2df",
  mint: "#a9ddb7", gold: "#f5ce85", red: "#ff9b88", border: "#3c5e61" };
const MAP = { x: 24, y: 112, w: 900, h: 574 };
const SKILLS = {
  strike: { name: "轨道空袭", key: "Q", cooldown: 30, radius: 88, color: "#ffbe82", note: "区域穿甲伤害" },
  freeze: { name: "紧急封路", key: "E", cooldown: 36, radius: 105, color: "#8eceff", note: "区域冻结3秒" }
};
const TARGET_MODES = ["优先终点", "优先强敌", "优先支援"];
