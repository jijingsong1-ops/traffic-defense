// 固定战术点位的设计约束；和真实网页使用相同的加载顺序与地图换算。
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function load(){
  const noop=()=>{},ctx=new Proxy({}, {get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
  const canvas={getContext:()=>ctx,addEventListener:noop,style:{},focus:noop,getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})};
  const sandbox={console,requestAnimationFrame:noop,document:{getElementById:()=>canvas,addEventListener:noop,hidden:false},window:{addEventListener:noop},localStorage:{getItem:()=>null,setItem:noop}};
  vm.createContext(sandbox);
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const source=[...html.matchAll(/<script defer src="([^"]+)"><\/script>/g)].map(m=>fs.readFileSync(path.join(__dirname,'..',m[1]),'utf8')).join('\n');
  return vm.runInContext(source+'\n({game,LEVELS,MAP,CONFIG,Collision,RoadNetwork,CONSTRUCTION_SITES,planConstructionSites,ConstructionTactics,SITE_RULES,Tower})',sandbox);
}

test('all 48 levels have sparse fixed presets with stable numbering and no automatic fallback',()=>{
  const {LEVELS,CONSTRUCTION_SITES,planConstructionSites}=load();
  assert.equal(Object.keys(CONSTRUCTION_SITES).length,48);
  for(const level of LEVELS){
    assert.ok(level.sites.length>=8&&level.sites.length<=12,level.id+' fixed strategic point count');
    assert.equal(level.sites.length,CONSTRUCTION_SITES[level.id].length);
    assert.deepEqual(planConstructionSites(level),level.sites);
    assert.deepEqual(planConstructionSites({...level,routes:level.routes.slice().reverse(),routeEvent:null}),level.sites,'routes do not generate or reorder points');
  }
  assert.throws(()=>planConstructionSites({id:'missing-design',routes:LEVELS[0].routes}),/缺少关卡/);
});

test('fixed points remain clear of both current and future four-lane roads and one another',()=>{
  const {LEVELS,MAP,CONFIG,RoadNetwork,Collision,SITE_RULES}=load();
  for(const level of LEVELS){
    const road=new RoadNetwork(level,true),sites=level.sites.map(([x,y])=>({x,y}));
    for(const [i,site] of sites.entries()){
      assert.ok(site.x>=MAP.x+36&&site.x<=MAP.x+MAP.w-42&&site.y>=MAP.y+79&&site.y<=MAP.y+MAP.h-49,level.id+' boundary');
      assert.equal(road.isRoad(site,CONFIG.towerRadius+7),false,level.id+' reserved future lane');
      assert.ok(Collision.distance(site,road.nearestPoint(site))<=71,level.id+' useful roadside point');
      for(const other of sites.slice(i+1)){
        assert.ok(Collision.distance(site,other)>=SITE_RULES.minSpacing,level.id+' deliberate point separation');
        assert.ok(Math.abs(site.x-other.x)>=SITE_RULES.modelWidth||Math.abs(site.y-other.y)>=SITE_RULES.modelHeight,level.id+' advanced tower silhouettes remain separate');
      }
    }
  }
});

test('each roadside emplacement has a nearby partner on a real shared road before and after rerouting',()=>{
  const {game,LEVELS,Collision,ConstructionTactics,SITE_RULES}=load();game.progress.stars.fill(3);
  for(let index=0;index<LEVELS.length;index++){
    game.startLevel(index);
    for(const changed of [false,true]){
      if(changed){if(!game.level.routeEvent)continue;game.wave=game.level.routeEvent.wave;game.applyRouteEvent();}
      for(const site of game.sites){
        // 未来道路的备用阵地在道路开放前不要求能覆盖现有车道。
        if(Collision.distance(site,game.road.nearestPoint(site))>92)continue;
        const partners=ConstructionTactics.links(game,site);
        assert.ok(partners.length,`${game.level.id} / ${changed?'after':'before'} / site ${site.id}`);
        for(const partner of partners){
          assert.ok(Collision.distance(site,partner.site)<=SITE_RULES.partnerDistance);
          assert.ok(partner.length>=SITE_RULES.sharedLength);
          for(const segment of partner.segments)for(const p of [segment.a,segment.b]){
            assert.ok(game.road.isRoad(p));
            assert.ok(Collision.distance(site,p)<=108.001&&Collision.distance(partner.site,p)<=108.001);
          }
        }
      }
    }
  }
});

test('cooperation highlights require shared road, use actual tower ranges and never include closed branches',()=>{
  const {ConstructionTactics,RoadNetwork}=load();
  const a={x:0,y:0,id:0},b={x:100,y:0,id:1};
  const remote=new RoadNetwork({routes:[[[0,150],[200,150]]]});
  assert.equal(ConstructionTactics.sharedRoad(remote,a,b).length,0,'overlapping circles alone do not form a fire zone');
  const road=new RoadNetwork({routes:[[[-200,0],[300,0]]]}),segments=ConstructionTactics.sharedRoad(road,a,b,70,90);
  assert.equal(segments.length,1);assert.equal(segments[0].a.x,10);assert.equal(segments[0].b.x,70);
  const mock={road,sites:[a,b],towers:[{siteId:0,stats:{range:70}},{siteId:1,stats:{range:90}}]};
  assert.equal(ConstructionTactics.links(mock,a).length,1);
  mock.towers[1].stats.range=40;assert.equal(ConstructionTactics.links(mock,a).length,0,'real range can invalidate a potential partner');
  mock.towers[1].stats.range=140;assert.equal(ConstructionTactics.links(mock,a).length,1);
  mock.road=remote;assert.equal(ConstructionTactics.links(mock,a).length,0,'a closed road is removed from the overlay');
});

test('every current and future route retains substantial fire coverage from several fixed sites',()=>{
  const {LEVELS,RoadNetwork,Collision}=load();
  for(const level of LEVELS)for(const route of new RoadNetwork(level,true).routes){
    const sites=level.sites.map(([x,y])=>({x,y}));let length=0,covered=0;
    const useful=new Set();
    for(let i=1;i<route.length;i++){
      const a=route[i-1],b=route[i],segment=Collision.distance(a,b),steps=Math.ceil(segment/10);
      for(let n=0;n<steps;n++){
        const p={x:a.x+(b.x-a.x)*(n+.5)/steps,y:a.y+(b.y-a.y)*(n+.5)/steps};
        const defenders=sites.map((site,index)=>({index,d:Collision.distance(site,p)})).filter(item=>item.d<=125);
        length+=segment/steps;if(defenders.length)covered+=segment/steps;
        for(const defender of defenders)useful.add(defender.index);
      }
    }
    assert.ok(covered/length>=.55,level.id+' at least 55% base-range coverage, including alternate route');
    assert.ok(useful.size>=4,level.id+' multiple towers can cooperate on each route');
  }
});

test('the game accepts only exact preset locations and preserves their identity after a route event',()=>{
  const {game,LEVELS}=load();game.progress.stars.fill(3);
  for(let index=0;index<LEVELS.length;index++){
    game.startLevel(index);
    for(const [id,site] of game.sites.entries()){
      assert.equal(site.id,id);
      assert.equal(game.canBuild(site),true);
      assert.equal(game.canBuild({x:site.x+1,y:site.y}),false,'empty land beside a site remains unavailable');
    }
    if(game.level.routeEvent){
      const before=JSON.stringify(game.sites);game.wave=game.level.routeEvent.wave;game.applyRouteEvent();
      assert.equal(JSON.stringify(game.sites),before,'changing traffic does not create or renumber a site');
    }
  }
});
