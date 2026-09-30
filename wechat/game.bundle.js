"use strict";
// 此文件自动生成，请修改 src/ 后运行 node tools/build-wechat.cjs。
const Platform=require("./platform/wechat.js").createPlatform(wx);
const canvas=Platform.canvas;
const ctx=canvas.getContext("2d");
// ---- src/config.js ----
"use strict";

// 配置区：经济、难度、敌人、塔型与关卡均为数据驱动。
const CONFIG = {
  version: "v0.13.0", width: 1280, height: 820, lives: 20, roadWidth: 34,
  towerRadius: 19, spacing: 56, siteRoadOffset: 48, maxLevel: 4, sellRatio: 0.7,
  towerUpgradeRange: 10, towerFinalRange: 6,
  soldierScale: .64, soldierSpeed: 88, soldierLeash: 76, soldierCatch: 23, audioVolume: .22,
  levelsPerChapter: 8, firstPreparation: 20,
  waveGapMin: 5, waveGapMax: 10, waveGapPerEnemy: .25,
  earlyGoldPerSecond: 3, earlyGoldMax: 30,
  enemyHealthMultiplier: 1.12, bossHealthMultiplier: 1.3,
  trafficSwitchCooldown: 4, trafficActionCooldown: 20, tollHold: 2.5,
  escortProtection: 5, emergencyPriority: 8, emergencyCooldown: 18,
  bridgeRepairCost: 60, bridgeRepairAmount: 30, bridgeRepairCooldown: 18,
  enemyGrowth: 1.14, spawnInterval: 0.56, trafficGap: 7, enemyVisualScale: .88, projectileSpeed: 430,
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

// ---- src/data/enemies.js ----
"use strict";

const ENEMIES = {
  scout: { name: "侦察车", hp: 48, speed: 52, reward: 13, leak: 1, color: "#ead591", icon: "普",
    note: "基础车流，数量较多。", counter: "路卫塔可有效拦截" },
  runner: { name: "疾行摩托", hp: 32, speed: 91, reward: 14, leak: 1, color: "#ffac7c", icon: "快",
    note: "速度极快，生命较低。", counter: "使用减速或高攻速防御" },
  armor: { name: "装甲运兵车", hp: 140, speed: 37, reward: 24, leak: 2, armor: 0.45, color: "#a9b1c7", icon: "甲",
    note: "减免 45% 非穿甲伤害。", counter: "脉冲穿甲；研究磁轨或钻芯弹" },
  shield: { name: "护盾运输车", hp: 95, shield: 65, regen: 13, speed: 46, reward: 25, leak: 2,
    color: "#8eceff", icon: "盾", note: "脱战 3 秒后再生护盾。", counter: "集中火力，研究破盾进化" },
  healer: { name: "维修支援车", hp: 100, speed: 42, reward: 27, leak: 2, heal: 13, color: "#7ee6b3", icon: "+",
    note: "每 1.2 秒治疗附近其他车辆。", counter: "切换为支援优先，尽早击杀" },
  splitter: { name: "蜂群母车", hp: 108, speed: 45, reward: 20, leak: 2, split: 3,
    color: "#d5a1ff", icon: "裂", note: "被击毁后释放 3 辆微型车。", counter: "范围攻击，注意预留拦截距离" },
  swarm: { name: "微型蜂群", hp: 22, speed: 74, reward: 5, leak: 1, color: "#dcbbff", icon: "微",
    note: "母车残骸中涌出的高速单位。", counter: "导弹与连锁脉冲效果出色" },
  boss: { name: "攻城巨兽", boss: true, hp: 950, speed: 27, reward: 110, leak: 5, armor: 0.25, slowResist: 0.6,
    color: "#ff8591", icon: "王", note: "高生命、装甲，并抵抗 60% 减速。", counter: "集中升级主力塔，保留主动技能" }
};
// 地貌敌人复用移动与战斗规则，拥有各自的外观和实质性能力差异。
Object.assign(ENEMIES, {
  tractor: { ...ENEMIES.armor, name:"农用装甲车", hp:165, speed:35, armor:0.35, reward:26, visual:"armor", skin:"country", color:"#d5aa60", note:"厚重农机，减免35%普通伤害。" },
  irrigator: { ...ENEMIES.healer, name:"灌溉维修车", hp:115, heal:18, speed:44, visual:"healer", skin:"country", color:"#91cf8b", note:"每1.2秒修复周围车辆，治疗量18。" },
  harvestBoss: { ...ENEMIES.boss, name:"收割者巨机", hp:1150, split:5, visual:"boss", skin:"country", color:"#d2a74f", note:"高装甲首领，击毁后涌出5辆蜂群车。" },
  dune: { ...ENEMIES.runner, name:"沙丘越野车", hp:65, speed:102, reward:18, burnResist:0.7, visual:"runner", skin:"desert", color:"#efb66e", note:"极速越野，抵抗70%持续灼烧。", counter:"信号干扰配合单体火力" },
  mirage: { ...ENEMIES.shield, name:"蜃景护盾车", hp:110, shield:105, regen:22, visual:"shield", skin:"desert", color:"#e4c48e", note:"脱战后快速恢复护盾，抵抗70%灼烧。", burnResist:0.7 },
  sandBoss: { ...ENEMIES.boss, name:"沙海堡垒", hp:1300, burnResist:0.8, shield:140, regen:16, visual:"boss", skin:"desert", color:"#d7a46b", note:"厚重护盾与装甲，抵抗80%持续灼烧。" },
  crawler: { ...ENEMIES.armor, name:"攀岩履带车", hp:205, armor:0.55, slowResist:0.65, reward:30, visual:"armor", skin:"hills", color:"#aca89e", note:"减免55%普通伤害，抵抗65%控制。", counter:"使用穿甲塔，避免只靠冰冻" },
  rally: { ...ENEMIES.runner, name:"山地拉力车", hp:86, speed:84, slowResist:0.5, reward:20, visual:"runner", skin:"hills", color:"#b9c8a0", note:"中等生命、高速度，抵抗50%控制。" },
  ridgeBoss: { ...ENEMIES.boss, name:"山岳破城车", hp:1500, armor:0.5, slowResist:0.8, visual:"boss", skin:"hills", color:"#a4a59d", note:"重装首领，减免50%普通伤害，抗控80%。" },
  skiff: { ...ENEMIES.runner, name:"突击快艇", hp:85, shield:30, regen:6, speed:96, reward:20, visual:"runner", skin:"sea", color:"#a4dce7", note:"沿航道突击，速度极快并携带轻型护盾。" },
  tender: { ...ENEMIES.healer, name:"护航补给舰", hp:145, shield:90, regen:15, heal:17, visual:"healer", skin:"sea", color:"#83bebb", note:"携带再生护盾，并维修周围船只。", counter:"研究破盾信号，优先击沉支援舰" },
  barge: { ...ENEMIES.shield, name:"护盾登陆舰", hp:145, shield:110, regen:18, visual:"shield", skin:"sea", color:"#9bb5c3", note:"装有厚重的再生护盾，脱战后恢复。" },
  carrier: { ...ENEMIES.splitter, name:"快艇母舰", hp:155, split:4, splitType:"dinghy", visual:"splitter", skin:"sea", color:"#acb7d0", note:"被击沉后释放4艘高速突击艇。" },
  dinghy: { ...ENEMIES.swarm, name:"微型突击艇", speed:92, visual:"swarm", skin:"sea", color:"#b6dbe4", note:"母舰沉没后释放，速度非常快。" },
  admiral: { ...ENEMIES.boss, name:"深海旗舰", hp:1350, shield:450, regen:30, visual:"boss", skin:"sea", color:"#7fa9c6", note:"旗舰拥有450基础护盾，脱战后再生。" },
  spore: { ...ENEMIES.swarm, name:"林地孢子兽", hp:30, speed:81, skin:"forest", visual:"swarm", color:"#aecb83", note:"母巢死亡后释放的敏捷小兽。" },
  grove: { ...ENEMIES.healer, name:"林间守护兽", hp:145, heal:20, speed:41, reward:29, skin:"forest", visual:"healer", color:"#93b987", note:"持续治疗附近同伴，治疗量20。", counter:"优先支援，集中火力打断治疗链" },
  brood: { ...ENEMIES.splitter, name:"荆棘母巢", hp:165, split:4, splitType:"spore", reward:28, skin:"forest", visual:"splitter", color:"#b2aa7d", note:"死亡释放4只孢子兽，终点前要保留范围火力。" },
  ancient: { ...ENEMIES.boss, name:"古树行者", hp:1550, heal:18, split:6, splitType:"spore", skin:"forest", visual:"boss", color:"#9fa46f", note:"治疗同伴，死亡时释放6只孢子兽。" }
});

// ---- src/data/towers.js ----
"use strict";

const TOWERS = {
  rail: {
    name: "路卫塔", cost: 80, damage: 22, range: 125, cooldown: .58,
    focus: true, focusGain: .08, color: "#7de0cb", glyph: "磁",
    note: "测速锁定 / 动能拦截"
  },
  signal: {
    name: "信号站", cost: 125, damage: 18, range: 108, cooldown: 1.3,
    pierce: true, slow: .75, duration: 1.4, color: "#8fc8fa", glyph: "讯",
    note: "红灯脉冲 / 干扰制动"
  },
  missile: {
    name: "清障台", cost: 145, damage: 58, range: 132, cooldown: 1.9,
    splash: 58, slow: .85, duration: .7, color: "#f5bb79", glyph: "锚", note: "抛射制动锚 / 区域清障"
  },
  depot: {
    name: "勤务站", cost: 110, damage: 13, range: 125, cooldown: .8,
    soldierCount: 3, soldierHealth: 105, soldierArmor: .12, respawn: 8, rallyRange: 125,
    color: "#f1a7a2", glyph: "勤", note: "派遣拦截队 / 道路驻守"
  }
};
// 进化取决于当前章节：名称、能力与建筑形态一起变化。数值为基础属性的倍率或覆盖值。
const evolution=(name,cost,note,stats)=>({name,cost,note,...stats});
const EVOLUTIONS = {
  city: {
    rail:[evolution("测速塔",125,"高伤穿甲 · 射程+45",{damage:2.7,pierce:true,range:45,cooldown:1.45}),evolution("追踪塔",140,"双目标 · 高速连射",{damage:1.15,multi:2,cooldown:.65})],
    signal:[evolution("冷却塔",155,"低温脉冲 · 定身0.4秒",{damage:1.6,splash:62,slow:.4,stun:.4,duration:2}),evolution("电网塔",175,"连锁4车 · 护盾伤害×3",{damage:1.8,chain:4,chainRange:100,shieldMultiplier:3})],
    missile:[evolution("重锚台",185,"重型制动锚 · 范围65",{damage:2.1,pierce:true,splash:65}),evolution("双网台",175,"双目标抛网 · 攻速提升",{damage:1.2,multi:2,cooldown:.8})],
    depot:[evolution("盾卫站",155,"队员生命×2 · 减伤45%",{soldierHealth:2,soldierArmor:.45,damage:1.2}),evolution("快反站",170,"4名队员 · 穿甲接触拦截",{soldierCount:4,damage:2.4,pierce:true,soldierHealth:1.3})]
  },
  country: {
    rail:[evolution("风车塔",140,"三目标射击 · 射程+20",{damage:1.4,multi:3,range:20}),evolution("蜂群塔",160,"高速双轨 · 两车齐射",{damage:1.1,multi:2,cooldown:.48})],
    signal:[evolution("水泵塔",170,"减速65% · 修复附近队员",{damage:2,splash:75,slow:.35,duration:2.5,repair:24}),evolution("风铃塔",185,"连锁6车 · 定身0.3秒",{damage:2,chain:6,chainRange:110,stun:.3})],
    missile:[evolution("粮道台",195,"远程覆盖 · 大范围80",{damage:2,range:40,splash:80}),evolution("热索台",190,"范围85 · 持续灼烧",{damage:1.5,splash:85,burn:32,duration:4})],
    depot:[evolution("补给站",165,"4名重装队员 · 持续回复",{soldierCount:4,soldierHealth:1.7,soldierRegen:8,soldierArmor:.3}),evolution("巡田站",180,"5名队员 · 快速补员",{soldierCount:5,damage:2,respawn:5,soldierHealth:1.2})]
  },
  desert: {
    rail:[evolution("沙隼塔",155,"超远穿甲 · 射程+60",{damage:3.5,pierce:true,range:60,cooldown:1.6}),evolution("沙暴塔",175,"三目标 · 破盾×2",{damage:1.7,multi:3,shieldMultiplier:2})],
    signal:[evolution("寒泉塔",180,"全域脉冲 · 强力减速",{damage:2.2,splash:80,slow:.25,duration:2.5}),evolution("裂光塔",200,"双目标 · 破盾×4",{damage:2.5,multi:2,shieldMultiplier:4,range:20})],
    missile:[evolution("沙锚台",205,"穿甲爆破 · 定身0.4秒",{damage:2.4,pierce:true,stun:.4,splash:72}),evolution("流沙网",210,"范围95 · 沙陷减速",{damage:2,splash:95,slow:.4,duration:2})],
    depot:[evolution("绿洲站",180,"生命×2.4 · 持续回复",{soldierHealth:2.4,soldierRegen:10,soldierArmor:.4}),evolution("沙行站",195,"4名工程队员 · 穿甲破盾",{soldierCount:4,damage:3,pierce:true,shieldMultiplier:3,soldierHealth:1.6})]
  },
  hills: {
    rail:[evolution("鹰眼塔",175,"高伤穿甲 · 远程狙击",{damage:4,pierce:true,range:55,cooldown:1.5}),evolution("碎甲塔",190,"三目标 · 削甲20%",{damage:2,multi:3,pierce:true,shred:.2})],
    signal:[evolution("震地塔",195,"范围震荡 · 削甲25%",{damage:3,splash:75,shred:.25}),evolution("聚能塔",210,"持续锁定 · 聚焦增伤",{damage:3.5,focus:true,range:36})],
    missile:[evolution("山锚台",220,"重型制动锚 · 大范围90",{damage:2.8,pierce:true,splash:90}),evolution("碎岩网",230,"双目标 · 穿甲爆破",{damage:2,pierce:true,multi:2,splash:64})],
    depot:[evolution("铁卫站",190,"生命×3 · 减伤60%",{soldierHealth:3,soldierArmor:.6,damage:1.8}),evolution("攀岩站",205,"4名工程队员 · 高伤穿甲",{soldierCount:4,pierce:true,damage:3.8,soldierHealth:1.8})]
  },
  sea: {
    rail:[evolution("灯塔",185,"双射破盾 · 禁止回盾5秒",{damage:2.8,multi:2,shieldMultiplier:3,range:40,jam:5}),evolution("浪涌塔",200,"三目标 · 高速破盾",{damage:1.9,multi:3,shieldMultiplier:2,cooldown:.65})],
    signal:[evolution("海缆塔",205,"连锁6舰 · 破盾×4",{damage:2.8,chain:6,chainRange:120,shieldMultiplier:4}),evolution("寒潮塔",220,"冻结破盾 · 禁止回盾5秒",{damage:2.5,splash:95,stun:.6,slow:.35,shieldMultiplier:3,duration:2.5,jam:5})],
    missile:[evolution("岸锚台",225,"远程穿甲 · 破盾×3",{damage:2.6,pierce:true,shieldMultiplier:3,range:32}),evolution("拖网台",230,"双目标 · 范围90",{damage:2.1,multi:2,splash:90,shieldMultiplier:2})],
    depot:[evolution("海哨站",200,"4名登检队员 · 高防破盾",{soldierCount:4,soldierHealth:2.5,soldierArmor:.45,shieldMultiplier:3,damage:1.8}),evolution("登检站",215,"5名登检队员 · 快速补员",{soldierCount:5,damage:3,shieldMultiplier:4,respawn:4.5,soldierHealth:1.8})]
  },
  forest: {
    rail:[evolution("树冠塔",195,"四目标 · 穿甲齐射",{damage:2,multi:4,pierce:true}),evolution("荆棘塔",210,"集束弹雨 · 附带减速",{damage:2.5,splash:60,slow:.55,duration:2,cooldown:.75})],
    signal:[evolution("根须塔",220,"全域脉冲 · 定身减速",{damage:2.7,splash:100,stun:.65,slow:.3,duration:3}),evolution("萤火塔",235,"连锁8敌 · 快速跳频",{damage:2.6,chain:8,chainRange:130,cooldown:.75})],
    missile:[evolution("根锚台",235,"穿甲爆破 · 范围110",{damage:2.8,pierce:true,splash:110}),evolution("净林台",240,"热索封锁 · 持续灼烧",{damage:1.9,multi:2,splash:85,burn:50,duration:5})],
    depot:[evolution("树卫站",210,"4名队员 · 高生命再生",{soldierCount:4,soldierHealth:2.7,soldierArmor:.4,soldierRegen:13}),evolution("游林站",225,"5名工程队员 · 穿甲接触拦截",{soldierCount:5,damage:3.6,pierce:true,soldierHealth:2,respawn:5})]
  }
};
const TOWER_ORDER=Object.keys(TOWERS);
const pathsFor=(type,theme)=>EVOLUTIONS[theme]?.[type]||EVOLUTIONS.city[type];
function evolutionRequirement(type,theme,branch) {
  const chapter=CHAPTERS.findIndex(c=>c.theme===theme),order=TOWER_ORDER.indexOf(type);
  return chapter===0 ? order+1+(branch===1?3:0) : chapter*8+(branch===0?0:order+2);
}

// 章节装备不仅换色：由 facilities.js 绘制风叶、遮阳板、履带、浮筒、根须等轮廓。
const THEME_EQUIPMENT = {
  city: {name:"路灯 / 路障", colors:["#8debdc","#ffbe82"]},
  country: {name:"风叶 / 水箱", colors:["#d7e7a0","#8cdddc"]},
  desert: {name:"遮阳板 / 散热器", colors:["#a8dcf1","#f6bd78"]},
  hills: {name:"支架 / 履带", colors:["#c5d3f2","#eac78b"]},
  sea: {name:"浮筒 / 船锚", colors:["#8ee8ec","#f1b29a"]},
  forest: {name:"根须 / 荧光囊", colors:["#b2d786","#d6acf4"]}
};

// ---- src/data/levels.js ----
"use strict";

const CHAPTERS = [
  { name:"海湾城防", city:"海湾都市 / BAY CITY", theme:"city", terrain:"#a9c5a6", land:"#b8cbac", water:"#639fa6", road:"#596c73",
    note:"柏油路与交通枢纽 · 装甲、护盾和维修车队", pool:["scout","runner","armor","shield","healer"], boss:"boss",
    names:["花园环线","港口物流园","中央商业区","市政核心区","北岸货运站","集装箱码头","钢铁大道","能源中枢"],
    nodes:[[140,590],[140,410],[140,225],[350,225],[350,410],[570,410],[770,410],[770,225]] },
  { name:"田野追击", city:"金穗乡野 / GOLDEN FIELDS", theme:"country", terrain:"#b8cb8d", land:"#d3cf94", water:"#80b7ad", road:"#a09270",
    note:"麦田、村庄与灌溉河 · 农机护送与持续维修", pool:["runner","tractor","splitter","irrigator"], boss:"harvestBoss",
    names:["麦田小径","牧场岔口","风车农庄","谷仓保卫战","灌渠渡口","稻田环道","丰收集市","收割者来袭"],
    nodes:[[125,560],[320,600],[530,590],[755,560],[780,355],[580,235],[370,225],[155,320]] },
  { name:"沙海远征", city:"赤砂荒漠 / RED DUNES", theme:"desert", terrain:"#d4b783", land:"#e4c596", water:"#7cb7b0", road:"#b89166",
    note:"沙丘、绿洲与遗迹 · 高速越野与抗火护盾", pool:["dune","mirage","armor","splitter"], boss:"sandBoss",
    names:["流沙入口","绿洲商道","风蚀走廊","沙丘前哨","断壁遗迹","双月峡口","蜃景长廊","沙海堡垒"],
    nodes:[[115,255],[305,235],[520,225],[750,245],[790,465],[580,580],[350,495],[130,570]] },
  { name:"群山要塞", city:"苍脊丘陵 / RIDGELANDS", theme:"hills", terrain:"#a8b49b", land:"#c3c3ad", water:"#879c9e", road:"#8d8c80",
    note:"山脊、盘山路与矿场 · 高装甲与抗控制车队", pool:["rally","crawler","shield","healer"], boss:"ridgeBoss",
    names:["山麓营地","盘山栈道","碎石矿口","鹰巢哨站","双峰隘口","云间长桥","峭壁防线","山岳破城"],
    nodes:[[130,600],[345,590],[565,585],[790,555],[745,365],[520,355],[310,310],[150,220]] },
  { name:"海岛封锁", city:"群岛航线 / ISLAND CHAIN", theme:"sea", terrain:"#699eae", land:"#b8c9a3", water:"#699eae", road:"#497e95",
    note:"岛礁、灯塔与航道 · 快艇突袭与护航补给舰", pool:["skiff","barge","carrier","tender"], boss:"admiral",
    names:["珊瑚浅湾","灯塔航路","双岛水道","补给港湾","破浪礁群","潮汐海峡","远洋关隘","深海旗舰"],
    nodes:[[135,245],[335,350],[165,560],[405,600],[590,475],[785,585],[785,325],[585,220]] },
  { name:"古林守望", city:"翡翠密林 / EMERALD WOODS", theme:"forest", terrain:"#779d76", land:"#91ad7b", water:"#5b9690", road:"#827c5d",
    note:"古树、溪流与林间迷径 · 治疗、分裂与孢子兽", pool:["spore","brood","armor","grove"], boss:"ancient",
    names:["苔地边界","幽林岔路","溪谷营地","荆棘母巢","古树回廊","萤火渡口","根须迷径","古林之心"],
    nodes:[[120,235],[330,245],[525,225],[755,245],[745,460],[530,600],[315,470],[120,600]] }
];
// 每行是一张独立设计的路网。节点顺序就是单向行驶方向；分支并非坐标抖动。
const ROAD_LAYOUTS = {
  city: [
    {label:"双环分流", paths:["52,390 200,390 310,250 560,250 740,390 894,390", "52,390 200,390 310,530 560,530 740,390 894,390"]},
    {label:"立体蛇行", paths:["52,230 250,230 250,540 460,540 460,240 690,240 690,540 840,540 894,390"]},
    {label:"三线汇流", paths:["52,240 200,240 370,390 660,390 790,240 894,240", "52,390 370,390 660,390 790,240 894,240", "52,550 200,550 370,390 660,390 790,240 894,240"]},
    {label:"施工改道", paths:["52,390 210,390 210,230 700,230 810,390 894,390"], alternate:"52,390 210,390 210,560 600,560 600,390 894,390", event:"施工封路"},
    {label:"内城回旋", paths:["52,550 740,550 740,240 230,240 230,420 570,420 570,330"]},
    {label:"双门对角", paths:["52,230 240,230 340,310 610,310 710,230 894,230", "52,560 190,560 310,450 640,450 760,560 894,560"]},
    {label:"三路岗哨", paths:["52,390 250,390 460,390 690,390 790,540 894,540", "460,185 460,390 690,390 790,540 894,540"]},
    {label:"升桥回环", paths:["52,310 230,310 230,530 670,530 790,390 894,390"], alternate:"52,310 230,310 390,220 720,220 720,390 540,390 540,560 810,560 894,390", event:"升桥绕行"}
  ],
  country: [
    {label:"麦田大回环", paths:["52,270 720,270 790,440 630,560 240,560 240,410 570,410"]},
    {label:"牧场三岔", paths:["52,390 190,390 330,220 670,220 780,390 894,390", "52,390 190,390 430,390 780,390 894,390", "52,390 190,390 330,560 670,560 780,390 894,390"]},
    {label:"风车折线", paths:["52,570 200,570 320,230 460,530 600,230 740,530 894,350"]},
    {label:"水渠漫堤", paths:["52,390 210,390 330,240 650,240 790,390 894,390"], alternate:"52,390 210,390 330,560 550,560 550,390 760,390 760,240 894,240", event:"开闸引流"},
    {label:"南北夹击", paths:["250,185 250,330 430,330 600,390 790,390 894,390", "250,630 250,490 430,490 600,390 790,390 894,390"]},
    {label:"稻田田字", paths:["52,230 380,230 380,400 190,400 190,570 710,570 710,230 894,230"]},
    {label:"粮仓双环", paths:["52,250 210,250 320,340 550,340 680,220 800,220 894,390", "52,540 210,540 320,440 550,440 680,570 800,570 894,390"]},
    {label:"收割机开路", paths:["52,280 210,280 380,490 620,490 790,280 894,280"], alternate:"52,280 210,280 210,550 760,550 760,390 440,390 440,220 894,220", event:"麦田开道"}
  ],
  desert: [
    {label:"沙丘之字", paths:["52,250 220,250 350,550 530,230 700,550 894,330"]},
    {label:"绿洲分流", paths:["52,390 180,390 270,230 520,230 690,320 790,390 894,390", "52,390 180,390 310,510 520,580 710,540 790,390 894,390", "52,390 180,390 430,390 790,390 894,390"]},
    {label:"峡谷双入口", paths:["52,220 270,220 480,410 650,240 790,400 894,400", "52,570 280,570 480,410 620,570 810,570 894,400"]},
    {label:"流沙截道", paths:["52,390 210,390 320,230 630,230 800,480 894,480"], alternate:"52,390 210,390 300,570 610,570 610,390 790,240 894,240", event:"流沙塌陷"},
    {label:"遗迹螺旋", paths:["52,570 790,570 790,230 220,230 220,430 560,430 560,330"]},
    {label:"双月绕行", paths:["52,230 230,230 360,320 580,320 720,230 810,230 894,390", "52,550 210,550 370,460 600,460 740,550 810,550 894,390"]},
    {label:"沙海三脊", paths:["52,220 730,220 730,390 180,390 180,570 790,570 894,430"]},
    {label:"风暴新径", paths:["52,270 210,270 400,500 700,500 800,350 894,350"], alternate:"52,270 210,270 360,220 640,220 640,400 350,400 350,580 790,580 894,350", event:"风暴移沙"}
  ],
  hills: [
    {label:"盘山三折", paths:["52,560 790,560 790,390 230,390 230,220 780,220 894,330"]},
    {label:"双峰山口", paths:["52,390 180,390 360,220 500,390 670,220 810,390 894,390", "52,390 180,390 350,560 640,560 810,390 894,390"]},
    {label:"矿坑回旋", paths:["52,240 740,240 740,550 260,550 260,390 560,390"]},
    {label:"落石换道", paths:["52,330 210,330 370,220 650,220 800,440 894,440"], alternate:"52,330 210,330 210,570 650,570 650,390 420,390 420,240 894,240", event:"落石封山"},
    {label:"高低双线", paths:["52,220 230,220 370,320 680,320 800,220 894,220", "52,580 190,580 380,450 730,450 850,560 894,560"]},
    {label:"四折天梯", paths:["170,630 170,220 370,220 370,550 570,550 570,250 770,250 770,490 894,490"]},
    {label:"峭壁交汇", paths:["52,240 230,240 460,400 660,240 810,240 894,400", "52,560 240,560 460,400 650,560 810,560 894,400", "460,185 460,400 894,400"]},
    {label:"隧道贯通", paths:["52,280 210,280 360,520 700,520 810,350 894,350"], alternate:"52,280 210,280 410,220 730,220 730,400 420,400 420,580 810,580 894,350", event:"隧道开通"}
  ],
  sea: [
    {label:"群岛环航", paths:["52,250 310,230 560,280 760,430 630,570 320,560 220,390 590,390"]},
    {label:"双岛分航", paths:["52,390 210,390 300,230 650,230 800,390 894,390", "52,390 210,390 360,570 700,540 800,390 894,390"]},
    {label:"港湾双门", paths:["52,230 260,230 440,310 720,310 894,220", "52,570 250,570 460,450 740,450 894,560"]},
    {label:"潮汐退滩", paths:["52,390 210,390 380,220 670,220 800,410 894,410"], alternate:"52,390 210,390 290,570 700,570 700,390 490,390 490,240 894,240", event:"潮水退去"},
    {label:"珊瑚迷航", paths:["52,220 250,220 250,550 460,550 460,230 680,230 680,550 840,550 894,360"]},
    {label:"对角海峡", paths:["180,185 180,300 410,350 650,270 780,310 894,310", "200,630 370,460 560,500 760,430 894,530"]},
    {label:"漩涡绕航", paths:["52,390 200,220 690,220 810,390 690,570 320,570 320,390 560,390 560,300"]},
    {label:"浮桥转向", paths:["52,300 210,300 390,520 720,520 800,350 894,350"], alternate:"52,300 210,300 210,560 440,560 440,230 730,230 730,390 894,390", event:"浮桥转向"}
  ],
  forest: [
    {label:"林间双环", paths:["52,230 230,230 230,540 470,540 470,230 720,230 720,540 894,390"]},
    {label:"林间调度口", paths:["52,390 230,390 310,220 570,220 690,310 790,390 894,390", "52,390 230,390 360,470 570,570 720,530 790,390 894,390", "52,390 230,390 470,390 790,390 894,390"]},
    {label:"溪谷回头", paths:["52,570 770,570 770,230 230,230 230,400 590,400"]},
    {label:"倒木横路", paths:["52,390 210,390 340,230 710,230 800,420 894,420"], alternate:"52,390 210,390 310,570 560,570 560,400 780,400 780,230 894,230", event:"古树倒伏"},
    {label:"藤蔓双蛇", paths:["52,240 220,240 340,340 520,250 700,340 810,240 894,340", "52,560 200,560 340,470 530,560 700,460 810,560 894,460"]},
    {label:"萤火南北", paths:["230,185 230,320 400,320 560,390 740,390 894,300", "710,630 710,540 410,540 410,460 560,390 740,390 894,300"]},
    {label:"根须方阵", paths:["52,220 390,220 390,400 180,400 180,580 730,580 730,240 894,240"]},
    {label:"根桥生长", paths:["52,300 210,300 360,510 700,510 800,350 894,350"], alternate:"52,300 210,300 360,220 740,220 740,400 410,400 410,580 810,580 894,350", event:"根桥生长"}
  ]
};
const readRoute = text => text.split(" ").map(point => point.split(",").map(Number));
function createRoutes(theme, stage) {
  return ROAD_LAYOUTS[theme][stage - 1].paths.map(readRoute);
}
const LEVELS = CHAPTERS.flatMap((chapter, chapterIndex) => chapter.names.map((name,n) => {
  const stage=n+1,index=chapterIndex*CONFIG.levelsPerChapter+n;
  const layout=ROAD_LAYOUTS[chapter.theme][n];
  const eventKind=[ ["construction","bridge"],["tidal","bridge"],["construction","tidal"],["tunnel","tunnel"],["tidal","bridge"],["tunnel","construction"] ][chapterIndex][stage===4?0:1];
  const eventName={construction:"高架施工改道",tunnel:"隧道封闭绕行",tidal:"潮汐车道切换",bridge:"吊桥开启绕行"}[eventKind];

  return { id:`${chapter.theme}-${stage}`,name,chapter:chapterIndex,stage,theme:chapter.theme,mapNode:chapter.nodes[n],
    subtitle:`${chapter.name} / ${stage%4===0?"首领攻势":"定时进攻"}`,district:chapter.city.split(" / ")[1],
    waves:6+Math.floor(n/3)+Math.min(chapterIndex,2),gold:350+chapterIndex*105+n*28,
    scale:1.12+chapterIndex*.26+n*.045,enemyExtra:Math.floor(chapterIndex*.8+n*.4),
    boss:stage%4===0,bossType:chapter.boss,
    pool:chapter.pool,color:chapter.land,routes:createRoutes(chapter.theme,stage),layout:layout.label,
    mission:["toll","bus","emergency","bridge"][n%4],
    routeEvent:layout.alternate?{wave:stage===4?4:5,name:eventName,kind:eventKind,routes:[readRoute(layout.alternate)]}:null,
    reward:stage===8?"完成本章，开启新的地貌进化":"获取星级，推进防御塔进化研究" };
}));
const stageLabel = index => `${LEVELS[index].chapter + 1}-${LEVELS[index].stage}`;

// ---- src/core/collision.js ----
"use strict";

const Collision = {
  distance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  inside: (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h,
  segmentDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }
};

// ---- src/core/storage.js ----
"use strict";

// 三个独立战役位。只保存通关/研究进度，不保存正在进行的战斗。
const Progress = {
  blank: () => ({schema:3, stars:LEVELS.map(() => 0)}),
  clean(data) {
    return {schema:3, stars:LEVELS.map((_,i) => Number.isInteger(data?.stars?.[i]) ? Math.max(0,Math.min(3,data.stars[i])) : 0)};
  },
  read() {
    const empty={schema:4, activeSlot:0, slots:[null,null,null]};
    try {
      const data=JSON.parse(Platform.storage.getItem(CONFIG.saveKey));
      // 旧版只有一个战役；迁入第一位，保留星级，不猜测原始创建日期。
      if(Array.isArray(data?.stars)) {
        empty.slots[0]={...this.clean(data),createdAt:0,lastPlayedAt:0};
        return empty;
      }
      if(data?.schema!==4||!Array.isArray(data.slots))return empty;
      empty.slots=empty.slots.map((_,i)=>{
        const slot=data.slots[i];
        if(!Array.isArray(slot?.stars))return null;
        return {...this.clean(slot),createdAt:Number.isFinite(slot.createdAt)&&slot.createdAt>0?slot.createdAt:0,
          lastPlayedAt:Number.isFinite(slot.lastPlayedAt)&&slot.lastPlayedAt>0?slot.lastPlayedAt:0};
      });
      empty.activeSlot=Number.isInteger(data.activeSlot)&&empty.slots[data.activeSlot]?data.activeSlot:Math.max(0,empty.slots.findIndex(Boolean));
      return empty;
    } catch { return empty; }
  },
  list() { return this.read().slots; },
  exists() { return this.list().some(Boolean); },
  load(slotId=this.read().activeSlot) { return this.clean(this.read().slots[slotId]); },
  write(data) {
    try { Platform.storage.setItem(CONFIG.saveKey,JSON.stringify(data)); return true; }
    catch { return false; }
  },
  save(progress,slotId=this.read().activeSlot,replace=false) {
    if(!Number.isInteger(slotId)||slotId<0||slotId>=3)return false;
    const data=this.read(),previous=replace?null:data.slots[slotId],now=Date.now();
    data.slots[slotId]={...this.clean(progress),createdAt:previous?previous.createdAt:now,lastPlayedAt:now};
    data.activeSlot=slotId;
    return this.write(data);
  },
  select(slotId) {
    const data=this.read();
    if(!Number.isInteger(slotId)||!data.slots[slotId])return false;
    data.activeSlot=slotId;data.slots[slotId].lastPlayedAt=Date.now();
    return this.write(data);
  },
  dateLabel(timestamp) {
    if(!timestamp)return "旧存档 · 原始日期未记录";
    const date=new Date(timestamp),pad=value=>String(value).padStart(2,"0");
    return `${date.getFullYear()}/${pad(date.getMonth()+1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },
  unlocked(progress) { let index=0;while(index<LEVELS.length-1&&progress.stars[index]>0)index++;return index; }
};

// ---- src/data/music.js ----
"use strict";

// 六首独立的小型配乐：MIDI 音高，null 为休止；八分音符为一个步进。
// 旋律、拍号、速度、和弦、节奏与音色分别配置，完全本地合成。
const MUSIC_TRACKS = {
  city: {
    name: "街灯", bpm: 112, meter: 8, voice: "square", gate: .62,
    melody: [64,null,67,71,69,67,64,null,62,64,67,null,71,74,71,67,64,67,69,71,null,69,67,64,62,null,59,62,64,null,67,null],
    bass: [40,45,36,43], chords: [[52,55,59],[57,60,64],[48,52,55],[55,59,62]], drums: [0,3,4,6]
  },
  country: {
    name: "麦风", bpm: 94, meter: 8, voice: "triangle", gate: .72,
    melody: [67,71,74,71,69,67,64,null,62,64,67,69,71,null,69,67,74,76,74,71,69,71,67,null,64,62,64,67,69,67,62,null],
    bass: [43,36,38,43], chords: [[55,59,62],[48,52,55],[50,54,57],[55,59,62]], drums: [0,4]
  },
  desert: {
    name: "沙影", bpm: 82, meter: 8, voice: "sine", gate: 1.3,
    melody: [62,null,63,66,69,null,70,69,66,63,62,null,57,null,62,null,69,70,74,null,73,70,69,66,63,null,62,57,58,57,54,null],
    bass: [38,34,33,38], chords: [[50,54,57],[46,50,53],[45,49,52],[50,54,57]], drums: [0,2,5,7]
  },
  hills: {
    name: "山行", bpm: 104, meter: 8, voice: "triangle", gate: .9,
    melody: [48,null,55,55,58,null,55,null,53,55,60,null,58,55,53,null,48,51,55,null,60,58,55,51,53,null,55,58,55,null,48,null],
    bass: [36,41,32,43], chords: [[48,51,55],[53,56,60],[44,48,51],[55,58,62]], drums: [0,2,4,6]
  },
  sea: {
    name: "潮歌", bpm: 90, meter: 6, voice: "sine", gate: 1.55,
    melody: [69,73,76,78,76,73,71,74,78,76,74,71,69,73,76,81,78,76,74,73,71,69,null,null,66,69,73,76,73,69,71,73,74,73,71,69],
    bass: [45,47,42,40,38,45], chords: [[57,61,64],[59,62,66],[54,57,61],[52,56,59],[50,54,57],[57,61,64]], drums: [0,3]
  },
  forest: {
    name: "萤火", bpm: 72, meter: 8, voice: "sine", gate: 1.8,
    melody: [76,null,79,null,83,79,null,74,76,null,null,71,74,null,79,null,83,null,86,83,null,79,76,null,74,null,71,null,67,71,null,null],
    bass: [40,36,43,38], chords: [[52,55,59],[48,52,55],[55,59,62],[50,54,57]], drums: [0]
  }
};

// ---- src/core/audio.js ----
"use strict";

// 合成音效与轻量配乐，交通广播从包内WAV播放；首次真实点击后启用音频上下文。
class SoundEngine {
  constructor() {
    this.enabled=true;this.musicEnabled=true;this.context=null;this.voices=new Set();this.musicVoices=new Set();this.theme=null;this.last={};this.note=0;this.nextMusic=0;this.unavailable=false;
    try{const saved=JSON.parse(Platform.storage.getItem("traffic-defense-audio"));if(saved){this.enabled=saved.effects!==false;this.musicEnabled=saved.music!==false;}}catch{}
  }
  unlock() {
    try {
      if(!this.context) {
        this.context=Platform.createAudioContext();
        if(!this.context){this.unavailable=true;return;}
        this.master=this.context.createGain();this.master.gain.value=CONFIG.audioVolume;this.master.connect(this.context.destination);
      }
      if(this.context.state==="suspended")this.context.resume().catch(()=>{});
    }catch{this.unavailable=true;}
  }
  stop(channel = null) {
    if(channel!=="music"&&this.radio){this.radio.pause();this.radio=null;}
    for (const voice of [...this.voices]) {
      const music = this.musicVoices.has(voice);
      if (channel && (channel === "music") !== music) continue;
      try { voice.stop(); } catch {}
      this.voices.delete(voice); this.musicVoices.delete(voice);
    }
    if (channel !== "effects") this.nextMusic = 0;
  }
  toggle(kind) {
    if(kind==="music")this.musicEnabled=!this.musicEnabled;else this.enabled=!this.enabled;
    this.stop(kind === "music" ? "music" : "effects");this.unlock();
    try{Platform.storage.setItem("traffic-defense-audio",JSON.stringify({effects:this.enabled,music:this.musicEnabled}));}catch{}
  }
  tone(frequency,duration=.12,wave="triangle",volume=.15,delay=0,endFrequency=frequency,channel="effects") {
    const c=this.context;if(!c||c.state!=="running"||Platform.hidden||this.voices.size>=24)return;
    const oscillator=c.createOscillator(),gain=c.createGain(),start=c.currentTime+delay;
    oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency,start);oscillator.frequency.exponentialRampToValueAtTime(Math.max(25,endFrequency),start+duration);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    oscillator.connect(gain);gain.connect(this.master);this.voices.add(oscillator);if(channel==="music")this.musicVoices.add(oscillator);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(oscillator);this.musicVoices.delete(oscillator);};
    oscillator.start(start);oscillator.stop(start+duration+.02);
  }
  play(kind) {
    if(!this.enabled||!this.context||this.unavailable)return;
    const now=this.context.currentTime;if(now-(this.last[kind]??-100)<(kind==="brake"?1.8:kind==="rail"?.1:.18))return;this.last[kind]=now;
    if(kind.startsWith("radio-")){
      if(typeof Audio!=="undefined"&&!Platform.hidden){if(this.radio)this.radio.pause();this.radio=new Audio(`assets/audio/${kind}.wav`);this.radio.volume=.55;this.radio.play().catch(()=>{});}
      return;
    }
    if(kind==="rail")this.tone(730,.08,"triangle",.13,0,180);
    else if(kind==="signal")[660,440].forEach((f,i)=>this.tone(f,.08,"sine",.1,i*.09));
    else if(kind==="missile"){this.tone(140,.22,"triangle",.14,0,55);this.tone(850,.06,"square",.04,.1,430);}
    else if(kind==="strike")this.tone(105,.28,"sawtooth",.16,0,28);
    else if(kind==="gate")[880,660].forEach((f,i)=>this.tone(f,.11,"sine",.14,i*.13));
    else if(kind==="brake"){this.tone(1100,.3,"sawtooth",.035,0,230);this.tone(180,.22,"triangle",.1);}
    else if(kind==="engine")for(let i=0;i<10;i++)this.tone(68+i%3*8,.3,"triangle",.1,i*.2,62);
    else if(kind==="clash")this.tone(210,.08,"square",.07,0,80);
    else if(kind==="build") [262,392].forEach((f,i)=>this.tone(f,.18,"triangle",.2,i*.1));
    else if(kind==="upgrade"||kind==="win")[262,330,392,523].forEach((f,i)=>this.tone(f,.3,"triangle",.2,i*.12));
    else if(kind==="lose"||kind==="leak")[220,164,110].forEach((f,i)=>this.tone(f,.2,"triangle",.18,i*.09));
    else if(kind==="wave")[196,294,392].forEach((f,i)=>this.tone(f,.18,"square",.09,i*.12));
    else this.tone(530,.1,"sine",.13,0,780);
  }
  musicNote(note, duration, voice, volume) {
    if (note === null || note === undefined) return;
    const frequency = 440 * 2 ** ((note - 69) / 12);
    this.tone(frequency, duration, voice, volume, 0, frequency, "music");
  }
  update(game) {
    const active = this.context && !Platform.hidden && !(game.screen === "battle" && game.paused) && !game.modal;
    if (!active) { if (this.wasActive) this.stop(); this.wasActive = false; return; }
    this.wasActive = true;
    if(this.enabled&&typeof Traffic!=="undefined"&&game.traffic&&this.context.currentTime>=(this.nextEngine||0)){
      const volume=Traffic.engineLevel(game);
      if(volume>0)this.tone(75,.48,"triangle",volume,0,62);
      this.nextEngine=this.context.currentTime+.38;
    }
    const chapter = game.screen === "menu" || game.screen === "home" ? game.menuChapter : game.level.chapter;
    const theme = CHAPTERS[chapter].theme;
    if (theme !== this.theme) { this.stop("music"); this.theme = theme; this.note = 0; }
    if (!this.musicEnabled || this.context.currentTime < this.nextMusic) return;
    const track = MUSIC_TRACKS[theme], step = 30 / track.bpm;
    const beat = this.note % track.meter, bar = Math.floor(this.note / track.meter);
    const note = track.melody[this.note % track.melody.length];
    this.musicNote(note, step * track.gate, track.voice, track.voice === "square" ? .024 : .065);
    if (theme === "forest" && note !== null) this.musicNote(note + 12, step * .7, "sine", .018);
    if (beat === 0) {
      this.musicNote(track.bass[bar % track.bass.length], step * 2.7, "triangle", .075);
      for (const chord of track.chords[bar % track.chords.length]) this.musicNote(chord, step * 3.2, "sine", .014);
    } else if (beat === Math.floor(track.meter / 2)) {
      this.musicNote(track.bass[bar % track.bass.length] + 7, step * 1.4, "triangle", .036);
    }
    if (track.drums.includes(beat)) this.tone(beat === 0 ? 100 : 190, .08, "triangle", .048, 0, 38, "music");
    this.note++;
    // 按音频时钟推进，不受游戏倍速影响；卡顿后不补发积压音符。
    this.nextMusic = this.context.currentTime + step;
  }
}
const Sound = Platform.createSound ? Platform.createSound({config:CONFIG,chapters:CHAPTERS}) : new SoundEngine();

// ---- src/core/road-network.js ----
"use strict";

// 从关卡路线生成唯一节点和有向边，可替换为地图编辑器输出。
class RoadNetwork {
  constructor(level, includeAlternate = false) {
    this.nodes = new Map(); this.edges = [];
    const uniqueEdges = new Set();
    const routes = includeAlternate ? [...level.routes, ...(level.routeEvent?.routes || [])] : level.routes;
    this.routes = routes.map(points => points.map(([x, y]) => {
      const key = `${x},${y}`;
      if (!this.nodes.has(key)) this.nodes.set(key, { x, y });
      return this.nodes.get(key);
    }));
    for (const route of this.routes) for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1];
      // 在已有路口处分段，合流道路只绘制一次，避免长短线段叠画标线。
      const points=[...this.nodes.values()].filter(p=>Collision.segmentDistance(p,a,b)<.001)
        .sort((p,q)=>Collision.distance(a,p)-Collision.distance(a,q));
      for(let n=1;n<points.length;n++){
        const from=points[n-1],to=points[n],key=`${from.x},${from.y}>${to.x},${to.y}`;
        if(!uniqueEdges.has(key)){uniqueEdges.add(key);this.edges.push([from,to]);}
      }
    }
  }
  path(index) { return this.routes[index % this.routes.length]; }
  nearestPoint(p) {
    return this.edges.map(([a,b])=>{
      const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
      return {x:a.x+dx*t,y:a.y+dy*t};
    }).sort((a,b)=>Collision.distance(a,p)-Collision.distance(b,p))[0];
  }
  isRoad(p, margin = 0) {
    return this.edges.some(([a, b]) => Collision.segmentDistance(p, a, b) < CONFIG.roadWidth / 2 + margin);
  }
}
// 隐藏网格的道路旁设备地块：沿每条有向边的两侧采样，再剔除路口、越界和相互重叠的位置。
// 结果只由路线和顶部参数决定，重玩关卡不会重新随机布点。
function planConstructionSites(level) {
  // 为所有可能的道路预留空间，变道后既不吞塔，也不改变地块编号。
  const road = new RoadNetwork(level, true), sites = [];
  for (const [a, b] of road.edges) {
    const length = Collision.distance(a, b), steps = Math.max(1, Math.floor(length / CONFIG.spacing));
    const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
    for (let step = 0; step < steps; step++) for (const side of [-1, 1]) {
      const fraction = (step + 0.5) / steps;
      const p = { x: Math.round(a.x + (b.x - a.x) * fraction + nx * CONFIG.siteRoadOffset * side),
        y: Math.round(a.y + (b.y - a.y) * fraction + ny * CONFIG.siteRoadOffset * side) };
      if (p.x < MAP.x+36 || p.x > MAP.x+MAP.w-42 || p.y < MAP.y+79 || p.y > MAP.y+MAP.h-49 || road.isRoad(p, CONFIG.towerRadius + 7)) continue;
      if (sites.some(other => Collision.distance(p, other) < CONFIG.spacing)) continue;
      sites.push(p);
    }
  }
  return sites.map(({x, y}) => [x, y]);
}
LEVELS.forEach(level => { level.sites = planConstructionSites(level); });

// ---- src/core/traffic.js ----
"use strict";

// 交通规则独立于绘制；所有计时都使用战斗时间，暂停、后台和倍速行为一致。
const ROAD_TYPES = {
  express: {name:"快速路",limit:80,speed:1.18,color:"#709da6"},
  street: {name:"城区路",limit:50,speed:1,color:"#829398"},
  dirt: {name:"砂石路",limit:30,speed:.85,heavy:.75,color:"#c5ad7a"},
  sand: {name:"沙地路",limit:30,speed:.9,heavy:.72,color:"#ddbb80"},
  slope: {name:"上坡路",limit:40,speed:.88,heavy:.72,color:"#a4a89f"},
  bridge: {name:"窄桥",limit:30,speed:.82,color:"#c4b39a"},
  channel: {name:"航道",limit:40,speed:1.08,color:"#76b9c5"}
};
const TRAFFIC_MISSIONS = {
  toll: {name:"守住收费站",brief:"守住收费设施，耐久归零失败",action:"落杆拦截"},
  bus: {name:"护送公交车",brief:"第2波与倒数第2波出车，两辆均须安全送达",action:"开启护航"},
  emergency: {name:"保障急救通道",brief:"第3波与倒数第2波出车，两辆均须限时通过",action:"优先放行"},
  bridge: {name:"保护桥梁",brief:`敌车在桥上持续损伤结构，可花${CONFIG.bridgeRepairCost}G抢修`,action:`抢修 ${CONFIG.bridgeRepairCost}G`}
};
const Traffic = {
  mission(level) { return TRAFFIC_MISSIONS[level.mission]; },
  fork(road) {
    if(road.routes.length<2)return null;
    const first=road.path(0);let prefix=0;
    while(prefix<first.length && road.routes.every(route=>route[prefix]&&Collision.distance(route[prefix],first[prefix])<.01))prefix++;
    return prefix>=2 && prefix<first.length ? {node:first[prefix-1],segment:prefix-1} : null;
  },
  init(game) {
    const path=game.road.path(0),i=Math.max(1,path.length-3),a=path[i],b=path[i+1];
    game.traffic={fork:this.fork(game.road),branch:0,switchCooldown:0,actionCooldown:0,activeTime:0,
      integrity:100,delivered:0,civilians:[],pending:[],scheduled:0,clock:0,failed:"",warned:false,
      bridge:{a,b,x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
    game.failureReason="";
  },
  path(game,index=0) { return game.road.path(game.traffic?.fork?game.traffic.branch:index); },
  switchRoute(game) {
    const t=game.traffic;
    if(game.screen!=="battle"||game.modal||!t?.fork||t.switchCooldown>0)return false;
    t.branch=(t.branch+1)%game.road.routes.length;t.switchCooldown=CONFIG.trafficSwitchCooldown;
    const path=this.path(game);
    // 只换尚未进入岔道的车辆，保留位置/生命/时间；绝不把驶出的车拉回。
    for(const actor of [...game.enemies,...t.civilians])if(!actor.dead&&actor.segment<t.fork.segment)actor.path=path;
    Sound.play("gate");game.notify(`导航切换到 ${String.fromCharCode(65+t.branch)} 线；已过岔口车辆继续原路。`);
    return true;
  },
  type(level,path,segment) {
    if(level.mission==="bridge"&&segment===Math.max(1,path.length-3))return "bridge";
    if(segment===path.length-2)return "street";
    const terrain={city:"express",country:"dirt",desert:"sand",hills:"slope",sea:"channel",forest:"dirt"}[level.theme];
    return segment%3===0 ? "street" : terrain;
  },
  speed(game,actor) {
    const road=ROAD_TYPES[this.type(game.level,actor.path,actor.segment)];
    const heavy=actor.spec&&(actor.spec.boss||actor.spec.armor>=.2);
    let factor=heavy&&road.heavy?road.heavy:road.speed;
    const a=actor.path[actor.segment],b=actor.path[actor.segment+1],c=actor.path[actor.segment+2];
    if(a&&b&&c&&Collision.distance(actor,b)<32){
      const dot=((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))/(Collision.distance(a,b)*Collision.distance(b,c));
      if(dot<.8)factor*=.8;
    }
    return factor;
  },
  onWave(game) {
    const t=game.traffic,kind=game.level.mission,event=game.level.routeEvent;
    if((kind==="bus"||kind==="emergency")&&[kind==="bus"?2:3,game.level.waves-1].includes(game.wave)){
      t.pending.push(kind);t.scheduled++;
      Sound.play(`radio-${kind}`);game.notify(kind==="bus"?"公交准备出站：清理沿途敌车，护航可提供短暂保护。":"急救车准备出发：清理拥堵，优先放行可短暂突破封锁。");
    }
    if(event&&!t.warned&&game.wave===event.wave-1){
      t.warned=true;Sound.play(`radio-${event.kind}`);
      game.notify(`交通预告：第 ${event.wave} 波${event.name}，黄色虚线即将启用。`);
    }
  },
  onRouteEvent(game) {
    const t=game.traffic;
    const path=game.road.path(0);
    for(const actor of t.civilians)if(!actor.dead&&actor.segment===0&&[0,1].every(i=>Collision.distance(actor.path[i],path[i])<.01))actor.path=path;
    t.fork=this.fork(game.road);t.branch=0;Sound.play("gate");
  },
  action(game) {
    const t=game.traffic,kind=game.level.mission;
    if(game.screen!=="battle"||game.modal||game.paused||t.actionCooldown>0)return false;
    if(kind==="bridge"){
      if(game.gold<CONFIG.bridgeRepairCost||t.integrity>=100)return false;
      game.gold-=CONFIG.bridgeRepairCost;t.integrity=Math.min(100,t.integrity+CONFIG.bridgeRepairAmount);t.actionCooldown=CONFIG.bridgeRepairCooldown;
      game.float(t.bridge,`抢修 +${CONFIG.bridgeRepairAmount}`,COLORS.mint);
    }else{
      if(kind!=="toll"&&!t.civilians.some(c=>!c.dead))return false;
      t.activeTime=kind==="toll"?CONFIG.tollHold:kind==="emergency"?CONFIG.emergencyPriority:CONFIG.escortProtection;
      t.actionCooldown=kind==="emergency"?CONFIG.emergencyCooldown:CONFIG.trafficActionCooldown;
    }
    Sound.play("gate");return true;
  },
  onEscape(game,enemy) {
    if(game.level.mission==="toll"){
      game.traffic.integrity=Math.max(0,game.traffic.integrity-enemy.spec.leak*8);
      if(game.traffic.integrity<=0)game.traffic.failed="收费站被突破";
    }
  },
  enemyMotion(game,enemy,factor) {
    const t=game.traffic;
    if(game.level.mission==="toll"&&t.activeTime>0&&enemy.remaining<72)factor=0;
    if((enemy.spec.boss||enemy.spec.armor>=.2)&&factor<.85&&(enemy.lastRoadFactor??1)>=.85)Sound.play("brake");
    enemy.lastRoadFactor=factor;return factor;
  },
  update(game,dt) {
    const t=game.traffic;t.clock+=dt;
    for(const key of ["switchCooldown","actionCooldown","activeTime"])t[key]=Math.max(0,t[key]-dt);
    if(t.pending.length){
      const path=this.path(game);
      if(![...t.civilians,...game.enemies].some(c=>!c.dead&&Collision.distance(c,path[0])<45))t.civilians.push(new CivilVehicle(t.pending.shift(),path));
    }
    if(game.level.mission==="bridge"){
      let load=0;
      for(const enemy of game.enemies)if(!enemy.dead&&Collision.distance(enemy,t.bridge)<72&&Collision.segmentDistance(enemy,t.bridge.a,t.bridge.b)<22)
        load+=enemy.spec.boss?1.5:enemy.spec.armor>=.2?.6:.2;
      t.integrity=Math.max(0,t.integrity-load*dt);
      if(t.integrity<=0)t.failed="桥梁结构损毁";
    }
    for(const civilian of t.civilians)if(!civilian.dead)civilian.update(dt,game);
    t.civilians=t.civilians.filter(c=>!c.dead);
    if(t.failed){game.failureReason=t.failed;game.finish(false);}
  },
  complete(game) {
    const t=game.traffic;
    return !t.failed && (!["bus","emergency"].includes(game.level.mission)||t.delivered===2);
  },
  status(game) {
    const t=game.traffic,kind=game.level.mission,name=this.mission(game.level).name;
    if(kind==="toll"||kind==="bridge")return `${name} · 耐久 ${Math.ceil(t.integrity)}%`;
    const car=t.civilians[0];
    return `${name} ${t.delivered}/2${car?kind==="bus"?` · 车况 ${Math.ceil(car.health)}%`:` · 余 ${Math.ceil(car.deadline)}秒`:t.delivered===2?" · 已全部送达":t.pending.length?" · 准备出发":" · 等待出车"}`;
  },
  eventText(game) {
    const event=game.level.routeEvent;
    if(game.routeChanged)return `${event.name} · 新路启用，旧车驶离`;
    const countdown=game.wave===event.wave-1&&!game.spawnQueue.length?` · ${Math.ceil(game.prepareTime)}秒后`:"";
    return `第${event.wave}波 ${event.name}${countdown} · 黄虚线为新路`;
  },
  // 唯一环境声源；听点位于地图下沿中央，距离决定音量，不逐车堆叠播放器。
  engineLevel(game) {
    if(game.screen!=="battle"||game.paused||game.modal)return 0;
    const cars=game.enemies.filter(e=>!e.dead&&!e.blocker&&e.stunTime<=0);
    if(!cars.length)return 0;
    const listener={x:MAP.x+MAP.w/2,y:MAP.y+MAP.h};
    const distance=Math.min(...cars.map(car=>Collision.distance(car,listener)));
    return .025+.12*Math.max(0,1-distance/(MAP.w*.85));
  }
};

class CivilVehicle {
  constructor(kind,path) {
    this.kind=kind;this.path=path;this.segment=0;this.x=path[0].x;this.y=path[0].y;this.angle=0;
    this.health=100;this.dead=false;this.speed=kind==="bus"?66:90;
    const length=path.slice(1).reduce((sum,p,i)=>sum+Collision.distance(path[i],p),0);
    // 按出发路线长度给出可达的时限；之后改道不重置倒计时。
    this.deadline=length/(this.speed*.7)+24;
  }
  update(dt,game) {
    const t=game.traffic,near=game.enemies.filter(e=>!e.dead&&Collision.distance(e,this)<65);
    const destination=this.path[this.segment+1];
    this.angle=Math.atan2(destination.y-this.y,destination.x-this.x);
    const priority=t.activeTime>0;
    if(this.kind==="bus"&&!priority)this.health-=Math.min(3,near.length)*2.6*dt;
    if(this.kind==="emergency")this.deadline-=dt;
    // 只把前方同一通行带的敌车算作阻挡；身后车辆、并行道路不会锁死急救车。
    const blockedAhead=near.some(e=>{
      const dx=e.x-this.x,dy=e.y-this.y,ahead=dx*Math.cos(this.angle)+dy*Math.sin(this.angle);
      const lateral=Math.abs(-dx*Math.sin(this.angle)+dy*Math.cos(this.angle));
      return ahead>=-8&&ahead<60&&lateral<22;
    });
    this.blocked=this.kind==="emergency"&&blockedAhead&&!priority;
    if(this.health<=0||this.deadline<=0){this.dead=true;t.failed=this.kind==="bus"?"公交车未能安全送达":"急救车超过通行时限";return;}
    let step=this.blocked?0:this.speed*Traffic.speed(game,this)*dt;
    while(step>0&&!this.dead){
      const target=this.path[this.segment+1],distance=Collision.distance(this,target);
      this.angle=Math.atan2(target.y-this.y,target.x-this.x);
      if(step>=distance){this.x=target.x;this.y=target.y;this.segment++;step-=distance;
        if(this.segment===this.path.length-1){this.dead=true;t.delivered++;game.float(this,"安全送达",COLORS.mint);Sound.play("gate");}
      }else{this.x+=Math.cos(this.angle)*step;this.y+=Math.sin(this.angle)*step;step=0;}
    }
  }
}

// ---- src/entities.js ----
"use strict";

class Enemy {
  static bodyLength(spec) {
    const visual=spec.visual||Object.keys(ENEMIES).find(key=>ENEMIES[key]===spec);
    return (spec.boss?54:visual==="runner"||visual==="swarm"?23:visual==="splitter"?37:32)*CONFIG.enemyVisualScale;
  }
  get bodyLength() { return this.length; }
  constructor(type, path, scale = 1) {
    this.type = type; this.spec = ENEMIES[type]; this.path = path; this.scale = scale;
    this.length=Enemy.bodyLength(this.spec);
    this.segment = 0; this.x = path[0].x; this.y = path[0].y;
    this.maxHealth = this.spec.hp * scale * (this.spec.boss?CONFIG.bossHealthMultiplier:CONFIG.enemyHealthMultiplier); this.health = this.maxHealth;
    this.maxShield = (this.spec.shield || 0) * scale; this.shield = this.maxShield;
    this.slowTime = 0; this.slowFactor = 1; this.stunTime = 0;
    this.burnTime = 0; this.burnDamage = 0; this.sinceHit = 0; this.healTimer = 1.2;
    this.dead = false; this.angle = 0; this.shredTime=0; this.shredAmount=0; this.jamTime=0;
  }
  get remaining() {
    let distance = Collision.distance(this, this.path[this.segment + 1] || this);
    for (let i = this.segment + 1; i < this.path.length - 1; i++) distance += Collision.distance(this.path[i], this.path[i + 1]);
    return distance;
  }
  slow(factor, duration) {
    const effective = 1 - (1 - factor) * (1 - (this.spec.slowResist || 0));
    this.slowFactor = this.slowTime > 0 ? Math.min(this.slowFactor, effective) : effective;
    this.slowTime = Math.max(this.slowTime, duration);
  }
  stun(duration) { this.stunTime = Math.max(this.stunTime, duration * (1 - (this.spec.slowResist || 0))); }
  hit(damage, game, options = {}) {
    if (this.dead) return;
    this.sinceHit = 0;
    const multiplier = options.shieldMultiplier || 1;
    const absorbed = Math.min(this.shield, damage * multiplier);
    this.shield -= absorbed;
    damage = Math.max(0, damage - absorbed / multiplier);
    this.health -= damage * (options.pierce ? 1 : 1 - (Math.max(0,(this.spec.armor || 0)-(this.shredTime>0?this.shredAmount:0))));
    if (this.health <= 0) {
      if(this.blocker)this.blocker.release();
      this.dead = true; game.gold += this.spec.reward; game.kills++;
      game.effect(this, this.spec.color, 25); game.float(this, `+${this.spec.reward}`, COLORS.gold);
      if (this.spec.split) for (let i = 0; i < this.spec.split; i++) {
        const child = new Enemy(this.spec.splitType || "swarm", this.path, this.scale);
        child.x = this.x; child.y = this.y; child.segment = this.segment;child.angle=this.angle;
        // 子车沿已走过的道路依次排开，避免同一坐标一次堆出多个图形。
        child.moveBack((i+1)*(child.bodyLength+CONFIG.trafficGap));
        game.enemies.push(child);
      }
    }
  }
  moveBack(distance) {
    while(distance>0){
      const target=this.path[this.segment],remaining=Collision.distance(this,target);
      if(remaining>=distance&&remaining>0){
        this.x+=(target.x-this.x)*distance/remaining;this.y+=(target.y-this.y)*distance/remaining;return;
      }
      this.x=target.x;this.y=target.y;distance-=remaining;
      if(this.segment===0){
        const next=this.path[1],length=Collision.distance(target,next);
        this.x-=(next.x-target.x)*distance/length;this.y-=(next.y-target.y)*distance/length;return;
      }
      this.segment--;
    }
  }
  followingDistance(game,distance) {
    const from=this.path[this.segment],to=this.path[this.segment+1];
    if(!to)return distance;
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
    let ownRemaining;this.passOffset=0;
    for(const other of game.enemies){
      if(other===this||other.dead||Collision.distance(this,other)>90)continue;
      let ahead;
      if(other.path===this.path){
        ownRemaining??=this.remaining;ahead=ownRemaining-other.remaining;
      }else{
        // 分流/合流的共用直线路段同样保持车距；不同支路互不阻挡。
        const a=other.path[other.segment],b=other.path[other.segment+1];
        if(!b||dx*(b.x-a.x)+dy*(b.y-a.y)<=0||Math.abs(dx*(b.y-a.y)-dy*(b.x-a.x))>.01||Collision.segmentDistance(other,from,to)>1)continue;
        ahead=((other.x-this.x)*dx+(other.y-this.y)*dy)/length;
      }
      if(ahead>0){
        // 勤务队员只能拦住自己的目标，后车可从路肩绕过，不能一人锁死整波车队。
        if(other.blocker||other.stunTime>0){if(ahead<65)this.passOffset=10;continue;}
        distance=Math.min(distance,Math.max(0,ahead-(this.bodyLength+other.bodyLength)/2-CONFIG.trafficGap));
      }
    }
    return distance;
  }
  update(dt, game) {
    this.sinceHit += dt;
    this.shredTime=Math.max(0,this.shredTime-dt);this.jamTime=Math.max(0,this.jamTime-dt);
    if (this.burnTime > 0) {
      this.hit(this.burnDamage * Math.min(dt, this.burnTime) * (1-(this.spec.burnResist||0)), game, { pierce: true });
      this.burnTime = Math.max(0, this.burnTime - dt);
      if (this.dead) return;
    }
    if (this.sinceHit > 3 && this.maxShield && this.jamTime === 0) this.shield = Math.min(this.maxShield, this.shield + this.spec.regen * dt);
    if (this.spec.heal) {
      this.healTimer -= dt;
      if (this.healTimer <= 0) {
        this.healTimer = 1.2;
        let healed = false;
        for (const other of game.enemies) if (other !== this && !other.dead && other.health < other.maxHealth && Collision.distance(this, other) < 85) {
          other.health = Math.min(other.maxHealth, other.health + this.spec.heal * this.scale); healed = true;
        }
        if (healed) game.effect(this, "#7ee6b3", 85);
      }
    }
    const stunned = this.stunTime > 0;
    this.stunTime = Math.max(0, this.stunTime - dt);
    const factor = this.slowTime > 0 ? this.slowFactor : 1;
    this.slowTime = Math.max(0, this.slowTime - dt);
    const guard=this.blocker;
    if(guard && guard.alive && guard.target===this && game.towers.includes(guard.owner) && Collision.distance(this,guard)<35) {
      this.meleeCooldown=Math.max(0,(this.meleeCooldown||0)-dt);
      if(!stunned&&this.meleeCooldown===0) {
        guard.hit((this.spec.boss?38:this.spec.armor?16:10)*Math.sqrt(this.scale));
        this.meleeCooldown=.95;
      }
      return;
    }
    this.blocker=null;
    const roadFactor=Traffic.enemyMotion(game,this,Traffic.speed(game,this));
    let distance = stunned ? 0 : this.followingDistance(game,this.spec.speed * factor * roadFactor * dt);
    while (distance > 0 && !this.dead) {
      const target = this.path[this.segment + 1];
      if (!target) { this.escape(game); break; }
      const remaining = Collision.distance(this, target);
      this.angle = Math.atan2(target.y - this.y, target.x - this.x);
      if (distance >= remaining) {
        this.x = target.x; this.y = target.y; distance -= remaining; this.segment++;
        if (this.segment === this.path.length - 1) this.escape(game);
      } else {
        this.x += Math.cos(this.angle) * distance; this.y += Math.sin(this.angle) * distance; distance = 0;
      }
    }
  }
  escape(game) {
    Sound.play("leak");
    Traffic.onEscape(game,this);
    this.dead = true; game.lives = Math.max(0, game.lives - this.spec.leak);
    game.effect(this, COLORS.red, 32); game.float(this, `-${this.spec.leak} ♥`, COLORS.red);
  }
}
// 1→2基础强化，2→3选择专精，3→4强化专精。专精本局不能切换。
class Tower {
  constructor(type, x, y, theme="city") {
    this.theme=theme; this.soldiers=[]; this.rally=null;
    this.type = type; this.x = x; this.y = y; this.level = 1; this.branch = null;
    this.fireTime = 0; this.cooldown = 0; this.angle = -Math.PI / 2; this.invested = TOWERS[type].cost;
    this.targetMode = 0; this.focusTarget = null; this.focusStacks = 0;
  }
  get spec() { return TOWERS[this.type]; }
  get paths() { return pathsFor(this.type,this.theme); }
  get stats() {
    const base = this.spec;
    const stats = { ...base, damage: base.damage * (this.level >= 2 ? 1.45 : 1), range: base.range + (this.level >= 2 ? CONFIG.towerUpgradeRange : 0) };
    if (this.branch !== null) {
      const path = this.paths[this.branch];
      stats.damage *= path.damage || 1; stats.range += path.range || 0; stats.cooldown *= path.cooldown || 1;
      for (const key of ["pierce", "slow", "duration", "stun", "splash", "burn", "multi", "chain", "chainRange", "shieldMultiplier", "focus", "focusGain", "repair", "shred", "jam"]) {
        if (path[key] !== undefined) stats[key] = path[key];
      }
    }
    if(this.type==="depot") {
      const path=this.branch===null?{}:this.paths[this.branch];
      stats.soldierHealth=base.soldierHealth*(1+(this.level-1)*.4)*(path.soldierHealth||1);
      for(const key of ["soldierCount","soldierArmor","soldierRegen","respawn"]) if(path[key]!==undefined)stats[key]=path[key];

    }
    if(this.branch!==null)stats.color=THEME_EQUIPMENT[this.theme].colors[this.branch];
    if (this.level === 4) { stats.damage *= 1.4; stats.range += CONFIG.towerFinalRange; }
    if(this.type==="depot")stats.rallyRange=stats.range;
    return stats;
  }
  // 发射时快照外观，飞行中的弹体不会因随后升级而改变。
  get visual() {
    const stats=this.stats;
    return {type:this.type,level:this.level,branch:this.branch,theme:this.theme,color:stats.color,beamStyle:stats.chain?"chain":"focus"};
  }
  get name() { return this.branch === null ? this.spec.name : this.paths[this.branch].name; }
  get upgradeCost() { return Math.round(this.spec.cost * (this.level === 1 ? 0.75 : 1.2)); }
  get sellValue() { return Math.floor(this.invested * CONFIG.sellRatio); }
  update(dt, game) {
    this.fireTime = Math.max(0, this.fireTime - dt);
    if(this.type==="depot") {
      if(!this.rally)this.rally=(game.buildRoad||game.road).nearestPoint(this);
      while(this.soldiers.length<this.stats.soldierCount)this.soldiers.push(new Soldier(this,this.soldiers.length));
      this.soldiers.forEach(s=>s.update(dt,game));return;
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    const stats = this.stats;
    if (stats.repair) {
      this.supportTimer = (this.supportTimer || 0) - dt;
      if (this.supportTimer <= 0) {
        this.supportTimer = 1.5;
        const allies = game.towers.flatMap(t => t.soldiers).filter(s => s.alive && s.health < s.maxHealth && Collision.distance(this, s) <= stats.range);
        for (const soldier of allies) soldier.health = Math.min(soldier.maxHealth, soldier.health + stats.repair);
        if (allies.length) game.effect(this, "#aee5b1", stats.range);
      }
    }
    const candidates = game.enemies.filter(e => !e.dead && Collision.distance(this, e) <= stats.range);
    candidates.sort((a, b) => {
      if (this.targetMode === 1) return (b.health + b.shield) - (a.health + a.shield);
      if (this.targetMode === 2) return Number(Boolean(b.spec.heal)) - Number(Boolean(a.spec.heal)) || a.remaining - b.remaining;
      return a.remaining - b.remaining;
    });
    if (!candidates.length) { this.focusTarget = null; this.focusStacks = 0; return; }
    const target = candidates[0];
    this.angle = Math.atan2(target.y - this.y, target.x - this.x);
    if (this.cooldown > 0) return;
    this.fireTime = .24;
    let damage = stats.damage;
    if (stats.focus) {
      this.focusStacks = this.focusTarget === target ? Math.min(5, this.focusStacks + 1) : 0;
      this.focusTarget = target; damage *= 1 + this.focusStacks * (stats.focusGain || .25);
    }
    // 信号站是周期性区域设备：基础形态同时干扰范围内车辆。
    // 跳频/聚焦专精改为连锁或定向输出；双目标专精保留独立锁定。
    if (this.type === "signal" && !stats.chain && !stats.focus && !stats.multi) {
      const radius = stats.range;
      candidates.filter(enemy => Collision.distance(this, enemy) <= radius)
        .forEach(enemy => applyHit(enemy, damage, stats, game));
      game.effect(this, stats.color, radius, this.visual, "pulse");
      this.cooldown = stats.cooldown;
      Sound.play(this.type);
      return;
    }
    for (const enemy of candidates.slice(0, stats.multi || 1)) {
      if (stats.chain || (this.type === "signal" && !stats.splash)) {
        let current = enemy, from = this;
        const visited = new Set();
        for (let i = 0; current && i < (stats.chain || 1); i++) {
          game.beam(from, current, stats.color, this.visual);
          applyHit(current, damage * (stats.chain ? 0.86 ** i : 1), stats, game);
          visited.add(current); from = current;
          current = game.enemies.filter(e => !e.dead && !visited.has(e) && Collision.distance(from, e) <= stats.chainRange)
            .sort((a, b) => Collision.distance(from, a) - Collision.distance(from, b))[0];
        }
      } else game.projectiles.push(new Projectile(this, enemy, { ...stats, damage }));
    }
    this.cooldown = stats.cooldown;
    Sound.play(this.type);
  }
}
// 一个队员只拦截一辆车；接近后才能拦车，阵亡、出售或调动会立即解除阻挡。
class Soldier {
  constructor(owner,slot) {
    this.owner=owner;this.slot=slot;this.x=owner.x;this.y=owner.y;
    this.health=owner.stats.soldierHealth;this.maxHealth=this.health;
    this.cooldown=0;this.swingTime=0;this.angle=0;this.respawnRemaining=0;this.target=null;
  }
  get alive(){return this.health>0;}
  release(){if(this.target?.blocker===this)this.target.blocker=null;this.target=null;}
  hit(damage){
    this.health=Math.max(0,this.health-damage*(1-this.owner.stats.soldierArmor));
    if(!this.alive){this.release();this.respawnRemaining=this.owner.stats.respawn;}
  }
  update(dt,game){
    this.swingTime=Math.max(0,this.swingTime-dt);
    const stats=this.owner.stats,rally=this.owner.rally;
    if(stats.soldierHealth!==this.maxHealth){if(this.alive)this.health+=stats.soldierHealth-this.maxHealth;this.maxHealth=stats.soldierHealth;}
    if(!this.alive){
      this.respawnRemaining=Math.max(0,this.respawnRemaining-dt);
      if(!this.respawnRemaining){this.health=this.maxHealth;this.x=this.owner.x;this.y=this.owner.y;}
      return;
    }
    this.health=Math.min(this.maxHealth,this.health+(stats.soldierRegen||0)*dt);
    this.cooldown=Math.max(0,this.cooldown-dt);
    if(this.target&&(this.target.dead||Collision.distance(this.target,rally)>CONFIG.soldierLeash||(this.target.blocker&&this.target.blocker!==this)))this.release();
    if(!this.target)this.target=game.enemies.filter(e=>!e.dead&&!e.blocker&&Collision.distance(e,rally)<=CONFIG.soldierLeash
      && !game.towers.some(t=>t.soldiers.some(s=>s!==this&&s.alive&&s.target===e)))
      .sort((a,b)=>a.remaining-b.remaining)[0]||null;
    const destination=this.target||{x:rally.x+Math.cos(this.slot*2.4)*12,y:rally.y+Math.sin(this.slot*2.4)*12};
    const distance=Collision.distance(this,destination);
    if(this.target&&distance<=CONFIG.soldierCatch){
      this.target.blocker=this;
      if(!this.cooldown){
        const target=this.target;this.angle=Math.atan2(target.y-this.y,target.x-this.x);
        this.swingTime=.24;this.owner.fireTime=.24;
        game.effect(target,stats.color,this.owner.level>=3?19:10,this.owner.visual,"strike");
        applyHit(target,stats.damage,stats,game);this.cooldown=stats.cooldown;
        Sound.play("clash");if(target.dead)this.release();
      }
    } else if(distance>1){const step=Math.min(distance,CONFIG.soldierSpeed*dt);this.x+=(destination.x-this.x)/distance*step;this.y+=(destination.y-this.y)/distance*step;}
  }
}
function applyHit(enemy, damage, stats, game) {
  enemy.hit(damage, game, stats);
  if (enemy.dead) return;
  if (stats.shred) {enemy.shredTime=4;enemy.shredAmount=Math.max(enemy.shredAmount,stats.shred);}
  if (stats.jam) enemy.jamTime=Math.max(enemy.jamTime,stats.jam);
  if (stats.slow) enemy.slow(stats.slow, stats.duration);
  if (stats.stun) enemy.stun(stats.stun);
  if (stats.burn) { enemy.burnDamage = Math.max(enemy.burnDamage, stats.burn); enemy.burnTime = Math.max(enemy.burnTime, stats.duration); }
}
class Projectile {
  constructor(tower, target, stats) {
    this.x = tower.x; this.y = tower.y; this.target = target;
    this.visual = tower.visual;
    this.type = tower.type; this.origin = {x: tower.x, y: tower.y}; this.travelled = 0;
    this.destination = { x: target.x, y: target.y }; this.stats = stats; this.dead = false;
  }
  update(dt, game) {
    if (!this.target.dead) this.destination = { x: this.target.x, y: this.target.y };
    const distance = Collision.distance(this, this.destination), step = CONFIG.projectileSpeed * dt;
    this.travelled += Math.min(distance, step);
    if (distance <= step) {
      this.dead = true;
      const victims = this.stats.splash ? game.enemies.filter(e => !e.dead && Collision.distance(e, this.destination) <= this.stats.splash)
        : (this.target.dead ? [] : [this.target]);
      victims.forEach(e => applyHit(e, this.stats.damage, this.stats, game));
      game.effect(this.destination, this.stats.color, this.stats.splash || 12, this.visual);
    } else {
      this.x += (this.destination.x - this.x) / distance * step; this.y += (this.destination.y - this.y) / distance * step;
    }
  }
}

// ---- src/game.js ----
"use strict";

// Game 负责流程与交互；渲染器只绘制状态并登记可见按钮。
class Game {
  constructor() {
    this.activeSlot = Progress.read().activeSlot;
    this.progress = Progress.load(this.activeSlot); this.hasSave = Progress.exists();
    this.screen = Platform.touch ? "home" : "menu"; this.modal = null; this.buttons = [];
    this.pointer = { x: -100, y: -100 }; this.levelIndex = 0; this.menuLevel = this.unlocked;
    this.menuChapter = LEVELS[this.menuLevel].chapter;
    this.message = "完成关卡，解锁防御塔进化研究。"; this.messageTime = 0; this.saveFailed = false;
    this.lastTime = null; this.accumulator = 0;
    Platform.bindInput(this, canvas);
    requestAnimationFrame(time => this.frame(time));
  }
  get unlocked() { return Progress.unlocked(this.progress); }
  get completed() { return this.progress.stars.filter(value=>value>0).length; }
  newCampaign(confirmed = false) {
    if (!confirmed) { this.saveMode="new"; this.modal="saveSlots"; this.buttons=[]; return; }
    if (!Number.isInteger(this.pendingSlot)||this.pendingSlot<0||this.pendingSlot>=3)return false;
    this.activeSlot=this.pendingSlot;this.pendingSlot=null;
    this.progress = Progress.blank(); this.saveFailed = !Progress.save(this.progress,this.activeSlot,true);
    this.hasSave = !this.saveFailed; this.menuLevel = 0; this.menuChapter = 0;
    this.screen = "menu"; this.modal = null; this.buttons = []; this.cancel();
    if(this.saveFailed)this.notify("保存失败，本次进度暂留在游戏内。");
  }
  chooseSaveSlot(slotId) {
    if(!Number.isInteger(slotId)||slotId<0||slotId>=3||this.modal!=="saveSlots")return false;
    if(this.saveMode==="load")return this.loadCampaign(slotId);
    this.pendingSlot=slotId;
    if(Progress.list()[slotId]){this.modal="newCampaign";this.buttons=[];return;}
    this.newCampaign(true);
  }
  loadCampaign(slotId) {
    if(slotId===undefined){this.saveMode="load";this.modal="saveSlots";this.buttons=[];return;}
    if(!Number.isInteger(slotId)||slotId<0||slotId>=3||!Progress.list()[slotId])return false;
    this.activeSlot=slotId;this.progress=Progress.load(slotId);this.saveFailed=!Progress.select(slotId);
    this.hasSave = true; this.menuLevel = this.unlocked;
    this.menuChapter = LEVELS[this.menuLevel].chapter; this.screen = "menu"; this.modal = null; this.buttons = []; this.cancel();
    return true;
  }
  openLevel(index) {
    if (this.screen !== "menu" || !Number.isInteger(index) || !LEVELS[index]) return;
    this.menuLevel = index; this.modal = "level"; this.buttons = [];
  }
  towerUnlocked(type) { return Object.prototype.hasOwnProperty.call(TOWERS,type); }
  selectChapter(index) {
    if (this.screen !== "menu" || !Number.isInteger(index) || !CHAPTERS[index]) return;
    this.menuChapter = index;
    const first = LEVELS.findIndex(level => level.chapter === index);
    this.menuLevel = Math.max(first, Math.min(first + CONFIG.levelsPerChapter - 1, this.unlocked));
    this.messageTime = 0;
  }
  getDeck() { return [...TOWER_ORDER]; }
  branchUnlocked(type,theme,branch) { return this.completed>=evolutionRequirement(type,theme,branch); }
  setRally(p) {
    const t=this.rallyTower;
    if(!t||!this.towers.includes(t))return false;
    const point=this.buildRoad.nearestPoint(p);
    if(Collision.distance(p,point)>30||Collision.distance(t,point)>t.stats.rallyRange){this.notify("集合点必须在勤务站范围内的道路上。");return false;}
    t.rally=point;t.soldiers.forEach(s=>s.release());this.rallyTower=null;this.selected=t;
    Sound.play("build");this.notify("队员正在前往新的集合点。");return true;
  }
  toCanvas(e) {
    return Platform.toCanvas(e, canvas);
  }
  notify(message) { this.message = message; this.messageTime = 4; }
  cancel() { this.rallyTower = null; this.selectedSite = null; this.skill = null; this.selected = null; this.inspected = null; }
  startLevel(index) {
    if (!Number.isInteger(index) || index < 0 || index > this.unlocked || index >= LEVELS.length) return false;
    const deck = this.getDeck(index);
    if (!deck.length) { this.notify("请先为本关选择至少一种防御塔。"); return false; }
    this.levelIndex = index; this.level = LEVELS[index]; this.road = new RoadNetwork(this.level);
    this.buildRoad = new RoadNetwork(this.level, true);
    this.routeChanged = false; this.previousRoad = null; this.routeFlash = 0;
    this.eventRoad = this.level.routeEvent ? new RoadNetwork({routes:this.level.routeEvent.routes}) : null;
    this.menuLevel = index; this.menuChapter = this.level.chapter; this.loadout = [...deck];
    this.sites = this.level.sites.map(([x, y], id) => ({ x, y, id }));
    this.screen = "battle"; this.modal = null; this.state = "prepare"; this.buttons = []; this.won = false;
    this.lives = CONFIG.lives; this.gold = this.level.gold; this.wave = 0; this.kills = 0;
    this.towers = []; this.enemies = []; this.projectiles = []; this.effects = []; this.floats = []; this.beams = [];
    this.spawnQueue = []; this.spawnTimer = 0; this.spawnIndex = 0;
    this.prepareTime = CONFIG.firstPreparation; this.waveDuration = CONFIG.firstPreparation;
    this.waveGap = CONFIG.waveGapMin; this.lastEarlyReward = 0;
    this.paused = false; this.speed = 1;
    this.skillCooldowns = { strike: 0, freeze: 0 };
    Traffic.init(this);
    this.cancel(); this.accumulator = 0;
    this.notify(Platform.touch?"轻触路边预留空地建塔，轻触炮台升级；顶部按钮暂停部署。":"点击道路旁的预留空地，再选择建造塔型。悬停显示金色边线，空格可暂停部署。");
    if(this.level.routeEvent)this.notify(`第 ${this.level.routeEvent.wave} 波：${this.level.routeEvent.name}。虚线路段将启用，请预留火力。`);
    return true;
  }
  wavePlan(number) {
    const pool = this.level.pool, available = pool.slice(0, Math.min(pool.length, number + 1));
    const count = 7 + number * 2 + (this.level.enemyExtra ?? this.levelIndex * 2);
    // 支援单位较少，避免治疗链覆盖整支车队；普通单位、分裂单位、支援单位权重为3:2:1。
    const weighted=available.flatMap(type=>Array(ENEMIES[type].heal?1:ENEMIES[type].split?2:3).fill(type));
    const result = Array.from({ length: count }, (_, i) => weighted[(i + number - 1) % weighted.length]);
    if (this.level.boss && number === this.level.waves) result.push(this.level.bossType);
    return result;
  }
  gapAfterWave(count) {
    return Math.min(CONFIG.waveGapMax,CONFIG.waveGapMin+Math.max(0,count-10)*CONFIG.waveGapPerEnemy);
  }
  get earlyWaveReward() {
    if(!this.canStartWave())return 0;
    return Math.min(CONFIG.earlyGoldMax,Math.ceil(Math.max(0,this.prepareTime)*CONFIG.earlyGoldPerSecond));
  }
  canStartWave() {
    if (this.screen !== "battle" || this.modal || this.paused || this.wave >= this.level.waves) return false;
    return this.spawnQueue.length===0;
  }
  startWave(automatic = false) {
    if (!this.canStartWave()) return false;
    const reward=automatic?0:this.earlyWaveReward;
    Sound.play("wave");
    this.wave++; this.state="wave";
    const shifted = this.applyRouteEvent();
    Traffic.onWave(this);
    // 每一批保存自己的生命倍率；跨波排队时不会被下一波的倍率覆盖。
    const scale=this.level.scale*CONFIG.enemyGrowth**(this.wave-1);
    const plan=this.wavePlan(this.wave);
    this.spawnQueue.push(...plan.map(type=>({type,scale,wave:this.wave})));
    this.spawnTimer=0;
    // 倒计时在本波最后一辆车实际进入地图后才开始，不能跨波塞满出场队列。
    this.waveGap=this.gapAfterWave(plan.length);
    this.prepareTime=this.waveGap;this.waveDuration=this.waveGap;
    this.lastEarlyReward=reward;this.gold+=reward;
    const warning=this.level.boss&&this.wave===this.level.waves?`首领 ${ENEMIES[this.level.bossType].name} 来袭！`:`第 ${this.wave} 波发动！`;
    this.notify(`${warning}${reward?`提前迎敌 +${reward} G。`:""}旧波仍需拦截。`);
    if(shifted)this.notify(`${this.level.routeEvent.name}！新车切换路线；已过路口的旧车继续驶出。`);
    return true;
  }
  applyRouteEvent() {
    const event = this.level.routeEvent;
    if (!event || this.routeChanged || this.wave < event.wave) return false;
    this.previousRoad = this.road;
    this.road = new RoadNetwork({routes:event.routes});
    this.routeChanged = true; this.routeFlash = 6;
    const path = this.road.path(0);
    for (const enemy of this.enemies) {
      // 只有尚未过共同岔口的车辆才换路径，位置、血量、控制状态均保留。
      if (!enemy.dead && enemy.segment === 0 && [0,1].every(i =>
        enemy.path[i].x === path[i].x && enemy.path[i].y === path[i].y)) enemy.path = path;
    }
    Traffic.onRouteEvent(this);
    return true;
  }
  towerAt(p) { return this.towers.find(t => Collision.distance(t, p) <= CONFIG.towerRadius + 7); }
  pickTower(p) {
    // 升级后塔身更高：塔顶也能选中；建造占地仍只按原来的基座计算。
    const base = this.towerAt(p);
    if (base) return base;
    // 高设备的选区可能覆盖后方地块，地块中心应始终可以用于建造。
    const site = this.siteAt(p);
    if (site && Collision.distance(site, p) <= 18) return undefined;
    return [...this.towers].sort((a,b)=>b.y-a.y).find(t=>
      Math.abs(p.x-t.x)<=24&&p.y>=t.y-(t.level>=3?75:t.level===2?58:45)&&p.y<=t.y+20);
  }
  siteAt(p) { return this.sites.find(site => Math.abs(site.x - p.x) <= 25 && Math.abs(site.y - p.y) <= 25); }
  canBuild(p) {
    return this.sites.some(site => site.x === p.x && site.y === p.y)
      && !this.buildRoad.isRoad(p, CONFIG.towerRadius + 4) && !this.towerAt(p);
  }
  selectBuild(type) {
    if (this.screen !== "battle" || this.modal || !this.loadout.includes(type) || !this.towerUnlocked(type)) return false;
    const site = this.selectedSite;
    if (!site || !this.canBuild(site)) { this.notify("先点击地图中的设备地块，再选择建造塔型。"); return false; }
    const spec = TOWERS[type];
    if (this.gold < spec.cost) { this.notify("金币不足，地块保留，稍后可以继续建造。"); return false; }
    this.gold -= spec.cost;
    const tower = new Tower(type, site.x, site.y, this.level.theme);
    tower.siteId = site.id; this.towers.push(tower);
    if(type==="depot"){tower.rally=this.buildRoad.nearestPoint(tower);tower.update(0,this);} Sound.play("build");
    this.cancel(); this.selected = tower;
    this.effect(site, spec.color, 28); this.notify(`${spec.name}部署完成。点击塔可强化或出售。`);
    return true;
  }
  selectSkill(type) {
    if (this.skillCooldowns[type] > 0) { this.notify("技能正在冷却。"); return; }
    this.cancel(); this.skill = type;
    this.notify(`点击地图施放${SKILLS[type].name}，右键或 Esc 取消。`);
  }
  upgrade(branch = null) {
    const t = this.selected;
    if (!t || !this.towers.includes(t) || this.screen !== "battle" || this.modal) return false;
    if (t.level >= CONFIG.maxLevel || (t.level === 2 && ![0, 1].includes(branch)) || (t.level !== 2 && branch !== null)) return false;
    if(t.level===2&&!this.branchUnlocked(t.type,t.theme,branch)){this.notify(`累计通关 ${evolutionRequirement(t.type,t.theme,branch)} 关解锁此进化。`);return false;}
    const cost = t.level === 2 ? t.paths[branch].cost : t.upgradeCost;
    if (this.gold < cost) { this.notify("金币不足，升级需要更多击杀奖励。"); return false; }
    this.gold -= cost; t.invested += cost;
    if (t.level === 2) t.branch = branch;
    t.level++; Sound.play("upgrade"); this.effect(t, t.spec.color, 40); this.notify(`${t.name} · Lv.${t.level} 已就绪。`);
    return true;
  }
  sell() {
    if (!this.selected || !this.towers.includes(this.selected) || this.screen !== "battle" || this.modal) return;
    const tower = this.selected; tower.soldiers.forEach(s=>s.release()); Sound.play("build");
    this.gold += tower.sellValue; this.towers = this.towers.filter(t => t !== tower); this.selected = null;
    this.notify(`回收防御塔，返还 ${tower.sellValue} 金币。`);
  }
  cast(p) {
    if (!this.skill || this.paused || this.modal || this.screen !== "battle" || this.skillCooldowns[this.skill] > 0) return;
    const type = this.skill, spec = SKILLS[type];
    const victims = this.enemies.filter(e => !e.dead && Collision.distance(e, p) <= spec.radius);
    if (!victims.length) { this.notify("范围内没有敌人，技能未消耗。"); return; }
    for (const enemy of victims) {
      if (type === "strike") enemy.hit(145 + this.level.chapter * 55 + (this.level.stage-1)*14, this, { pierce: true });
      else enemy.stun(3);
    }
    this.effect(p, spec.color, spec.radius); this.skillCooldowns[type] = spec.cooldown; this.skill = null;
    Sound.play(type);this.notify(`${spec.name}已施放！`);
  }
  click(p, worldOnly = false) {
    const button = !worldOnly && [...this.buttons].reverse().find(b => Collision.inside(p, b));
    if (button) { if (!button.disabled) button.action(); return; }
    if (this.modal || this.screen !== "battle" || !Collision.inside(p, MAP)) return;
    if(this.rallyTower){this.setRally(p);return;}
    if (this.selectedSite && this.buildPopupRect && Collision.inside(p, this.buildPopupRect)) return;
    if (this.selected && this.towerPopupRect && Collision.inside(p, this.towerPopupRect)) return;
    if (this.skill) { this.cast(p); return; }
    if(this.traffic.fork){
      const node=this.traffic.fork.node;
      const nearbySite=this.siteAt(p);
      // 地块中心优先，路牌加大的触控区域不能夺走合法建造/选塔位置。
      if(!(nearbySite&&Collision.distance(nearbySite,p)<=18)&&Math.abs(p.x-node.x)<34&&p.y>=node.y-48&&p.y<=node.y+12){Traffic.switchRoute(this);return;}
    }
    const tower = this.pickTower(p);
    if (tower) { this.cancel(); this.selected = tower; return; }
    const enemy = this.enemies.find(e => !e.dead && Collision.distance(e, p) < (e.spec.boss ? 26 : 18));
    if (enemy) { this.cancel(); this.inspected = enemy; return; }
    const site = this.siteAt(p);
    this.cancel();
    if (site && this.canBuild(site)) { this.selectedSite = site; this.notify(Platform.touch?"轻触炮台卡片建造；取消选择可收起面板。":"选择塔型建造，悬停卡片预览射程。右键取消。"); }
    else this.notify("只能在道路旁有勘测桩或木栈台的预留空地建塔。");
  }
  effect(p, color, radius, visual = null, kind = "impact") {
    const duration = visual?.level >= 3 ? .6 : .45;
    this.effects.push({x:p.x,y:p.y,color,radius,visual,kind,duration,life:duration});
  }
  float(p, label, color) { this.floats.push({ x: p.x, y: p.y - 24, label, color, life: 0.85 }); }
  beam(a, b, color, visual = null) {
    const duration=visual?.level>=3?.28:.16;
    // 第一跳从信号天线发出，后续跳跃连接敌人的实际位置。
    const height=a instanceof Tower?(a.level===1?23:a.level===2?32:a.branch===0?43:35):0;
    this.beams.push({a:{x:a.x,y:a.y-height},b:{x:b.x,y:b.y},color,visual,duration,life:duration});
  }
  finish(won) {
    if (this.screen !== "battle") return;
    this.screen = "result"; this.buttons = []; this.cancel(); this.won = won; Sound.play(won?"win":"lose");
    this.earnedStars = won ? (this.lives >= 18 ? 3 : this.lives >= 12 ? 2 : 1) : 0;
    const before = this.unlocked, completedBefore=this.completed;
    if (won) {
      this.progress.stars[this.levelIndex] = Math.max(this.progress.stars[this.levelIndex], this.earnedStars);
      this.saveFailed = !Progress.save(this.progress,this.activeSlot);
      if (!this.saveFailed) this.hasSave = true;
    }
    this.newUnlock = this.unlocked > before;
    this.earnedEvolutions=[];
    if(this.completed>completedBefore)for(const chapter of CHAPTERS)for(const type of TOWER_ORDER)for(const branch of [0,1])
      if(evolutionRequirement(type,chapter.theme,branch)===this.completed)this.earnedEvolutions.push(pathsFor(type,chapter.theme)[branch].name);
  }
  update(dt) {
    if (this.screen !== "battle" || this.paused || this.modal) return;
    this.routeFlash = Math.max(0, this.routeFlash - dt);
    this.messageTime = Math.max(0, this.messageTime - dt);
    for (const type of Object.keys(SKILLS)) this.skillCooldowns[type] = Math.max(0, this.skillCooldowns[type] - dt);
    for (const list of [this.effects, this.floats, this.beams]) list.forEach(e => { e.life -= dt; });
    this.effects = this.effects.filter(e => e.life > 0); this.floats = this.floats.filter(e => e.life > 0); this.beams = this.beams.filter(e => e.life > 0);
    if (this.inspected?.dead) this.inspected = null;
    // 只等出场队列清空，不等存活敌人被消灭；部署结束后再计时 5–10 秒。
    if (this.wave < this.level.waves && !this.spawnQueue.length) {
      this.prepareTime=Math.max(0,this.prepareTime-dt);
      if(this.prepareTime===0)this.startWave(true);
    }
    if (this.state === "wave") {
      this.spawnTimer -= dt;
      if (this.spawnQueue.length && this.spawnTimer <= 0) {
        const batch=this.spawnQueue[0],path=Traffic.path(this,this.spawnIndex);
        const required=Enemy.bodyLength(ENEMIES[batch.type])/2+CONFIG.trafficGap;
        const clear=!this.enemies.some(enemy=>!enemy.dead&&Collision.distance(enemy,path[0])<required+enemy.bodyLength/2);
        if(clear){
          this.spawnQueue.shift();this.spawnIndex++;
          this.enemies.push(new Enemy(batch.type,path,batch.scale));
          this.spawnTimer=CONFIG.spawnInterval;
        }else this.spawnTimer=.08;
      }
    }
    this.towers.filter(t=>t.type==="depot").forEach(t=>t.update(dt,this));
    // 快照保证新分裂的单位从下一帧开始更新，不会提前结束波次。
    for (const enemy of [...this.enemies]) {
      if (!enemy.dead) enemy.update(dt, this);
      if (this.lives <= 0) { this.finish(false); return; }
    }
    this.towers.filter(t=>t.type!=="depot").forEach(t => t.update(dt, this)); this.projectiles.forEach(p => p.update(dt, this));
    this.enemies = this.enemies.filter(e => !e.dead); this.projectiles = this.projectiles.filter(p => !p.dead);
    Traffic.update(this,dt);
    if(this.screen!=="battle")return;
    if (this.state === "wave" && !this.spawnQueue.length && !this.enemies.length) {
      this.projectiles = [];
      if (this.wave === this.level.waves && Traffic.complete(this)) { this.finish(true); return; }
    }
  }
  frame(time) {
    const elapsed = this.lastTime === null ? 0 : Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    if (this.screen !== "battle") this.messageTime = Math.max(0, this.messageTime - elapsed);
    // 倍速仍使用固定模拟步长，避免高速时弹丸穿越和控制时间失真。
    if (!Platform.hidden && this.screen === "battle" && !this.paused && !this.modal) {
      this.accumulator += elapsed * this.speed;
      while (this.accumulator >= CONFIG.fixedStep) { this.update(CONFIG.fixedStep); this.accumulator -= CONFIG.fixedStep; }
    } else this.accumulator = 0;
    if(this.traffic)this.traffic.engineVolume=Traffic.engineLevel(this);
    Sound.update(this); Renderer.draw(this); Platform.present(this); requestAnimationFrame(t => this.frame(t));
  }
}

// ---- src/render/renderer.js ----
"use strict";

const Renderer = {
  box(x, y, w, h, color, border = null, radius = 10) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = color; ctx.fill();
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.stroke(); }
  },
  text(label, x, y, size = 14, color = COLORS.ink, weight = "normal", align = "left") {
    ctx.font = `${weight} ${size}px "Microsoft YaHei", system-ui, sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillStyle = color; ctx.fillText(label, x, y);
  },
  circle(x, y, r, color) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); },
  button(game, rect, label, action, options = {}) {
    const hover = Collision.inside(game.pointer, rect), color = options.color || COLORS.mint;
    this.box(rect.x, rect.y, rect.w, rect.h, options.disabled ? "#274448" : options.primary ? color : hover ? "#355b59" : "#24494e",
      options.active ? color : options.disabled ? "#293d48" : hover ? color : COLORS.border, 7);
    this.text(label, rect.x + rect.w / 2, rect.y + rect.h / 2, options.size || 13,
      options.disabled ? "#607d8b" : options.primary ? "#102c30" : options.active ? color : COLORS.ink, "bold", "center");
    game.buttons.push({ ...rect, label, action, disabled: options.disabled });
  },
  range(p, radius, color = COLORS.mint) {
    ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.globalAlpha = 0.1; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 0.75;
    ctx.strokeStyle = color; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  },
  // 所有美术由 Canvas 矢量绘制，无外部图片依赖。
  polygon(points, fill, stroke = null) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  },
  line(points, color, width, dash = []) {
    ctx.save(); ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.setLineDash(dash);
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.restore();
  },
  tree(x, y, size = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
    this.circle(5, 8, 14, "#244e4430"); this.box(-2, 0, 4, 14, "#766a4b", null, 1);
    this.circle(0, -4, 12, "#376b56"); this.circle(-4, -8, 9, "#659773"); this.circle(4, -11, 8, "#82aa78");
    this.circle(-5, -13, 3, "#a3c28a"); ctx.restore();
  },
  building(x, y, w, h, kind = 0, theme = "garden") {
    // 统一的斜投影建筑：投影、侧墙、正面、屋顶、窗户和屋顶设备。
    const palettes = theme === "harbor" ? [["#9bb5ac", "#637b78"], ["#d5b17b", "#98774e"], ["#b59181", "#876951"]]
      : [["#e9d4ad", "#ae9171"], ["#a9c4bb", "#708f8b"], ["#d6a78c", "#a7775d"], ["#bdc6c9", "#7c9198"]];
    const [roof, wall] = palettes[kind % palettes.length], lift = 9 + kind % 3 * 5;
    this.polygon([[x,y],[x+w,y],[x+w+12,y+h+12],[x+10,y+h+12]], "#264c4430");
    this.box(x, y, w, h, wall, "#637469", 3);
    this.box(x, y-lift, w, h, roof, "#f6efdaaa", 3);
    this.box(x+4, y-lift+4, w-8, h-8, kind % 3 === 0 ? "#718f8d" : roof, "#ffffff30", 2);
    for (let wx=x+5; wx<x+w-7; wx+=12) {
      this.box(wx, y+h-lift+3, 7, Math.max(4, lift-5), "#3c6571", null, 1);
      this.line([[wx+1,y+h-lift+4],[wx+5,y+h-lift+4]], "#d5e8d8", 1);
    }
    if (kind % 3 === 0) {
      this.box(x+6, y-lift+8, w-12, 9, "#d7e5d7", null, 1);
      this.text(theme === "harbor" ? "CARGO" : "MART", x+w/2, y-lift+13, 7, "#476c68", "bold", "center");
    } else {
      this.box(x+w-19, y-lift+8, 12, 10, "#cbd2c6", "#7b9991", 2);
      this.line([[x+w-16,y-lift+11],[x+w-10,y-lift+11]], "#79948e", 1);
      if (kind % 2) this.box(x+7, y-lift+7, 14, 18, "#557581", "#bfd2ce", 1);
    }
  },
  road(road, mini = false, chapter = null) {
    ctx.save();
    const edges = (width, color, dash=[]) => { for (const [a,b] of road.edges) this.line([[a.x,a.y],[b.x,b.y]],color,width,dash); };
    if(chapter&&chapter.theme!=="city") {
      const sea=chapter.theme==="sea";
      edges(CONFIG.roadWidth+14,sea?"#77b4be":"#786f50");edges(CONFIG.roadWidth+9,sea?"#568a9f":"#d4ba83");
      edges(CONFIG.roadWidth,chapter.road);edges(2,sea?"#c5e2d6":"#dccaa0",[5,12]);
      ctx.restore();return;
    }
    edges(CONFIG.roadWidth+24,"#718c83"); edges(CONFIG.roadWidth+19,"#d2d1b7");
    edges(CONFIG.roadWidth+7,"#79877e"); edges(CONFIG.roadWidth+2,"#64747a"); edges(CONFIG.roadWidth-4,"#596c73");
    edges(1.5,"#dedbbb",[9,14]);
    if (!mini) for (const [a,b] of road.edges) {
      const length=Collision.distance(a,b), angle=Math.atan2(b.y-a.y,b.x-a.x);
      ctx.save(); ctx.translate((a.x+b.x)/2,(a.y+b.y)/2); ctx.rotate(angle);
      this.line([[-5,-5],[2,0],[-5,5]],"#e4e5cf",2);
      if(length>135) {
        ctx.translate(-length*0.29,0);
        for(let x=-12;x<14;x+=5) this.box(x,-15,3,30,"#e8e7d0",null,0);
      }
      ctx.restore();
    }
    ctx.restore();
  },
  enemy(enemy) {
    ctx.save();ctx.translate(-Math.sin(enemy.angle)*(enemy.passOffset||0),Math.cos(enemy.angle)*(enemy.passOffset||0));
    this.vehicle(enemy.type,enemy.x,enemy.y,enemy.angle,enemy.stunTime>0||enemy.slowTime>0,enemy.shield>0);
    const w=enemy.spec.boss?54:30;
    this.box(enemy.x-w/2,enemy.y-28,w,4,"#214047",null,2);
    this.box(enemy.x-w/2,enemy.y-28,w*Math.max(0,enemy.health/enemy.maxHealth),4,enemy.spec.boss?"#f59278":"#b8e691",null,2);
    if(enemy.maxShield) this.box(enemy.x-w/2,enemy.y-34,w*enemy.shield/enemy.maxShield,3,"#aae3f3",null,1);
    if(enemy.burnTime>0) { this.circle(enemy.x-10,enemy.y+6,5,"#ffb159"); this.circle(enemy.x-10,enemy.y+3,3,"#ffe394"); }
    ctx.restore();
  },
  header(game, battle) {
    this.box(0,0,1280,98,"#17373e",null,0);
    this.box(27,22,48,48,"#e8d6a8",null,12);
    this.line([[38,57],[47,35],[55,57],[64,35]],"#315951",4);
    this.text("路网守卫",90,39,27,COLORS.ink,"bold");
    this.text(`城市防卫计划 / CITY GUARD / ${CONFIG.version}`,91,70,10,COLORS.muted);
    this.button(game,{x:312,y:24,w:91,h:28},Sound.unavailable?"声音不可用":`音效 ${Sound.enabled?"开":"关"}`,()=>Sound.toggle("effects"),{size:11});
    this.button(game,{x:312,y:58,w:91,h:25},`音乐 ${Sound.musicEnabled?"开":"关"}`,()=>Sound.toggle("music"),{size:11});
    this.text(`曲目：${MUSIC_TRACKS[CHAPTERS[battle?game.level.chapter:game.menuChapter].theme].name}`,357,94,10,COLORS.muted,"normal","center");
    if(!battle) {
      this.text(`第 ${game.menuChapter + 1} 章 · ${CHAPTERS[game.menuChapter].name}`,442,42,20,COLORS.gold,"bold");
      this.text(CHAPTERS[game.menuChapter].note,443,69,11,COLORS.muted);
      this.text(`★ ${game.progress.stars.reduce((a,b)=>a+b,0)} / ${LEVELS.length*3}`,900,46,23,COLORS.gold,"bold");
      this.text(`${game.progress.stars.filter(Boolean).length} / ${LEVELS.length} 街区守卫完成`,1236,48,15,COLORS.mint,"bold","right");
      return;
    }
    [[`♥ ${game.lives} / 20`,COLORS.red],[`${game.gold} G`,COLORS.gold],[`波次 ${game.wave} / ${game.level.waves}`,COLORS.mint]].forEach(([label,color],i)=>{
      this.box(418+i*157,24,145,55,"#21474b",COLORS.border); this.text(label,490+i*157,52,18,color,"bold","center");
    });
    this.button(game,{x:910,y:30,w:94,h:42},game.paused?"▶ 继续":"Ⅱ 暂停",()=>{game.paused=!game.paused;},{active:game.paused});
    this.button(game,{x:1014,y:30,w:90,h:42},`速度 ×${game.speed}`,()=>{game.speed=game.speed%3+1;});
    this.button(game,{x:1114,y:30,w:142,h:42},"敌情图鉴",()=>{game.intelChapter=game.screen==="menu"?game.menuChapter:game.level.chapter;game.modal="intel";});
  },
  // 手绘式地貌：大色块、深轮廓、分层阴影。地形与装饰共用，选关地图和战场各有布局。
  landmark(theme,x,y,size=1,variant=0) {
    ctx.save();ctx.translate(x,y);ctx.scale(size,size);
    if(theme==="city") this.building(-23,-10,46,36,variant%4,"garden");
    else if(theme==="country") {
      if(variant%3===0) {
        this.polygon([[-12,20],[-7,-20],[7,-20],[12,20]],"#eee0bc","#6f7051");
        this.polygon([[-13,-20],[0,-33],[13,-20]],"#aa6750","#634e40");
        this.line([[-24,-32],[24,6]],"#eee5c5",6);this.line([[-24,6],[24,-32]],"#eee5c5",6);
        this.circle(0,-13,4,"#775b3f");
      } else {
        this.box(-22,-4,44,29,"#e0c38b","#6e664a",3);
        this.polygon([[-28,-4],[0,-24],[28,-4]],"#af664a","#6f4938");
        this.box(-5,8,10,17,"#72634b",null,1);this.box(-16,4,8,9,"#aacbd0","#675e43",1);
      }
    } else if(theme==="desert") {
      if(variant%3===0) {
        this.box(-6,-23,12,48,"#809257","#586945",5);
        this.line([[-4,4],[-17,4],[-17,-11]],"#586945",9);this.line([[5,-4],[18,-4],[18,-20]],"#586945",9);
        this.line([[-4,3],[-17,3],[-17,-10]],"#8a9a5d",5);this.line([[5,-5],[18,-5],[18,-19]],"#8a9a5d",5);
      } else {
        this.polygon([[-31,20],[-19,-17],[1,-30],[24,-8],[31,20]],"#be9666","#84684d");
        this.polygon([[-19,-17],[1,-30],[5,18],[-31,20]],"#d8b079");
        this.line([[-14,4],[0,-2],[14,3]],"#a88055",2);
      }
    } else if(theme==="hills") {
      this.polygon([[-46,27],[-9,-41],[9,-26],[42,27]],"#84927e","#566254");
      this.polygon([[-9,-41],[9,-26],[42,27],[2,17]],"#69776b");
      this.polygon([[-9,-41],[-23,-15],[-10,-20],[0,-10],[9,-26]],"#dbdcc6","#7d8878");
      this.line([[-23,16],[-10,-4],[-4,6]],"#aeb8a0",2);
    } else if(theme==="sea") {
      this.circle(0,13,27,"#dccd9d");this.circle(0,9,23,"#a7ba86");
      if(variant%3===0) {
        this.polygon([[-11,16],[-6,-31],[6,-31],[11,16]],"#ece2c7","#5d7568");
        this.box(-8,-33,16,10,"#688c9a","#465d65",2);this.polygon([[-12,-35],[0,-44],[12,-35]],"#c58058","#675243");
        this.box(-8,-5,16,8,"#c37b59",null,1);
      } else {
        this.line([[0,18],[4,-16]],"#8e7450",6);
        for(const dx of [-22,-12,12,23])this.line([[4,-16],[dx,-25],[dx*1.2,-12]],"#567f58",5);
      }
    } else {
      this.box(-4,4,8,29,"#796b45","#48573c",2);
      this.polygon([[-25,15],[0,-32],[25,15]],"#426b4b","#2e513b");
      this.polygon([[-21,0],[0,-43],[21,0]],"#598252","#375c40");
      this.polygon([[-15,-14],[0,-50],[15,-14]],"#7e9e61","#466b48");
      this.line([[-8,-12],[0,-30]],"#a1b47b",2);
    }
    ctx.restore();
  },
  landscape(chapter,rect,seed,blocked=()=>false) {
    const {x,y,w,h}=rect,theme=chapter.theme;
    this.box(x,y,w,h,chapter.terrain,null,12);
    if(theme==="city") {
      this.polygon([[x+w*.56,y],[x+w*.71,y],[x+w*.64,y+h],[x+w*.47,y+h]],chapter.water);
      for(let n=0;n<4;n++)this.line([[x+55,y+105+n*125],[x+w-35,y+105+n*125]],"#ced1b2",15);
    } else if(theme==="country") {
      for(let row=0;row<4;row++)for(let col=0;col<6;col++) {
        const fx=x+22+col*w/6,fy=y+25+row*h/4;
        this.box(fx,fy,w/6-18,h/4-19,(row+col)%2?"#c8b46c":"#9fb56b","#88975d",8);
        for(let r=0;r<5;r++)this.line([[fx+9,fy+13+r*17],[fx+w/6-28,fy+13+r*17]],"#e6d59a60",3);
      }
      this.line([[x+w*.65,y],[x+w*.58,y+h*.35],[x+w*.7,y+h*.65],[x+w*.57,y+h]],chapter.water,28);
    } else if(theme==="desert") {
      for(let n=0;n<12;n++) {
        const dx=x+50+(n*177+seed*29)%(w-90),dy=y+35+(n*101)%(h-50);
        this.line([[dx-42,dy+18],[dx-15,dy],[dx+24,dy-5],[dx+65,dy+10]],"#c19d6b",4);
        this.line([[dx-35,dy+13],[dx-10,dy-4],[dx+30,dy-9]],"#efdab0",5);
      }
      this.box(x+w*.47,y+h*.32,126,84,"#b2b982",null,40);
      this.box(x+w*.48,y+h*.34,101,61,chapter.water,"#719b86",32);
    } else if(theme==="hills") {
      for(let n=0;n<6;n++) {
        const hx=x+w*.15+n*w*.14,hy=y+h*.68-n*h*.09;
        this.line([[hx-95,hy+75],[hx-65,hy-5],[hx,hy-38],[hx+62,hy],[hx+95,hy+65]],"#8e9e85",32);
        this.line([[hx-95,hy+62],[hx-58,hy-18],[hx,hy-50],[hx+67,hy-8]],"#c6cbb0",3);
      }
    } else if(theme==="sea") {
      for(let n=0;n<48;n++) {
        const wx=x+25+(n*139+seed*23)%(w-60),wy=y+25+(n*77)%(h-45);
        this.line([[wx,wy],[wx+9,wy+3],[wx+22,wy]],"#aad2cf80",2);
      }
      for(let n=0;n<7;n++) {
        const ix=x+90+(n*213+seed*19)%(w-170),iy=y+70+(n*143)%(h-150);
        this.box(ix-45,iy-24,95,65,"#d8c99c","#b4bb91",29);this.box(ix-37,iy-23,79,53,chapter.land,null,24);
      }
    } else {
      for(let n=0;n<16;n++)this.circle(x+40+(n*181+seed*21)%(w-70),y+40+(n*131)%(h-75),42+n%3*13,n%2?"#658b66":"#86a675");
      this.line([[x+w*.29,y],[x+w*.36,y+h*.28],[x+w*.22,y+h*.55],[x+w*.45,y+h]],chapter.water,20);
    }
    for(let n=0;n<(theme==="forest"?70:27);n++) {
      const px=x+37+(n*137+seed*41)%(w-75),py=y+65+(n*97+seed*13)%(h-102);
      if(!blocked({x:px,y:py}))this.landmark(theme,px,py,theme==="forest"?.8:0.75+(n%3)*.13,n);
    }
  },
  campaignMap(game) {
    const chapter=CHAPTERS[game.menuChapter],first=game.menuChapter*CONFIG.levelsPerChapter;
    const levels=LEVELS.slice(first,first+CONFIG.levelsPerChapter),rect={x:24,y:112,w:876,h:576};
    ctx.save();ctx.beginPath();ctx.roundRect(rect.x,rect.y,rect.w,rect.h,15);ctx.clip();
    this.landscape(chapter,rect,game.menuChapter,p=>chapter.nodes.some(([x,y])=>Math.hypot(p.x-x,p.y-y)<78));
    levels.slice(1).forEach((level,i)=>{
      const a=levels[i].mapNode,b=level.mapNode;
      const points=chapter.theme==="city"?[a,[a[0],b[1]],b]:[a,[(a[0]+b[0])/2+(i%2?22:-22),(a[1]+b[1])/2],b];
      this.line(points,"#514e3e90",18);this.line(points,chapter.theme==="sea"?"#b2d6d0":"#e4d1a0",13);
      this.line(points,i+first<game.unlocked?"#9b7852":"#aea58c",3,[3,9]);
    });
    levels.forEach((level,offset)=>{
      const i=first+offset,[x,y]=level.mapNode,locked=i>game.unlocked,selected=game.menuLevel===i,stars=game.progress.stars[i];
      this.circle(x+3,y+5,29,"#394d3a50");this.circle(x,y,selected?30:26,"#534c39");
      this.circle(x,y,selected?27:23,selected?"#ffe2a0":"#e4d4aa");
      this.circle(x,y,20,locked?"#929d83":stars?"#6e9a66":"#cc8c52");
      this.text(locked?"锁":stageLabel(i),x,y,locked?15:17,locked?"#e5e2cc":"#fff0ca","bold","center");
      if(level.boss){this.circle(x+22,y-21,11,"#ad6049");this.text("B",x+22,y-21,11,"#fff0c3","bold","center");}
      this.box(x-67,y+30,134,23,"#f1dfb6ed","#7e805c",7);
      this.text(level.name,x,y+42,12,"#4c5c41","bold","center");
      this.text("★".repeat(stars)+"☆".repeat(3-stars),x,y+65,18,stars?"#996b30":"#657853","bold","center");
      game.buttons.push({x:x-67,y:y-30,w:134,h:106,action:()=>{game.menuLevel=i;game.messageTime=0;}});
    });
    this.box(40,126,350,53,"#f2e2bcf2","#8a8663",8);
    this.text(chapter.city,54,146,15,"#4b5b3d","bold");
    this.text(`本章 ${game.progress.stars.slice(first,first+8).reduce((a,b)=>a+b,0)} / 24 星 · 地貌专属进化`,54,165,10,"#737950");
    ctx.restore();
    this.box(24,692,876,98,"#263e39","#78856b",10);
    CHAPTERS.forEach((item,i)=>this.button(game,{x:36+(i%3)*286,y:701+Math.floor(i/3)*43,w:274,h:35},
      `${i+1} / ${item.name}${i*8>game.unlocked?" · 待解锁":""}`,()=>game.selectChapter(i),{primary:i===game.menuChapter,color:COLORS.gold,size:13}));
  },
  menu(game) {
    this.header(game,false); this.campaignMap(game);
    const i=game.menuLevel, level=LEVELS[i], locked=i>game.unlocked, deck=game.getDeck(i);
    this.box(920,112,336,678,"#1b3d43",COLORS.border,15);
    this.text(`MISSION ${stageLabel(i)} / 第 ${level.chapter+1} 章`,942,139,11,COLORS.gold,"bold");
    this.text(level.name,942,178,29,COLORS.ink,"bold");
    this.text(`${level.layout} · ${level.subtitle}`,943,213,12,COLORS.muted);
    this.box(940,238,296,97,"#a8bda8",null,8);
    ctx.save();ctx.beginPath();ctx.rect(941,239,294,95);ctx.clip();ctx.translate(943,226);ctx.scale(0.318,0.2);ctx.translate(-22,-128);
    this.road(new RoadNetwork(level),true,CHAPTERS[level.chapter]);
    if(level.routeEvent)for(const [a,b] of new RoadNetwork({routes:level.routeEvent.routes}).edges)this.line([[a.x,a.y],[b.x,b.y]],"#f9e5a3",9,[13,12]);
    ctx.restore();
    this.text(`${level.waves} 波车流`,945,357,14,COLORS.ink,"bold");
    this.text(`${level.gold} 初始金币`,1234,357,14,COLORS.gold,"bold","right");
    this.text(`${Traffic.mission(level).name}${level.boss?` · ${ENEMIES[level.bossType].name}`:""}`,944,382,13,COLORS.mint);
    this.text(Traffic.mission(level).brief,944,399,10,COLORS.muted);
    this.text(level.routeEvent?`第${level.routeEvent.wave}波 · ${level.routeEvent.name} · 中途变道`:level.reward,944,416,12,level.routeEvent?COLORS.gold:COLORS.muted);
    this.line([[941,439],[1236,439]],"#476264",1);
    this.text("出战塔组",944,462,17,COLORS.ink,"bold");
    this.text(`${deck.length} / 4`,1234,462,13,COLORS.gold,"bold","right");
    for(let slot=0;slot<4;slot++) {
      const x=942+slot*75,type=deck[slot];
      this.box(x,483,68,72,"#274e51",type?TOWERS[type].color:"#54706b",8);
      if(type) {ctx.save();ctx.translate(x+34,513);ctx.scale(0.75,0.75);this.tower({type,x:0,y:0,level:0,branch:null,angle:-0.7});ctx.restore();
        this.text(TOWERS[type].name.slice(0,2),x+34,544,10,COLORS.ink,"bold","center");}
      else this.text("+",x+34,518,24,COLORS.muted,"normal","center");
      game.buttons.push({x,y:483,w:68,h:72,disabled:locked,action:()=>{game.modal="loadout";game.libraryChapter=game.menuChapter;game.messageTime=0;}});
    }
    this.button(game,{x:942,y:568,w:178,h:34},"进化图鉴",()=>{game.modal="loadout";game.libraryChapter=game.menuChapter;game.messageTime=0;},{});
    this.button(game,{x:1128,y:568,w:108,h:34},"本章研究",()=>{game.modal="loadout";game.libraryChapter=game.menuChapter;},{size:12});
    const researched=TOWER_ORDER.reduce((n,type)=>n+[0,1].filter(b=>game.branchUnlocked(type,level.theme,b)).length,0);
    this.text(`本章进化 ${researched} / 8 · 累计通关 ${game.completed} 关`,944,624,12,COLORS.muted);
    this.text(`最好记录  ${"★".repeat(game.progress.stars[i])+"☆".repeat(3-game.progress.stars[i])}`,944,653,15,COLORS.gold,"bold");
    this.button(game,{x:942,y:675,w:294,h:48},locked?`通关 ${stageLabel(i-1)} 后解锁`:!deck.length?"请先配置出战塔组":"进入街区  →",()=>game.startLevel(i),
      {primary:!locked&&deck.length>0,disabled:locked||!deck.length,color:COLORS.gold,size:16});
    this.button(game,{x:942,y:736,w:142,h:34},"敌情档案",()=>{game.intelChapter=game.screen==="menu"?game.menuChapter:game.level.chapter;game.modal="intel";},{size:12});
    this.button(game,{x:1094,y:736,w:142,h:34},"战役勋章",()=>{game.modal="records";},{size:12});
    this.text(game.messageTime>0?game.message:game.saveFailed?"当前浏览器禁止存储，进度仅本次保留。":"本地自动存档 · 四种基础塔 · 通关推进章节进化研究",30,807,11,game.messageTime>0?COLORS.gold:COLORS.muted);
  },
  wilderness(game) {
    const chapter=CHAPTERS[game.level.chapter];
    this.landscape(chapter,MAP,game.level.stage,p=>game.buildRoad.isRoad(p,65)||game.sites.some(site=>Collision.distance(site,p)<60));
    this.routeLayers(game);this.road(game.road,false,chapter);
    for(const route of game.road.routes) {
      const entry=route[0];this.circle(entry.x+6,entry.y,16,"#5b6650");this.text("»",entry.x+6,entry.y,23,"#f6df9c","bold","center");
      const end=route.at(-1);this.circle(end.x-5,end.y,17,"#697755");this.text("⚑",end.x-5,end.y,23,"#ffe7ae","bold","center");
    }
  },
  cityScenery(game) {
    if(game.level.theme!=="city"){this.wilderness(game);return;}
    const cityStyle=["garden","harbor","downtown","civic","harbor","harbor","downtown","civic"][game.level.stage-1];
    const harbor=cityStyle==="harbor", downtown=cityStyle==="downtown", civic=cityStyle==="civic";
    this.box(MAP.x,MAP.y,MAP.w,MAP.h,harbor?"#abc2b6":civic?"#aec5b7":"#b6cba8",null,12);
    if(harbor) {
      this.box(25,572,898,113,"#78a8a2",null,0);
      for(let y=589;y<680;y+=19) for(let x=37;x<914;x+=80) this.line([[x,y],[x+35,y]],"#a2c8bb",1);
      this.box(27,569,891,12,"#c9cbb4",null,0);
    }
    if(harbor) for(const site of game.sites.filter(site=>site.y>575)) {
      this.box(site.x-31,572,62,site.y-548,"#b0aa8c","#748b7d",2);
      for(let y=577;y<site.y+22;y+=8)this.line([[site.x-29,y],[site.x+29,y]],"#d3c6a2",2);
    }
    const plazaCandidate={garden:{x:455,y:389},downtown:{x:470,y:300},civic:{x:428,y:242}}[cityStyle];
    const plaza=plazaCandidate&&!game.buildRoad.isRoad(plazaCandidate,45)&&!game.sites.some(p=>Collision.distance(p,plazaCandidate)<77)?plazaCandidate:null;
    if(plaza) {
      this.box(plaza.x-46,plaza.y-36,92,72,"#cbd0b2","#92ac8e",12);
      this.circle(plaza.x,plaza.y,23,"#95ad9b");this.circle(plaza.x,plaza.y,19,"#6da9ad");
      this.circle(plaza.x,plaza.y-2,9,"#b4dace");this.circle(plaza.x,plaza.y-4,4,"#e1ede0");
      this.tree(plaza.x-34,plaza.y-22,0.7);this.tree(plaza.x+33,plaza.y+22,0.7);
      this.box(plaza.x+23,plaza.y-25,18,4,"#a58b61",null,1);
      this.box(plaza.x-42,plaza.y+23,18,4,"#a58b61",null,1);
    }
    // 规划成块的建筑与绿地，检测道路和建造地块边界，保证可读性。
    for(let gy=202;gy<643;gy+=88) for(let gx=65;gx<877;gx+=90) {
      const seed=(gx*13+gy*7+game.levelIndex*31)%97, w=seed%3===0?52:44,h=seed%2?34:43;
      const corners=[[gx-8,gy-25],[gx+w+13,gy-25],[gx-8,gy+h+14],[gx+w+13,gy+h+14],[gx+w/2,gy+h/2]];
      if(corners.some(([x,y])=>game.buildRoad.isRoad({x,y},13))||game.sites.some(p=>p.x>gx-40&&p.x<gx+w+42&&p.y>gy-53&&p.y<gy+h+44)) continue;
      if(harbor&&gy>560)continue;
      if(plaza&&Math.abs(gx+w/2-plaza.x)<85&&Math.abs(gy+h/2-plaza.y)<70)continue;
      if(seed%4===0) {
        this.box(gx-7,gy-8,w+15,h+14,"#95b18b","#d0d4b2",8);
        this.tree(gx+7,gy+8,0.85);this.tree(gx+w-7,gy+h-9,0.8);
        this.box(gx+15,gy+h-7,18,4,"#a1845d",null,1);
      } else if(harbor&&seed%2) {
        for(let n=0;n<3;n++) {this.box(gx,gy+n*13,w,10,n%2?"#ba9271":"#7faaa6","#e1d2b3",1);
          for(let k=5;k<w;k+=7)this.line([[gx+k,gy+n*13+2],[gx+k,gy+n*13+8]],"#59766b50",1);}
      } else this.building(gx,gy,w,h,seed%4+(downtown?2:0),cityStyle);
    }
    for(let n=0;n<60;n++) {
      const x=50+(n*137+game.levelIndex*23)%844,y=206+(n*73)%452;
      if(harbor&&y>565)continue;
      if(game.buildRoad.isRoad({x,y},45)||game.sites.some(p=>Collision.distance(p,{x,y})<52)||plaza&&Collision.distance(plaza,{x,y})<60)continue;
      if(n%3===0)this.tree(x,y,0.7);
    }
    this.routeLayers(game);this.road(game.road);
    // 路灯、路牌与入口交通信号。
    for(const route of game.road.routes) {
      const a=route[0];this.box(a.x+10,a.y-38,5,18,"#627f76",null,1);
      this.box(a.x+5,a.y-50,15,27,"#354d50","#b8c3ad",3);
      for(let i=0;i<3;i++)this.circle(a.x+12,a.y-44+i*8,2.5,i===2?"#a9e5a6":"#677d77");
    }
    game.road.edges.forEach(([a,b],i)=>{
      if(i%2)return;
      const x=(a.x+b.x)/2,y=(a.y+b.y)/2,angle=Math.atan2(b.y-a.y,b.x-a.x);
      const px=x-Math.sin(angle)*34,py=y+Math.cos(angle)*34;
      if(game.sites.some(p=>Collision.distance(p,{x:px,y:py})<42))return;
      this.line([[px+2,py+3],[px+6,py+9]],"#496e6140",4);this.line([[px,py],[px,py-19],[px+8,py-19]],"#54726d",2);
      this.box(px+5,py-21,8,4,"#f0e6b7",null,2);
    });
    const end=game.road.routes[0].at(-1);
    this.box(end.x-12,end.y-30,23,61,"#eee2b8","#798e78",3);
    for(let y=end.y-28;y<end.y+29;y+=10)this.box(end.x-10,y,19,4,"#c98f62",null,0);
  },
  site(game,site) {
    const available=!game.towerAt(site);
    const selected=available&&game.selectedSite===site,hover=available&&game.siteAt(game.pointer)===site;
    const theme=game.level.theme,variant=site.id%3,road=game.buildRoad.nearestPoint(site);
    const dx=site.x-road.x,dy=site.y-road.y,distance=Math.hypot(dx,dy);
    // 用短小的路肩连接把建造空地纳入场景；连接停在路沿外，不盖住车道。
    const ground={city:"#b4b399",country:"#b7af80",desert:"#c9ac7d",hills:"#a6ac99",sea:"#c2b08b",forest:"#9ca77e"}[theme];
    if(distance>33){
      const edge={x:road.x+dx/distance*33,y:road.y+dy/distance*33};
      this.line([[edge.x,edge.y],[site.x,site.y]],ground+"50",theme==="sea"?9:13);
      if(theme!=="sea")this.line([[edge.x,edge.y],[site.x,site.y]],"#7a72521c",2,[2,5]);
    }
    ctx.save();ctx.translate(site.x,site.y);
    // 同一关保持确定的细小差异，避免规则方格感，也不逐帧抖动。
    ctx.rotate(Math.atan2(dy,dx)+Math.PI/2);
    const patch=[[-25,-12],[-14,-20-variant],[10,-19],[25,-9],[23,11+variant],[8,19],[-15,17],[-26,5]];
    const highlight="#e7d9b080",shade="#776a4d55";
    this.polygon(patch,ground+"45");
    if(theme==="city"){
      // 路肩检修位：嵌地铺装、断续路沿与一枚小路锥，没有外框。
      this.polygon([[-18,-13],[15,-15],[21,10],[-13,13]],"#a7afa359");
      this.line([[-16,-12],[-4,-13]],highlight,3);
      this.line([[3,-14],[15,-15]],highlight,3);
      this.line([[-16,9],[-4,9]],shade,1);
      this.line([[-2,-9],[-1,8]],"#818c7955",1);
      this.line([[-14,-1],[15,-2]],"#818c7940",1);
      this.box(15,8,8,3,"#85755870",null,1);
      this.polygon([[16,8],[19,0],[22,8]],"#ab896199");
      this.line([[18,5],[20,5]],"#e2d1a8",1.5);
    }else if(theme==="country"){
      // 田边压实土、旧枕木和麦草。
      this.oval(0,0,19,13,"#c8bc8d60");
      for(const y of [-3,4])this.line([[-12,y],[12,y-1]],"#948c6455",1,[5,4]);
      this.line([[-18,10],[-5,12]],"#92836488",3);
      this.line([[12,-14],[22,-10]],"#92836488",3);
      for(const x of [-22,19]){
        this.line([[x,6],[x-3,-2]],"#8b94666e",1.5);
        this.line([[x,6],[x+3,0]],"#8b94666e",1.5);
      }
    }else if(theme==="desert"){
      // 风蚀砂面与半埋石块，中心留空用于安装设备。
      this.oval(1,2,21,13,"#e5c79550");
      this.line([[-21,7],[-10,11],[4,10]],"#ac926451",1.2);
      this.line([[-10,-10],[1,-13],[16,-11]],"#f0d8a260",1.5);
      for(const [x,y] of [[-18,-8],[12,9],[18,-7]]){
        this.polygon([[x-4,y-2],[x+3,y-3],[x+5,y+2],[x-3,y+3]],"#b49b7580");
        this.line([[x-3,y-2],[x+2,y-3]],highlight,1.2);
      }
    }else if(theme==="hills"){
      // 低矮的碎石平台，用岩层分面替代整齐的混凝土方格。
      this.polygon([[-20,-10],[-5,-17],[17,-11],[23,3],[9,13],[-16,11]],"#a3aba475");
      this.line([[-19,8],[-7,12],[8,13],[20,5]],"#737d715c",2.5);
      this.line([[-16,-9],[-5,-13],[10,-11]],"#d2d4bd88",1.8);
      this.line([[-5,-10],[-2,-2],[-7,4]],"#7d867662",1);
      this.polygon([[14,10],[22,8],[25,14],[18,16]],"#949f8b80");
    }else if(theme==="sea"){
      // 岛礁上的旧木栈台：非规则沙缘、褪色木板、系缆桩。
      this.polygon(patch,"#cabd935e");
      for(let n=0;n<5;n++){
        const y=-12+n*6;
        this.line([[-18+(n+variant)%3,y],[17-n%2*2,y]],n%2?"#b0a383aa":"#c5b38baa",5);
        this.line([[-15,y-1],[13,y-1]],"#e3d1a36b",.8);
      }
      for(const [x,y] of [[-18,-13],[17,13]]){
        this.circle(x,y+1,2.8,"#81785b9c");this.circle(x,y-1,2.2,"#d4c293");
      }
      this.line([[-24,14],[-12,20],[5,21]],"#d9e2c74d",1.4);
    }else{
      // 林间清理出的苔地，边缘散落树根、落叶，保持中心平坦。
      this.oval(0,0,20,13,"#c5c69950");
      this.line([[-20,6],[-13,12],[-3,13]],"#8b8b686e",3);
      this.line([[15,-14],[20,-8],[18,-1]],"#82936670",3);
      for(const [x,y] of [[-18,-8],[14,10],[-9,14]]){
        this.polygon([[x-4,y],[x,y-3],[x+5,y+1],[x,y+3]],"#84945d73");
        this.line([[x-3,y],[x+3,y]],"#b7bf8760",1);
      }
    }
    // 小号勘测桩是各地貌共同的建造提示；仅交互时画出清晰选区。
    if(theme!=="sea")for(const x of [-18,18]){
      this.line([[x,-11],[x,-16]],"#83725399",2);
      this.line([[x-1,-16],[x+1,-16]],"#d7bc879e",2.2);
    }
    ctx.restore();
    if(hover||selected){
      this.oval(site.x,site.y,27,21,"#edce7422");
      for(const side of [-1,1])this.line([[site.x+side*27,site.y+9],[site.x+side*27,site.y-12],[site.x+side*15,site.y-20]],"#d7ae5c",2.4);
    }
  },
  routeLayers(game) {
    const alternate = game.routeChanged ? game.previousRoad : game.eventRoad;
    if (!alternate) return;
    for (const [a,b] of alternate.edges) {
      if(game.road.edges.some(([c,d])=>Collision.segmentDistance(a,c,d)<.01&&Collision.segmentDistance(b,c,d)<.01))continue;
      if(game.routeChanged) this.line([[a.x,a.y],[b.x,b.y]],"#827f6e99",CONFIG.roadWidth);
      this.line([[a.x,a.y],[b.x,b.y]],game.routeChanged?"#d8c7a0":"#ffe6a1",game.routeChanged?2:6,[8,10]);
    }
  },
  fieldWorld(game) {
    ctx.save();ctx.beginPath();ctx.roundRect(MAP.x,MAP.y,MAP.w,MAP.h,13);ctx.clip();
    this.cityScenery(game);
    this.trafficGround(game);
    game.sites.forEach(site=>this.site(game,site));
    const tower=game.selected&&game.towerPopupRect&&Collision.inside(game.pointer,game.towerPopupRect)
      ? game.selected : game.pickTower(game.pointer)||game.selected;
    if(tower)this.range(tower,tower.stats.range,tower.spec.color);
    if(game.skill&&Collision.inside(game.pointer,MAP))this.range(game.pointer,SKILLS[game.skill].radius,SKILLS[game.skill].color);
    game.towers.filter(t=>t.type==="depot").forEach(t=>{
      if(t===tower||t===game.rallyTower){this.line([[t.x,t.y],[t.rally.x,t.rally.y]],t.spec.color,1,[4,5]);this.flag(t.rally.x,t.rally.y,t.spec.color);}
      const training=t.soldiers.filter(s=>!s.alive);
      if(training.length)this.text(`补员 ${Math.ceil(Math.min(...training.map(s=>s.respawnRemaining)))}s`,t.x,t.y+45,10,"#314e3d","bold","center");
    });
    [...game.towers,...game.enemies.filter(e=>!e.dead),...game.towers.flatMap(t=>t.soldiers.filter(s=>s.alive))]
      .sort((a,b)=>a.y-b.y).forEach(actor=>actor instanceof Soldier?this.soldier(actor):actor instanceof Tower?this.tower(actor):this.enemy(actor));
    this.trafficActors(game);
    if(game.rallyTower&&Collision.inside(game.pointer,MAP))this.flag(game.pointer.x,game.pointer.y,COLORS.gold);
    game.projectiles.forEach(p => this.projectile(p));
    game.beams.forEach(b=>this.attackBeam(b));
    game.effects.forEach(e=>this.attackEffect(e));
    game.floats.forEach(f=>{ctx.globalAlpha=Math.min(1,f.life*2);this.text(f.label,f.x,f.y-(0.85-f.life)*22,12,"#264e48","bold","center");});
    ctx.restore();
  },
  field(game) {
    this.fieldWorld(game);
    this.box(37,124,259,53,"#f3edd4ed","#bdc6ab",8);
    this.text(`${stageLabel(game.levelIndex)} / ${game.level.name}`,50,143,18,"#365e51","bold");
    this.text(game.level.district,51,164,9,"#6d8a73","bold");
    this.box(687,125,222,36,"#254e49e8",null,7);
    this.text(game.wave<game.level.waves?(game.spawnQueue.length?`本波待出发 ${game.spawnQueue.length} 辆`:`第 ${game.wave+1} 波 · ${Math.max(0,Math.ceil(game.prepareTime))} 秒后发动`):`最终波 · 场上 ${game.enemies.length} / 待发 ${game.spawnQueue.length}`,798,143,12,COLORS.ink,"bold","center");
    this.text(`全部出场后 ${Math.ceil(game.waveGap)} 秒 · 提前奖励 +${game.earlyWaveReward} G`,899,175,10,"#354d38","bold","right");
    if(game.level.routeEvent) {
      const event=game.level.routeEvent, warning=!game.routeChanged&&game.wave+1===event.wave;
      this.box(311,183,584,27,game.routeChanged?"#385c4deb":"#654d36ed",warning?COLORS.gold:null,6);
      this.text(Traffic.eventText(game),603,197,12,COLORS.ink,"bold","center");
      const gate=game.road.routes[0][1];this.flag(gate.x,gate.y,game.routeChanged?COLORS.mint:COLORS.gold);
      if(game.routeFlash>0){this.box(335,604,420,29,"#284b46ee",COLORS.gold,6);this.text("路线变化！检查新路火力与勤务站集合点",545,619,12,COLORS.gold,"bold","center");}
    }
    const boss=game.enemies.find(e=>!e.dead&&e.spec.boss);
    if(boss) {
      this.box(338,124,320,36,"#493e39ec","#bd8e69",7);this.text(`BOSS / ${boss.spec.name}`,350,136,10,"#ffe0b2","bold");
      this.box(350,148,294,5,"#785e51",null,2);this.box(350,148,294*Math.max(0,boss.health/boss.maxHealth),5,"#ec9374",null,2);
    }
    if(game.paused) {
      this.box(335,640,280,29,"#143935ee","#d8dab7",6);
      this.text(Platform.touch?"Ⅱ 已暂停 · 可布塔升级 · 点顶部继续":"Ⅱ 已暂停 · 可布塔升级 · 空格继续",475,655,12,COLORS.ink,"bold","center");
    }
  },
  sidebar(game) {
    this.text("本关出战",948,132,19,COLORS.ink,"bold");
    this.text(`${game.loadout.length} / 4 塔型`,1253,132,11,COLORS.gold,"normal","right");
    for(let i=0;i<4;i++) {
      const type=game.loadout[i],spec=TOWERS[type],x=948,y=158+i*62;
      this.box(x,y,308,54,"#21474b",spec?COLORS.border:"#315458",8);
      if(!spec) {this.text("未携带塔型",1102,y+27,12,"#6d9290","normal","center");continue;}
      ctx.save();ctx.translate(x+31,y+28);ctx.scale(0.68,0.68);this.tower({type,x:0,y:0,level:0,branch:null,angle:-0.5});ctx.restore();
      this.text(spec.name,x+65,y+18,14,spec.color,"bold");
      this.text(spec.note,x+65,y+39,10,COLORS.muted);
      this.text(`${spec.cost} G`,x+293,y+26,14,game.gold>=spec.cost?COLORS.gold:COLORS.red,"bold","right");
      game.buttons.push({x,y,w:308,h:54,towerType:type,action:()=>game.selectBuild(type)});
    }
    this.text(game.selectedSite?"选择塔型，在已选地块部署":"先点道路旁的预留空地",1102,427,12,COLORS.gold,"bold","center");
    this.box(948, 452, 308, 238, "#193c42", COLORS.border);
    const t = game.selected, enemy = game.inspected;
    if (t) {
      const stats = t.stats;
      this.text(`${t.name}  L${t.level}`, 964, 473, 18, t.spec.color, "bold");
      this.text(`伤害 ${Math.round(stats.damage)} / 射程 ${stats.range} / ${stats.cooldown.toFixed(2)}秒`, 964, 500, 12, COLORS.muted);
      this.text("升级菜单已在地图上的塔旁展开", 964, 540, 14, COLORS.gold, "bold");
      this.text(t.type==="depot"?`队员 ${t.soldiers.filter(s=>s.alive).length} / ${stats.soldierCount} · 阵亡 ${stats.respawn} 秒后补员`:"点击地图上的其他塔可切换选择。", 964, 573, 12, COLORS.muted);
      this.text(t.branch === null ? "二级选择专精，四级完成强化。" : t.paths[t.branch].note, 964, 604, 12, COLORS.muted);
      this.text(Platform.touch?"轻触底部取消选择，继续观察车流。":"右键 / Esc 收起菜单，继续观察车流。", 964, 657, 11, COLORS.mint);
    } else if (enemy && !enemy.dead) {
      this.text(enemy.spec.name, 964, 479, 20, enemy.spec.color, "bold");
      this.text(`生命 ${Math.ceil(enemy.health)} / ${Math.ceil(enemy.maxHealth)}`, 964, 514, 14, COLORS.ink);
      this.text(`护盾 ${Math.ceil(enemy.shield)} · 装甲 ${Math.round((enemy.spec.armor || 0) * 100)}%`, 964, 543, 13, COLORS.muted);
      this.text(enemy.spec.note, 964, 578, 12, COLORS.muted);
      this.text(enemy.spec.counter, 964, 609, 12, COLORS.mint);
      this.text(`漏过扣 ${enemy.spec.leak} 生命 / 击杀 +${enemy.spec.reward}G`, 964, 659, 12, COLORS.gold);
    } else {
      this.text(game.wave < game.level.waves ? "下一波情报" : "最终波情报", 964, 478, 18, COLORS.ink, "bold");
      const number = Math.min(game.level.waves, game.wave + 1);
      const counts = {};
      for (const type of game.wavePlan(number)) counts[type] = (counts[type] || 0) + 1;
      Object.entries(counts).slice(0, 6).forEach(([type, count], i) => {
        this.circle(970, 512 + i * 24, 4, ENEMIES[type].color);
        this.text(`${ENEMIES[type].name} ×${count}`, 984, 512 + i * 24, 12, COLORS.muted);
      });
      this.text("点击塔：升级 / 专精 / 出售 / 索敌", 964, 670, 11, COLORS.mint);
    }
    this.button(game, { x: 948, y: 704, w: 308, h: 43 }, game.wave < game.level.waves ? `${game.wave?"提前发动":"开始"}第 ${game.wave + 1} 波  →` : "最终波 · 清理剩余敌人", () => game.startWave(),
      { primary: game.canStartWave(), disabled: !game.canStartWave() });
    this.button(game, { x: 948, y: 759, w: 147, h: 35 }, "重新挑战", () => { game.modal = "restart"; });
    this.button(game, { x: 1107, y: 759, w: 149, h: 35 }, "返回战役", () => { game.modal = "leave"; });
  },
  toolbar(game) {
    this.box(24, 700, 900, 95, "#1a3c42", COLORS.border);
    Object.entries(SKILLS).forEach(([type, spec], i) => {
      const cooldown = game.skillCooldowns[type], x = 38 + i * 193;
      this.button(game, { x, y: 713, w: 180, h: 43 }, `${spec.key}  ${spec.name}${cooldown > 0 ? ` ${Math.ceil(cooldown)}s` : ""}`,
        () => game.selectSkill(type), { active: game.skill === type, disabled: cooldown > 0, color: spec.color });
      this.text(spec.note, x + 90, 776, 11, COLORS.muted, "normal", "center");
    });
    this.text(Traffic.status(game),446,713,12,COLORS.mint,"bold");
    this.trafficControls(game,{x:446,y:728,w:450,h:37});
    const tip = game.messageTime > 0 ? game.message : "升级专精应对不同车流；空格暂停，调整防线。";
    this.text(tip.slice(0,36),446,781,11,COLORS.muted);
    this.text(`击毁 ${game.kills} / 已部署 ${game.towers.length} 座交通设施`, 30, 809, 10, COLORS.muted);
  },
  result(game) {
    this.box(0, 0, CONFIG.width, CONFIG.height, "#06111cda", null, 0);
    this.box(340, 193, 600, 434, "#1c4248", game.won ? COLORS.mint : COLORS.red, 18);
    this.text(game.won ? "城区守卫成功" : "防线失守", 640, 245, 34, game.won ? COLORS.mint : COLORS.red, "bold", "center");
    this.text(game.won ? "★".repeat(game.earnedStars) + "☆".repeat(3 - game.earnedStars) : "调整部署，再次挑战", 640, 303, game.won ? 42 : 19, COLORS.gold, "bold", "center");
    this.text(`${game.level.name} · 击毁 ${game.kills} 辆 · 剩余 ${game.lives} 生命`, 640, 359, 16, COLORS.ink, "normal", "center");
    this.text(game.won ? game.earnedEvolutions?.length ? `解锁进化：${game.earnedEvolutions.slice(0,2).join(" / ")}${game.earnedEvolutions.length>2?" 等":""}` : game.newUnlock ? game.level.reward : "通关记录已更新，可重玩争取三星" : "升级主力塔，使用空袭处理聚集的强敌。", 640, 399, 15, COLORS.muted, "normal", "center");
    this.text(game.saveFailed ? "存档失败：本次进度仅在当前页面保留" : "18生命三星 / 12生命二星 / 通关一星", 640, 438, 12, game.saveFailed ? COLORS.red : COLORS.muted, "normal", "center");
    if (game.won && game.levelIndex < LEVELS.length - 1) {
      this.button(game, { x: 402, y: 474, w: 476, h: 46 }, "前往下一关  →", () => {
        game.menuLevel = game.levelIndex + 1; game.menuChapter = LEVELS[game.menuLevel].chapter; game.screen = "menu";
      }, { primary: true });
    } else this.button(game, { x: 402, y: 474, w: 476, h: 46 }, game.won ? "战役完成 · 返回关卡" : "重新挑战", () => { if (game.won) game.screen = "menu"; else game.startLevel(game.levelIndex); }, { primary: true });
    this.button(game, { x: 402, y: 539, w: 230, h: 40 }, "返回战役", () => { game.screen = "menu"; });
    this.button(game, { x: 648, y: 539, w: 230, h: 40 }, "重玩本关", () => game.startLevel(game.levelIndex));
  },
  buildPopup(game) {
    game.buildPopupRect=null;
    if(!game.selectedSite||game.screen!=="battle")return;
    const site=game.selectedSite,x=site.x>480?site.x-274:site.x+36,y=Math.max(189,Math.min(447,site.y-80));
    const height=69+Math.ceil(game.loadout.length/2)*79;
    const cards=game.loadout.map((type,i)=>({type,x:x+12+(i%2)*121,y:y+45+Math.floor(i/2)*79,w:112,h:71}));
    const hover=cards.find(card=>Collision.inside(game.pointer,card))||game.buttons.find(b=>b.towerType&&Collision.inside(game.pointer,b));
    const preview=hover?.type||hover?.towerType;
    if(preview) {
      ctx.save();ctx.beginPath();ctx.rect(MAP.x,MAP.y,MAP.w,MAP.h);ctx.clip();
      this.range(site,TOWERS[preview].range,game.gold>=TOWERS[preview].cost?COLORS.gold:COLORS.red);ctx.restore();
    }
    this.line([[site.x,site.y-8],[x+126,y+30]],"#f2d894",2);
    this.box(x+4,y+6,256,height,"#12343040",null,11);
    this.box(x,y,256,height,"#173d42","#e5cf9a",11);
    this.text(`设备地块 ${String(site.id+1).padStart(2,"0")}`,x+14,y+23,15,COLORS.ink,"bold");
    this.button(game,{x:x+215,y:y+9,w:29,h:28},"×",()=>game.cancel(),{size:18});
    cards.forEach(card=>{
      const spec=TOWERS[card.type],afford=game.gold>=spec.cost;
      this.button(game,card,"",()=>game.selectBuild(card.type),{disabled:!afford,color:spec.color});
      ctx.save();ctx.translate(card.x+23,card.y+30);ctx.scale(0.57,0.57);this.tower({type:card.type,x:0,y:0,level:0,branch:null});ctx.restore();
      this.text(spec.name.slice(0,2),card.x+52,card.y+22,13,afford?spec.color:COLORS.muted,"bold");
      this.text(`${spec.cost} G`,card.x+52,card.y+43,12,afford?COLORS.gold:COLORS.red,"bold");
      this.text(`快捷键 ${game.loadout.indexOf(card.type)+1}`,card.x+56,card.y+61,9,COLORS.muted,"normal","center");
    });
    this.text("悬停预览射程 / Esc 取消",x+128,y+height-16,10,COLORS.muted,"normal","center");
    game.buildPopupRect={x,y,w:256,h:height};
  },
  towerPopup(game) {
    game.towerPopupRect=null;
    const t=game.selected;
    if(!t||game.screen!=="battle"||game.rallyTower)return;
    // 根据塔的位置自动向内展开，最靠边的塔也能完整操作。
    const w=286,h=t.level===2?284:238;
    const x=Math.max(MAP.x+10,Math.min(MAP.x+MAP.w-w-10,t.x>478?t.x-w-36:t.x+36));
    const y=Math.max(186,Math.min(MAP.y+MAP.h-h-10,t.y-90));
    game.towerPopupRect={x,y,w,h};
    this.line([[t.x,t.y-8],[t.x>x?x+w:x,y+40]],t.spec.color,2);
    this.box(x+4,y+6,w,h,"#12343050",null,11);
    this.box(x,y,w,h,"#173d42",t.spec.color,11);
    this.text(`${t.name} · L${t.level}`,x+14,y+24,16,t.spec.color,"bold");
    this.button(game,{x:x+w-39,y:y+10,w:28,h:28},"×",()=>game.cancel(),{size:18});
    this.text(t.type==="depot"?`${t.stats.soldierCount} 位队员 / 生命 ${Math.round(t.stats.soldierHealth)} / 自动补员`: `伤害 ${Math.round(t.stats.damage)} / 射程 ${t.stats.range}`,x+14,y+54,12,COLORS.muted);
    this.text(t.level===2?"选择专精路线 · 本局不可切换":t.level===4?"已完成专精强化":t.level===1?"强化后解锁两条专精路线":t.paths[t.branch].note,
      x+14,y+79,11,COLORS.gold);
    if(t.level===2) {
      t.paths.forEach((path,i)=>{
        const rect={x:x+12,y:y+97+i*58,w:w-24,h:50},afford=game.gold>=path.cost,unlocked=game.branchUnlocked(t.type,t.theme,i);
        this.button(game,rect,"",()=>{if(game.selected===t)game.upgrade(i);},{disabled:!afford||!unlocked,color:t.spec.color});
        this.text(path.name,rect.x+12,rect.y+16,14,afford?t.spec.color:COLORS.muted,"bold");
        this.text(`${path.cost} G`,rect.x+rect.w-12,rect.y+16,12,afford?COLORS.gold:COLORS.red,"bold","right");
        this.text(unlocked?path.note:`累计通关 ${evolutionRequirement(t.type,t.theme,i)} 关解锁 · 当前 ${game.completed}`,rect.x+12,rect.y+36,11,unlocked?COLORS.muted:COLORS.gold);
      });
    } else {
      const afford=game.gold>=t.upgradeCost,max=t.level===4;
      this.button(game,{x:x+12,y:y+100,w:w-24,h:43},max?"已达最高等级":`${t.level===1?"基础强化 → L2":"专精强化 → L4"} · ${t.upgradeCost} G`,
        ()=>{if(game.selected===t)game.upgrade();},{primary:!max&&afford,disabled:max||!afford,color:t.spec.color});
      this.text(max?"组合不同塔型，构筑交叉火力":afford?"提升伤害与射程":"金币不足 · 击毁车辆获得金币",x+w/2,y+165,11,COLORS.muted,"normal","center");
    }
    this.button(game,{x:x+12,y:y+h-47,w:132,h:34},t.type==="depot"?"⚑ 设置集合点":TARGET_MODES[t.targetMode],()=>{if(game.selected!==t)return;if(t.type==="depot"){game.rallyTower=t;game.notify("点击勤务站范围内的道路设置集合点，Esc 取消。");}else t.targetMode=(t.targetMode+1)%3;},{size:12});
    this.button(game,{x:x+152,y:y+h-47,w:122,h:34},`出售 +${t.sellValue} G`,()=>{if(game.selected===t)game.sell();},{color:COLORS.gold,size:12});
  },
  loadoutModal(game) {
    const chapter=CHAPTERS[game.libraryChapter??game.menuChapter],theme=chapter.theme,branch=game.previewBranch||0;
    this.box(132,112,1016,595,"#243e39","#a89d76",17);
    this.text(`${chapter.name} / 防御塔进化研究`,156,149,25,COLORS.ink,"bold");
    this.text("四种基础塔全程可用 · 通关永久解锁进化资格 · 每局仍需金币升级，专精不可切换",157,181,13,COLORS.muted);
    TOWER_ORDER.forEach((type,i)=>{
      const spec=TOWERS[type],x=154+i*244,y=208;
      this.box(x,y,234,390,"#315249",COLORS.border,10);
      this.text(spec.name,x+117,y+25,20,spec.color,"bold","center");
      this.text(`${spec.cost} G · ${spec.note}`,x+117,y+51,10,COLORS.muted,"normal","center");
      this.box(x+10,y+65,214,136,"#b3bb98",null,6);
      for(let level=1;level<=4;level++){
        ctx.save();ctx.translate(x+35+(level-1)*55,y+156);ctx.scale(.68,.68);
        this.tower({type,theme,x:0,y:0,level,branch:level>=3?branch:null,angle:-.8});ctx.restore();
        this.text(`L${level}`,x+35+(level-1)*55,y+187,10,"#395447","bold","center");
      }
      pathsFor(type,theme).forEach((path,b)=>{
        const unlocked=game.branchUnlocked(type,theme,b),py=y+224+b*77;
        this.text(`${b===0?"Ⅰ":"Ⅱ"} ${path.name}`,x+14,py,15,unlocked?spec.color:COLORS.muted,"bold");
        this.text(unlocked?`已研究 · 进化费用 ${path.cost} G`:`通关 ${evolutionRequirement(type,theme,b)} 关解锁 / 当前 ${game.completed}`,x+14,py+22,11,unlocked?COLORS.gold:"#dbc4a0");
        this.text(path.note,x+14,py+44,10,COLORS.muted);
      });
    });
    CHAPTERS.forEach((item,i)=>this.button(game,{x:157+i*162,y:614,w:151,h:29},item.name,()=>{game.libraryChapter=i;},{primary:item===chapter,size:12}));
    this.button(game,{x:157,y:653,w:230,h:34},`预览造型：路线 ${branch===0?"Ⅰ":"Ⅱ"} · 点击切换`,()=>{game.previewBranch=1-branch;},{size:12});
    this.button(game,{x:921,y:650,w:202,h:39},"返回战役地图",()=>{game.modal=null;},{primary:true,color:COLORS.gold});
  },
  recordsModal(game) {
    this.box(250,142,780,532,"#263e39","#b6aa80",16);
    this.text("远征勋章 / 每章八关",275,180,26,COLORS.gold,"bold");
    this.text("18生命三星 / 12生命二星 / 通关一星 · 旧成绩按关卡序号保留",275,216,12,COLORS.muted);
    CHAPTERS.forEach((chapter,i)=>this.button(game,{x:275+i*123,y:244,w:113,h:33},chapter.name,
      ()=>game.selectChapter(i),{primary:i===game.menuChapter,color:COLORS.gold,size:12}));
    const first=game.menuChapter*CONFIG.levelsPerChapter;
    LEVELS.slice(first,first+CONFIG.levelsPerChapter).forEach((level,offset)=>{
      const i=first+offset,x=275+Math.floor(offset/4)*370,y=298+offset%4*65,stars=game.progress.stars[i];
      this.box(x,y,354,54,"#344c3e",COLORS.border,7);
      this.text(`${stageLabel(i)}  ${level.name}`,x+12,y+20,14,COLORS.ink,"bold");
      this.text("★".repeat(stars)+"☆".repeat(3-stars),x+340,y+34,21,stars?COLORS.gold:COLORS.muted,"bold","right");
    });
    this.button(game,{x:770,y:604,w:231,h:42},"返回远征地图",()=>{game.modal=null;},{primary:true,color:COLORS.gold});
  },
  modal(game) {
    this.box(0, 0, CONFIG.width, CONFIG.height, "#05111cce", null, 0);
    if (game.modal === "loadout") { this.loadoutModal(game); return; }
    if (game.modal === "records") { this.recordsModal(game); return; }
    if (game.modal === "intel") {
      this.box(162, 118, 956, 592, "#142c3a", COLORS.border, 16);
      this.text("敌情图鉴", 187, 151, 25, COLORS.ink, "bold");
      const chapterIndex=game.intelChapter ?? (game.screen==="menu"?game.menuChapter:game.level.chapter),chapter=CHAPTERS[chapterIndex];
      CHAPTERS.forEach((item,i)=>this.button(game,{x:184+i*152,y:183,w:141,h:29},item.name,()=>{game.intelChapter=i;},{active:i===chapterIndex,size:12}));
      const native=[...chapter.pool,chapter.boss];
      const types=[...new Set([...native,...native.filter(type=>ENEMIES[type].split).map(type=>ENEMIES[type].splitType||"swarm")])];
      types.forEach((type, i) => {
        const spec=ENEMIES[type];
        const x = 184 + (i % 2) * 463, y = 220 + Math.floor(i / 2) * 108;
        this.box(x, y, 443, 96, "#1a3442", COLORS.border, 8);
        this.vehicle(type,x+26,y+26);
        this.text(spec.name, x + 48, y + 24, 15, spec.color, "bold");
        this.text(`基础HP ${Math.round(spec.hp*(spec.boss?CONFIG.bossHealthMultiplier:CONFIG.enemyHealthMultiplier))} / 速度 ${spec.speed}`, x + 420, y + 25, 10, COLORS.muted, "normal", "right");
        this.text(spec.note, x + 17, y + 53, 12, COLORS.ink); this.text(spec.counter, x + 17, y + 77, 11, COLORS.muted);
      });
      this.button(game, { x: 968, y: 139, w: 122, h: 40 }, Platform.touch?"关闭":"关闭 / Esc", () => { game.modal = null; });
    } else {
      this.box(405, 285, 470, 233, "#152e3e", COLORS.border, 15);
      this.text(game.modal === "restart" ? "重新挑战这一关？" : "返回战役地图？", 640, 332, 25, COLORS.ink, "bold", "center");
      this.text("本局部署与金币将清空，已获得的星级和解锁保留。", 640, 382, 14, COLORS.muted, "normal", "center");
      this.button(game, { x: 437, y: 440, w: 186, h: 43 }, "继续防守", () => { game.modal = null; });
      this.button(game, { x: 644, y: 440, w: 198, h: 43 }, "确认", () => {
        if (game.modal === "restart") game.startLevel(game.levelIndex);
        else { game.modal = null; game.screen = "menu"; game.cancel(); }
      }, { primary: true });
    }
  },
  draw(game) {
    game.buttons = [];
    ctx.clearRect(0, 0, CONFIG.width, CONFIG.height); ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    if (game.screen === "menu") this.menu(game);
    else {
      this.header(game, true); this.field(game); this.sidebar(game); this.toolbar(game); this.buildPopup(game); this.towerPopup(game);
      if (game.screen === "result") { game.buttons = []; this.result(game); }
    }
    if (game.modal) { game.buttons = []; this.modal(game); }
    const button = game.buttons.find(b => Collision.inside(game.pointer, b));
    canvas.style.cursor = button ? button.disabled ? "not-allowed" : "pointer"
      : game.screen === "battle" && Collision.inside(game.pointer, MAP) ? game.skill ? "crosshair" : game.siteAt(game.pointer) || game.towerAt(game.pointer) ? "pointer" : "default" : "default";
  }
};

