"use strict";

// 精细交通单位：缩小轮廓，用面板、玻璃反光、铆钉和章节设备表现差异。
// 仅绘制，生命、碰撞和道路位置由 Enemy 维护。
Object.assign(Renderer, {
  vehicle(type,x,y,angle=0,frozen=false,shield=false) {
    const spec=ENEMIES[type],kind=spec.visual||type,boss=spec.boss;
    const tiny=kind==="runner"||kind==="swarm";
    const w=boss?54:tiny?23:kind==="splitter"?37:32,h=boss?30:tiny?13:21;
    const ink="#31454b",metal="#d0d6bd",glass="#284e63",paint=frozen?"#acd5df":spec.color;
    ctx.save();ctx.translate(x,y);ctx.scale(CONFIG.enemyVisualScale,CONFIG.enemyVisualScale);
    if(shield){
      this.oval(0,0,w*.66,h*.87,"#b4ecf51f","#80bbd6");
      this.line([[-w*.48,-h*.65],[-w*.6,0],[-w*.48,h*.65]],"#d8f4eb",1.5);
    }
    ctx.rotate(angle);
    this.oval(2,5,w*.54,h*.57,"#263d403d");
    if(spec.skin==="sea"){
      this.polygon([[-w/2,-h/2],[w/2-5,-h/2],[w/2+5,0],[w/2-5,h/2],[-w/2,h/2],[-w/2+3,0]],paint,ink);
      this.polygon([[-w/2+4,-h/2+3],[w/2-6,-h/2+3],[w/2,0],[w/2-6,h/2-3],[-w/2+4,h/2-3]],"#dcdcc2");
      for(const side of [-1,1])this.line([[-w/2+3,side*(h/2-1)],[w/2-6,side*(h/2-1)]],"#fff0ce",1);
      this.box(-9,-h/2+5,16,h-10,paint,ink,3);
      this.box(0,-h/2+6,5,h-12,glass,null,1);
      this.line([[1,-h/2+7],[3,-h/2+9]],"#a6d5d3",1);
      this.line([[-w/2-3,-6],[-w/2-7,0],[-w/2-3,6]],"#dbe6ce",1.5);
      for(const side of [-1,1])this.circle(-7,side*(h/2-2),1.5,"#b99c6d");
      if(boss){this.box(-13,-7,11,14,"#627f86",ink,2);this.circle(-8,0,4,metal);this.line([[-8,0],[11,0]],ink,4);this.line([[-8,-1],[11,-1]],metal,1);}
      if(spec.heal){this.line([[-7,-4],[-7,4]],"#5f956a",2);this.line([[-11,0],[-3,0]],"#5f956a",2);}
    }else if(kind==="runner"&&spec.skin!=="desert"){
      for(const px of [-10,10]){this.box(px-3,-4,6,8,ink,null,2);this.line([[px-1,-3],[px-1,3]],"#9daea5",1);}
      this.box(-8,-4,16,8,paint,ink,3);
      this.line([[-7,-2],[4,-2]],"#fff2c9",1);
      this.oval(-1,0,5,4,"#bca580",ink);this.circle(1,-1,3.5,glass);this.line([[1,-3],[3,-2]],"#badbd8",1);
      this.line([[7,-6],[7,6]],metal,1.5);this.circle(11,0,1.5,"#fff1b4");
    }else{
      const armored=kind==="armor"||boss;
      if(armored&&spec.skin==="hills"){
        for(const side of [-1,1]){
          this.box(-w/2,side*h/2-3,w,6,ink,null,2);
          for(let px=-w/2+3;px<w/2;px+=5)this.line([[px,side*h/2-2],[px,side*h/2+2]],"#8a9b98",1);
        }
      }else for(const px of boss?[-19,0,19]:[-w*.3,w*.3])for(const side of [-1,1]){
        this.box(px-4,side*h/2-3,8,6,ink,null,2);this.line([[px-2,side*h/2],[px+2,side*h/2]],"#8b9a94",1);
      }
      this.box(-w/2,-h/2,w,h,paint,ink,4);
      this.box(-w/2+2,h/2-5,w-4,3,"#31454b33",null,1);
      this.line([[-w/2+4,-h/2+2],[w/2-5,-h/2+2]],"#fff4d6b8",1.3);
      this.box(w/2-10,-h/2+3,6,h-6,glass,metal,2);
      this.line([[w/2-9,-h/2+4],[w/2-6,-h/2+7]],"#bdded9",1);
      this.line([[w/2-3,-h/2+3],[w/2-3,h/2-3]],ink,1);
      this.box(-w/2+4,-h/2+4,w-17,h-8,armored?"#72858a":paint,"#31454b88",2);
      for(const side of [-1,1]){
        this.box(w/2-2,side*(h/2-4)-1,2,3,"#fff1ab",null,1);
        this.box(-w/2,side*(h/2-4)-1,2,3,"#c86c54",null,1);
        this.circle(-w/2+5,side*(h/2-3),.9,metal);
      }
      if(kind==="healer"){
        this.box(-9,-h/2+5,9,h-10,"#e4e3bc",ink,2);
        this.line([[-5,-4],[-5,4]],"#60977c",2.5);this.line([[-9,0],[-1,0]],"#60977c",2.5);
        this.box(2,-h/2-1,4,2,"#eabc67",null,1);
      }else if(armored){
        this.box(-9,-6,16,12,"#8f9c96",ink,3);this.line([[-6,-4],[3,-4]],metal,1);
        this.circle(-3,0,3.5,"#52666a");this.box(1,-2,boss?22:13,4,ink,metal,1);
        this.box(boss?20:11,-2,3,4,"#31454b",null,1);
        for(const side of [-1,1])this.circle(-7,side*4,1,metal);
        if(boss){
          for(const side of [-1,1]){this.box(-23,side*10-2,11,4,"#e9bf73",ink,1);this.line([[-22,side*10-1],[-19,side*10+1],[-16,side*10-1]],ink,1);}
          for(let px=-21;px<-10;px+=3)this.line([[px,-5],[px,5]],"#2f454e",1);
        }
      }else if(kind==="shield"){
        this.oval(-5,0,6,7,"#36566c",metal);this.oval(-5,0,3.5,5,"#87c4cf");this.line([[-5,-3],[-5,3]],"#eaf8db",1.5);
      }else if(kind==="splitter"){
        for(const px of [-13,-6,1]){this.box(px,-6,5,12,"#92779d",ink,1);this.line([[px+1,-4],[px+3,-4]],"#e5ccb9",1);this.circle(px+2.5,3,1,"#d4c7e1");}
      }else{
        this.line([[-8,-4],[0,-4],[2,1]],"#fff0c899",1);this.box(-7,-2,7,5,"#294b5866",null,1);
      }
      // 小尺寸章节设备，始终保持在原有轮廓内。
      if(spec.skin==="country"){
        this.line([[-w/2+3,-h/2+1],[-w/2+3,h/2-1]],"#806c46",2);
        if(boss)for(let py=-10;py<=10;py+=4)this.line([[w/2-2,py],[w/2+2,py]],"#d9c28b",1);
      }else if(spec.skin==="desert"){
        this.circle(-w/2+6,0,4,ink);this.circle(-w/2+6,0,2,"#bf9c72");
        this.line([[-2,-h/2+4],[2,-h/2+4]],"#fff0ce",1);
      }else if(spec.skin==="forest"){
        for(const side of [-1,1]){
          this.polygon([[-w/2+2,side*3],[-w/2+8,side*(h/2+2)],[-2,side*(h/2-1)]],"#77945c",ink);
          this.line([[-w/2+4,side*4],[-5,side*(h/2-1)]],"#bdd293",1);
        }
        if(spec.heal)this.circle(-6,0,3,"#c8e7aa");
      }
    }
    if(frozen)this.line([[-w/2+2,-h/2],[0,-h/2-1],[w/2-3,-h/2]],"#e3f6f1",1.5);
    ctx.restore();
  }
});
