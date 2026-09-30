"use strict";

// 原创交通图册视觉：纸纹、等高线、工业路牌。网页沿用手机美术，无位图素材。
const AtlasArt = {
  palettes: {city:"#d9cba5",country:"#cfcaa0",desert:"#dfc18e",hills:"#c8c8ad",sea:"#adc4bc",forest:"#b9c4a0"},
  paper(rect,theme="city") {
    const {x,y,w,h}=rect;
    ctx.fillStyle=this.palettes[theme];ctx.fillRect(x,y,w,h);
    ctx.save();
    // 确定性细纹，不使用逐帧随机，避免画面闪动。
    for(let n=0;n<420;n++){
      const px=x+(n*197.31)%w,py=y+(n*91.73)%h;
      ctx.fillStyle=n%3?"#77664712":"#fff4cc30";ctx.fillRect(px,py,2+n%5,1);
    }
    ctx.strokeStyle="#74664620";ctx.lineWidth=1.5;
    for(let n=0;n<14;n++){
      const px=x+(n*127)%w,py=y+(n*173)%h;
      ctx.beginPath();ctx.moveTo(px-120,py+36);ctx.bezierCurveTo(px-90,py-40,px+80,py+70,px+170,py-30);ctx.stroke();
    }
    ctx.restore();
  },
  scenery(rect,theme,seed=0,blocked=()=>false) {
    this.paper(rect,theme);const {x,y,w,h}=rect,R=Renderer;
    if(theme==="city"||theme==="country"||theme==="forest"){
      const river=[[x+w*.68,y-20],[x+w*.64,y+h*.23],[x+w*.74,y+h*.49],[x+w*.67,y+h*.72],[x+w*.73,y+h+20]];
      R.line(river,"#718f7d38",61);R.line(river,"#8da99a70",48);R.line(river,"#dce1bc80",2,[4,12]);
    }
    for(let n=0;n<(theme==="forest"?64:42);n++){
      const px=x+46+(n*173+seed*57)%Math.max(1,w-92),py=y+55+(n*137+seed*41)%Math.max(1,h-110);
      if(!blocked({x:px,y:py}))this.landmark(theme,px,py,.8+(n%3)*.16,n);
    }
  },
  landmark(theme,x,y,scale=1,variant=0) {
    const R=Renderer,ink="#796c4c",light="#ecdfb5",shade="#b5a57c";
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha=.77;
    if(theme==="city"){
      const kind=variant%6;
      if(kind===1){
        // 加油站：红陶雨棚、油泵、轮胎；区别于普通房屋的外轮廓。
        R.polygon([[-38,8],[7,-12],[40,9],[-4,31]],"#cbbd94",ink);
        R.line([[-21,5],[-21,-25]],ink,3);R.line([[23,2],[23,-27]],ink,3);
        R.polygon([[-37,-22],[1,-40],[38,-21],[0,-3]],"#bd8861",ink);
        R.line([[-28,-23],[0,-35],[27,-22]],"#eed3a1",2);
        for(const px of [-12,10]){R.box(px,0,10,19,light,ink,2);R.box(px+2,3,6,5,"#7c947e",null,1);R.line([[px+10,6],[px+15,10],[px+13,16]],ink,2);}
      }else if(kind===2){
        // 街心绿地与有方向箭头的环岛。
        R.oval(0,4,41,23,"#abb58a",ink);R.oval(0,3,29,14,"#d9c89d",ink);
        R.line([[-51,4],[-39,4]],ink,4);R.line([[39,4],[54,4]],ink,4);
        R.line([[0,-25],[0,-15]],ink,4);R.line([[0,22],[0,34]],ink,4);
        R.line([[-18,-11],[-8,-12],[-13,-16]],"#e8dfb9",2);
        R.line([[0,7],[0,-9]],ink,3);R.circle(0,-13,12,"#a5b184");R.circle(-4,-17,9,"#b7bf92");
      }else if(kind===3){
        // 车场：成排车棚、泊位和停放的小货车。
        R.polygon([[-39,9],[-12,-9],[42,9],[13,29]],"#c6b68c",ink);
        for(let i=0;i<3;i++){
          const dx=-22+i*17;R.box(dx,-4,13,18,i%2?"#a59572":"#b9a47b",ink,2);
          R.box(dx+2,-2,9,4,"#7c8774",null,1);R.line([[dx-2,18],[dx+10,23]],light,1.5);
        }
        R.line([[-28,-10],[2,-27],[42,-13]],ink,3);R.line([[-28,-10],[-28,5]],ink,2);R.line([[42,-13],[42,9]],ink,2);
      }else if(kind===4){
        // 铁路高架与桥墩。
        R.line([[-47,19],[43,-18]],ink,12);R.line([[-47,16],[43,-21]],"#c3b590",8);
        for(let i=0;i<7;i++)R.line([[-43+i*13,18-i*5],[-43+i*13,9-i*5]],"#7b7356",1.5);
        for(const px of [-25,22])R.line([[px,12-px*.4],[px,30-px*.4]],ink,5);
        R.line([[-48,24],[43,-13]],"#e7d4a7",1.5);
      }else{
      // 仓库、车库、交通信号与街区，而非城堡或纹章。
      const w=variant%2?48:36;
      R.polygon([[-w/2,5],[0,-7],[w/2,5],[0,18]],"#9e927448");
      R.polygon([[-w/2,-16],[0,-28],[w/2,-16],[0,-3]],light,ink);
      R.polygon([[-w/2,-16],[0,-3],[0,17],[-w/2,4]],shade,ink);
      R.polygon([[0,-3],[w/2,-16],[w/2,5],[0,17]],"#cfbd8e",ink);
      for(let i=0;i<3;i++)R.line([[4+i*6,-1-i*3],[4+i*6,10-i*3]],ink,1.6);
      if(variant%3===0){R.line([[31,8],[31,-27]],ink,3);R.box(25,-34,12,25,"#6d735c",ink,3);R.circle(31,-28,2,"#b97450");R.circle(31,-15,2,"#b0b27f");}
      else if(variant%3===1){R.box(-22,-35,7,16,shade,ink,1);R.line([[-24,-39],[-14,-42],[-20,-47]],"#8e83624d",3);}
      if(kind===5){R.box(-31,-41,8,25,shade,ink,1);R.line([[-32,-46],[-19,-49],[-24,-54]],"#8d826233",4);R.line([[-17,-13],[-4,-19],[10,-12]],"#aa9872",2);}
      }
    }else if(theme==="country"){
      R.polygon([[-30,13],[-1,0],[32,16],[0,33]],"#c0b781",ink);
      for(let i=0;i<5;i++)R.line([[-24+i*7,14-i*3],[3+i*6,28-i*3]],"#8f8961",1.3);
      R.polygon([[-12,4],[-7,-25],[7,-25],[12,4]],light,ink);
      R.line([[-22,-36],[22,-8]],ink,3);R.line([[-20,-7],[20,-38]],ink,3);R.circle(0,-22,4,shade);
    }else if(theme==="desert"){
      R.line([[-40,16],[-25,-7],[-2,-17],[30,9]],ink,2);
      R.line([[-34,21],[-15,5],[8,-2],[38,15]],"#b29567",2);
      R.line([[17,12],[17,-22]],"#7f8055",6);R.line([[17,-2],[29,-2],[29,-14]],"#7f8055",4);
      for(let i=0;i<5;i++)R.line([[-20+i*6,8],[-16+i*6,4]],"#a18458",1);
    }else if(theme==="hills"){
      R.polygon([[-42,25],[-11,-38],[30,25]],"#a7ad88",ink);
      R.polygon([[-11,-38],[30,25],[2,12]],"#979f80");
      R.line([[-22,-16],[-12,-22],[-3,-11]],light,3);
      for(let i=0;i<5;i++)R.line([[-28+i*5,18],[-19+i*5,2]],ink,1);
    }else if(theme==="sea"){
      for(let i=0;i<3;i++)R.line([[-38,12+i*11],[-24,15+i*11],[-8,12+i*11],[7,15+i*11],[28,11+i*11]],"#678e83",1.5);
      if(variant%2){R.polygon([[-28,0],[27,0],[16,13],[-19,13]],"#c6b68b",ink);R.line([[0,0],[0,-30]],ink,2);R.polygon([[4,-28],[4,-3],[23,-3]],light,ink);}
      else{R.polygon([[-11,8],[-6,-27],[6,-27],[11,8]],light,ink);R.box(-9,-34,18,10,"#b68b64",ink,2);R.line([[-7,-12],[7,-12]],"#a86148",5);}
    }else{
      for(let i=0;i<3;i++){
        const tx=(i-1)*23,ty=i%2*10;
        R.line([[tx,ty+20],[tx,ty-13]],ink,2);
        R.polygon([[tx-19,ty+10],[tx,ty-32],[tx+19,ty+10]],i%2?"#8c9c72":"#a3ae82",ink);
        R.line([[tx-8,ty],[tx,ty-20]],light,1.3);
      }
    }
    ctx.restore();
  },
  compass(x,y) {
    const R=Renderer;R.circle(x,y,41,"#e5d6ac88");
    R.line([[x-38,y],[x+38,y]],"#877651",1);R.line([[x,y-38],[x,y+38]],"#877651",1);
    R.polygon([[x,y-32],[x+9,y],[x,y+32],[x-9,y]],"#a56846","#746344");
    R.polygon([[x-32,y],[x,y-9],[x+32,y],[x,y+9]],"#d7c395","#746344");
    R.circle(x,y,5,"#566f62");R.text("N",x,y-53,16,"#786747","bold","center");
  },
  roadSign(x,y,label,{locked=false,boss=false,stars=0,active=false}={}) {
    const R=Renderer;
    R.line([[x+2,y+12],[x+2,y+43]],"#725d3c",7);R.line([[x,y+12],[x,y+40]],"#b1a485",3);
    R.polygon([[x-37,y-22],[x+31,y-22],[x+43,y],[x+31,y+25],[x-37,y+25]],"#584d3940");
    R.polygon([[x-39,y-26],[x+30,y-26],[x+41,y-2],[x+30,y+22],[x-39,y+22]],locked?"#a8a38b":active?"#bb6947":"#567b6e","#5b533c");
    R.line([[x-32,y-20],[x+25,y-20],[x+34,y-2],[x+25,y+16],[x-32,y+16],[x-32,y-20]],"#efdcaa",1.5);
    R.text(label,x-2,y-2,24,locked?"#d9d4b9":"#fff1cc","bold","center");
    if(boss){R.polygon([[x+28,y-42],[x+42,y-21],[x+14,y-21]],"#b75e43","#6c513c");R.text("!",x+28,y-29,16,"#fff1c6","bold","center");}
    for(let i=0;i<3;i++)R.text(i<stars?"★":"☆",x-22+i*22,y-42,19,i<stars?"#a97831":"#9e9271","bold","center");
  },
  chain(rect) {
    const {x,y,w,h}=rect,R=Renderer;
    ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,6);ctx.clip();
    R.box(x,y,w,h,"#514b3d25",null,0);
    for(const slope of [-1,1]){
      const ax=x-8,ay=y+h/2-slope*h*.42,bx=x+w+8,by=y+h/2+slope*h*.42;
      const length=Math.hypot(bx-ax,by-ay),angle=Math.atan2(by-ay,bx-ax);
      ctx.save();ctx.translate(ax,ay);ctx.rotate(angle);
      for(let d=0;d<length;d+=13){
        ctx.beginPath();ctx.ellipse(d,2,11,5,0,0,Math.PI*2);ctx.strokeStyle="#413e35";ctx.lineWidth=6;ctx.stroke();
        ctx.beginPath();ctx.ellipse(d,0,10,4,0,0,Math.PI*2);ctx.strokeStyle=d%26?"#9b9e94":"#c2c2ad";ctx.lineWidth=3;ctx.stroke();
      }ctx.restore();
    }
    const cx=x+w/2,cy=y+h/2;
    R.box(cx-13,cy-20,26,29,"#777e73","#3e453c",10);R.box(cx-7,cy-15,14,20,"#d0c5a4",null,5);
    R.box(cx-21,cy-5,42,34,"#b59655","#594d34",6);R.box(cx-15,cy,30,23,"#cfb373",null,4);
    R.circle(cx,cy+8,4,"#514b37");R.polygon([[cx-2,cy+9],[cx+2,cy+9],[cx+4,cy+19],[cx-4,cy+19]],"#514b37");
    ctx.restore();
  }
};

