// 无第三方依赖：node --test tests/game.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
// 和浏览器使用同一入口顺序，覆盖拆分文件的加载依赖。
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const scripts = [...html.matchAll(/<script defer src="([^"]+)"><\/script>/g)].map(match => match[1]);
const source = scripts.map(file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n');
function setup(saved = null, failStorage = false) {
  const noop = () => {};
  const context = new Proxy({}, { get: (o, k) => o[k] || noop, set: (o, k, v) => (o[k] = v, true) });
  const canvas = { getContext: () => context, addEventListener: noop, style: {}, focus: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 820 }) };
  let stored = saved;
  const sandbox = { console, requestAnimationFrame: noop,
    document: { getElementById: () => canvas, addEventListener: noop, hidden: false },
    window: { addEventListener: noop },
    localStorage: { getItem: () => stored, setItem: (_, value) => { if (failStorage) throw Error('denied'); stored = value; } } };
  vm.createContext(sandbox);
  const api = vm.runInContext(source + '\n({game, Game, Enemy, Tower, Projectile, Renderer, Progress, LEVELS, CHAPTERS, TOWERS, ENEMIES, CONFIG, Collision, RoadNetwork, applyHit, planConstructionSites, Soldier, Sound, SoundEngine, Traffic, CivilVehicle, ROAD_TYPES, EVOLUTIONS, evolutionRequirement, MUSIC_TRACKS, ROAD_LAYOUTS, MAP, Platform, MobileLayout})', sandbox);
  Object.assign(api, vm.runInContext('({SkillBook, SkillActions, CombatRules, SKILLS, SKILL_ORDER, CHAPTER_THREATS, Encounters, Lanes, ENEMY_PROFILES, MECHANICS})',sandbox));
  return { ...api, sandbox, stored: () => stored };
}
function battle() { const api = setup(); api.game.startLevel(0); return api; }
function press(api,match) {
  api.Renderer.draw(api.game);
  const button=api.game.buttons.find(typeof match==='function'?match:b=>b.label===match);
  assert.ok(button,`missing button: ${match}`);
  api.Platform.handleTap(api.game,{x:button.x+button.w/2,y:button.y+button.h/2});
}

test('waves wait for deployment, then 5–10 seconds; early gold scales with saved time',()=>{
  const {game,CONFIG}=battle(),initial=game.gold;
  assert.equal(game.startWave(),true);assert.equal(game.gold,initial+CONFIG.earlyGoldMax);
  const gold=game.gold,gap=game.prepareTime;
  for(let i=0;i<30;i++)assert.equal(game.startWave(),false);
  game.update(.1);assert.equal(game.wave,1);assert.equal(game.prepareTime,gap);
  game.prepareTime=0;assert.equal(game.startWave(true),false,'even automatic waves must finish deployment');
  game.spawnQueue=[];game.prepareTime=7;game.paused=true;game.update(10);assert.equal(game.prepareTime,7);
  game.paused=false;assert.equal(game.earlyWaveReward,21);game.update(2);assert.equal(game.earlyWaveReward,15);
  assert.equal(game.startWave(),true);assert.equal(game.gold,gold+15);assert.equal(game.lastEarlyReward,15);
  assert.equal(game.startWave(),false);
  game.spawnQueue=[];game.prepareTime=.01;game.update(.02);
  assert.equal(game.wave,3);assert.equal(game.lastEarlyReward,0);assert.equal(game.gold,gold+15);
  assert.equal(game.gapAfterWave(9),5);assert.equal(game.gapAfterWave(20),7.5);assert.equal(game.gapAfterWave(80),10);
});

test('all current and alternate roads avoid geometric crossings and opposing overlap',()=>{
  const {LEVELS}=setup();
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(const level of LEVELS)for(const routes of [level.routes,level.routeEvent?.routes||[]]){
    const edges=routes.flatMap(r=>r.slice(1).map((p,i)=>[r[i],p]));
    for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
      const [a,b]=edges[i],[c,d]=edges[j],label=`${level.id}, segments ${i}/${j}`;
      assert.ok(!(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0),label);
      if(cross(a,b,c)===0&&cross(a,b,d)===0){
        const axis=Math.abs(b[0]-a[0])>Math.abs(b[1]-a[1])?0:1;
        const overlap=Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis]))-Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis]));
        assert.ok(overlap<=0||(b[axis]-a[axis])*(d[axis]-c[axis])>0,label+' opposing lanes');
      }
    }
  }
});

test('new campaign locks later levels and requires a site before building', () => {
  const { game } = setup();
  assert.equal(game.startLevel(1), false);
  game.startLevel(0); game.selectBuild('missile');
  assert.equal(game.towers.length, 0); assert.equal(game.selectedSite, null);
});
test('road, map boundary and overlapping towers reject construction', () => {
  const { game } = battle();
  assert.equal(game.canBuild(game.road.path(0)[1]), false);
  assert.equal(game.canBuild({ x: 20, y: 200 }), false);
  game.click(game.sites[0]); game.selectBuild('rail');
  assert.equal(game.towers.length, 1); assert.equal(game.gold, 270);
  assert.equal(game.canBuild(game.sites[0]), false);
  game.gold = 0; game.click(game.sites[1]);game.selectBuild('rail');
  assert.equal(game.towers.length, 1);
});
test('all 48 biome specialization paths charge correctly and are mutually exclusive', () => {
  const { game, Tower, TOWERS, CHAPTERS } = battle(); game.progress.stars.fill(3);
  for (const chapter of CHAPTERS) for (const type of Object.keys(TOWERS)) for (const branch of [0, 1]) {
    const tower = new Tower(type, 180, 300,chapter.theme);
    game.towers = [tower]; game.selected = tower; game.gold = 1000;
    assert.equal(game.upgrade(branch), false);
    const basicCost = tower.upgradeCost;
    assert.equal(game.upgrade(), true);
    assert.equal(game.upgrade(), false);
    assert.equal(game.upgrade(branch), true);
    assert.equal(tower.branch, branch);
    assert.equal(game.gold, 1000 - basicCost - tower.paths[branch].cost);
    assert.equal(game.upgrade(1 - branch), false);
    assert.equal(game.upgrade(), true);
    assert.equal(tower.level, 4); assert.equal(game.upgrade(), false);
  }
});
test('unaffordable upgrades leave level and economy unchanged; sell refunds investment', () => {
  const { game } = battle(); game.click(game.sites[0]); game.selectBuild('rail'); game.selected = game.towers[0];
  game.gold = 0; assert.equal(game.upgrade(), false); assert.equal(game.selected.level, 1);
  game.sell(); assert.equal(game.gold, 56); assert.equal(game.towers.length, 0);
});
test('armor, shield overflow and enhanced shield damage resolve correctly', () => {
  const { game, Enemy } = battle(), route = game.road.path(0);
  const armor = new Enemy('armor', route); armor.hit(100, game); assert.ok(Math.abs(armor.health-(armor.maxHealth-55))<1e-8);
  armor.hit(50, game, { pierce: true }); assert.ok(Math.abs(armor.health-(armor.maxHealth-105))<1e-8);
  const shield = new Enemy('shield', route); shield.hit(40, game, { shieldMultiplier: 2.5 });
  assert.equal(shield.shield, 0); assert.ok(Math.abs(shield.health-(shield.maxHealth-14))<1e-8);
  shield.sinceHit = 3; shield.update(0.1, game); assert.ok(shield.shield > 0);
});
test('support heals allies but cannot heal itself or dead vehicles', () => {
  const { game, Enemy } = battle(), route = game.road.path(0);
  const healer = new Enemy('healer', route), ally = new Enemy('armor', route), dead = new Enemy('scout', route);
  healer.health = 50; ally.health = 40; dead.health = 0; dead.dead = true; healer.healTimer = 0;
  game.enemies = [healer, ally, dead]; healer.update(0.01, game);
  assert.equal(healer.health, 50); assert.equal(ally.health, 53); assert.equal(dead.health, 0);
});
test('splitter death spawns children on same route and awards only once', () => {
  const { game, Enemy } = battle(); const enemy = new Enemy('splitter', game.road.path(1));
  enemy.x = 210; enemy.y = 402; enemy.segment = 1; game.enemies = [enemy];
  enemy.hit(9999, game); const gold = game.gold; enemy.hit(9999, game);
  const children = game.enemies.filter(e => e.type === 'swarm');
  assert.equal(children.length, 3); assert.ok(children[0].segment<=enemy.segment);
  assert.equal(children[0].path, enemy.path); assert.notEqual(children[0].x,enemy.x);assert.ok(new Set(children.map(e=>`${e.x},${e.y}`)).size===3); assert.equal(game.gold, gold);
});
test('control respects boss resistance and burn deals ongoing damage', () => {
  const { game, Enemy, applyHit } = battle(); const boss = new Enemy('boss', game.road.path(0));
  boss.slow(0.5, 2); assert.equal(boss.slowFactor, 0.8);
  boss.stun(3); assert.ok(Math.abs(boss.stunTime - 1.2) < 1e-8);
  applyHit(boss, 0, { burn: 16, duration: 3 }, game);
  boss.update(0.1, game); assert.ok(Math.abs(boss.health - (boss.maxHealth-1.6)) < 1e-8);
});
test('missile splash, multi-shot, chaining and directional focus have distinct effects', () => {
  const { game, Enemy, Tower, Projectile } = battle(); const route = game.road.path(0);
  const a = new Enemy('armor', route), b = new Enemy('armor', route); game.enemies = [a, b];
  const missile = new Tower('missile', a.x, a.y); new Projectile(missile, a, missile.stats).update(0.1, game);
  assert.ok(a.health < a.maxHealth && b.health < b.maxHealth);
  const rail = new Tower('rail', a.x, a.y); rail.level = 3; rail.branch = 1; rail.update(0.1, game);
  assert.equal(game.projectiles.length, 2);
  const tesla = new Tower('signal', a.x, a.y); tesla.level=3; tesla.branch=1; a.health=b.health=1000; tesla.update(0.1, game); assert.equal(game.beams.length, 2);
  const laser = new Tower('signal', a.x, a.y,'hills'); laser.level = 3; laser.branch = 1;
  const target = new Enemy('boss', route); game.enemies = [target];
  laser.update(0.1, game); const firstDamage = target.maxHealth - target.health;
  laser.cooldown = 0; laser.update(0.1, game);
  assert.ok(target.maxHealth - target.health > firstDamage * 2);
});
test('target priority can focus healer instead of nearer exit', () => {
  const { game, Enemy, Tower } = battle();
  const healer = new Enemy('healer', game.road.path(0)), scout = new Enemy('scout', game.road.path(0));
  scout.x += 40; game.enemies = [scout, healer];
  const tower = new Tower('rail', 100, 340); tower.targetMode = 2; tower.update(0.1, game);
  assert.equal(game.projectiles[0].target, healer);
});
test('skills require enemies, pause prevents casting and cooldown prevents reuse', () => {
  const { game, Enemy } = battle(); game.selectSkill('strike'); game.cast({ x: 300, y: 300 });
  assert.equal(game.skillCooldowns.strike, 0);
  const enemy = new Enemy('armor', game.road.path(0)); game.enemies = [enemy];
  game.paused = true; game.cast(enemy); assert.equal(enemy.health, enemy.maxHealth);
  game.paused = false; game.cast(enemy); assert.equal(enemy.health,enemy.maxHealth-145);
  assert.equal(game.skillCooldowns.strike, 30); game.selectSkill('strike'); assert.equal(game.skill, null);
});
test('paused or modal state freezes timers and simulation', () => {
  const { game } = battle(); game.startWave(); game.update(0.01);
  const x = game.enemies[0].x; game.skillCooldowns.strike = 10;
  game.paused = true; game.update(1); assert.equal(game.enemies[0].x, x); assert.equal(game.skillCooldowns.strike, 10);
  game.paused = false; game.modal = 'intel'; game.update(1); assert.equal(game.enemies[0].x, x);
});
test('victory persists best stars and unlocks exactly next stage; retry resets run', () => {
  const { game, Progress, stored } = battle(); game.finish(true);
  assert.equal(game.earnedStars, 3); assert.equal(game.unlocked, 1);
  assert.equal(JSON.parse(stored()).slots[0].stars[0], 3); assert.equal(Progress.load().stars[0], 3);
  game.startLevel(0); game.lives = 1; game.finish(true); assert.equal(game.progress.stars[0], 3);
  game.startLevel(1); assert.equal(game.gold, 378); assert.equal(game.towers.length, 0); assert.equal(game.lives, 20);
});
test('defeat never unlocks or saves and replay preserves earlier progress', () => {
  const { game, Enemy } = battle(); game.startWave(); game.spawnQueue = []; game.lives = 1;
  const enemy = new Enemy('boss', game.road.path(0)); enemy.segment = enemy.path.length - 2;
  const exit=enemy.path.at(-1);enemy.x=exit.x-.01;enemy.y=exit.y;
  game.enemies = [enemy]; game.update(0.1); assert.equal(game.screen, 'result'); assert.equal(game.won, false); assert.equal(game.unlocked, 0);
});
test('invalid storage and denied storage fail gracefully', () => {
  const corrupt = setup('not json'); assert.equal(corrupt.game.unlocked, 0);
  const denied = setup(null, true); denied.game.startLevel(0); denied.game.finish(true);
  assert.equal(denied.game.saveFailed, true); assert.equal(denied.game.unlocked, 1);
});
test('all screens and specialization panels render without exception', () => {
  const { game, Renderer, Tower, TOWERS } = setup(); Renderer.draw(game); game.startLevel(0); Renderer.draw(game);
  for (const type of Object.keys(TOWERS)) for (const level of [1, 2, 3, 4]) {
    const tower = new Tower(type, 180, 300); tower.level = level; tower.branch = level >= 3 ? 0 : null;
    game.selected = tower; Renderer.draw(game);
  }
  for (const modal of ['intel', 'restart', 'leave', 'loadout', 'saveSlots', 'battleMenu']) { game.modal = modal; Renderer.draw(game); }
  game.modal = null; game.finish(true); Renderer.draw(game);
});

