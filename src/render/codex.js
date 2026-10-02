"use strict";

// 同一份 Tower.stats / SkillBook.stats 驱动图鉴和战斗，不维护另一套展示数值。
const CodexView={modal:Renderer.modal,fieldWorld:Renderer.fieldWorld};
Object.assign(Renderer,{
  bookWrap(text,max=40) {return String(text).match(new RegExp(`.{1,${max}}`,"gu"))||[""];},
  bookDetails(game,rows,y=459,count=6) {
    const state=game.codex,lines=rows.flatMap(row=>this.bookWrap(row)),pages=Math.max(1,Math.ceil(lines.length/count));
    state.detailPage=Math.min(state.detailPage,pages-1);
    lines.slice(state.detailPage*count,(state.detailPage+1)*count).forEach((line,i)=>this.text(line,357,y+i*22,18,i===0?COLORS.ink:COLORS.muted));
    if(pages>1){
      this.button(game,{x:902,y:608,w:80,h:35},"‹ 说明",()=>state.detailPage--,{disabled:state.detailPage===0,size:16});
      this.text(`${state.detailPage+1}/${pages}`,1022,625,17,COLORS.muted,"normal","center");
      this.button(game,{x:1062,y:608,w:96,h:35},"说明 ›",()=>state.detailPage++,{disabled:state.detailPage===pages-1,size:16});
    }
  },
  codexModal(game) {
    const s=game.codex,chapter=CHAPTERS[s.chapter],editable=game.screen==="menu";
    this.sheet(game,"交通作战图鉴",()=>{game.modal=game.codexReturn;});
    this.text(`可用 ★ ${SkillBook.available(game.progress)} / 累计 ${SkillBook.earned(game.progress)}`,770,124,22,COLORS.gold,"bold");
    [["towers","防御塔"],["enemies","怪物图鉴"],["skills","技能研究"],["mechanics","机制说明"]].forEach(([tab,label],i)=>this.button(game,{x:104+i*158,y:177,w:146,h:43},label,()=>{s.tab=tab;s.detailPage=0;s.page=0;s.context=null;},{active:s.tab===tab,size:22}));
    this.button(game,{x:754,y:177,w:50,h:43},"‹",()=>{s.chapter--;s.enemy=null;s.page=0;s.detailPage=0;},{disabled:s.chapter===0,size:23});
    this.text(chapter.name,975,200,24,COLORS.ink,"bold","center");
    this.button(game,{x:1124,y:177,w:50,h:43},"›",()=>{s.chapter++;s.enemy=null;s.page=0;s.detailPage=0;},{disabled:s.chapter===5,size:23});
    this.box(337,234,837,370,"#f3e6c5",COLORS.border,10);
    if(s.tab==="towers")this.codexTowers(game);
    else if(s.tab==="enemies")this.codexEnemies(game);
    else if(s.tab==="skills")this.codexSkills(game);
    else this.codexMechanics(game);
    this.text(game.saveFailed?"保存失败 · 本次选择暂留内存":editable?"关卡最高星级累计 · 研究与装备按当前存档保存":"战斗中仅供查阅 · 返回章节地图后可升级和更换技能",106,655,17,game.saveFailed?COLORS.red:COLORS.muted);
  },
  codexTowers(game) {
    const s=game.codex,theme=CHAPTERS[s.chapter].theme;
    TOWER_ORDER.forEach((type,i)=>{
      this.button(game,{x:104,y:234+i*75,w:213,h:64},TOWERS[type].name,()=>{s.type=type;s.detailPage=0;},{active:s.type===type,size:25});
    });
    this.text("物理 → 护甲",117,557,19,"#90633c","bold");this.text("魔法 → 魔抗",117,586,19,"#686180","bold");
    const paths=pathsFor(s.type,theme),tower=new Tower(s.type,0,0,theme);tower.level=s.rank;tower.branch=s.rank>=3?s.branch:null;
    paths.forEach((p,i)=>this.button(game,{x:539+i*310,y:246,w:295,h:43},p.name,()=>{s.branch=i;s.detailPage=0;},{active:s.branch===i,size:23}));
    ctx.save();ctx.translate(396,324);ctx.scale(1.1,1.1);this.tower(tower);ctx.restore();
    this.text(`${tower.name} · L${s.rank}`,455,315,27,COLORS.ink,"bold");
    const unlocked=game.branchUnlocked(s.type,theme,s.branch),stats=tower.stats;
    this.text(s.rank<3?`基础设施 ${tower.spec.cost}G`:`${unlocked?"进化已解锁":"预览 · 通关"+evolutionRequirement(s.type,theme,s.branch)+"关解锁"} · 进化 ${paths[s.branch].cost}G`,455,344,18,COLORS.gold);
    [1,2,3,4].forEach((rank,i)=>{
      const preview=new Tower(s.type,0,0,theme);preview.level=rank;preview.branch=rank>=3?s.branch:null;const p=preview.stats,x=351+i*203;
      this.button(game,{x,y:364,w:194,h:74},"",()=>{s.rank=rank;s.detailPage=0;},{active:s.rank===rank});
      this.text(`L${rank}`,x+18,381,18,COLORS.ink,"bold");
      this.text(`物 ${p.damageType==="physical"?p.damage.toFixed(1):0} / 法 ${p.damageType==="magic"?p.damage.toFixed(1):0}`,x+97,405,17,COLORS.ink,"normal","center");
      this.text(`${(1/p.cooldown).toFixed(2)}次/秒`,x+97,427,16,COLORS.muted,"normal","center");
    });
    this.text(`射程 ${stats.range} · ${s.type==="depot"?`${stats.soldierCount}名队员，攻击按单人计算`:"攻击力不含锁定增伤"}`,357,472,21,COLORS.ink);
    const traits=CombatRules.towerMechanics(stats,s.type);
    this.text(traits.map(row=>row.split(/[：:]/)[0].slice(0,8)).slice(0,4).join(" · "),357,506,18,COLORS.gold);
    this.text({rail:"单体主力 · 适合物理集火",signal:"魔法控场 · 应对装甲车组",missile:"物理群伤 · 清理并排车队",depot:"驻路拦截 · 配合远程火力"}[s.type],357,540,21,COLORS.muted);
    this.button(game,{x:912,y:609,w:245,h:35},"机制详情 ›",()=>{s.context={title:tower.name,rows:[...traits,...(s.type==="depot"?[`队员生命 ${Math.round(stats.soldierHealth)} / 护甲 ${Math.round(stats.soldierArmor*100)}%`]:[])]};s.tab="mechanics";s.detailPage=0;},{size:20});
  },
  codexEnemies(game) {
    const s=game.codex,chapter=CHAPTERS[s.chapter];
    const main=[...chapter.pool,chapter.boss,...CHAPTER_THREATS[s.chapter],...LEVELS.filter(l=>l.chapter===s.chapter).flatMap(l=>Object.keys(Encounters.roster(l).counts)),"raider","demolisher"];
    const keys=[...new Set([...main,...main.filter(k=>ENEMIES[k].split).map(k=>ENEMIES[k].splitType||"swarm")])],pages=Math.ceil(keys.length/6);
    s.page=Math.min(s.page,pages-1);if(!keys.includes(s.enemy))s.enemy=keys[s.page*6];
    keys.slice(s.page*6,s.page*6+6).forEach((key,i)=>this.button(game,{x:104,y:234+i*53,w:213,h:44},ENEMIES[key].name,()=>{s.enemy=key;s.detailPage=0;},{active:s.enemy===key,size:20}));
    this.button(game,{x:104,y:561,w:67,h:40},"‹",()=>{s.page--;s.enemy=keys[s.page*6];s.detailPage=0;},{disabled:s.page===0});
    this.text(`${s.page+1}/${pages}`,210,581,19,COLORS.muted,"normal","center");
    this.button(game,{x:250,y:561,w:67,h:40},"›",()=>{s.page++;s.enemy=keys[s.page*6];s.detailPage=0;},{disabled:s.page===pages-1});
    const spec=ENEMIES[s.enemy],level=game.screen==="battle"&&game.level.chapter===s.chapter?game.level:LEVELS[s.chapter*8];
    ctx.save();ctx.translate(394,282);ctx.scale(1.8,1.8);this.vehicle(s.enemy,0,0);ctx.restore();
    this.text(spec.name,460,270,29,COLORS.ink,"bold");
    this.text(`护甲 ${Math.round((spec.armor||0)*100)}%    魔抗 ${Math.round((spec.magicResist||0)*100)}%    速度 ${spec.speed}`,460,307,22,COLORS.ink);
    const health=spec.hp*(spec.boss?CONFIG.bossHealthMultiplier:CONFIG.enemyHealthMultiplier);
    this.text(`基础生命 ${Math.round(health)} · ${stageLabel(LEVELS.indexOf(level))}首波参考 ${Math.round(health*level.scale)}`,357,351,21,COLORS.gold,"bold");
    this.text(`实际生命 = 基础 × 关卡倍率 × ${CONFIG.enemyGrowth}^(波次−1)；护甲/魔抗为减伤比例`,357,382,17,COLORS.muted);
    const traits=CombatRules.enemyMechanics(spec),counters=CombatRules.counters(spec,chapter.theme);
    this.text(traits.slice(0,-1).slice(0,4).map(row=>row.split(/[：:]/)[0].slice(0,8)).join(" · ")||"常规车流",357,424,20,COLORS.gold,"bold");
    this.text("推荐搭配",357,466,21,COLORS.ink,"bold");
    counters.slice(0,2).flatMap(row=>this.bookWrap(row,36)).slice(0,3).forEach((line,i)=>this.text(line,357,499+i*23,19,COLORS.muted));
    this.button(game,{x:912,y:609,w:245,h:35},"机制详情 ›",()=>{s.context={title:spec.name,rows:[...traits,"克制建议：",...counters]};s.tab="mechanics";s.detailPage=0;},{size:20});
  },
  codexMechanics(game) {
    const s=game.codex,pages=Math.ceil(MECHANICS.length/7);s.page=Math.min(s.page,pages-1);
    MECHANICS.slice(s.page*7,s.page*7+7).forEach(([name],i)=>this.button(game,{x:104,y:234+i*45,w:213,h:38},name,()=>{s.mechanism=s.page*7+i;s.context=null;s.detailPage=0;},{active:!s.context&&s.mechanism===s.page*7+i,size:19}));
    this.button(game,{x:104,y:566,w:65,h:39},"‹",()=>{s.page--;},{disabled:s.page===0});
    this.text(`${s.page+1}/${pages}`,210,587,18,COLORS.muted,"normal","center");
    this.button(game,{x:251,y:566,w:65,h:39},"›",()=>{s.page++;},{disabled:s.page===pages-1});
    const topic=MECHANICS[s.mechanism||0];
    this.text(s.context?`${s.context.title} · 机制详情`:topic[0],357,279,29,COLORS.ink,"bold");
    if(s.context)this.bookDetails(game,s.context.rows,322,12);
    else {
      this.bookWrap(topic[1],29).forEach((line,i)=>this.text(line,357,343+i*36,24,COLORS.ink));
      this.text("搭配建议",357,492,23,COLORS.gold,"bold");
      this.bookWrap(topic[2],34).forEach((line,i)=>this.text(line,357,533+i*28,21,COLORS.muted));
    }
  },
  skillMechanics(type,spec,next=spec) {
    const rows=[SKILLS[type].note];
    const change=(a,b)=>a===b?`${a}`:`${a}→${b}`;
    if(spec.stun)rows.push(`冻结 ${change(spec.stun,next.stun)}秒`);
    if(spec.silence)rows.push(`静默/禁回盾 ${change(spec.silence,next.silence)}秒 · 破盾 ${change(spec.shieldMultiplier,next.shieldMultiplier)}倍`);
    if(spec.burn)rows.push(`每秒烧伤 ${change(spec.burn,next.burn)}魔法 · 区域持续 ${change(spec.duration,next.duration)}秒`);
    if(spec.slow||next.slow){
      const amount=change(Math.round((1-(spec.slow||1))*100),Math.round((1-(next.slow||1))*100));
      rows.push(type==="fire"?`区域内减速 ${amount}%；离区最多保持2秒`:`减速 ${amount}% / ${change(spec.slow?spec.duration:0,next.duration)}秒（含冻结时间）`);
    }
    if(spec.heal)rows.push(`修复：民车/桥 ${change(spec.heal,next.heal)}，队员 ${change(spec.heal*3,next.heal*3)}；免封塔 ${change(spec.duration,next.duration)}秒`);
    if(spec.haste)rows.push(`攻速 +${change(Math.round(spec.haste*100),Math.round(next.haste*100))}% · 持续 ${change(spec.duration,next.duration)}秒，伤害不变`);
    rows.push(SKILLS[type].counter);return rows;
  },
  codexSkills(game) {
    const s=game.codex,editable=game.screen==="menu",research=game.progress.skills,owned=research.upgrades[s.skill];
    SKILL_ORDER.forEach((key,i)=>this.button(game,{x:104,y:234+i*53,w:213,h:44},`${SKILLS[key].name} L${research.upgrades[key].level}`,()=>{s.skill=key;s.branch=research.upgrades[key].branch??0;s.previewRank=null;},{active:s.skill===key,size:20}));
    this.button(game,{x:104,y:567,w:213,h:43},"重配研究 · 全额返星",()=>{game.resetSkills();s.previewRank=null;},{disabled:!editable||!SkillBook.spent(research),size:18});
    const base=SKILLS[s.skill],rank=s.previewRank??Math.min(4,owned.level+1),branch=owned.branch??s.branch;
    const stage=game.screen==="battle"?game.level:LEVELS[s.chapter*8];
    const spec=SkillBook.stats(research,s.skill,stage),preview={...research,upgrades:{...research.upgrades,[s.skill]:{level:rank,branch:rank>=3?branch:null}}};
    const next=SkillBook.stats(preview,s.skill,stage),canResearch=rank===owned.level+1;
    this.text(`${base.name} · 进化树`,352,262,24,COLORS.ink,"bold");
    this.text("点节点预览，确认后花费星星",352,290,16,COLORS.muted);
    // 根节点→强化→双分支→各自终阶；已研究、待研究和互斥分支使用不同颜色。
    const nodes=[{rank:1,x:484,y:304,w:130,h:43,label:"L1 · 基础"},{rank:2,x:484,y:367,w:130,h:43,label:"L2 · 3★"},
      ...base.branches.flatMap((p,i)=>[{rank:3,branch:i,x:351+i*213,y:432,w:198,h:43,label:`${p.name} · 5★`},{rank:4,branch:i,x:351+i*213,y:492,w:198,h:43,label:`${p.name} L4 · 8★`}])];
    this.line([[549,347],[549,367]],"#a28a5c",3);
    for(const i of [0,1]){const x=450+i*213;this.line([[549,410],[549,420],[x,420],[x,432]],"#a28a5c",3);this.line([[x,475],[x,492]],"#a28a5c",3);}
    for(const node of nodes){
      const chosen=rank===node.rank&&(node.branch===undefined||branch===node.branch);
      const learned=owned.level>=node.rank&&(node.branch===undefined||owned.branch===node.branch);
      const excluded=owned.level>=3&&node.branch!==undefined&&node.branch!==owned.branch;
      this.button(game,node,`${learned?"✓ ":excluded?"× ":""}${node.label}`,()=>{s.previewRank=node.rank;if(node.branch!==undefined)s.branch=node.branch;},{active:chosen,disabled:excluded,size:19});
    }
    this.box(784,246,375,290,"#efe2bf",COLORS.border,10);
    this.text(`L${owned.level} → 预览 L${rank}`,800,272,20,COLORS.ink,"bold");
    const value=p=>p.burn||p.heal||(p.haste?Math.round(p.haste*100):p.damage||p.stun);
    const label=spec.burn?"魔法/秒":spec.heal?"修复量":spec.haste?"攻速%":spec.damage?`${CombatRules.typeName(spec.damageType)}伤害`:"冻结秒";
    this.text(`${label} ${value(spec)} → ${value(next)}`,800,303,20,COLORS.gold,"bold");
    this.text(`冷却 ${spec.cooldown} → ${next.cooldown}秒`,800,333,18,COLORS.ink);
    this.text(`范围 ${spec.radius} → ${next.radius}`,800,360,18,COLORS.ink);
    const rows=this.skillMechanics(s.skill,spec,next).slice(1,-1);
    const lines=rows.flatMap(row=>this.bookWrap(row,20));
    lines.slice(0,6).forEach((line,i)=>this.text(line,800,389+i*21,16,COLORS.muted));
    if(!lines.length)this.bookWrap(base.note,20).forEach((line,i)=>this.text(line,800,389+i*23,17,COLORS.muted));
    const cost=SKILL_UPGRADE_COSTS[rank];
    this.button(game,{x:351,y:555,w:175,h:45},research.loadout[0]===s.skill?"Q · 已装备":"装入 Q 槽",()=>game.equipSkill(s.skill,0),{active:research.loadout[0]===s.skill,disabled:!editable,size:20});
    this.button(game,{x:536,y:555,w:175,h:45},research.loadout[1]===s.skill?"E · 已装备":"装入 E 槽",()=>game.equipSkill(s.skill,1),{active:research.loadout[1]===s.skill,disabled:!editable,size:20});
    const action=owned.level===4?"研究已满级":!canResearch?"请先研究上一等级":rank===3?`进化为${base.branches[branch].name} · ${cost}★`:`强化至 L${rank} · ${cost}★`;
    this.button(game,{x:739,y:555,w:420,h:45},action,()=>{if(game.upgradeSkill(s.skill,rank===3?branch:null))s.previewRank=null;},{primary:true,disabled:!editable||!canResearch||!cost||SkillBook.available(game.progress)<cost,size:22});
    this.text(`出战：Q ${SKILLS[research.loadout[0]].name} / E ${SKILLS[research.loadout[1]].name}`,351,629,18,COLORS.gold,"bold");
    this.button(game,{x:940,y:613,w:219,h:34},"技能机制 ›",()=>{s.context={title:base.name,rows:[`预览 L${rank} · ${stageLabel(LEVELS.indexOf(stage))}参考`,...this.skillMechanics(s.skill,next)]};s.tab="mechanics";s.detailPage=0;},{size:17});
  },

  modal(game) {
    if(game.modal==="codex"){this.codexModal(game);return;}
    CodexView.modal.call(this,game);
  },
  fieldWorld(game) {
    CodexView.fieldWorld.call(this,game);
    ctx.save();ctx.beginPath();ctx.rect(MAP.x,MAP.y,MAP.w,MAP.h);ctx.clip();
    for(const zone of game.skillZones){
      this.circle(zone.x,zone.y,zone.spec.radius,"#d7864420");this.attackRing(zone.x,zone.y,zone.spec.radius,"#ae683b",2);
      for(let i=0;i<6;i++){const a=i*Math.PI/3+zone.life*.25;this.circle(zone.x+Math.cos(a)*zone.spec.radius*.6,zone.y+Math.sin(a)*zone.spec.radius*.6,4,"#c37848");}
    }
    for(const tower of game.towers){
      if(tower.jammedTime>0){this.attackRing(tower.x,tower.y,30,"#866092",3);this.text(`封锁 ${tower.jammedTime.toFixed(1)}s`,tower.x,tower.y-57,13,"#654175","bold","center");}
      else if(tower.hasteTime>0||tower.jamGuardTime>0){this.attackRing(tower.x,tower.y,25,tower.hasteTime>0?"#ba8a33":"#508c6b",2);}
    }
    for(const enemy of game.enemies){
      if(enemy.spec.towerJam&&enemy.abilityTimer<=TACTIC_PARAMETERS.jamWarning&&enemy.silenceTime<=0){
        this.attackRing(enemy.x,enemy.y,enemy.spec.abilityRadius,"#9471a575",1);this.text("封塔预警",enemy.x,enemy.y-31,12,"#654175","bold","center");
      }
      if(enemy.silenceTime>0)this.text("静默",enemy.x,enemy.y-25,11,"#705088","bold","center");
      else if(enemy.controlWardTime>0)this.attackRing(enemy.x,enemy.y,22,"#61a182",2);
    }
    ctx.restore();
  }
});
