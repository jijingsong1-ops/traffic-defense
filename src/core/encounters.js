"use strict";

// 战前统计与实战共用确定性车组计划；改道只换路径，不重新抽取敌军。
const ENEMY_PROFILES = {
  balanced:{name:"混合车队",tip:"单体与群伤搭配"}, armor:{name:"重甲车队",tip:"魔法 / 穿甲"},
  magic:{name:"抗魔车队",tip:"物理 / 控制"}, fast:{name:"高速突进",tip:"减速 / 拦截"},
  support:{name:"支援编队",tip:"静默 / 支援优先"}
};
const Encounters = {
  rosterCache:new WeakMap(),
  entrances(level) {
    const entries=[];
    level.routes.forEach((path,route)=>{
      const key=path[0].join(",");let entry=entries.find(e=>e.key===key);
      if(!entry){
        const main=["balanced","armor","magic","armor","fast","magic","support","balanced"][(level.stage-1+level.chapter)%8];
        const profile=entries.length===0?main:entries.length===1?(main==="armor"?"magic":"armor"):"fast";
        entry={key,id:entries.length,name:`出车口 ${String.fromCharCode(65+entries.length)}`,point:path[0],routes:[],profile};entries.push(entry);
      }
      entry.routes.push(route);
    });
    return entries;
  },
  pool(level,wave,profile) {
    const available=level.pool.slice(0,Math.min(level.pool.length,wave+1));
    const preferred=available.filter(type=>{
      const e=ENEMIES[type];
      return profile==="armor"?(e.armor||0)>=.25:profile==="magic"?(e.magicResist||0)>=.3:
        profile==="fast"?e.speed>=75:profile==="support"?CombatRules.support(e):false;
    });
    if(profile==="armor"&&!preferred.length)preferred.push("armor");
    if(profile==="magic"&&!preferred.length)preferred.push("insulated");
    if(profile==="support"&&!preferred.length)preferred.push("relay");
    if(profile==="fast"&&!preferred.length)preferred.push(available[0]);
    return {available:available.filter(type=>!CombatRules.support(ENEMIES[type])),preferred};
  },
  wave(level,number) {
    const entries=this.entrances(level),groups=[];
    const total=7+CONFIG.extraWaveEnemies+number*2+level.enemyExtra+(entries.length-1)*2;
    for(const entry of entries){
      const {available,preferred}=this.pool(level,number,entry.profile);
      const threats=level.chapter===0&&level.stage<=2?[]:CHAPTER_THREATS[level.chapter];
      const support=[...level.pool,...threats].filter(k=>CombatRules.support(ENEMIES[k]));
      const count=Math.floor(total/entries.length)+(entry.id<total%entries.length?1:0);
      const types=Array.from({length:count},(_,i)=>{
        // 每三组留一个支援位；主力倾向占普通编队的大多数，不形成满屏治疗链。
        if(number>=3&&i%12===7&&support.length)return support[(number+entry.id)%support.length];
        const favor=entry.profile==="support"?i%4===3:i%4!==3;
        const pool=preferred.length&&favor?preferred:available;
        return pool[(i+number+entry.id)%pool.length];
      });
      if(level.mission==="bridge"&&entry.id===0&&number%2===0){types.splice(2,0,"demolisher");if(number>=6)types.splice(7,0,"demolisher");}
      if(number>=3&&number%3===0&&(level.chapter>0||level.stage>=3)&&entry.id===0)
        types.splice(4,0,CHAPTER_THREATS[level.chapter][(number/3-1)%2]);
      let due=0,index=0;
      while(types.length){
        const rapid=entry.profile==="fast"&&ENEMIES[types[0]].speed>=75;
        const row=types.splice(0,rapid?1:4);
        groups.push({id:`${number}:${entry.id}:${index++}`,entry:entry.id,due,
          members:row.map((type,lane)=>({type,lane:rapid?entry.id%4:lane,span:1}))});
        due+=rapid?CONFIG.fastConvoyGap:Math.max(CONFIG.convoyGapMin,CONFIG.convoyGap-level.chapter*.08);
      }
      if(level.boss&&number===level.waves&&entry.id===0)
        groups.push({id:`${number}:boss`,entry:0,due,members:[{type:available[0],lane:0,span:1},{type:level.bossType,lane:1,span:2},{type:support[0]||available[0],lane:3,span:1}]});
    }
    return groups.sort((a,b)=>a.due-b.due||a.entry-b.entry);
  },
  roster(level,entryId=null) {
    let cache=this.rosterCache.get(level);
    if(!cache){cache=new Map();this.rosterCache.set(level,cache);}
    if(cache.has(entryId))return cache.get(entryId);
    const counts={},splits={};let groups=0;
    for(let wave=1;wave<=level.waves;wave++)for(const row of this.wave(level,wave)){
      if(entryId!==null&&row.entry!==entryId)continue;
      groups++;
      for(const {type} of row.members){counts[type]=(counts[type]||0)+1;const e=ENEMIES[type];
        if(e.split){const child=e.splitType||"swarm";splits[child]=(splits[child]||0)+e.split;}}
    }
    const ambush=entryId===null&&level.mission==="bus"?8:0;
    const result={counts,splits,ambush,groups,total:Object.values(counts).reduce((a,b)=>a+b,0)};
    cache.set(entryId,result);return result;
  },
  deploy(game,dt) {
    game.spawnClock+=dt;
    const blocked=new Set(),remove=new Set();
    for(const batch of game.spawnQueue){
      if(remove.has(batch)||blocked.has(batch.entry)||batch.due>game.spawnClock)continue;
      const row=game.spawnQueue.filter(b=>b.group===batch.group);
      const entry=this.entrances(game.level)[batch.entry];
      const path=Traffic.path(game,entry.routes[game.spawnIndex%entry.routes.length]);
      const candidates=row.map(b=>new Enemy(b.type,path,b.scale,{lane:b.lane,span:b.span}));
      const clear=candidates.every(car=>!game.enemies.some(other=>!other.dead&&Lanes.overlap(car,other)&&
        Collision.distance(car,other)<(car.bodyLength+other.bodyLength)/2+CONFIG.trafficGap));
      blocked.add(batch.entry);
      if(!clear)continue;
      game.enemies.push(...candidates);game.spawnIndex++;row.forEach(b=>remove.add(b));
    }
    game.spawnQueue=game.spawnQueue.filter(b=>!remove.has(b));
  }
};