test('opening stage and all chapter finales are winnable with legal spending and timed waves', () => {
  require('./campaign-simulation.cjs')(setup(),process.env.TD_TEST_STAGES?.split(',').map(Number)||[0,7,15,23,31,39,47]);
});

test('building is a two-step site-first operation and selling frees the same site', () => {
  const { game } = battle();
  assert.equal(game.selectBuild('rail'), false);
  game.click({ x: 26, y: 100 }); assert.equal(game.selectedSite, null); assert.equal(game.towers.length, 0);
  const site = game.sites[0]; game.click(site);
  assert.equal(game.selectedSite, site); assert.equal(game.gold, 350);
  assert.equal(game.selectBuild('rail'), true); assert.equal(game.gold, 270);
  assert.equal(game.canBuild(site), false); assert.equal(game.selectedSite, null);
  game.sell(); assert.equal(game.canBuild(site), true);
  game.click(site); assert.equal(game.selectBuild('signal'), true);
  assert.equal(game.towers[0].siteId, site.id);
});
test('dense construction sites stay close to roads, clear of lanes and other sites, and stable on retry', () => {
  const { LEVELS, RoadNetwork, Collision, CONFIG, MAP, planConstructionSites } = setup();
  for (const level of LEVELS) {
    const road = new RoadNetwork(level, true);
    const sites = level.sites.map(([x,y]) => ({x,y}));
    assert.ok(sites.length >= 24, `${level.name} has only ${sites.length} sites on four-lane roads`);
    assert.deepEqual(planConstructionSites(level),level.sites);
    for (const [i,site] of sites.entries()) {
      assert.equal(road.isRoad(site, CONFIG.towerRadius + 4), false, `${level.name} site ${i+1} overlaps road`);
      assert.ok(Collision.inside(site,{x:MAP.x+CONFIG.towerRadius,y:MAP.y+CONFIG.towerRadius,w:MAP.w-2*CONFIG.towerRadius,h:MAP.h-2*CONFIG.towerRadius}));
      assert.ok(Math.min(...road.edges.map(([a,b])=>Collision.segmentDistance(site,a,b))) <= CONFIG.siteRoadOffset+1);
      for (const other of sites.slice(i+1)) assert.ok(Collision.distance(site,other) >= CONFIG.spacing);
    }
  }
});
test('four core towers are always available and legacy stars survive migration', () => {
  const {game,Progress}=setup(JSON.stringify({schema:2,stars:[3,2,0],decks:[['laser']],legacyTowers:['tesla']}));
  assert.equal(game.unlocked,2); assert.equal(game.progress.schema,5);
  assert.deepEqual(Array.from(game.getDeck()),['rail','signal','missile','depot']);
  assert.equal(game.towerUnlocked('laser'),false);
  assert.equal(game.progress.stars[1],2);assert.equal(game.progress.stars.length,48);
  Progress.save(game.progress);assert.equal(Progress.load().stars[1],2);
  for(const type of game.getDeck()){
    game.startLevel(0);game.click(game.sites[0]);assert.equal(game.selectBuild(type),true);
  }
});

test('boss spawns only in marked stages and only in the final wave', () => {
  const { game, LEVELS } = setup(JSON.stringify({stars:Array(48).fill(3)}));
  LEVELS.forEach((level,index) => {
    game.startLevel(index);
    for(let wave=1;wave<=level.waves;wave++) assert.equal(game.wavePlan(wave).includes(level.bossType),level.boss && wave===level.waves);
  });
});
test('build popup registers only carried tower choices and prevents double purchase', () => {
  const api=battle(),{ game, Renderer, Platform } = api; game.click(game.sites[0]); Renderer.draw(game);
  const popup = game.buildPopupRect; assert.ok(popup);
  assert.deepEqual(Array.from(game.buttons.filter(b=>b.towerType),b=>b.towerType),Array.from(game.loadout));
  const card=game.buttons.find(b=>b.towerType==='rail'),point={x:card.x+card.w/2,y:card.y+card.h/2};
  Platform.handleTap(game,point);
  assert.equal(game.towers.length,1); assert.equal(game.gold,270);
  Platform.handleTap(game,point); assert.equal(game.towers.length,1);
});

test('map tower popup handles upgrade, specialization, targeting and selling without sidebar actions', () => {
  const api=battle(),{ game, Renderer, MobileLayout, Platform } = api; game.progress.stars.fill(3);
  const site=game.sites[0]; game.click(site); game.selectBuild('rail');
  game.cancel(); Renderer.draw(game); game.click(site); Renderer.draw(game);
  const tower=game.selected, popup=game.towerPopupRect;
  assert.equal(tower,game.towers[0]); assert.ok(popup);
  press(api,b=>b.label?.startsWith('强化')); Renderer.draw(game);
  assert.equal(tower.level,2); assert.equal(game.gold,210);
  const branches=game.towerPopupRect;
  // 点击菜单文字不会穿透到下面的设备地块。
  Platform.handleTap(game,MobileLayout.toScreen(game,{x:branches.x+15,y:branches.y+78})); assert.equal(game.selected,tower);
  press(api,b=>b.branch===1); Renderer.draw(game);
  assert.equal(tower.branch,1); assert.equal(tower.level,3); assert.equal(game.gold,70);
  press(api,b=>b.label?.startsWith('强化')); assert.equal(tower.level,3); // 金币不足
  press(api,'优先终点'); assert.equal(tower.targetMode,1);
  press(api,b=>b.label?.startsWith('出售'));
  assert.equal(game.towers.length,0); assert.equal(game.gold,70+Math.floor(280*.7));
  Renderer.draw(game); assert.equal(game.towerPopupRect,null); assert.equal(game.canBuild(site),true);
});

test('tower menus stay inside the browser play area at every site and tower level', () => {
  const { game, LEVELS, Tower, MobileLayout }=setup(JSON.stringify({stars:Array(48).fill(3)}));
  const layout=MobileLayout.measure();
  for(let index=0;index<LEVELS.length;index++) {
    game.startLevel(index);MobileLayout.camera(game,layout);
    for(const site of game.sites) for(const level of [1,2,3,4]) {
      game.selected=new Tower('rail',site.x,site.y); game.selected.level=level; game.selected.branch=level>2?0:null;
      game.buttons=[];MobileLayout.popup(game,layout,'tower');
      const r=game.towerPopupRect;
      const a=MobileLayout.toScreen(game,r),b=MobileLayout.toScreen(game,{x:r.x+r.w,y:r.y+r.h});
      assert.ok(a.x>=layout.left-.001&&a.y>=layout.top+98-.001&&b.x<=layout.right+.001&&b.y<=layout.footer-10+.001,`${index} site ${site.id}`);
    }
  }
});

test('chapter previews remain locked and crossing a chapter opens the correct next map', () => {
  const api=setup(JSON.stringify({stars:[3,2,1,3,3,3,3,0],decks:[['rail','slow']]})),{ game, Renderer, LEVELS, CHAPTERS }=api;
  assert.equal(CHAPTERS.length,6); assert.equal(LEVELS.length,48);
  assert.equal(game.progress.stars.length,48);
  assert.deepEqual(Array.from(game.progress.stars.slice(0,4)),[3,2,1,3]);
  game.screen='menu';game.selectChapter(2); assert.equal(game.menuChapter,2); assert.equal(game.menuLevel,16);
  assert.equal(game.startLevel(16),false);
  Renderer.draw(game); game.openLevel(16); Renderer.draw(game); game.modal=null;
  game.startLevel(7); game.finish(true); Renderer.draw(game);
  press(api,'章节地图');
  assert.equal(game.screen,'menu'); assert.equal(game.menuChapter,1); assert.equal(game.menuLevel,8);
  assert.equal(game.unlocked,8); assert.equal(game.startLevel(8),true); assert.equal(game.startLevel(9),false);
});

test('automatic countdown starts after the last spawn and overlaps living enemies without free gold',()=>{
  const {game,Enemy,CONFIG,ENEMIES}=battle();game.startWave();
  const sentinel=new Enemy('boss',game.road.path(0));sentinel.x+=160;sentinel.stunTime=999;sentinel.health=1e9;
  game.enemies.push(sentinel);game.spawnQueue=[game.spawnQueue[0]];game.spawnTimer=0;
  const gap=game.waveGap,gold=game.gold;game.update(.01);
  assert.equal(game.spawnQueue.length,0);assert.equal(game.prepareTime,gap);assert.equal(game.wave,1);
  const unit=game.enemies[1];assert.equal(unit.maxHealth,ENEMIES[unit.type].hp*game.level.scale*CONFIG.enemyHealthMultiplier);
  game.update(gap-.01);assert.equal(game.wave,1);game.update(.02);assert.equal(game.wave,2);
  assert.equal(game.gold,gold);assert.ok(game.enemies.includes(sentinel));
  const seconds=game.prepareTime;game.paused=true;game.update(10);assert.equal(game.prepareTime,seconds);
  game.paused=false;game.modal='intel';game.update(10);assert.equal(game.prepareTime,seconds);game.modal=null;
  while(game.wave<game.level.waves){game.spawnQueue=[];game.startWave(true);}
  assert.equal(game.startWave(),false);assert.equal(game.gold,gold);
  game.spawnQueue=[];game.update(.01);assert.equal(game.screen,'battle');
  game.enemies.forEach(e=>e.dead=true);game.update(.01);assert.equal(game.won,true);
});

