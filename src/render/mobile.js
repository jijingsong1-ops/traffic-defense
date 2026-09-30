"use strict";

// 沿用手机版的 16:9 战场；网页版也加载本文件，保证地图和射程完全一致。
// 只在启动时变换地图坐标，窗口缩放交给布局镜头，不拉伸车辆和炮台。
const sourceMap = {...MAP};
CONFIG.height = 720;
Object.assign(MAP, {x:24, y:96, w:1232, h:510});
const mobilePoint = ([x,y]) => [
  Math.round(MAP.x+(x-sourceMap.x)/sourceMap.w*MAP.w),
  Math.round(MAP.y+(y-sourceMap.y)/sourceMap.h*MAP.h)
];
for (const level of LEVELS) {
  level.routes = level.routes.map(route=>route.map(mobilePoint));
  if(level.routeEvent) level.routeEvent.routes = level.routeEvent.routes.map(route=>route.map(mobilePoint));
  level.sites = planConstructionSites(level);
}

Object.assign(Renderer, {
  // 首页、选关与战场分别布局；不复用桌面端的常驻信息侧栏。
  audioButtons(game,x,y) {
    this.button(game,{x,y,w:138,h:56},`音乐 ${Sound.musicEnabled?"开":"关"}`,()=>Sound.toggle("music"),{size:21});
    this.button(game,{x:x+150,y,w:138,h:56},`音效 ${Sound.enabled?"开":"关"}`,()=>Sound.toggle("effects"),{size:21});
  },
  levelModal(game) {
    const index=game.menuLevel,level=LEVELS[index],chapter=CHAPTERS[level.chapter],locked=index>game.unlocked;
    this.sheet(game,`${stageLabel(index)} · ${level.name}`,()=>{game.modal=null;});
    const preview={x:105,y:182,w:520,h:302},reservedRoad=new RoadNetwork(level,true);
    this.box(preview.x,preview.y,preview.w,preview.h,chapter.terrain,"#8caa91",14);
    ctx.save();ctx.beginPath();ctx.roundRect(preview.x,preview.y,preview.w,preview.h,14);ctx.clip();
    ctx.translate(preview.x,preview.y);ctx.scale(preview.w/MAP.w,preview.h/MAP.h);ctx.translate(-MAP.x,-MAP.y);
    AtlasArt.scenery(MAP,chapter.theme,level.stage,p=>reservedRoad.isRoad(p,55));
    if(level.routeEvent)for(const [a,b] of new RoadNetwork({routes:level.routeEvent.routes}).edges)this.line([[a.x,a.y],[b.x,b.y]],"#ffe8a9",6,[10,12]);
    this.road(new RoadNetwork(level),true,chapter);
    for(const route of level.routes){const a=route[0],b=route.at(-1);this.circle(...a,15,"#e49867");this.circle(...b,15,"#daebae");}
    ctx.restore();
    this.text(`${level.layout} · ${level.waves} 波 · ${level.gold} G`,106,513,22,COLORS.gold,"bold");
    this.text(`${Traffic.mission(level).name}${level.boss?` · ${ENEMIES[level.bossType].name}`:""}`,106,547,20,COLORS.ink);
    this.text(level.routeEvent?`第 ${level.routeEvent.wave} 波：${level.routeEvent.name}`:"橙色入口 → 绿色终点",106,579,20,COLORS.muted);
    this.text("出战塔组",672,193,26,COLORS.ink,"bold");
    game.getDeck().forEach((type,i)=>{
      const spec=TOWERS[type],x=674+i*117;
      this.box(x,232,106,126,"#d3c69e",spec.color,12);
      // 图示和名称拥有独立区域，设施底部的等级牌不能压住名称。
      ctx.save();ctx.translate(x+53,283);ctx.scale(.82,.82);this.tower({type,theme:level.theme,x:0,y:0,level:1,branch:null});ctx.restore();
      this.text(spec.name,x+53,338,19,spec.color,"bold","center");
    });
    this.text(`最好成绩  ${"★".repeat(game.progress.stars[index])+"☆".repeat(3-game.progress.stars[index])}`,672,399,23,COLORS.gold,"bold");
    this.text(Traffic.mission(level).brief,672,437,17,COLORS.muted);
    this.button(game,{x:672,y:476,w:222,h:61},"进化研究",()=>{game.modal="loadout";game.libraryChapter=level.chapter;},{size:23});
    this.button(game,{x:906,y:476,w:222,h:61},"敌情档案",()=>{game.modal="intel";game.intelChapter=level.chapter;},{size:23});
    this.button(game,{x:672,y:555,w:456,h:76},locked?`通关 ${stageLabel(index-1)} 后解锁`:"开始战斗",()=>game.startLevel(index),{primary:!locked,disabled:locked,color:COLORS.gold,size:29});
  },
  sheet(game,title,close) {
    this.box(70,72,1140,598,"#eddfb9","#957b53",22);
    this.text(title,105,122,32,COLORS.ink,"bold");
    this.button(game,{x:1090,y:96,w:84,h:60},"关闭",close,{size:23});
    this.line([[104,162],[1174,162]],"#a79165",2);
  },
  cityScenery(game) {
    const chapter=CHAPTERS[game.level.chapter];
    this.routeLayers(game);this.road(game.road,false,chapter);
    for(const route of game.road.routes){
      const entry=route[0],end=route.at(-1);
      this.circle(entry.x,entry.y,16,"#ac684c");this.text("»",entry.x,entry.y,24,"#fff3c8","bold","center");
      this.circle(end.x,end.y,19,"#4d765f");this.flag(end.x,end.y,"#f5dd99");
    }
  },
  field(game) {
    this.fieldWorld(game);
    if(game.level.routeEvent){
      const event=game.level.routeEvent;
      this.box(330,104,620,31,"#e8d4a8ed",null,8);
      this.text(Traffic.eventText(game),640,119,17,"#735638","bold","center");
    }
    if(game.paused){this.box(444,554,392,38,"#ecd9aded",COLORS.gold,10);this.text("已暂停 · 可布塔升级",640,573,22,COLORS.gold,"bold","center");}
    const boss=game.enemies.find(e=>!e.dead&&e.spec.boss);
    if(boss){this.box(406,143,468,34,"#d2bb93ed",null,8);this.text(boss.spec.name,420,160,18,COLORS.red,"bold");this.box(565,155,293,10,"#6c564a",null,4);this.box(565,155,293*Math.max(0,boss.health/boss.maxHealth),10,COLORS.red,null,4);}
  },
  waveButton(game) {
    const final=game.wave>=game.level.waves,ready=game.canStartWave();
    const rect={x:872,y:623,w:384,h:85};
    this.button(game,rect,"",()=>game.startWave(),{primary:ready,color:COLORS.gold,disabled:!ready});
    const x=919,y=665,r=29,seconds=Math.max(0,Math.ceil(game.prepareTime));
    this.circle(x,y,r+4,ready?"#6b634b":"#74694f");
    ctx.beginPath();ctx.arc(x,y,r,-Math.PI/2,-Math.PI/2+Math.PI*2*(final?1:Math.max(0,Math.min(1,1-game.prepareTime/game.waveDuration))));
    ctx.strokeStyle=COLORS.gold;ctx.lineWidth=5;ctx.stroke();
    this.text(final?"✓":game.spawnQueue.length?"…":`${seconds}`,x,y,24,"#fff1cb","bold","center");
    this.text(final?"最终波 · 完成交通任务":`${game.wave?"提前发动":"开始"}第 ${game.wave+1} 波`,1096,650,23,ready?"#193c3c":COLORS.ink,"bold","center");
    const tip=final?`场上 ${game.enemies.length} · 待出发 ${game.spawnQueue.length}`:game.paused?"暂停中":ready?`提前 ${seconds} 秒 · 奖励 +${game.earlyWaveReward} G`:`本波待出场 ${game.spawnQueue.length} · 出完后计时`;
    this.text(tip,1096,681,16,ready?"#365950":COLORS.muted,"normal","center");
  },
  modal(game) {
    if(game.modal==="saveSlots"){
      this.sheet(game,game.saveMode==="new"?"开始游戏 · 选择存档位":"读取存档 · 选择一段远征",()=>{game.modal=null;});
      Progress.list().forEach((slot,i)=>{
        const x=106,y=186+i*144,w=1068,h=127,empty=!slot,loading=game.saveMode==="load";
        this.box(x,y,w,h,empty?"#e5d5af":"#dbc89d",COLORS.border,12);
        this.text(`存档 ${i+1}`,x+22,y+31,25,COLORS.ink,"bold");
        this.text(empty?"空存档位":Progress.dateLabel(slot.createdAt),x+165,y+31,24,COLORS.ink,"bold");
        if(slot){
          const completed=slot.stars.filter(Boolean).length,index=Progress.unlocked(slot);
          this.text(`进度 ${completed} / 48 关 · ★ ${slot.stars.reduce((a,b)=>a+b,0)} / 144`,x+165,y+72,23,COLORS.gold,"bold");
          this.text(completed===48?"六章远征已完成":`${CHAPTERS[LEVELS[index].chapter].name} · 待挑战 ${stageLabel(index)} ${LEVELS[index].name}`,x+165,y+103,19,COLORS.muted);
        }else this.text(loading?"尚未建立战役":"从第一章开始，首次建立日期将自动记录",x+165,y+79,21,COLORS.muted);
        this.button(game,{x:x+w-208,y:y+32,w:185,h:67},loading?"读取":empty?"新建":"重新开始",()=>game.chooseSaveSlot(i),{disabled:loading&&empty,primary:!empty||!loading,size:25});
      });
      this.text("最多三个独立存档 · 通关自动保存 · 日期为首次建立时间",640,643,19,COLORS.muted,"normal","center");
      return;
    }
    if(game.modal==="level"){this.levelModal(game);return;}
    if(game.modal==="loadout"||game.modal==="intel"){
      const research=game.modal==="loadout",chapter=CHAPTERS[research?(game.libraryChapter??game.menuChapter):(game.intelChapter??game.menuChapter)];
      this.sheet(game,research?`${chapter.name} · 进化研究`:`${chapter.name} · 敌情档案`,()=>{game.modal=game.screen==="menu"?"level":null;});
      if(research)TOWER_ORDER.forEach((type,i)=>{
        const x=106+i*265,spec=TOWERS[type];this.box(x,187,251,446,"#dbcca5",COLORS.border,12);
        this.text(spec.name,x+125,215,25,spec.color,"bold","center");
        pathsFor(type,chapter.theme).forEach((p,b)=>{
          const y=277+b*170;ctx.save();ctx.translate(x+44,y+30);ctx.scale(.9,.9);this.tower({type,theme:chapter.theme,x:0,y:0,level:4,branch:b});ctx.restore();
          this.text(p.name,x+86,y+12,21,spec.color,"bold");
          const unlocked=game.branchUnlocked(type,chapter.theme,b);
          if(!unlocked)AtlasArt.chain({x:x+8,y:y+34,w:235,h:56});
          this.text(unlocked?"已解锁":`通关 ${evolutionRequirement(type,chapter.theme,b)} 关解锁`,x+125,y+108,18,COLORS.gold,"bold","center");
          (p.note.match(/.{1,12}/g)||[]).slice(0,2).forEach((line,n)=>this.text(line,x+17,y+135+n*21,16,COLORS.muted));
        });
      });
      else [...chapter.pool,chapter.boss].forEach((type,i)=>{
        const x=106+(i%3)*359,y=191+Math.floor(i/3)*214,spec=ENEMIES[type];this.box(x,y,340,196,"#dfcea5",COLORS.border,12);
        this.vehicle(type,x+48,y+49);this.text(spec.name,x+92,y+36,23,spec.color,"bold");this.text(`基础 HP ${Math.round(spec.hp*(spec.boss?CONFIG.bossHealthMultiplier:CONFIG.enemyHealthMultiplier))} · 速度 ${spec.speed}`,x+92,y+68,16,COLORS.muted);
        (spec.note.match(/.{1,16}/g)||[]).slice(0,2).forEach((line,n)=>this.text(line,x+18,y+112+n*25,18,COLORS.ink));
        this.text(spec.counter,x+18,y+172,16,COLORS.gold);
      });return;
    }
    if(game.modal==="battleMenu"){
      this.sheet(game,"战斗已暂停",()=>{game.modal=null;});
      [ ["继续战斗",()=>{game.modal=null;}],["重新挑战",()=>{game.modal="restart";}],["返回章节地图",()=>{game.modal="leave";}],["敌情档案",()=>{game.intelChapter=game.level.chapter;game.modal="intel";}] ].forEach(([label,action],i)=>this.button(game,{x:390,y:187+i*87,w:500,h:73},label,action,{primary:i===0,size:28}));this.audioButtons(game,496,552);return;
    }
    const fresh=game.modal==="newCampaign",restart=game.modal==="restart";
    this.box(268,190,744,340,"#eedfbb","#9a835a",22);
    this.text(fresh?"开启新的战役？":restart?"重新挑战本关？":"返回章节地图？",640,250,32,COLORS.ink,"bold","center");
    this.text(fresh?`只覆盖存档 ${game.pendingSlot+1}，其他存档保持不变。`:"本局部署不保留，已通关的成绩仍会保存。",640,320,23,COLORS.muted,"normal","center");
    this.button(game,{x:312,y:398,w:302,h:82},"取消",()=>{game.modal=fresh?"saveSlots":null;},{size:28});
    this.button(game,{x:642,y:398,w:326,h:82},fresh?"开始新战役":"确认",()=>{
      if(fresh)game.newCampaign(true);else if(restart)game.startLevel(game.levelIndex);else{game.screen="menu";game.modal=null;game.cancel();}
    },{primary:true,color:COLORS.gold,size:28});
  },
  result(game) {
    this.box(298,133,684,454,"#eedfbb",game.won?COLORS.mint:COLORS.red,24);
    this.text(game.won?"防线守住了！":"防线失守",640,211,42,game.won?COLORS.mint:COLORS.red,"bold","center");
    this.text("★".repeat(game.earnedStars)+"☆".repeat(3-game.earnedStars),640,287,62,COLORS.gold,"bold","center");
    this.text(game.saveFailed?"保存失败 · 请检查微信存储空间":game.won?"交通任务完成 · 战绩已保存":game.failureReason||"调整部署，再试一次",640,358,23,COLORS.muted,"normal","center");
    this.button(game,{x:345,y:435,w:285,h:85},"重新挑战",()=>game.startLevel(game.levelIndex),{size:28});
    this.button(game,{x:652,y:435,w:285,h:85},"章节地图",()=>{game.screen="menu";game.menuLevel=game.unlocked;game.menuChapter=LEVELS[game.menuLevel].chapter;},{primary:true,color:COLORS.gold,size:28});
  },
  touchPanel(game,title,height=352) {
    const rect={x:380,y:156,w:520,h:height};
    this.box(rect.x,rect.y,rect.w,rect.h,"#ecdcb4fa",COLORS.gold,14);
    game.buttons.push({...rect,action:()=>{}});
    this.text(title,rect.x+22,rect.y+35,24,COLORS.ink,"bold");
    this.button(game,{x:rect.x+442,y:rect.y+10,w:62,h:52},"关闭",()=>game.cancel(),{size:18});
    return rect;
  },
  buildPopup(game) {
    game.buildPopupRect=null;
    if(!game.selectedSite||game.screen!=="battle")return;
    const rect=this.touchPanel(game,`地块 ${game.selectedSite.id+1} · 建造炮台`,290);
    game.buildPopupRect=rect;
    game.loadout.forEach((type,i)=>{
      const spec=TOWERS[type],x=rect.x+16+i*125,y=rect.y+87,afford=game.gold>=spec.cost;
      this.button(game,{x,y,w:113,h:140},"",()=>game.selectBuild(type),{disabled:!afford,towerType:type});
      ctx.save();ctx.translate(x+56,y+54);ctx.scale(.9,.9);this.tower({type,theme:game.level.theme,x:0,y:0,level:1,branch:null});ctx.restore();
      this.text(spec.name,x+56,y+93,19,spec.color,"bold","center");this.text(`${spec.cost} G`,x+56,y+120,18,afford?COLORS.gold:COLORS.muted,"bold","center");
    });
    this.text("轻触炮台卡片建造 · 金币不足时按钮变暗",rect.x+260,rect.y+260,17,COLORS.muted,"normal","center");
  },
  towerPopup(game) {
    game.towerPopupRect=null;const t=game.selected;
    if(!t||game.screen!=="battle"||game.rallyTower)return;
    const rect=this.touchPanel(game,`${t.name} · L${t.level}`,392),x=rect.x,y=rect.y;
    game.towerPopupRect=rect;
    this.text(`伤害 ${Math.round(t.stats.damage)} · 射程 ${t.stats.range}`,x+22,y+87,19,COLORS.muted);
    if(t.level===2){
      t.paths.forEach((path,i)=>{
        const bx=x+16+i*252,unlocked=game.branchUnlocked(t.type,t.theme,i),afford=game.gold>=path.cost;
        this.button(game,{x:bx,y:y+116,w:236,h:167},"",()=>game.upgrade(i),{disabled:!unlocked||!afford,locked:!unlocked,branch:i});
        this.text(path.name,bx+118,y+146,23,t.spec.color,"bold","center");
        if(unlocked){
          this.text(`${path.cost} G`,bx+118,y+180,21,COLORS.gold,"bold","center");
          (path.note.match(/.{1,12}/g)||[]).slice(0,3).forEach((line,j)=>this.text(line,bx+118,y+216+j*23,16,COLORS.muted,"normal","center"));
        }else{
          AtlasArt.chain({x:bx+8,y:y+162,w:220,h:61});
          this.text(`通关 ${evolutionRequirement(t.type,t.theme,i)} 关解锁`,bx+118,y+246,19,COLORS.ink,"bold","center");
          this.text(`当前已通关 ${game.completed} 关`,bx+118,y+270,16,COLORS.muted,"normal","center");
        }
      });
    }else{
      const max=t.level===4;
      this.button(game,{x:x+16,y:y+129,w:488,h:78},max?"已达最高等级":`强化 → L${t.level+1} · ${t.upgradeCost} G`,()=>game.upgrade(),{primary:!max,disabled:max||game.gold<t.upgradeCost,size:25});
      const note=t.branch===null?"强化到二级后选择进化方向":t.paths[t.branch].note;
      this.text(note,x+260,y+246,19,COLORS.gold,"normal","center");
    }
    this.button(game,{x:x+16,y:y+310,w:236,h:62},t.type==="depot"?"设置集合点":TARGET_MODES[t.targetMode],()=>{
      if(t.type==="depot"){game.rallyTower=t;game.notify("轻触射程内道路，调动队员。");}else t.targetMode=(t.targetMode+1)%3;
    },{size:20});
    this.button(game,{x:x+268,y:y+310,w:236,h:62},`出售 +${t.sellValue} G`,()=>game.sell(),{color:COLORS.gold,size:20});
  }
});
