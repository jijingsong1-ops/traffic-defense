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
  bus: {name:"公交撤离",brief:"两站接人防伏击，送达获80–160G及技能补给",action:"护航 5秒"},
  emergency: {name:"保障急救通道",brief:"第3波与倒数第2波出车，两辆均须限时通过",action:"优先放行"},
  bridge: {name:"保护桥梁",brief:"第2波起破拆车袭桥，冻结拦截可阻止破拆",action:`抢修 ${CONFIG.bridgeRepairCost}G`}
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
    const bridges=game.buildRoad.routes.map(path=>this.bridgeSpan(path));
    game.traffic={fork:this.fork(game.road),branch:0,switchCooldown:0,diversionTime:0,routeMenu:false,actionCooldown:0,activeTime:0,
      integrity:100,delivered:0,civilians:[],pending:[],scheduled:0,clock:0,failed:"",warned:false,
      bridge:this.bridgeSpan(game.road.path(0)),bridges:bridges.filter((b,i)=>bridges.findIndex(p=>p.key===b.key)===i),
      bridgeLoad:0,bridgeWarning:false,minimumIntegrity:100,busRewards:0,repairs:0,diversions:0};
    this.configureRoutes(game);
    game.failureReason="";
  },
  configureRoutes(game) {
    const fork=game.traffic.fork;
    if(!fork)return;
    const first=game.road.path(0);let shared=0;
    while(shared<first.length-fork.segment&&game.road.routes.every(p=>p.at(-1-shared)&&Collision.distance(p.at(-1-shared),first.at(-1-shared))<.01))shared++;
    game.road.routes.forEach((path,index)=>{path.trafficBranch=index;path.forkSegment=fork.segment;path.mergeSegment=path.length-shared;});
  },
  branch(index) { return [{name:"快线",speed:1.18},{name:"慢线",speed:.76},{name:"常规",speed:1}][index%3]; },
  path(game,index=0) { return game.road.path(game.traffic?.fork&&game.traffic.diversionTime>0?game.traffic.branch:index); },
  switchRoute(game,index=(game.traffic.branch+1)%game.road.routes.length) {
    const t=game.traffic;
    if(game.screen!=="battle"||game.modal||!t?.fork||t.switchCooldown>0||!Number.isInteger(index)||index<0||index>=game.road.routes.length)return false;
    t.branch=index;t.switchCooldown=CONFIG.trafficSwitchCooldown;t.diversionTime=CONFIG.diversionDuration;t.routeMenu=false;t.diversions++;
    const path=this.path(game);
    // 只调度岔口前的敌车；公交走自己的撤离线路，不被敌流信号带走。
    for(const actor of game.enemies)if(!actor.dead&&actor.segment<t.fork.segment)actor.path=path;
    Sound.play("gate");game.notify(`${String.fromCharCode(65+t.branch)}${this.branch(index).name}定向放行${CONFIG.diversionDuration}秒，随后恢复自动分路；民车不改道。`);
    return true;
  },
  pointAt(path,distance) {
    let left=distance;
    for(let i=0;i<path.length-1;i++){
      const a=path[i],b=path[i+1],length=Collision.distance(a,b);
      if(left<=length||i===path.length-2){const f=Math.min(1,Math.max(0,left/length));return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,segment:i,distance};}
      left-=length;
    }
  },
  length(path) { return path.slice(1).reduce((sum,p,i)=>sum+Collision.distance(path[i],p),0); },
  busStops(path) { const length=this.length(path);return [.32,.67].map(f=>({...this.pointAt(path,length*f),waiting:CONFIG.busStopTime,alert:null,raided:false})); },
  civilPath(game) {
    // 发车时选风险较低的线路，固定到驶离；玩家可把敌车临时分流到另一边。
    return [...game.road.routes].sort((a,b)=>{
      const risk=path=>this.length(path)/300+game.enemies.filter(e=>!e.dead&&e.path===path).reduce((n,e)=>n+(e.spec.boss?5:1),0);
      return risk(a)-risk(b);
    })[0];
  },
  bridgeSpan(path) {
    const segment=Math.min(path.length-2,Math.max(1,Math.floor((path.length-1)*.4))),from=path[segment],to=path[segment+1];
    const length=Collision.distance(from,to),half=Math.min(CONFIG.bridgeDeckLength,length)*.5/length;
    const at=f=>({x:from.x+(to.x-from.x)*f,y:from.y+(to.y-from.y)*f});
    const a=at(.5-half),b=at(.5+half),p=at(.5);
    return {a,b,...p,segment,key:`${a.x},${a.y}:${b.x},${b.y}`};
  },
  bridgeAt(game,actor) {
    const key=this.bridgeSpan(actor.path).key;
    return game.traffic.bridges.find(b=>b.key===key&&Collision.segmentDistance(actor,b.a,b.b)<CONFIG.roadWidth/2+3);
  },
  type(level,path,segment) {
    if(level.mission==="bridge"&&segment===Math.max(1,Math.floor((path.length-1)*.4)))return "bridge";
    if(segment===path.length-2)return "street";
    const terrain={city:"express",country:"dirt",desert:"sand",hills:"slope",sea:"channel",forest:"dirt"}[level.theme];
    return segment%3===0 ? "street" : terrain;
  },
  speed(game,actor) {
    const road=ROAD_TYPES[this.type(game.level,actor.path,actor.segment)];
    const heavy=actor.spec&&(actor.spec.boss||actor.spec.armor>=.2);
    let factor=heavy&&road.heavy?road.heavy:road.speed;
    if(actor.path.trafficBranch!==undefined&&actor.segment>=actor.path.forkSegment&&actor.segment<actor.path.mergeSegment)
      factor*=this.branch(actor.path.trafficBranch).speed;
    const a=actor.path[actor.segment],b=actor.path[actor.segment+1],c=actor.path[actor.segment+2];
    if(a&&b&&c&&Collision.distance(actor,b)<32){
      const dot=((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))/(Collision.distance(a,b)*Collision.distance(b,c));
      if(dot<.8)factor*=.8;
    }
    return factor;
  },
  onWave(game) {
    const t=game.traffic,kind=game.level.mission,event=game.level.routeEvent;
    if((kind==="bus"||kind==="emergency")&&[kind==="bus"?2:3,game.level.waves-1].includes(game.wave)&&t.lastCivilWave!==game.wave){
      t.pending.push({kind,path:this.civilPath(game),releaseIn:kind==="bus"?CONFIG.busDispatchWindow:0,ready:kind!=="bus"});t.scheduled++;t.lastCivilWave=game.wave;
      Sound.play(`radio-${kind}`);game.notify(kind==="bus"?"公交待发12秒：先守两处接人站，再点发车；送达提供金币与技能补给。":"急救车准备出发：清理拥堵，优先放行可短暂突破封锁。");
    }
    if(event&&!t.warned&&game.wave===event.wave-1){
      t.warned=true;Sound.play(`radio-${event.kind}`);
      game.notify(`交通预告：第 ${event.wave} 波${event.name}，黄色虚线即将启用。`);
    }
  },
  onRouteEvent(game) {
    const t=game.traffic;
    const path=game.road.path(0);
    for(const actor of t.civilians)if(!actor.dead&&actor.segment===0&&[0,1].every(i=>Collision.distance(actor.path[i],path[i])<.01))actor.setRoute(path);
    for(const request of t.pending)request.path=path;
    t.fork=this.fork(game.road);t.branch=0;t.diversionTime=0;t.routeMenu=false;this.configureRoutes(game);
    t.bridge=this.bridgeSpan(path);Sound.play("gate");
  },
  dispatch(game) {
    const t=game.traffic,request=t.pending[0];
    if(game.screen!=="battle"||game.modal||game.paused||!request||request.kind!=="bus"||request.ready||t.civilians.length)return false;
    request.ready=true;request.releaseIn=0;Sound.play("gate");return true;
  },
  action(game) {
    const t=game.traffic,kind=game.level.mission;
    if(game.screen!=="battle"||game.modal||game.paused||t.actionCooldown>0)return false;
    if(kind==="bridge"){
      if(game.gold<CONFIG.bridgeRepairCost||t.integrity>=100)return false;
      game.gold-=CONFIG.bridgeRepairCost;t.integrity=Math.min(100,t.integrity+CONFIG.bridgeRepairAmount);t.actionCooldown=CONFIG.bridgeRepairCooldown;t.repairs++;
      game.float(t.bridge,`抢修 +${CONFIG.bridgeRepairAmount}`,COLORS.mint);
    }else{
      if(kind!=="toll"&&!t.civilians.some(c=>!c.dead))return false;
      t.activeTime=kind==="toll"?CONFIG.tollHold:kind==="emergency"?CONFIG.emergencyPriority:CONFIG.escortProtection;
      t.actionCooldown=kind==="emergency"?CONFIG.emergencyCooldown:kind==="bus"?CONFIG.escortCooldown:CONFIG.trafficActionCooldown;
    }
    Sound.play("gate");return true;
  },
  onEscape(game,enemy) {
    if(game.level.mission==="toll"){
      game.traffic.integrity=Math.max(0,game.traffic.integrity-enemy.spec.leak*8);
      if(game.traffic.integrity<=0)game.traffic.failed="收费站被突破";
    }
  },
  enemyMotion(game,enemy,factor,dt=0) {
    const t=game.traffic;
    if(enemy.raidTarget&&!enemy.raidTarget.dead&&Collision.distance(enemy,enemy.raidTarget)<CONFIG.busThreatRadius)factor=0;
    if(game.level.mission==="bridge"&&enemy.spec.bridgeDamage&&this.bridgeAt(game,enemy)){
      enemy.siegeTime=(enemy.siegeTime||0)+dt;
      if(enemy.siegeTime<CONFIG.bridgeSiegeDuration)factor=0;
    }
    if(game.level.mission==="toll"&&t.activeTime>0&&enemy.remaining<72)factor=0;
    if((enemy.spec.boss||enemy.spec.armor>=.2)&&factor<.85&&(enemy.lastRoadFactor??1)>=.85)Sound.play("brake");
    enemy.lastRoadFactor=factor;return factor;
  },
  update(game,dt) {
    const t=game.traffic;t.clock+=dt;
    for(const key of ["switchCooldown","diversionTime","actionCooldown","activeTime"])t[key]=Math.max(0,t[key]-dt);
    if(t.pending.length){
      const request=t.pending[0],path=request.path;
      if(!t.civilians.length){
        request.releaseIn=Math.max(0,request.releaseIn-dt);if(request.releaseIn===0)request.ready=true;
        if(request.ready&&![...t.civilians,...game.enemies].some(c=>!c.dead&&Collision.distance(c,path[0])<45)){
          t.pending.shift();t.civilians.push(new CivilVehicle(request.kind,path));
        }
      }
    }
    if(game.level.mission==="bridge"){
      let load=0;
      for(const enemy of game.enemies)if(!enemy.dead){
        const span=this.bridgeAt(game,enemy);if(!span)continue;
        enemy.crossedBridges??=new Set();
        if(!enemy.crossedBridges.has(span.key)){
          enemy.crossedBridges.add(span.key);t.integrity-=enemy.spec.boss?4:enemy.spec.armor>=.2?1:.35;
        }
        load+=enemy.spec.boss?1:enemy.spec.armor>=.2?.22:.08;
        if(enemy.spec.bridgeDamage&&(enemy.siegeTime||0)<CONFIG.bridgeSiegeDuration&&enemy.stunTime<=0&&!enemy.blocker)load+=enemy.spec.bridgeDamage;
      }
      t.bridgeLoad=load;
      t.integrity=Math.max(0,t.integrity-load*dt);
      t.minimumIntegrity=Math.min(t.minimumIntegrity,t.integrity);
      if(t.integrity<40&&!t.bridgeWarning){t.bridgeWarning=true;game.notify("桥梁危急！优先处理破拆车，或花60G抢修。");Sound.play("brake");}
      if(t.integrity>=50)t.bridgeWarning=false;
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
    if(kind==="toll"||kind==="bridge")return `${name} · 耐久 ${Math.floor(t.integrity)}%${kind==="bridge"&&t.bridgeLoad>0?` · 受损 −${t.bridgeLoad.toFixed(1)}/秒`:""}`;
    const car=t.civilians[0];
    return `${name} ${t.delivered}/2${car?kind==="bus"?` · 车况${Math.ceil(car.health)}% · ${car.atStop?`接人${Math.ceil(car.stops[car.stopIndex].waiting)}秒`:"前往站点"}`:` · 余 ${Math.ceil(car.deadline)}秒`:t.delivered===2?" · 已全部送达":t.pending.length?` · ${t.pending[0].ready?"等待出站":`${Math.ceil(t.pending[0].releaseIn)}秒后发车`}`:" · 等待出车"}`;
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
    this.health=100;this.dead=false;this.speed=kind==="bus"?76:90;
    this.travelled=0;this.stopIndex=0;this.atStop=false;this.stops=kind==="bus"?Traffic.busStops(path):[];
    const length=path.slice(1).reduce((sum,p,i)=>sum+Collision.distance(path[i],p),0);
    // 按出发路线长度给出可达的时限；之后改道不重置倒计时。
    this.deadline=length/(this.speed*.7)+24;
  }
  setRoute(path) { this.path=path;if(this.kind==="bus")this.stops=Traffic.busStops(path); }
  raid(game,stop,dt) {
    if(stop.raided||stop.distance-this.travelled>190)return;
    if(stop.alert===null){stop.alert=CONFIG.busRaidWarning;game.notify("站点伏击预警：3秒后劫掠车出现，准备护航或冻结。");Sound.play("brake");}
    stop.alert=Math.max(0,stop.alert-dt);
    if(stop.alert>0)return;
    stop.spawned??=0;
    const p=Traffic.pointAt(this.path,stop.distance+40+stop.spawned*55);
    if(game.enemies.some(e=>!e.dead&&Collision.distance(e,p)<38))return;
    const enemy=new Enemy("raider",this.path,game.level.scale*CONFIG.enemyGrowth**Math.max(0,game.wave-1));
    Object.assign(enemy,p);enemy.raidTarget=this;enemy.angle=this.angle;game.enemies.push(enemy);
    stop.spawned++;if(stop.spawned===2)stop.raided=true;
  }
  arrive(game) {
    if(this.dead)return;
    const t=game.traffic;this.dead=true;t.delivered++;
    if(this.kind==="bus"){
      const reward=CONFIG.busRewardBase+Math.floor(Math.max(0,this.health)*CONFIG.busRewardHealth);
      game.gold+=reward;t.busRewards+=reward;
      for(const key of Object.keys(game.skillCooldowns))game.skillCooldowns[key]=Math.max(0,game.skillCooldowns[key]-8);
      game.float(this,`撤离成功 +${reward}G`,COLORS.gold);game.notify(`公交安全送达：+${reward}G，两个支援技能冷却缩短8秒。`);
    }else game.float(this,"安全送达",COLORS.mint);
    Sound.play("gate");
  }
  update(dt,game) {
    if(this.dead)return;
    const t=game.traffic,near=game.enemies.filter(e=>!e.dead&&Collision.distance(e,this)<(this.kind==="bus"?CONFIG.busThreatRadius:65));
    const destination=this.path[this.segment+1];
    this.angle=Math.atan2(destination.y-this.y,destination.x-this.x);
    const priority=t.activeTime>0;
    if(this.kind==="bus"){
      const attackers=near.filter(e=>e.stunTime<=0&&!e.blocker);
      const collision=Math.min(4,attackers.filter(e=>!e.spec.busDamage).reduce((n,e)=>n+(e.spec.boss?4:e.spec.armor>=.2?2:1),0));
      const raidDamage=attackers.reduce((n,e)=>n+(e.spec.busDamage||0),0);
      if(!priority)this.health-=Math.min(18,collision+raidDamage)*dt;
      for(const stop of this.stops)this.raid(game,stop,dt);
    }
    if(this.kind==="emergency")this.deadline-=dt;
    // 只把前方同一通行带的敌车算作阻挡；身后车辆、并行道路不会锁死急救车。
    const blockedAhead=near.some(e=>{
      const dx=e.x-this.x,dy=e.y-this.y,ahead=dx*Math.cos(this.angle)+dy*Math.sin(this.angle);
      const lateral=Math.abs(-dx*Math.sin(this.angle)+dy*Math.cos(this.angle));
      return ahead>=-8&&ahead<60&&lateral<22;
    });
    this.blocked=this.kind==="emergency"&&blockedAhead&&!priority;
    if(this.health<=0||this.kind==="emergency"&&this.deadline<=0){this.dead=true;t.failed=this.kind==="bus"?"撤离公交被摧毁：先守接人站，伏击时开启护航":"急救车超过通行时限";return;}
    const stop=this.stops[this.stopIndex];this.atStop=!!stop&&this.travelled>=stop.distance-.001;
    if(this.atStop){stop.waiting=Math.max(0,stop.waiting-dt);if(stop.waiting===0){this.stopIndex++;this.atStop=false;}return;}
    let step=this.blocked?0:this.speed*Traffic.speed(game,this)*dt;
    if(stop)step=Math.min(step,Math.max(0,stop.distance-this.travelled));
    while(step>0&&!this.dead){
      const target=this.path[this.segment+1],distance=Collision.distance(this,target);
      this.angle=Math.atan2(target.y-this.y,target.x-this.x);
      if(step>=distance){this.x=target.x;this.y=target.y;this.segment++;step-=distance;this.travelled+=distance;
        if(this.segment===this.path.length-1)this.arrive(game);
      }else{this.x+=Math.cos(this.angle)*step;this.y+=Math.sin(this.angle)*step;this.travelled+=step;step=0;}
    }
  }
}