test('clearing a wave early does not reset the countdown or start the next wave early', () => {
  const {game}=battle();game.startWave();game.spawnQueue=[];game.enemies=[];game.prepareTime=5;
  game.update(1);assert.equal(game.wave,1);assert.equal(game.prepareTime,4);assert.equal(game.screen,'battle');
});

test('progress gates biome evolution without charging for locked paths or repeated clears',()=>{
  const {game,Tower,CHAPTERS,TOWERS,evolutionRequirement}=battle();
  for(const chapter of CHAPTERS)for(const type of Object.keys(TOWERS))for(const branch of [0,1]){
    const threshold=evolutionRequirement(type,chapter.theme,branch),t=new Tower(type,180,340,chapter.theme);
    game.towers=[t];game.selected=t;t.level=2;game.gold=1000;
    game.progress.stars.fill(0);game.progress.stars.fill(3,0,threshold-1);
    assert.equal(game.upgrade(branch),false);assert.equal(game.gold,1000);assert.equal(t.level,2);
    game.progress.stars[threshold-1]=1;assert.equal(game.upgrade(branch),true);
  }
  game.progress.stars.fill(0);game.startLevel(0);game.finish(true);
  assert.ok(game.earnedEvolutions.includes('测速塔'));const count=game.completed;
  game.startLevel(0);game.finish(true);assert.equal(game.completed,count);assert.equal(game.earnedEvolutions.length,0);
});

test('six biomes have eight distinct stages each, valid enemy pools, and chapter-specific bosses', () => {
  const {CHAPTERS,LEVELS,ENEMIES}=setup();
  assert.equal(new Set(CHAPTERS.map(c=>JSON.stringify(c.nodes))).size,6);
  assert.equal(new Set(LEVELS.map(l=>JSON.stringify(l.routes))).size,48);
  for(const [chapter,c] of CHAPTERS.entries()) {
    const levels=LEVELS.filter(l=>l.chapter===chapter);assert.equal(levels.length,8);
    assert.equal(levels.filter(l=>l.boss).length,2);assert.ok(ENEMIES[c.boss].boss);
    assert.ok(c.pool.every(type=>ENEMIES[type]));
    for(const level of levels) {
      assert.ok(level.waves>=6);
      for(const route of level.routes)for(let i=1;i<route.length;i++)assert.notDeepEqual(route[i],route[i-1]);
    }
  }
});

test('desert burn resistance, mountain control resistance and biome offspring have gameplay effects', () => {
  const {game,Enemy,applyHit}=battle(),path=game.road.path(0);
  const dune=new Enemy('dune',path);applyHit(dune,0,{burn:20,duration:3},game);dune.update(.5,game);
  assert.ok(Math.abs(dune.health-(dune.maxHealth-3))<1e-8);
  const crawler=new Enemy('crawler',path);crawler.slow(.2,2);crawler.stun(1);
  assert.ok(Math.abs(crawler.slowFactor-.72)<1e-8);assert.ok(Math.abs(crawler.stunTime-.35)<1e-8);
  for(const [type,child,count] of [['brood','spore',4],['carrier','dinghy',4],['ancient','spore',6]]) {
    const enemy=new Enemy(type,path);game.enemies=[enemy];enemy.hit(999999,game,{pierce:true});
    assert.equal(game.enemies.filter(e=>e.type===child).length,count);
  }
});

test('all 48 battle maps, six bestiaries and all tower pages fit the canvas and render', () => {
  const {game,LEVELS,CHAPTERS,Renderer}=setup(JSON.stringify({schema:2,stars:Array(48).fill(3)}));
  for(let index=0;index<LEVELS.length;index++){assert.equal(game.startLevel(index),true);Renderer.draw(game);}
  game.screen='menu';
  for(let chapter=0;chapter<CHAPTERS.length;chapter++) {
    game.selectChapter(chapter);game.modal=null;Renderer.draw(game);
    for(const modal of ['loadout','intel']){game.modal=modal;game.libraryChapter=chapter;game.intelChapter=chapter;Renderer.draw(game);}
  }
  game.modal='loadout';
  for(let page=0;page<3;page++) {
    game.towerPage=page;Renderer.draw(game);
    for(const b of game.buttons)assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=1280&&b.y+b.h<=820);
  }
});


function garrison(api) {
  const {game}=api;game.click(game.sites[0]);game.selectBuild('depot');
  const tower=game.selected;for(let i=0;i<120;i++)tower.update(1/60,game);
  return tower;
}
test('soldiers physically reach separate vehicles, block movement and exchange damage',()=>{
  const api=battle(),{game,Enemy}=api,tower=garrison(api);
  const enemies=Array.from({length:4},()=>{const e=new Enemy('armor',game.road.path(0));e.x=tower.rally.x;e.y=tower.rally.y;e.health=1000;return e;});
  game.enemies=enemies;tower.update(.01,game);
  assert.equal(new Set(tower.soldiers.map(s=>s.target)).size,3);
  assert.equal(enemies.filter(e=>e.blocker).length,3);assert.equal(enemies[3].blocker,undefined);
  const e=enemies[0],guard=e.blocker,x=e.x,hp=guard.health;
  assert.ok(e.health<1000);e.update(.1,game);assert.equal(e.x,x);assert.ok(guard.health<hp);
  guard.hit(10000);assert.equal(e.blocker,null);e.update(.1,game);assert.ok(e.x>x);
});
test('soldiers cannot block remotely and bosses overpower unupgraded guards',()=>{
  const api=battle(),{game,Enemy}=api,tower=garrison(api),s=tower.soldiers[0];
  const boss=new Enemy('boss',game.road.path(0));boss.x=tower.rally.x+65;boss.y=tower.rally.y;game.enemies=[boss];
  tower.update(.01,game);assert.equal(boss.blocker,undefined);
  s.x=boss.x;s.y=boss.y;s.target=boss;boss.blocker=s;const hp=s.health;boss.update(.1,game);
  assert.ok(hp-s.health>30);boss.meleeCooldown=0;boss.stunTime=1;const after=s.health;boss.update(.1,game);assert.equal(s.health,after);
});
test('death, selling, enemy death and rally relocation release blockers; respawn costs no gold',()=>{
  const api=battle(),{game,Enemy}=api,t=garrison(api),s=t.soldiers[0];
  const enemy=new Enemy('armor',game.road.path(0));enemy.x=t.rally.x;enemy.y=t.rally.y;game.enemies=[enemy];
  s.target=enemy;enemy.blocker=s;s.hit(9999);const gold=game.gold;
  assert.equal(enemy.blocker,null);s.update(t.stats.respawn-.1,game);assert.equal(s.alive,false);
  s.update(.2,game);assert.equal(s.alive,true);assert.equal(s.x,t.x);assert.equal(game.gold,gold);
  s.target=enemy;enemy.blocker=s;enemy.hit(9999,game);assert.equal(s.target,null);assert.equal(enemy.blocker,null);
  const next=new Enemy('boss',game.road.path(0));game.enemies=[next];s.target=next;next.blocker=s;
  game.selected=t;game.sell();assert.equal(next.blocker,null);assert.equal(game.towers.length,0);
});
test('rally movement obeys road and range limits and can be selected from the map popup',()=>{
  const api=battle(),{game,Renderer,Enemy}=api,t=garrison(api);
  game.selected=t;press(api,'设置集合点');assert.equal(game.rallyTower,t);
  Renderer.draw(game);assert.equal(game.towerPopupRect,null);
  const previous=t.rally;assert.equal(game.setRally({x:880,y:390}),false);assert.equal(t.rally,previous);
  assert.equal(game.setRally({x:t.x,y:t.y}),false);
  const enemy=new Enemy('scout',game.road.path(0));t.soldiers[0].target=enemy;enemy.blocker=t.soldiers[0];
  assert.equal(game.setRally({x:previous.x+30,y:previous.y}),true);assert.equal(enemy.blocker,null);
  assert.equal(game.rallyTower,null);assert.equal(game.selected,t);
  game.rallyTower=t;game.cancel();assert.equal(game.rallyTower,null);
});
test('paused simulation freezes guard respawn; evolution adds units and health without reviving dead guards',()=>{
  const api=battle(),{game}=api,t=garrison(api),s=t.soldiers[0];
  s.hit(9999);const time=s.respawnRemaining;game.paused=true;game.update(1);assert.equal(s.respawnRemaining,time);
  game.progress.stars.fill(3);game.gold=2000;game.selected=t;game.upgrade();game.upgrade(1);
  t.update(0,game);assert.equal(s.alive,false);assert.equal(t.soldiers.length,4);assert.ok(t.soldiers[1].maxHealth>105);
  game.paused=false;game.update(.1);assert.ok(s.respawnRemaining<time);
});
test('sound requires interaction, respects separate switches, rate limits voices and stops in background',()=>{
  const {SoundEngine,sandbox,game}=battle();const voices=[];let created=0;
  const parameter=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
  sandbox.window.AudioContext=class {
    constructor(){created++;this.state='running';this.currentTime=10;this.destination={};}
    createGain(){return {gain:parameter(),connect(){},disconnect(){}};}
    createOscillator(){const v={frequency:parameter(),connect(){},disconnect(){},start(){},stop(){}};voices.push(v);return v;}
  };
  const sound=new SoundEngine();sound.play('build');assert.equal(created,0);sound.unlock();assert.equal(created,1);
  sound.play('rail');const before=voices.length;sound.play('rail');assert.equal(voices.length,before);
  sound.toggle('effects');sound.context.currentTime++;sound.play('build');assert.equal(voices.length,before);
  sound.update(game);assert.ok(voices.length>before); // 关闭音效不关闭配乐
  sound.toggle('music');const muted=voices.length;sound.context.currentTime++;sound.update(game);assert.equal(voices.length,muted);
  sound.toggle('effects');for(let i=0;i<100;i++)sound.tone(220);assert.equal(sound.voices.size,24);
  const first=[...sound.voices][0];first.onended();assert.equal(sound.voices.size,23);
  sandbox.document.hidden=true;sound.update(game);assert.equal(sound.voices.size,0);
  const n=voices.length;sound.play('signal');assert.equal(voices.length,n);
});
test('missing audio support and denied settings storage do not interrupt gameplay',()=>{
  const {SoundEngine,game}=setup(null,true),sound=new SoundEngine();
  assert.doesNotThrow(()=>{sound.unlock();sound.toggle('music');sound.play('build');sound.update(game);});
  assert.equal(sound.unavailable,true);assert.equal(game.startLevel(0),true);
});
test('all biome tower levels and both visual branches render with soldiers and research cards',()=>{
  const {game,Renderer,Tower,CHAPTERS,TOWERS}=battle();game.progress.stars.fill(3);
  for(const chapter of CHAPTERS)for(const type of Object.keys(TOWERS))for(const branch of [0,1])for(const level of [1,2,3,4]){
    const t=new Tower(type,180,340,chapter.theme);t.level=level;t.branch=level>=3?branch:null;
    game.towers=[t];game.selected=t;t.update(0,game);Renderer.field(game);Renderer.towerPopup(game);
    game.menuChapter=CHAPTERS.indexOf(chapter);game.menuLevel=game.menuChapter*8;game.previewBranch=branch;Renderer.loadoutModal(game);
  }
});


test('tall evolved towers can be selected through their spire without expanding construction occupancy',()=>{
  const {game}=battle();game.click(game.sites[0]);game.selectBuild('signal');const t=game.selected;
  t.level=4;t.branch=0;game.cancel();const top={x:t.x,y:t.y-60};
  assert.equal(game.towerAt(top),undefined);game.click(top);assert.equal(game.selected,t);
});


