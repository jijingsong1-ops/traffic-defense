"use strict";

const { MiniGameSound } = require("./audio.js");

// 全屏画布和逻辑坐标分开：背景覆盖屏幕，安全区只约束按钮，不缩小整幅画面。
function createPlatform(wx) {
  const screen = wx.createCanvas();
  const canvas = wx.createCanvas();
  canvas.style = {};
  const output = screen.getContext("2d");
  const platform = {
    touch:true, hidden:false, canvas, screen, viewport:null, game:null, sound:null,
    storage:{
      getItem(key) { const value=wx.getStorageSync(key);return value===""?null:value; },
      setItem(key,value) { wx.setStorageSync(key,value); }
    },
    createSound(options) {
      this.sound=new MiniGameSound(wx,options,()=>this.hidden);
      return this.sound;
    },
    exitGame(onFail) {
      if (wx.exitMiniProgram) wx.exitMiniProgram({fail:onFail});
      else onFail();
    },
    initialize(config,ctx) {
      this.config=config;this.context=ctx;
      // 较老的 Canvas 实现可能没有 roundRect/ellipse。
      if(!ctx.roundRect)ctx.roundRect=function(x,y,w,h,r=0){
        r=Math.min(typeof r==="number"?r:r[0]||0,w/2,h/2);
        this.moveTo(x+r,y);this.lineTo(x+w-r,y);this.quadraticCurveTo(x+w,y,x+w,y+r);
        this.lineTo(x+w,y+h-r);this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
        this.lineTo(x+r,y+h);this.quadraticCurveTo(x,y+h,x,y+h-r);
        this.lineTo(x,y+r);this.quadraticCurveTo(x,y,x+r,y);this.closePath();
      };
      if(!ctx.ellipse)ctx.ellipse=function(x,y,rx,ry,rotation,start,end){
        this.save();this.translate(x,y);this.rotate(rotation);this.scale(rx,ry);this.arc(0,0,1,start,end);this.restore();
      };
      this.resize();
    },
    resize() {
      const info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();
      const width=info.windowWidth,height=info.windowHeight;
      const safe=info.safeArea||{left:0,top:0,right:width,bottom:height};
      const capsule=wx.getMenuButtonBoundingClientRect?wx.getMenuButtonBoundingClientRect():null;
      const scale=Math.min(width/1280,height/720);
      this.pixelRatio=Math.min(info.pixelRatio||1,2);
      this.viewport={left:0,top:0,width,height,scale};
      this.layout={width:width/scale,height:height/scale,
        safe:{left:(safe.left||0)/scale,top:(safe.top||0)/scale,right:(safe.right??width)/scale,bottom:(safe.bottom??height)/scale},
        capsule:capsule&&capsule.width>0?{x:capsule.left/scale,y:capsule.top/scale,w:capsule.width/scale,h:capsule.height/scale}:null};
      screen.width=Math.round(width*this.pixelRatio);screen.height=Math.round(height*this.pixelRatio);
      canvas.width=screen.width;canvas.height=screen.height;
      this.context.setTransform(scale*this.pixelRatio,0,0,scale*this.pixelRatio,0,0);
      if(this.game){this.game.lastTime=null;this.game.accumulator=0;this.game.buttons=[];this.game.mobileCamera=null;}
    },
    toCanvas(touch) {
      const v=this.viewport;
      return {x:(touch.clientX-v.left)/v.scale,y:(touch.clientY-v.top)/v.scale};
    },
    bindInput(game) {
      this.game=game;
      let gesture=null;
      const reset=()=>{gesture=null;game.pointer={x:-100,y:-100};game.uiPointer={x:-100,y:-100};};
      wx.onTouchStart(event=>{
        if(this.hidden||event.touches.length!==1){reset();return;}
        const touch=event.touches[0];
        gesture={id:touch.identifier,x:touch.clientX,y:touch.clientY,screen:game.screen,modal:game.modal,moved:false};
        this.sound.unlock();game.uiPointer=this.toCanvas(touch);
        game.pointer=this.worldPoint?this.worldPoint(game,game.uiPointer):game.uiPointer;
      });
      wx.onTouchMove(event=>{
        if(!gesture)return;
        const touch=event.touches.find(t=>t.identifier===gesture.id);
        if(!touch||Math.hypot(touch.clientX-gesture.x,touch.clientY-gesture.y)>12)gesture.moved=true;
      });
      wx.onTouchEnd(event=>{
        const touch=gesture&&event.changedTouches.find(t=>t.identifier===gesture.id);
        if(touch&&!gesture.moved&&gesture.screen===game.screen&&gesture.modal===game.modal){
          const point=this.toCanvas(touch);
          if(point.x>=0&&point.x<=this.layout.width&&point.y>=0&&point.y<=this.layout.height){
            if(this.handleTap)this.handleTap(game,point);else game.click(point);
          }
        }
        reset();
      });
      wx.onTouchCancel(reset);
      wx.onHide(()=>{this.hidden=true;reset();game.lastTime=null;game.accumulator=0;if(game.screen==="battle")game.paused=true;this.sound.stop();});
      wx.onShow(()=>{this.hidden=false;game.lastTime=null;game.accumulator=0;this.resize();});
      if(wx.onWindowResize)wx.onWindowResize(()=>{reset();this.resize();});
    },
    present() {
      if(this.hidden)return;
      output.drawImage(canvas,0,0,canvas.width,canvas.height,0,0,screen.width,screen.height);
    }
  };
  return platform;
}
module.exports={createPlatform};
