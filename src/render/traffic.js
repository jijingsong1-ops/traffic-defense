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
        const span=Traffic.bridgeSpan(path),nx=-(b.y-a.y)/length*22,ny=(b.x-a.x)/length*22;
        this.line([[span.a.x,span.a.y],[span.b.x,span.b.y]],"#c9b88d88",CONFIG.roadWidth-4);
        for(const side of [-1,1])this.line([[span.a.x+nx*side,span.a.y+ny*side],[span.b.x+nx*side,span.b.y+ny*side]],"#d9c48d",5);
      }
      if(i===1&&length>70){
        const x=a.x+(b.x-a.x)*.35,y=a.y+(b.y-a.y)*.35;
        this.speedSign(x,y-27,road);
      }
    }
    if(t.fork){
      for(const [index,path] of game.road.routes.entries()){
        const active=t.diversionTime>0&&t.branch===index,branch=Traffic.branch(index),a=path[t.fork.segment],b=path[t.fork.segment+1];
        this.line(path.slice(t.fork.segment).map(p=>[p.x,p.y]),active?"#a0e0bd":"#f1d49d66",active?4:2,[8,12]);
        const x=a.x+(b.x-a.x)*.65,y=a.y+(b.y-a.y)*.65;
        this.box(x-49,y-10,98,20,active?"#3e7464":"#776e55","#ead6a6",5);
        this.text(`${String.fromCharCode(65+index)} ${branch.name} ×${branch.speed}`,x,y,11,"#fff1cd","bold","center");
      }
      this.box(368,104,544,28,"#e7d5a8ed",null,6);
      this.text(t.diversionTime>0?`${String.fromCharCode(65+t.branch)}线定向放行 · 剩${Math.ceil(t.diversionTime)}秒 · 民车不改道`:"敌车自动分路 · 临时调度可争取火力与撤离时间",640,118,16,"#685639","bold","center");
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
      const livePaths=[...game.road.routes,...game.enemies.filter(e=>!e.dead).map(e=>e.path)],keys=new Set(livePaths.map(path=>Traffic.bridgeSpan(path).key));
      for(const p of t.bridges.filter(b=>keys.has(b.key))){
        const color=t.integrity<40?"#b2513f":t.bridgeLoad>0?"#ad773b":"#355d59";
        // 桥梁状态与桥面上的破拆车标签分层放置，避免车辆到桥心时文字重叠。
        this.box(p.x-53,p.y-69,106,20,color,"#d9c799",4);
        this.text(`桥梁 ${Math.floor(t.integrity)}%`,p.x,p.y-59,13,"#fff0cc","bold","center");
        this.box(p.x-46,p.y-46,92,5,"#8a6953",null,1);this.box(p.x-46,p.y-46,92*t.integrity/100,5,t.integrity<40?"#e78c65":"#a8d6a3",null,1);
        if(t.integrity<75)this.line([[p.x-10,p.y-11],[p.x+2,p.y-2],[p.x-4,p.y+7],[p.x+11,p.y+16]],"#5a4c3d",3);
      }
      for(const enemy of game.enemies)if(enemy.spec.bridgeDamage&&!enemy.dead){
        this.box(enemy.x-23,enemy.y-35,46,15,"#ad6444",null,3);this.text("破拆",enemy.x,enemy.y-27,11,"#fff1cc","bold","center");
        if(Traffic.bridgeAt(game,enemy)&&enemy.stunTime<=0&&!enemy.blocker&&(enemy.siegeTime||0)<CONFIG.bridgeSiegeDuration)
          this.attackRing(enemy.x,enemy.y,26+Math.sin(t.clock*14)*4,"#d57549",2);
      }
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
      this.text(t.diversionTime>0?`↗ ${String.fromCharCode(65+t.branch)}`:"调度",p.x,p.y-30,17,"#fff0b8","bold","center");
      if(t.switchCooldown>0)this.text(`${Math.ceil(t.switchCooldown)}s`,p.x,p.y+19,11,"#4b695b","bold","center");
    }
    if(kind==="bus"){
      const car=t.civilians[0],path=car?.path||t.pending[0]?.path||game.road.path(0),stops=car?.stops||Traffic.busStops(path);
      stops.forEach((stop,i)=>{
        const done=car&&i<car.stopIndex,alert=stop.alert!==null&&stop.alert>0;
        this.circle(stop.x,stop.y,24,done?"#94bd8655":"#dfb65755","#c9984a");
        this.box(stop.x-51,stop.y-42,102,23,alert?"#b76342":"#766142","#e8d4a4",5);
        this.text(alert?`伏击 ${Math.ceil(stop.alert)}秒`:done?"接人完成":`${i+1}号接人站`,stop.x,stop.y-30,13,"#fff0be","bold","center");
        if(car?.atStop&&i===car.stopIndex){this.box(stop.x-26,stop.y+29,52,5,"#7b6c4a",null,2);this.box(stop.x-26,stop.y+29,52*(1-stop.waiting/CONFIG.busStopTime),5,"#baddaa",null,2);}
      });
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
    if(t.fork){
      const label=t.diversionTime>0?`定向 ${String.fromCharCode(65+t.branch)} ${Math.ceil(t.diversionTime)}s`:t.switchCooldown>0?`调度 ${Math.ceil(t.switchCooldown)}s`:"分流调度";
      this.button(game,{x:rect.x,y:rect.y,w,h:rect.h},label,()=>{const open=!t.routeMenu;game.cancel();t.routeMenu=open;},{active:t.routeMenu,size:19});
      if(t.routeMenu){
        const panel={x:rect.x,y:rect.y-114,w:rect.w,h:106};
        this.box(panel.x,panel.y,panel.w,panel.h,"#eddfb9",COLORS.border,10);game.buttons.push({...panel,action:()=>{}});
        this.text(`定向${CONFIG.diversionDuration}秒 · 冷却${CONFIG.trafficSwitchCooldown}秒`,panel.x+panel.w/2,panel.y+22,17,COLORS.ink,"bold","center");
        const bw=(panel.w-20-(game.road.routes.length-1)*6)/game.road.routes.length;
        game.road.routes.forEach((_,i)=>this.button(game,{x:panel.x+10+i*(bw+6),y:panel.y+42,w:bw,h:52},`${String.fromCharCode(65+i)} ${Traffic.branch(i).name}`,()=>Traffic.switchRoute(game,i),{disabled:t.switchCooldown>0,routeIndex:i,size:18}));
      }
    }
    const request=t.pending[0],dispatch=game.level.mission==="bus"&&!t.civilians.length&&request;
    if(dispatch){
      this.button(game,{x:rect.x+(count-1)*(w+gap),y:rect.y,w,h:rect.h},request.ready?"等待出站":`发车 ${Math.ceil(request.releaseIn)}s`,()=>Traffic.dispatch(game),{primary:true,disabled:game.paused||request.ready,size:19});return;
    }
    const disabled=game.paused||t.actionCooldown>0||(game.level.mission==="bridge"?(game.gold<CONFIG.bridgeRepairCost||t.integrity>=100):game.level.mission!=="toll"&&!t.civilians.length);
    this.button(game,{x:rect.x+(count-1)*(w+gap),y:rect.y,w,h:rect.h},`${mission.action}${t.actionCooldown>0?` ${Math.ceil(t.actionCooldown)}s`:""}`,()=>Traffic.action(game),{disabled,size:19});
  }
});