test('signal station pulses all nearby vehicles, pierces armor and never affects out-of-range traffic', () => {
  const {game, Enemy, Tower} = battle();
  const station = new Tower('signal', 400, 390);
  const cars = [0, 90, station.stats.range + 1].map(offset => {
    const enemy = new Enemy('armor', game.road.path(0));
    enemy.x = station.x + offset; enemy.y = station.y;
    return enemy;
  });
  game.enemies = cars; station.update(.01, game);
  assert.equal(cars[0].health, cars[0].maxHealth - 18);
  assert.equal(cars[1].health, cars[1].maxHealth - 18);
  assert.equal(cars[2].health, cars[2].maxHealth);
  assert.ok(cars[1].slowTime > 0); assert.equal(cars[2].slowTime, 0);
  assert.equal(game.projectiles.length, 0);
  const health = cars[0].health; station.update(.1, game);
  assert.equal(cars[0].health, health);
  station.level = 3; station.branch = 0; station.cooldown = 0;
  station.update(.01, game);
  assert.ok(cars[2].health < cars[2].maxHealth, 'evolution extends the field instead of shrinking it');
  assert.ok(cars[2].stunTime > 0);
});

test('rail tracking gains damage on the same vehicle and resets after changing target', () => {
  const {game, Enemy, Tower} = battle();
  const tower = new Tower('rail', 100, 390);
  const first = new Enemy('boss', game.road.path(0));
  game.enemies = [first]; tower.update(.01, game);
  const initial = game.projectiles.at(-1).stats.damage;
  tower.cooldown = 0; tower.update(.01, game);
  assert.ok(game.projectiles.at(-1).stats.damage > initial);
  first.dead = true; game.enemies.push(new Enemy('boss', game.road.path(0)));
  tower.cooldown = 0; tower.update(.01, game);
  assert.equal(game.projectiles.at(-1).stats.damage, initial);
});

test('a tall facility cannot intercept clicks on the center of an empty construction pad', () => {
  const {game, Tower, LEVELS} = battle();
  game.progress.stars.fill(3);
  let rear;
  for (let index = 0; index < LEVELS.length && !rear; index++) {
    game.startLevel(index);
    rear = game.sites.find(a => game.sites.some(b => b !== a && Math.abs(a.x-b.x) <= 24 && b.y-a.y > 26 && b.y-a.y < 75));
  }
  assert.ok(rear);
  const front = game.sites.find(b => b !== rear && Math.abs(rear.x-b.x) <= 24 && b.y-rear.y > 26 && b.y-rear.y < 75);
  const tower = new Tower('signal', front.x, front.y); tower.level = 4; tower.branch = 0;
  game.towers = [tower]; game.click(rear);
  assert.equal(game.selectedSite, rear); assert.equal(game.selected, null);
  assert.equal(game.selectBuild('rail'), true);
});


test('chapter route events reroute approaching traffic without teleporting cars already past the junction', () => {
  const {game, LEVELS, Enemy, Renderer, CONFIG} = setup(); game.progress.stars.fill(3);
  const changing = LEVELS.filter(level => level.routeEvent); assert.equal(changing.length, 12);
  for (const level of changing) {
    game.startLevel(LEVELS.indexOf(level));
    const road = game.road, oldPath = road.path(0), pads = JSON.stringify(game.sites);
    const approaching = new Enemy('shield', oldPath); approaching.update(.5, game);
    approaching.slow(.5, 2); const position = [approaching.x, approaching.y], health = approaching.health;
    const passed = new Enemy('armor', oldPath); passed.segment = 1;
    passed.x = oldPath[1].x; passed.y = oldPath[1].y;
    game.enemies = [approaching, passed]; game.wave = level.routeEvent.wave - 1;
    assert.equal(game.startWave(), true); assert.equal(game.routeChanged, true);
    assert.equal(game.previousRoad, road); assert.equal(approaching.path, game.road.path(0));
    assert.equal(passed.path, oldPath); assert.deepEqual([approaching.x, approaching.y], position);
    assert.equal(approaching.health, health); assert.equal(approaching.slowTime, 2);
    assert.equal(JSON.stringify(game.sites), pads);
    assert.equal(game.applyRouteEvent(), false);
    assert.notDeepEqual(game.road.routes, road.routes);
    for (const site of game.sites) assert.equal(game.road.isRoad(site, CONFIG.towerRadius+4), false);
    Renderer.draw(game);
    game.paused=true;const timer=game.routeFlash;game.update(1);assert.equal(game.routeFlash,timer);
    game.startLevel(LEVELS.indexOf(level));assert.equal(game.routeChanged,false);assert.equal(game.previousRoad,null);
  }
});

test('route-change spawning uses the new road and split children continue their parent road', () => {
  const {game,Enemy}=battle();game.progress.stars.fill(3);game.startLevel(3);
  const path=game.road.path(0), parent=new Enemy('splitter',path);parent.segment=2;parent.x=path[2].x;parent.y=path[2].y;
  game.enemies=[parent];game.wave=game.level.routeEvent.wave-1;game.startWave();
  parent.hit(9999,game);const children=game.enemies.filter(e=>e.type==='swarm');
  assert.equal(children.length,3);children.forEach(child=>assert.equal(child.path,path));
  game.update(.01);const newcomer=game.enemies.find(e=>e.path===game.road.path(0));assert.ok(newcomer);
});

test('all route alternatives reserve legal construction space and each chapter varies topology', () => {
  const {LEVELS,RoadNetwork,CONFIG,Collision,MAP}=setup();
  for(let chapter=0;chapter<6;chapter++) {
    const levels=LEVELS.filter(l=>l.chapter===chapter);
    const signatures=levels.map(l=>[l.routes.length,...l.routes.map(r=>r.length)].join(','));
    assert.ok(new Set(signatures).size>=5, `chapter ${chapter} needs different structures`);
    for(const level of levels) {
      const network=new RoadNetwork(level,true);
      for(const route of network.routes)for(let i=1;i<route.length;i++){
        assert.ok(Collision.inside(route[i],MAP));
        assert.notDeepEqual(route[i],route[i-1]);
      }
      for(const [x,y] of level.sites)assert.equal(network.isRoad({x,y},CONFIG.towerRadius+4),false);
      if(level.routeEvent){
        assert.deepEqual(level.routes[0].slice(0,2),level.routeEvent.routes[0].slice(0,2));
        assert.ok(level.routeEvent.wave>1&&level.routeEvent.wave<level.waves);
      }
    }
  }
});

test('country repair stations heal living nearby crews, not dead or remote crews', () => {
  const {game,Tower,Soldier}=battle();
  const depot=new Tower('depot',400,390),pump=new Tower('signal',400,390,'country');pump.level=3;pump.branch=0;
  depot.rally={x:400,y:390};depot.soldiers=[0,1,2].map(i=>new Soldier(depot,i));
  const [near,dead,far]=depot.soldiers;near.health=20;dead.health=0;far.health=20;far.x=700;
  game.towers=[depot,pump];pump.update(.01,game);
  assert.equal(near.health,44);assert.equal(dead.health,0);assert.equal(far.health,20);
  pump.update(.1,game);assert.equal(near.health,44);
});

test('mountain armor stripping helps other towers and sea jamming delays shield regeneration', () => {
  const {game,Enemy,applyHit}=battle(),road=game.road.path(0);
  const armored=new Enemy('armor',road);armored.health=1000;
  applyHit(armored,0,{shred:.25},game);armored.hit(100,game);
  assert.ok(Math.abs(armored.health-920)<.001);
  armored.update(4.1,game);armored.hit(100,game);assert.ok(Math.abs(armored.health-865)<.001);
  const shielded=new Enemy('shield',road);shielded.shield=0;
  applyHit(shielded,0,{jam:5},game);shielded.update(4,game);assert.equal(shielded.shield,0);
  shielded.update(1.1,game);assert.ok(shielded.shield>0);
});

test('chapter music has distinct melodies, timing and instrumentation and resets on chapter switch', () => {
  const {game,SoundEngine,MUSIC_TRACKS}=setup();const sound=new SoundEngine(),notes=[];
  sound.context={state:'running',currentTime:10};sound.tone=(...args)=>notes.push(args);
  const recordings=[];
  for(let chapter=0;chapter<6;chapter++){
    game.menuChapter=chapter;notes.length=0;
    for(let i=0;i<16;i++){sound.context.currentTime+=1;sound.update(game);}
    recordings.push(JSON.stringify(notes));assert.equal(sound.note,16);
  }
  assert.equal(new Set(recordings).size,6);
  const tracks=Object.values(MUSIC_TRACKS);
  assert.ok(new Set(tracks.map(t=>t.bpm)).size>=5);
  assert.ok(new Set(tracks.map(t=>t.meter)).size>1);
  assert.ok(new Set(tracks.map(t=>t.voice)).size>1);
  sound.musicEnabled=false;const n=notes.length;sound.context.currentTime+=1;sound.update(game);assert.equal(notes.length,n);
  sound.musicEnabled=true;game.menuChapter=0;sound.context.currentTime+=1;sound.update(game);assert.equal(sound.note,1);
  const next=sound.nextMusic;game.speed=3;sound.update(game);assert.equal(sound.nextMusic,next);
});

test('music mute preserves active sound effects while effects mute preserves music voices',()=>{
  const {SoundEngine}=setup();const sound=new SoundEngine();sound.unlock=()=>{};
  const effect={stop(){this.stopped=true;}},music={stop(){this.stopped=true;}};
  sound.voices.add(effect);sound.voices.add(music);sound.musicVoices.add(music);
  sound.toggle('music');assert.equal(music.stopped,true);assert.equal(effect.stopped,undefined);
  sound.voices.add(music);sound.musicVoices.add(music);music.stopped=false;
  sound.toggle('effects');assert.equal(effect.stopped,true);assert.equal(music.stopped,false);
});


test('reduced targeting ranges apply to every evolution and match displayed guard rally limits',()=>{
  const {game,Tower,Enemy,CHAPTERS}=battle();
  for(const chapter of CHAPTERS)for(const type of ['rail','signal','missile','depot'])for(const [level,branch] of [[1,null],[2,null],[3,0],[3,1],[4,0],[4,1]]){
    const t=new Tower(type,400,390,chapter.theme);t.level=level;t.branch=branch;
    assert.ok(t.stats.range>=108&&t.stats.range<=201,'shorter ranges retain role differences');
    if(type==='depot'){assert.equal(t.stats.rallyRange,t.stats.range);continue;}
    const enemy=new Enemy('boss',game.road.path(0));enemy.x=t.x+t.stats.range+.1;enemy.y=t.y;
    game.enemies=[enemy];game.projectiles=[];game.beams=[];game.effects=[];
    t.update(0,game);assert.equal(enemy.health,enemy.maxHealth);assert.equal(game.projectiles.length+game.beams.length,0);
    enemy.x=t.x+t.stats.range;t.update(0,game);
    assert.ok(enemy.health<enemy.maxHealth||game.projectiles.length>0,'exactly on boundary remains targetable');
  }
});

test('projectile visuals survive later upgrades and impact animation cannot duplicate damage',()=>{
  const {game,Tower,Enemy,Projectile,Renderer}=battle();
  for(const theme of ['city','country','desert','hills','sea','forest'])for(const type of ['rail','missile'])for(const [level,branch] of [[1,null],[2,null],[3,0],[3,1],[4,0],[4,1]]){
    const t=new Tower(type,400,390,theme);t.level=level;t.branch=branch;
    const enemy=new Enemy('boss',game.road.path(0),100);enemy.x=490;enemy.y=390;game.enemies=[enemy];game.effects=[];
    const stats=t.stats,p=new Projectile(t,enemy,stats);
    t.level=4;t.branch=1;p.update(.08,game);Renderer.projectile(p);
    assert.equal(p.visual.level,level);assert.equal(p.visual.branch,branch);
    p.update(1,game);assert.equal(p.dead,true);
    const expected=stats.damage*(stats.pierce?1:1-enemy.spec.armor);
    assert.ok(Math.abs(enemy.maxHealth-enemy.health-expected)<.0001);
    const health=enemy.health;
    for(const effect of game.effects)for(const fraction of [.95,.5,.1]){effect.life=effect.duration*fraction;Renderer.attackEffect(effect);}
    assert.equal(enemy.health,health);
  }
});