// ---- src/render/facilities.js ----
"use strict";

// 防御设施、拦截队员和弹体美术；依赖 renderer.js 的基础绘图方法。
Object.assign(Renderer, {
  // 模块化交通设施：统一圆角外壳、深色玻璃、发光标识与分层底座。
  // 轮廓和设备模块随等级/专精变化；不复用城堡、弓弩或法师塔造型。
  oval(x, y, rx, ry, fill, stroke = null) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  },
  tower(tower, ghost = false) {
    const spec = TOWERS[tower.type], level = tower.level || 1;
    const advanced = level >= 3, branch = tower.branch;
    const firing=Math.max(0,(tower.fireTime||0)/.24);
    const palettes = {
      city: ["#e1eae5", "#8ca6aa"], country: ["#e2e6cd", "#91a88d"],
      desert: ["#eedbc0", "#b69f86"], hills: ["#dce3eb", "#8b9dac"],
      sea: ["#e0eff0", "#7eabb6"], forest: ["#d5e3ce", "#849f89"]
    };
    const [shell, shade] = palettes[tower.theme || "city"];
    const ink = "#304b55", glass = "#284b5d";
    const theme=tower.theme||"city", accent=advanced?THEME_EQUIPMENT[theme].colors[branch]:spec.color;
    ctx.save(); ctx.translate(tower.x, tower.y); ctx.globalAlpha = ghost ? .55 : 1;
    this.oval(3, 18, 29, 12, "#213f4033");
    this.box(-25, -6, 50, 29, shade, ink, 10);
    this.box(-25, -11, 50, 27, shell, ink, 10);
    this.line([[-19, -5], [-10, -8], [14, -8]], "#ffffffb0", 2);
    this.box(-17, 11, 34, 6, glass, null, 3);
    for (let i = 0; i < level; i++) this.box(-12 + i * 7, 12, 4, 3, accent, null, 1);
    if (level >= 2) {
      for (const x of [-27, 19]) {
        this.box(x, -3, 8, 18, shade, ink, 3);
        this.box(x + 2, -1, 4, 8, accent, null, 2);
      }
    }
    if (level === 4) {
      this.oval(0, 3, 24, 9, "#ffffff18", accent);
      for (const x of [-21, 16]) this.box(x, 18, 5, 4, "#f9d586", null, 1);
    }
    if (advanced) this.regionalEquipment(theme, branch, level, accent);
    if (tower.type === "rail") {
      const lift = level === 1 ? 9 : advanced && branch === 0 ? 24 : 15;
      this.box(-12, -lift, 24, lift + 7, shade, ink, 6);
      this.box(-8, -lift, 16, lift + 3, shell, null, 4);
      this.oval(0, -lift, 17, 9, glass, ink);
      this.oval(0, -lift - 3, 14, 7, accent, ink);
      if (level === 4) {
        this.box(-21, -19, 8, 22, glass, ink, 3);
        this.box(-20, -16, 6, 4, accent, null, 1);
      }
      ctx.save(); ctx.translate(0, -lift - 6); ctx.rotate(tower.angle ?? -.7);ctx.translate(-firing*(advanced?7:level===2?4:2),0);
      const guns = advanced && branch === 1 ? 2 : 1;
      for (let i = 0; i < guns; i++) {
        const gy = (i - (guns - 1) / 2) * 15;
        const length = advanced && branch === 0 ? 34 : level === 1 ? 23 : 27;
        this.box(-10, gy - 7, 23, 14, shell, ink, 5);
        this.box(-6, gy - 4, 13, 8, glass, null, 3);
        this.box(4, gy - 5, length, 4, shade, ink, 1);
        this.box(-4,gy-11,15,4,"#536f75",null,2);
        this.box(4, gy + 1, length, 4, shade, ink, 1);
        this.line([[8, gy], [length + 5, gy]], accent, 2);
        this.box(length - 1, gy - 7, 7, 14, glass, ink, 2);
        this.box(length + 2, gy - 3, 3, 6, accent, null, 1);
        if (firing > .55)
          this.oval(length + 10, gy, advanced?12:7, advanced?5:3, "#e2fff0b0");
      }
      ctx.restore();
      if (advanced && branch === 0) {
        this.line([[-16, -9], [-19, -36]], ink, 2);
        this.circle(-19, -37, 3, accent);
      }
    } else if (tower.type === "signal") {
      const height = level === 1 ? 23 : level === 2 ? 32 : branch === 0 ? 43 : 35;
      this.box(-13, -16, 26, 26, shade, ink, 6);
      this.box(-10, -19, 20, 23, shell, ink, 5);
      this.box(-5, -14, 10, 15, glass, null, 3);
      this.line([[-2, -11], [-2, -3]], accent, 3);
      this.box(-4, -height, 8, height - 13, shade, ink, 2);
      const antenna = (x, y, size) => {
        this.oval(x, y + 4, size, size * .52, shade, ink);
        this.oval(x, y, size, size * .52, shell, ink);
        this.oval(x, y, size * .68, size * .3, glass);
        this.line([[x, y + 1], [x + size * .3, y - size * .6]], accent, 2);
        this.circle(x + size * .3, y - size * .6, 3, "#e3ffff");
      };
      this.box(-10,-height-17,20,39,glass,ink,6);
      for(let i=0;i<3;i++)this.circle(0,-height-10+i*12,4.5,i===(firing>0?0:2)?["#ef8c65","#efcf79","#9cdaad"][i]:"#5b6f66");
      if(advanced&&branch===0){this.box(-25,-height-14,13,30,glass,ink,3);this.text("30",-18,-height,9,"#f6de94","bold","center");}
      if(firing>0)this.oval(0,-height,22+firing*8,8+firing*4,"#ffffff12",accent);
      if (advanced && branch === 1) {
        this.line([[-18, -5], [-18, -24], [18, -24], [18, -5]], shade, 4);
        antenna(-18, -24, 10); antenna(18, -24, 10);
      }
      if (level === 4) {
        this.oval(0, -height + 3, 25, 11, "#9edffa12", accent);
        this.circle(-22, -4, 3, "#d5f4ff"); this.circle(22, -4, 3, "#d5f4ff");
      }
    } else if (tower.type === "missile") {
      // 清障绞盘：卷索轮、伸缩吊臂、警示支腿；两条进化分别为重锚与双网。
      this.box(-21,-17,42,29,"#d9b068",ink,5);
      for(const x of [-28,18]){this.box(x,2,10,13,shade,ink,2);this.line([[x,8],[x+9,8]],"#f8cf7a",3);}
      this.circle(-8,-9,10,glass);this.circle(-8,-9,6,shade);this.circle(-8,-9,2,"#e7d6a5");
      const height=advanced&&branch===0?51:level>=2?38:28;
      const boomX=advanced&&branch===1?[-14,14]:[5];
      for(const x of boomX){
        this.line([[x,0],[x-8,-height],[x+19,-height+7]],ink,9);
        this.line([[x,0],[x-8,-height],[x+19,-height+7]],"#e6b95f",5);
        this.line([[x+19,-height+7],[x+19,-height+22+firing*6]],"#4e686d",1.5);
        this.line([[x+15,-height+20+firing*6],[x+19,-height+25+firing*6],[x+23,-height+20+firing*6]],accent,3);
      }
      for(const x of [-15,-4,7])this.line([[x,7],[x+6,12]],ink,3);
      if(level===4){this.box(-23,-27,10,15,glass,accent,3);this.circle(-18,-30,3,"#f4d476");}
    } else if (tower.type === "depot") {
      const height = level === 1 ? 21 : level === 2 ? 28 : 35;
      this.box(-22, -height + 6, 44, height + 5, shade, ink, 7);
      this.box(-22, -height, 44, height + 5, shell, ink, 7);
      if(advanced&&branch===1) {
        this.box(-18,-15,16,21,glass,ink,4);this.box(2,-15,16,21,glass,ink,4);
        this.line([[0,-17],[0,7]],accent,3);
      } else this.box(-16, -14, 32, 20, glass, ink, 4);
      this.line([[-13, -10], [13, -10]], "#65818c", 2);
      this.line([[-13, -5], [13, -5]], "#65818c", 2);
      this.box(-23, -height - 3, 46, 10, shade, ink, 5);
      this.box(-13,-height-9,26,6,glass,ink,2);
      this.box(-11,-height-8,9,4,"#db7d63",null,1);this.box(2,-height-8,9,4,"#6bbdc8",null,1);
      this.text("巡",0,-height+14,11,ink,"bold","center");
      this.box(-19, -height - 3, 38, 5, shell, null, 3);
      this.box(-10, -height + 10, 20, 7, firing>0?"#fff4cd":accent, null, 3);
      this.line([[-4, -height + 13], [4, -height + 13]], "#fff4e4", 2);
      this.box(-23, 7, 46, 6, "#d1dacb", ink, 2);
      for (const x of [-16, 0, 16]) this.line([[x - 4, 8], [x, 11]], accent, 2);
      if (advanced && branch === 0) {
        for (const x of [-24, 16]) {
          this.box(x, -23, 8, 27, glass, ink, 3);
          this.box(x + 2, -20, 4, 17, accent, null, 1);
        }
        this.box(-9, -height - 12, 18, 9, glass, ink, 3);
        this.circle(-4, -height - 8, 2, "#ffa48c"); this.circle(4, -height - 8, 2, "#a0eafa");
      } else if (advanced) {
        this.box(-16, -height - 12, 13, 11, glass, ink, 3);
        this.box(3, -height - 12, 13, 11, glass, ink, 3);
        this.line([[-12, -height - 7], [-7, -height - 7]], accent, 2);
        this.line([[7, -height - 7], [12, -height - 7]], accent, 2);
      }
      if (level === 4) { this.line([[17, -height], [17, -height - 23]], ink, 2); this.circle(17, -height - 23, 3, accent); }
    }
    if (tower.level) {
      this.box(-13, 22, 26, 12, glass, null, 4);
      this.text(`L${level}`, 0, 28, 9, "#e7f4ec", "bold", "center");
    }
    ctx.restore();
  },
  regionalEquipment(theme, branch, level, accent) {
    const ink="#354d4d";
    if(theme==="city") {
      if(branch===0) {
        this.line([[-23,5],[-23,-47]],ink,3);this.box(-29,-52,12,22,"#293e49",ink,3);
        ["#f1987d","#e8d788",accent].forEach((color,i)=>this.circle(-23,-47+i*6,2,color));
      } else {
        for(const x of [-30,21]) {this.box(x,-17,9,32,"#edc28c",ink,2);for(let y=-14;y<12;y+=8)this.line([[x+1,y],[x+7,y+4]],"#5a6360",3);}
      }
    } else if(theme==="country") {
      if(branch===0) {
        this.line([[-24,8],[-24,-43]],"#836d4b",4);
        ctx.save();ctx.translate(-24,-43);ctx.rotate(-.4);
        for(let blade=0;blade<4;blade++){ctx.rotate(Math.PI/2);this.polygon([[0,-2],[16,-5],[17,1],[3,3]],"#e5dda8",ink);}
        this.circle(0,0,4,accent);ctx.restore();
      } else {
        this.box(20,-29,14,34,"#85b8ba",ink,6);this.oval(27,-29,7,4,"#bddedf",ink);
        this.line([[26,4],[26,15],[-22,15],[-22,-7]],"#628c84",4);this.circle(-22,-9,4,accent);
      }
    } else if(theme==="desert") {
      if(branch===0) {
        for(const side of [-1,1]) {
          const x=side*23;this.line([[x,8],[x,-32]],"#93806a",3);
          this.polygon([[x-10,-36],[x+8,-41],[x+12,-19],[x-6,-14]],"#547b9a",ink);
          this.line([[x-4,-32],[x+6,-35],[x+9,-23],[x-1,-20]],"#a3cbdb",1);
        }
      } else {
        for(const x of [-30,21]) {this.box(x,-28,10,39,"#b79570",ink,3);for(let y=-24;y<6;y+=6)this.line([[x,y],[x+10,y]],"#ead0a3",2);}
        this.line([[-27,17],[27,17]],"#e8ca8e",5);
      }
    } else if(theme==="hills") {
      if(branch===0) {
        for(const side of [-1,1])this.polygon([[side*13,6],[side*24,-24],[side*34,13],[side*26,19]],"#aeb6bc",ink);
        this.line([[-28,10],[-25,-6]],accent,3);this.line([[28,10],[25,-6]],accent,3);
      } else {
        for(const x of [-29,20]) {
          this.box(x,-17,11,39,"#414e54",ink,6);
          for(let y=-12;y<20;y+=7)this.box(x+1,y,9,4,"#85989c",null,1);
        }
      }
    } else if(theme==="sea") {
      if(branch===0) {
        this.oval(-23,13,12,21,"#c7e0db",ink);this.oval(23,13,12,21,"#c7e0db",ink);
        this.line([[-29,19],[-18,19]],accent,4);this.line([[18,19],[29,19]],accent,4);
        this.circle(-27,-19,9,"#f3ddd0");this.circle(-27,-19,5,"#e79d83");
      } else {
        this.line([[24,-38],[24,13]],ink,3);this.line([[12,4],[24,15],[36,4]],"#879f9e",4);
        this.circle(24,-38,4,accent);this.line([[24,-22],[34,-22]],"#dbe8d9",3);
        this.box(-29,-26,10,33,"#678f9f",ink,4);
      }
    } else if(theme==="forest") {
      if(branch===0) {
        for(const side of [-1,1]) {
          this.line([[side*6,19],[side*25,12],[side*29,-5],[side*23,-33]],"#5e7d50",6);
          this.oval(side*25,-27,9,4,"#b4ce85");this.oval(side*29,-12,9,4,"#80ab72");
        }
      } else {
        for(const x of [-27,27]) {
          this.box(x-5,-25,10,34,"#76978f",ink,5);this.oval(x,-21,5,9,"#d7c8f7");
          this.circle(x,-22,2,"#ffffff");this.circle(x-3,-35,2,accent);this.circle(x+4,-43,2,accent);
        }
      }
    }
    if(level===4)this.line([[-18,21],[18,21]],accent,3);
  },
  flag(x, y, color) {
    // 集合点使用道路信标，不使用军旗。
    this.oval(x, y + 2, 11, 5, "#304e5840", color);
    this.line([[x, y], [x, y - 17]], "#3d5760", 3);
    this.box(x - 5, y - 22, 10, 9, color, "#36545d", 3);
    this.circle(x, y - 18, 2, "#ffffff");
  },
  soldier(s) {
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale(CONFIG.soldierScale, CONFIG.soldierScale);
    const advanced = s.owner.level >= 3, accent = s.owner.stats.color;
    const swing=(s.swingTime||0)/.24;
    this.oval(1, 6, 8, 4, "#233f4850");
    if (s.owner.theme === "sea") this.oval(0, 7, 13, 5, "#d5dcd1", "#41616c");
    this.line([[-3, 3], [-4, 8]], "#294654", 3);
    this.line([[3, 3], [4, 8]], "#294654", 3);
    this.box(-5, -6, 10, 11, advanced ? "#d7e6dd" : "#7398a4", "#354e58", 3);
    this.line([[-4, -2], [4, -2]], "#f3c882", 2);
    this.circle(0, -10, 5, "#deb892");
    this.box(-6, -16, 12, 8, advanced ? "#e4eee7" : "#a8c5ca", "#38545c", 4);
    this.box(-5, -12, 10, 4, "#365968", null, 2);
    ctx.save();ctx.translate(4,-3);ctx.rotate(s.angle||0);
    this.line([[0,0],[8+swing*(advanced?12:6),-4]],accent,advanced?4:3);
    if(advanced&&s.owner.branch===1)this.line([[0,4],[10+swing*10,7]],accent,3);
    ctx.restore();
    if (s.owner.branch !== 1) this.box(-11, -5, 7, 11, "#c0e4e5aa", "#6399a9", 2);
    ctx.restore();
    // 血条不随人物缩放，缩小单位后仍能判断受损情况。
    this.box(s.x - 6, s.y + 8, 12, 2, "#465651", null, 1);
    this.box(s.x - 6, s.y + 8, 12 * s.health / s.maxHealth, 2, "#b4ddb1", null, 1);
  },
});

