"use strict";

const SkillActions={
  cast(game,type,p) {
    const spec=game.skillSpecs[type],victims=game.enemies.filter(e=>!e.dead&&Collision.distance(e,p)<=spec.radius);
    const towers=game.towers.filter(t=>Collision.distance(t,p)<=spec.radius);
    if(type==="repair"){
      const soldiers=game.towers.flatMap(t=>t.soldiers).filter(s=>s.alive&&Collision.distance(s,p)<=spec.radius);
      const civilians=game.traffic.civilians.filter(c=>!c.dead&&c.kind==="bus"&&Collision.distance(c,p)<=spec.radius);
      const bridge=game.level.mission==="bridge"&&game.traffic.bridges.some(b=>Collision.segmentDistance(p,b.a,b.b)<=spec.radius);
      if(!towers.length&&!soldiers.length&&!civilians.length&&!bridge)return false;
      for(const tower of towers){tower.jammedTime=0;tower.jamGuardTime=Math.max(tower.jamGuardTime||0,spec.duration);}
      for(const soldier of soldiers)soldier.health=Math.min(soldier.maxHealth,soldier.health+spec.heal*3);
      for(const civilian of civilians)civilian.health=Math.min(100,civilian.health+spec.heal);
      if(bridge)game.traffic.integrity=Math.min(100,game.traffic.integrity+spec.heal);
    }else if(type==="overdrive"){
      if(!towers.length)return false;
      for(const tower of towers){tower.hasteTime=Math.max(tower.hasteTime||0,spec.duration);tower.hastePower=Math.max(tower.hastePower||0,spec.haste);}
    }else if(type==="fire"){
      // 道路预铺热障也有效；不能在地图外或建筑空地消耗技能。
      if(!game.buildRoad.isRoad(p,spec.radius))return false;
      game.skillZones.push({type,...p,spec,life:spec.duration,tick:0});
    }else{
      if(!victims.length)return false;
      victims.forEach(enemy=>applyHit(enemy,spec.damage,spec,game));
    }
    game.effect(p,spec.color,spec.radius);game.skillCooldowns[type]=spec.cooldown;game.skill=null;
    Sound.play(type==="strike"?"strike":type==="freeze"?"freeze":type==="fire"?"missile":type==="repair"?"build":"signal");
    game.notify(`${spec.name}已施放！`);return true;
  },
  update(game,dt) {
    for(const zone of game.skillZones){
      if(zone.life<=0)continue;
      zone.life-=dt;zone.tick-=dt;
      if(zone.tick<=0){
        zone.tick=.5;
        for(const enemy of game.enemies)if(!enemy.dead&&Collision.distance(enemy,zone)<=zone.spec.radius)
          applyHit(enemy,0,{burn:zone.spec.burn,duration:2,slow:zone.spec.slow,damageType:"magic"},game);
      }
    }
    game.skillZones=game.skillZones.filter(z=>z.life>0);
  }
};