test('all signal and guard attack animations render and simulation pause freezes recoil and effects',()=>{
  const {game,Tower,Enemy,Renderer,CHAPTERS}=battle();
  for(const chapter of CHAPTERS)for(const type of ['signal','depot'])for(const [level,branch] of [[1,null],[2,null],[3,0],[3,1],[4,0],[4,1]]){
    const t=new Tower(type,400,390,chapter.theme);t.level=level;t.branch=branch;t.rally={x:410,y:390};game.towers=[t];
    const enemy=new Enemy('boss',game.road.path(0),100);enemy.x=415;enemy.y=390;game.enemies=[enemy];game.effects=[];game.beams=[];
    t.update(.01,game);
    assert.ok(t.fireTime>0);
    game.effects.forEach(e=>Renderer.attackEffect(e));game.beams.forEach(b=>Renderer.attackBeam(b));Renderer.tower(t);t.soldiers.forEach(s=>Renderer.soldier(s));
    const fire=t.fireTime,lives=game.effects.map(e=>e.life),health=enemy.health;
    game.paused=true;game.update(1);game.paused=false;
    assert.equal(t.fireTime,fire);assert.deepEqual(game.effects.map(e=>e.life),lives);assert.equal(enemy.health,health);
    t.update(.1,game);assert.ok(t.fireTime<fire);
  }
});


test('three save slots migrate legacy progress, sanitize data and isolate all writes',()=>{
  const {Progress,game,stored}=setup(JSON.stringify({schema:3,stars:[3,2,0]}));
  assert.equal(Progress.list().length,3);assert.equal(Progress.list()[0].createdAt,0);
  assert.equal(Progress.load(0).stars[1],2);assert.equal(Progress.list()[1],null);
  assert.ok(Progress.select(0));assert.equal(JSON.parse(stored()).schema,4);
  const second=Progress.blank();second.stars[0]=1;assert.ok(Progress.save(second,1));
  const created=Progress.list()[1].createdAt;assert.ok(created>0);
  second.stars[1]=3;Progress.save(second,1);assert.equal(Progress.list()[1].createdAt,created);
  assert.equal(Progress.list()[0].stars[1],2);assert.equal(Progress.list()[2],null);
  const before=stored();assert.equal(Progress.save(second,3),false);assert.equal(Progress.select(-1),false);assert.equal(stored(),before);
  const denied=setup(stored(),true);denied.game.newCampaign();denied.game.chooseSaveSlot(0);denied.game.newCampaign(true);
  assert.equal(denied.game.saveFailed,true);assert.equal(denied.Progress.load(0).stars[0],3);
  assert.equal(denied.Progress.load(1).stars[1],3);
  const malformed=setup(JSON.stringify({schema:4,activeSlot:9,slots:[{stars:[7,-4,'x'],createdAt:-2},{bad:true},null,{stars:[3]}]}));
  assert.deepEqual([...malformed.Progress.load().stars.slice(0,3)],[3,0,0]);assert.equal(malformed.Progress.list().length,3);
});

test('vehicles leave entrance space, follow slower traffic and separate split children',()=>{
  const {game,Enemy,CONFIG,Collision}=battle(),path=[{x:100,y:390},{x:430,y:390},{x:430,y:600}];
  const lead=new Enemy('armor',path),fast=new Enemy('runner',path);lead.x=200;fast.x=135;game.enemies=[lead,fast];
  for(let i=0;i<480;i++){
    lead.update(1/60,game);fast.update(1/60,game);
    assert.ok(fast.remaining-lead.remaining>=(lead.bodyLength+fast.bodyLength)/2+CONFIG.trafficGap-.001);
  }
  game.startLevel(0);game.startWave();game.spawnQueue=['armor','runner'].map((type,i)=>({type,scale:1,wave:1,entry:0,lane:0,span:1,group:`test${i}`,due:i*.5}));
  game.update(.01);const first=game.enemies[0];first.stunTime=2;game.update(.8);assert.equal(game.enemies.length,1);
  first.stunTime=0;for(let i=0;i<100;i++)game.update(.02);
  assert.ok(game.enemies.length>=2);assert.ok(Collision.distance(game.enemies[0],game.enemies[1])>25);
  const splitter=new Enemy('splitter',path);splitter.x=105;game.enemies=[splitter];splitter.hit(9999,game);
  const children=game.enemies.filter(e=>!e.dead);assert.equal(children.length,3);
  assert.equal(new Set(children.map(e=>`${e.x},${e.y}`)).size,3);
});

test('stronger health keeps the smaller vehicle art separate from combat size',()=>{
  const {game,Enemy,ENEMIES,CONFIG,Renderer}=battle();
  for(const [type,spec] of Object.entries(ENEMIES)){
    const enemy=new Enemy(type,game.road.path(0),2);
    assert.equal(enemy.maxHealth,spec.hp*2*(spec.boss?CONFIG.bossHealthMultiplier:CONFIG.enemyHealthMultiplier));
    Renderer.vehicle(type,100,200,Math.PI/4,true,true);Renderer.enemy(enemy);
  }
  assert.ok(CONFIG.enemyVisualScale<=.88);assert.ok(21*CONFIG.enemyVisualScale<CONFIG.laneWidth);
});

test('each chapter offers manual forks and all four traffic objectives with announced route events',()=>{
  const {LEVELS,RoadNetwork,Traffic}=setup();
  for(let c=0;c<6;c++){
    const levels=LEVELS.filter(l=>l.chapter===c);
    assert.equal(new Set(levels.map(l=>l.mission)).size,4);
    assert.ok(levels.some(l=>Traffic.fork(new RoadNetwork(l))),`chapter ${c} manual fork`);
  }
  assert.equal(new Set(LEVELS.filter(l=>l.routeEvent).map(l=>l.routeEvent.kind)).size,4);
});

test('manual navigation reroutes only upstream vehicles and never teleports or rewinds them',()=>{
  const {game,Enemy,CivilVehicle,Traffic,CONFIG}=battle(),old=game.road.path(0);
  const early=new Enemy('scout',old),late=new Enemy('scout',old),bus=new CivilVehicle('bus',old);
  early.x+=30;late.segment=1;Object.assign(late,old[1]);late.x+=5;
  game.enemies=[early,late];game.traffic.civilians=[bus];
  const x=early.x,health=early.health;
  assert.equal(Traffic.switchRoute(game),true);assert.equal(game.traffic.branch,1);
  assert.equal(early.path,game.road.path(1));assert.equal(bus.path,old);assert.equal(late.path,old);
  assert.equal(early.x,x);assert.equal(early.health,health);assert.equal(late.segment,1);
  assert.equal(Traffic.switchRoute(game),false);assert.equal(game.traffic.branch,1);
  game.paused=true;const cooldown=game.traffic.switchCooldown;game.update(10);assert.equal(game.traffic.switchCooldown,cooldown);
  game.paused=false;Traffic.update(game,CONFIG.trafficSwitchCooldown);assert.equal(Traffic.switchRoute(game),true);
});

test('road speed affects movement, heavy vehicles slow more on sand and curves decelerate',()=>{
  const {game,Enemy,Traffic,LEVELS}=battle();
  const p=[{x:100,y:300},{x:200,y:300},{x:600,y:300},{x:800,y:300}];
  const fast=new Enemy('scout',p);fast.segment=1;fast.x=300;game.enemies=[fast];
  fast.update(1,game);assert.ok(Math.abs(fast.x-300-fast.spec.speed*1.18)<.001);
  game.progress.stars.fill(3);game.startLevel(16);
  const light=new Enemy('scout',p),heavy=new Enemy('armor',p);for(const car of [light,heavy]){car.segment=1;car.x=300;}
  assert.ok(Traffic.speed(game,heavy)<Traffic.speed(game,light));
  const straight=Traffic.speed(game,light);light.x=590;light.path=[...p.slice(0,3),{x:600,y:500}];
  assert.ok(Traffic.speed(game,light)<straight);
});

test('bus objective requires both deliveries after the last hostile is gone',()=>{
  const {game,Traffic,CivilVehicle}=battle();game.progress.stars.fill(3);game.startLevel(1);
  game.wave=2;Traffic.onWave(game);assert.equal(game.traffic.pending.length,1);
  game.wave=game.level.waves-1;Traffic.onWave(game);assert.equal(game.traffic.pending.length,2);
  game.traffic.pending=[];game.wave=game.level.waves;game.state='wave';game.enemies=[];game.spawnQueue=[];
  game.update(.01);assert.equal(game.screen,'battle');
  const path=game.road.path(0),car=new CivilVehicle('bus',path);car.segment=path.length-2;Object.assign(car,path.at(-1));
  game.traffic.civilians=[car];game.update(.01);assert.equal(game.traffic.delivered,1);assert.equal(game.screen,'battle');
  const second=new CivilVehicle('bus',path);second.segment=path.length-2;Object.assign(second,path.at(-1));
  game.traffic.civilians=[second];game.update(.01);assert.equal(game.won,true);assert.equal(game.screen,'result');
});

test('bus damage can fail the mission and escort protection prevents damage while active',()=>{
  const {game,Traffic,CivilVehicle,Enemy}=battle();game.progress.stars.fill(3);game.startLevel(1);
  const path=game.road.path(0),bus=new CivilVehicle('bus',path);game.traffic.civilians=[bus];game.enemies=[new Enemy('scout',path)];
  assert.equal(Traffic.action(game),true);bus.update(1,game);assert.equal(bus.health,100);
  game.traffic.activeTime=0;bus.health=1;Object.assign(bus,path[0]);Traffic.update(game,1);
  assert.equal(game.screen,'result');assert.equal(game.won,false);assert.match(game.failureReason,/公交/);
});

test('ambulance congestion, priority passage, deadline failure and paused timers are real rules',()=>{
  const {game,Traffic,CivilVehicle,Enemy}=battle();game.progress.stars.fill(3);game.startLevel(2);
  const path=game.road.path(0),car=new CivilVehicle('emergency',path);game.traffic.civilians=[car];game.enemies=[new Enemy('scout',path)];
  car.update(1,game);assert.equal(car.x,path[0].x);assert.equal(car.blocked,true);
  assert.equal(Traffic.action(game),true);car.update(.1,game);assert.ok(car.x!==path[0].x||car.y!==path[0].y);
  assert.equal(Traffic.action(game),false);game.paused=true;const time=car.deadline;game.update(10);assert.equal(car.deadline,time);
  game.paused=false;car.deadline=.01;Traffic.update(game,.02);assert.equal(game.won,false);assert.match(game.failureReason,/时限/);
});

