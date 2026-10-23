const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
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
  const api = vm.runInContext(source + '\n({game, Tower, Enemy, RoadNetwork, AlliedNavigation, Collision, CONFIG, LEVELS})', sandbox);
  api.game.startLevel(0);
  return api;
}
function roads(api, routes, alternate = null) {
  const {game, RoadNetwork} = api;
  game.level = {...game.level, routes, routeEvent: alternate ? {wave: 2, routes: alternate, name: '封路测试'} : null};
  game.road = new RoadNetwork(game.level);
  game.buildRoad = new RoadNetwork(game.level, true);
  game.eventRoad = alternate ? new RoadNetwork({routes: alternate}) : null;
  game.previousRoad = null; game.routeChanged = false;
  game.towers = []; game.enemies = [];
}
function depot(api, x, y, temporary = false) {
  const owner = new api.Tower('depot', x, y);
  owner.temporary = temporary;
  api.game.towers.push(owner);
  owner.rally = api.AlliedNavigation.defaultRally(api.game, owner);
  owner.update(0, api.game);
  return owner;
}
const oldRoute = [[[100,300],[300,300],[300,150],[650,150],[650,300],[900,300]]];
const newRoute = [[[100,300],[300,300],[300,500],[650,500],[650,300],[900,300]]];

// 复现此前 buildRoad 含未来线路，导致队员提前进入虚线道路的问题。
test('guards and hired guards cannot deploy or rally onto unopened roads', () => {
  const api = setup(); roads(api, oldRoute, newRoute);
  for(const temporary of [false, true]) {
    const owner = depot(api, 450, 430, temporary);
    assert.equal(owner.rally, null);
    for(let i=0;i<120;i++) owner.update(1/60, api.game);
    owner.soldiers.forEach(s => {assert.equal(s.x, owner.x); assert.equal(s.y, owner.y);});
    api.game.rallyTower = owner;
    assert.equal(api.game.setRally({x:450,y:500}), false);
  }
  const owner = depot(api, 370, 270);
  assert.ok(api.game.road.isRoad(owner.rally));
  api.game.rallyTower = owner;
  assert.equal(api.game.setRally({x:300,y:370}), false);
  api.game.wave = 2; assert.equal(api.game.applyRouteEvent(), true);
  const waiting = api.game.towers[0];
  assert.ok(waiting.rally && api.game.road.isRoad(waiting.rally));
  for(let i=0;i<180;i++) waiting.update(1/60, api.game);
  waiting.soldiers.forEach(s => assert.ok(api.game.road.isRoad(s, -3)));
});

test('rally relocation follows a U-shaped road instead of crossing the closed middle', () => {
  const api = setup(); roads(api, [[[300,300],[300,100],[500,100],[500,300]]]);
  const owner = depot(api, 400, 300);
  for(let i=0;i<180;i++) owner.update(1/60, api.game);
  api.game.rallyTower = owner;
  assert.equal(api.game.setRally({x:500,y:300}), true);
  let sawTop = false;
  for(let i=0;i<600;i++) {
    owner.update(1/60, api.game);
    for(const s of owner.soldiers) {
      assert.ok(api.game.road.isRoad(s, -3), `off-road position ${s.x},${s.y}`);
      if(s.y < 140) sawTop = true;
      if(s.x > 420) assert.ok(sawTop, 'must pass the bend before reaching the other arm');
    }
  }
  owner.soldiers.forEach(s => assert.ok(api.Collision.distance(s, owner.rally) < 15));
});

test('disconnected roads reject rallies and cross-road melee targets even when nearby', () => {
  const api = setup(); roads(api, [[[100,300],[900,300]], [[100,350],[900,350]]]);
  const owner = depot(api, 400, 230);
  for(let i=0;i<180;i++) owner.update(1/60, api.game);
  api.game.rallyTower = owner;
  assert.equal(api.game.setRally({x:400,y:350}), false);
  const enemy = new api.Enemy('armor', api.game.road.path(1));
  enemy.x = 400; enemy.y = 350; api.game.enemies = [enemy];
  owner.update(.1, api.game);
  assert.ok(owner.soldiers.every(s => s.target === null));
  assert.equal(enemy.blocker, undefined);
});

test('route changes release blockers and evacuate guards without teleporting or cutting terrain', () => {
  const api = setup(); roads(api, oldRoute, newRoute);
  const owner = depot(api, 370, 270);
  api.game.rallyTower = owner;
  assert.equal(api.game.setRally({x:300,y:250}), true);
  for(let i=0;i<180;i++) owner.update(1/60, api.game);
  const unit = owner.soldiers[0];
  const enemy = new api.Enemy('armor', api.game.road.path(0));
  enemy.segment = 1; enemy.x = unit.x; enemy.y = unit.y;
  unit.target = enemy; enemy.blocker = unit; api.game.enemies = [enemy];
  const before = {x:unit.x,y:unit.y};
  api.game.wave = 2; api.game.applyRouteEvent();
  assert.equal(enemy.blocker, null);
  assert.deepEqual({x:unit.x,y:unit.y}, before);
  assert.ok(unit.retreatPath);
  for(let i=0;i<360;i++) {
    const last = {x:unit.x,y:unit.y};
    owner.update(1/60, api.game);
    assert.ok(api.Collision.distance(unit,last) <= api.CONFIG.soldierSpeed/60 + .001);
    assert.ok(api.game.road.isRoad(unit,-3) || api.game.previousRoad.isRoad(unit,-3));
    assert.equal(unit.target, null, 'must not pursue the old-road vehicle during evacuation');
  }
  assert.equal(unit.retreatPath, null);
  assert.ok(api.game.road.isRoad(unit,-3));
});