// ---- src/render/vehicles.js ----
"use strict";

// 精细交通单位：缩小轮廓，用面板、玻璃反光、铆钉和章节设备表现差异。
// 仅绘制，生命、碰撞和道路位置由 Enemy 维护。
Object.assign(Renderer, {
  vehicle(type,x,y,angle=0,frozen=false,shield=false) {
    const spec=ENEMIES[type],kind=spec.visual||type,boss=spec.boss;
    const tiny=kind==="runner"||kind==="swarm";
    const w=boss?54:tiny?23:kind==="splitter"?37:32,h=boss?30:tiny?13:21;
    const ink="#31454b",metal="#d0d6bd",glass="#284e63",paint=frozen?"#acd5df":spec.color;
    ctx.save();ctx.translate(x,y);ctx.scale(CONFIG.enemyVisualScale,CONFIG.enemyVisualScale);
    if(shield){
      this.oval(0,0,w*.66,h*.87,"#b4ecf51f","#80bbd6");
      this.line([[-w*.48,-h*.65],[-w*.6,0],[-w*.48,h*.65]],"#d8f4eb",1.5);
    }
    ctx.rotate(angle);
    this.oval(2,5,w*.54,h*.57,"#263d403d");
    if(spec.skin==="sea"){
      this.polygon([[-w/2,-h/2],[w/2-5,-h/2],[w/2+5,0],[w/2-5,h/2],[-w/2,h/2],[-w/2+3,0]],paint,ink);
      this.polygon([[-w/2+4,-h/2+3],[w/2-6,-h/2+3],[w/2,0],[w/2-6,h/2-3],[-w/2+4,h/2-3]],"#dcdcc2");
      for(const side of [-1,1])this.line([[-w/2+3,side*(h/2-1)],[w/2-6,side*(h/2-1)]],"#fff0ce",1);
      this.box(-9,-h/2+5,16,h-10,paint,ink,3);
      this.box(0,-h/2+6,5,h-12,glass,null,1);
      this.line([[1,-h/2+7],[3,-h/2+9]],"#a6d5d3",1);
      this.line([[-w/2-3,-6],[-w/2-7,0],[-w/2-3,6]],"#dbe6ce",1.5);
      for(const side of [-1,1])this.circle(-7,side*(h/2-2),1.5,"#b99c6d");
      if(boss){this.box(-13,-7,11,14,"#627f86",ink,2);this.circle(-8,0,4,metal);this.line([[-8,0],[11,0]],ink,4);this.line([[-8,-1],[11,-1]],metal,1);}
      if(spec.heal){this.line([[-7,-4],[-7,4]],"#5f956a",2);this.line([[-11,0],[-3,0]],"#5f956a",2);}
    }else if(kind==="runner"&&spec.skin!=="desert"){
      for(const px of [-10,10]){this.box(px-3,-4,6,8,ink,null,2);this.line([[px-1,-3],[px-1,3]],"#9daea5",1);}
      this.box(-8,-4,16,8,paint,ink,3);
      this.line([[-7,-2],[4,-2]],"#fff2c9",1);
      this.oval(-1,0,5,4,"#bca580",ink);this.circle(1,-1,3.5,glass);this.line([[1,-3],[3,-2]],"#badbd8",1);
      this.line([[7,-6],[7,6]],metal,1.5);this.circle(11,0,1.5,"#fff1b4");
    }else{
      const armored=kind==="armor"||boss;
      if(armored&&spec.skin==="hills"){
        for(const side of [-1,1]){
          this.box(-w/2,side*h/2-3,w,6,ink,null,2);
          for(let px=-w/2+3;px<w/2;px+=5)this.line([[px,side*h/2-2],[px,side*h/2+2]],"#8a9b98",1);
        }
      }else for(const px of boss?[-19,0,19]:[-w*.3,w*.3])for(const side of [-1,1]){
        this.box(px-4,side*h/2-3,8,6,ink,null,2);this.line([[px-2,side*h/2],[px+2,side*h/2]],"#8b9a94",1);
      }
      this.box(-w/2,-h/2,w,h,paint,ink,4);
      this.box(-w/2+2,h/2-5,w-4,3,"#31454b33",null,1);
      this.line([[-w/2+4,-h/2+2],[w/2-5,-h/2+2]],"#fff4d6b8",1.3);
      this.box(w/2-10,-h/2+3,6,h-6,glass,metal,2);
      this.line([[w/2-9,-h/2+4],[w/2-6,-h/2+7]],"#bdded9",1);
      this.line([[w/2-3,-h/2+3],[w/2-3,h/2-3]],ink,1);
      this.box(-w/2+4,-h/2+4,w-17,h-8,armored?"#72858a":paint,"#31454b88",2);
      for(const side of [-1,1]){
        this.box(w/2-2,side*(h/2-4)-1,2,3,"#fff1ab",null,1);
        this.box(-w/2,side*(h/2-4)-1,2,3,"#c86c54",null,1);
        this.circle(-w/2+5,side*(h/2-3),.9,metal);
      }
      if(kind==="healer"){
        this.box(-9,-h/2+5,9,h-10,"#e4e3bc",ink,2);
        this.line([[-5,-4],[-5,4]],"#60977c",2.5);this.line([[-9,0],[-1,0]],"#60977c",2.5);
        this.box(2,-h/2-1,4,2,"#eabc67",null,1);
      }else if(armored){
        this.box(-9,-6,16,12,"#8f9c96",ink,3);this.line([[-6,-4],[3,-4]],metal,1);
        this.circle(-3,0,3.5,"#52666a");this.box(1,-2,boss?22:13,4,ink,metal,1);
        this.box(boss?20:11,-2,3,4,"#31454b",null,1);
        for(const side of [-1,1])this.circle(-7,side*4,1,metal);
        if(boss){
          for(const side of [-1,1]){this.box(-23,side*10-2,11,4,"#e9bf73",ink,1);this.line([[-22,side*10-1],[-19,side*10+1],[-16,side*10-1]],ink,1);}
          for(let px=-21;px<-10;px+=3)this.line([[px,-5],[px,5]],"#2f454e",1);
        }
      }else if(kind==="shield"){
        this.oval(-5,0,6,7,"#36566c",metal);this.oval(-5,0,3.5,5,"#87c4cf");this.line([[-5,-3],[-5,3]],"#eaf8db",1.5);
      }else if(kind==="splitter"){
        for(const px of [-13,-6,1]){this.box(px,-6,5,12,"#92779d",ink,1);this.line([[px+1,-4],[px+3,-4]],"#e5ccb9",1);this.circle(px+2.5,3,1,"#d4c7e1");}
      }else{
        this.line([[-8,-4],[0,-4],[2,1]],"#fff0c899",1);this.box(-7,-2,7,5,"#294b5866",null,1);
      }
      // 小尺寸章节设备，始终保持在原有轮廓内。
      if(spec.skin==="country"){
        this.line([[-w/2+3,-h/2+1],[-w/2+3,h/2-1]],"#806c46",2);
        if(boss)for(let py=-10;py<=10;py+=4)this.line([[w/2-2,py],[w/2+2,py]],"#d9c28b",1);
      }else if(spec.skin==="desert"){
        this.circle(-w/2+6,0,4,ink);this.circle(-w/2+6,0,2,"#bf9c72");
        this.line([[-2,-h/2+4],[2,-h/2+4]],"#fff0ce",1);
      }else if(spec.skin==="forest"){
        for(const side of [-1,1]){
          this.polygon([[-w/2+2,side*3],[-w/2+8,side*(h/2+2)],[-2,side*(h/2-1)]],"#77945c",ink);
          this.line([[-w/2+4,side*4],[-5,side*(h/2-1)]],"#bdd293",1);
        }
        if(spec.heal)this.circle(-6,0,3,"#c8e7aa");
      }
    }
    if(frozen)this.line([[-w/2+2,-h/2],[0,-h/2-1],[w/2-3,-h/2]],"#e3f6f1",1.5);
    ctx.restore();
  }
});

