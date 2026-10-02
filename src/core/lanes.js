"use strict";

// 路网保留中心线与路口关系；车道只偏移车辆物理位置，伤害/拦截读取真实位置。
const Lanes = {
  offset(lane,span=1) {return (lane+(span-1)/2-1.5)*CONFIG.laneWidth;},
  overlap(a,b) {
    if(a.lane===null||a.lane===undefined||b.lane===null||b.lane===undefined)return true;
    return a.lane<b.lane+(b.laneSpan||1)&&b.lane<a.lane+(a.laneSpan||1);
  },
  normal(path,index) {
    const normal=(a,b)=>{const length=Math.hypot(b.x-a.x,b.y-a.y);return {x:-(b.y-a.y)/length,y:(b.x-a.x)/length};};
    if(index===0)return normal(path[0],path[1]);
    if(index===path.length-1)return normal(path[index-1],path[index]);
    const a=normal(path[index-1],path[index]),b=normal(path[index],path[index+1]);
    const x=a.x+b.x,y=a.y+b.y,length=Math.hypot(x,y),dot=(x*b.x+y*b.y)/length;
    const scale=Math.min(1.4,1/Math.max(.2,dot));
    return {x:x/length*scale,y:y/length*scale};
  },
  point(path,index,center,offset) {
    const a=path[index],b=path[index+1];
    if(!b){const n=this.normal(path,path.length-1);return {x:center.x+n.x*offset,y:center.y+n.y*offset};}
    const length=Collision.distance(a,b),t=Math.max(0,Math.min(1,((center.x-a.x)*(b.x-a.x)+(center.y-a.y)*(b.y-a.y))/(length*length)));
    const from=this.normal(path,index),to=this.normal(path,index+1);
    return {x:center.x+(from.x+(to.x-from.x)*t)*offset,y:center.y+(from.y+(to.y-from.y)*t)*offset};
  },
  sync(actor) {
    if(!actor.center)return;
    const p=this.point(actor.path,actor.segment,actor.center,this.offset(actor.lane,actor.laneSpan));actor.x=p.x;actor.y=p.y;
  }
};
