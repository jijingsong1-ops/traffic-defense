"use strict";

// 所有面板、瞄准圈和施放逻辑读取同一份数值。伤害的章节增量也在这里定义。
const SKILLS = {
  strike: {name:"轨道空袭",color:"#b77a43",cooldown:30,radius:88,damage:145,chapterDamage:55,stageDamage:14,damageType:"true",
    note:"瞬间真实群伤，无视护甲与魔抗；护盾仍会吸收伤害。",counter:"装甲重车、破拆车；用来补最后一击。",
    branches:[{name:"重击",note:"更高单次伤害，覆盖范围缩小",damageScale:1.6,radius:74},{name:"连爆",note:"扩大清场范围，缩短冷却",damageScale:1.05,radius:130,cooldown:25}]},
  freeze: {name:"紧急封路",color:"#4c859d",cooldown:36,radius:105,stun:3,
    note:"区域冻结，抗控缩短时间；免控车不受影响。",counter:"劫掠车、破拆车；为火力争取时间。",
    branches:[{name:"冰封",note:"更长冻结，适合拦截重车",stun:5},{name:"缓行",note:"冻结并附加减速，适合高速车",stun:2,slow:.35,duration:8,radius:130,cooldown:30}]},
  emp: {name:"电磁静默",color:"#81649e",cooldown:32,radius:112,damage:80,chapterDamage:24,stageDamage:6,damageType:"magic",silence:5,jam:5,shieldMultiplier:3,
    note:"魔法群伤；静默期间停止治疗、解控和封塔，并抑制回盾。",counter:"维修、解控、干扰车与护盾；不适合高魔抗。",
    branches:[{name:"强脉冲",note:"提高伤害与破盾倍率",damageScale:1.7,shieldMultiplier:5},{name:"长静默",note:"更长静默，扩大覆盖",silence:8,jam:8,radius:145}]},
  fire: {name:"热障喷洒",color:"#b95c39",cooldown:34,radius:96,burn:24,chapterBurn:7,duration:6,damageType:"magic",
    note:"区域内持续施加灼烧，烧伤不能叠层；驶离后仍烧2秒。",counter:"集群、母车与低魔抗车；抗火车辆效果差。",
    branches:[{name:"烈焰",note:"持续灼烧更强",burnScale:1.65},{name:"黏胶",note:"兼顾减速，区域保持更久",burnScale:1.05,slow:.5,duration:9}]},
  repair: {name:"抢修补给",color:"#538471",cooldown:40,radius:150,heal:32,duration:6,
    note:"范围内修复队员、公交和桥梁，并解除及免疫塔封锁。",counter:"公交伏击、桥梁破拆和干扰车；不复活阵亡队员。",
    branches:[{name:"急修",note:"提高即时修复量",heal:58},{name:"屏障",note:"更长免封锁保护，扩大范围",heal:36,duration:12,radius:185}]},
  overdrive: {name:"信号超频",color:"#aa803c",cooldown:38,radius:150,haste:.35,duration:7,
    note:"范围内塔及其队员提高攻速；多次超频取较强效果。",counter:"让已有火力处理首领；不能解除封塔。",
    branches:[{name:"极速",note:"短时间大幅提速",haste:.7,duration:6},{name:"续航",note:"持续更久，覆盖更广",haste:.4,duration:13,radius:180}]}
};
const SKILL_ORDER=Object.keys(SKILLS);
const SKILL_UPGRADE_COSTS={2:3,3:5,4:8};
const SkillBook={
  blank() {return {loadout:["strike","freeze"],upgrades:Object.fromEntries(SKILL_ORDER.map(key=>[key,{level:1,branch:null}]))};},
  spent(research) {return SKILL_ORDER.reduce((sum,key)=>sum+[2,3,4].filter(n=>n<=research.upgrades[key].level).reduce((cost,n)=>cost+SKILL_UPGRADE_COSTS[n],0),0);},
  earned(progress) {return progress.stars.reduce((a,b)=>a+b,0);},
  available(progress) {return this.earned(progress)-this.spent(progress.skills);},
  clean(raw,stars) {
    const result=this.blank();let budget=stars.reduce((a,b)=>a+b,0);
    // 存档修复按固定顺序校验预算；历史星级不会因升级被扣掉，也不能反复刷同一关获星。
    for(const key of SKILL_ORDER){
      const saved=raw?.upgrades?.[key],wanted=Number.isInteger(saved?.level)?Math.min(4,Math.max(1,saved.level)):1;
      for(let level=2;level<=wanted;level++){
        if(level>=3&&![0,1].includes(saved.branch)||budget<SKILL_UPGRADE_COSTS[level])break;
        budget-=SKILL_UPGRADE_COSTS[level];result.upgrades[key]={level,branch:level>=3?saved.branch:null};
      }
    }
    const chosen=[...new Set(Array.isArray(raw?.loadout)?raw.loadout.filter(k=>SKILL_ORDER.includes(k)):[])].slice(0,2);
    for(const key of ["strike","freeze"])if(chosen.length<2&&!chosen.includes(key))chosen.push(key);
    result.loadout=chosen;return result;
  },
  stats(research,type,level={chapter:0,stage:1}) {
    const base=SKILLS[type],upgrade=research.upgrades[type],rank=upgrade.level;
    const spec={...base,level:rank,branch:upgrade.branch,damage:(base.damage||0)+(base.chapterDamage||0)*level.chapter+(base.stageDamage||0)*(level.stage-1)};
    if(base.burn)spec.burn=base.burn+(base.chapterBurn||0)*level.chapter;
    if(rank>=2){spec.damage*=1.15;if(spec.burn)spec.burn*=1.15;if(spec.heal)spec.heal+=6;spec.radius+=8;}
    if(rank>=3){
      const evolution=base.branches[upgrade.branch];Object.assign(spec,evolution);
      spec.name=`${base.name} · ${evolution.name}`;spec.damage*=evolution.damageScale||1;
      if(spec.burn)spec.burn*=evolution.burnScale||1;
    }
    if(rank===4){spec.damage*=1.2;if(spec.burn)spec.burn*=1.2;if(spec.heal)spec.heal+=10;spec.cooldown-=4;}
    spec.damage=Math.round(spec.damage);if(spec.burn)spec.burn=Math.round(spec.burn);
    return spec;
  }
};