// ---- src/render/combat.js ----
"use strict";

// 仅绘制：弹体位置、命中时刻和伤害仍由实体决定，不用动画重复结算伤害。
// 所有动画使用模拟时间，因此暂停会定格，倍速会同步加快。
Object.assign(Renderer, {
  attackRing(x, y, radius, color, width = 2) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(.1, radius), 0, Math.PI * 2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  },
  attackEffect(effect) {
    const {x,y,color,radius,visual,kind} = effect;
    const progress = 1 - effect.life / effect.duration;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - progress);
    if (!visual) {
      this.attackRing(x,y,3+radius*progress,color,3);
      ctx.restore(); return;
    }
    const advanced=visual.level>=3, enhanced=visual.level>=2;
    const spread=3+(radius-3)*progress;
    if (kind === "pulse") {
      // 信号灯扫描圈与停车横线；高级形态增加同步路口节点。
      for(const side of [-1,1])this.line([[x-spread*.4,y+side*spread*.65],[x+spread*.4,y+side*spread*.65]],"#eab36f",enhanced?4:2);
      this.attackRing(x,y,spread,color,advanced?3:2);
      if(enhanced)this.attackRing(x,y,spread*.7,color,1.5);
      if(advanced) {
        const spokes=visual.level===4?12:8;
        for(let i=0;i<spokes;i++) {
          const angle=i*Math.PI*2/spokes+progress*(visual.branch===1?1.2:.2);
          const inner=visual.branch===0?spread*.82:spread*.35;
          this.line([[x+Math.cos(angle)*inner,y+Math.sin(angle)*inner],
            [x+Math.cos(angle)*spread,y+Math.sin(angle)*spread]],color,2);
          if(visual.branch===0)this.circle(x+Math.cos(angle)*spread,y+Math.sin(angle)*spread,3,"#effffd");
        }
      }
    } else if (kind === "strike") {
      ctx.save();ctx.translate(x,y);
      if(advanced&&visual.branch===0) {
        // 重装队员盾击：六边冲击面与冲击环。
        const points=Array.from({length:6},(_,i)=>[Math.cos(i*Math.PI/3)*spread,Math.sin(i*Math.PI/3)*spread]);
        this.polygon(points,"#bff9ed20",color);this.attackRing(0,0,spread*.55,"#eefbdb",2);
      } else {
        ctx.rotate(-.7+progress*.6);
        const count=advanced?3:enhanced?2:1;
        for(let i=0;i<count;i++)this.line([[-spread,(i-1)*5],[spread,(i-1)*5-7]],color,advanced?3:2);
      }
      ctx.restore();
    } else if (visual.type === "missile") {
      // 制动索网落地；强化重锚以辐射拉索，双网则以交织网格区分。
      this.attackRing(x,y,spread,color,advanced?3:2);
      const spokes=visual.level===4?10:enhanced?8:5;
      for(let i=0;i<spokes;i++){
        const angle=i*Math.PI*2/spokes,px=x+Math.cos(angle)*spread,py=y+Math.sin(angle)*spread;
        this.line([[x,y],[px,py]],"#eee3ba",1.3);
        this.circle(px,py,advanced&&visual.branch===0?4:2,color);
      }
      if(advanced&&visual.branch===1){this.attackRing(x,y,spread*.5,"#f7e7b2",2);this.attackRing(x,y,spread*.75,color,1.5);}
    } else {
      this.attackRing(x,y,spread,color,enhanced?3:1.5);
      if(advanced) {
        const count=visual.branch===0?4:8;
        for(let i=0;i<count;i++) {
          const angle=i*Math.PI*2/count+progress;
          this.line([[x+Math.cos(angle)*spread*.4,y+Math.sin(angle)*spread*.4],
            [x+Math.cos(angle)*spread,y+Math.sin(angle)*spread]],color,visual.level===4?3:2);
        }
      }
    }
    ctx.restore();
  },
  attackBeam(beam) {
    const {a,b,color,visual}=beam, advanced=visual?.level>=3;
    const progress=1-beam.life/beam.duration;
    ctx.save();ctx.globalAlpha=1-progress;
    if(advanced&&visual.beamStyle==="chain") {
      // 连锁专精用折线电弧，末端闪光表明每一跳实际命中位置。
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.max(1,Math.hypot(dx,dy));
      const points=Array.from({length:7},(_,i)=>{
        const jitter=i===0||i===6?0:Math.sin(i*2.7+progress*18)*7;
        return [a.x+dx*i/6-dy/length*jitter,a.y+dy*i/6+dx/length*jitter];
      });
      this.line(points,color,visual.level===4?5:3);this.line(points,"#f1ffec",1);
    } else {
      // 聚能专精的直束与连锁电弧有不同轮廓。
      this.line([[a.x,a.y],[b.x,b.y]],color,advanced?(visual.level===4?9:6):3);
      if(advanced)this.line([[a.x,a.y],[b.x,b.y]],"#edfff2",2);
    }
    if(advanced)this.attackRing(b.x,b.y,4+progress*13,color,2);
    ctx.restore();
  },
  projectile(p) {
    const remaining=Collision.distance(p,p.destination);
    const progress=p.travelled/Math.max(1,p.travelled+remaining);
    const {level,branch}=p.visual, advanced=level>=3;
    const launchHeight=p.type==="missile"?(advanced&&branch===0?50:25):(advanced&&branch===0?30:level===1?15:21);
    const lift=launchHeight*(1-progress)+(p.type==="missile"?Math.sin(progress*Math.PI)*(advanced?(branch===0?56:24):32):0);
    const angle=Math.atan2(p.destination.y-p.y,p.destination.x-p.x),color=p.stats.color;
    this.oval(p.x+2,p.y+4,p.type==="missile"?5:2,2,"#294e4430");
    ctx.save();ctx.translate(p.x+(p.type==="rail"?Math.cos(angle)*24*(1-progress):0),p.y-lift);ctx.rotate(angle);
    if(p.type==="missile") {
      const count=advanced&&branch===1?2:1;
      for(let i=0;i<count;i++) {
        ctx.save();ctx.translate(-i*7,(i-(count-1)/2)*12);
        const size=advanced&&branch===0?1.5:level===2?1.15:1;
        ctx.scale(size,size);
        this.line([[-(level===4?38:24),0],[-9,0]],color+"88",level>=2?4:2);
        this.line([[-10,0],[6,0]],"#e1d6ad",3);
        this.line([[0,-8],[6,0],[0,8]],color,3);
        this.line([[-4,-6],[1,0],[-4,6]],"#607b7a",2);
        if(advanced&&branch===0){this.line([[-6,-5],[-2,5]],color,2);this.line([[-2,-5],[2,5]],color,2);}
        ctx.restore();
      }
    } else if(advanced&&branch===0) {
      this.line([[-(level===4?38:29),0],[5,0]],color,5);
      this.line([[-22,0],[7,0]],"#f1fff2",2);
      this.oval(-8,0,4,8,"#ffffff10",color);
      if(level===4)this.oval(-20,0,4,9,"#ffffff10",color);
    } else {
      const count=advanced?2:level===2?2:1;
      for(let i=0;i<count;i++) {
        const y=(i-(count-1)/2)*(advanced?7:3);
        this.line([[-(advanced?22:13),y],[2,y]],color,advanced?3:2);
        this.circle(2,y,level===4?3:2,"#e5fff3");
      }
    }
    ctx.restore();
  }
});