Object.assign(COLORS,{bg:"#d9cba5",panel:"#ebdebb",ink:"#443f30",muted:"#7f7459",mint:"#4d796b",gold:"#b5843f",red:"#af5b40",border:"#99825b"});
// 纸面上使用更深的识别色，避免沿用深色界面上的浅色字导致对比不足。
for(const [type,color] of Object.entries({rail:"#39786e",signal:"#636c86",missile:"#a56837",depot:"#8b5e78"}))TOWERS[type].color=color;
Object.assign(Renderer,{
  button(game,rect,label,action,options={}) {
    const hover=Collision.inside(game.uiPointer||game.pointer,rect),disabled=!!options.disabled;
    const fill=disabled?"#c7bea0":options.primary?"#d9b66d":hover?"#f3e3b9":"#e4d3a9";
    this.box(rect.x+1,rect.y+4,rect.w,rect.h,"#574c3c32",null,8);
    this.box(rect.x,rect.y,rect.w,rect.h,fill,options.active?"#466e61":"#8a7250",8);
    this.line([[rect.x+9,rect.y+5],[rect.x+rect.w-9,rect.y+5]],"#fff0c280",2);
    for(const dx of [8,rect.w-8])this.circle(rect.x+dx,rect.y+rect.h/2,1.8,"#a9905f");
    this.text(label,rect.x+rect.w/2,rect.y+rect.h/2,options.size||20,disabled?"#8a8167":COLORS.ink,"bold","center");
    game.buttons.push({...rect,label,action,disabled,locked:!!options.locked,branch:options.branch,towerType:options.towerType,routeIndex:options.routeIndex});
  }
});
