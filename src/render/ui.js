"use strict";

// 网页视觉层。所有 UI 共用纸张、油墨和交通标识；只改变绘制与反馈，不改变战斗时钟。
const UiTheme = {
  palette:{ink:"#29484b",muted:"#798578",paper:"#f3ecd7",paperDark:"#e2d7b8",teal:"#376e68",orange:"#ba7247",line:"#a9ad94",white:"#fff9e8"},
  briefPlans:new WeakMap(),
  briefPoints(level,road,buildRoad) {
    if(!this.briefPlans.has(level)){
      const sites=level.sites.map(([x,y])=>({x,y}));
      this.briefPlans.set(level,WorldOps.plan({level,road,buildRoad,sites}));
    }
    return this.briefPlans.get(level);
  },
  card(rect,{fill="#f4ecd7",border="#a4a78c",accent=null,shadow=true,radius=12,texture=false}={}) {
    const {x,y,w,h}=rect,R=Renderer;
    if(shadow){R.box(x+1,y+5,w,h,"#29484b16",null,radius);R.box(x+1,y+2,w,h,"#29484b0a",null,radius);}
    R.box(x,y,w,h,fill,border,radius);
    R.line([[x+radius,y+3],[x+w-radius,y+3]],"#fff9e875",1.2);
    if(accent)R.box(x+1,y+radius,4,h-radius*2,accent,null,2);
    if(texture){
      ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.clip();
      for(let n=0;n<Math.min(110,w*h/1600);n++)R.line([[x+(n*137)%w,y+(n*71)%h],[x+(n*137)%w+4,y+(n*71)%h]],"#817a5c0d",1);
      ctx.restore();
    }
  },
  caption(label,x,y,color="#798578") {Renderer.text(label,x,y,13,color,"bold");},
  icon(kind,x,y,size=24,color="#376e68") {
    const R=Renderer;ctx.save();ctx.translate(x,y);ctx.scale(size/24,size/24);
    const line=(p,w=2)=>R.line(p,color,w),box=(x,y,w,h)=>R.box(x,y,w,h,"#fff9e800",color,2);
    if(kind==="shop") {box(-9,-3,18,13);R.polygon([[-11,-3],[-8,-11],[8,-11],[11,-3]],"#e5b282",color);for(const dx of [-6,0,6])line([[dx,-10],[dx,-3]],1.5);box(-5,2,6,8);line([[4,2],[7,2]],2);}
    else if(kind==="cache"){box(-10,-6,20,15);line([[-10,-1],[10,-1]],1.5);line([[-4,-6],[-4,9]],1.5);line([[4,-6],[4,9]],1.5);line([[-4,-10],[4,-10],[5,-7]],2);}
    else if(kind==="relay"||kind==="signal"){line([[0,9],[0,-7]],3);R.circle(0,-8,3,color);for(const side of [-1,1]){line([[side*6,-12],[side*9,-8],[side*6,-4]],1.5);line([[side*10,-15],[side*14,-8],[side*10,-1]],1.4);}line([[-7,10],[7,10]],2);}
    else if(kind==="roadworks"||kind==="barrier"){box(-11,-5,22,7);for(const dx of [-7,1,9])line([[dx-3,-5],[dx+2,2]],2);line([[-7,2],[-7,10]],2);line([[7,2],[7,10]],2);}
    else if(kind==="contract"){box(-8,-11,16,22);line([[-4,-5],[4,-5]],1.5);line([[-4,0],[4,0]],1.5);line([[-4,5],[-1,7],[4,3]],1.8);}
    else if(kind==="coin"){R.circle(0,0,10,"#d0a65f");R.circle(0,0,7,"#efd7a0");line([[0,-5],[0,5]],2);line([[-3,-3],[3,-3]],1.6);line([[-3,3],[3,3]],1.6);}
    else if(kind==="heart"){R.polygon([[0,9],[-10,0],[-9,-7],[-4,-10],[0,-6],[4,-10],[9,-7],[10,0]],color);R.line([[-7,-5],[-5,-7],[-2,-5]],"#fff2dc88",1.5);}
    else if(kind==="wave"){for(const yy of [-7,0,7])line([[-10,yy],[-4,yy],[0,yy-3],[4,yy],[10,yy]],1.8);}
    else if(kind==="rail"){line([[-10,8],[10,8]],3);line([[-6,7],[-4,-2],[5,-2]],3);box(-8,-7,15,7);line([[5,-5],[13,-5]],3);}
    else if(kind==="missile"){line([[-11,9],[11,9]],3);line([[-6,7],[-6,-8],[8,-8],[8,-1]],3);R.circle(7,3,4,"#e6bd7f");line([[7,-1],[7,4]],2);}
    else if(kind==="depot"){R.polygon([[-10,-1],[0,-10],[10,-1]],"#e5b282",color);box(-8,-1,16,12);box(-3,4,6,7);}
    else if(kind==="strike"||kind==="fire"){R.polygon([[-3,-12],[8,-12],[2,-2],[10,-2],[-6,13],[-2,2],[-10,2]],color);}
    else if(kind==="freeze"){for(let n=0;n<3;n++){ctx.save();ctx.rotate(n*Math.PI/3);line([[-10,0],[10,0]],2);ctx.restore();}R.circle(0,0,3,"#c3d6d4");}
    else if(kind==="repair"){line([[-9,0],[9,0]],6);line([[0,-9],[0,9]],6);}
    else if(kind==="overdrive"){line([[-10,-9],[0,0],[-10,9]],3);line([[0,-9],[10,0],[0,9]],3);}
    else if(kind==="emp"){R.circle(0,0,7,"#cad7cf");R.circle(0,0,3,color);for(let n=0;n<4;n++){ctx.save();ctx.rotate(n*Math.PI/2);line([[0,-11],[0,-14]],2);ctx.restore();}}
    else {R.circle(0,0,8,"#e4d9bb");line([[-4,0],[4,0]],2);line([[0,-4],[0,4]],2);}
    ctx.restore();
  },
  // 绘制由确定种子驱动，不让纸纹和笔触在每帧跳动。
  hatch(rect,color="#526e5c14",spacing=12) {
    ctx.save();ctx.beginPath();ctx.rect(rect.x,rect.y,rect.w,rect.h);ctx.clip();
    for(let d=-rect.h;d<rect.w;d+=spacing)Renderer.line([[rect.x+d,rect.y+rect.h],[rect.x+d+rect.h,rect.y]],color,1);
    ctx.restore();
  }
};

