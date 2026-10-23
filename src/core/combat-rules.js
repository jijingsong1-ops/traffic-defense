"use strict";

const TACTIC_PARAMETERS={cleanseWard:.8,jamWarning:1.5,lineReach:160,lineWidth:18};
const CombatRules={
  typeName(type) {return {physical:"物理",magic:"魔法",true:"真实"}[type||"physical"];},
  resistance(enemy,attack) {
    if(attack.damageType==="true")return 0;
    if(attack.damageType==="magic")return enemy.spec.magicResist||0;
    return attack.pierce?0:Math.max(0,(enemy.spec.armor||0)-(enemy.shredTime>0?enemy.shredAmount:0));
  },
  support(spec) {return !!(spec.heal||spec.cleanse||spec.towerJam);},
  enemyAbility(enemy,dt,game) {
    const spec=enemy.spec;
    if(!spec.cleanse&&!spec.towerJam)return;
    // 冻结/静默会打断蓄力；解除后继续倒计时，不能跳过预警直接封塔。
    if(enemy.stunTime>0||enemy.silenceTime>0)return;
    enemy.abilityTimer-=dt;
    if(enemy.abilityTimer>0)return;
    enemy.abilityTimer=spec.cleanse||spec.towerJam;
    if(spec.cleanse){
      for(const ally of game.enemies)if(!ally.dead&&Collision.distance(enemy,ally)<=spec.abilityRadius){
        ally.stunTime=0;ally.slowTime=0;ally.slowFactor=1;ally.controlWardTime=TACTIC_PARAMETERS.cleanseWard;
      }
      game.effect(enemy,spec.color,spec.abilityRadius);game.float(enemy,"群体解控",spec.color);
    }else{
      const target=game.towers.filter(t=>!t.jammedTime&&!t.jamGuardTime&&Collision.distance(enemy,t)<=spec.abilityRadius)
        .sort((a,b)=>Collision.distance(enemy,a)-Collision.distance(enemy,b))[0];
      if(target){target.jammedTime=spec.jamDuration;target.soldiers.forEach(s=>s.release());game.beam(enemy,target,spec.color);game.float(target,"设备封锁",spec.color);}
    }
  },
  towerMechanics(stats,type) {
    const rows=[];
    if(type==="signal"&&!stats.chain&&!stats.focus&&!stats.multi)rows.push("群伤：脉冲命中射程内所有敌车");
    if(stats.focus)rows.push(`锁定：同一目标每次 +${Math.round((stats.focusGain||.25)*100)}%，最多5层`);
    if(stats.pierce)rows.push("穿甲：物理伤害忽略护甲，仍受护盾吸收");
    if(stats.lineHits)rows.push(`贯穿：主目标后${TACTIC_PARAMETERS.lineReach}距离内追加${stats.lineHits-1}车，后续70%伤害`);
    if(stats.splash)rows.push(`群伤：命中点半径 ${stats.splash}`);
    if(stats.chain)rows.push(`连锁 ${stats.chain} 个目标，每跳保留86%伤害`);
    if(stats.multi)rows.push(`同时锁定 ${stats.multi} 个目标`);
    if(stats.slow)rows.push(`减速 ${Math.round((1-stats.slow)*100)}% / ${stats.duration}秒`);
    if(stats.stun)rows.push(`冻结 ${stats.stun}秒；抗控会缩短，免控不生效`);
    if(stats.burn)rows.push(`烧伤 ${stats.burn} 魔法/秒，持续${stats.duration}秒，不叠层`);
    if(stats.shieldMultiplier)rows.push(`破盾：对护盾 ${stats.shieldMultiplier} 倍伤害`);
    if(stats.jam)rows.push(`抑制回盾 ${stats.jam}秒`);
    if(stats.shred)rows.push(`削甲 ${Math.round(stats.shred*100)}个百分点 / 4秒`);
    if(stats.healBlock)rows.push(`禁疗 ${stats.healBlock}秒，阻止目标接受治疗`);
    if(stats.silence)rows.push(`静默 ${stats.silence}秒，打断治疗、解控、封塔`);
    if(stats.repair)rows.push(`每1.5秒修复范围内队员 ${stats.repair} 生命`);
    if(stats.soldierRegen)rows.push(`队员每秒自行回复 ${stats.soldierRegen} 生命`);
    if(type==="depot")rows.push(`${stats.soldierCount}名队员，每人拦1车；阵亡${stats.respawn}秒补员`);
    return rows;
  },
  enemyMechanics(spec) {
    const rows=[];
    if(spec.controlImmune)rows.push("免控：减速与冻结无效，队员仍能拦截");
    else if(spec.slowResist)rows.push(`抗控 ${Math.round(spec.slowResist*100)}%：减弱减速、缩短冻结`);
    if(spec.heal)rows.push(`群疗：每1.2秒为85范围友军回复 ${spec.heal} × 波次倍率`);
    if(spec.cleanse)rows.push(`群解控：每${spec.cleanse}秒清除${spec.abilityRadius}范围冻结/减速，免控0.8秒`);
    if(spec.towerJam)rows.push(`封塔：预警1.5秒；每${spec.towerJam}秒封锁${spec.abilityRadius}范围内1塔${spec.jamDuration}秒`);
    if(spec.shield)rows.push(`护盾 ${spec.shield} × 关卡/波次倍率；脱战3秒后每秒回复${spec.regen}`);
    if(spec.burnResist)rows.push(`抗火：额外减少 ${Math.round(spec.burnResist*100)}% 持续烧伤`);
    if(spec.split)rows.push(`分裂：击毁后释放 ${spec.split} 个${ENEMIES[spec.splitType||"swarm"].name}`);
    if(spec.busDamage)rows.push(`袭击公交：靠近停留，每秒${spec.busDamage}车况；冻结/拦截可中断`);
    if(spec.bridgeDamage)rows.push(`破拆桥梁：停留${CONFIG.bridgeSiegeDuration}秒，每秒${spec.bridgeDamage}结构损伤`);
    if(!rows.length)rows.push(spec.speed>=75?"高速突击：需要提前减速与拦截":"普通车流：以数量突破防线");
    rows.push(`抵达终点扣 ${spec.leak} 生命；击杀 +${Math.max(1,Math.round(spec.reward*CONFIG.killRewardMultiplier))}G`);
    return rows;
  },
  counters(spec,theme) {
    const name=(type,branch)=>pathsFor(type,theme)[branch].name,rows=[];
    if((spec.magicResist||0)>=.3)rows.push(`路卫塔 / 清障台：物理伤害避开魔抗`);
    if((spec.armor||0)>=.2){const piercer=[...pathsFor("rail",theme),...pathsFor("missile",theme)].find(p=>p.pierce);rows.push(`信号站：魔法避开护甲${piercer?`；${piercer.name}物理穿甲`:""}`);}
    if(spec.shield)rows.push(`集中火力防止脱战回盾；电磁静默：3倍破盾并抑制回盾`);
    if(this.support(spec))rows.push(`${name("signal",1)}：静默能力；使用支援优先集火`);
    if(spec.heal)rows.push(`${name("rail",1)}：对被治疗的目标施加禁疗`);
    if(spec.controlImmune)rows.push(`勤务站：队员实体拦截；路卫塔持续物理输出`);
    if(spec.split)rows.push(`清障台：范围清理子车；信号站脉冲覆盖群体`);
    if(spec.busDamage||spec.bridgeDamage)rows.push(`勤务站 / 信号站控制分支：拦截、冻结中断任务伤害`);
    if(!rows.length)rows.push(`路卫塔清理单车，信号站减速，勤务站兜底拦截`);
    return rows;
  }
};
