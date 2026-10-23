const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(stage=0) {
  const noop = () => {};
  const context = new Proxy({}, {get: (o,k) => o[k] || noop, set: (o,k,v) => (o[k] = v, true)});
  const canvas = {getContext: () => context, addEventListener: noop, style: {}, focus: noop,
    getBoundingClientRect: () => ({left: 0, top: 0, width: 1280, height: 720})};
  const sandbox = {console, requestAnimationFrame: noop,
    document: {getElementById: () => canvas, addEventListener: noop, hidden: false},
    window: {addEventListener: noop}, localStorage: {getItem: () => null, setItem: noop}};
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const source = [...html.matchAll(/<script defer src="([^"]+)"><\/script>/g)]
    .map(match => fs.readFileSync(path.join(__dirname, '..', match[1]), 'utf8')).join('\n');
  vm.createContext(sandbox);
  const api = vm.runInContext(source + '\n({game, Tower, Enemy, RoadNetwork, AlliedNavigation, Collision, CONFIG, LEVELS, WorldOps, WORLD_RULES, Encounters, Traffic, MAP, Renderer, Platform, Lanes})', sandbox);
  if(stage)api.game.progress.stars.fill(3);
  api.game.startLevel(stage);
  return api;
}

function open(api,kind) {
  const point=api.game.worldOps.points.find(p=>p.kind===kind);
  assert.ok(point,`missing interaction ${kind} in ${api.game.level.id}`);
  assert.equal(api.WorldOps.open(api.game,point),true);return point;
}
function close(api) {api.game.modal=null;api.game.worldOps.selected=null;}
function unit(api,type='armor',lane=0) {
  const enemy=new api.Enemy(type,api.game.road.path(0),1,{lane,span:1});
  api.game.enemies.push(enemy);return enemy;
}
function acceptChallenge(api) {
  api.game.wave=1;open(api,'challenge');assert.equal(api.WorldOps.activate(api.game),true);
  return api.game.worldOps.challenge;
}

test('all 48 maps provide one or two facilities with separate model and label footprints',()=>{
  const api=setup();api.game.progress.stars.fill(3);
  for(let index=0;index<api.LEVELS.length;index++){
    api.game.startLevel(index);const points=api.game.worldOps.points;
    assert.ok(points.length>=1&&points.length<=2,`${api.game.level.id}: expected 1–2 optional facilities`);
    assert.equal(new Set(points.map(p=>p.kind)).size,points.length);
    assert.deepEqual(JSON.parse(JSON.stringify(api.WorldOps.plan(api.game))),JSON.parse(JSON.stringify(points)));
    for(const p of points){
      assert.ok(api.Collision.inside(p,api.MAP));
      assert.equal(api.game.buildRoad.isRoad(p,17),false,`${api.game.level.id}: facility on current/future road`);
      assert.ok(api.game.sites.every(s=>api.Collision.distance(s,p)>=64));
      for(const box of api.WorldOps.parts(p)){
        assert.ok(api.Collision.inside(box,api.MAP)&&api.Collision.inside({x:box.x+box.w,y:box.y+box.h},api.MAP));
        assert.equal(api.WorldOps.coversRoad(box,api.game.buildRoad),false,`${api.game.level.id}: model/label on a lane`);
        assert.ok(api.WorldOps.obstacles(api.game).every(other=>!api.WorldOps.overlaps(box,other)),`${api.game.level.id}: model/label overlaps a tower or traffic sign`);
      }
      const [model,label]=api.WorldOps.parts(p);
      assert.equal(api.WorldOps.overlaps(model,label,0),false,'the name must sit outside the model');
      assert.ok(points.every(other=>other===p||!api.WorldOps.overlaps(api.WorldOps.bounds(p),api.WorldOps.bounds(other),24)));
    }
  }
});

test('shop purchases charge once, respect stock and budget; starting another battle resets all inventory',()=>{
  const api=setup(),{game,WorldOps,WORLD_RULES}=api;
  game.gold=200;open(api,'shop');
  for(let i=0;i<2;i++)assert.equal(WorldOps.buy(game,'barrier'),true);
  assert.equal(game.gold,200-WORLD_RULES.barrier.cost*2);
  assert.equal(game.worldOps.inventory.barrier,2);assert.equal(game.worldOps.stock.barrier,0);
  assert.equal(WorldOps.buy(game,'barrier'),false);assert.equal(WorldOps.buy(game,'invalid'),false);
  assert.equal(WorldOps.buy(game,'helpers'),false);assert.equal(game.gold,80);
  const before=JSON.stringify(game.progress);game.startLevel(0);
  assert.equal(game.worldOps.inventory.barrier,0);assert.equal(game.worldOps.stock.barrier,2);
  assert.equal(game.worldOps.stock.helpers,1);assert.equal(game.towers.length,0);
  assert.equal(JSON.stringify(game.progress),before);
});

