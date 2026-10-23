"use strict";

const WorldView={fieldWorld:Renderer.fieldWorld,modal:Renderer.modal,draw:Renderer.draw,tower:Renderer.tower};
Object.assign(Renderer,{
  worldText(label,x,y,width,size=18,color="#687365",weight="normal",align="left") {
    ctx.font=`${weight} ${size}px "Microsoft YaHei", system-ui, sans-serif`;
    const measured=ctx.measureText(String(label))?.width||[...String(label)].reduce((sum,c)=>sum+(/[\x00-\x7F]/.test(c)?.56:1)*size,0);
    this.text(label,x,y,Math.min(size,size*width/Math.max(1,measured)),color,weight,align);
  },
  worldIcon(kind,x,y,size=25) {
    if(typeof UiTheme!=="undefined"){UiTheme.icon({mechanism:"roadworks",challenge:"contract",helpers:"depot",barrier:"roadworks",repair:"repair"}[kind]||kind,x,y,size,"#49776b");return;}
    this.circle(x,y,size*.5,"#d3b178","#5f7161");this.text({shop:"店",cache:"采",relay:"电",mechanism:"闸",challenge:"!"}[kind]||"+",x,y,size*.6,"#3b5c51","bold","center");
  },
  worldPoint(game,p) {
    const hover=WorldOps.at(game,game.pointer)===p,state=game.worldOps,task=state.cache?.point===p?state.cache:state.challenge?.point===p?state.challenge:null;
    // 援军从驿站出勤：车辆与倒计时置于设施最上层，避免被驿站图标遮住。
    const helpers=p.kind==="shop"&&game.towers.find(t=>t.temporary&&t.x===p.x&&t.y===p.y);
    if(helpers)this.tower(helpers);
    else {
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(.85,.85);
    this.oval(0,12,32,13,"#294e3b22");
    this.polygon([[-28,9],[-21,-16],[13,-23],[30,-8],[25,16],[-7,22]],"#c4b18a80");
    this.box(-25,-22,50,40,p.used&&!task?"#d1c3a5":"#efe2bf",hover?"#cd834d":"#6d8874",9);
    this.line([[-24,-21],[0,-34],[26,-20]],"#477467",5);this.line([[-20,-21],[1,-30],[21,-20]],"#b7ccaf",2);
    this.worldIcon(p.kind,0,-4,28);
    if(p.kind==="shop"){this.circle(-18,14,4,"#465f52");this.circle(18,14,4,"#465f52");}
    if(hover){this.circle(26,-24,7,"#d58b51");this.text("·",26,-26,18,"#fff5dc","bold","center");}
    ctx.restore();
    }
    const label=helpers?`驿站 · 小队${Math.ceil(helpers.duration)}s`:p.used?(task?.phase==="won"?"委托完成":task?.phase==="lost"?"委托结束":task?task.blocked?"采集中断":`${Math.ceil(task.remaining)}s`:"已采集"):p.cooldown>0?`${Math.ceil(p.cooldown)}s`:p.name;
    const box=WorldOps.parts(p)[1];
    this.box(box.x,box.y,box.w,box.h,"#f2e8ccee",hover?"#bc8952":null,5);
    this.worldText(label,box.x+box.w/2,box.y+box.h/2,box.w-12,13,"#385c51","bold","center");
  },
  fieldWorld(game) {
    WorldView.fieldWorld.call(this,game);if(!game.worldOps)return;
    ctx.save();ctx.beginPath();ctx.rect(MAP.x,MAP.y,MAP.w,MAP.h);ctx.clip();
    for(const p of game.worldOps.points)this.worldPoint(game,p);
    for(const zone of game.worldOps.zones){this.circle(zone.x,zone.y,zone.radius,"#d99f5c13");this.attackRing(zone.x,zone.y,zone.radius,"#ba865b88",2);}
    if(game.item&&Collision.inside(game.pointer,MAP))this.range(game.pointer,WORLD_RULES.barrier.radius,game.road.isRoad(game.pointer)?"#cf9957":"#b96c62");
    ctx.restore();
  },
  tower(tower) {
    if(!tower.temporary){WorldView.tower.call(this,tower);return;}
    ctx.save();ctx.translate(tower.x,tower.y);
    this.oval(0,12,25,10,"#294e3b25");this.box(-24,-7,48,23,"#dbaa63","#52695a",6);
    this.box(-18,-19,25,20,"#d7d7b4","#52695a",4);this.box(-13,-15,16,10,"#557f86",null,3);
    this.box(7,-6,12,11,"#79988b",null,2);this.line([[-19,-21],[-10,-21]],"#d47f59",3);
    for(const x of [-16,15])this.circle(x,17,5,"#40564c");
    ctx.restore();
  },
  worldModal(game) {
    const state=game.worldOps,p=state.selected;if(!p){game.modal=null;return;}
    this.sheet(game,p.kind==="shop"?`${p.name} · 局内补给`:p.name,()=>{game.modal=null;state.selected=null;});
    this.text(`本局金币 ${game.gold} G`,1100,197,23,"#a27035","bold","right");
    if(p.kind==="shop"){
      const cards=[{key:"barrier",lines:["一次性道具 · 购买后自选位置","已开放道路上125范围减速70%","持续5秒 · 不影响民用车辆"]},
        {key:"repair",lines:["即刻修复全部存活队员78生命","公交、桥梁恢复26；解除封塔","没有受损目标时不会扣金币"]},
        {key:"helpers",lines:["派出3名二级应急队员，持续36秒","沿开放道路出勤，自动拦车作战","不占塔位；不可升级或出售"]}];
      cards.forEach((card,i)=>{
        const x=105+i*357,spec=WORLD_RULES[card.key];
        this.box(x,233,336,344,"#e9dfc6","#b9b492",15);this.worldIcon(card.key,x+168,291,60);
        this.text(spec.name,x+168,346,29,"#375b50","bold","center");
        card.lines.forEach((line,j)=>this.worldText(line,x+22,391+j*30,292,18));
        this.text(`本局余量 ${state.stock[card.key]}`,x+168,489,17,"#8b8266","normal","center");
        this.button(game,{x:x+22,y:514,w:292,h:47},`购买 ${spec.name} · ${spec.cost}G`,()=>{WorldOps.buy(game,card.key);state.feedback=game.message;},{primary:true,disabled:!state.stock[card.key]||game.gold<spec.cost,size:20});
      });
      this.text(`工具袋：路障包 ×${state.inventory.barrier} · 商店购买与所有物资仅对本局有效`,106,620,19,"#6c7569");
      this.worldText(state.feedback||"关闭面板后继续战斗；援军和增益的剩余时间在暂停时保持不变。",106,650,1050,17,state.feedback?"#376e68":"#827a64");return;
    }
    const descriptions={cache:["8秒采集，完成后获得65G","120范围内出现敌车时暂停采集","清理车流后自动继续；本局限采一次"],
      relay:["通信中继：45G / 冷却42秒","220范围内已有塔与队员攻速提高30%，持续12秒","与技能超频取较强效果，不叠加；没有塔时不扣钱"],
      mechanism:[`${p.name}：40G / 冷却35秒`,WORLD_THEMES[game.level.theme].note,"作用于邻近已开放路段，范围150，持续8秒"],
      challenge:["可选悬赏：额外一组4辆车；3秒出车预告","35秒内全部击毁，额外获得100G","未完成不给额外奖励；漏车仍扣生命","不占用正常波次，建议防线成型后再接受"]};
    this.box(106,232,300,340,"#dce1c7","#a1b394",17);this.worldIcon(p.kind,256,355,105);
    this.text(p.kind==="challenge"?"风险 / 回报":"场景互动",256,481,24,"#446a5c","bold","center");
    const rows=descriptions[p.kind]||[];rows.forEach((line,i)=>this.worldText(line,447,278+i*53,710,20,i===0?"#365b50":"#727565",i===0?"bold":"normal"));
    let label={cache:"开始采集 · 免费",relay:"启用中继 · 45G",mechanism:"启动机关 · 40G",challenge:"接受悬赏 · 额外4辆"}[p.kind];
    if(p.used)label=p.kind==="challenge"?({warning:"敌军出车预告中",active:"悬赏进行中",won:"悬赏已完成",lost:"悬赏已结束"}[state.challenge?.phase]||"已接受"):state.cache?"采集中":"本局已采集";
    if(p.cooldown>0)label=`冷却 ${Math.ceil(p.cooldown)} 秒`;
    if(p.kind==="challenge"&&game.wave===0)label="第1波开始后可接受";
    const cost=WORLD_RULES[p.kind]?.cost||0;
    this.button(game,{x:447,y:532,w:710,h:57},label,()=>{if(!WorldOps.activate(game))state.feedback=game.message;},{primary:true,disabled:p.used||p.cooldown>0||game.gold<cost||p.kind==="challenge"&&game.wave===0,size:24});
    this.worldText(state.feedback||"这是一项可选行动。关闭面板后，主线战斗继续。",448,630,710,19,state.feedback?"#376e68":"#827a64");
  },
  modal(game) {if(["worldShop","worldPoint"].includes(game.modal))this.worldModal(game);else WorldView.modal.call(this,game);},
  draw(game) {
    WorldView.draw.call(this,game);
    if(game.screen!=="battle"||game.modal||!game.worldOps)return;
    const l=MobileLayout.measure(),s=game.worldOps;
    if(s.inventory.barrier)this.button(game,{x:l.left+10,y:l.footer-44,w:174,h:34},`路障包 ×${s.inventory.barrier}`,()=>WorldOps.selectItem(game),{active:game.item==="barrier",size:19});
    const task=s.challenge;
    if(task&&["warning","active"].includes(task.phase)){
      this.box(l.right-340,l.footer-40,324,28,"#f1dfb5ed","#c19660",7);
      this.text(task.phase==="warning"?`悬赏车组 · ${Math.ceil(task.remaining)}秒后出发`:`悬赏 · 剩${Math.ceil(task.remaining)}秒 / ${task.units.filter(e=>!e.dead).length}辆`,l.right-178,l.footer-26,17,"#8c663c","bold","center");
    }
  }
});