// ---- src/render/traffic.js ----
"use strict";

Object.assign(Renderer,{
  speedSign(x,y,road) {
    this.line([[x,y+8],[x,y+25]],"#81785f",3);
    this.circle(x,y,13,"#bc604b");this.circle(x,y,10,"#f9edce");
    this.text(String(road.limit),x,y,11,"#494d43","bold","center");
    this.box(x-24,y+28,48,14,"#eee0b7","#9e8b64",3);
    this.text(road.name,x,y+35,9,"#605744","bold","center");
  },
  trafficGround(game) {
    const t=game.traffic,seen=new Set();
    for(const path of game.road.routes)for(let i=0;i<path.length-1;i++){
      const a=path[i],b=path[i+1],key=`${a.x},${a.y}:${b.x},${b.y}`;
      if(seen.has(key))continue;seen.add(key);
      const type=Traffic.type(game.level,path,i),road=ROAD_TYPES[type],length=Collision.distance(a,b);
      // 淡色路面与限速牌共用速度配置，避免装饰标识与规则不一致。
      if(type!=="street")this.line([[a.x,a.y],[b.x,b.y]],road.color+"4d",CONFIG.roadWidth-7);
      if(type==="dirt"||type==="sand")this.line([[a.x,a.y],[b.x,b.y]],"#e8d2a459",3,[2,13]);
      if(type==="bridge"){
        const nx=-(b.y-a.y)/length*22,ny=(b.x-a.x)/length*22;
        for(const side of [-1,1])this.line([[a.x+nx*side,a.y+ny*side],[b.x+nx*side,b.y+ny*side]],"#c7b78d",4);
      }
      if(i===1&&length>70){
        const x=a.x+(b.x-a.x)*.35,y=a.y+(b.y-a.y)*.35;
        this.speedSign(x,y-27,road);
      }
    }
    if(t.fork){
      const path=Traffic.path(game);
      this.line(path.slice(t.fork.segment).map(p=>[p.x,p.y]),"#a0e0bd99",3,[8,12]);
    }
  },
  trafficActors(game) {
    const t=game.traffic,kind=game.level.mission;
    if(kind==="toll")for(const path of game.road.routes){
      const end=path.at(-1);
      ctx.save();ctx.translate(end.x-28,end.y);
      this.box(-12,14,26,17,"#dbc99c","#786c52",3);this.box(-8,16,16,8,"#45666a",null,2);
      this.line([[-13,-22],[-13,12]],"#776e58",4);this.line([[17,-22],[17,12]],"#776e58",4);
      this.box(-22,-38,46,18,"#3e7368","#e8d5a3",3);this.text("ETC",1,-29,12,"#fff1c1","bold","center");
      const y=t.activeTime>0?0:-17;
      this.line([[-13,12],[15,y]],"#fff0cb",5);this.line([[-7,9],[0,t.activeTime>0?6:-1]],"#c96b4e",5);
      ctx.restore();
    }
    if(kind==="bridge"){
      const p=t.bridge;
      this.box(p.x-38,p.y-38,76,17,"#355d59","#d9c799",4);
      this.text(`桥梁 ${Math.ceil(t.integrity)}%`,p.x,p.y-30,11,"#fff0cc","bold","center");
      this.box(p.x-29,p.y-20,58,4,"#8a6953",null,1);this.box(p.x-29,p.y-20,58*t.integrity/100,4,"#a8d6a3",null,1);
    }
    const event=game.level.routeEvent;
    if(event){
      const old=(game.previousRoad||game.road).path(0),a=old[1],b=old[2];
      const length=Collision.distance(a,b),x=a.x+(b.x-a.x)*Math.min(.4,60/length),y=a.y+(b.y-a.y)*Math.min(.4,60/length);
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));
      if(event.kind==="tunnel"){
        this.box(-12,-26,24,52,"#7f8980","#566961",8);this.box(-15,-17,30,34,"#3d4f4b",null,3);
      }else if(event.kind==="bridge"){
        this.line([[-23,-23],[23,-23]],"#bba77d",5);this.line([[-23,23],[23,23]],"#bba77d",5);
        if(game.routeChanged)this.polygon([[-18,-16],[0,-25],[0,25],[-18,16]],"#c8b789","#756b58");
      }else if(event.kind==="construction"){
        this.line([[-20,-23],[20,-23]],"#d2bc86",6);
        for(const sx of [-18,18])this.polygon([[sx-4,24],[sx,13],[sx+4,24]],"#c67b4b","#f0d7aa");
      }
      if(game.routeChanged){this.line([[0,-19],[0,19]],"#f8dfab",7);for(let sy=-15;sy<20;sy+=10)this.line([[-3,sy-3],[3,sy+3]],"#b76248",4);}
      else if(event.kind==="tidal")this.line([[-14,-4],[0,-4],[-4,-9],[0,-4],[-4,1]],"#d5e8b1",3);
      ctx.restore();
    }
    if(t.fork){
      const p=t.fork.node;
      this.line([[p.x,p.y],[p.x,p.y-19]],"#777252",3);
      this.box(p.x-28,p.y-43,56,26,"#386b61","#e5d3a2",5);
      this.text(`↗ ${String.fromCharCode(65+t.branch)}`,p.x,p.y-30,17,"#fff0b8","bold","center");
      if(t.switchCooldown>0)this.text(`${Math.ceil(t.switchCooldown)}s`,p.x,p.y+19,11,"#4b695b","bold","center");
    }
    for(const car of t.civilians)this.civilVehicle(car,game);
  },
  civilVehicle(car,game) {
    // 民用车辆使用相邻通行带，避免和敌车绘制在同一中心线上。
    car={...car,x:car.x-Math.sin(car.angle)*11,y:car.y+Math.cos(car.angle)*11};
    const bus=car.kind==="bus",sea=game.level.theme==="sea",color=bus?"#edbe59":"#f5edce";
    ctx.save();ctx.translate(car.x,car.y);ctx.rotate(car.angle);
    this.oval(0,3,22,11,"#39473838");
    if(sea)this.polygon([[-23,-12],[17,-12],[27,0],[17,12],[-23,12]],"#e6e4c9","#526b6b");
    else for(const x of [-12,13])for(const y of [-10,7])this.box(x-3,y,7,4,"#344647",null,1);
    this.box(-21,-9,42,18,color,"#5a6b63",5);
    this.box(12,-7,6,14,"#436974",null,2);
    if(bus){for(const x of [-15,-6,3])this.box(x,-6,6,12,"#557c83",null,2);this.line([[-17,7],[17,7]],"#ba703d",2);}
    else {this.line([[-9,0],[3,0]],"#d96e55",4);this.line([[-3,-6],[-3,6]],"#d96e55",4);this.box(7,-6,3,12,game.traffic.clock%1<.5?"#ed8a72":"#6ac8d9",null,1);}
    ctx.restore();
    const label=bus?(sea?"客渡":"公交"):(sea?"救援":"急救");
    this.box(car.x-23,car.y-26,46,13,"#356e6699",null,3);this.text(label,car.x,car.y-20,10,"#ffedbc","bold","center");
    this.box(car.x-20,car.y+16,40,4,"#725b4c",null,1);
    this.box(car.x-20,car.y+16,40*(bus?car.health/100:Math.min(1,car.deadline/60)),4,car.blocked?"#e5a061":"#a6dca6",null,1);
    if(game.traffic.activeTime>0)this.attackRing(car.x,car.y,28,"#a0dcbd",2);
  },
  trafficControls(game,rect) {
    const t=game.traffic,mission=Traffic.mission(game.level),gap=8,count=t.fork?2:1,w=(rect.w-gap*(count-1))/count;
    if(t.fork)this.button(game,{x:rect.x,y:rect.y,w,h:rect.h},`分流 ${String.fromCharCode(65+t.branch)} ›${t.switchCooldown>0?` ${Math.ceil(t.switchCooldown)}s`:""}`,()=>Traffic.switchRoute(game),{disabled:t.switchCooldown>0,size:19});
    const disabled=game.paused||t.actionCooldown>0||(game.level.mission==="bridge"?(game.gold<CONFIG.bridgeRepairCost||t.integrity>=100):game.level.mission!=="toll"&&!t.civilians.length);
    this.button(game,{x:rect.x+(count-1)*(w+gap),y:rect.y,w,h:rect.h},`${mission.action}${t.actionCooldown>0?` ${Math.ceil(t.actionCooldown)}s`:""}`,()=>Traffic.action(game),{disabled,size:19});
  }
});