test('repair purchase rejects healthy or dead-only targets and repairs living targets without resurrection',()=>{
  const api=setup(),{game,WorldOps,Tower,WORLD_RULES}=api;game.gold=500;open(api,'shop');
  assert.equal(WorldOps.buy(game,'repair'),false);assert.equal(game.gold,500);
  const bus={kind:'bus',health:0,dead:true};game.traffic.civilians=[bus];
  assert.equal(WorldOps.buy(game,'repair'),false);assert.equal(bus.health,0);
  const tower=new Tower('depot',game.sites[0].x,game.sites[0].y);game.towers=[tower];tower.update(0,game);
  const [hurt,dead]=tower.soldiers;hurt.health=10;dead.health=0;tower.jammedTime=5;
  assert.equal(WorldOps.buy(game,'repair'),true);
  assert.equal(game.gold,500-WORLD_RULES.repair.cost);assert.equal(hurt.health,88);
  assert.equal(dead.health,0);assert.equal(bus.health,0);assert.equal(tower.jammedTime,0);
  assert.ok(tower.jamGuardTime>0);
});

test('pause and panels freeze gathering, helper duration, cooldowns, zones and optional challenge clocks',()=>{
  const api=setup(1),{game,WorldOps}=api;
  game.gold=1000;open(api,'shop');assert.equal(WorldOps.buy(game,'helpers'),true);close(api);
  open(api,'cache');assert.equal(WorldOps.activate(game),true);
  game.worldOps.zones.push({x:100,y:300,radius:100,life:5,slow:.3});
  game.worldOps.points[0].cooldown=20;
  const snapshot=()=>JSON.stringify({clock:game.worldOps.clock,cache:game.worldOps.cache.remaining,
    helper:game.towers[0].duration,zone:game.worldOps.zones[0].life,cd:game.worldOps.points[0].cooldown});
  const before=snapshot();game.paused=true;game.update(4);assert.equal(snapshot(),before);
  game.paused=false;open(api,'shop');game.update(4);assert.equal(snapshot(),before);
  close(api);game.update(.1);assert.notEqual(snapshot(),before);
  game.startLevel(3);const task=acceptChallenge(api),remaining=task.remaining;
  game.paused=true;game.update(4);assert.equal(task.remaining,remaining);
  game.paused=false;open(api,'relay');game.update(4);assert.equal(task.remaining,remaining);
  close(api);game.update(.1);assert.ok(task.remaining<remaining);
});

test('tools reject unopened roads and cancel without consuming; placed barriers affect enemies only',()=>{
  const api=setup(),{game,WorldOps,Collision}=api;game.progress.stars.fill(3);game.startLevel(3);
  game.worldOps.inventory.barrier=1;assert.equal(WorldOps.selectItem(game),true);game.cancel();
  assert.equal(game.worldOps.inventory.barrier,1);assert.equal(game.item,null);
  WorldOps.selectItem(game);
  const inactive=game.eventRoad.edges.map(([a,b])=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2})).find(p=>!game.road.isRoad(p));
  assert.ok(inactive);assert.equal(WorldOps.placeItem(game,inactive),false);
  assert.equal(game.worldOps.inventory.barrier,1);
  const active=game.road.nearestPoint(game.sites[0]);game.paused=true;
  assert.equal(WorldOps.placeItem(game,active),false);game.paused=false;
  assert.equal(WorldOps.placeItem(game,active),true);assert.equal(game.worldOps.inventory.barrier,0);
  const enemy=unit(api);enemy.x=active.x;enemy.y=active.y;
  const civilian={x:active.x,y:active.y,kind:'bus',health:90};game.traffic.civilians=[civilian];
  WorldOps.update(game,.1);assert.ok(Math.abs(enemy.slowFactor-.3)<1e-8);assert.equal(civilian.slowFactor,undefined);
  assert.equal(WorldOps.placeItem(game,active),false);
});

