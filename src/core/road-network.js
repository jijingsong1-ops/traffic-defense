"use strict";

// 从关卡路线生成唯一节点和有向边，可替换为地图编辑器输出。
class RoadNetwork {
  constructor(level, includeAlternate = false) {
    this.nodes = new Map(); this.edges = [];
    const uniqueEdges = new Set();
    const routes = includeAlternate ? [...level.routes, ...(level.routeEvent?.routes || [])] : level.routes;
    this.routes = routes.map(points => points.map(([x, y]) => {
      const key = `${x},${y}`;
      if (!this.nodes.has(key)) this.nodes.set(key, { x, y });
      return this.nodes.get(key);
    }));
    for (const route of this.routes) for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1];
      // 在已有路口处分段，合流道路只绘制一次，避免长短线段叠画标线。
      const points=[...this.nodes.values()].filter(p=>Collision.segmentDistance(p,a,b)<.001)
        .sort((p,q)=>Collision.distance(a,p)-Collision.distance(a,q));
      for(let n=1;n<points.length;n++){
        const from=points[n-1],to=points[n],key=`${from.x},${from.y}>${to.x},${to.y}`;
        if(!uniqueEdges.has(key)){uniqueEdges.add(key);this.edges.push([from,to]);}
      }
    }
    this.components=new Map();
    for(const node of this.nodes.values())if(!this.components.has(node)){
      const group=this.components.size,queue=[node];this.components.set(node,group);
      while(queue.length){const current=queue.pop();for(const [a,b] of this.edges){
        const next=a===current?b:b===current?a:null;
        if(next&&!this.components.has(next)){this.components.set(next,group);queue.push(next);}
      }}
    }
  }
  path(index) { return this.routes[index % this.routes.length]; }
  projections(p) {
    return this.edges.map(([a,b],edge)=>{
      const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
      const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
      const point={x:a.x+dx*t,y:a.y+dy*t};
      return {...point,edge,distance:Collision.distance(p,point)};
    }).sort((a,b)=>a.distance-b.distance);
  }
  nearestPoint(p) {
    const point=this.projections(p)[0];
    return point?{x:point.x,y:point.y}:null;
  }
  lineOnRoad(a,b) {
    const steps=Math.max(1,Math.ceil(Collision.distance(a,b)/6));
    for(let i=0;i<=steps;i++)if(!this.isRoad({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps},-3))return false;
    return true;
  }
  connected(from,to) {
    const a=this.projections(from)[0],b=this.projections(to)[0];
    return !!a&&!!b&&this.components.get(this.edges[a.edge][0])===this.components.get(this.edges[b.edge][0]);
  }
  // 车辆沿有向路行驶；步行队员沿开放道路双向通行，禁止从一条孤立支路横穿到另一条。
  walkPath(from,to) {
    const start=this.projections(from)[0],end=this.projections(to)[0];
    if(!start||!end)return null;
    const nodes=[...this.nodes.values()],ids=new Map(nodes.map((p,i)=>[p,i]));
    const graph=nodes.map(()=>[]),connect=(a,b)=>{const cost=Collision.distance(nodes[a],nodes[b]);graph[a].push([b,cost]);graph[b].push([a,cost]);};
    for(const [a,b] of this.edges)connect(ids.get(a),ids.get(b));
    const source=nodes.length;nodes.push({x:start.x,y:start.y});graph.push([]);
    const goal=nodes.length;nodes.push({x:end.x,y:end.y});graph.push([]);
    this.edges[start.edge].forEach(p=>connect(source,ids.get(p)));
    this.edges[end.edge].forEach(p=>connect(goal,ids.get(p)));
    if(start.edge===end.edge)connect(source,goal);
    const distances=nodes.map(()=>Infinity),previous=[],visited=new Set();distances[source]=0;
    while(visited.size<nodes.length){
      let current=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(current===-1||distances[i]<distances[current]))current=i;
      if(current===-1||!Number.isFinite(distances[current]))return null;
      if(current===goal)break;visited.add(current);
      for(const [next,cost] of graph[current])if(distances[next]>distances[current]+cost){distances[next]=distances[current]+cost;previous[next]=current;}
    }
    const route=[];for(let i=goal;i!==undefined;i=previous[i])route.unshift({...nodes[i]});
    // 同一道路上的短距离调动可直接行走；转角仍保留路口，不能切过建筑或未开放区域。
    if(this.lineOnRoad(from,to))return [{x:to.x,y:to.y}];
    route.push({x:to.x,y:to.y});
    return route.filter((p,i)=>!i||Collision.distance(p,route[i-1])>.1);
  }
  isRoad(p, margin = 0) {
    return this.edges.some(([a, b]) => Collision.segmentDistance(p, a, b) < CONFIG.roadWidth / 2 + margin);
  }
}
// 统一守卫与临时帮手的开放道路规则。预留 buildRoad 永远不参与队员寻路。
const AlliedNavigation = {
  length(from,points) {let total=0;for(const p of points||[]){total+=Collision.distance(from,p);from=p;}return total;},
  connectorClear(game,from,to) {
    const closed=game.routeChanged?game.previousRoad:game.eventRoad;
    if(!closed)return true;
    const count=Math.max(1,Math.ceil(Collision.distance(from,to)/6));
    for(let i=0;i<=count;i++){
      const p={x:from.x+(to.x-from.x)*i/count,y:from.y+(to.y-from.y)*i/count};
      if(closed.isRoad(p,-3)&&!game.road.isRoad(p,-3))return false;
    }
    return true;
  },
  base(game,owner) {
    if(owner.navigationRoad!==game.road||owner.navigationRange!==owner.stats.rallyRange){
      owner.navigationRoad=game.road;
      owner.navigationRange=owner.stats.rallyRange;
      const point=game.road.projections(owner).find(p=>p.distance<=owner.stats.rallyRange&&this.connectorClear(game,owner,p));
      owner.roadAccess=point?{x:point.x,y:point.y}:null;
    }
    return owner.roadAccess;
  },
  defaultRally(game,owner) {const point=this.base(game,owner);return point?{...point}:null;},
  resolveRally(game,owner,point) {
    const access=this.base(game,owner),rally=game.road.nearestPoint(point);
    if(!access||!rally||Collision.distance(point,rally)>30||Collision.distance(owner,rally)>owner.stats.rallyRange)return null;
    return game.road.connected(access,rally)?rally:null;
  },
  canTarget(game,owner,enemy) {
    const access=this.base(game,owner);
    if(!access||!owner.rally||!game.road.isRoad(enemy,-3)||!game.road.connected(access,enemy))return false;
    if(game.road.lineOnRoad(owner.rally,enemy))return true;
    // 发夹弯另一端虽看起来很近，绕路却可能很远；不能离开集合区域追过整张地图。
    const path=game.road.walkPath(owner.rally,enemy);
    return !!path&&this.length(owner.rally,path)<=CONFIG.soldierLeash+CONFIG.roadWidth/2;
  },
  canStrike(game,unit,enemy) {
    return !unit.retreatPath&&game.road.lineOnRoad(unit,enemy)&&game.road.connected(unit,enemy);
  },
  step(unit,path,distance) {
    while(path.length&&distance>0){
      const point=path[0],length=Collision.distance(unit,point);
      if(length<=distance){unit.x=point.x;unit.y=point.y;path.shift();distance-=length;}
      else{unit.x+=(point.x-unit.x)*distance/length;unit.y+=(point.y-unit.y)*distance/length;distance=0;}
    }
  },
  move(unit,destination,dt,game) {
    if(unit.retreatPath){this.step(unit,unit.retreatPath,CONFIG.soldierSpeed*dt);if(!unit.retreatPath.length)unit.retreatPath=null;return;}
    const access=this.base(game,unit.owner);
    if(!access||!destination)return;
    if(!unit.walkRoute||unit.walkRoad!==game.road||!unit.walkGoal||Collision.distance(destination,unit.walkGoal)>8||!unit.walkRoute.length){
      // 生成路线只允许一个已验证的建筑出入口，不能从当前位置朝道路任意穿越空地。
      const onRoad=game.road.isRoad(unit,-3);
      const path=game.road.walkPath(onRoad?unit:access,destination);
      unit.walkRoute=path?(onRoad?path:[{...access},...path]):[];
      unit.walkRoad=game.road;unit.walkGoal={x:destination.x,y:destination.y};
    }
    this.step(unit,unit.walkRoute,CONFIG.soldierSpeed*dt);
  },
  reconcile(game,previous) {
    for(const owner of game.towers.filter(t=>t.type==="depot")){
      const oldAccess=owner.roadAccess||previous.nearestPoint(owner),oldRally=owner.rally;
      owner.navigationRoad=null;
      owner.rally=oldRally?this.resolveRally(game,owner,oldRally):null;
      // 改道自动继承集合点时，不能保留需要绕行整张地图的旧位置；重新在有效出入口集结。
      if(owner.rally){const access=this.base(game,owner),path=game.road.walkPath(access,owner.rally);
        if(!path||this.length(access,path)>owner.stats.rallyRange+CONFIG.roadWidth/2)owner.rally=null;
      }
      owner.rally||=this.defaultRally(game,owner);
      for(const unit of owner.soldiers){
        unit.release();unit.walkRoute=null;unit.retreatPath=null;
        if(!unit.alive)continue;
        // 共用路面也可能因改道变成发夹弯的另一端。比较绕路与返回基地后出勤，避免近处集合却绕整图。
        if(owner.rally&&game.road.isRoad(unit,-3)&&game.road.connected(unit,owner.rally)){
          const direct=game.road.walkPath(unit,owner.rally),back=oldAccess&&previous.walkPath(unit,oldAccess),access=this.base(game,owner);
          const onward=access&&game.road.walkPath(access,owner.rally);
          const viaBase=back&&onward?this.length(unit,back)+Collision.distance(oldAccess,owner)+Collision.distance(owner,access)+this.length(access,onward):Infinity;
          if(direct&&this.length(unit,direct)<=viaBase)continue;
        }
        if(Collision.distance(unit,owner)<1)continue;
        const candidates=[];
        if(owner.rally){
          for(const junction of previous.nodes.values())if(game.road.projections(junction)[0]?.distance<.01){
            const before=previous.walkPath(unit,junction),after=game.road.walkPath(junction,owner.rally);
            if(before&&after)candidates.push([...before,...after]);
          }
        }
        if(oldAccess){
          const back=previous.walkPath(unit,oldAccess);
          if(back)candidates.push([...back,{x:owner.x,y:owner.y}]);
        }
        candidates.sort((a,b)=>this.length(unit,a)-this.length(unit,b));
        unit.retreatPath=candidates[0]||null;
      }
    }
  }
};
// 每关只开放关卡设计表里的固定战术点位；地图缩放仅换算坐标，不增加点位。
// 新旧道路共用编号，动态路线切换不会吞掉已建造的设施。
function planConstructionSites(level) {
  const preset = CONSTRUCTION_SITES[level.id];
  if (!preset) throw new Error(`缺少关卡 ${level.id} 的固定建造点位`);
  return preset.map(([x, y]) => [Math.round(MAP.x + x * MAP.w), Math.round(MAP.y + y * MAP.h)]);
}
LEVELS.forEach(level => { level.sites = planConstructionSites(level); });