test('toll gate blocks approaching cars; bridge load and paid repair obey integrity and cooldown',()=>{
  const {game,Traffic,Enemy}=battle(),path=game.road.path(0),enemy=new Enemy('scout',path);
  enemy.segment=path.length-2;Object.assign(enemy,path.at(-1));enemy.x-=35;game.enemies=[enemy];
  assert.equal(Traffic.action(game),true);const x=enemy.x;enemy.update(.1,game);assert.equal(enemy.x,x);
  Traffic.onEscape(game,enemy);assert.equal(game.traffic.integrity,100-enemy.spec.leak*8);
  game.progress.stars.fill(3);game.startLevel(3);const boss=new Enemy('boss',game.road.path(0));Object.assign(boss,game.traffic.bridge);game.enemies=[boss];
  Traffic.update(game,5);assert.ok(game.traffic.integrity<100);game.traffic.integrity=50;const gold=game.gold;
  assert.equal(Traffic.action(game),true);assert.equal(game.gold,gold-60);assert.equal(game.traffic.integrity,80);
  assert.equal(Traffic.action(game),false);game.traffic.integrity=.01;Traffic.update(game,1);assert.match(game.failureReason,/桥梁/);
});

test('traffic events broadcast one wave early, preserve escort position and display countdown',()=>{
  const {game,Traffic,CivilVehicle,Sound}=battle();game.progress.stars.fill(3);game.startLevel(3);
  const heard=[];Sound.play=k=>heard.push(k);game.wave=game.level.routeEvent.wave-1;Traffic.onWave(game);
  assert.ok(heard.includes('radio-construction'));Traffic.onWave(game);assert.equal(heard.filter(k=>k==='radio-construction').length,1);
  game.prepareTime=6;assert.match(Traffic.eventText(game),/6秒/);
  const bus=new CivilVehicle('bus',game.road.path(0));bus.x+=20;game.traffic.civilians=[bus];const x=bus.x;
  game.wave++;assert.equal(game.applyRouteEvent(),true);assert.equal(bus.x,x);assert.equal(bus.path,game.road.path(0));
});

test('engine distance attenuation becomes silent outside active battle',()=>{
  const {game,Enemy,Traffic}=battle(),car=new Enemy('scout',game.road.path(0));game.enemies=[car];
  car.x=474;car.y=650;const near=Traffic.engineLevel(game);car.x=60;car.y=200;assert.ok(near>Traffic.engineLevel(game));
  game.paused=true;assert.equal(Traffic.engineLevel(game),0);game.paused=false;game.modal='battleMenu';assert.equal(Traffic.engineLevel(game),0);
});

test('junction signs never steal the center of legal construction pads',()=>{
  const {game,LEVELS}=setup();game.progress.stars.fill(3);
  for(let i=0;i<LEVELS.length;i++){
    game.startLevel(i);if(!game.traffic.fork)continue;
    for(const site of game.sites){game.cancel();game.click(site,true);assert.equal(game.selectedSite,site,`level ${i}, pad ${site.id}`);}
  }
});

test('ambulance ignores cars behind it and cars on a parallel road',()=>{
  const {game,Enemy,CivilVehicle}=battle();game.progress.stars.fill(3);game.startLevel(2);
  const path=[{x:100,y:300},{x:500,y:300}],car=new CivilVehicle('emergency',path),enemy=new Enemy('scout',path);
  car.x=220;enemy.x=190;game.enemies=[enemy];car.update(.1,game);assert.equal(car.blocked,false);assert.ok(car.x>220);
  car.x=220;enemy.x=240;enemy.y=340;car.update(.1,game);assert.equal(car.blocked,false);
  car.x=220;enemy.y=300;car.update(.1,game);assert.equal(car.blocked,true);assert.equal(car.x,220);
});

test('temporary diversions expire, auto traffic uses all lanes, and branch speeds differ',()=>{
  const {game,Traffic,Enemy,CONFIG}=battle();
  assert.equal(Traffic.path(game,0),game.road.path(0));assert.equal(Traffic.path(game,1),game.road.path(1));
  const fast=new Enemy('scout',game.road.path(0)),slow=new Enemy('scout',game.road.path(1));
  for(const e of [fast,slow]){e.segment=2;Object.assign(e,e.path[2]);}
  assert.ok(Traffic.speed(game,fast)>Traffic.speed(game,slow)*1.4);
  assert.equal(Traffic.switchRoute(game,1),true);assert.equal(Traffic.path(game,0),slow.path);
  Traffic.update(game,CONFIG.diversionDuration+.01);assert.equal(Traffic.path(game,0),fast.path);
  assert.equal(Traffic.switchRoute(game,0),false);assert.ok(game.traffic.switchCooldown>0);
  Traffic.update(game,CONFIG.trafficSwitchCooldown);assert.equal(Traffic.switchRoute(game,0),true);
  assert.equal(Traffic.switchRoute(game,-1),false);
});

test('route choices are clickable in the map toolbar and cancellation closes the menu',()=>{
  const api=battle(),{game,Renderer}=api;Renderer.draw(game);
  press(api,'分流调度');assert.equal(game.traffic.routeMenu,true);Renderer.draw(game);
  const choices=game.buttons.filter(b=>Number.isInteger(b.routeIndex));assert.equal(choices.length,2);
  press(api,b=>b.routeIndex===1);assert.equal(game.traffic.branch,1);assert.ok(game.traffic.diversionTime>0);
  press(api,b=>b.label?.startsWith('定向'));assert.equal(game.traffic.routeMenu,true);
  game.cancel();assert.equal(game.traffic.routeMenu,false);
});

test('bus departure offers a bounded dispatch window and never permits free duplicates',()=>{
  const {game,Traffic,CONFIG}=battle();game.progress.stars.fill(3);game.startLevel(1);game.wave=2;
  Traffic.onWave(game);Traffic.onWave(game);assert.equal(game.traffic.pending.length,1);
  Traffic.update(game,4);assert.equal(game.traffic.civilians.length,0);assert.equal(game.traffic.pending[0].releaseIn,CONFIG.busDispatchWindow-4);
  game.paused=true;assert.equal(Traffic.dispatch(game),false);const time=game.traffic.pending[0].releaseIn;game.update(9);assert.equal(game.traffic.pending[0].releaseIn,time);
  game.paused=false;assert.equal(Traffic.dispatch(game),true);assert.equal(Traffic.dispatch(game),false);
  Traffic.update(game,.01);assert.equal(game.traffic.civilians.length,1);assert.equal(game.traffic.pending.length,0);
  game.startLevel(1);game.wave=2;Traffic.onWave(game);Traffic.update(game,CONFIG.busDispatchWindow+.01);
  assert.equal(game.traffic.civilians.length,1,'deadline automatically releases waiting bus');
});

test('buses must stop for boarding; ambushes are warned, spaced and can be interrupted',()=>{
  const {game,Traffic,CivilVehicle,CONFIG,Enemy}=battle();game.progress.stars.fill(3);game.startLevel(1);
  const bus=new CivilVehicle('bus',game.road.path(0)),stop=bus.stops[0];game.traffic.civilians=[bus];
  Object.assign(bus,Traffic.pointAt(bus.path,stop.distance-180));bus.travelled=stop.distance-180;
  bus.update(.1,game);assert.ok(stop.alert>0);assert.equal(game.enemies.length,0);
  for(let i=0;i<31;i++)bus.update(.1,game);
  assert.ok(game.enemies.length>0);assert.ok(game.enemies.every(e=>e.type==='raider'&&e.raidTarget===bus));
  if(game.enemies.length===2)assert.ok(Math.hypot(game.enemies[0].x-game.enemies[1].x,game.enemies[0].y-game.enemies[1].y)>=38);
  game.enemies=[];stop.raided=true;stop.waiting=CONFIG.busStopTime;Object.assign(bus,stop);bus.travelled=stop.distance;bus.health=100;
  const x=bus.x,y=bus.y;bus.update(1,game);assert.equal(bus.x,x);assert.equal(bus.y,y);assert.equal(bus.atStop,true);assert.equal(stop.waiting,CONFIG.busStopTime-1);
  const raid=new Enemy('raider',bus.path);Object.assign(raid,{x:bus.x+10,y:bus.y});game.enemies=[raid];
  raid.stunTime=2;bus.update(.1,game);assert.equal(bus.health,100);
  raid.stunTime=0;bus.update(.1,game);assert.ok(bus.health<100);
  const hp=bus.health;Traffic.action(game);bus.update(.1,game);assert.equal(bus.health,hp);
});

test('healthy bus delivery earns more supply and reduces skill cooldown only once',()=>{
  const {game,CivilVehicle,CONFIG}=battle();game.progress.stars.fill(3);game.startLevel(1);
  const car=new CivilVehicle('bus',game.road.path(0));car.health=75;game.skillCooldowns={strike:20,freeze:5};
  const gold=game.gold;car.arrive(game);
  assert.equal(game.gold-gold,CONFIG.busRewardBase+Math.floor(75*CONFIG.busRewardHealth));
  assert.equal(game.skillCooldowns.strike,12);assert.equal(game.skillCooldowns.freeze,0);
  const after=game.gold;car.arrive(game);assert.equal(game.gold,after);assert.equal(game.traffic.delivered,1);
});

test('bridge damage follows both old and changed routes, and counts each entry only once',()=>{
  const {game,Traffic,Enemy}=battle();game.progress.stars.fill(3);game.startLevel(3);
  const oldPath=game.road.path(0),oldBridge=game.traffic.bridge;
  game.wave=game.level.routeEvent.wave;game.applyRouteEvent();
  const newPath=game.road.path(0),newBridge=game.traffic.bridge;
  assert.notEqual(oldBridge.key,newBridge.key);
  const old=new Enemy('armor',oldPath),current=new Enemy('armor',newPath);
  Object.assign(old,{x:oldBridge.x,y:oldBridge.y});Object.assign(current,{x:newBridge.x,y:newBridge.y});
  game.enemies=[old,current];Traffic.update(game,1);
  assert.ok(game.traffic.integrity<98);const hp=game.traffic.integrity;
  Traffic.update(game,1);assert.ok(Math.abs(hp-game.traffic.integrity-.44)<1e-7);
  assert.ok(Traffic.status(game).includes('受损'));
});

test('demolition waves siege the actual deck, stun interrupts attacks and neglect destroys it',()=>{
  const {game,Traffic,Enemy,CONFIG}=battle();game.progress.stars.fill(3);game.startLevel(3);
  assert.equal(game.wavePlan(1).includes('demolisher'),false);assert.equal(game.wavePlan(2).filter(t=>t==='demolisher').length,1);
  assert.equal(game.wavePlan(6).filter(t=>t==='demolisher').length,2);
  const enemy=new Enemy('demolisher',game.road.path(0)),span=game.traffic.bridge;
  Object.assign(enemy,{x:span.x,y:span.y,segment:span.segment});game.enemies=[enemy];
  const x=enemy.x,y=enemy.y;enemy.update(.1,game);assert.equal(enemy.x,x);assert.equal(enemy.y,y);
  Traffic.update(game,1);const hp=game.traffic.integrity;assert.ok(hp<95);
  enemy.stunTime=5;Traffic.update(game,1);assert.ok(Math.abs(hp-game.traffic.integrity-.22)<1e-7);
  enemy.stunTime=0;game.traffic.integrity=2;Traffic.update(game,1);assert.equal(game.won,false);assert.match(game.failureReason,/桥梁/);
  game.startLevel(3);const outside=new Enemy('demolisher',game.road.path(0));game.enemies=[outside];
  Traffic.update(game,5);assert.equal(game.traffic.integrity,100,'no arbitrary damage away from bridge');
  assert.ok(CONFIG.bossHealthMultiplier>=1.9&&CONFIG.enemyHealthMultiplier>=1.4);
});

