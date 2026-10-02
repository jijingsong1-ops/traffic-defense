"use strict";

// 网页层只补充桌面交互，交通图册、关卡坐标与战斗绘制均来自同一套手机界面。
CONFIG.version="v0.16.0-web";
const BrowserView = {
  draw:Renderer.draw, home:Renderer.home, header:Renderer.header,
  fieldWorld:Renderer.fieldWorld, buildPopup:Renderer.buildPopup, text:Renderer.text
};

// 鼠标端把面板放到设施旁；操作和升级规则仍使用原有面板。
MobileLayout.popup=function(game,l,kind){
  const build=kind==="build",key=build?"buildPopupRect":"towerPopupRect",selected=build?game.selectedSite:game.selected;
  game[key]=null;
  if(!selected||game.screen!=="battle"||!build&&game.rallyTower)return;
  const source={x:380,y:156,w:520,h:build?290:392},top=l.top+98,bottom=l.footer-10;
  const scale=Math.min(.9,(l.right-l.left-24)/source.w,(bottom-top)/source.h);
  const w=source.w*scale,h=source.h*scale,p=this.toScreen(game,selected);
  let x=p.x+42;if(x+w>l.right)x=p.x-w-42;
  x=Math.max(l.left,Math.min(l.right-w,x));
  const y=Math.max(top,Math.min(bottom-h,p.y-h/2));
  const transform=this.frame(game,source,{x,y,w,h},()=>Renderer[build?"buildPopup":"towerPopup"](game),scale);
  const rect=game[key];
  if(rect){const point=this.toWorld(game,{x:rect.x*transform.scale+transform.x,y:rect.y*transform.scale+transform.y});
    game[key]={...point,w:rect.w*transform.scale/game.mobileCamera.scale,h:rect.h*transform.scale/game.mobileCamera.scale};}
};

Object.assign(Renderer,{
  text(label,...args) { BrowserView.text.call(this,typeof label==="string"?label.replaceAll("轻触","点击").replaceAll("微信存储空间","浏览器存储空间"):label,...args); },
  fullscreenButton(game,rect) {
    this.button(game,rect,document.fullscreenElement?"退出全屏":"全屏",()=>Platform.toggleFullscreen(),{size:21});
  },
  home(game,l) {
    BrowserView.home.call(this,game,l);
    this.fullscreenButton(game,{x:l.left+310,y:l.bottom-62,w:138,h:56});
    this.text("空格暂停 · Q/E技能 · M音乐 · F全屏",l.left+42,(l.top+l.bottom)/2-28,18,COLORS.muted);
  },
  header(game,l) {
    BrowserView.header.call(this,game,{...l,headerRight:l.headerRight-116});
    this.fullscreenButton(game,{x:l.headerRight-104,y:l.top,w:104,h:68});
  },
  buildPopup(game) {
    game.previewTowerType=null;
    const first=game.buttons.length;BrowserView.buildPopup.call(this,game);
    const hovered=game.buttons.slice(first).find(b=>b.towerType&&Collision.inside(game.uiPointer||game.pointer,b));
    if(hovered)game.previewTowerType=hovered.towerType;
  },
  fieldWorld(game) {
    BrowserView.fieldWorld.call(this,game);
    if(game.selectedSite&&game.previewTowerType){
      ctx.save();ctx.beginPath();ctx.rect(MAP.x,MAP.y,MAP.w,MAP.h);ctx.clip();
      const spec=TOWERS[game.previewTowerType];this.range(game.selectedSite,spec.range,spec.color);ctx.restore();
    }
  },
  draw(game) {
    if(!Platform.exited){
      BrowserView.draw.call(this,game);
      if(game.screen==="battle"&&!game.modal&&!game.paused&&!game.selected&&!game.selectedSite&&!game.traffic?.routeMenu&&game.messageTime>0){
        const l=MobileLayout.measure(),w=Math.min(1040,l.right-l.left);
        this.box((l.w-w)/2,l.footer-42,w,32,"#f0debce8",null,7);
        this.text(game.message,l.w/2,l.footer-26,17,COLORS.ink,"bold","center");
      }
      return;
    }
    const l=MobileLayout.measure();game.buttons=[];
    AtlasArt.scenery({x:0,y:0,w:l.w,h:l.h},"city",3);
    const x=l.w/2,y=l.h/2;
    this.box(x-330,y-155,660,310,"#eddfb9ef",COLORS.border,18);
    this.text("已退出游戏",x,y-86,40,COLORS.ink,"bold","center");
    this.text("通关存档已保留，可以关闭此浏览器标签页。",x,y-27,22,COLORS.muted,"normal","center");
    this.button(game,{x:x-160,y:y+36,w:320,h:76},"返回首页",()=>{Platform.exited=false;Sound.unlock();},{primary:true,size:26});
  }
});