// 联防以同一段真实开放车道为准，不能仅凭两个圆相交就提示可以配合。
const ConstructionTactics = {
  sharedRoad(road,a,b,rangeA=TOWERS.signal.range,rangeB=TOWERS.signal.range) {
    const segments=[];
    for(const [from,to] of road.edges){
      const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);if(!length)continue;
      let low=0,high=1;
      for(const [point,radius] of [[a,rangeA],[b,rangeB]]){
        const projection=((point.x-from.x)*dx+(point.y-from.y)*dy)/(length*length);
        const perpendicular=(point.x-from.x)**2+(point.y-from.y)**2-(projection*length)**2;
        if(perpendicular>=radius*radius){high=-1;break;}
        const reach=Math.sqrt(radius*radius-Math.max(0,perpendicular))/length;
        low=Math.max(low,projection-reach);high=Math.min(high,projection+reach);
      }
      if(high>low)segments.push({a:{x:from.x+dx*low,y:from.y+dy*low},b:{x:from.x+dx*high,y:from.y+dy*high},length:(high-low)*length});
    }
    return segments;
  },
  links(game,site) {
    const tower=game.towers.find(t=>t.siteId===site.id&&!t.temporary);
    const range=tower?.stats.range||TOWERS[game.selectedSite===site&&game.previewTowerType||"signal"].range;
    return game.sites.filter(other=>other!==site&&Collision.distance(site,other)<=SITE_RULES.partnerDistance).map(other=>{
      const ally=game.towers.find(t=>t.siteId===other.id&&!t.temporary);
      const segments=this.sharedRoad(game.road,site,other,range,ally?.stats.range||TOWERS.signal.range);
      return {site:other,segments,length:segments.reduce((sum,s)=>sum+s.length,0)};
    }).filter(link=>link.length>=SITE_RULES.sharedLength);
  }
};
