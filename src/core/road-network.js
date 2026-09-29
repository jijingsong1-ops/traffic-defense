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
      const a = route[i], b = route[i + 1], key = `${a.x},${a.y}>${b.x},${b.y}`;
      if (!uniqueEdges.has(key)) { uniqueEdges.add(key); this.edges.push([a, b]); }
    }
  }
  path(index) { return this.routes[index % this.routes.length]; }
  nearestPoint(p) {
    return this.edges.map(([a,b])=>{
      const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
      return {x:a.x+dx*t,y:a.y+dy*t};
    }).sort((a,b)=>Collision.distance(a,p)-Collision.distance(b,p))[0];
  }
  isRoad(p, margin = 0) {
    return this.edges.some(([a, b]) => Collision.segmentDistance(p, a, b) < CONFIG.roadWidth / 2 + margin);
  }
}
// 隐藏网格的道路旁设备地块：沿每条有向边的两侧采样，再剔除路口、越界和相互重叠的位置。
// 结果只由路线和顶部参数决定，重玩关卡不会重新随机布点。
function planConstructionSites(level) {
  // 为所有可能的道路预留空间，变道后既不吞塔，也不改变地块编号。
  const road = new RoadNetwork(level, true), sites = [];
  for (const [a, b] of road.edges) {
    const length = Collision.distance(a, b), steps = Math.max(1, Math.floor(length / CONFIG.spacing));
    const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
    for (let step = 0; step < steps; step++) for (const side of [-1, 1]) {
      const fraction = (step + 0.5) / steps;
      const p = { x: Math.round(a.x + (b.x - a.x) * fraction + nx * CONFIG.siteRoadOffset * side),
        y: Math.round(a.y + (b.y - a.y) * fraction + ny * CONFIG.siteRoadOffset * side) };
      if (p.x < 60 || p.x > 882 || p.y < 191 || p.y > 637 || road.isRoad(p, CONFIG.towerRadius + 7)) continue;
      if (sites.some(other => Collision.distance(p, other) < CONFIG.spacing)) continue;
      sites.push(p);
    }
  }
  return sites.map(({x, y}) => [x, y]);
}
LEVELS.forEach(level => { level.sites = planConstructionSites(level); });
