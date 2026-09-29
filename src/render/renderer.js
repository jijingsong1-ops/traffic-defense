"use strict";

const Renderer = {
  box(x, y, w, h, color, border = null, radius = 10) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = color; ctx.fill();
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.stroke(); }
  },
  text(label, x, y, size = 14, color = COLORS.ink, weight = "normal", align = "left") {
    ctx.font = `${weight} ${size}px "Microsoft YaHei", system-ui, sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillStyle = color; ctx.fillText(label, x, y);
  },
  circle(x, y, r, color) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); },
  button(game, rect, label, action, options = {}) {
    const hover = Collision.inside(game.pointer, rect), color = options.color || COLORS.mint;
    this.box(rect.x, rect.y, rect.w, rect.h, options.disabled ? "#274448" : options.primary ? color : hover ? "#355b59" : "#24494e",
      options.active ? color : options.disabled ? "#293d48" : hover ? color : COLORS.border, 7);
    this.text(label, rect.x + rect.w / 2, rect.y + rect.h / 2, options.size || 13,
      options.disabled ? "#607d8b" : options.primary ? "#102c30" : options.active ? color : COLORS.ink, "bold", "center");
    game.buttons.push({ ...rect, action, disabled: options.disabled });
  },
  range(p, radius, color = COLORS.mint) {
    ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.globalAlpha = 0.1; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 0.75;
    ctx.strokeStyle = color; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  },
  // 所有美术由 Canvas 矢量绘制，无外部图片依赖。
  polygon(points, fill, stroke = null) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  },
  line(points, color, width, dash = []) {
    ctx.save(); ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.setLineDash(dash);
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.restore();
  },
  tree(x, y, size = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
    this.circle(5, 8, 14, "#244e4430"); this.box(-2, 0, 4, 14, "#766a4b", null, 1);
    this.circle(0, -4, 12, "#376b56"); this.circle(-4, -8, 9, "#659773"); this.circle(4, -11, 8, "#82aa78");
    this.circle(-5, -13, 3, "#a3c28a"); ctx.restore();
  },
  building(x, y, w, h, kind = 0, theme = "garden") {
    // 统一的斜投影建筑：投影、侧墙、正面、屋顶、窗户和屋顶设备。
    const palettes = theme === "harbor" ? [["#9bb5ac", "#637b78"], ["#d5b17b", "#98774e"], ["#b59181", "#876951"]]
      : [["#e9d4ad", "#ae9171"], ["#a9c4bb", "#708f8b"], ["#d6a78c", "#a7775d"], ["#bdc6c9", "#7c9198"]];
    const [roof, wall] = palettes[kind % palettes.length], lift = 9 + kind % 3 * 5;
    this.polygon([[x,y],[x+w,y],[x+w+12,y+h+12],[x+10,y+h+12]], "#264c4430");
    this.box(x, y, w, h, wall, "#637469", 3);
    this.box(x, y-lift, w, h, roof, "#f6efdaaa", 3);
    this.box(x+4, y-lift+4, w-8, h-8, kind % 3 === 0 ? "#718f8d" : roof, "#ffffff30", 2);
    for (let wx=x+5; wx<x+w-7; wx+=12) {
      this.box(wx, y+h-lift+3, 7, Math.max(4, lift-5), "#3c6571", null, 1);
      this.line([[wx+1,y+h-lift+4],[wx+5,y+h-lift+4]], "#d5e8d8", 1);
    }
    if (kind % 3 === 0) {
      this.box(x+6, y-lift+8, w-12, 9, "#d7e5d7", null, 1);
      this.text(theme === "harbor" ? "CARGO" : "MART", x+w/2, y-lift+13, 7, "#476c68", "bold", "center");
    } else {
      this.box(x+w-19, y-lift+8, 12, 10, "#cbd2c6", "#7b9991", 2);
      this.line([[x+w-16,y-lift+11],[x+w-10,y-lift+11]], "#79948e", 1);
      if (kind % 2) this.box(x+7, y-lift+7, 14, 18, "#557581", "#bfd2ce", 1);
    }
  },
  road(road, mini = false, chapter = null) {
    ctx.save();
    const edges = (width, color, dash=[]) => { for (const [a,b] of road.edges) this.line([[a.x,a.y],[b.x,b.y]],color,width,dash); };
    if(chapter&&chapter.theme!=="city") {
      const sea=chapter.theme==="sea";
      edges(CONFIG.roadWidth+14,sea?"#77b4be":"#786f50");edges(CONFIG.roadWidth+9,sea?"#568a9f":"#d4ba83");
      edges(CONFIG.roadWidth,chapter.road);edges(2,sea?"#c5e2d6":"#dccaa0",[5,12]);
      ctx.restore();return;
    }
    edges(CONFIG.roadWidth+24,"#718c83"); edges(CONFIG.roadWidth+19,"#d2d1b7");
    edges(CONFIG.roadWidth+7,"#79877e"); edges(CONFIG.roadWidth+2,"#64747a"); edges(CONFIG.roadWidth-4,"#596c73");
    edges(1.5,"#dedbbb",[9,14]);
    if (!mini) for (const [a,b] of road.edges) {
      const length=Collision.distance(a,b), angle=Math.atan2(b.y-a.y,b.x-a.x);
      ctx.save(); ctx.translate((a.x+b.x)/2,(a.y+b.y)/2); ctx.rotate(angle);
      this.line([[-5,-5],[2,0],[-5,5]],"#e4e5cf",2);
      if(length>135) {
        ctx.translate(-length*0.29,0);
        for(let x=-12;x<14;x+=5) this.box(x,-15,3,30,"#e8e7d0",null,0);
      }
      ctx.restore();
    }
    ctx.restore();
  },
  vehicle(type, x, y, angle = 0, frozen = false, shield = false) {
    const spec=ENEMIES[type], boss=spec.boss, visual=spec.visual||type, tiny=visual==="runner"||visual==="swarm";
    ctx.save(); ctx.translate(x,y);
    if(shield) { this.circle(0,0,boss?33:23,"#a3e9f52c"); this.line([[-17,-14],[-22,-3],[-19,13]],"#bbf5ff",2); }
    ctx.rotate(angle);
    const w=boss?54:tiny?23:visual==="splitter"?37:32, h=boss?30:tiny?13:21;
    this.box(-w/2+3,-h/2+5,w,h,"#17373845",null,5);
    if(spec.skin==="sea") {
      this.polygon([[-w/2-5,-h/2],[w/2-3,-h/2],[w/2+10,0],[w/2-3,h/2],[-w/2-5,h/2]],spec.color,"#35596b");
      this.box(-w/2+3,-h/2+3,w-11,h-6,"#f1e6c6","#536e76",4);
      this.box(0,-h/2+5,10,h-10,"#446e85",null,2);
      this.line([[-w/2-12,-h/2],[-w/2-18,0],[-w/2-12,h/2]],"#cce8db",2);
      if(spec.heal){this.line([[-7,-5],[-7,5]],"#6aa58a",3);this.line([[-12,0],[-2,0]],"#6aa58a",3);}
    } else if(spec.skin==="forest") {
      this.circle(1,3,boss?24:tiny?10:17,"#3c5a3e");this.circle(0,0,boss?22:tiny?9:16,spec.color);
      this.polygon([[-9,-10],[-18,-24],[0,-14],[12,-23],[14,-5]],"#5b844d","#36573c");
      this.circle(9,-5,4,"#e5d99a");this.circle(9,5,4,"#e5d99a");this.circle(11,-5,2,"#394c36");this.circle(11,5,2,"#394c36");
      for(const dy of [-15,15])this.line([[-12,dy],[-21,dy*1.2]],"#506f45",5);
      if(spec.heal)this.circle(-5,0,5,"#def4b5");
    } else if(visual==="runner") {
      for(const wx of [-11,10]) this.box(wx-3,-4,7,8,"#263c43","#9baca6",3);
      this.box(-9,-4,19,8,frozen?"#aae2ee":spec.color,"#825e4a",3);
      this.circle(-1,0,5,"#e1d1ac"); this.circle(1,-1,4,"#3c6574");
      this.line([[7,-7],[7,7]],"#b7c2b5",2);
    } else {
      for(const wx of boss?[-19,0,19]:[-10,10]) for(const wy of [-h/2,h/2]) this.box(wx-4,wy-2,8,5,"#283b43","#b4bcaa",2);
      this.box(-w/2,-h/2,w,h,frozen?"#a1ddeb":spec.color,"#50655f",4);
      this.box(w/2-10,-h/2+3,6,h-6,"#365c6c","#c6e0d8",2);
      this.box(-w/2+5,-h/2+4,w-20,h-8,visual==="armor"||boss?"#6d7c79":"#e6dfc655",null,2);
      for(const wy of [-h/2+2,h/2-5]) this.box(w/2-2,wy,3,3,"#fff4ba",null,1);
      this.box(-w/2-1,-h/2+2,2,4,"#bb514c",null,1);
      if(visual==="healer") { this.box(-6,-6,4,12,"#f3ffeb",null,1); this.box(-10,-2,12,4,"#f3ffeb",null,1); }
      if(visual==="armor"||boss) {
        this.box(-9,-7,17,14,"#80928b","#d8d6b4",3);
        this.box(3,-3,boss?23:17,6,"#4c6264","#b6c4b2",2);
        if(boss) for(const wy of [-13,10]) this.box(-25,wy,10,3,"#f5c176",null,1);
      }
      if(visual==="splitter") for(const wx of [-13,-6,1]) this.box(wx,-7,5,14,"#8c6ca8","#e5caeb",1);
      if(visual==="shield") this.line([[-8,-7],[-8,7]],"#c4f4ff",3);
    }
    ctx.restore();
  },
  enemy(enemy) {
    this.vehicle(enemy.type,enemy.x,enemy.y,enemy.angle,enemy.stunTime>0||enemy.slowTime>0,enemy.shield>0);
    const w=enemy.spec.boss?54:30;
    this.box(enemy.x-w/2,enemy.y-28,w,4,"#214047",null,2);
    this.box(enemy.x-w/2,enemy.y-28,w*Math.max(0,enemy.health/enemy.maxHealth),4,enemy.spec.boss?"#f59278":"#b8e691",null,2);
    if(enemy.maxShield) this.box(enemy.x-w/2,enemy.y-34,w*enemy.shield/enemy.maxShield,3,"#aae3f3",null,1);
    if(enemy.burnTime>0) { this.circle(enemy.x-10,enemy.y+6,5,"#ffb159"); this.circle(enemy.x-10,enemy.y+3,3,"#ffe394"); }
  },
  header(game, battle) {
    this.box(0,0,1280,98,"#17373e",null,0);
    this.box(27,22,48,48,"#e8d6a8",null,12);
    this.line([[38,57],[47,35],[55,57],[64,35]],"#315951",4);
    this.text("路网守卫",90,39,27,COLORS.ink,"bold");
    this.text(`城市防卫计划 / CITY GUARD / ${CONFIG.version}`,91,70,10,COLORS.muted);
    this.button(game,{x:312,y:24,w:91,h:28},Sound.unavailable?"声音不可用":`音效 ${Sound.enabled?"开":"关"}`,()=>Sound.toggle("effects"),{size:11});
    this.button(game,{x:312,y:58,w:91,h:25},`音乐 ${Sound.musicEnabled?"开":"关"}`,()=>Sound.toggle("music"),{size:11});
    this.text(`曲目：${MUSIC_TRACKS[CHAPTERS[battle?game.level.chapter:game.menuChapter].theme].name}`,357,94,10,COLORS.muted,"normal","center");
    if(!battle) {
      this.text(`第 ${game.menuChapter + 1} 章 · ${CHAPTERS[game.menuChapter].name}`,442,42,20,COLORS.gold,"bold");
      this.text(CHAPTERS[game.menuChapter].note,443,69,11,COLORS.muted);
      this.text(`★ ${game.progress.stars.reduce((a,b)=>a+b,0)} / ${LEVELS.length*3}`,900,46,23,COLORS.gold,"bold");
      this.text(`${game.progress.stars.filter(Boolean).length} / ${LEVELS.length} 街区守卫完成`,1236,48,15,COLORS.mint,"bold","right");
      return;
    }
    [[`♥ ${game.lives} / 20`,COLORS.red],[`${game.gold} G`,COLORS.gold],[`波次 ${game.wave} / ${game.level.waves}`,COLORS.mint]].forEach(([label,color],i)=>{
      this.box(418+i*157,24,145,55,"#21474b",COLORS.border); this.text(label,490+i*157,52,18,color,"bold","center");
    });
    this.button(game,{x:910,y:30,w:94,h:42},game.paused?"▶ 继续":"Ⅱ 暂停",()=>{game.paused=!game.paused;},{active:game.paused});
    this.button(game,{x:1014,y:30,w:90,h:42},`速度 ×${game.speed}`,()=>{game.speed=game.speed%3+1;});
    this.button(game,{x:1114,y:30,w:142,h:42},"敌情图鉴",()=>{game.intelChapter=game.screen==="menu"?game.menuChapter:game.level.chapter;game.modal="intel";});
  },
  // 手绘式地貌：大色块、深轮廓、分层阴影。地形与装饰共用，选关地图和战场各有布局。
  landmark(theme,x,y,size=1,variant=0) {
    ctx.save();ctx.translate(x,y);ctx.scale(size,size);
    if(theme==="city") this.building(-23,-10,46,36,variant%4,"garden");
    else if(theme==="country") {
      if(variant%3===0) {
        this.polygon([[-12,20],[-7,-20],[7,-20],[12,20]],"#eee0bc","#6f7051");
        this.polygon([[-13,-20],[0,-33],[13,-20]],"#aa6750","#634e40");
        this.line([[-24,-32],[24,6]],"#eee5c5",6);this.line([[-24,6],[24,-32]],"#eee5c5",6);
        this.circle(0,-13,4,"#775b3f");
      } else {
        this.box(-22,-4,44,29,"#e0c38b","#6e664a",3);
        this.polygon([[-28,-4],[0,-24],[28,-4]],"#af664a","#6f4938");
        this.box(-5,8,10,17,"#72634b",null,1);this.box(-16,4,8,9,"#aacbd0","#675e43",1);
      }
    } else if(theme==="desert") {
      if(variant%3===0) {
        this.box(-6,-23,12,48,"#809257","#586945",5);
        this.line([[-4,4],[-17,4],[-17,-11]],"#586945",9);this.line([[5,-4],[18,-4],[18,-20]],"#586945",9);
        this.line([[-4,3],[-17,3],[-17,-10]],"#8a9a5d",5);this.line([[5,-5],[18,-5],[18,-19]],"#8a9a5d",5);
      } else {
        this.polygon([[-31,20],[-19,-17],[1,-30],[24,-8],[31,20]],"#be9666","#84684d");
        this.polygon([[-19,-17],[1,-30],[5,18],[-31,20]],"#d8b079");
        this.line([[-14,4],[0,-2],[14,3]],"#a88055",2);
      }
    } else if(theme==="hills") {
      this.polygon([[-46,27],[-9,-41],[9,-26],[42,27]],"#84927e","#566254");
      this.polygon([[-9,-41],[9,-26],[42,27],[2,17]],"#69776b");
      this.polygon([[-9,-41],[-23,-15],[-10,-20],[0,-10],[9,-26]],"#dbdcc6","#7d8878");
      this.line([[-23,16],[-10,-4],[-4,6]],"#aeb8a0",2);
    } else if(theme==="sea") {
      this.circle(0,13,27,"#dccd9d");this.circle(0,9,23,"#a7ba86");
      if(variant%3===0) {
        this.polygon([[-11,16],[-6,-31],[6,-31],[11,16]],"#ece2c7","#5d7568");
        this.box(-8,-33,16,10,"#688c9a","#465d65",2);this.polygon([[-12,-35],[0,-44],[12,-35]],"#c58058","#675243");
        this.box(-8,-5,16,8,"#c37b59",null,1);
      } else {
        this.line([[0,18],[4,-16]],"#8e7450",6);
        for(const dx of [-22,-12,12,23])this.line([[4,-16],[dx,-25],[dx*1.2,-12]],"#567f58",5);
      }
    } else {
      this.box(-4,4,8,29,"#796b45","#48573c",2);
      this.polygon([[-25,15],[0,-32],[25,15]],"#426b4b","#2e513b");
      this.polygon([[-21,0],[0,-43],[21,0]],"#598252","#375c40");
      this.polygon([[-15,-14],[0,-50],[15,-14]],"#7e9e61","#466b48");
      this.line([[-8,-12],[0,-30]],"#a1b47b",2);
    }
    ctx.restore();
  },
  landscape(chapter,rect,seed,blocked=()=>false) {
    const {x,y,w,h}=rect,theme=chapter.theme;
    this.box(x,y,w,h,chapter.terrain,null,12);
    if(theme==="city") {
      this.polygon([[x+w*.56,y],[x+w*.71,y],[x+w*.64,y+h],[x+w*.47,y+h]],chapter.water);
      for(let n=0;n<4;n++)this.line([[x+55,y+105+n*125],[x+w-35,y+105+n*125]],"#ced1b2",15);
    } else if(theme==="country") {
      for(let row=0;row<4;row++)for(let col=0;col<6;col++) {
        const fx=x+22+col*w/6,fy=y+25+row*h/4;
        this.box(fx,fy,w/6-18,h/4-19,(row+col)%2?"#c8b46c":"#9fb56b","#88975d",8);
        for(let r=0;r<5;r++)this.line([[fx+9,fy+13+r*17],[fx+w/6-28,fy+13+r*17]],"#e6d59a60",3);
      }
      this.line([[x+w*.65,y],[x+w*.58,y+h*.35],[x+w*.7,y+h*.65],[x+w*.57,y+h]],chapter.water,28);
    } else if(theme==="desert") {
      for(let n=0;n<12;n++) {
        const dx=x+50+(n*177+seed*29)%(w-90),dy=y+35+(n*101)%(h-50);
        this.line([[dx-42,dy+18],[dx-15,dy],[dx+24,dy-5],[dx+65,dy+10]],"#c19d6b",4);
        this.line([[dx-35,dy+13],[dx-10,dy-4],[dx+30,dy-9]],"#efdab0",5);
      }
      this.box(x+w*.47,y+h*.32,126,84,"#b2b982",null,40);
      this.box(x+w*.48,y+h*.34,101,61,chapter.water,"#719b86",32);
    } else if(theme==="hills") {
      for(let n=0;n<6;n++) {
        const hx=x+w*.15+n*w*.14,hy=y+h*.68-n*h*.09;
        this.line([[hx-95,hy+75],[hx-65,hy-5],[hx,hy-38],[hx+62,hy],[hx+95,hy+65]],"#8e9e85",32);
        this.line([[hx-95,hy+62],[hx-58,hy-18],[hx,hy-50],[hx+67,hy-8]],"#c6cbb0",3);
      }
    } else if(theme==="sea") {
      for(let n=0;n<48;n++) {
        const wx=x+25+(n*139+seed*23)%(w-60),wy=y+25+(n*77)%(h-45);
        this.line([[wx,wy],[wx+9,wy+3],[wx+22,wy]],"#aad2cf80",2);
      }
      for(let n=0;n<7;n++) {
        const ix=x+90+(n*213+seed*19)%(w-170),iy=y+70+(n*143)%(h-150);
        this.box(ix-45,iy-24,95,65,"#d8c99c","#b4bb91",29);this.box(ix-37,iy-23,79,53,chapter.land,null,24);
      }
    } else {
      for(let n=0;n<16;n++)this.circle(x+40+(n*181+seed*21)%(w-70),y+40+(n*131)%(h-75),42+n%3*13,n%2?"#658b66":"#86a675");
      this.line([[x+w*.29,y],[x+w*.36,y+h*.28],[x+w*.22,y+h*.55],[x+w*.45,y+h]],chapter.water,20);
    }
    for(let n=0;n<(theme==="forest"?70:27);n++) {
      const px=x+37+(n*137+seed*41)%(w-75),py=y+65+(n*97+seed*13)%(h-102);
      if(!blocked({x:px,y:py}))this.landmark(theme,px,py,theme==="forest"?.8:0.75+(n%3)*.13,n);
    }
  },
  campaignMap(game) {
    const chapter=CHAPTERS[game.menuChapter],first=game.menuChapter*CONFIG.levelsPerChapter;
    const levels=LEVELS.slice(first,first+CONFIG.levelsPerChapter),rect={x:24,y:112,w:876,h:576};
    ctx.save();ctx.beginPath();ctx.roundRect(rect.x,rect.y,rect.w,rect.h,15);ctx.clip();
    this.landscape(chapter,rect,game.menuChapter,p=>chapter.nodes.some(([x,y])=>Math.hypot(p.x-x,p.y-y)<78));
    levels.slice(1).forEach((level,i)=>{
      const a=levels[i].mapNode,b=level.mapNode;
      const points=chapter.theme==="city"?[a,[a[0],b[1]],b]:[a,[(a[0]+b[0])/2+(i%2?22:-22),(a[1]+b[1])/2],b];
      this.line(points,"#514e3e90",18);this.line(points,chapter.theme==="sea"?"#b2d6d0":"#e4d1a0",13);
      this.line(points,i+first<game.unlocked?"#9b7852":"#aea58c",3,[3,9]);
    });
    levels.forEach((level,offset)=>{
      const i=first+offset,[x,y]=level.mapNode,locked=i>game.unlocked,selected=game.menuLevel===i,stars=game.progress.stars[i];
      this.circle(x+3,y+5,29,"#394d3a50");this.circle(x,y,selected?30:26,"#534c39");
      this.circle(x,y,selected?27:23,selected?"#ffe2a0":"#e4d4aa");
      this.circle(x,y,20,locked?"#929d83":stars?"#6e9a66":"#cc8c52");
      this.text(locked?"锁":stageLabel(i),x,y,locked?15:17,locked?"#e5e2cc":"#fff0ca","bold","center");
      if(level.boss){this.circle(x+22,y-21,11,"#ad6049");this.text("B",x+22,y-21,11,"#fff0c3","bold","center");}
      this.box(x-67,y+30,134,23,"#f1dfb6ed","#7e805c",7);
      this.text(level.name,x,y+42,12,"#4c5c41","bold","center");
      this.text("★".repeat(stars)+"☆".repeat(3-stars),x,y+65,18,stars?"#996b30":"#657853","bold","center");
      game.buttons.push({x:x-67,y:y-30,w:134,h:106,action:()=>{game.menuLevel=i;game.messageTime=0;}});
    });
    this.box(40,126,350,53,"#f2e2bcf2","#8a8663",8);
    this.text(chapter.city,54,146,15,"#4b5b3d","bold");
    this.text(`本章 ${game.progress.stars.slice(first,first+8).reduce((a,b)=>a+b,0)} / 24 星 · 地貌专属进化`,54,165,10,"#737950");
    ctx.restore();
    this.box(24,692,876,98,"#263e39","#78856b",10);
    CHAPTERS.forEach((item,i)=>this.button(game,{x:36+(i%3)*286,y:701+Math.floor(i/3)*43,w:274,h:35},
      `${i+1} / ${item.name}${i*8>game.unlocked?" · 待解锁":""}`,()=>game.selectChapter(i),{primary:i===game.menuChapter,color:COLORS.gold,size:13}));
  },
  menu(game) {
    this.header(game,false); this.campaignMap(game);
    const i=game.menuLevel, level=LEVELS[i], locked=i>game.unlocked, deck=game.getDeck(i);
    this.box(920,112,336,678,"#1b3d43",COLORS.border,15);
    this.text(`MISSION ${stageLabel(i)} / 第 ${level.chapter+1} 章`,942,139,11,COLORS.gold,"bold");
    this.text(level.name,942,178,29,COLORS.ink,"bold");
    this.text(`${level.layout} · ${level.subtitle}`,943,213,12,COLORS.muted);
    this.box(940,238,296,97,"#a8bda8",null,8);
    ctx.save();ctx.beginPath();ctx.rect(941,239,294,95);ctx.clip();ctx.translate(943,226);ctx.scale(0.318,0.2);ctx.translate(-22,-128);
    this.road(new RoadNetwork(level),true,CHAPTERS[level.chapter]);
    if(level.routeEvent)for(const [a,b] of new RoadNetwork({routes:level.routeEvent.routes}).edges)this.line([[a.x,a.y],[b.x,b.y]],"#f9e5a3",9,[13,12]);
    ctx.restore();
    this.text(`${level.waves} 波车流`,945,357,14,COLORS.ink,"bold");
    this.text(`${level.gold} 初始金币`,1234,357,14,COLORS.gold,"bold","right");
    this.text(level.boss?`◆ 最终波：${ENEMIES[level.bossType].name}`:`◇ 每 ${level.waveInterval.toFixed(0)} 秒进攻 · 允许重叠波次`,944,389,12,level.boss?COLORS.red:COLORS.mint);
    this.text(level.routeEvent?`第${level.routeEvent.wave}波 · ${level.routeEvent.name} · 中途变道`:level.reward,944,416,12,level.routeEvent?COLORS.gold:COLORS.muted);
    this.line([[941,439],[1236,439]],"#476264",1);
    this.text("出战塔组",944,462,17,COLORS.ink,"bold");
    this.text(`${deck.length} / 4`,1234,462,13,COLORS.gold,"bold","right");
    for(let slot=0;slot<4;slot++) {
      const x=942+slot*75,type=deck[slot];
      this.box(x,483,68,72,"#274e51",type?TOWERS[type].color:"#54706b",8);
      if(type) {ctx.save();ctx.translate(x+34,513);ctx.scale(0.75,0.75);this.tower({type,x:0,y:0,level:0,branch:null,angle:-0.7});ctx.restore();
        this.text(TOWERS[type].name.slice(0,2),x+34,544,10,COLORS.ink,"bold","center");}
      else this.text("+",x+34,518,24,COLORS.muted,"normal","center");
      game.buttons.push({x,y:483,w:68,h:72,disabled:locked,action:()=>{game.modal="loadout";game.libraryChapter=game.menuChapter;game.messageTime=0;}});
    }
    this.button(game,{x:942,y:568,w:178,h:34},"进化图鉴",()=>{game.modal="loadout";game.libraryChapter=game.menuChapter;game.messageTime=0;},{});
    this.button(game,{x:1128,y:568,w:108,h:34},"本章研究",()=>{game.modal="loadout";game.libraryChapter=game.menuChapter;},{size:12});
    const researched=TOWER_ORDER.reduce((n,type)=>n+[0,1].filter(b=>game.branchUnlocked(type,level.theme,b)).length,0);
    this.text(`本章进化 ${researched} / 8 · 累计通关 ${game.completed} 关`,944,624,12,COLORS.muted);
    this.text(`最好记录  ${"★".repeat(game.progress.stars[i])+"☆".repeat(3-game.progress.stars[i])}`,944,653,15,COLORS.gold,"bold");
    this.button(game,{x:942,y:675,w:294,h:48},locked?`通关 ${stageLabel(i-1)} 后解锁`:!deck.length?"请先配置出战塔组":"进入街区  →",()=>game.startLevel(i),
      {primary:!locked&&deck.length>0,disabled:locked||!deck.length,color:COLORS.gold,size:16});
    this.button(game,{x:942,y:736,w:142,h:34},"敌情档案",()=>{game.intelChapter=game.screen==="menu"?game.menuChapter:game.level.chapter;game.modal="intel";},{size:12});
    this.button(game,{x:1094,y:736,w:142,h:34},"战役勋章",()=>{game.modal="records";},{size:12});
    this.text(game.messageTime>0?game.message:game.saveFailed?"当前浏览器禁止存储，进度仅本次保留。":"本地自动存档 · 四种基础塔 · 通关推进章节进化研究",30,807,11,game.messageTime>0?COLORS.gold:COLORS.muted);
  },
  wilderness(game) {
    const chapter=CHAPTERS[game.level.chapter];
    this.landscape(chapter,MAP,game.level.stage,p=>game.buildRoad.isRoad(p,65)||game.sites.some(site=>Collision.distance(site,p)<60));
    if(chapter.theme==="sea")for(const site of game.sites) {
      this.circle(site.x,site.y+4,32,"#d7c494");this.circle(site.x,site.y,27,"#a5b889");
    }
    this.routeLayers(game);this.road(game.road,false,chapter);
    for(const route of game.road.routes) {
      const entry=route[0];this.circle(entry.x+6,entry.y,16,"#5b6650");this.text("»",entry.x+6,entry.y,23,"#f6df9c","bold","center");
      const end=route.at(-1);this.circle(end.x-5,end.y,17,"#697755");this.text("⚑",end.x-5,end.y,23,"#ffe7ae","bold","center");
    }
  },
  cityScenery(game) {
    if(game.level.theme!=="city"){this.wilderness(game);return;}
    const cityStyle=["garden","harbor","downtown","civic","harbor","harbor","downtown","civic"][game.level.stage-1];
    const harbor=cityStyle==="harbor", downtown=cityStyle==="downtown", civic=cityStyle==="civic";
    this.box(MAP.x,MAP.y,MAP.w,MAP.h,harbor?"#abc2b6":civic?"#aec5b7":"#b6cba8",null,12);
    if(harbor) {
      this.box(25,572,898,113,"#78a8a2",null,0);
      for(let y=589;y<680;y+=19) for(let x=37;x<914;x+=80) this.line([[x,y],[x+35,y]],"#a2c8bb",1);
      this.box(27,569,891,12,"#c9cbb4",null,0);
    }
    if(harbor) for(const site of game.sites.filter(site=>site.y>575)) {
      this.box(site.x-31,572,62,site.y-548,"#b0aa8c","#748b7d",2);
      for(let y=577;y<site.y+22;y+=8)this.line([[site.x-29,y],[site.x+29,y]],"#d3c6a2",2);
    }
    const plazaCandidate={garden:{x:455,y:389},downtown:{x:470,y:300},civic:{x:428,y:242}}[cityStyle];
    const plaza=plazaCandidate&&!game.buildRoad.isRoad(plazaCandidate,45)&&!game.sites.some(p=>Collision.distance(p,plazaCandidate)<77)?plazaCandidate:null;
    if(plaza) {
      this.box(plaza.x-46,plaza.y-36,92,72,"#cbd0b2","#92ac8e",12);
      this.circle(plaza.x,plaza.y,23,"#95ad9b");this.circle(plaza.x,plaza.y,19,"#6da9ad");
      this.circle(plaza.x,plaza.y-2,9,"#b4dace");this.circle(plaza.x,plaza.y-4,4,"#e1ede0");
      this.tree(plaza.x-34,plaza.y-22,0.7);this.tree(plaza.x+33,plaza.y+22,0.7);
      this.box(plaza.x+23,plaza.y-25,18,4,"#a58b61",null,1);
      this.box(plaza.x-42,plaza.y+23,18,4,"#a58b61",null,1);
    }
    // 规划成块的建筑与绿地，检测道路和建造地块边界，保证可读性。
    for(let gy=202;gy<643;gy+=88) for(let gx=65;gx<877;gx+=90) {
      const seed=(gx*13+gy*7+game.levelIndex*31)%97, w=seed%3===0?52:44,h=seed%2?34:43;
      const corners=[[gx-8,gy-25],[gx+w+13,gy-25],[gx-8,gy+h+14],[gx+w+13,gy+h+14],[gx+w/2,gy+h/2]];
      if(corners.some(([x,y])=>game.buildRoad.isRoad({x,y},13))||game.sites.some(p=>p.x>gx-40&&p.x<gx+w+42&&p.y>gy-53&&p.y<gy+h+44)) continue;
      if(harbor&&gy>560)continue;
      if(plaza&&Math.abs(gx+w/2-plaza.x)<85&&Math.abs(gy+h/2-plaza.y)<70)continue;
      if(seed%4===0) {
        this.box(gx-7,gy-8,w+15,h+14,"#95b18b","#d0d4b2",8);
        this.tree(gx+7,gy+8,0.85);this.tree(gx+w-7,gy+h-9,0.8);
        this.box(gx+15,gy+h-7,18,4,"#a1845d",null,1);
      } else if(harbor&&seed%2) {
        for(let n=0;n<3;n++) {this.box(gx,gy+n*13,w,10,n%2?"#ba9271":"#7faaa6","#e1d2b3",1);
          for(let k=5;k<w;k+=7)this.line([[gx+k,gy+n*13+2],[gx+k,gy+n*13+8]],"#59766b50",1);}
      } else this.building(gx,gy,w,h,seed%4+(downtown?2:0),cityStyle);
    }
    for(let n=0;n<60;n++) {
      const x=50+(n*137+game.levelIndex*23)%844,y=206+(n*73)%452;
      if(harbor&&y>565)continue;
      if(game.buildRoad.isRoad({x,y},45)||game.sites.some(p=>Collision.distance(p,{x,y})<52)||plaza&&Collision.distance(plaza,{x,y})<60)continue;
      if(n%3===0)this.tree(x,y,0.7);
    }
    this.routeLayers(game);this.road(game.road);
    // 路灯、路牌与入口交通信号。
    for(const route of game.road.routes) {
      const a=route[0];this.box(a.x+10,a.y-38,5,18,"#627f76",null,1);
      this.box(a.x+5,a.y-50,15,27,"#354d50","#b8c3ad",3);
      for(let i=0;i<3;i++)this.circle(a.x+12,a.y-44+i*8,2.5,i===2?"#a9e5a6":"#677d77");
    }
    game.road.edges.forEach(([a,b],i)=>{
      if(i%2)return;
      const x=(a.x+b.x)/2,y=(a.y+b.y)/2,angle=Math.atan2(b.y-a.y,b.x-a.x);
      const px=x-Math.sin(angle)*34,py=y+Math.cos(angle)*34;
      if(game.sites.some(p=>Collision.distance(p,{x:px,y:py})<42))return;
      this.line([[px+2,py+3],[px+6,py+9]],"#496e6140",4);this.line([[px,py],[px,py-19],[px+8,py-19]],"#54726d",2);
      this.box(px+5,py-21,8,4,"#f0e6b7",null,2);
    });
    const end=game.road.routes[0].at(-1);
    this.box(end.x-12,end.y-30,23,61,"#eee2b8","#798e78",3);
    for(let y=end.y-28;y<end.y+29;y+=10)this.box(end.x-10,y,19,4,"#c98f62",null,0);
  },
  site(game,site) {
    const selected=game.selectedSite===site,hover=game.siteAt(game.pointer)===site;
    this.box(site.x-26,site.y-19,52,44,"#61796950",null,7);
    this.box(site.x-25,site.y-25,50,44,"#cdcdb0",selected?"#fff2bf":"#8c9d85",5);
    this.box(site.x-19,site.y-19,38,32,"#a0b49c",hover||selected?"#f9e5a5":"#e4ddbe",3);
    for(const dx of [-21,18])for(const dy of [-21,12])this.circle(site.x+dx,site.y+dy,1.5,"#718673");
    this.text("+",site.x,site.y-2,25,hover||selected?"#fff3c6":"#eaf1d1","bold","center");
    this.text(String(site.id+1).padStart(2,"0"),site.x,site.y+26,9,"#55745f","bold","center");
    if(hover||selected)this.line([[site.x-28,site.y-27],[site.x-28,site.y-12]],"#fff0b7",3);
  },
  routeLayers(game) {
    const alternate = game.routeChanged ? game.previousRoad : game.eventRoad;
    if (!alternate) return;
    for (const [a,b] of alternate.edges) {
      if(game.routeChanged) this.line([[a.x,a.y],[b.x,b.y]],"#827f6e99",CONFIG.roadWidth);
      this.line([[a.x,a.y],[b.x,b.y]],game.routeChanged?"#d8c7a0":"#ffe6a1",game.routeChanged?2:6,[8,10]);
    }
  },
  field(game) {
    ctx.save();ctx.beginPath();ctx.roundRect(MAP.x,MAP.y,MAP.w,MAP.h,13);ctx.clip();
    this.cityScenery(game);
    game.sites.filter(site=>!game.towerAt(site)).forEach(site=>this.site(game,site));
    const tower=game.selected&&game.towerPopupRect&&Collision.inside(game.pointer,game.towerPopupRect)
      ? game.selected : game.pickTower(game.pointer)||game.selected;
    if(tower)this.range(tower,tower.stats.range,tower.spec.color);
    if(game.skill&&Collision.inside(game.pointer,MAP))this.range(game.pointer,SKILLS[game.skill].radius,SKILLS[game.skill].color);
    game.towers.filter(t=>t.type==="depot").forEach(t=>{
      if(t===tower||t===game.rallyTower){this.line([[t.x,t.y],[t.rally.x,t.rally.y]],t.spec.color,1,[4,5]);this.flag(t.rally.x,t.rally.y,t.spec.color);}
      const training=t.soldiers.filter(s=>!s.alive);
      if(training.length)this.text(`补员 ${Math.ceil(Math.min(...training.map(s=>s.respawnRemaining)))}s`,t.x,t.y+45,10,"#314e3d","bold","center");
    });
    [...game.towers,...game.enemies.filter(e=>!e.dead),...game.towers.flatMap(t=>t.soldiers.filter(s=>s.alive))]
      .sort((a,b)=>a.y-b.y).forEach(actor=>actor instanceof Soldier?this.soldier(actor):actor instanceof Tower?this.tower(actor):this.enemy(actor));
    if(game.rallyTower&&Collision.inside(game.pointer,MAP))this.flag(game.pointer.x,game.pointer.y,COLORS.gold);
    game.projectiles.forEach(p => this.projectile(p));
    game.beams.forEach(b=>this.attackBeam(b));
    game.effects.forEach(e=>this.attackEffect(e));
    game.floats.forEach(f=>{ctx.globalAlpha=Math.min(1,f.life*2);this.text(f.label,f.x,f.y-(0.85-f.life)*22,12,"#264e48","bold","center");});
    ctx.restore();
    this.box(37,124,259,53,"#f3edd4ed","#bdc6ab",8);
    this.text(`${stageLabel(game.levelIndex)} / ${game.level.name}`,50,143,18,"#365e51","bold");
    this.text(game.level.district,51,164,9,"#6d8a73","bold");
    this.box(687,125,222,36,"#254e49e8",null,7);
    this.text(game.wave<game.level.waves?`第 ${game.wave+1} 波 · ${Math.max(0,Math.ceil(game.prepareTime))} 秒后发动`:`最终波 · 场上 ${game.enemies.length} / 待发 ${game.spawnQueue.length}`,798,143,12,COLORS.ink,"bold","center");
    this.text(`间隔 ${game.level.waveInterval.toFixed(0)} 秒 · 不等待旧波清空`,899,175,10,"#354d38","bold","right");
    if(game.level.routeEvent) {
      const event=game.level.routeEvent, warning=!game.routeChanged&&game.wave+1===event.wave;
      this.box(311,183,584,27,game.routeChanged?"#385c4deb":"#654d36ed",warning?COLORS.gold:null,6);
      this.text(game.routeChanged?`${event.name} · 新路已启用 / 灰路车辆仍需清理`:`第${event.wave}波 ${event.name} · 黄色虚线为新路线${warning?` · ${Math.ceil(game.prepareTime)}秒`:""}`,603,197,12,COLORS.ink,"bold","center");
      const gate=game.road.routes[0][1];this.flag(gate.x,gate.y,game.routeChanged?COLORS.mint:COLORS.gold);
      if(game.routeFlash>0){this.box(335,604,420,29,"#284b46ee",COLORS.gold,6);this.text("路线变化！检查新路火力与勤务站集合点",545,619,12,COLORS.gold,"bold","center");}
    }
    const boss=game.enemies.find(e=>!e.dead&&e.spec.boss);
    if(boss) {
      this.box(338,124,320,36,"#493e39ec","#bd8e69",7);this.text(`BOSS / ${boss.spec.name}`,350,136,10,"#ffe0b2","bold");
      this.box(350,148,294,5,"#785e51",null,2);this.box(350,148,294*Math.max(0,boss.health/boss.maxHealth),5,"#ec9374",null,2);
    }
    if(game.paused) {
      this.box(335,640,280,29,"#143935ee","#d8dab7",6);
      this.text("Ⅱ 已暂停 · 可布塔升级 · 空格继续",475,655,12,COLORS.ink,"bold","center");
    }
  },
  sidebar(game) {
    this.text("本关出战",948,132,19,COLORS.ink,"bold");
    this.text(`${game.loadout.length} / 4 塔型`,1253,132,11,COLORS.gold,"normal","right");
    for(let i=0;i<4;i++) {
      const type=game.loadout[i],spec=TOWERS[type],x=948,y=158+i*62;
      this.box(x,y,308,54,"#21474b",spec?COLORS.border:"#315458",8);
      if(!spec) {this.text("未携带塔型",1102,y+27,12,"#6d9290","normal","center");continue;}
      ctx.save();ctx.translate(x+31,y+28);ctx.scale(0.68,0.68);this.tower({type,x:0,y:0,level:0,branch:null,angle:-0.5});ctx.restore();
      this.text(spec.name,x+65,y+18,14,spec.color,"bold");
      this.text(spec.note,x+65,y+39,10,COLORS.muted);
      this.text(`${spec.cost} G`,x+293,y+26,14,game.gold>=spec.cost?COLORS.gold:COLORS.red,"bold","right");
      game.buttons.push({x,y,w:308,h:54,towerType:type,action:()=>game.selectBuild(type)});
    }
    this.text(game.selectedSite?"选择塔型，在已选地块部署":"先点地图中的 + 设备地块",1102,427,12,COLORS.gold,"bold","center");
    this.box(948, 452, 308, 238, "#193c42", COLORS.border);
    const t = game.selected, enemy = game.inspected;
    if (t) {
      const stats = t.stats;
      this.text(`${t.name}  L${t.level}`, 964, 473, 18, t.spec.color, "bold");
      this.text(`伤害 ${Math.round(stats.damage)} / 射程 ${stats.range} / ${stats.cooldown.toFixed(2)}秒`, 964, 500, 12, COLORS.muted);
      this.text("升级菜单已在地图上的塔旁展开", 964, 540, 14, COLORS.gold, "bold");
      this.text(t.type==="depot"?`队员 ${t.soldiers.filter(s=>s.alive).length} / ${stats.soldierCount} · 阵亡 ${stats.respawn} 秒后补员`:"点击地图上的其他塔可切换选择。", 964, 573, 12, COLORS.muted);
      this.text(t.branch === null ? "二级选择专精，四级完成强化。" : t.paths[t.branch].note, 964, 604, 12, COLORS.muted);
      this.text("右键 / Esc 收起菜单，继续观察车流。", 964, 657, 11, COLORS.mint);
    } else if (enemy && !enemy.dead) {
      this.text(enemy.spec.name, 964, 479, 20, enemy.spec.color, "bold");
      this.text(`生命 ${Math.ceil(enemy.health)} / ${Math.ceil(enemy.maxHealth)}`, 964, 514, 14, COLORS.ink);
      this.text(`护盾 ${Math.ceil(enemy.shield)} · 装甲 ${Math.round((enemy.spec.armor || 0) * 100)}%`, 964, 543, 13, COLORS.muted);
      this.text(enemy.spec.note, 964, 578, 12, COLORS.muted);
      this.text(enemy.spec.counter, 964, 609, 12, COLORS.mint);
      this.text(`漏过扣 ${enemy.spec.leak} 生命 / 击杀 +${enemy.spec.reward}G`, 964, 659, 12, COLORS.gold);
    } else {
      this.text(game.wave < game.level.waves ? "下一波情报" : "最终波情报", 964, 478, 18, COLORS.ink, "bold");
      const number = Math.min(game.level.waves, game.wave + 1);
      const counts = {};
      for (const type of game.wavePlan(number)) counts[type] = (counts[type] || 0) + 1;
      Object.entries(counts).slice(0, 6).forEach(([type, count], i) => {
        this.circle(970, 512 + i * 24, 4, ENEMIES[type].color);
        this.text(`${ENEMIES[type].name} ×${count}`, 984, 512 + i * 24, 12, COLORS.muted);
      });
      this.text("点击塔：升级 / 专精 / 出售 / 索敌", 964, 670, 11, COLORS.mint);
    }
    this.button(game, { x: 948, y: 704, w: 308, h: 43 }, game.wave < game.level.waves ? `${game.wave?"提前发动":"开始"}第 ${game.wave + 1} 波  →` : "最终波 · 清理剩余敌人", () => game.startWave(),
      { primary: game.wave < game.level.waves && !game.paused, disabled: game.wave >= game.level.waves || game.paused });
    this.button(game, { x: 948, y: 759, w: 147, h: 35 }, "重新挑战", () => { game.modal = "restart"; });
    this.button(game, { x: 1107, y: 759, w: 149, h: 35 }, "返回战役", () => { game.modal = "leave"; });
  },
  toolbar(game) {
    this.box(24, 700, 900, 95, "#1a3c42", COLORS.border);
    Object.entries(SKILLS).forEach(([type, spec], i) => {
      const cooldown = game.skillCooldowns[type], x = 38 + i * 193;
      this.button(game, { x, y: 713, w: 180, h: 43 }, `${spec.key}  ${spec.name}${cooldown > 0 ? ` ${Math.ceil(cooldown)}s` : ""}`,
        () => game.selectSkill(type), { active: game.skill === type, disabled: cooldown > 0, color: spec.color });
      this.text(spec.note, x + 90, 776, 11, COLORS.muted, "normal", "center");
    });
    this.text(game.skill ? "点击地图选择技能落点" : "指挥提示", 446, 722, 13, game.skill ? COLORS.gold : COLORS.mint, "bold");
    const tip = game.messageTime > 0 ? game.message : "升级专精应对不同车流；空格暂停，调整防线。";
    (tip.match(/.{1,29}/g) || []).slice(0, 2).forEach((line, i) => this.text(line, 446, 749 + i * 20, 12, COLORS.muted));
    this.text(`击毁 ${game.kills} / 已部署 ${game.towers.length} 座防御塔`, 30, 809, 10, COLORS.muted);
  },
  result(game) {
    this.box(0, 0, CONFIG.width, CONFIG.height, "#06111cda", null, 0);
    this.box(340, 193, 600, 434, "#1c4248", game.won ? COLORS.mint : COLORS.red, 18);
    this.text(game.won ? "城区守卫成功" : "防线失守", 640, 245, 34, game.won ? COLORS.mint : COLORS.red, "bold", "center");
    this.text(game.won ? "★".repeat(game.earnedStars) + "☆".repeat(3 - game.earnedStars) : "调整部署，再次挑战", 640, 303, game.won ? 42 : 19, COLORS.gold, "bold", "center");
    this.text(`${game.level.name} · 击毁 ${game.kills} 辆 · 剩余 ${game.lives} 生命`, 640, 359, 16, COLORS.ink, "normal", "center");
    this.text(game.won ? game.earnedEvolutions?.length ? `解锁进化：${game.earnedEvolutions.slice(0,2).join(" / ")}${game.earnedEvolutions.length>2?" 等":""}` : game.newUnlock ? game.level.reward : "通关记录已更新，可重玩争取三星" : "升级主力塔，使用空袭处理聚集的强敌。", 640, 399, 15, COLORS.muted, "normal", "center");
    this.text(game.saveFailed ? "存档失败：本次进度仅在当前页面保留" : "18生命三星 / 12生命二星 / 通关一星", 640, 438, 12, game.saveFailed ? COLORS.red : COLORS.muted, "normal", "center");
    if (game.won && game.levelIndex < LEVELS.length - 1) {
      this.button(game, { x: 402, y: 474, w: 476, h: 46 }, "前往下一关  →", () => {
        game.menuLevel = game.levelIndex + 1; game.menuChapter = LEVELS[game.menuLevel].chapter; game.screen = "menu";
      }, { primary: true });
    } else this.button(game, { x: 402, y: 474, w: 476, h: 46 }, game.won ? "战役完成 · 返回关卡" : "重新挑战", () => { if (game.won) game.screen = "menu"; else game.startLevel(game.levelIndex); }, { primary: true });
    this.button(game, { x: 402, y: 539, w: 230, h: 40 }, "返回战役", () => { game.screen = "menu"; });
    this.button(game, { x: 648, y: 539, w: 230, h: 40 }, "重玩本关", () => game.startLevel(game.levelIndex));
  },
  buildPopup(game) {
    game.buildPopupRect=null;
    if(!game.selectedSite||game.screen!=="battle")return;
    const site=game.selectedSite,x=site.x>480?site.x-274:site.x+36,y=Math.max(189,Math.min(447,site.y-80));
    const height=69+Math.ceil(game.loadout.length/2)*79;
    const cards=game.loadout.map((type,i)=>({type,x:x+12+(i%2)*121,y:y+45+Math.floor(i/2)*79,w:112,h:71}));
    const hover=cards.find(card=>Collision.inside(game.pointer,card))||game.buttons.find(b=>b.towerType&&Collision.inside(game.pointer,b));
    const preview=hover?.type||hover?.towerType;
    if(preview) {
      ctx.save();ctx.beginPath();ctx.rect(MAP.x,MAP.y,MAP.w,MAP.h);ctx.clip();
      this.range(site,TOWERS[preview].range,game.gold>=TOWERS[preview].cost?COLORS.gold:COLORS.red);ctx.restore();
    }
    this.line([[site.x,site.y-8],[x+126,y+30]],"#f2d894",2);
    this.box(x+4,y+6,256,height,"#12343040",null,11);
    this.box(x,y,256,height,"#173d42","#e5cf9a",11);
    this.text(`设备地块 ${String(site.id+1).padStart(2,"0")}`,x+14,y+23,15,COLORS.ink,"bold");
    this.button(game,{x:x+215,y:y+9,w:29,h:28},"×",()=>game.cancel(),{size:18});
    cards.forEach(card=>{
      const spec=TOWERS[card.type],afford=game.gold>=spec.cost;
      this.button(game,card,"",()=>game.selectBuild(card.type),{disabled:!afford,color:spec.color});
      ctx.save();ctx.translate(card.x+23,card.y+30);ctx.scale(0.57,0.57);this.tower({type:card.type,x:0,y:0,level:0,branch:null});ctx.restore();
      this.text(spec.name.slice(0,2),card.x+52,card.y+22,13,afford?spec.color:COLORS.muted,"bold");
      this.text(`${spec.cost} G`,card.x+52,card.y+43,12,afford?COLORS.gold:COLORS.red,"bold");
      this.text(`快捷键 ${game.loadout.indexOf(card.type)+1}`,card.x+56,card.y+61,9,COLORS.muted,"normal","center");
    });
    this.text("悬停预览射程 / Esc 取消",x+128,y+height-16,10,COLORS.muted,"normal","center");
    game.buildPopupRect={x,y,w:256,h:height};
  },
  towerPopup(game) {
    game.towerPopupRect=null;
    const t=game.selected;
    if(!t||game.screen!=="battle"||game.rallyTower)return;
    // 根据塔的位置自动向内展开，最靠边的塔也能完整操作。
    const w=286,h=t.level===2?284:238;
    const x=Math.max(MAP.x+10,Math.min(MAP.x+MAP.w-w-10,t.x>478?t.x-w-36:t.x+36));
    const y=Math.max(186,Math.min(MAP.y+MAP.h-h-10,t.y-90));
    game.towerPopupRect={x,y,w,h};
    this.line([[t.x,t.y-8],[t.x>x?x+w:x,y+40]],t.spec.color,2);
    this.box(x+4,y+6,w,h,"#12343050",null,11);
    this.box(x,y,w,h,"#173d42",t.spec.color,11);
    this.text(`${t.name} · L${t.level}`,x+14,y+24,16,t.spec.color,"bold");
    this.button(game,{x:x+w-39,y:y+10,w:28,h:28},"×",()=>game.cancel(),{size:18});
    this.text(t.type==="depot"?`${t.stats.soldierCount} 位队员 / 生命 ${Math.round(t.stats.soldierHealth)} / 自动补员`: `伤害 ${Math.round(t.stats.damage)} / 射程 ${t.stats.range}`,x+14,y+54,12,COLORS.muted);
    this.text(t.level===2?"选择专精路线 · 本局不可切换":t.level===4?"已完成专精强化":t.level===1?"强化后解锁两条专精路线":t.paths[t.branch].note,
      x+14,y+79,11,COLORS.gold);
    if(t.level===2) {
      t.paths.forEach((path,i)=>{
        const rect={x:x+12,y:y+97+i*58,w:w-24,h:50},afford=game.gold>=path.cost,unlocked=game.branchUnlocked(t.type,t.theme,i);
        this.button(game,rect,"",()=>{if(game.selected===t)game.upgrade(i);},{disabled:!afford||!unlocked,color:t.spec.color});
        this.text(path.name,rect.x+12,rect.y+16,14,afford?t.spec.color:COLORS.muted,"bold");
        this.text(`${path.cost} G`,rect.x+rect.w-12,rect.y+16,12,afford?COLORS.gold:COLORS.red,"bold","right");
        this.text(unlocked?path.note:`累计通关 ${evolutionRequirement(t.type,t.theme,i)} 关解锁 · 当前 ${game.completed}`,rect.x+12,rect.y+36,11,unlocked?COLORS.muted:COLORS.gold);
      });
    } else {
      const afford=game.gold>=t.upgradeCost,max=t.level===4;
      this.button(game,{x:x+12,y:y+100,w:w-24,h:43},max?"已达最高等级":`${t.level===1?"基础强化 → L2":"专精强化 → L4"} · ${t.upgradeCost} G`,
        ()=>{if(game.selected===t)game.upgrade();},{primary:!max&&afford,disabled:max||!afford,color:t.spec.color});
      this.text(max?"组合不同塔型，构筑交叉火力":afford?"提升伤害与射程":"金币不足 · 击毁车辆获得金币",x+w/2,y+165,11,COLORS.muted,"normal","center");
    }
    this.button(game,{x:x+12,y:y+h-47,w:132,h:34},t.type==="depot"?"⚑ 设置集合点":TARGET_MODES[t.targetMode],()=>{if(game.selected!==t)return;if(t.type==="depot"){game.rallyTower=t;game.notify("点击勤务站范围内的道路设置集合点，Esc 取消。");}else t.targetMode=(t.targetMode+1)%3;},{size:12});
    this.button(game,{x:x+152,y:y+h-47,w:122,h:34},`出售 +${t.sellValue} G`,()=>{if(game.selected===t)game.sell();},{color:COLORS.gold,size:12});
  },
  loadoutModal(game) {
    const chapter=CHAPTERS[game.libraryChapter??game.menuChapter],theme=chapter.theme,branch=game.previewBranch||0;
    this.box(132,112,1016,595,"#243e39","#a89d76",17);
    this.text(`${chapter.name} / 防御塔进化研究`,156,149,25,COLORS.ink,"bold");
    this.text("四种基础塔全程可用 · 通关永久解锁进化资格 · 每局仍需金币升级，专精不可切换",157,181,13,COLORS.muted);
    TOWER_ORDER.forEach((type,i)=>{
      const spec=TOWERS[type],x=154+i*244,y=208;
      this.box(x,y,234,390,"#315249",COLORS.border,10);
      this.text(spec.name,x+117,y+25,20,spec.color,"bold","center");
      this.text(`${spec.cost} G · ${spec.note}`,x+117,y+51,10,COLORS.muted,"normal","center");
      this.box(x+10,y+65,214,136,"#b3bb98",null,6);
      for(let level=1;level<=4;level++){
        ctx.save();ctx.translate(x+35+(level-1)*55,y+156);ctx.scale(.68,.68);
        this.tower({type,theme,x:0,y:0,level,branch:level>=3?branch:null,angle:-.8});ctx.restore();
        this.text(`L${level}`,x+35+(level-1)*55,y+187,10,"#395447","bold","center");
      }
      pathsFor(type,theme).forEach((path,b)=>{
        const unlocked=game.branchUnlocked(type,theme,b),py=y+224+b*77;
        this.text(`${b===0?"Ⅰ":"Ⅱ"} ${path.name}`,x+14,py,15,unlocked?spec.color:COLORS.muted,"bold");
        this.text(unlocked?`已研究 · 进化费用 ${path.cost} G`:`通关 ${evolutionRequirement(type,theme,b)} 关解锁 / 当前 ${game.completed}`,x+14,py+22,11,unlocked?COLORS.gold:"#dbc4a0");
        this.text(path.note,x+14,py+44,10,COLORS.muted);
      });
    });
    CHAPTERS.forEach((item,i)=>this.button(game,{x:157+i*162,y:614,w:151,h:29},item.name,()=>{game.libraryChapter=i;},{primary:item===chapter,size:12}));
    this.button(game,{x:157,y:653,w:230,h:34},`预览造型：路线 ${branch===0?"Ⅰ":"Ⅱ"} · 点击切换`,()=>{game.previewBranch=1-branch;},{size:12});
    this.button(game,{x:921,y:650,w:202,h:39},"返回战役地图",()=>{game.modal=null;},{primary:true,color:COLORS.gold});
  },
  recordsModal(game) {
    this.box(250,142,780,532,"#263e39","#b6aa80",16);
    this.text("远征勋章 / 每章八关",275,180,26,COLORS.gold,"bold");
    this.text("18生命三星 / 12生命二星 / 通关一星 · 旧成绩按关卡序号保留",275,216,12,COLORS.muted);
    CHAPTERS.forEach((chapter,i)=>this.button(game,{x:275+i*123,y:244,w:113,h:33},chapter.name,
      ()=>game.selectChapter(i),{primary:i===game.menuChapter,color:COLORS.gold,size:12}));
    const first=game.menuChapter*CONFIG.levelsPerChapter;
    LEVELS.slice(first,first+CONFIG.levelsPerChapter).forEach((level,offset)=>{
      const i=first+offset,x=275+Math.floor(offset/4)*370,y=298+offset%4*65,stars=game.progress.stars[i];
      this.box(x,y,354,54,"#344c3e",COLORS.border,7);
      this.text(`${stageLabel(i)}  ${level.name}`,x+12,y+20,14,COLORS.ink,"bold");
      this.text("★".repeat(stars)+"☆".repeat(3-stars),x+340,y+34,21,stars?COLORS.gold:COLORS.muted,"bold","right");
    });
    this.button(game,{x:770,y:604,w:231,h:42},"返回远征地图",()=>{game.modal=null;},{primary:true,color:COLORS.gold});
  },
  modal(game) {
    this.box(0, 0, CONFIG.width, CONFIG.height, "#05111cce", null, 0);
    if (game.modal === "loadout") { this.loadoutModal(game); return; }
    if (game.modal === "records") { this.recordsModal(game); return; }
    if (game.modal === "intel") {
      this.box(162, 118, 956, 592, "#142c3a", COLORS.border, 16);
      this.text("敌情图鉴", 187, 151, 25, COLORS.ink, "bold");
      const chapterIndex=game.intelChapter ?? (game.screen==="menu"?game.menuChapter:game.level.chapter),chapter=CHAPTERS[chapterIndex];
      CHAPTERS.forEach((item,i)=>this.button(game,{x:184+i*152,y:183,w:141,h:29},item.name,()=>{game.intelChapter=i;},{active:i===chapterIndex,size:12}));
      const native=[...chapter.pool,chapter.boss];
      const types=[...new Set([...native,...native.filter(type=>ENEMIES[type].split).map(type=>ENEMIES[type].splitType||"swarm")])];
      types.forEach((type, i) => {
        const spec=ENEMIES[type];
        const x = 184 + (i % 2) * 463, y = 220 + Math.floor(i / 2) * 108;
        this.box(x, y, 443, 96, "#1a3442", COLORS.border, 8);
        this.vehicle(type,x+26,y+26);
        this.text(spec.name, x + 48, y + 24, 15, spec.color, "bold");
        this.text(`基础HP ${spec.hp} / 速度 ${spec.speed}`, x + 420, y + 25, 10, COLORS.muted, "normal", "right");
        this.text(spec.note, x + 17, y + 53, 12, COLORS.ink); this.text(spec.counter, x + 17, y + 77, 11, COLORS.muted);
      });
      this.button(game, { x: 968, y: 139, w: 122, h: 40 }, "关闭 / Esc", () => { game.modal = null; });
    } else {
      this.box(405, 285, 470, 233, "#152e3e", COLORS.border, 15);
      this.text(game.modal === "restart" ? "重新挑战这一关？" : "返回战役地图？", 640, 332, 25, COLORS.ink, "bold", "center");
      this.text("本局部署与金币将清空，已获得的星级和解锁保留。", 640, 382, 14, COLORS.muted, "normal", "center");
      this.button(game, { x: 437, y: 440, w: 186, h: 43 }, "继续防守", () => { game.modal = null; });
      this.button(game, { x: 644, y: 440, w: 198, h: 43 }, "确认", () => {
        if (game.modal === "restart") game.startLevel(game.levelIndex);
        else { game.modal = null; game.screen = "menu"; game.cancel(); }
      }, { primary: true });
    }
  },
  draw(game) {
    game.buttons = [];
    ctx.clearRect(0, 0, CONFIG.width, CONFIG.height); ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    if (game.screen === "menu") this.menu(game);
    else {
      this.header(game, true); this.field(game); this.sidebar(game); this.toolbar(game); this.buildPopup(game); this.towerPopup(game);
      if (game.screen === "result") { game.buttons = []; this.result(game); }
    }
    if (game.modal) { game.buttons = []; this.modal(game); }
    const button = game.buttons.find(b => Collision.inside(game.pointer, b));
    canvas.style.cursor = button ? button.disabled ? "not-allowed" : "pointer"
      : game.screen === "battle" && Collision.inside(game.pointer, MAP) ? game.skill ? "crosshair" : game.siteAt(game.pointer) || game.towerAt(game.pointer) ? "pointer" : "default" : "default";
  }
};
