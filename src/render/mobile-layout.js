"use strict";

// 屏幕 UI 与固定战场坐标分离。设备尺寸变化只影响相机，不改道路、射程或存档。
const MobileLayout = {
  measure() {
    const {width:w,height:h,safe,capsule}=Platform.layout;
    const left=safe.left+18,right=safe.right-18,top=safe.top+12,bottom=safe.bottom-10;
    const headerRight=capsule&&capsule.y<top+80?Math.min(right,capsule.x-14):right;
    return {w,h,left,right,top,bottom,headerRight,footer:bottom-94,
      content:{x:left,y:Math.max(top,capsule?capsule.y+capsule.h+10:top),w:right-left,h:0}};
  },
  camera(game,l) {
    const rect={x:l.left,y:l.top+90,w:l.right-l.left,h:l.footer-l.top-104};
    const scale=Math.min(rect.w/MAP.w,rect.h/MAP.h);
    const camera={rect,scale,x:rect.x+(rect.w-MAP.w*scale)/2-MAP.x*scale,y:rect.y+(rect.h-MAP.h*scale)/2-MAP.y*scale};
    game.mobileCamera=camera;return camera;
  },
  toWorld(game,p) {
    const c=game.mobileCamera;
    return c?{x:(p.x-c.x)/c.scale,y:(p.y-c.y)/c.scale}:p;
  },
  toScreen(game,p) {
    const c=game.mobileCamera;
    return c?{x:p.x*c.scale+c.x,y:p.y*c.scale+c.y}:p;
  },
  frame(game,source,target,draw,maxScale=1.25) {
    const scale=Math.min(maxScale,target.w/source.w,target.h/source.h);
    const x=target.x+(target.w-source.w*scale)/2-source.x*scale,y=target.y+(target.h-source.h*scale)/2-source.y*scale;
    const first=game.buttons.length,pointer=game.uiPointer;
    if(pointer)game.uiPointer={x:(pointer.x-x)/scale,y:(pointer.y-y)/scale};
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);draw();ctx.restore();game.uiPointer=pointer;
    for(let i=first;i<game.buttons.length;i++){
      const b=game.buttons[i];b.x=b.x*scale+x;b.y=b.y*scale+y;b.w*=scale;b.h*=scale;
    }
    return {x,y,scale};
  },
  popup(game,l,kind) {
    const build=kind==="build",key=build?"buildPopupRect":"towerPopupRect";
    const target={x:l.left,y:l.top+95,w:l.right-l.left,h:l.footer-l.top-105};
    const transform=this.frame(game,{x:380,y:156,w:520,h:build?290:392},target,()=>Renderer[build?"buildPopup":"towerPopup"](game),1.25);
    const r=game[key];
    if(r){
      const p=this.toWorld(game,{x:r.x*transform.scale+transform.x,y:r.y*transform.scale+transform.y});
      game[key]={...p,w:r.w*transform.scale/game.mobileCamera.scale,h:r.h*transform.scale/game.mobileCamera.scale};
    }
  }
};
Platform.worldPoint=(game,p)=>MobileLayout.toWorld(game,p);
Platform.handleTap=(game,p)=>{
  const button=[...game.buttons].reverse().find(b=>Collision.inside(p,b));
  if(button){if(!button.disabled)button.action();return;}
  if(game.modal||game.screen!=="battle"||!game.mobileCamera)return;
  game.click(MobileLayout.toWorld(game,p),true);
};

