"use strict";

// 仅绘制：弹体位置、命中时刻和伤害仍由实体决定，不用动画重复结算伤害。
// 所有动画使用模拟时间，因此暂停会定格，倍速会同步加快。
Object.assign(Renderer, {
  attackRing(x, y, radius, color, width = 2) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(.1, radius), 0, Math.PI * 2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  },
  attackEffect(effect) {
    const {x,y,color,radius,visual,kind} = effect;
    const progress = 1 - effect.life / effect.duration;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - progress);
    if (!visual) {
      this.attackRing(x,y,3+radius*progress,color,3);
      ctx.restore(); return;
    }
    const advanced=visual.level>=3, enhanced=visual.level>=2;
    const spread=3+(radius-3)*progress;
    if (kind === "pulse") {
      // 信号灯扫描圈与停车横线；高级形态增加同步路口节点。
      for(const side of [-1,1])this.line([[x-spread*.4,y+side*spread*.65],[x+spread*.4,y+side*spread*.65]],"#eab36f",enhanced?4:2);
      this.attackRing(x,y,spread,color,advanced?3:2);
      if(enhanced)this.attackRing(x,y,spread*.7,color,1.5);
      if(advanced) {
        const spokes=visual.level===4?12:8;
        for(let i=0;i<spokes;i++) {
          const angle=i*Math.PI*2/spokes+progress*(visual.branch===1?1.2:.2);
          const inner=visual.branch===0?spread*.82:spread*.35;
          this.line([[x+Math.cos(angle)*inner,y+Math.sin(angle)*inner],
            [x+Math.cos(angle)*spread,y+Math.sin(angle)*spread]],color,2);
          if(visual.branch===0)this.circle(x+Math.cos(angle)*spread,y+Math.sin(angle)*spread,3,"#effffd");
        }
      }
    } else if (kind === "strike") {
      ctx.save();ctx.translate(x,y);
      if(advanced&&visual.branch===0) {
        // 重装队员盾击：六边冲击面与冲击环。
        const points=Array.from({length:6},(_,i)=>[Math.cos(i*Math.PI/3)*spread,Math.sin(i*Math.PI/3)*spread]);
        this.polygon(points,"#bff9ed20",color);this.attackRing(0,0,spread*.55,"#eefbdb",2);
      } else {
        ctx.rotate(-.7+progress*.6);
        const count=advanced?3:enhanced?2:1;
        for(let i=0;i<count;i++)this.line([[-spread,(i-1)*5],[spread,(i-1)*5-7]],color,advanced?3:2);
      }
      ctx.restore();
    } else if (visual.type === "missile") {
      // 制动索网落地；强化重锚以辐射拉索，双网则以交织网格区分。
      this.attackRing(x,y,spread,color,advanced?3:2);
      const spokes=visual.level===4?10:enhanced?8:5;
      for(let i=0;i<spokes;i++){
        const angle=i*Math.PI*2/spokes,px=x+Math.cos(angle)*spread,py=y+Math.sin(angle)*spread;
        this.line([[x,y],[px,py]],"#eee3ba",1.3);
        this.circle(px,py,advanced&&visual.branch===0?4:2,color);
      }
      if(advanced&&visual.branch===1){this.attackRing(x,y,spread*.5,"#f7e7b2",2);this.attackRing(x,y,spread*.75,color,1.5);}
    } else {
      this.attackRing(x,y,spread,color,enhanced?3:1.5);
      if(advanced) {
        const count=visual.branch===0?4:8;
        for(let i=0;i<count;i++) {
          const angle=i*Math.PI*2/count+progress;
          this.line([[x+Math.cos(angle)*spread*.4,y+Math.sin(angle)*spread*.4],
            [x+Math.cos(angle)*spread,y+Math.sin(angle)*spread]],color,visual.level===4?3:2);
        }
      }
    }
    ctx.restore();
  },
  attackBeam(beam) {
    const {a,b,color,visual}=beam, advanced=visual?.level>=3;
    const progress=1-beam.life/beam.duration;
    ctx.save();ctx.globalAlpha=1-progress;
    if(advanced&&visual.beamStyle==="chain") {
      // 连锁专精用折线电弧，末端闪光表明每一跳实际命中位置。
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.max(1,Math.hypot(dx,dy));
      const points=Array.from({length:7},(_,i)=>{
        const jitter=i===0||i===6?0:Math.sin(i*2.7+progress*18)*7;
        return [a.x+dx*i/6-dy/length*jitter,a.y+dy*i/6+dx/length*jitter];
      });
      this.line(points,color,visual.level===4?5:3);this.line(points,"#f1ffec",1);
    } else {
      // 聚能专精的直束与连锁电弧有不同轮廓。
      this.line([[a.x,a.y],[b.x,b.y]],color,advanced?(visual.level===4?9:6):3);
      if(advanced)this.line([[a.x,a.y],[b.x,b.y]],"#edfff2",2);
    }
    if(advanced)this.attackRing(b.x,b.y,4+progress*13,color,2);
    ctx.restore();
  },
  projectile(p) {
    const remaining=Collision.distance(p,p.destination);
    const progress=p.travelled/Math.max(1,p.travelled+remaining);
    const {level,branch}=p.visual, advanced=level>=3;
    const launchHeight=p.type==="missile"?(advanced&&branch===0?50:25):(advanced&&branch===0?30:level===1?15:21);
    const lift=launchHeight*(1-progress)+(p.type==="missile"?Math.sin(progress*Math.PI)*(advanced?(branch===0?56:24):32):0);
    const angle=Math.atan2(p.destination.y-p.y,p.destination.x-p.x),color=p.stats.color;
    this.oval(p.x+2,p.y+4,p.type==="missile"?5:2,2,"#294e4430");
    ctx.save();ctx.translate(p.x+(p.type==="rail"?Math.cos(angle)*24*(1-progress):0),p.y-lift);ctx.rotate(angle);
    if(p.type==="missile") {
      const count=advanced&&branch===1?2:1;
      for(let i=0;i<count;i++) {
        ctx.save();ctx.translate(-i*7,(i-(count-1)/2)*12);
        const size=advanced&&branch===0?1.5:level===2?1.15:1;
        ctx.scale(size,size);
        this.line([[-(level===4?38:24),0],[-9,0]],color+"88",level>=2?4:2);
        this.line([[-10,0],[6,0]],"#e1d6ad",3);
        this.line([[0,-8],[6,0],[0,8]],color,3);
        this.line([[-4,-6],[1,0],[-4,6]],"#607b7a",2);
        if(advanced&&branch===0){this.line([[-6,-5],[-2,5]],color,2);this.line([[-2,-5],[2,5]],color,2);}
        ctx.restore();
      }
    } else if(advanced&&branch===0) {
      this.line([[-(level===4?38:29),0],[5,0]],color,5);
      this.line([[-22,0],[7,0]],"#f1fff2",2);
      this.oval(-8,0,4,8,"#ffffff10",color);
      if(level===4)this.oval(-20,0,4,9,"#ffffff10",color);
    } else {
      const count=advanced?2:level===2?2:1;
      for(let i=0;i<count;i++) {
        const y=(i-(count-1)/2)*(advanced?7:3);
        this.line([[-(advanced?22:13),y],[2,y]],color,advanced?3:2);
        this.circle(2,y,level===4?3:2,"#e5fff3");
      }
    }
    ctx.restore();
  }
});