test('physical, magic, piercing and true damage have different counters; shields absorb first',()=>{
  const {game,Enemy}=battle(),path=game.road.path(0);
  const loss=(type,attack)=>{const e=new Enemy(type,path,10),hp=e.health;e.hit(100,game,attack);return hp-e.health;};
  assert.equal(loss('insulated',{damageType:'physical'}),95);
  assert.equal(loss('insulated',{damageType:'magic'}),35);
  assert.equal(loss('insulated',{damageType:'magic',pierce:true}),35,'piercing never bypasses magic resistance');
  assert.equal(loss('bulldozer',{damageType:'physical'}),70);
  assert.equal(loss('bulldozer',{damageType:'magic'}),90);
  assert.equal(loss('bulldozer',{damageType:'physical',pierce:true}),100);
  assert.equal(loss('bulldozer',{damageType:'true'}),100);
  const shield=new Enemy('shield',path,10),hp=shield.health;shield.shield=120;
  shield.hit(50,game,{damageType:'true',shieldMultiplier:3});
  assert.equal(shield.shield,0);assert.equal(hp-shield.health,10);
});

test('burn uses magic resistance, does not stack, and expired strong burns do not amplify new ones',()=>{
  const {game,Enemy,applyHit}=battle(),enemy=new Enemy('insulated',game.road.path(0),10);game.enemies=[enemy];
  const hp=enemy.health;applyHit(enemy,0,{burn:40,duration:1},game);applyHit(enemy,0,{burn:20,duration:1},game);
  enemy.update(1,game);assert.ok(Math.abs(hp-enemy.health-14)<1e-6);assert.equal(enemy.burnDamage,0);
  applyHit(enemy,0,{burn:10,duration:1},game);assert.equal(enemy.burnDamage,10);
});

test('control immunity, group cleanse and silence are actual combat rules',()=>{
  const {game,Enemy,CombatRules,applyHit}=battle(),path=game.road.path(0);
  const immune=new Enemy('bulldozer',path),relay=new Enemy('relay',path),ally=new Enemy('scout',path);
  immune.stun(5);immune.slow(.2,5);assert.equal(immune.stunTime,0);assert.equal(immune.slowTime,0);
  game.enemies=[relay,ally];ally.stun(5);ally.slow(.2,5);relay.abilityTimer=.1;
  applyHit(relay,0,{silence:2},game);CombatRules.enemyAbility(relay,1,game);
  assert.equal(relay.abilityTimer,.1);assert.equal(ally.stunTime,5);
  relay.silenceTime=0;CombatRules.enemyAbility(relay,.2,game);
  assert.equal(ally.stunTime,0);assert.equal(ally.slowTime,0);ally.stun(4);assert.equal(ally.stunTime,0);
  ally.update(.9,game);ally.stun(4);assert.equal(ally.stunTime,4,'cleanse protection expires');
});

test('healing can be blocked on recipients or silenced at its source',()=>{
  const {game,Enemy,applyHit}=battle(),path=game.road.path(0);
  const healer=new Enemy('healer',path),ally=new Enemy('scout',path,10);game.enemies=[healer,ally];
  ally.health-=100;healer.healTimer=0;const hp=ally.health;
  applyHit(ally,0,{healBlock:3},game);healer.update(.01,game);assert.equal(ally.health,hp);
  ally.healBlockTime=0;healer.healTimer=0;applyHit(healer,0,{silence:3},game);
  healer.update(.01,game);assert.equal(ally.health,hp);
  healer.silenceTime=0;healer.update(.01,game);assert.ok(ally.health>hp);
});

test('jammer disables a nearby tower, releases blockers, and repair protection prevents repeat locks',()=>{
  const {game,Enemy,Tower,CombatRules,SkillActions}=battle();
  const enemy=new Enemy('jammer',game.road.path(0)),tower=new Tower('depot',enemy.x,enemy.y);
  let released=false;tower.soldiers=[{release(){released=true;}}];game.towers=[tower];game.enemies=[enemy];
  enemy.abilityTimer=1.5;CombatRules.enemyAbility(enemy,1,game);assert.equal(tower.jammedTime,0);
  CombatRules.enemyAbility(enemy,.6,game);assert.equal(tower.jammedTime,2.4);assert.equal(released,true);
  tower.soldiers=[];assert.equal(SkillActions.cast(game,'repair',tower),true);assert.equal(tower.jammedTime,0);assert.equal(tower.jamGuardTime,6);
  enemy.abilityTimer=0;CombatRules.enemyAbility(enemy,.1,game);assert.equal(tower.jammedTime,0);
  tower.jamGuardTime=0;tower.type='rail';tower.cooldown=2;tower.jammedTime=2;tower.update(.1,game);assert.equal(tower.cooldown,2);
});

test('linear penetration hits only two following cars in its finite corridor',()=>{
  const {game,Enemy,Tower,Projectile}=battle(),path=game.road.path(0),tower=new Tower('rail',100,300);
  const positions=[[200,300],[240,300],[270,310],[300,300],[210,330],[365,300],[180,300]];
  game.enemies=positions.map(([x,y])=>Object.assign(new Enemy('scout',path,10),{x,y}));
  const health=game.enemies.map(e=>e.health),shot=new Projectile(tower,game.enemies[0],{damage:100,damageType:'true',lineHits:3,color:'#fff'});
  shot.update(1,game);assert.equal(shot.dead,true);
  assert.deepEqual(game.enemies.map((e,i)=>Math.round(health[i]-e.health)),[100,70,70,0,0,0,0]);
});

test('all biome branches have distinct damage/rate growth and defined damage types',()=>{
  const {Tower,TOWERS,CHAPTERS}=setup();
  for(const chapter of CHAPTERS)for(const type of Object.keys(TOWERS)){
    const rates=[];
    for(const branch of [0,1]){const t=new Tower(type,0,0,chapter.theme);t.branch=branch;t.level=3;const a=t.stats;t.level=4;const b=t.stats;
      assert.equal(b.damageType,type==='signal'?'magic':'physical');assert.ok(b.damage>a.damage);rates.push([b.damage/a.damage,b.cooldown/a.cooldown]);
      if(type==='signal'&&branch===1)assert.ok(b.silence>0);
      if((type==='rail'||type==='depot')&&branch===1)assert.ok(b.healBlock>0);
    }
    assert.notDeepEqual(rates[0],rates[1]);
  }
});

test('skill research migrates three saves, preserves dates and isolates loadouts',()=>{
  const dates=[1000,2000,3000],saved={schema:4,activeSlot:1,slots:dates.map(createdAt=>({schema:4,stars:[3,3],createdAt,lastPlayedAt:4000}))};
  const {game,Progress,SkillBook}=setup(JSON.stringify(saved));game.screen='menu';
  assert.equal(SkillBook.available(game.progress),6);assert.equal(game.upgradeSkill('emp'),true);assert.equal(game.equipSkill('emp',0),true);
  const slots=Progress.list();assert.deepEqual(Array.from(slots,s=>s.createdAt),dates);assert.equal(slots[1].skills.upgrades.emp.level,2);
  assert.equal(slots[0].skills.upgrades.emp.level,1);assert.equal(slots[2].skills.loadout[0],'strike');
  const reloaded=Progress.load(1);assert.equal(reloaded.skills.loadout[0],'emp');assert.equal(SkillBook.available(reloaded),3);
});

test('star costs, mutually exclusive evolutions, refunds and replay earnings cannot inflate currency',()=>{
  const {game,SkillBook}=setup();game.screen='menu';game.progress.stars.fill(0);game.progress.stars[0]=3;
  assert.equal(game.upgradeSkill('emp'),true);assert.equal(SkillBook.available(game.progress),0);assert.equal(game.upgradeSkill('strike'),false);
  game.progress.stars[1]=3;game.progress.stars[2]=3;assert.equal(game.upgradeSkill('emp'),false,'branch choice required');
  assert.equal(game.upgradeSkill('emp',1),true);assert.equal(SkillBook.available(game.progress),1);assert.equal(game.upgradeSkill('emp',0),false);
  assert.equal(game.resetSkills(),true);assert.equal(SkillBook.available(game.progress),9);assert.equal(game.progress.skills.upgrades.emp.branch,null);
  game.startLevel(0);game.finish(true);assert.equal(SkillBook.earned(game.progress),9,'replaying a 3-star level grants no new currency');
  const corrupt=SkillBook.clean({loadout:['emp','emp','unknown'],upgrades:{strike:{level:4,branch:1},emp:{level:4,branch:0}}},[3]);
  assert.equal(SkillBook.spent(corrupt),3);assert.equal(corrupt.upgrades.emp.level,1);assert.equal(new Set(corrupt.loadout).size,2);
});

test('two skill slots swap without duplicates and are frozen during combat',()=>{
  const {game}=setup();game.screen='menu';game.progress.stars.fill(3);
  game.equipSkill('emp',0);game.equipSkill('emp',1);assert.deepEqual(Array.from(game.progress.skills.loadout),['freeze','emp']);
  game.upgradeSkill('emp');game.upgradeSkill('emp',1);game.startLevel(0);
  const spec=JSON.stringify(game.skillSpecs.emp);assert.equal(game.upgradeSkill('emp'),false);assert.equal(game.resetSkills(),false);assert.equal(game.equipSkill('repair',0),false);
  assert.equal(JSON.stringify(game.skillSpecs.emp),spec);assert.equal(game.selectSkill('strike'),false);assert.equal(game.selectSkill('emp'),true);
  assert.equal(game.cast({x:-1,y:-1}),false);assert.equal(game.skillCooldowns.emp,0);
  game.enemies=[];assert.equal(game.cast({x:500,y:300}),false);assert.equal(game.skillCooldowns.emp,0);
});

test('all skill ranks and branches produce finite specs and max research stays within earned stars',()=>{
  const {SkillBook,SKILLS,LEVELS}=setup(),research=SkillBook.blank();
  for(const key of Object.keys(SKILLS))for(const branch of [0,1])for(let level=1;level<=4;level++){
    research.upgrades[key]={level,branch:level>=3?branch:null};
    for(const stage of [LEVELS[0],LEVELS[47]]){const spec=SkillBook.stats(research,key,stage);assert.ok(spec.cooldown>0&&spec.radius>0&&Number.isFinite(spec.damage));}
  }
  assert.equal(SkillBook.spent(research),96);assert.equal(SkillBook.spent(SkillBook.clean(research,Array(48).fill(3))),96);
});

test('EMP suppresses abilities and shields, while advanced freeze respects control immunity',()=>{
  const {game,Enemy,SkillActions,SkillBook}=battle(),path=game.road.path(0),relay=new Enemy('relay',path,10),shield=new Enemy('shield',path,10);
  game.enemies=[relay,shield];shield.shield=500;SkillActions.cast(game,'emp',relay);
  assert.equal(relay.silenceTime,5);assert.equal(shield.jamTime,5);assert.equal(shield.shield,260);assert.equal(game.skillCooldowns.emp,32);
  game.progress.skills.upgrades.freeze={level:3,branch:1};game.skillSpecs.freeze=SkillBook.stats(game.progress.skills,'freeze',game.level);
  const immune=new Enemy('bulldozer',path);game.enemies=[relay,immune];SkillActions.cast(game,'freeze',relay);
  assert.ok(relay.stunTime>0&&relay.slowTime===8);assert.equal(immune.stunTime,0);assert.equal(immune.slowTime,0);
});

test('heat zones expire and pause with battle',()=>{
  const {game,Enemy,SkillActions}=battle(),point=game.road.path(0)[1],enemy=Object.assign(new Enemy('scout',game.road.path(0),10),point);
  game.enemies=[enemy];assert.equal(SkillActions.cast(game,'fire',point),true);SkillActions.update(game,.1);assert.equal(enemy.burnDamage,24);
  const life=game.skillZones[0].life;game.paused=true;game.update(1);assert.equal(game.skillZones[0].life,life);
  game.skillZones[0].life=0;enemy.burnTime=0;SkillActions.update(game,1);assert.equal(enemy.burnTime,0);assert.equal(game.skillZones.length,0);
});

