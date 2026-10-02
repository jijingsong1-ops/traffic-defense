"use strict";

const TOWERS = {
  rail: {
    name: "路卫塔", cost: 80, damage: 22, range: 125, cooldown: .58,
    damageType:"physical", growth:1.45, focus: true, focusGain: .08, color: "#7de0cb", glyph: "磁",
    note: "测速锁定 / 动能拦截"
  },
  signal: {
    name: "信号站", cost: 125, damage: 18, range: 108, cooldown: 1.3,
    damageType:"magic", growth:1.35, slow: .75, duration: 1.4, color: "#8fc8fa", glyph: "讯",
    note: "红灯脉冲 / 干扰制动"
  },
  missile: {
    name: "清障台", cost: 145, damage: 58, range: 132, cooldown: 1.9,
    damageType:"physical", growth:1.55, splash: 58, slow: .85, duration: .7, color: "#f5bb79", glyph: "锚", note: "抛射制动锚 / 区域清障"
  },
  depot: {
    name: "勤务站", cost: 110, damage: 13, range: 125, cooldown: .8,
    damageType:"physical", growth:1.3, soldierCount: 3, soldierHealth: 105, soldierArmor: .12, respawn: 8, rallyRange: 125,
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
// 四级的伤害/攻速成长由分支分别决定；进化机制与二级基础成长分离。
const FINAL_GROWTH={rail:[{damage:1.5,rate:1},{damage:1.15,rate:.8}],signal:[{damage:1.25,rate:.92},{damage:1.4,rate:.94}],missile:[{damage:1.55,rate:1.05},{damage:1.2,rate:.88}],depot:[{damage:1.15,rate:.95},{damage:1.35,rate:.85}]};
for(const [theme,types] of Object.entries(EVOLUTIONS))for(const type of Object.keys(types))types[type].forEach((path,branch)=>{
  path.finalDamage=FINAL_GROWTH[type][branch].damage;path.finalRate=FINAL_GROWTH[type][branch].rate;
  if(type==="rail"&&branch===0&&!path.multi){path.lineHits=3;path.note+=" · 贯穿3车";}
  if((type==="rail"||type==="depot")&&branch===1){path.healBlock=3;path.note+=" · 禁疗3秒";}
  if(type==="signal"&&branch===1){path.silence=1.2;path.note+=" · 短暂静默";}
});
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