"use strict";

// 原创交通图册视觉：纸纹、等高线、工业路牌。仅微信入口加载，无位图素材。
const AtlasArt = {
  palettes: {city:"#d9cba5",country:"#cfcaa0",desert:"#dfc18e",hills:"#c8c8ad",sea:"#adc4bc",forest:"#b9c4a0"},
  paper(rect,theme="city") {
    const {x,y,w,h}=rect;
    ctx.fillStyle=this.palettes[theme];ctx.fillRect(x,y,w,h);
    ctx.save();
    // 确定性细纹，不使用逐帧随机，避免画面闪动。
    for(let n=0;n<420;n++){
      const px=x+(n*197.31)%w,py=y+(n*91.73)%h;
      ctx.fillStyle=n%3?"#77664712":"#fff4cc30";ctx.fillRect(px,py,2+n%5,1);
    }
    ctx.strokeStyle="#74664620";ctx.lineWidth=1.5;
    for(let n=0;n<14;n++){
      const px=x+(n*127)%w,py=y+(n*173)%h;
      ctx.beginPath();ctx.moveTo(px-120,py+36);ctx.bezierCurveTo(px-90,py-40,px+80,py+70,px+170,py-30);ctx.stroke();
    }
    ctx.restore();
  },
  scenery(rect,theme,seed=0,blocked=()=>false) {
    this.paper(rect,theme);const {x,y,w,h}=rect,R=Renderer;
    if(theme==="city"||theme==="country"||theme==="forest"){
      const river=[[x+w*.68,y-20],[x+w*.64,y+h*.23],[x+w*.74,y+h*.49],[x+w*.67,y+h*.72],[x+w*.73,y+h+20]];
      R.line(river,"#718f7d38",61);R.line(river,"#8da99a70",48);R.line(river,"#dce1bc80",2,[4,12]);
    }
    for(let n=0;n<(theme==="forest"?64:42);n++){
      const px=x+46+(n*173+seed*57)%Math.max(1,w-92),py=y+55+(n*137+seed*41)%Math.max(1,h-110);
      if(!blocked({x:px,y:py}))this.landmark(theme,px,py,.8+(n%3)*.16,n);
    }
  },
  landmark(theme,x,y,scale=1,variant=0) {
    const R=Renderer,ink="#796c4c",light="#ecdfb5",shade="#b5a57c";
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha=.77;
    if(theme==="city"){
      const kind=variant%6;
      if(kind===1){
        // 加油站：红陶雨棚、油泵、轮胎；区别于普通房屋的外轮廓。
        R.polygon([[-38,8],[7,-12],[40,9],[-4,31]],"#cbbd94",ink);
        R.line([[-21,5],[-21,-25]],ink,3);R.line([[23,2],[23,-27]],ink,3);
        R.polygon([[-37,-22],[1,-40],[38,-21],[0,-3]],"#bd8861",ink);
        R.line([[-28,-23],[0,-35],[27,-22]],"#eed3a1",2);
        for(const px of [-12,10]){R.box(px,0,10,19,light,ink,2);R.box(px+2,3,6,5,"#7c947e",null,1);R.line([[px+10,6],[px+15,10],[px+13,16]],ink,2);}
      }else if(kind===2){
        // 街心绿地与有方向箭头的环岛。
        R.oval(0,4,41,23,"#abb58a",ink);R.oval(0,3,29,14,"#d9c89d",ink);
        R.line([[-51,4],[-39,4]],ink,4);R.line([[39,4],[54,4]],ink,4);
        R.line([[0,-25],[0,-15]],ink,4);R.line([[0,22],[0,34]],ink,4);
        R.line([[-18,-11],[-8,-12],[-13,-16]],"#e8dfb9",2);
        R.line([[0,7],[0,-9]],ink,3);R.circle(0,-13,12,"#a5b184");R.circle(-4,-17,9,"#b7bf92");
      }else if(kind===3){
        // 车场：成排车棚、泊位和停放的小货车。
        R.polygon([[-39,9],[-12,-9],[42,9],[13,29]],"#c6b68c",ink);
        for(let i=0;i<3;i++){
          const dx=-22+i*17;R.box(dx,-4,13,18,i%2?"#a59572":"#b9a47b",ink,2);
          R.box(dx+2,-2,9,4,"#7c8774",null,1);R.line([[dx-2,18],[dx+10,23]],light,1.5);
        }
        R.line([[-28,-10],[2,-27],[42,-13]],ink,3);R.line([[-28,-10],[-28,5]],ink,2);R.line([[42,-13],[42,9]],ink,2);
      }else if(kind===4){
        // 铁路高架与桥墩。
        R.line([[-47,19],[43,-18]],ink,12);R.line([[-47,16],[43,-21]],"#c3b590",8);
        for(let i=0;i<7;i++)R.line([[-43+i*13,18-i*5],[-43+i*13,9-i*5]],"#7b7356",1.5);
        for(const px of [-25,22])R.line([[px,12-px*.4],[px,30-px*.4]],ink,5);
        R.line([[-48,24],[43,-13]],"#e7d4a7",1.5);
      }else{
      // 仓库、车库、交通信号与街区，而非城堡或纹章。
      const w=variant%2?48:36;
      R.polygon([[-w/2,5],[0,-7],[w/2,5],[0,18]],"#9e927448");
      R.polygon([[-w/2,-16],[0,-28],[w/2,-16],[0,-3]],light,ink);
      R.polygon([[-w/2,-16],[0,-3],[0,17],[-w/2,4]],shade,ink);
      R.polygon([[0,-3],[w/2,-16],[w/2,5],[0,17]],"#cfbd8e",ink);
      for(let i=0;i<3;i++)R.line([[4+i*6,-1-i*3],[4+i*6,10-i*3]],ink,1.6);
      if(variant%3===0){R.line([[31,8],[31,-27]],ink,3);R.box(25,-34,12,25,"#6d735c",ink,3);R.circle(31,-28,2,"#b97450");R.circle(31,-15,2,"#b0b27f");}
      else if(variant%3===1){R.box(-22,-35,7,16,shade,ink,1);R.line([[-24,-39],[-14,-42],[-20,-47]],"#8e83624d",3);}
      if(kind===5){R.box(-31,-41,8,25,shade,ink,1);R.line([[-32,-46],[-19,-49],[-24,-54]],"#8d826233",4);R.line([[-17,-13],[-4,-19],[10,-12]],"#aa9872",2);}
      }
    }else if(theme==="country"){
      R.polygon([[-30,13],[-1,0],[32,16],[0,33]],"#c0b781",ink);
      for(let i=0;i<5;i++)R.line([[-24+i*7,14-i*3],[3+i*6,28-i*3]],"#8f8961",1.3);
      R.polygon([[-12,4],[-7,-25],[7,-25],[12,4]],light,ink);
      R.line([[-22,-36],[22,-8]],ink,3);R.line([[-20,-7],[20,-38]],ink,3);R.circle(0,-22,4,shade);
    }else if(theme==="desert"){
      R.line([[-40,16],[-25,-7],[-2,-17],[30,9]],ink,2);
      R.line([[-34,21],[-15,5],[8,-2],[38,15]],"#b29567",2);
      R.line([[17,12],[17,-22]],"#7f8055",6);R.line([[17,-2],[29,-2],[29,-14]],"#7f8055",4);
      for(let i=0;i<5;i++)R.line([[-20+i*6,8],[-16+i*6,4]],"#a18458",1);
    }else if(theme==="hills"){
      R.polygon([[-42,25],[-11,-38],[30,25]],"#a7ad88",ink);
      R.polygon([[-11,-38],[30,25],[2,12]],"#979f80");
      R.line([[-22,-16],[-12,-22],[-3,-11]],light,3);
      for(let i=0;i<5;i++)R.line([[-28+i*5,18],[-19+i*5,2]],ink,1);
    }else if(theme==="sea"){
      for(let i=0;i<3;i++)R.line([[-38,12+i*11],[-24,15+i*11],[-8,12+i*11],[7,15+i*11],[28,11+i*11]],"#678e83",1.5);
      if(variant%2){R.polygon([[-28,0],[27,0],[16,13],[-19,13]],"#c6b68b",ink);R.line([[0,0],[0,-30]],ink,2);R.polygon([[4,-28],[4,-3],[23,-3]],light,ink);}
      else{R.polygon([[-11,8],[-6,-27],[6,-27],[11,8]],light,ink);R.box(-9,-34,18,10,"#b68b64",ink,2);R.line([[-7,-12],[7,-12]],"#a86148",5);}
    }else{
      for(let i=0;i<3;i++){
        const tx=(i-1)*23,ty=i%2*10;
        R.line([[tx,ty+20],[tx,ty-13]],ink,2);
        R.polygon([[tx-19,ty+10],[tx,ty-32],[tx+19,ty+10]],i%2?"#8c9c72":"#a3ae82",ink);
        R.line([[tx-8,ty],[tx,ty-20]],light,1.3);
      }
    }
    ctx.restore();
  },
  compass(x,y) {
    const R=Renderer;R.circle(x,y,41,"#e5d6ac88");
    R.line([[x-38,y],[x+38,y]],"#877651",1);R.line([[x,y-38],[x,y+38]],"#877651",1);
    R.polygon([[x,y-32],[x+9,y],[x,y+32],[x-9,y]],"#a56846","#746344");
    R.polygon([[x-32,y],[x,y-9],[x+32,y],[x,y+9]],"#d7c395","#746344");
    R.circle(x,y,5,"#566f62");R.text("N",x,y-53,16,"#786747","bold","center");
  },
  roadSign(x,y,label,{locked=false,boss=false,stars=0,active=false}={}) {
    const R=Renderer;
    R.line([[x+2,y+12],[x+2,y+43]],"#725d3c",7);R.line([[x,y+12],[x,y+40]],"#b1a485",3);
    R.polygon([[x-37,y-22],[x+31,y-22],[x+43,y],[x+31,y+25],[x-37,y+25]],"#584d3940");
    R.polygon([[x-39,y-26],[x+30,y-26],[x+41,y-2],[x+30,y+22],[x-39,y+22]],locked?"#a8a38b":active?"#bb6947":"#567b6e","#5b533c");
    R.line([[x-32,y-20],[x+25,y-20],[x+34,y-2],[x+25,y+16],[x-32,y+16],[x-32,y-20]],"#efdcaa",1.5);
    R.text(label,x-2,y-2,24,locked?"#d9d4b9":"#fff1cc","bold","center");
    if(boss){R.polygon([[x+28,y-42],[x+42,y-21],[x+14,y-21]],"#b75e43","#6c513c");R.text("!",x+28,y-29,16,"#fff1c6","bold","center");}
    for(let i=0;i<3;i++)R.text(i<stars?"★":"☆",x-22+i*22,y-42,19,i<stars?"#a97831":"#9e9271","bold","center");
  },
  chain(rect) {
    const {x,y,w,h}=rect,R=Renderer;
    ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,6);ctx.clip();
    R.box(x,y,w,h,"#514b3d25",null,0);
    for(const slope of [-1,1]){
      const ax=x-8,ay=y+h/2-slope*h*.42,bx=x+w+8,by=y+h/2+slope*h*.42;
      const length=Math.hypot(bx-ax,by-ay),angle=Math.atan2(by-ay,bx-ax);
      ctx.save();ctx.translate(ax,ay);ctx.rotate(angle);
      for(let d=0;d<length;d+=13){
        ctx.beginPath();ctx.ellipse(d,2,11,5,0,0,Math.PI*2);ctx.strokeStyle="#413e35";ctx.lineWidth=6;ctx.stroke();
        ctx.beginPath();ctx.ellipse(d,0,10,4,0,0,Math.PI*2);ctx.strokeStyle=d%26?"#9b9e94":"#c2c2ad";ctx.lineWidth=3;ctx.stroke();
      }ctx.restore();
    }
    const cx=x+w/2,cy=y+h/2;
    R.box(cx-13,cy-20,26,29,"#777e73","#3e453c",10);R.box(cx-7,cy-15,14,20,"#d0c5a4",null,5);
    R.box(cx-21,cy-5,42,34,"#b59655","#594d34",6);R.box(cx-15,cy,30,23,"#cfb373",null,4);
    R.circle(cx,cy+8,4,"#514b37");R.polygon([[cx-2,cy+9],[cx+2,cy+9],[cx+4,cy+19],[cx-4,cy+19]],"#514b37");
    ctx.restore();
  }
};

