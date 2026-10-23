"use strict";

const ENEMIES = {
  raider: { name:"劫掠车", hp:95, speed:63, reward:16, leak:1, armor:.15, visual:"runner", color:"#d98753", busDamage:5,
    note:"站点预警后出现，靠近公交会停车袭击。", counter:"守住接人站，及时开启护航或冻结" },
  demolisher: { name:"破拆车", hp:185, speed:48, reward:30, leak:3, armor:.25, visual:"armor", color:"#d99559", bridgeDamage:4,
    note:"驶上桥面后停车破拆7秒，每秒损伤4点结构。", counter:"桥前集火；冻结或队员拦截可中断破拆" },
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

// 魔抗仅减免魔法伤害；护甲仅减免物理伤害。与护盾、抗火、抗控分开结算。
for(const [key,resist] of Object.entries({shield:.2,mirage:.45,barge:.35,tender:.25,grove:.3,ancient:.25,sandBoss:.2,admiral:.3}))ENEMIES[key].magicResist=resist;
Object.assign(ENEMIES,{
  insulated:{name:"绝缘货车",hp:145,speed:45,reward:27,leak:2,armor:.05,magicResist:.65,color:"#bb9f65",visual:"shield",note:"高魔抗，物理防护薄弱。"},
  relay:{name:"解控指挥车",hp:120,speed:42,reward:30,leak:2,armor:.1,magicResist:.15,cleanse:7,abilityRadius:100,color:"#729883",visual:"healer",note:"每7秒解除附近友军减速与冻结，随后短暂免控。"},
  jammer:{name:"干扰车",hp:125,speed:40,reward:32,leak:2,armor:.1,magicResist:.3,towerJam:8,abilityRadius:115,jamDuration:2.4,color:"#927cac",visual:"healer",note:"预警后封锁附近一座塔2.4秒，间隔8秒。"},
  bulldozer:{name:"破障推土车",hp:195,speed:39,reward:31,leak:3,armor:.3,magicResist:.1,controlImmune:true,color:"#c99b62",visual:"armor",note:"免疫减速与冻结，仍可被勤务队员拦截。"}
});
const CHAPTER_THREATS=[['insulated','jammer'],['relay','insulated'],['insulated','bulldozer'],['bulldozer','jammer'],['jammer','relay'],['relay','bulldozer']];