Object.assign(COLORS,{bg:"#e1d9bb",panel:"#f3ecd7",ink:UiTheme.palette.ink,muted:"#717967",mint:UiTheme.palette.teal,gold:"#9a602f",red:"#a35342",border:UiTheme.palette.line});
Object.assign(AtlasArt.palettes,{city:"#dce1c9",country:"#dce1bc",desert:"#ead3aa",hills:"#d1d9c7",sea:"#b9d3ce",forest:"#c5d6b8"});
const UiPrevious={draw:Renderer.draw,modal:Renderer.modal,box:Renderer.box,
  paper:AtlasArt.paper,landmark:AtlasArt.landmark,handleTap:Platform.handleTap,frame:MobileLayout.frame};

// 按下点与悬停点使用同一套面板坐标变换，缩放窗口后按压反馈仍落在正确卡片上。
MobileLayout.frame=function(game,source,target,draw,maxScale=1.25){
  const press=game.uiPress,scale=Math.min(maxScale,target.w/source.w,target.h/source.h);
  const x=target.x+(target.w-source.w*scale)/2-source.x*scale,y=target.y+(target.h-source.h*scale)/2-source.y*scale;
  if(press)game.uiPress={x:(press.x-x)/scale,y:(press.y-y)/scale};
  try{return UiPrevious.frame.call(this,game,source,target,draw,maxScale);}finally{game.uiPress=press;}
};

// 统一旧版图鉴和简报中大型信息卡材质；车辆、道路和战斗特效仍使用原来的精确尺寸。
Renderer.box=function(x,y,w,h,color,border=null,radius=10){
  const paperColors={"#e3d2aa":"#e6dfc9","#f3e6c5":"#faf3df","#e5d5af":"#e6e1cf","#dbc89d":"#ede4cd","#dbcca5":"#e7dfc6","#dfcea5":"#e7dfc6"};
  UiPrevious.box.call(this,x,y,w,h,paperColors[color]||color,border,radius);
};