test('repair restores damaged bus and actual bridge, and overdrive changes attack rate without damage',()=>{
  const {game,Tower,CivilVehicle,SkillActions}=battle();game.progress.stars.fill(3);game.startLevel(3);
  const bridge=game.traffic.bridge,tower=new Tower('rail',bridge.x,bridge.y),bus=Object.assign(new CivilVehicle('bus',game.road.path(0)),bridge);
  game.towers=[tower];game.traffic.civilians=[bus];bus.health=50;game.traffic.integrity=60;
  SkillActions.cast(game,'repair',tower);assert.equal(bus.health,82);assert.equal(game.traffic.integrity,92);
  const damage=tower.stats.damage;tower.cooldown=10;SkillActions.cast(game,'overdrive',tower);tower.update(1,game);
  assert.equal(tower.stats.damage,damage);assert.ok(Math.abs(tower.cooldown-8.65)<1e-8);assert.equal(tower.hasteTime,6);
});

test('codex renders every tower branch/rank, all enemy entries and every skill evolution',()=>{
  const {game,Renderer,CHAPTERS,TOWERS,ENEMIES,SKILLS,CHAPTER_THREATS}=setup();game.screen='menu';game.progress.stars.fill(3);game.openCodex();
  const encountered=new Set();
  for(const chapter of CHAPTERS){game.codex.chapter=CHAPTERS.indexOf(chapter);
    for(const type of Object.keys(TOWERS))for(const branch of [0,1])for(const rank of [1,2,3,4]){Object.assign(game.codex,{tab:'towers',type,branch,rank,detailPage:0});Renderer.draw(game);}
    const main=[...chapter.pool,chapter.boss,...CHAPTER_THREATS[game.codex.chapter],'raider','demolisher'];
    for(const enemy of [...main,...main.filter(k=>ENEMIES[k].split).map(k=>ENEMIES[k].splitType||'swarm')]){encountered.add(enemy);Object.assign(game.codex,{tab:'enemies',enemy,detailPage:0});Renderer.draw(game);}
  }
  assert.equal(encountered.size,Object.keys(ENEMIES).length,'every enemy is discoverable through chapters');
  for(const skill of Object.keys(SKILLS))for(const branch of [0,1])for(const level of [1,2,3,4]){
    game.progress.skills.upgrades[skill]={level,branch:level>=3?branch:null};Object.assign(game.codex,{tab:'skills',skill,branch});Renderer.draw(game);
    assert.ok(game.buttons.some(b=>b.label.includes('装入 Q')||b.label.includes('Q · 已装备')));
  }
});

test('skill codex retains every current and next effect without truncating its six-line panel',()=>{
  const {game,Renderer,SkillBook,SKILLS}=setup();
  for(const skill of Object.keys(SKILLS))for(const branch of [0,1])for(const level of [1,2,3,4]){
    const current=SkillBook.blank(),next=SkillBook.blank();current.upgrades[skill]={level,branch:level>=3?branch:null};
    next.upgrades[skill]={level:Math.min(4,level+1),branch:level>=2?branch:null};
    const a=SkillBook.stats(current,skill),b=SkillBook.stats(next,skill);
    const lines=Renderer.skillMechanics(skill,a,b).flatMap(line=>Renderer.bookWrap(line));
    assert.ok(lines.length<=6,`${skill} L${level} branch${branch}: ${lines.length} lines`);
    if(skill==='emp'&&level===2&&branch===1)assert.ok(lines.some(line=>line.includes('5→8秒')));
  }
});

test('every convoy roster exactly matches deployed enemies across all 48 stages',()=>{
  const {game,LEVELS,Encounters}=setup();game.progress.stars.fill(3);
  for(let i=0;i<LEVELS.length;i++){
    game.startLevel(i);const counts={},perEntry=Encounters.entrances(game.level).map(()=>({}));
    for(let wave=1;wave<=game.level.waves;wave++){
      assert.equal(game.startWave(true),true);
      const expected=game.spawnQueue.map(b=>({...b}));
      expected.forEach(b=>perEntry[b.entry][b.type]=(perEntry[b.entry][b.type]||0)+1);
      let steps=0;
      while(game.spawnQueue.length&&steps++<500){
        Encounters.deploy(game,1);for(const e of game.enemies)counts[e.type]=(counts[e.type]||0)+1;game.enemies=[];
      }
      assert.equal(game.spawnQueue.length,0,game.level.id+' deployment finishes');
    }
    const normalize=o=>JSON.stringify(Object.entries(o).sort());
    assert.equal(normalize(counts),normalize(Encounters.roster(game.level).counts),game.level.id);
    perEntry.forEach((counts,id)=>assert.equal(normalize(counts),normalize(Encounters.roster(game.level,id).counts)));
    assert.equal(Encounters.roster(game.level).ambush,game.level.mission==='bus'?8:0);
  }
});

test('entry preferences produce majority armor, resistance and fast formations',()=>{
  const {Encounters,LEVELS,ENEMIES}=setup(),level=LEVELS[2],entries=Encounters.entrances(level);
  assert.equal(entries.length,3);assert.deepEqual(Array.from(entries,e=>e.profile),['magic','armor','fast']);
  const ratio=(id,predicate)=>{const r=Encounters.roster(level,id);return Object.entries(r.counts).reduce((n,[key,count])=>n+(predicate(ENEMIES[key])?count:0),0)/r.total;};
  assert.ok(ratio(0,e=>e.magicResist>=.3)>.65);assert.ok(ratio(1,e=>e.armor>=.25)>.65);assert.ok(ratio(2,e=>e.speed>=75)>.65);
  assert.ok(LEVELS.filter(l=>Encounters.entrances(l).length>1).length>=16);
});

test('independent entrances deploy simultaneously and a blocked lane does not stall another entrance',()=>{
  const {game,Enemy,Encounters,LEVELS}=setup();game.progress.stars.fill(3);game.startLevel(2);game.startWave(true);
  Encounters.deploy(game,.01);assert.equal(game.enemies.length,9);
  assert.equal(new Set(game.enemies.map(e=>`${e.path[0].x},${e.path[0].y}`)).size,3);
  game.startLevel(2);game.startWave(true);const blocker=new Enemy('armor',game.road.path(0),1,{lane:0,span:1});game.enemies=[blocker];
  Encounters.deploy(game,.01);assert.equal(game.spawnQueue.filter(b=>b.entry===0&&b.due===0).length,4);
  assert.ok(game.enemies.some(e=>e.path===game.road.path(1)));assert.ok(game.enemies.some(e=>e.path===game.road.path(2)));
});

test('ordinary formations occupy four distinct lanes; bosses reserve two without sharing slots',()=>{
  const {Encounters,LEVELS}=setup();
  for(const level of LEVELS)for(const row of Encounters.wave(level,level.waves)){
    const occupied=new Set();for(const member of row.members)for(let lane=member.lane;lane<member.lane+member.span;lane++){
      assert.ok(lane>=0&&lane<4);assert.ok(!occupied.has(lane));occupied.add(lane);
    }
    if(row.members.some(m=>m.span===2))assert.ok(level.boss);
  }
  const rows=Encounters.wave(LEVELS[0],1);assert.equal(rows[0].members.length,4);assert.ok(rows[1].due>=2.8);
  const fast=Encounters.wave(LEVELS[4],1);assert.ok(fast.some((row,i)=>i>0&&row.due-fast[i-1].due<1));
});

test('blocked cars queue only within their own lanes, while other lanes pass',()=>{
  const {game,Enemy,Lanes,CONFIG}=battle(),path=[{x:100,y:320},{x:1100,y:320}];
  const lead=new Enemy('armor',path,1,{lane:0,span:1}),rear=new Enemy('scout',path,1,{lane:0,span:1}),parallel=new Enemy('scout',path,1,{lane:3,span:1});
  lead.center.x=200;lead.stunTime=100;Lanes.sync(lead);game.enemies=[lead,rear,parallel];
  for(let n=0;n<300;n++)for(const e of game.enemies)e.update(1/60,game);
  assert.ok(parallel.center.x>lead.center.x+100);assert.ok(rear.center.x<lead.center.x);
  assert.ok(lead.center.x-rear.center.x>=(lead.bodyLength+rear.bodyLength)/2+CONFIG.trafficGap-.01);
  lead.lane=1;lead.laneSpan=2;assert.equal(Lanes.overlap(lead,{lane:2,laneSpan:1}),true);assert.equal(Lanes.overlap(lead,parallel),false);
});

test('same-lane cars leave a gap through a merge instead of overlapping',()=>{
  const {game,Enemy,Lanes,CONFIG,Collision}=battle();
  const a=[{x:100,y:220},{x:400,y:320},{x:1000,y:320}],b=[{x:100,y:420},{x:400,y:320},{x:1000,y:320}];
  const first=new Enemy('scout',a,1,{lane:1}),second=new Enemy('scout',b,1,{lane:1});game.enemies=[first,second];
  for(let n=0;n<900;n++){first.update(1/60,game);second.update(1/60,game);
    if(first.segment===1&&second.segment===1)assert.ok(Collision.distance(first,second)>=(first.bodyLength+second.bodyLength)/2+CONFIG.trafficGap-.1);
  }
  assert.equal(first.segment,1);assert.equal(second.segment,1);
});

test('lane positions remain inside every original and alternate road through corners',()=>{
  const {LEVELS,RoadNetwork,Lanes,CONFIG,Collision}=setup();
  for(const level of LEVELS){const road=new RoadNetwork(level,true);
    for(const path of road.routes)for(let segment=0;segment<path.length-1;segment++)for(const lane of [0,1,2,3])for(const t of [0,.25,.5,.75,1]){
      const a=path[segment],b=path[segment+1],center={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
      const p=Lanes.point(path,segment,center,Lanes.offset(lane));
      assert.ok(road.edges.some(([x,y])=>Collision.segmentDistance(p,x,y)<=CONFIG.roadWidth/2+.01),level.id+' lane '+lane);
    }
  }
});

test('split reinforcements keep their lane and are separated from the existing convoy',()=>{
  const {game,Enemy,Lanes,Collision,CONFIG}=battle(),path=[{x:100,y:300},{x:1100,y:300}];
  const parent=new Enemy('splitter',path,1,{lane:2}),trailer=new Enemy('armor',path,1,{lane:2});parent.center.x=400;trailer.center.x=350;Lanes.sync(parent);Lanes.sync(trailer);
  game.enemies=[parent,trailer];parent.hit(9999,game);const living=game.enemies.filter(e=>!e.dead);
  assert.equal(living.length,4);assert.ok(living.every(e=>e.lane===2&&e.path===path));
  for(let i=0;i<living.length;i++)for(const other of living.slice(i+1))assert.ok(Collision.distance(living[i],other)>=(living[i].bodyLength+other.bodyLength)/2+CONFIG.trafficGap-.01);
});

test('widened bridge detects outer lanes and route changes preserve lane assignments',()=>{
  const {game,Enemy,Lanes,Traffic}=battle();game.progress.stars.fill(3);game.startLevel(3);
  const path=game.road.path(0),span=game.traffic.bridge,enemy=new Enemy('demolisher',path,1,{lane:3});
  enemy.segment=span.segment;enemy.center={x:span.x,y:span.y};Lanes.sync(enemy);game.enemies=[enemy];
  assert.ok(Traffic.bridgeAt(game,enemy));Traffic.update(game,.5);assert.ok(game.traffic.integrity<100);
  const waiting=new Enemy('armor',path,1,{lane:0});waiting.center.x+=15;Lanes.sync(waiting);game.enemies=[waiting];game.wave=game.level.routeEvent.wave;game.applyRouteEvent();
  assert.equal(waiting.lane,0);assert.equal(waiting.path,game.road.path(0));assert.ok(Number.isFinite(waiting.x));
});