Object.assign(COLORS,{bg:"#d9cba5",panel:"#ebdebb",ink:"#443f30",muted:"#7f7459",mint:"#4d796b",gold:"#b5843f",red:"#af5b40",border:"#99825b"});
// 纸面上使用更深的识别色，避免沿用深色界面上的浅色字导致对比不足。
for(const [type,color] of Object.entries({rail:"#39786e",signal:"#636c86",missile:"#a56837",depot:"#8b5e78"}))TOWERS[type].color=color;
Object.assign(Renderer,{
  button(game,rect,label,action,options={}) {
    const hover=Collision.inside(game.uiPointer||game.pointer,rect),disabled=!!options.disabled;
    const fill=disabled?"#c7bea0":options.primary?"#d9b66d":hover?"#f3e3b9":"#e4d3a9";
    this.box(rect.x+1,rect.y+4,rect.w,rect.h,"#574c3c32",null,8);
    this.box(rect.x,rect.y,rect.w,rect.h,fill,options.active?"#466e61":"#8a7250",8);
    this.line([[rect.x+9,rect.y+5],[rect.x+rect.w-9,rect.y+5]],"#fff0c280",2);
    for(const dx of [8,rect.w-8])this.circle(rect.x+dx,rect.y+rect.h/2,1.8,"#a9905f");
    this.text(label,rect.x+rect.w/2,rect.y+rect.h/2,options.size||20,disabled?"#8a8167":COLORS.ink,"bold","center");
    game.buttons.push({...rect,label,action,disabled,locked:!!options.locked,branch:options.branch,towerType:options.towerType});
  }
});

"use strict";