Object.assign(Renderer,{
  button(game,rect,label,action,options={}) {
    const p=game.uiPointer||game.pointer,hover=Collision.inside(p,rect),disabled=!!options.disabled;
    const held=game.uiPress&&Collision.inside(game.uiPress,rect)&&hover&&!disabled;
    const primary=options.primary&&!disabled,active=options.active&&!disabled;
    const fill=disabled?"#d9d8c6":primary?held?"#284f4d":hover?"#467e72":"#376e68":active?"#dae5d3":hover?"#fff8e7":"#ede6d1";
    const border=disabled?"#b2b5a0":primary?"#29534f":active?"#487b70":hover?"#718b7d":"#a0a58c";
    const offset=held?2:0;
    this.box(rect.x,rect.y+(held?3:5),rect.w,rect.h,"#29484b18",null,8);
    this.box(rect.x,rect.y+offset,rect.w,rect.h,fill,border,8);
    this.line([[rect.x+10,rect.y+offset+4],[rect.x+rect.w-10,rect.y+offset+4]],primary?"#a8c6a448":"#fffdf1af",1.3);
    if(active)this.box(rect.x+4,rect.y+offset+9,3,rect.h-18,"#4f8070",null,1);
    // 细小交通反光钉取代粗重金属铆钉，减小装饰对信息的干扰。
    if(primary&&rect.w>140){this.circle(rect.x+11,rect.y+rect.h/2+offset,1.5,"#e9d8ad");this.circle(rect.x+rect.w-11,rect.y+rect.h/2+offset,1.5,"#e9d8ad");}
    const font=options.size||20,fit=Math.min(font,(rect.w-24)/Math.max(1,[...String(label)].reduce((n,c)=>n+(/[\x00-\x7F]/.test(c)?.54:1),0)));
    this.text(label,rect.x+rect.w/2,rect.y+rect.h/2+offset,fit,disabled?"#828b7b":primary?"#fff4dc":COLORS.ink,"bold","center");
    game.buttons.push({...rect,label,action,disabled,locked:!!options.locked,branch:options.branch,towerType:options.towerType,routeIndex:options.routeIndex});
  },
  sheet(game,title,close) {
    UiTheme.card({x:70,y:72,w:1140,h:598},{fill:"#f3ecd7",border:"#899b88",texture:true,radius:15});
    this.box(71,73,1138,91,"#e1e6d2",null,14);
    this.box(71,145,1138,18,"#e1e6d2",null,0);
    this.box(88,101,5,38,"#4e7c6b",null,2);
    this.text(title,107,121,31,COLORS.ink,"bold");
    this.line([[105,162],[1174,162]],"#a2b19a",1.3);
    this.button(game,{x:1090,y:96,w:84,h:55},"关闭",close,{size:21});
  },
  levelModal(game) {
    const index=game.menuLevel,level=LEVELS[index],chapter=CHAPTERS[level.chapter],locked=index>game.unlocked;
    const entries=Encounters.entrances(level),entry=game.intelEntry??null,roster=Encounters.roster(level,entry);
    this.sheet(game,`${stageLabel(index)} · ${level.name}`,()=>{game.modal=null;});
    this.button(game,{x:105,y:176,w:120,h:40},"全关敌情",()=>{game.intelEntry=null;game.intelPage=0;},{active:entry===null,size:20});
    entries.forEach((e,i)=>this.button(game,{x:237+i*145,y:176,w:135,h:40},`${String.fromCharCode(65+i)} · ${ENEMY_PROFILES[e.profile].name}`,()=>{game.intelEntry=i;game.intelPage=0;},{active:entry===i,size:17}));
    this.text(`主队 ${roster.total} 辆 / ${roster.groups} 组`,1160,197,20,COLORS.gold,"bold","right");
    const preview={x:105,y:234,w:510,h:240},reservedRoad=new RoadNetwork(level,true),road=new RoadNetwork(level);
    this.box(preview.x,preview.y,preview.w,preview.h,chapter.terrain,"#8caa91",12);
    ctx.save();ctx.beginPath();ctx.roundRect(preview.x,preview.y,preview.w,preview.h,12);ctx.clip();
    ctx.translate(preview.x,preview.y);ctx.scale(preview.w/MAP.w,preview.h/MAP.h);ctx.translate(-MAP.x,-MAP.y);
    AtlasArt.scenery(MAP,chapter.theme,level.stage,p=>reservedRoad.isRoad(p,55));
    if(level.routeEvent)for(const [a,b] of new RoadNetwork({routes:level.routeEvent.routes}).edges)this.line([[a.x,a.y],[b.x,b.y]],"#ffe8a9",6,[10,12]);
    this.road(road,true,chapter);
    for(const route of level.routes)this.circle(...route.at(-1),17,"#daebae");
    for(const [x,y] of level.sites){this.circle(x,y,8,"#f7efd0");this.circle(x,y,3,"#476d5e");}
    entries.forEach(e=>{this.circle(...e.point,24,entry===null||entry===e.id?"#b36945":"#aca38d");this.text(String.fromCharCode(65+e.id),e.point[0],e.point[1],28,"#fff4d3","bold","center");});
    ctx.restore();
    const routeNote=level.routeEvent?`第${level.routeEvent.wave}波 · ${level.routeEvent.name}`:level.layout;
    this.box(117,442,486,24,"#f4efd9ed",null,4);this.text(`${routeNote} · 浅色圆点为固定阵地`,128,454,13,COLORS.muted);
    this.text(`${level.waves} 波 · ${level.gold}G · 四车道 · ${entries.length} 个出车口`,106,499,21,COLORS.gold,"bold");
    this.text(entry===null?Traffic.mission(level).brief:`${entries[entry].name}：${ENEMY_PROFILES[entries[entry].profile].tip}`,106,529,18,COLORS.ink);
    // 从实际布点器读取本关互动类型，避免简报承诺地图中并不存在的设施。
    const points=UiTheme.briefPoints(level,road,reservedRoad);
    const labels={shop:"商店",cache:"采集",relay:"中继",mechanism:"机关",challenge:"悬赏自选"};
    this.text(`${level.sites.length}处固定阵地 · ${points.map(p=>labels[p.kind]).join(" / ")}`,106,557,15,COLORS.mint,"bold");
    const counts={...roster.counts};if(roster.ambush)counts.raider=(counts.raider||0)+roster.ambush;
    const keys=[...new Set([...Object.keys(counts),...Object.keys(roster.splits)])],pages=Math.ceil(keys.length/8);
    game.intelPage=Math.min(game.intelPage||0,pages-1);
    keys.slice(game.intelPage*8,game.intelPage*8+8).forEach((key,i)=>{
      const x=640+i%2*270,y=234+Math.floor(i/2)*65,spec=ENEMIES[key];
      this.box(x,y,258,57,"#e3d2aa",COLORS.border,6);this.vehicle(key,x+25,y+28);
      this.text(spec.name,x+48,y+18,18,COLORS.ink,"bold");
      const suffix=roster.splits[key]?` +${roster.splits[key]}分裂`:"";
      this.text(`${counts[key]||0} 辆${key==='raider'&&roster.ambush?'（伏击）':suffix} · 甲${Math.round((spec.armor||0)*100)}% / 抗${Math.round((spec.magicResist||0)*100)}%`,x+48,y+42,14,COLORS.muted);
    });
    this.text(roster.ambush?"另有站点伏击8辆；分裂为增援上限":"分裂数量为全部击破的增援上限",642,510,15,COLORS.muted);
    this.button(game,{x:982,y:496,w:55,h:34},"‹",()=>game.intelPage--,{disabled:game.intelPage===0,size:20});
    this.text(`${game.intelPage+1}/${pages}`,1065,513,17,COLORS.muted,"normal","center");
    this.button(game,{x:1100,y:496,w:65,h:34},"›",()=>game.intelPage++,{disabled:game.intelPage===pages-1,size:20});
    this.button(game,{x:105,y:583,w:144,h:48},"炮塔图鉴",()=>game.openCodex("towers","level"),{size:21});
    this.button(game,{x:261,y:583,w:144,h:48},"怪物图鉴",()=>game.openCodex("enemies","level"),{size:21});
    this.button(game,{x:417,y:583,w:144,h:48},"出战技能",()=>game.openCodex("skills","level"),{size:21});
    this.text(game.progress.skills.loadout.map((key,i)=>`${i?"E":"Q"} ${SKILLS[key].name}`).join(" / "),106,652,16,COLORS.ink);
    this.button(game,{x:670,y:563,w:495,h:68},locked?`通关 ${stageLabel(index-1)} 后解锁`:"开始战斗",()=>game.startLevel(index),{primary:!locked,disabled:locked,size:29});
    this.text(`固定四塔出战 · 最好 ${"★".repeat(game.progress.stars[index])+"☆".repeat(3-game.progress.stars[index])}`,670,652,16,COLORS.muted);
  },
  home(game,l) {
    const split=l.left+(l.right-l.left)*.57,cy=(l.top+l.bottom)/2;
    AtlasArt.scenery({x:0,y:0,w:l.w,h:l.h},"city",3,p=>p.x>split-45||p.y>cy-220&&p.y<cy+40);
    const road=[[0,cy+205],[l.left+126,cy+205],[split-178,cy-6],[split-52,cy-6],[split+68,cy-120],[l.w,cy-120]];
    this.line(road,"#77887d",77);this.line(road,"#c8cbbb",69);this.line(road,"#7a8c87",57);this.line(road,"#ece8d0",2,[9,14]);
    const hx=l.left+44;
    UiTheme.card({x:hx-3,y:cy-266,w:238,h:31},{fill:"#e9efda",border:"#9cae94",shadow:false,radius:4});
    this.text("城市防卫计划  /  FIELD ATLAS",hx+12,cy-250,12,"#55796b","bold");
    this.text("路网守卫",hx,cy-170,74,"#304f4c","bold");
    this.text("调度车流，守住每一段旅程。",hx+3,cy-106,25,"#5c7766");
    this.line([[hx,cy-65],[hx+72,cy-65]],"#b77a4b",4);
    this.text("固定阵地  ·  道路机关  ·  车队攻防",hx+91,cy-65,17,"#74806a");
    ["rail","signal","missile","depot"].forEach((type,i)=>{
      const tx=hx+38+i*(split-hx-55)/4,ty=cy+128+(i%2)*39;
      this.oval(tx,ty+32,52,22,"#f1ead34d","#b0b79b");
      ctx.save();ctx.translate(tx,ty);ctx.scale(1.65,1.65);this.tower({type,theme:"city",x:0,y:0,level:3,branch:i%2,angle:-.7});ctx.restore();
    });
    const x=split+28,w=l.right-x-22,y=cy-240;
    UiTheme.card({x,y,w,h:479},{fill:"#f5efdcf5",border:"#9caf97",texture:true,radius:18});
    this.text("出发前的最后一站",x+30,y+40,14,"#6c8676","bold");
    this.text("指挥室",x+30,y+83,37,COLORS.ink,"bold");
    this.line([[x+30,y+116],[x+w-30,y+116]],"#b8c2a7",1);
    [["开始游戏",()=>game.newCampaign(),"建立新的交通防线"],["读取存档",()=>game.loadCampaign(),"继续尚未结束的旅程"],["退出游戏",()=>Platform.exitGame(),"存档会保留在此浏览器"]].forEach(([label,action,detail],i)=>{
      const by=y+141+i*94;
      this.button(game,{x:x+27,y:by,w:w-54,h:64},label,action,{primary:i===0,size:26});
      this.text(detail,x+w/2,by+79,13,"#7b8774","normal","center");
    });
    this.text(`本地存档 ${Progress.list().filter(Boolean).length} / 3 · 通关自动保存`,x+w/2,y+451,16,"#72816e","normal","center");
    this.audioButtons(game,l.left+10,l.bottom-62);
    this.fullscreenButton(game,{x:l.left+320,y:l.bottom-62,w:138,h:56});
    this.text(game.messageTime>0?game.message:`${CONFIG.version}  ·  空格暂停 / Q E 技能`,l.right-8,l.bottom-28,16,COLORS.muted,"normal","right");
  },
  menu(game,l) {
    const chapter=CHAPTERS[game.menuChapter],first=game.menuChapter*8;
    const map={x:l.left+70,y:l.top+157,w:l.right-l.left-140,h:l.footer-l.top-239};
    const nodes=chapter.nodes.map(([x,y])=>({x:map.x+(x-100)/700*map.w,y:map.y+(y-185)/445*map.h}));
    AtlasArt.scenery({x:0,y:0,w:l.w,h:l.h},chapter.theme,game.menuChapter,p=>p.y<l.top+130||p.y>l.footer-32||nodes.some(n=>Math.abs(n.x-p.x)<113&&p.y>n.y-91&&p.y<n.y+93));
    const trail=nodes.map(p=>[p.x,p.y]);this.line(trail,"#f5efd6c9",17);this.line(trail,"#a6b398",8);this.line(trail,"#f1e7c5",2,[5,10]);
    nodes.forEach((p,offset)=>{
      const index=first+offset,level=LEVELS[index],locked=index>game.unlocked,active=index===game.unlocked;
      if(active){this.oval(p.x,p.y+39,45,13,"#d9aa5f30");this.circle(p.x,p.y-1,49,"#e7bc5930");}
      AtlasArt.roadSign(p.x,p.y,locked?"·":`${game.menuChapter+1}-${offset+1}`,{locked,boss:level.boss,stars:game.progress.stars[index],active});
      UiTheme.card({x:p.x-81,y:p.y+43,w:162,h:27},{fill:locked?"#e1dfc5da":"#f5eed7f2",border:null,shadow:false,radius:5});
      this.text(level.name,p.x,p.y+57,18,locked?"#92917a":"#3a5b51","bold","center");
      game.buttons.push({x:p.x-85,y:p.y-51,w:170,h:125,levelIndex:index,label:`关卡 ${stageLabel(index)}`,action:()=>game.openLevel(index)});
    });
    UiTheme.card({x:l.left-5,y:l.top-3,w:l.right-l.left+10,h:106},{fill:"#f4eddbea",border:"#b0b89e",radius:11});
    this.button(game,{x:l.left+9,y:l.top+15,w:138,h:64},"‹ 首页",()=>{game.screen="home";game.modal=null;},{size:23});
    this.text(`CHAPTER 0${game.menuChapter+1}  /  ${chapter.city.split(" / ")[1]}`,(l.left+l.right)/2,l.top+23,13,"#7c8b76","bold","center");
    this.text(chapter.name,(l.left+l.right)/2,l.top+63,34,COLORS.ink,"bold","center");
    this.text(`★ ${game.progress.stars.slice(first,first+8).reduce((a,b)=>a+b,0)} / 24`,l.right-20,l.top+43,25,COLORS.gold,"bold","right");
    this.text("本章最高星级",l.right-20,l.top+74,13,COLORS.muted,"normal","right");
    this.box(0,l.footer,l.w,l.h-l.footer,"#f0ead5f5",null,0);this.line([[0,l.footer],[l.w,l.footer]],"#aab49a",1.5);
    this.button(game,{x:l.left,y:l.footer+16,w:187,h:70},"‹ 上一章",()=>game.selectChapter(game.menuChapter-1),{disabled:game.menuChapter===0,size:23});
    this.button(game,{x:l.right-187,y:l.footer+16,w:187,h:70},"下一章 ›",()=>game.selectChapter(game.menuChapter+1),{disabled:game.menuChapter===5,size:23});
    this.button(game,{x:l.w/2-181,y:l.footer+12,w:362,h:48},"作战图鉴 · 塔 / 车 / 技能",()=>game.openCodex(),{primary:true,size:22});
    CHAPTERS.forEach((c,i)=>{const x=l.w/2-80+i*32;this.box(x-8,l.footer+73,16,5,i===game.menuChapter?COLORS.mint:"#b6bfa8",null,2);});
  },
  header(game,l) {
    this.box(0,0,l.w,l.top+84,"#f5eedcf5",null,0);this.line([[0,l.top+84],[l.w,l.top+84]],"#a4b19a",1.5);
    [["heart",`${game.lives}`,"防线生命",COLORS.red,0],["coin",`${game.gold}`,"本局金币",COLORS.gold,142],["wave",`${game.wave} / ${game.level.waves}`,"当前波次",COLORS.mint,304]].forEach(([icon,value,label,color,dx])=>{
      UiTheme.icon(icon,l.left+18+dx,l.top+28,21,color);
      this.text(value,l.left+39+dx,l.top+28,29,color,"bold");
      this.text(label,l.left+dx+1,l.top+64,13,"#7d8776");
    });
    const x=l.headerRight-480;
    this.text(`${stageLabel(game.levelIndex)} · ${game.level.name}`,l.left+466,l.top+24,18,COLORS.ink,"bold");
    const status=Traffic.status(game);this.text(status.length>21?status.slice(0,20)+"…":status,l.left+466,l.top+58,15,COLORS.muted);
    this.button(game,{x,y:l.top+6,w:80,h:62},`×${game.speed}`,()=>{game.speed=game.speed%3+1;},{size:23});
    this.button(game,{x:x+91,y:l.top+6,w:100,h:62},game.paused?"继续":"暂停",()=>{game.paused=!game.paused;},{active:game.paused,size:22});
    this.button(game,{x:x+202,y:l.top+6,w:145,h:62},"战斗菜单",()=>{game.modal="battleMenu";},{size:21});
    this.fullscreenButton(game,{x:x+358,y:l.top+6,w:122,h:62});
  },
  toolbar(game,l) {
    this.box(0,l.footer,l.w,l.h-l.footer,"#f0e8d3fa",null,0);this.line([[0,l.footer],[l.w,l.footer]],"#aab49a",1.5);
    game.skillLoadout.forEach((type,i)=>{
      const spec=SKILLS[type],remaining=game.skillCooldowns[type],x=l.left+i*192,y=l.footer+15;
      this.button(game,{x,y,w:180,h:72},remaining>0?`${spec.name} ${Math.ceil(remaining)}s`:spec.name,()=>game.selectSkill(type),{active:game.skill===type,disabled:remaining>0,size:21});
      // 名称仍作为按钮语义保留；图标与键位放在按钮外的独立页签，不挤占文字。
      this.box(x+9,y-8,24,18,"#4a7264",null,4);this.text(i?"E":"Q",x+21,y+1,11,"#f6edcd","bold","center");
      if(remaining>0){const full=game.skillSpecs[type].cooldown;this.box(x+12,y+61,156,3,"#c1cab7",null,1);this.box(x+12,y+61,156*Math.max(0,1-remaining/full),3,"#7e9b81",null,1);}
    });
    this.button(game,{x:l.left+389,y:l.footer+15,w:117,h:72},"取消",()=>game.cancel(),{size:22});
    const wave={x:l.right-384,y:l.footer+5,w:384,h:85};
    this.trafficControls(game,{x:l.left+518,y:l.footer+15,w:wave.x-l.left-530,h:72});
    MobileLayout.frame(game,{x:872,y:623,w:384,h:85},wave,()=>this.waveButton(game),1);
  },
  waveButton(game) {
    const final=game.wave>=game.level.waves,ready=game.canStartWave(),rect={x:872,y:623,w:384,h:85};
    this.button(game,rect,"",()=>game.startWave(),{primary:ready,disabled:!ready});
    const x=919,y=665,r=27,seconds=Math.max(0,Math.ceil(game.prepareTime));
    this.circle(x,y,r+5,ready?"#254f4e":"#c0c9b4");this.circle(x,y,r-1,ready?"#3c7469":"#e1e1cc");
    ctx.beginPath();ctx.arc(x,y,r,-Math.PI/2,-Math.PI/2+Math.PI*2*(final?1:Math.max(0,Math.min(1,1-game.prepareTime/game.waveDuration))));ctx.strokeStyle=ready?"#edc888":"#78927b";ctx.lineWidth=3;ctx.stroke();
    this.text(final?"✓":game.spawnQueue.length?"…":`${seconds}`,x,y,24,ready?"#fff3d7":COLORS.ink,"bold","center");
    this.text(final?"最终波 · 完成交通任务":`${game.wave?"提前发动":"开始"}第 ${game.wave+1} 波`,1094,650,22,ready?"#fff5df":COLORS.ink,"bold","center");
    const tip=game.paused?"已暂停 · 可布塔升级":final?`场上 ${game.enemies.length} · 待出发 ${game.spawnQueue.length}`:ready?`提前 ${seconds} 秒 · 奖励 +${game.earlyWaveReward} G`:`本波待出场 ${game.spawnQueue.length} · 出完后计时`;
    this.text(tip,1094,681,15,ready?"#d8e2c2":COLORS.muted,"normal","center");
  },
  touchPanel(game,title,height=352) {
    const rect={x:380,y:156,w:520,h:height};
    UiTheme.card(rect,{fill:"#f5eeddfb",border:"#879e8b",texture:true,radius:13});
    game.buttons.push({...rect,action:()=>{}});
    this.box(rect.x+1,rect.y+1,518,65,"#dfe7d2",null,12);this.box(rect.x+1,rect.y+43,518,22,"#dfe7d2",null,0);
    this.text(title,rect.x+21,rect.y+34,24,COLORS.ink,"bold");
    this.button(game,{x:rect.x+442,y:rect.y+10,w:62,h:46},"关闭",()=>game.cancel(),{size:18});
    return rect;
  },
  buildPopup(game) {
    game.buildPopupRect=null;game.previewTowerType=null;
    if(!game.selectedSite||game.screen!=="battle")return;
    const rect=this.touchPanel(game,`阵地 ${String(game.selectedSite.id+1).padStart(2,"0")} · 部署设施`,290);game.buildPopupRect=rect;
    const guardPreview=new Tower("depot",game.selectedSite.x,game.selectedSite.y,game.level.theme);
    const waiting=!AlliedNavigation.defaultRally(game,guardPreview);
    const roles={rail:"单体 · 物理",signal:"减速 · 魔法",missile:"车组 · 群伤",depot:waiting?"待命 · 道路未开":"驻路 · 拦截"};
    game.loadout.forEach((type,i)=>{
      const spec=TOWERS[type],x=rect.x+16+i*125,y=rect.y+83,afford=game.gold>=spec.cost,b={x,y,w:113,h:153};
      this.button(game,b,"",()=>game.selectBuild(type),{disabled:!afford,towerType:type});
      if(Collision.inside(game.uiPointer||game.pointer,b))game.previewTowerType=type;
      this.oval(x+56,y+54,36,14,"#748b6d16");
      ctx.save();ctx.translate(x+56,y+48);ctx.scale(.9,.9);this.tower({type,theme:game.level.theme,x:0,y:0,level:1,branch:null});ctx.restore();
      this.text(spec.name,x+56,y+85,19,COLORS.ink,"bold","center");this.text(roles[type],x+56,y+110,12,COLORS.muted,"normal","center");
      this.text(`${spec.cost} G`,x+56,y+134,18,afford?COLORS.gold:"#929987","bold","center");
    });
    const partners=ConstructionTactics.links(game,game.selectedSite).length;
    const hint=partners?`可与邻近 ${partners} 处联防 · 亮色路段为共同射界`:"当前为独立射界 · 升级射程后可扩大覆盖";
    this.text(waiting?"此处勤务站将待命，待道路开放后才能集结。":hint,rect.x+260,rect.y+262,15,waiting?COLORS.gold:COLORS.muted,"normal","center");
  },
  towerPopup(game) {
    game.towerPopupRect=null;const t=game.selected;if(!t||game.screen!=="battle"||game.rallyTower)return;
    const rect=this.touchPanel(game,`${t.name} · L${t.level}`,392),x=rect.x,y=rect.y;game.towerPopupRect=rect;
    const waiting=t.type==="depot"&&!t.rally;
    this.text(waiting?"待命中 · 暂无可达道路，开放后自动集结":`${CombatRules.typeName(t.stats.damageType)} ${Math.round(t.stats.damage)} · ${(1/t.stats.cooldown).toFixed(2)}次/秒 · 射程 ${t.stats.range}`,x+22,y+88,19,waiting?COLORS.gold:COLORS.muted);
    if(t.level===2)t.paths.forEach((path,i)=>{
      const bx=x+16+i*252,unlocked=game.branchUnlocked(t.type,t.theme,i),afford=game.gold>=path.cost;
      this.button(game,{x:bx,y:y+114,w:236,h:173},"",()=>game.upgrade(i),{disabled:!unlocked||!afford,locked:!unlocked,branch:i});
      ctx.save();ctx.translate(bx+40,y+163);ctx.scale(.65,.65);this.tower({type:t.type,theme:t.theme,x:0,y:0,level:3,branch:i});ctx.restore();
      this.text(path.name,bx+79,y+138,22,COLORS.ink,"bold");
      this.text(unlocked?`${path.cost} G`:"进化未解锁",bx+79,y+168,18,unlocked?COLORS.gold:COLORS.muted,"bold");
      if(unlocked)path.note.split(/\s*·\s*/).slice(0,3).forEach((line,j)=>this.text(line,bx+118,y+211+j*23,16,COLORS.muted,"normal","center"));
      else {AtlasArt.chain({x:bx+8,y:y+181,w:220,h:52});this.text(`通关 ${evolutionRequirement(t.type,t.theme,i)} 关解锁`,bx+118,y+258,18,COLORS.ink,"bold","center");}
    });
    else {
      const max=t.level===4,next=t.level+1;
      ctx.save();ctx.translate(x+58,y+159);ctx.scale(.95,.95);this.tower({type:t.type,theme:t.theme,x:0,y:0,level:max?4:next,branch:t.branch});ctx.restore();
      this.button(game,{x:x+108,y:y+120,w:396,h:78},max?"已达最高等级":`强化 → L${next} · ${t.upgradeCost} G`,()=>game.upgrade(),{primary:!max,disabled:max||game.gold<t.upgradeCost,size:23});
      const note=waiting?"可提前强化设施；队员不会进入未开放道路。":t.branch===null?"强化到二级后选择进化方向":t.paths[t.branch].note;
      (note.match(/.{1,23}/g)||[]).slice(0,2).forEach((line,i)=>this.text(line,x+260,y+237+i*23,18,COLORS.muted,"normal","center"));
    }
    this.line([[x+18,y+300],[x+502,y+300]],"#c4ccb3",1);
    this.button(game,{x:x+16,y:y+314,w:236,h:58},t.type==="depot"?"设置集合点":TARGET_MODES[t.targetMode],()=>{if(t.type==="depot"){game.rallyTower=t;game.notify("点击当前开放的道路，调动队员。");}else t.targetMode=(t.targetMode+1)%3;},{disabled:waiting,size:20});
    this.button(game,{x:x+268,y:y+314,w:236,h:58},`出售 +${t.sellValue} G`,()=>game.sell(),{size:20});
  },
  siteLinks(game) {
    if(game.modal||game.skill||game.item||game.rallyTower)return;
    const site=game.selectedSite||game.sites.find(p=>game.selected?.siteId===p.id)||game.siteAt(game.pointer);
    if(!site)return;
    // 只标亮实际可共同攻击的开放路段，不画穿过建筑的连线，也不提供隐形数值加成。
    for(const link of ConstructionTactics.links(game,site)){
      for(const segment of link.segments){
        this.line([[segment.a.x,segment.a.y],[segment.b.x,segment.b.y]],"#c8dca24d",20);
        this.line([[segment.a.x,segment.a.y],[segment.b.x,segment.b.y]],"#edf5bbbd",2.5,[5,6]);
      }
      this.oval(link.site.x,link.site.y+5,35,26,"#d8e7aa28","#8ca76e");
    }
  },
  site(game,site) {
    const built=game.towers.some(t=>!t.temporary&&t.siteId===site.id),hover=!built&&(game.siteAt(game.pointer)===site||game.selectedSite===site);
    const theme=game.level.theme,road=game.buildRoad.nearestPoint(site),dx=site.x-road.x,dy=site.y-road.y,distance=Math.hypot(dx,dy);
    const palettes={city:["#d6d6bb","#a4b4a3","#617d6e"],country:["#ded3a9","#b7b28c","#788e64"],desert:["#e6cda0","#c2a77e","#95876b"],
      hills:["#d1d5c4","#a7b2a1","#708175"],sea:["#ddcba2","#a5b9ac","#5c877c"],forest:["#cdd5ae","#a1b38a","#668366"]};
    const [floor,shoulder,edge]=palettes[theme];
    // 一条短检修通道接到路沿，低矮挡边包住安装区；成塔后基座仍留在原处。
    if(distance>44){const p={x:road.x+dx/distance*44,y:road.y+dy/distance*44};
      this.line([[p.x,p.y],[site.x,site.y]],edge+"80",18);this.line([[p.x,p.y],[site.x,site.y]],shoulder,13);
    }
    ctx.save();ctx.translate(site.x,site.y);ctx.rotate(Math.atan2(dy,dx)+Math.PI/2);
    this.oval(2,7,34,24,"#324c3a20");
    this.polygon([[-33,-13],[-24,-24],[22,-24],[33,-12],[30,21],[-28,23]],shoulder+"b8");
    this.box(-27,-18,54,39,floor,edge,7);
    this.line([[-25,13],[-25,-13],[-19,-18]],edge,4);this.line([[25,13],[25,-13],[19,-18]],edge,4);
    this.line([[-22,-15],[22,-15]],"#fffae0ab",2);
    if(theme==="sea"||theme==="forest"||theme==="country"){
      for(let y=-9;y<14;y+=7){this.line([[-21,y],[21,y]],edge+"48",1);this.line([[-17,y+2],[-4,y+2]],"#fff8db55",1);}
    }else{
      this.line([[0,-12],[0,11]],edge+"36",1);this.line([[-22,1],[22,1]],edge+"36",1);
    }
    if(!built){
      // 交通施工语汇：黄黑短挡块、供电盒和地脚螺栓，区别于地图商店建筑。
      this.box(-22,-24,14,7,edge,null,2);this.box(-19,-23,6,3,"#d7bb7c",null,1);
      for(const x of [-21,15]){this.box(x,16,8,5,"#cfac66",edge,1);this.line([[x+2,16],[x+5,21]],edge,2);}
      for(const x of [-16,16])this.circle(x,9,1.5,edge);
    }
    ctx.restore();
    if(!built){
      this.box(site.x-9,site.y-7,18,18,hover?"#477a69":"#eaf0d8",hover?"#fbefc1":edge,5);
      this.line([[site.x-4,site.y+2],[site.x+4,site.y+2]],hover?"#fff6d9":"#5e806b",2);
      this.line([[site.x,site.y-2],[site.x,site.y+6]],hover?"#fff6d9":"#5e806b",2);
      if(hover)this.oval(site.x,site.y+3,33,25,"#e9cf7822","#bb914c");
    }
  },
  modal(game) {
    // 面板在短暂淡入期间已经可以点击，动画不会锁住输入或延后购买结算。
    const age=Math.max(0,(game.lastTime||0)-(game.uiModalTime||0));
    ctx.save();ctx.globalAlpha=.72+.28*Math.min(1,age/130);UiPrevious.modal.call(this,game);ctx.restore();
  },
  draw(game) {
    if(game.uiLastModal!==game.modal){game.uiLastModal=game.modal;game.uiModalTime=game.lastTime||0;}
    UiPrevious.draw.call(this,game);
    const pulse=game.uiPulse,now=game.lastTime||0;
    if(pulse){const age=Math.max(0,now-pulse.time)/260;if(age<1){ctx.save();ctx.globalAlpha=(1-age)*.36;ctx.beginPath();ctx.arc(pulse.x,pulse.y,5+age*17,0,Math.PI*2);ctx.strokeStyle=UiTheme.palette.teal;ctx.lineWidth=2-age;ctx.stroke();ctx.restore();}else game.uiPulse=null;}
  }
});

