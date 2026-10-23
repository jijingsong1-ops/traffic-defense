"use strict";

// 地图互动均可选，不挤占塔位；开启面板暂停，确认后按模拟时钟推进。
const WorldOps = {
  parts(point) {return [{x:point.x-28,y:point.y-31,w:56,h:56},point.label||{x:point.x-46,y:point.y+30,w:92,h:20}];},
  bounds(point) {
    const [model,label]=this.parts(point),x=Math.min(model.x,label.x),y=Math.min(model.y,label.y);
    return {x,y,w:Math.max(model.x+model.w,label.x+label.w)-x,h:Math.max(model.y+model.h,label.y+label.h)-y};
  },
  overlaps(a,b,gap=8) {return a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;},
  // 检查完整模型和铭牌占位，不能只凭中心点不在路上就放置。
  coversRoad(rect,road) {
    const radius=CONFIG.roadWidth/2+6;
    return road.edges.some(([a,b])=>{
      let low=0,high=1;
      for(const [axis,start,size] of [["x",rect.x,rect.w],["y",rect.y,rect.h]]){
        const delta=b[axis]-a[axis],min=start-radius,max=start+size+radius;
        if(Math.abs(delta)<.001){if(a[axis]<min||a[axis]>max)return false;}
        else{const first=(min-a[axis])/delta,last=(max-a[axis])/delta;low=Math.max(low,Math.min(first,last));high=Math.min(high,Math.max(first,last));if(low>high)return false;}
      }
      return true;
    });
  },
  obstacles(game) {
    const boxes=game.sites.map(s=>({x:s.x-42,y:s.y-75,w:84,h:118}));
    // 顶部路线/首领提示与底部暂停提示的固定区域也保留留白。
    boxes.push({x:320,y:96,w:640,h:90},{x:430,y:546,w:420,h:54});
    for(const entry of Encounters.entrances(game.level))boxes.push({x:entry.point[0]-35,y:entry.point[1]-66,w:120,h:38});
    for(const path of game.buildRoad.routes){
      if(game.level.mission==="bus")for(const stop of Traffic.busStops(path))boxes.push({x:stop.x-56,y:stop.y-48,w:112,h:85});
      if(game.level.mission==="bridge"){const p=Traffic.bridgeSpan(path);boxes.push({x:p.x-58,y:p.y-74,w:116,h:38});}
      if(game.level.mission==="toll"){const p=path.at(-1);boxes.push({x:p.x-90,y:p.y-90,w:180,h:180});}
      if(path.length>2){const a=path[1],b=path[2],length=Collision.distance(a,b),offset=CONFIG.roadWidth/2+20;
        if(length>70){const x=a.x+(b.x-a.x)*.35+(b.y-a.y)/length*offset,y=a.y+(b.y-a.y)*.35-(b.x-a.x)/length*offset;
          boxes.push({x:x-28,y:y-17,w:56,h:63});}
      }
    }
    return boxes;
  },
  plan(game) {
    const road=game.buildRoad,candidates=[],obstacles=this.obstacles(game);
    for(let y=MAP.y+42;y<MAP.y+MAP.h-30;y+=16)for(let x=MAP.x+34;x<MAP.x+MAP.w-34;x+=18){
      const p={x,y},near=Collision.distance(p,game.road.nearestPoint(p));
      if(near>124)continue;
      // 铭牌可置于模型上、下或侧面；两个独立占位都必须有安全留白。
      const labels=[{x:x-46,y:y+30,w:92,h:20},{x:x-46,y:y-57,w:92,h:20},
        {x:x+36,y:y-10,w:92,h:20},{x:x-128,y:y-10,w:92,h:20}];
      for(const label of labels){
        const candidate={...p,label},parts=this.parts(candidate);
        if(parts.some(box=>!Collision.inside(box,MAP)||!Collision.inside({x:box.x+box.w,y:box.y+box.h},MAP)||
          this.coversRoad(box,road)||obstacles.some(rect=>this.overlaps(box,rect))))continue;
        candidates.push(candidate);break;
      }
    }
    const names=WORLD_THEMES[game.level.theme],kinds=WORLD_STAGE_ACTIONS[game.level.stage-1],points=[];
    for(const [i,kind] of kinds.entries()){
      const ideal={x:MAP.x+MAP.w*[.26,.74][i],y:MAP.y+MAP.h*[.65,.35][i]};
      const point=candidates.filter(p=>points.every(other=>Collision.distance(p,other)>180&&!this.overlaps(this.bounds(p),this.bounds(other),24)))
        .sort((a,b)=>Collision.distance(a,ideal)-Collision.distance(b,ideal))[0];
      if(!point)continue;
      points.push({...point,id:kind,kind,name:names[kind]||{relay:"通信中继",challenge:"悬赏委托"}[kind],used:false,cooldown:0});
    }
    return points;
  },
  init(game) {
    game.worldOps={points:this.plan(game),selected:null,inventory:{barrier:0},stock:Object.fromEntries(["barrier","repair","helpers"].map(type=>[type,WORLD_RULES[type].stock])),
      zones:[],challenge:null,cache:null,clock:0};
    game.item=null;
  },
  at(game,p) {return game.worldOps?.points.find(point=>this.parts(point).some(box=>Collision.inside(p,box)));},
  open(game,point) {
    if(game.screen!=="battle"||!game.worldOps?.points.includes(point))return false;
    game.cancel();game.worldOps.selected=point;game.worldOps.feedback=null;game.modal=point.kind==="shop"?"worldShop":"worldPoint";game.buttons=[];
    Sound.play("build");return true;
  },
  activeAnchor(game,point) {
    const anchor=game.road.nearestPoint(point);
    return Collision.distance(anchor,point)<=145?anchor:null;
  },
  buy(game,type) {
    const state=game.worldOps,spec=WORLD_RULES[type],shop=state?.selected;
    if(game.screen!=="battle"||game.modal!=="worldShop"||shop?.kind!=="shop"||!spec||!state.stock[type]||game.gold<spec.cost)return false;
    const helpers=type==="helpers"?new Tower("depot",shop.x,shop.y,game.level.theme):null;
    if(helpers){helpers.level=2;helpers.rally=AlliedNavigation.defaultRally(game,helpers);if(!helpers.rally){game.notify("附近道路尚未开放，暂不能派出小队。");return false;}}
    if(type==="repair"&&!game.traffic.civilians.some(c=>!c.dead&&c.kind==="bus"&&c.health<100)&&
      !(game.level.mission==="bridge"&&game.traffic.integrity<100)&&!game.towers.some(t=>t.jammedTime>0||t.soldiers.some(s=>s.alive&&s.health<s.maxHealth))){game.notify("当前没有需要修复的目标，金币未消耗。");return false;}
    game.gold-=spec.cost;state.stock[type]--;
    if(type==="barrier")state.inventory.barrier++;
    if(type==="repair"){
      for(const t of game.towers){t.jammedTime=0;t.jamGuardTime=Math.max(t.jamGuardTime,spec.heal/4);for(const s of t.soldiers)if(s.alive)s.health=Math.min(s.maxHealth,s.health+spec.heal*3);}
      for(const c of game.traffic.civilians)if(!c.dead&&c.kind==="bus")c.health=Math.min(100,c.health+spec.heal);
      if(game.level.mission==="bridge")game.traffic.integrity=Math.min(100,game.traffic.integrity+spec.heal);
    }
    if(type==="helpers"){
      helpers.temporary=true;helpers.duration=spec.duration;helpers.invested=0;game.towers.push(helpers);helpers.update(0,game);
    }
    game.effect(shop,"#64a796",35);Sound.play("build");
    game.notify(type==="barrier"?"路障包已入工具袋，关闭面板后点击工具袋选位置。":`${spec.name}已生效。`);return true;
  },
  selectItem(game) {
    if(game.screen!=="battle"||game.modal||!game.worldOps?.inventory.barrier)return false;
    game.cancel();game.item="barrier";game.notify("选择已开放道路放置路障包；右键或 Esc 取消，不消耗道具。");return true;
  },
  placeItem(game,p) {
    if(game.screen!=="battle"||game.paused||game.modal||game.item!=="barrier"||!game.worldOps.inventory.barrier)return false;
    if(!Collision.inside(p,MAP)||!game.road.isRoad(p)){game.notify("只能在已开放道路放置，路障包未消耗。");return false;}
    const spec=WORLD_RULES.barrier;game.worldOps.inventory.barrier--;game.item=null;
    game.worldOps.zones.push({...p,kind:"barrier",radius:spec.radius,life:spec.duration,slow:spec.slow});
    game.effect(p,"#d59255",spec.radius);Sound.play("freeze");game.notify("临时路障已展开，邻近敌车减速。" );return true;
  },
  activate(game) {
    const state=game.worldOps,point=state?.selected;
    if(game.screen!=="battle"||game.modal!=="worldPoint"||!point||point.used||point.cooldown>0)return false;
    const spec=WORLD_RULES[point.kind],anchor=this.activeAnchor(game,point);
    if(point.kind==="cache"){
      if(state.cache)return false;state.cache={point,remaining:spec.duration};point.used=true;
    }else if(point.kind==="challenge"){
      if(game.wave<1||state.challenge)return false;
      state.challenge={point,phase:"warning",remaining:spec.warning,units:[],entry:Encounters.entrances(game.level)
        .sort((a,b)=>Collision.distance({x:a.point[0],y:a.point[1]},point)-Collision.distance({x:b.point[0],y:b.point[1]},point))[0].id};point.used=true;
    }else{
      if(!anchor){game.notify("这里的道路尚未开放，暂不能启用。");return false;}
      if(game.gold<spec.cost)return false;
      const towers=game.towers.filter(t=>!t.temporary&&Collision.distance(t,point)<=WORLD_RULES.relay.radius);
      if(point.kind==="relay"&&!towers.length){game.notify("附近还没有设施，金币未消耗。");return false;}
      game.gold-=spec.cost;point.cooldown=spec.cooldown;
      if(point.kind==="relay")for(const t of towers){t.relayHasteTime=Math.max(t.relayHasteTime,spec.duration);t.relayHastePower=spec.haste;}
      else{
        const effect=WORLD_THEMES[game.level.theme].effect;
        if(effect==="impact")for(const enemy of game.enemies)if(!enemy.dead&&Collision.distance(enemy,anchor)<=spec.radius)enemy.hit(70,game,{damageType:"physical"});
        if(effect==="roots")for(const enemy of game.enemies)if(!enemy.dead&&Collision.distance(enemy,anchor)<=spec.radius)enemy.stun(.8);
        state.zones.push({...anchor,kind:"mechanism",radius:spec.radius,life:spec.duration,slow:effect==="roots"?.4:effect==="slow"?.45:effect==="impact"?.65:.7,silence:effect==="silence"});
      }
    }
    game.modal=null;state.selected=null;game.buttons=[];game.effect(point,"#d0a257",45);Sound.play("build");
    game.notify(point.kind==="challenge"?"悬赏已接：3秒后额外车组出发，35秒内全部拦截获100G。":point.kind==="cache"?"采集已开始：邻近有敌车时暂停，安全时继续。":`${point.name}已启动。`);return true;
  },
  update(game,dt) {
    const state=game.worldOps;if(!state)return;state.clock+=dt;
    state.points.forEach(p=>p.cooldown=Math.max(0,p.cooldown-dt));
    if(state.cache){
      const task=state.cache;task.blocked=game.enemies.some(e=>!e.dead&&Collision.distance(e,task.point)<WORLD_RULES.cache.threatRange);
      if(!task.blocked)task.remaining=Math.max(0,task.remaining-dt);
      if(task.remaining===0){game.gold+=WORLD_RULES.cache.reward;game.float(task.point,`+${WORLD_RULES.cache.reward}G`,COLORS.gold);game.notify("采集完成，获得65G。" );state.cache=null;}
    }
    for(const tower of [...game.towers])if(tower.temporary){
      tower.duration=Math.max(0,tower.duration-dt);
      if(!tower.duration){tower.soldiers.forEach(s=>s.release());game.towers=game.towers.filter(t=>t!==tower);if(game.selected===tower)game.selected=null;game.float(tower,"小队撤离",COLORS.muted);}
    }
    for(const zone of state.zones){
      const elapsed=Math.min(dt,zone.life);zone.life-=dt;if(elapsed<=0)continue;
      for(const enemy of game.enemies)if(!enemy.dead&&Collision.distance(enemy,zone)<=zone.radius){enemy.slow(zone.slow,.25);if(zone.silence)enemy.silenceTime=Math.max(enemy.silenceTime,.25);}
    }
    state.zones=state.zones.filter(zone=>zone.life>0);
    const task=state.challenge;if(!task||!["warning","active"].includes(task.phase))return;
    task.remaining=Math.max(0,task.remaining-dt);
    if(task.phase==="warning"&&task.remaining===0){
      const entry=Encounters.entrances(game.level)[task.entry],path=Traffic.path(game,entry.routes[0]),pool=game.level.pool;
      const units=[pool[0],pool[1],pool.at(-1),pool[0]].map((type,lane)=>new Enemy(type,path,game.level.scale*CONFIG.enemyGrowth**Math.max(0,game.wave-1)*.85,{lane,span:1}));
      if(units.some(e=>game.enemies.some(other=>!other.dead&&Lanes.overlap(e,other)&&Collision.distance(e,other)<(e.bodyLength+other.bodyLength)/2+CONFIG.trafficGap)))return;
      task.units=units;game.enemies.push(...units);task.phase="active";task.remaining=WORLD_RULES.challenge.duration;Sound.play("wave");
    }else if(task.phase==="active"){
      const allDead=task.units.every(e=>e.dead),escaped=task.units.some(e=>e.dead&&e.health>0);
      if(allDead&&!escaped){task.phase="won";game.gold+=WORLD_RULES.challenge.reward;game.notify("悬赏完成，额外获得100G。" );game.float(task.point,"+100G",COLORS.gold);}
      else if(escaped||task.remaining===0){task.phase="lost";game.notify("悬赏未完成，无额外奖励；继续守住主线。" );}
    }
  },
  complete(game) {return !["warning","active"].includes(game.worldOps?.challenge?.phase);}
};