// 手机使用 16:9 逻辑画布；只调整地图坐标，不拉伸车辆和炮台的造型。
// 网页端不加载此文件，两个入口仍然共用战斗规则与存档格式。
const sourceMap = {...MAP};
CONFIG.height = 720;
Object.assign(MAP, {x:24, y:96, w:1232, h:510});
const mobilePoint = ([x,y]) => [
  Math.round(MAP.x+(x-sourceMap.x)/sourceMap.w*MAP.w),
  Math.round(MAP.y+(y-sourceMap.y)/sourceMap.h*MAP.h)
];
for (const level of LEVELS) {
  level.routes = level.routes.map(route=>route.map(mobilePoint));
  if(level.routeEvent) level.routeEvent.routes = level.routeEvent.routes.map(route=>route.map(mobilePoint));
  level.sites = planConstructionSites(level);
}

Object.assign(Renderer, {
  // 首页、选关与战场分别布局；不复用桌面端的常驻信息侧栏。
  audioButtons(game,x,y) {
    this.button(game,{x,y,w:138,h:56},`音乐 ${Sound.musicEnabled?"开":"关"}`,()=>Sound.toggle("music"),{size:21});
    this.button(game,{x:x+150,y,w:138,h:56},`音效 ${Sound.enabled?"开":"关"}`,()=>Sound.toggle("effects"),{size:21});
  },
  levelModal(game) {
    const index=game.menuLevel,level=LEVELS[index],chapter=CHAPTERS[level.chapter],locked=index>game.unlocked;
    this.sheet(game,`${stageLabel(index)} · ${level.name}`,()=>{game.modal=null;});
    const preview={x:105,y:182,w:520,h:302},reservedRoad=new RoadNetwork(level,true);
    this.box(preview.x,preview.y,preview.w,preview.h,chapter.terrain,"#8caa91",14);
    ctx.save();ctx.beginPath();ctx.roundRect(preview.x,preview.y,preview.w,preview.h,14);ctx.clip();
    ctx.translate(preview.x,preview.y);ctx.scale(preview.w/MAP.w,preview.h/MAP.h);ctx.translate(-MAP.x,-MAP.y);
    AtlasArt.scenery(MAP,chapter.theme,level.stage,p=>reservedRoad.isRoad(p,55));
    if(level.routeEvent)for(const [a,b] of new RoadNetwork({routes:level.routeEvent.routes}).edges)this.line([[a.x,a.y],[b.x,b.y]],"#ffe8a9",6,[10,12]);
    this.road(new RoadNetwork(level),true,chapter);
    for(const route of level.routes){const a=route[0],b=route.at(-1);this.circle(...a,15,"#e49867");this.circle(...b,15,"#daebae");}
    ctx.restore();
    this.text(`${level.layout} · ${level.waves} 波 · ${level.gold} G`,106,513,22,COLORS.gold,"bold");
    this.text(`${Traffic.mission(level).name}${level.boss?` · ${ENEMIES[level.bossType].name}`:""}`,106,547,20,COLORS.ink);
    this.text(level.routeEvent?`第 ${level.routeEvent.wave} 波：${level.routeEvent.name}`:"橙色入口 → 绿色终点",106,579,20,COLORS.muted);
    this.text("出战塔组",672,193,26,COLORS.ink,"bold");
    game.getDeck().forEach((type,i)=>{
      const spec=TOWERS[type],x=674+i*117;
      this.box(x,232,106,126,"#d3c69e",spec.color,12);
      // 图示和名称拥有独立区域，设施底部的等级牌不能压住名称。
      ctx.save();ctx.translate(x+53,283);ctx.scale(.82,.82);this.tower({type,theme:level.theme,x:0,y:0,level:1,branch:null});ctx.restore();
      this.text(spec.name,x+53,338,19,spec.color,"bold","center");
    });
    this.text(`最好成绩  ${"★".repeat(game.progress.stars[index])+"☆".repeat(3-game.progress.stars[index])}`,672,399,23,COLORS.gold,"bold");
    this.text(Traffic.mission(level).brief,672,437,17,COLORS.muted);
    this.button(game,{x:672,y:476,w:222,h:61},"进化研究",()=>{game.modal="loadout";game.libraryChapter=level.chapter;},{size:23});
    this.button(game,{x:906,y:476,w:222,h:61},"敌情档案",()=>{game.modal="intel";game.intelChapter=level.chapter;},{size:23});
    this.button(game,{x:672,y:555,w:456,h:76},locked?`通关 ${stageLabel(index-1)} 后解锁`:"开始战斗",()=>game.startLevel(index),{primary:!locked,disabled:locked,color:COLORS.gold,size:29});
  },
  sheet(game,title,close) {
    this.box(70,72,1140,598,"#eddfb9","#957b53",22);
    this.text(title,105,122,32,COLORS.ink,"bold");
    this.button(game,{x:1090,y:96,w:84,h:60},"关闭",close,{size:23});
    this.line([[104,162],[1174,162]],"#a79165",2);
  },
  cityScenery(game) {
    const chapter=CHAPTERS[game.level.chapter];
    this.routeLayers(game);this.road(game.road,false,chapter);
    for(const route of game.road.routes){
      const entry=route[0],end=route.at(-1);
      this.circle(entry.x,entry.y,16,"#ac684c");this.text("»",entry.x,entry.y,24,"#fff3c8","bold","center");
      this.circle(end.x,end.y,19,"#4d765f");this.flag(end.x,end.y,"#f5dd99");
    }
  },
  field(game) {
    this.fieldWorld(game);
    if(game.level.routeEvent){
      const event=game.level.routeEvent;
      this.box(330,104,620,31,"#e8d4a8ed",null,8);
      this.text(Traffic.eventText(game),640,119,17,"#735638","bold","center");
    }
    if(game.paused){this.box(444,554,392,38,"#ecd9aded",COLORS.gold,10);this.text("已暂停 · 可布塔升级",640,573,22,COLORS.gold,"bold","center");}
    const boss=game.enemies.find(e=>!e.dead&&e.spec.boss);
    if(boss){this.box(406,143,468,34,"#d2bb93ed",null,8);this.text(boss.spec.name,420,160,18,COLORS.red,"bold");this.box(565,155,293,10,"#6c564a",null,4);this.box(565,155,293*Math.max(0,boss.health/boss.maxHealth),10,COLORS.red,null,4);}
  },
  waveButton(game) {
    const final=game.wave>=game.level.waves,ready=game.canStartWave();
    const rect={x:872,y:623,w:384,h:85};
    this.button(game,rect,"",()=>game.startWave(),{primary:ready,color:COLORS.gold,disabled:!ready});
    const x=919,y=665,r=29,seconds=Math.max(0,Math.ceil(game.prepareTime));
    this.circle(x,y,r+4,ready?"#6b634b":"#74694f");
    ctx.beginPath();ctx.arc(x,y,r,-Math.PI/2,-Math.PI/2+Math.PI*2*(final?1:Math.max(0,Math.min(1,1-game.prepareTime/game.waveDuration))));
    ctx.strokeStyle=COLORS.gold;ctx.lineWidth=5;ctx.stroke();
    this.text(final?"✓":game.spawnQueue.length?"…":`${seconds}`,x,y,24,"#fff1cb","bold","center");
    this.text(final?"最终波 · 完成交通任务":`${game.wave?"提前发动":"开始"}第 ${game.wave+1} 波`,1096,650,23,ready?"#193c3c":COLORS.ink,"bold","center");
    const tip=final?`场上 ${game.enemies.length} · 待出发 ${game.spawnQueue.length}`:game.paused?"暂停中":ready?`提前 ${seconds} 秒 · 奖励 +${game.earlyWaveReward} G`:`本波待出场 ${game.spawnQueue.length} · 出完后计时`;
    this.text(tip,1096,681,16,ready?"#365950":COLORS.muted,"normal","center");
  },
  modal(game) {
    if(game.modal==="saveSlots"){
      this.sheet(game,game.saveMode==="new"?"开始游戏 · 选择存档位":"读取存档 · 选择一段远征",()=>{game.modal=null;});
      Progress.list().forEach((slot,i)=>{
        const x=106,y=186+i*144,w=1068,h=127,empty=!slot,loading=game.saveMode==="load";
        this.box(x,y,w,h,empty?"#e5d5af":"#dbc89d",COLORS.border,12);
        this.text(`存档 ${i+1}`,x+22,y+31,25,COLORS.ink,"bold");
        this.text(empty?"空存档位":Progress.dateLabel(slot.createdAt),x+165,y+31,24,COLORS.ink,"bold");
        if(slot){
          const completed=slot.stars.filter(Boolean).length,index=Progress.unlocked(slot);
          this.text(`进度 ${completed} / 48 关 · ★ ${slot.stars.reduce((a,b)=>a+b,0)} / 144`,x+165,y+72,23,COLORS.gold,"bold");
          this.text(completed===48?"六章远征已完成":`${CHAPTERS[LEVELS[index].chapter].name} · 待挑战 ${stageLabel(index)} ${LEVELS[index].name}`,x+165,y+103,19,COLORS.muted);
        }else this.text(loading?"尚未建立战役":"从第一章开始，首次建立日期将自动记录",x+165,y+79,21,COLORS.muted);
        this.button(game,{x:x+w-208,y:y+32,w:185,h:67},loading?"读取":empty?"新建":"重新开始",()=>game.chooseSaveSlot(i),{disabled:loading&&empty,primary:!empty||!loading,size:25});
      });
      this.text("最多三个独立存档 · 通关自动保存 · 日期为首次建立时间",640,643,19,COLORS.muted,"normal","center");
      return;
    }
    if(game.modal==="level"){this.levelModal(game);return;}
    if(game.modal==="loadout"||game.modal==="intel"){
      const research=game.modal==="loadout",chapter=CHAPTERS[research?(game.libraryChapter??game.menuChapter):(game.intelChapter??game.menuChapter)];
      this.sheet(game,research?`${chapter.name} · 进化研究`:`${chapter.name} · 敌情档案`,()=>{game.modal=game.screen==="menu"?"level":null;});
      if(research)TOWER_ORDER.forEach((type,i)=>{
        const x=106+i*265,spec=TOWERS[type];this.box(x,187,251,446,"#dbcca5",COLORS.border,12);
        this.text(spec.name,x+125,215,25,spec.color,"bold","center");
        pathsFor(type,chapter.theme).forEach((p,b)=>{
          const y=277+b*170;ctx.save();ctx.translate(x+44,y+30);ctx.scale(.9,.9);this.tower({type,theme:chapter.theme,x:0,y:0,level:4,branch:b});ctx.restore();
          this.text(p.name,x+86,y+12,21,spec.color,"bold");
          const unlocked=game.branchUnlocked(type,chapter.theme,b);
          if(!unlocked)AtlasArt.chain({x:x+8,y:y+34,w:235,h:56});
          this.text(unlocked?"已解锁":`通关 ${evolutionRequirement(type,chapter.theme,b)} 关解锁`,x+125,y+108,18,COLORS.gold,"bold","center");
          (p.note.match(/.{1,12}/g)||[]).slice(0,2).forEach((line,n)=>this.text(line,x+17,y+135+n*21,16,COLORS.muted));
        });
      });
      else [...chapter.pool,chapter.boss].forEach((type,i)=>{
        const x=106+(i%3)*359,y=191+Math.floor(i/3)*214,spec=ENEMIES[type];this.box(x,y,340,196,"#dfcea5",COLORS.border,12);
        this.vehicle(type,x+48,y+49);this.text(spec.name,x+92,y+36,23,spec.color,"bold");this.text(`基础 HP ${Math.round(spec.hp*(spec.boss?CONFIG.bossHealthMultiplier:CONFIG.enemyHealthMultiplier))} · 速度 ${spec.speed}`,x+92,y+68,16,COLORS.muted);
        (spec.note.match(/.{1,16}/g)||[]).slice(0,2).forEach((line,n)=>this.text(line,x+18,y+112+n*25,18,COLORS.ink));
        this.text(spec.counter,x+18,y+172,16,COLORS.gold);
      });return;
    }
    if(game.modal==="battleMenu"){
      this.sheet(game,"战斗已暂停",()=>{game.modal=null;});
      [ ["继续战斗",()=>{game.modal=null;}],["重新挑战",()=>{game.modal="restart";}],["返回章节地图",()=>{game.modal="leave";}],["敌情档案",()=>{game.intelChapter=game.level.chapter;game.modal="intel";}] ].forEach(([label,action],i)=>this.button(game,{x:390,y:187+i*87,w:500,h:73},label,action,{primary:i===0,size:28}));this.audioButtons(game,496,552);return;
    }
    const fresh=game.modal==="newCampaign",restart=game.modal==="restart";
    this.box(268,190,744,340,"#eedfbb","#9a835a",22);
    this.text(fresh?"开启新的战役？":restart?"重新挑战本关？":"返回章节地图？",640,250,32,COLORS.ink,"bold","center");
    this.text(fresh?`只覆盖存档 ${game.pendingSlot+1}，其他存档保持不变。`:"本局部署不保留，已通关的成绩仍会保存。",640,320,23,COLORS.muted,"normal","center");
    this.button(game,{x:312,y:398,w:302,h:82},"取消",()=>{game.modal=fresh?"saveSlots":null;},{size:28});
    this.button(game,{x:642,y:398,w:326,h:82},fresh?"开始新战役":"确认",()=>{
      if(fresh)game.newCampaign(true);else if(restart)game.startLevel(game.levelIndex);else{game.screen="menu";game.modal=null;game.cancel();}
    },{primary:true,color:COLORS.gold,size:28});
  },
  result(game) {
    this.box(298,133,684,454,"#eedfbb",game.won?COLORS.mint:COLORS.red,24);
    this.text(game.won?"防线守住了！":"防线失守",640,211,42,game.won?COLORS.mint:COLORS.red,"bold","center");
    this.text("★".repeat(game.earnedStars)+"☆".repeat(3-game.earnedStars),640,287,62,COLORS.gold,"bold","center");
    this.text(game.saveFailed?"保存失败 · 请检查微信存储空间":game.won?"交通任务完成 · 战绩已保存":game.failureReason||"调整部署，再试一次",640,358,23,COLORS.muted,"normal","center");
    this.button(game,{x:345,y:435,w:285,h:85},"重新挑战",()=>game.startLevel(game.levelIndex),{size:28});
    this.button(game,{x:652,y:435,w:285,h:85},"章节地图",()=>{game.screen="menu";game.menuLevel=game.unlocked;game.menuChapter=LEVELS[game.menuLevel].chapter;},{primary:true,color:COLORS.gold,size:28});
  },
  touchPanel(game,title,height=352) {
    const rect={x:380,y:156,w:520,h:height};
    this.box(rect.x,rect.y,rect.w,rect.h,"#ecdcb4fa",COLORS.gold,14);
    game.buttons.push({...rect,action:()=>{}});
    this.text(title,rect.x+22,rect.y+35,24,COLORS.ink,"bold");
    this.button(game,{x:rect.x+442,y:rect.y+10,w:62,h:52},"关闭",()=>game.cancel(),{size:18});
    return rect;
  },
  buildPopup(game) {
    game.buildPopupRect=null;
    if(!game.selectedSite||game.screen!=="battle")return;
    const rect=this.touchPanel(game,`地块 ${game.selectedSite.id+1} · 建造炮台`,290);
    game.buildPopupRect=rect;
    game.loadout.forEach((type,i)=>{
      const spec=TOWERS[type],x=rect.x+16+i*125,y=rect.y+87,afford=game.gold>=spec.cost;
      this.button(game,{x,y,w:113,h:140},"",()=>game.selectBuild(type),{disabled:!afford,towerType:type});
      ctx.save();ctx.translate(x+56,y+54);ctx.scale(.9,.9);this.tower({type,theme:game.level.theme,x:0,y:0,level:1,branch:null});ctx.restore();
      this.text(spec.name,x+56,y+93,19,spec.color,"bold","center");this.text(`${spec.cost} G`,x+56,y+120,18,afford?COLORS.gold:COLORS.muted,"bold","center");
    });
    this.text("轻触炮台卡片建造 · 金币不足时按钮变暗",rect.x+260,rect.y+260,17,COLORS.muted,"normal","center");
  },
  towerPopup(game) {
    game.towerPopupRect=null;const t=game.selected;
    if(!t||game.screen!=="battle"||game.rallyTower)return;
    const rect=this.touchPanel(game,`${t.name} · L${t.level}`,392),x=rect.x,y=rect.y;
    game.towerPopupRect=rect;
    this.text(`伤害 ${Math.round(t.stats.damage)} · 射程 ${t.stats.range}`,x+22,y+87,19,COLORS.muted);
    if(t.level===2){
      t.paths.forEach((path,i)=>{
        const bx=x+16+i*252,unlocked=game.branchUnlocked(t.type,t.theme,i),afford=game.gold>=path.cost;
        this.button(game,{x:bx,y:y+116,w:236,h:167},"",()=>game.upgrade(i),{disabled:!unlocked||!afford,locked:!unlocked,branch:i});
        this.text(path.name,bx+118,y+146,23,t.spec.color,"bold","center");
        if(unlocked){
          this.text(`${path.cost} G`,bx+118,y+180,21,COLORS.gold,"bold","center");
          (path.note.match(/.{1,12}/g)||[]).slice(0,3).forEach((line,j)=>this.text(line,bx+118,y+216+j*23,16,COLORS.muted,"normal","center"));
        }else{
          AtlasArt.chain({x:bx+8,y:y+162,w:220,h:61});
          this.text(`通关 ${evolutionRequirement(t.type,t.theme,i)} 关解锁`,bx+118,y+246,19,COLORS.ink,"bold","center");
          this.text(`当前已通关 ${game.completed} 关`,bx+118,y+270,16,COLORS.muted,"normal","center");
        }
      });
    }else{
      const max=t.level===4;
      this.button(game,{x:x+16,y:y+129,w:488,h:78},max?"已达最高等级":`强化 → L${t.level+1} · ${t.upgradeCost} G`,()=>game.upgrade(),{primary:!max,disabled:max||game.gold<t.upgradeCost,size:25});
      const note=t.branch===null?"强化到二级后选择进化方向":t.paths[t.branch].note;
      this.text(note,x+260,y+246,19,COLORS.gold,"normal","center");
    }
    this.button(game,{x:x+16,y:y+310,w:236,h:62},t.type==="depot"?"设置集合点":TARGET_MODES[t.targetMode],()=>{
      if(t.type==="depot"){game.rallyTower=t;game.notify("轻触射程内道路，调动队员。");}else t.targetMode=(t.targetMode+1)%3;
    },{size:20});
    this.button(game,{x:x+268,y:y+310,w:236,h:62},`出售 +${t.sellValue} G`,()=>game.sell(),{color:COLORS.gold,size:20});
  }
});

"use strict";

// 屏幕 UI 与固定战场坐标分离。设备尺寸变化只影响相机，不改道路、射程或存档。
const MobileLayout = {
  measure() {
    const {width:w,height:h,safe,capsule}=Platform.layout;
    const left=safe.left+18,right=safe.right-18,top=safe.top+12,bottom=safe.bottom-10;
    const headerRight=capsule&&capsule.y<top+80?Math.min(right,capsule.x-14):right;
    return {w,h,left,right,top,bottom,headerRight,footer:bottom-94,
      content:{x:left,y:Math.max(top,capsule?capsule.y+capsule.h+10:top),w:right-left,h:0}};
  },
  camera(game,l) {
    const rect={x:l.left,y:l.top+90,w:l.right-l.left,h:l.footer-l.top-104};
    const scale=Math.min(rect.w/MAP.w,rect.h/MAP.h);
    const camera={rect,scale,x:rect.x+(rect.w-MAP.w*scale)/2-MAP.x*scale,y:rect.y+(rect.h-MAP.h*scale)/2-MAP.y*scale};
    game.mobileCamera=camera;return camera;
  },
  toWorld(game,p) {
    const c=game.mobileCamera;
    return c?{x:(p.x-c.x)/c.scale,y:(p.y-c.y)/c.scale}:p;
  },
  toScreen(game,p) {
    const c=game.mobileCamera;
    return c?{x:p.x*c.scale+c.x,y:p.y*c.scale+c.y}:p;
  },
  frame(game,source,target,draw,maxScale=1.25) {
    const scale=Math.min(maxScale,target.w/source.w,target.h/source.h);
    const x=target.x+(target.w-source.w*scale)/2-source.x*scale,y=target.y+(target.h-source.h*scale)/2-source.y*scale;
    const first=game.buttons.length,pointer=game.uiPointer;
    if(pointer)game.uiPointer={x:(pointer.x-x)/scale,y:(pointer.y-y)/scale};
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);draw();ctx.restore();game.uiPointer=pointer;
    for(let i=first;i<game.buttons.length;i++){
      const b=game.buttons[i];b.x=b.x*scale+x;b.y=b.y*scale+y;b.w*=scale;b.h*=scale;
    }
    return {x,y,scale};
  },
  popup(game,l,kind) {
    const build=kind==="build",key=build?"buildPopupRect":"towerPopupRect";
    const target={x:l.left,y:l.top+95,w:l.right-l.left,h:l.footer-l.top-105};
    const transform=this.frame(game,{x:380,y:156,w:520,h:build?290:392},target,()=>Renderer[build?"buildPopup":"towerPopup"](game),1.25);
    const r=game[key];
    if(r){
      const p=this.toWorld(game,{x:r.x*transform.scale+transform.x,y:r.y*transform.scale+transform.y});
      game[key]={...p,w:r.w*transform.scale/game.mobileCamera.scale,h:r.h*transform.scale/game.mobileCamera.scale};
    }
  }
};
Platform.worldPoint=(game,p)=>MobileLayout.toWorld(game,p);
Platform.handleTap=(game,p)=>{
  const button=[...game.buttons].reverse().find(b=>Collision.inside(p,b));
  if(button){if(!button.disabled)button.action();return;}
  if(game.modal||game.screen!=="battle"||!game.mobileCamera)return;
  game.click(MobileLayout.toWorld(game,p),true);
};

Object.assign(Renderer,{
  home(game,l) {
    const split=l.left+(l.right-l.left)*.57,cy=(l.top+l.bottom)/2;
    AtlasArt.scenery({x:0,y:0,w:l.w,h:l.h},"city",3,p=>
      p.x>split-20&&p.y>cy-270&&p.y<cy+270||p.x<split&&p.y>cy-235&&p.y<cy-25);
    const road=[[0,cy+167],[l.left+160,cy+167],[split-170,cy-26],[split+15,cy-26],[split+150,cy-170],[l.w,cy-170]];
    this.line(road,"#776346",67);this.line(road,"#b1a781",57);this.line(road,"#e9d7a5",3,[14,14]);
    this.text("路网守卫",l.left+42,cy-164,68,"#4e503a","bold");
    this.text("公路远征 · 六境交通图册",l.left+46,cy-105,25,"#786343");
    this.text("ROAD GUARD  /  FIELD ATLAS",l.left+48,cy-65,16,"#8b7952","bold");
    ["rail","signal","missile","depot"].forEach((type,i)=>{
      ctx.save();ctx.translate(l.left+82+i*(split-l.left-125)/4,cy+95+(i%2)*25);ctx.scale(1.55,1.55);
      this.tower({type,theme:"city",x:0,y:0,level:3,branch:i%2,angle:-.7});ctx.restore();
    });
    const x=split+16,w=l.right-x-24,y=cy-224;
    this.box(x,y,w,450,"#ece0bce8","#927951",17);
    this.text("下一站，由你守护",x+w/2,y+50,29,COLORS.ink,"bold","center");
    [["开始游戏",()=>game.newCampaign()],["读取存档",()=>game.loadCampaign()],["退出游戏",()=>Platform.exitGame(()=>game.notify("请使用微信右上角菜单退出小游戏。"))]].forEach(([label,action],i)=>
      this.button(game,{x:x+26,y:y+98+i*98,w:w-52,h:81},label,action,{primary:i===0,size:30}));
    this.text(`本地存档 ${Progress.list().filter(Boolean).length} / 3 · 通关自动保存`,x+w/2,y+412,19,COLORS.muted,"normal","center");
    this.audioButtons(game,l.left,l.bottom-62);
    this.text(game.messageTime>0?game.message:`${CONFIG.version} · 通关自动保存`,l.right,l.bottom-28,19,COLORS.ink,"normal","right");
    AtlasArt.compass(split-85,cy-220);
  },
  menu(game,l) {
    const chapter=CHAPTERS[game.menuChapter],first=game.menuChapter*8;
    const map={x:l.left+65,y:l.top+116,w:l.right-l.left-130,h:l.footer-l.top-193};
    const nodes=chapter.nodes.map(([x,y])=>({x:map.x+(x-100)/700*map.w,y:map.y+(y-185)/445*map.h}));
    AtlasArt.scenery({x:0,y:0,w:l.w,h:l.h},chapter.theme,game.menuChapter,p=>nodes.some(n=>Math.abs(n.x-p.x)<120&&p.y>n.y-100&&p.y<n.y+115));
    const trail=nodes.map(p=>[p.x,p.y]);
    this.line(trail,"#f6e7be",12);this.line(trail,"#927754",3,[6,9]);
    nodes.forEach((p,offset)=>{
      const index=first+offset,level=LEVELS[index],locked=index>game.unlocked;
      AtlasArt.roadSign(p.x,p.y,locked?"·":`${game.menuChapter+1}-${offset+1}`,{locked,boss:level.boss,stars:game.progress.stars[index],active:index===game.unlocked});
      this.box(p.x-84,p.y+44,168,29,"#eadbb4d9",null,5);
      this.text(level.name,p.x,p.y+59,20,"#635138","bold","center");
      game.buttons.push({x:p.x-85,y:p.y-51,w:170,h:125,levelIndex:index,action:()=>game.openLevel(index)});
    });
    this.box(0,0,l.w,l.top+88,"#e6d6aecf",null,0);
    this.button(game,{x:l.left,y:l.top,w:142,h:68},"‹ 首页",()=>{game.screen="home";game.modal=null;},{size:25});
    const middle=(l.left+l.headerRight)/2;
    this.text(`${chapter.name}`,middle,l.top+27,35,COLORS.ink,"bold","center");
    this.text(`第 ${game.menuChapter+1} 章  /  ${chapter.city.split(" / ")[1]}`,middle,l.top+64,15,COLORS.muted,"bold","center");
    this.text(`★ ${game.progress.stars.slice(first,first+8).reduce((a,b)=>a+b,0)} / 24`,l.headerRight,l.top+35,25,"#946327","bold","right");
    this.box(0,l.footer,l.w,l.h-l.footer,"#e3d0a9d9",null,0);
    this.line([[0,l.footer],[l.w,l.footer]],"#a58b60",2);
    this.button(game,{x:l.left,y:l.footer+16,w:187,h:70},"‹ 上一章",()=>game.selectChapter(game.menuChapter-1),{disabled:game.menuChapter===0,size:24});
    this.button(game,{x:l.right-187,y:l.footer+16,w:187,h:70},"下一章 ›",()=>game.selectChapter(game.menuChapter+1),{disabled:game.menuChapter===5,size:24});
    this.text(game.saveFailed?"存档未能保存，请检查存储空间":"轻触公路路牌 · 查看作战简报",l.w/2,l.footer+35,22,game.saveFailed?COLORS.red:COLORS.ink,"bold","center");
    CHAPTERS.forEach((_,i)=>this.circle(l.w/2-75+i*30,l.footer+73,6,i===game.menuChapter?"#b35f43":"#b5a27b"));
    AtlasArt.compass(l.right-64,l.footer-79);
  },
  header(game,l) {
    this.box(0,0,l.w,l.top+84,"#eadbb5ed",null,0);this.line([[0,l.top+84],[l.w,l.top+84]],"#a78e61",2);
    this.text(`♥ ${game.lives}`,l.left+2,l.top+27,30,COLORS.red,"bold");
    this.text(`${game.gold} G`,l.left+143,l.top+27,30,"#92632d","bold");
    this.text(`${game.wave} / ${game.level.waves} 波`,l.left+303,l.top+27,27,COLORS.mint,"bold");
    this.text(`${stageLabel(game.levelIndex)} · ${Traffic.status(game)}`,l.left+3,l.top+64,19,COLORS.muted);
    const x=l.headerRight-364;
    this.button(game,{x,y:l.top,w:90,h:68},`×${game.speed}`,()=>{game.speed=game.speed%3+1;},{size:25});
    this.button(game,{x:x+102,y:l.top,w:110,h:68},game.paused?"继续":"暂停",()=>{game.paused=!game.paused;},{active:game.paused,size:25});
    this.button(game,{x:x+224,y:l.top,w:140,h:68},"战斗菜单",()=>{game.modal="battleMenu";},{size:23});
  },
  toolbar(game,l) {
    this.box(0,l.footer,l.w,l.h-l.footer,"#e6d5aeed",null,0);this.line([[0,l.footer],[l.w,l.footer]],"#9f865c",2);
    Object.entries(SKILLS).forEach(([type,spec],i)=>{
      const remaining=game.skillCooldowns[type];
      this.button(game,{x:l.left+i*192,y:l.footer+15,w:180,h:72},remaining>0?`${spec.name} ${Math.ceil(remaining)}s`:spec.name,()=>game.selectSkill(type),{active:game.skill===type,disabled:remaining>0,size:23});
    });
    this.button(game,{x:l.left+389,y:l.footer+15,w:117,h:72},"取消",()=>game.cancel(),{size:24});
    const wave={x:l.right-384,y:l.footer+5,w:384,h:85};
    this.trafficControls(game,{x:l.left+518,y:l.footer+15,w:wave.x-l.left-530,h:72});
    MobileLayout.frame(game,{x:872,y:623,w:384,h:85},wave,()=>this.waveButton(game),1);
  },
  draw(game) {
    const l=MobileLayout.measure();l.content.h=l.bottom-l.content.y;
    game.buttons=[];ctx.clearRect(0,0,l.w,l.h);
    if(game.screen==="home")this.home(game,l);
    else if(game.screen==="menu")this.menu(game,l);
    else{
      const c=MobileLayout.camera(game,l),chapter=CHAPTERS[game.level.chapter];
      AtlasArt.scenery({x:0,y:0,w:l.w,h:l.h},chapter.theme,game.level.stage,p=>{
        const world=MobileLayout.toWorld(game,p);return game.buildRoad.isRoad(world,65)||game.sites.some(site=>Collision.distance(site,world)<65);
      });
      ctx.save();ctx.translate(c.x,c.y);ctx.scale(c.scale,c.scale);this.field(game);ctx.restore();
      this.header(game,l);this.toolbar(game,l);
      MobileLayout.popup(game,l,"build");MobileLayout.popup(game,l,"tower");
      if(game.screen==="result"){
        game.buttons=[];this.box(0,0,l.w,l.h,"#453c2e99",null,0);
        MobileLayout.frame(game,{x:268,y:110,w:744,h:510},l.content,()=>this.result(game));
      }
    }
    if(game.modal){
      game.buttons=[];this.box(0,0,l.w,l.h,"#453c2e99",null,0);
      MobileLayout.frame(game,{x:70,y:72,w:1140,h:598},l.content,()=>this.modal(game),1.2);
    }
  }
});

Platform.initialize(CONFIG,ctx);
const game=new Game();
module.exports={game};