// 动作在释放当帧执行；波纹只作视觉反馈，绝不阻塞建造、升级和施法。
Platform.handleTap=function(game,p){
  const button=[...game.buttons].reverse().find(b=>Collision.inside(p,b));
  if(!button?.disabled)game.uiPulse={x:p.x,y:p.y,time:game.lastTime||0};
  return UiPrevious.handleTap.call(this,game,p);
};

AtlasArt.paper=function(rect,theme="city"){
  UiPrevious.paper.call(this,rect,theme);
  // 地图边框与坐标小刻线让整幅地图成为可阅读的野外交通图册。
  const {x,y,w,h}=rect;
  if(w>800&&h>400){
    Renderer.box(x+8,y+8,w-16,h-16,"#ffffff00","#617a6033",4);
    for(let px=x+40;px<x+w-20;px+=50){Renderer.line([[px,y+10],[px,y+14]],"#66816430",1);Renderer.line([[px,y+h-14],[px,y+h-10]],"#66816430",1);}
  }
};

// 补充章节地貌的交通用途细节。小比例下保留清晰剪影，大比例能看到木纹、砖缝与反光。
AtlasArt.landmark=function(theme,x,y,scale=1,variant=0){
  if(theme==="city"||variant%3===0){UiPrevious.landmark.call(this,theme,x,y,scale,variant);return;}
  const R=Renderer,ink="#63715a",paper="#f0e3bc";ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  R.oval(4,19,35,12,"#365a4820");
  if(theme==="country"){
    if(variant%2){R.box(-24,-8,49,31,"#c7b88e",ink,3);R.polygon([[-30,-8],[0,-29],[30,-8]],"#b57c56",ink);R.line([[-23,-8],[-1,-24],[23,-8]],"#efcea0",1.4);R.box(-7,2,14,21,"#59776b",ink,2);for(const xx of [-19,13])R.box(xx,-2,7,9,paper,ink,1);R.line([[-7,4],[7,21]],"#9bab8e",1);}
    else {R.box(-16,-25,31,48,"#d6d1ab",ink,8);R.oval(0,-25,16,6,"#e8dfbd",ink);for(const yy of [-15,-4,7])R.line([[-13,yy],[12,yy]],"#a9b299",1.2);R.line([[21,-26],[21,22]],ink,2);for(let yy=-23;yy<22;yy+=8)R.line([[17,yy],[25,yy]],ink,1.5);}
    for(const xx of [-34,34]){R.line([[xx,25],[xx,11]],"#91a36e",1.5);R.line([[xx,16],[xx-4,12]],"#b1a76b",2);}
  }else if(theme==="desert"){
    R.polygon([[-30,21],[-25,4],[24,4],[32,21]],"#d6b98b",ink);R.box(-22,-17,44,32,"#e1c396",ink,2);R.polygon([[-26,-17],[14,-25],[29,-16],[21,-11],[-22,-11]],"#b8885d",ink);R.box(-6,0,12,16,"#6c826d",ink,2);R.box(10,-9,8,7,"#9fb3a1",ink,1);R.line([[-17,-7],[-17,6]],"#c3976e",2);R.line([[26,2],[34,2],[34,17]],"#6f7d61",3);
    R.line([[-42,26],[-18,29],[6,27],[23,31]],"#f2dfba",2);
  }else if(theme==="hills"){
    R.polygon([[-32,24],[-25,-10],[0,-30],[29,-7],[37,23]],"#9fac95",ink);R.polygon([[-18,23],[-16,-1],[0,-12],[16,-1],[18,23]],"#4e655b",ink);R.line([[-17,24],[-18,0],[-1,-14],[17,0],[18,24]],"#d5d9bd",5);for(const dx of [-11,11])R.line([[dx,11],[dx*2,34]],"#b3a67e",2.5);for(const yy of [13,21,29])R.line([[-16,yy],[17,yy]],"#796e54",2);R.line([[22,-8],[35,-21]],"#687961",2);R.polygon([[29,-24],[44,-22],[40,-13]],"#b98759",ink);
  }else if(theme==="sea"){
    for(let i=0;i<5;i++)R.line([[-33,12+i*5],[24,12+i*5]],i%2?"#bbad84":"#d9c79d",4);for(const xx of [-29,21])R.line([[xx,5],[xx,37]],ink,4);
    if(variant%2){R.line([[-20,12],[-20,-29],[10,-29]],ink,4);R.line([[-20,-28],[1,-10]],"#bba47a",3);R.line([[10,-28],[10,-4]],ink,1.5);R.box(3,-4,15,10,"#b98059",ink,2);R.line([[-30,1],[-9,1]],"#e5cea1",2);}
    else {R.box(-17,-14,34,25,"#e1cda0",ink,2);R.polygon([[-24,-14],[0,-28],[23,-14]],"#7f9c8b",ink);R.box(-7,-5,14,16,"#57776c",ink,2);}
    R.line([[-40,38],[-29,41],[-16,38]],"#e0ead344",2);
  }else{
    R.line([[-23,23],[-22,-12]],"#8a8560",6);R.line([[23,23],[22,-12]],"#8a8560",6);
    R.box(-25,-11,50,22,"#bcc5a0",ink,3);R.polygon([[-32,-11],[0,-28],[32,-11]],"#63816a",ink);R.line([[-26,-11],[-1,-23],[26,-11]],"#abc398",1.5);R.box(-9,-6,18,12,"#6c8c72",ink,1);R.text("巡护",0,0,7,"#e8edc7","bold","center");
    R.oval(-28,24,13,6,"#9bae7a");R.oval(28,25,15,7,"#9dae76");R.line([[18,20],[29,9]],"#6e8c65",2);
  }
  ctx.restore();
};