test('hired squad consumes one stock, never occupies a tower pad, cannot sell/upgrade and releases blockers at expiry',()=>{
  const api=setup(),{game,WorldOps,Enemy}=api;game.gold=1000;const shop=open(api,'shop');
  assert.equal(WorldOps.buy(game,'helpers'),true);assert.equal(WorldOps.buy(game,'helpers'),false);close(api);
  const tower=game.towers.find(t=>t.temporary);assert.ok(tower);
  assert.equal(tower.level,2);assert.equal(tower.soldiers.length,3);assert.equal(tower.siteId,undefined);
  assert.equal(tower.invested,0);assert.equal(tower.x,shop.x);assert.equal(tower.y,shop.y);
  const gold=game.gold;game.selected=tower;assert.equal(game.upgrade(),false);game.sell();
  assert.ok(game.towers.includes(tower));assert.equal(game.gold,gold);
  const enemy=new Enemy('armor',game.road.path(0));enemy.x=tower.rally.x;enemy.y=tower.rally.y;game.enemies=[enemy];
  const guard=tower.soldiers[0];guard.x=enemy.x;guard.y=enemy.y;guard.target=enemy;enemy.blocker=guard;
  tower.duration=.05;WorldOps.update(game,.1);
  assert.equal(enemy.blocker,null);assert.equal(game.towers.includes(tower),false);assert.equal(game.selected,null);
});

test('temporary squads reject a shop whose only nearby road is not yet open without charging',()=>{
  const api=setup(),{game,WorldOps,RoadNetwork}=api;
  game.road=new RoadNetwork({routes:[[[100,300],[300,300],[300,150],[900,150]]]});
  game.eventRoad=new RoadNetwork({routes:[[[100,300],[300,300],[300,500],[900,500]]]});
  game.routeChanged=false;game.worldOps.points=[{kind:'shop',x:450,y:430,name:'测试驿站'}];
  game.gold=500;open(api,'shop');assert.equal(WorldOps.buy(game,'helpers'),false);
  assert.equal(game.gold,500);assert.equal(game.worldOps.stock.helpers,1);assert.equal(game.towers.length,0);
});

test('gathering pauses for enemy threats, resumes in safety, and rewards only once',()=>{
  const api=setup(1),{game,WorldOps,WORLD_RULES}=api;const point=open(api,'cache');WorldOps.activate(game);
  const enemy=unit(api);enemy.x=point.x;enemy.y=point.y;
  const before=game.gold;WorldOps.update(game,5);assert.equal(game.worldOps.cache.remaining,WORLD_RULES.cache.duration);
  enemy.dead=true;WorldOps.update(game,7);assert.equal(game.gold,before);
  WorldOps.update(game,1);assert.equal(game.gold,before+WORLD_RULES.cache.reward);assert.equal(game.worldOps.cache,null);
  open(api,'cache');assert.equal(WorldOps.activate(game),false);close(api);
  WorldOps.update(game,20);assert.equal(game.gold,before+WORLD_RULES.cache.reward);
});

test('relay and overdrive timers remain independent and strongest haste does not stack or get extended',()=>{
  const api=setup(3),{game,WorldOps,Tower,WORLD_RULES}=api;game.gold=500;
  const point=open(api,'relay');assert.equal(WorldOps.activate(game),false);assert.equal(game.gold,500);
  const tower=new Tower('rail',point.x+30,point.y);game.towers=[tower];tower.hasteTime=2;tower.hastePower=.8;
  assert.equal(WorldOps.activate(game),true);assert.equal(tower.attackSpeed,1.8);
  tower.update(3,game);assert.equal(tower.hasteTime,0);assert.equal(tower.relayHasteTime,9);
  assert.equal(tower.attackSpeed,1.3);assert.equal(game.gold,500-WORLD_RULES.relay.cost);
  tower.update(10,game);assert.equal(tower.attackSpeed,1);
  open(api,'relay');assert.equal(WorldOps.activate(game),false);
});