test('a depot stranded by closure recalls guards to base and keeps replacements off the closed road', () => {
  const api = setup(); roads(api, oldRoute, newRoute);
  const owner = depot(api, 450, 80);
  for(let i=0;i<180;i++) owner.update(1/60, api.game);
  api.game.wave = 2; api.game.applyRouteEvent();
  assert.equal(owner.rally, null);
  for(let i=0;i<180;i++) owner.update(1/60, api.game);
  owner.soldiers.forEach(s => assert.ok(api.Collision.distance(s, owner) < .01));
  const unit = owner.soldiers[0];unit.hit(9999);
  owner.update(owner.stats.respawn + .1, api.game);
  assert.equal(unit.alive, true);
  owner.update(1, api.game);
  assert.equal(unit.retreatPath, null);
  assert.ok(api.Collision.distance(unit, owner) < .01);
});

test('jamming, sale and helper expiry cannot leave invisible blocking units behind', () => {
  const api = setup(); roads(api, [[[100,300],[900,300]]]);
  const owner = depot(api, 400, 230, true);
  for(let i=0;i<180;i++) owner.update(1/60, api.game);
  const enemy = new api.Enemy('armor', api.game.road.path(0));enemy.x=400;enemy.y=300;
  api.game.enemies = [enemy];owner.update(.1,api.game);
  assert.ok(enemy.blocker);
  owner.jammedTime = 2;owner.update(.1,api.game);
  assert.equal(enemy.blocker, null);
  owner.jammedTime = 0;owner.update(.1,api.game);assert.ok(enemy.blocker);
  const unit=enemy.blocker;api.game.towers=[];unit.update(.1,api.game);
  assert.equal(enemy.blocker,null);assert.equal(unit.target,null);
});

test('all dynamic campaign maps reject their exclusive future segments before the event', () => {
  const api=setup();api.game.progress.stars.fill(3);
  let examined=0;
  for(let i=0;i<api.LEVELS.length;i++) {
    if(!api.LEVELS[i].routeEvent) continue;
    api.game.startLevel(i);
    for(const [a,b] of api.game.eventRoad.edges) {
      const p={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      if(api.game.road.projections(p)[0].distance<=35)continue;
      const owner=depot(api,p.x+60,p.y);
      api.game.rallyTower=owner;
      assert.equal(api.game.setRally(p),false,`${api.game.level.id}: future route accepted`);
      examined++;
    }
  }
  assert.ok(examined>=30);
});


test('all fixed campaign depots evacuate or resume reachable service after every route change', () => {
  const api=setup();api.game.progress.stars.fill(3);
  for(let index=0;index<api.LEVELS.length;index++) {
    if(!api.LEVELS[index].routeEvent)continue;
    api.game.startLevel(index);
    const owners=api.game.sites.map(p=>depot(api,p.x,p.y));
    for(let frame=0;frame<180;frame++)owners.forEach(t=>t.update(1/60,api.game));
    const before=new Map(owners.flatMap(t=>t.soldiers.map(s=>[s,{x:s.x,y:s.y}])));
    api.game.wave=api.game.level.routeEvent.wave;api.game.applyRouteEvent();
    for(const [s,p] of before)assert.ok(api.Collision.distance(s,p)<.001,`teleport: ${api.game.level.id}`);
    for(const owner of owners)if(owner.rally){
      const access=api.AlliedNavigation.base(api.game,owner),path=api.game.road.walkPath(access,owner.rally);
      assert.ok(path&&api.AlliedNavigation.length(access,path)<=owner.stats.rallyRange+api.CONFIG.roadWidth/2,'rerouting must not preserve a rally requiring a map-wide detour');
    }
    for(let frame=0;frame<900;frame++)owners.forEach(t=>t.update(1/60,api.game));
    for(const owner of owners)for(const unit of owner.soldiers) {
      assert.equal(unit.retreatPath,null,`stuck retreat: ${api.game.level.id}`);
      if(owner.rally)assert.ok(api.Collision.distance(unit,owner.rally)<15,`unreached rally: ${api.game.level.id}`);
      else assert.ok(api.Collision.distance(unit,owner)<.01,`unreached base: ${api.game.level.id}`);
    }
  }
});

test('guards do not abandon their rally to pursue a distant hairpin arm that looks nearby', () => {
  const api=setup();roads(api, [[[100,300],[900,300],[900,400],[100,400]]]);
  const owner=depot(api,450,230);
  for(let i=0;i<180;i++)owner.update(1/60,api.game);
  const enemy=new api.Enemy('armor',api.game.road.path(0));enemy.segment=2;enemy.x=450;enemy.y=373;
  api.game.enemies=[enemy];
  assert.ok(api.Collision.distance(enemy,owner.rally)<api.CONFIG.soldierLeash);
  assert.equal(api.game.road.connected(owner.rally,enemy),true);
  for(let i=0;i<180;i++)owner.update(1/60,api.game);
  owner.soldiers.forEach(s=>{assert.equal(s.target,null);assert.ok(api.Collision.distance(s,owner.rally)<15);});
});
