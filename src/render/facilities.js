"use strict";

// 防御设施、拦截队员和弹体美术；依赖 renderer.js 的基础绘图方法。
Object.assign(Renderer, {
  // 模块化交通设施：统一圆角外壳、深色玻璃、发光标识与分层底座。
  // 轮廓和设备模块随等级/专精变化；不复用城堡、弓弩或法师塔造型。
  oval(x, y, rx, ry, fill, stroke = null) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  },
  tower(tower, ghost = false) {
    const spec = TOWERS[tower.type], level = tower.level || 1;
    const advanced = level >= 3, branch = tower.branch;
    const firing=Math.max(0,(tower.fireTime||0)/.24);
    const palettes = {
      city: ["#e1eae5", "#8ca6aa"], country: ["#e2e6cd", "#91a88d"],
      desert: ["#eedbc0", "#b69f86"], hills: ["#dce3eb", "#8b9dac"],
      sea: ["#e0eff0", "#7eabb6"], forest: ["#d5e3ce", "#849f89"]
    };
    const [shell, shade] = palettes[tower.theme || "city"];
    const ink = "#304b55", glass = "#284b5d";
    const theme=tower.theme||"city", accent=advanced?THEME_EQUIPMENT[theme].colors[branch]:spec.color;
    ctx.save(); ctx.translate(tower.x, tower.y); ctx.globalAlpha = ghost ? .55 : 1;
    this.oval(3, 18, 29, 12, "#213f4033");
    this.box(-25, -6, 50, 29, shade, ink, 10);
    this.box(-25, -11, 50, 27, shell, ink, 10);
    this.line([[-19, -5], [-10, -8], [14, -8]], "#ffffffb0", 2);
    this.box(-17, 11, 34, 6, glass, null, 3);
    for (let i = 0; i < level; i++) this.box(-12 + i * 7, 12, 4, 3, accent, null, 1);
    if (level >= 2) {
      for (const x of [-27, 19]) {
        this.box(x, -3, 8, 18, shade, ink, 3);
        this.box(x + 2, -1, 4, 8, accent, null, 2);
      }
    }
    if (level === 4) {
      this.oval(0, 3, 24, 9, "#ffffff18", accent);
      for (const x of [-21, 16]) this.box(x, 18, 5, 4, "#f9d586", null, 1);
    }
    if (advanced) this.regionalEquipment(theme, branch, level, accent);
    if (tower.type === "rail") {
      const lift = level === 1 ? 9 : advanced && branch === 0 ? 24 : 15;
      this.box(-12, -lift, 24, lift + 7, shade, ink, 6);
      this.box(-8, -lift, 16, lift + 3, shell, null, 4);
      this.oval(0, -lift, 17, 9, glass, ink);
      this.oval(0, -lift - 3, 14, 7, accent, ink);
      if (level === 4) {
        this.box(-21, -19, 8, 22, glass, ink, 3);
        this.box(-20, -16, 6, 4, accent, null, 1);
      }
      ctx.save(); ctx.translate(0, -lift - 6); ctx.rotate(tower.angle ?? -.7);ctx.translate(-firing*(advanced?7:level===2?4:2),0);
      const guns = advanced && branch === 1 ? 2 : 1;
      for (let i = 0; i < guns; i++) {
        const gy = (i - (guns - 1) / 2) * 15;
        const length = advanced && branch === 0 ? 34 : level === 1 ? 23 : 27;
        this.box(-10, gy - 7, 23, 14, shell, ink, 5);
        this.box(-6, gy - 4, 13, 8, glass, null, 3);
        this.box(4, gy - 5, length, 4, shade, ink, 1);
        this.box(4, gy + 1, length, 4, shade, ink, 1);
        this.line([[8, gy], [length + 5, gy]], accent, 2);
        this.box(length - 1, gy - 7, 7, 14, glass, ink, 2);
        this.box(length + 2, gy - 3, 3, 6, accent, null, 1);
        if (firing > .55)
          this.oval(length + 10, gy, advanced?12:7, advanced?5:3, "#e2fff0b0");
      }
      ctx.restore();
      if (advanced && branch === 0) {
        this.line([[-16, -9], [-19, -36]], ink, 2);
        this.circle(-19, -37, 3, accent);
      }
    } else if (tower.type === "signal") {
      const height = level === 1 ? 23 : level === 2 ? 32 : branch === 0 ? 43 : 35;
      this.box(-13, -16, 26, 26, shade, ink, 6);
      this.box(-10, -19, 20, 23, shell, ink, 5);
      this.box(-5, -14, 10, 15, glass, null, 3);
      this.line([[-2, -11], [-2, -3]], accent, 3);
      this.box(-4, -height, 8, height - 13, shade, ink, 2);
      const antenna = (x, y, size) => {
        this.oval(x, y + 4, size, size * .52, shade, ink);
        this.oval(x, y, size, size * .52, shell, ink);
        this.oval(x, y, size * .68, size * .3, glass);
        this.line([[x, y + 1], [x + size * .3, y - size * .6]], accent, 2);
        this.circle(x + size * .3, y - size * .6, 3, "#e3ffff");
      };
      antenna(0, -height-firing*(advanced?5:2), level === 1 ? 13 : 20);
      if(firing>0)this.oval(0,-height,22+firing*8,8+firing*4,"#ffffff12",accent);
      if (advanced && branch === 1) {
        this.line([[-18, -5], [-18, -24], [18, -24], [18, -5]], shade, 4);
        antenna(-18, -24, 10); antenna(18, -24, 10);
      }
      if (level === 4) {
        this.oval(0, -height + 3, 25, 11, "#9edffa12", accent);
        this.circle(-22, -4, 3, "#d5f4ff"); this.circle(22, -4, 3, "#d5f4ff");
      }
    } else if (tower.type === "missile") {
      ctx.save();ctx.translate(0,firing*(advanced?4:2));
      this.box(-20, -22, 40, 31, shade, ink, 8);
      this.box(-20, -27, 40, 28, shell, ink, 8);
      this.box(-15, -23, 30, 19, glass, null, 5);
      if (advanced && branch === 0) {
        this.box(-10, -39, 20, 35, shade, ink, 5);
        this.oval(0, -39, 10, 5, shell, ink);
        this.box(-5, -47, 10, 27, accent, ink, 4);
        this.polygon([[-5, -44], [0, -55], [5, -44]], "#f4f5e7", ink);
        this.box(-5, -30, 10, 5, "#fcf3d7", null, 1);
        this.line([[-11, -18], [-18, -28]], shade, 4);
      } else {
        const rows = level === 1 ? 1 : advanced ? 3 : 2;
        for (let row = 0; row < rows; row++) for (const x of [-8, 8]) {
          const y = -24 + row * 8;
          this.oval(x, y, 6, 4, "#172f3d", shade);
          this.oval(x, y - 1, 3, 2, accent);
        }
        if (advanced) {
          this.box(-25, -29, 7, 30, shade, ink, 3);
          this.box(18, -29, 7, 30, shade, ink, 3);
        }
      }
      for (const x of [-14, -5, 4, 13]) this.line([[x, 3], [x + 4, 7]], "#f5c579", 3);
      if (level === 4) this.box(12, -39, 9, 7, glass, accent, 2);
      if(firing>.4){this.oval(0,-20,advanced?19:10,7,"#ffe0a480");this.line([[-16,10],[-23,15]],accent,2);this.line([[16,10],[23,15]],accent,2);}
      ctx.restore();
    } else if (tower.type === "depot") {
      const height = level === 1 ? 21 : level === 2 ? 28 : 35;
      this.box(-22, -height + 6, 44, height + 5, shade, ink, 7);
      this.box(-22, -height, 44, height + 5, shell, ink, 7);
      if(advanced&&branch===1) {
        this.box(-18,-15,16,21,glass,ink,4);this.box(2,-15,16,21,glass,ink,4);
        this.line([[0,-17],[0,7]],accent,3);
      } else this.box(-16, -14, 32, 20, glass, ink, 4);
      this.line([[-13, -10], [13, -10]], "#65818c", 2);
      this.line([[-13, -5], [13, -5]], "#65818c", 2);
      this.box(-23, -height - 3, 46, 10, shade, ink, 5);
      this.box(-19, -height - 3, 38, 5, shell, null, 3);
      this.box(-10, -height + 10, 20, 7, firing>0?"#fff4cd":accent, null, 3);
      this.line([[-4, -height + 13], [4, -height + 13]], "#fff4e4", 2);
      this.box(-23, 7, 46, 6, "#d1dacb", ink, 2);
      for (const x of [-16, 0, 16]) this.line([[x - 4, 8], [x, 11]], accent, 2);
      if (advanced && branch === 0) {
        for (const x of [-24, 16]) {
          this.box(x, -23, 8, 27, glass, ink, 3);
          this.box(x + 2, -20, 4, 17, accent, null, 1);
        }
        this.box(-9, -height - 12, 18, 9, glass, ink, 3);
        this.circle(-4, -height - 8, 2, "#ffa48c"); this.circle(4, -height - 8, 2, "#a0eafa");
      } else if (advanced) {
        this.box(-16, -height - 12, 13, 11, glass, ink, 3);
        this.box(3, -height - 12, 13, 11, glass, ink, 3);
        this.line([[-12, -height - 7], [-7, -height - 7]], accent, 2);
        this.line([[7, -height - 7], [12, -height - 7]], accent, 2);
      }
      if (level === 4) { this.line([[17, -height], [17, -height - 23]], ink, 2); this.circle(17, -height - 23, 3, accent); }
    }
    if (tower.level) {
      this.box(-13, 22, 26, 12, glass, null, 4);
      this.text(`L${level}`, 0, 28, 9, "#e7f4ec", "bold", "center");
    }
    ctx.restore();
  },
  regionalEquipment(theme, branch, level, accent) {
    const ink="#354d4d";
    if(theme==="city") {
      if(branch===0) {
        this.line([[-23,5],[-23,-47]],ink,3);this.box(-29,-52,12,22,"#293e49",ink,3);
        ["#f1987d","#e8d788",accent].forEach((color,i)=>this.circle(-23,-47+i*6,2,color));
      } else {
        for(const x of [-30,21]) {this.box(x,-17,9,32,"#edc28c",ink,2);for(let y=-14;y<12;y+=8)this.line([[x+1,y],[x+7,y+4]],"#5a6360",3);}
      }
    } else if(theme==="country") {
      if(branch===0) {
        this.line([[-24,8],[-24,-43]],"#836d4b",4);
        ctx.save();ctx.translate(-24,-43);ctx.rotate(-.4);
        for(let blade=0;blade<4;blade++){ctx.rotate(Math.PI/2);this.polygon([[0,-2],[16,-5],[17,1],[3,3]],"#e5dda8",ink);}
        this.circle(0,0,4,accent);ctx.restore();
      } else {
        this.box(20,-29,14,34,"#85b8ba",ink,6);this.oval(27,-29,7,4,"#bddedf",ink);
        this.line([[26,4],[26,15],[-22,15],[-22,-7]],"#628c84",4);this.circle(-22,-9,4,accent);
      }
    } else if(theme==="desert") {
      if(branch===0) {
        for(const side of [-1,1]) {
          const x=side*23;this.line([[x,8],[x,-32]],"#93806a",3);
          this.polygon([[x-10,-36],[x+8,-41],[x+12,-19],[x-6,-14]],"#547b9a",ink);
          this.line([[x-4,-32],[x+6,-35],[x+9,-23],[x-1,-20]],"#a3cbdb",1);
        }
      } else {
        for(const x of [-30,21]) {this.box(x,-28,10,39,"#b79570",ink,3);for(let y=-24;y<6;y+=6)this.line([[x,y],[x+10,y]],"#ead0a3",2);}
        this.line([[-27,17],[27,17]],"#e8ca8e",5);
      }
    } else if(theme==="hills") {
      if(branch===0) {
        for(const side of [-1,1])this.polygon([[side*13,6],[side*24,-24],[side*34,13],[side*26,19]],"#aeb6bc",ink);
        this.line([[-28,10],[-25,-6]],accent,3);this.line([[28,10],[25,-6]],accent,3);
      } else {
        for(const x of [-29,20]) {
          this.box(x,-17,11,39,"#414e54",ink,6);
          for(let y=-12;y<20;y+=7)this.box(x+1,y,9,4,"#85989c",null,1);
        }
      }
    } else if(theme==="sea") {
      if(branch===0) {
        this.oval(-23,13,12,21,"#c7e0db",ink);this.oval(23,13,12,21,"#c7e0db",ink);
        this.line([[-29,19],[-18,19]],accent,4);this.line([[18,19],[29,19]],accent,4);
        this.circle(-27,-19,9,"#f3ddd0");this.circle(-27,-19,5,"#e79d83");
      } else {
        this.line([[24,-38],[24,13]],ink,3);this.line([[12,4],[24,15],[36,4]],"#879f9e",4);
        this.circle(24,-38,4,accent);this.line([[24,-22],[34,-22]],"#dbe8d9",3);
        this.box(-29,-26,10,33,"#678f9f",ink,4);
      }
    } else if(theme==="forest") {
      if(branch===0) {
        for(const side of [-1,1]) {
          this.line([[side*6,19],[side*25,12],[side*29,-5],[side*23,-33]],"#5e7d50",6);
          this.oval(side*25,-27,9,4,"#b4ce85");this.oval(side*29,-12,9,4,"#80ab72");
        }
      } else {
        for(const x of [-27,27]) {
          this.box(x-5,-25,10,34,"#76978f",ink,5);this.oval(x,-21,5,9,"#d7c8f7");
          this.circle(x,-22,2,"#ffffff");this.circle(x-3,-35,2,accent);this.circle(x+4,-43,2,accent);
        }
      }
    }
    if(level===4)this.line([[-18,21],[18,21]],accent,3);
  },
  flag(x, y, color) {
    // 集合点使用道路信标，不使用军旗。
    this.oval(x, y + 2, 11, 5, "#304e5840", color);
    this.line([[x, y], [x, y - 17]], "#3d5760", 3);
    this.box(x - 5, y - 22, 10, 9, color, "#36545d", 3);
    this.circle(x, y - 18, 2, "#ffffff");
  },
  soldier(s) {
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale(CONFIG.soldierScale, CONFIG.soldierScale);
    const advanced = s.owner.level >= 3, accent = s.owner.stats.color;
    const swing=(s.swingTime||0)/.24;
    this.oval(1, 6, 8, 4, "#233f4850");
    if (s.owner.theme === "sea") this.oval(0, 7, 13, 5, "#d5dcd1", "#41616c");
    this.line([[-3, 3], [-4, 8]], "#294654", 3);
    this.line([[3, 3], [4, 8]], "#294654", 3);
    this.box(-5, -6, 10, 11, advanced ? "#d7e6dd" : "#7398a4", "#354e58", 3);
    this.line([[-4, -2], [4, -2]], "#f3c882", 2);
    this.circle(0, -10, 5, "#deb892");
    this.box(-6, -16, 12, 8, advanced ? "#e4eee7" : "#a8c5ca", "#38545c", 4);
    this.box(-5, -12, 10, 4, "#365968", null, 2);
    ctx.save();ctx.translate(4,-3);ctx.rotate(s.angle||0);
    this.line([[0,0],[8+swing*(advanced?12:6),-4]],accent,advanced?4:3);
    if(advanced&&s.owner.branch===1)this.line([[0,4],[10+swing*10,7]],accent,3);
    ctx.restore();
    if (s.owner.branch !== 1) this.box(-11, -5, 7, 11, "#c0e4e5aa", "#6399a9", 2);
    ctx.restore();
    // 血条不随人物缩放，缩小单位后仍能判断受损情况。
    this.box(s.x - 6, s.y + 8, 12, 2, "#465651", null, 1);
    this.box(s.x - 6, s.y + 8, 12 * s.health / s.maxHealth, 2, "#b4ddb1", null, 1);
  },
});