test('optional challenge warns then deploys exactly four distinct lanes atomically after clearance',()=>{
  const api=setup(3),{game,WorldOps,Traffic,Encounters,Enemy,WORLD_RULES}=api;
  const task=acceptChallenge(api),entry=Encounters.entrances(game.level)[task.entry],path=Traffic.path(game,entry.routes[0]);
  const blocker=new Enemy('armor',path,1,{lane:0,span:1});game.enemies=[blocker];
  WorldOps.update(game,WORLD_RULES.challenge.warning-1);assert.equal(task.phase,'warning');assert.equal(game.enemies.length,1);
  WorldOps.update(game,1);assert.equal(task.phase,'warning');assert.equal(task.units.length,0);
  WorldOps.update(game,10);assert.equal(game.enemies.length,1,'blocked entry must not partially spawn the other lanes');
  blocker.dead=true;WorldOps.update(game,.01);
  assert.equal(task.phase,'active');assert.equal(task.units.length,4);assert.equal(new Set(task.units.map(e=>e.lane)).size,4);
  assert.ok(task.units.every(e=>e.path===path&&e.laneSpan===1));
  assert.equal(task.remaining,WORLD_RULES.challenge.duration);
  WorldOps.update(game,.01);assert.equal(game.enemies.filter(e=>!e.dead).length,4);
});

test('pending challenge prevents final-wave victory and pays exactly once only after the squad is destroyed',()=>{
  const api=setup(3),{game,WorldOps,WORLD_RULES}=api;const task=acceptChallenge(api);
  game.wave=game.level.waves;game.state='wave';game.spawnQueue=[];
  game.update(.1);assert.equal(game.screen,'battle');assert.equal(WorldOps.complete(game),false);
  WorldOps.update(game,3);assert.equal(task.phase,'active');game.update(.1);assert.equal(game.screen,'battle');
  task.units.forEach(e=>{e.health=0;e.dead=true;});const gold=game.gold;
  WorldOps.update(game,.1);assert.equal(task.phase,'won');assert.equal(game.gold,gold+WORLD_RULES.challenge.reward);
  WorldOps.update(game,1);assert.equal(game.gold,gold+WORLD_RULES.challenge.reward);
  game.update(.1);assert.equal(game.screen,'result');assert.equal(game.won,true);
});

test('challenge escape and timeout award no bonus and do not add an extra punishment',()=>{
  for(const reason of ['escape','timeout']){
    const api=setup(3),{game,WorldOps,WORLD_RULES}=api,task=acceptChallenge(api);WorldOps.update(game,3);
    const gold=game.gold,lives=game.lives;
    if(reason==='escape')task.units[0].escape(game);else task.remaining=.01;
    WorldOps.update(game,.02);
    assert.equal(task.phase,'lost');assert.equal(game.gold,gold);
    assert.equal(game.lives,reason==='escape'?lives-task.units[0].spec.leak:lives);
    assert.equal(WorldOps.complete(game),true);assert.ok(task.units.some(e=>!e.dead));
    task.units.forEach(e=>{e.health=0;e.dead=true;});WorldOps.update(game,1);assert.equal(game.gold,gold);
  }
});

test('challenge spawned after a route event uses the open route and leaves regular waves intact',()=>{
  const api=setup(),{game,WorldOps}=api;game.progress.stars.fill(3);game.startLevel(3);
  const task=acceptChallenge(api),queueBefore=JSON.stringify(game.spawnQueue);
  game.wave=game.level.routeEvent.wave;game.applyRouteEvent();WorldOps.update(game,3);
  assert.equal(task.phase,'active');assert.ok(task.units.every(e=>game.road.routes.includes(e.path)));
  assert.equal(JSON.stringify(game.spawnQueue),queueBefore);assert.equal(game.wave,game.level.routeEvent.wave);
});


test('all six chapter mechanisms use their documented effects, price and cooldown without charging twice',()=>{
  const api=setup(),{game,WorldOps,WORLD_RULES}=api;game.progress.stars.fill(3);
  for(const chapter of [0,1,2,3,4,5]){
    game.startLevel(chapter*8+2);game.gold=500;
    const point=open(api,'mechanism'),anchor=WorldOps.activeAnchor(game,point),enemy=unit(api,'scout');
    assert.ok(anchor);enemy.x=anchor.x;enemy.y=anchor.y;
    const hp=enemy.health;assert.equal(WorldOps.activate(game),true);
    assert.equal(game.gold,500-WORLD_RULES.mechanism.cost);assert.equal(point.cooldown,WORLD_RULES.mechanism.cooldown);
    if(chapter===3)assert.ok(enemy.health<hp);else assert.equal(enemy.health,hp);
    if(chapter===5)assert.ok(enemy.stunTime>0);
    WorldOps.update(game,.1);
    if(chapter===2||chapter===4)assert.ok(enemy.silenceTime>0);
    if(!enemy.dead)assert.ok(enemy.slowFactor<1);
    open(api,'mechanism');assert.equal(WorldOps.activate(game),false);assert.equal(game.gold,460);close(api);
  }
});