Object.assign(Renderer,{
  home(game,l) {
    const split=l.left+(l.right-l.left)*.57,cy=(l.top+l.bottom)/2;
    AtlasArt.scenery({x:0,y:0,w:l.w,h:l.h},"city",3,p=>
      p.x>split-20&&p.y>cy-270&&p.y<cy+270||p.x<split&&p.y>cy-235&&p.y<cy-25);
    const road=[[0,cy+167],[l.left+160,cy+167],[split-170,cy-26],[split+15,cy-26],[split+150,cy-170],[l.w,cy-170]];
    this.line(road,"#776346",67);this.line(road,"#b1a781",57);this.line(road,"#e9d7a5",3,[14,14]);
    this.text("路网守卫",l.left+42,cy-164,68,"#4e503a","bold");
    this.text("公路远征 · 六境交通图册",l.left+46,cy-105,25,"#786343");
    this.text("ROAD GUARD  /  FIELD ATLAS",l.left+48,cy-65,16,"#8b7952","bold");
    ["rail","signal","missile","depot"].forEach((type,i)=>{
      ctx.save();ctx.translate(l.left+82+i*(split-l.left-125)/4,cy+95+(i%2)*25);ctx.scale(1.55,1.55);
      this.tower({type,theme:"city",x:0,y:0,level:3,branch:i%2,angle:-.7});ctx.restore();
    });
    const x=split+16,w=l.right-x-24,y=cy-224;
    this.box(x,y,w,450,"#ece0bce8","#927951",17);
    this.text("下一站，由你守护",x+w/2,y+50,29,COLORS.ink,"bold","center");
    [["开始游戏",()=>game.newCampaign()],["读取存档",()=>game.loadCampaign()],["退出游戏",()=>Platform.exitGame(()=>game.notify("请使用微信右上角菜单退出小游戏。"))]].forEach(([label,action],i)=>
      this.button(game,{x:x+26,y:y+98+i*98,w:w-52,h:81},label,action,{primary:i===0,size:30}));
    this.text(`本地存档 ${Progress.list().filter(Boolean).length} / 3 · 通关自动保存`,x+w/2,y+412,19,COLORS.muted,"normal","center");
    this.audioButtons(game,l.left,l.bottom-62);
    this.text(game.messageTime>0?game.message:`${CONFIG.version} · 通关自动保存`,l.right,l.bottom-28,19,COLORS.ink,"normal","right");
    AtlasArt.compass(split-85,cy-220);
  },
  menu(game,l) {
    const chapter=CHAPTERS[game.menuChapter],first=game.menuChapter*8;
    const map={x:l.left+65,y:l.top+116,w:l.right-l.left-130,h:l.footer-l.top-193};
    const nodes=chapter.nodes.map(([x,y])=>({x:map.x+(x-100)/700*map.w,y:map.y+(y-185)/445*map.h}));
    AtlasArt.scenery({x:0,y:0,w:l.w,h:l.h},chapter.theme,game.menuChapter,p=>nodes.some(n=>Math.abs(n.x-p.x)<120&&p.y>n.y-100&&p.y<n.y+115));
    const trail=nodes.map(p=>[p.x,p.y]);
    this.line(trail,"#f6e7be",12);this.line(trail,"#927754",3,[6,9]);
    nodes.forEach((p,offset)=>{
      const index=first+offset,level=LEVELS[index],locked=index>game.unlocked;
      AtlasArt.roadSign(p.x,p.y,locked?"·":`${game.menuChapter+1}-${offset+1}`,{locked,boss:level.boss,stars:game.progress.stars[index],active:index===game.unlocked});
      this.box(p.x-84,p.y+44,168,29,"#eadbb4d9",null,5);
      this.text(level.name,p.x,p.y+59,20,"#635138","bold","center");
      game.buttons.push({x:p.x-85,y:p.y-51,w:170,h:125,levelIndex:index,action:()=>game.openLevel(index)});
    });
    this.box(0,0,l.w,l.top+88,"#e6d6aecf",null,0);
    this.button(game,{x:l.left,y:l.top,w:142,h:68},"‹ 首页",()=>{game.screen="home";game.modal=null;},{size:25});
    const middle=(l.left+l.headerRight)/2;
    this.text(`${chapter.name}`,middle,l.top+27,35,COLORS.ink,"bold","center");
    this.text(`第 ${game.menuChapter+1} 章  /  ${chapter.city.split(" / ")[1]}`,middle,l.top+64,15,COLORS.muted,"bold","center");
    this.text(`★ ${game.progress.stars.slice(first,first+8).reduce((a,b)=>a+b,0)} / 24`,l.headerRight,l.top+35,25,"#946327","bold","right");
    this.box(0,l.footer,l.w,l.h-l.footer,"#e3d0a9d9",null,0);
    this.line([[0,l.footer],[l.w,l.footer]],"#a58b60",2);
    this.button(game,{x:l.left,y:l.footer+16,w:187,h:70},"‹ 上一章",()=>game.selectChapter(game.menuChapter-1),{disabled:game.menuChapter===0,size:24});
    this.button(game,{x:l.right-187,y:l.footer+16,w:187,h:70},"下一章 ›",()=>game.selectChapter(game.menuChapter+1),{disabled:game.menuChapter===5,size:24});
    this.text(game.saveFailed?"存档未能保存，请检查存储空间":"轻触公路路牌 · 查看作战简报",l.w/2,l.footer+35,22,game.saveFailed?COLORS.red:COLORS.ink,"bold","center");
    CHAPTERS.forEach((_,i)=>this.circle(l.w/2-75+i*30,l.footer+73,6,i===game.menuChapter?"#b35f43":"#b5a27b"));
    AtlasArt.compass(l.right-64,l.footer-79);
  },
  header(game,l) {
    this.box(0,0,l.w,l.top+84,"#eadbb5ed",null,0);this.line([[0,l.top+84],[l.w,l.top+84]],"#a78e61",2);
    this.text(`♥ ${game.lives}`,l.left+2,l.top+27,30,COLORS.red,"bold");
    this.text(`${game.gold} G`,l.left+143,l.top+27,30,"#92632d","bold");
    this.text(`${game.wave} / ${game.level.waves} 波`,l.left+303,l.top+27,27,COLORS.mint,"bold");
    this.text(`${stageLabel(game.levelIndex)} · ${Traffic.status(game)}`,l.left+3,l.top+64,19,COLORS.muted);
    const x=l.headerRight-364;
    this.button(game,{x,y:l.top,w:90,h:68},`×${game.speed}`,()=>{game.speed=game.speed%3+1;},{size:25});
    this.button(game,{x:x+102,y:l.top,w:110,h:68},game.paused?"继续":"暂停",()=>{game.paused=!game.paused;},{active:game.paused,size:25});
    this.button(game,{x:x+224,y:l.top,w:140,h:68},"战斗菜单",()=>{game.modal="battleMenu";},{size:23});
  },
  toolbar(game,l) {
    this.box(0,l.footer,l.w,l.h-l.footer,"#e6d5aeed",null,0);this.line([[0,l.footer],[l.w,l.footer]],"#9f865c",2);
    Object.entries(SKILLS).forEach(([type,spec],i)=>{
      const remaining=game.skillCooldowns[type];
      this.button(game,{x:l.left+i*192,y:l.footer+15,w:180,h:72},remaining>0?`${spec.name} ${Math.ceil(remaining)}s`:spec.name,()=>game.selectSkill(type),{active:game.skill===type,disabled:remaining>0,size:23});
    });
    this.button(game,{x:l.left+389,y:l.footer+15,w:117,h:72},"取消",()=>game.cancel(),{size:24});
    const wave={x:l.right-384,y:l.footer+5,w:384,h:85};
    this.trafficControls(game,{x:l.left+518,y:l.footer+15,w:wave.x-l.left-530,h:72});
    MobileLayout.frame(game,{x:872,y:623,w:384,h:85},wave,()=>this.waveButton(game),1);
  },
  draw(game) {
    const l=MobileLayout.measure();l.content.h=l.bottom-l.content.y;
    game.buttons=[];ctx.clearRect(0,0,l.w,l.h);
    if(game.screen==="home")this.home(game,l);
    else if(game.screen==="menu")this.menu(game,l);
    else{
      const c=MobileLayout.camera(game,l),chapter=CHAPTERS[game.level.chapter];
      AtlasArt.scenery({x:0,y:0,w:l.w,h:l.h},chapter.theme,game.level.stage,p=>{
        const world=MobileLayout.toWorld(game,p);return game.buildRoad.isRoad(world,65)||game.sites.some(site=>Collision.distance(site,world)<65);
      });
      ctx.save();ctx.translate(c.x,c.y);ctx.scale(c.scale,c.scale);this.field(game);ctx.restore();
      this.header(game,l);this.toolbar(game,l);
      MobileLayout.popup(game,l,"build");MobileLayout.popup(game,l,"tower");
      if(game.screen==="result"){
        game.buttons=[];this.box(0,0,l.w,l.h,"#453c2e99",null,0);
        MobileLayout.frame(game,{x:268,y:110,w:744,h:510},l.content,()=>this.result(game));
      }
    }
    if(game.modal){
      game.buttons=[];this.box(0,0,l.w,l.h,"#453c2e99",null,0);
      MobileLayout.frame(game,{x:70,y:72,w:1140,h:598},l.content,()=>this.modal(game),1.2);
    }
  }
});
