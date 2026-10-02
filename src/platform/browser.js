"use strict";

// 浏览器只负责窗口、输入、存档和声音；战场坐标及美术复用手机版。
const Platform = {
  touch:false, exited:false, suspended:false,
  get hidden() { return document.hidden||this.exited||this.suspended; },
  storage: {
    getItem(key) { return localStorage.getItem(key); },
    setItem(key,value) { localStorage.setItem(key,value); }
  },
  createAudioContext() {
    const Audio=window.AudioContext||window.webkitAudioContext;
    return Audio?new Audio():null;
  },
  initialize(canvas,context) { this.canvas=canvas;this.context=context;this.resize(); },
  resize() {
    const rect=this.canvas.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height);
    // 大窗口扩大战场，控制区保留适合鼠标阅读的尺寸；小窗口整体缩小UI。
    const scale=Math.min(width/1280,height/720,1.25),ratio=Math.min(window.devicePixelRatio||1,2);
    this.viewport={left:rect.left,top:rect.top,width,height,scale};
    this.layout={width:width/scale,height:height/scale,safe:{left:0,top:0,right:width/scale,bottom:height/scale},capsule:null};
    this.canvas.width=Math.round(width*ratio);this.canvas.height=Math.round(height*ratio);
    this.context.setTransform(scale*ratio,0,0,scale*ratio,0,0);
    if(this.game){this.game.lastTime=null;this.game.accumulator=0;this.game.buttons=[];this.game.mobileCamera=null;this.game.previewTowerType=null;}
  },
  toCanvas(event,canvas=this.canvas) {
    const rect=canvas.getBoundingClientRect();
    return {x:(event.clientX-rect.left)/rect.width*this.layout.width,y:(event.clientY-rect.top)/rect.height*this.layout.height};
  },
  point(game,event) {
    game.uiPointer=this.toCanvas(event);
    game.pointer=this.worldPoint?this.worldPoint(game,game.uiPointer):game.uiPointer;
  },
  async toggleFullscreen() {
    try {
      if(document.fullscreenElement)await document.exitFullscreen();
      else if(this.canvas.requestFullscreen)await this.canvas.requestFullscreen();
      else this.game.notify("当前浏览器不支持全屏，可最大化窗口游玩。");
    }catch{this.game.notify("无法进入全屏，可最大化窗口游玩。");}
  },
  exitGame() { this.exited=true;Sound.stop();this.game.buttons=[]; },
  bindInput(game,canvas) {
    this.game=game;let gesture=null;
    const reset=()=>{gesture=null;game.pointer={x:-100,y:-100};game.uiPointer={x:-100,y:-100};};
    canvas.addEventListener("pointermove",event=>{
      this.point(game,event);
      if(gesture&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>12)gesture.moved=true;
    });
    canvas.addEventListener("pointerleave",reset);
    canvas.addEventListener("pointercancel",reset);
    canvas.addEventListener("pointerdown",event=>{
      if(event.isPrimary===false){reset();return;}
      if(event.button!==0)return;
      Sound.unlock();canvas.focus();this.point(game,event);
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,screen:game.screen,modal:game.modal};
    });
    canvas.addEventListener("pointerup",event=>{
      const press=gesture;gesture=null;
      if(!press||event.button!==0||press.id!==event.pointerId||press.moved||press.screen!==game.screen||press.modal!==game.modal)return;
      this.point(game,event);
      if(this.handleTap)this.handleTap(game,game.uiPointer);else game.click(game.uiPointer);
    });
    canvas.addEventListener("contextmenu",event=>{event.preventDefault();reset();game.cancel();});
    window.addEventListener("keydown",event=>{
      if(event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
      const key=event.key.toLowerCase();
      if(this.exited){if(key==="enter"){this.exited=false;Sound.unlock();}return;}
      Sound.unlock();
      if(key==="f"){event.preventDefault();this.toggleFullscreen();return;}
      if(key==="m"){Sound.toggle("music");return;}
      if(key==="escape"){
        if(game.modal==="codex")game.modal=game.codexReturn;
        else if(game.modal==="newCampaign")game.modal="saveSlots";
        else if(["loadout","intel"].includes(game.modal)&&game.screen==="menu")game.modal="level";
        else if(game.modal)game.modal=null;
        else if(game.screen==="battle"&&!game.selected&&!game.selectedSite&&!game.skill&&!game.rallyTower&&!game.traffic?.routeMenu)game.modal="battleMenu";
        game.cancel();return;
      }
      if(game.screen!=="battle"||game.modal)return;
      if(key===" "){event.preventDefault();game.paused=!game.paused;}
      if(key==="q")game.selectSkill(game.skillLoadout[0]);
      if(key==="e")game.selectSkill(game.skillLoadout[1]);
      if(/^[1-4]$/.test(key))game.selectBuild(game.loadout[Number(key)-1]);
    });
    const suspend=()=>{reset();game.lastTime=null;game.accumulator=0;if(game.screen==="battle")game.paused=true;Sound.stop();};
    window.addEventListener("blur",()=>{this.suspended=true;suspend();});
    window.addEventListener("focus",()=>{this.suspended=false;game.lastTime=null;game.accumulator=0;});
    document.addEventListener("visibilitychange",()=>{if(document.hidden)suspend();else{game.lastTime=null;game.accumulator=0;}});
    window.addEventListener("resize",()=>{reset();this.resize();});
    document.addEventListener("fullscreenchange",()=>{reset();this.resize();});
  },
  present(game) {
    const button=game.buttons.find(b=>!b.disabled&&Collision.inside(game.uiPointer||game.pointer,b));
    const build=game.screen==="battle"&&!game.modal&&(game.siteAt(game.pointer)||game.pickTower(game.pointer));
    this.canvas.style.cursor=button||build?"pointer":game.skill||game.rallyTower?"crosshair":"default";
  }
};
