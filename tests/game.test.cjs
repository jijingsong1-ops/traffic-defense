// 无第三方依赖：node --test tests/game.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
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
  const api = vm.runInContext(source + '\n({game, Game, Enemy, Tower, Projectile, Renderer, Progress, LEVELS, CHAPTERS, TOWERS, ENEMIES, CONFIG, Collision, RoadNetwork, applyHit, planConstructionSites})', sandbox);
  return { ...api, stored: () => stored };
}
function battle() { const api = setup(); api.game.startLevel(0); return api; }

test('new campaign locks later levels and advanced towers', () => {
  const { game } = setup();
  assert.equal(game.startLevel(1), false);
  game.startLevel(0); game.selectBuild('cannon');
  assert.equal(game.towers.length, 0); assert.equal(game.selectedSite, null);
});
test('road, map boundary and overlapping towers reject construction', () => {
  const { game } = battle();
  assert.equal(game.canBuild({ x: 100, y: 390 }), false);
  assert.equal(game.canBuild({ x: 20, y: 200 }), false);
  game.click({ x: 180, y: 340 }); game.selectBuild('arrow');
  assert.equal(game.towers.length, 1); assert.equal(game.gold, 270);
  assert.equal(game.canBuild({ x: 200, y: 300 }), false);
  game.gold = 0; game.click({ x: 180, y: 480 });
  assert.equal(game.towers.length, 1);
});
test('all twenty-eight specialization paths charge correctly and are mutually exclusive', () => {
  const { game, Tower, TOWERS } = battle();
  for (const type of Object.keys(TOWERS)) for (const branch of [0, 1]) {
    const tower = new Tower(type, 180, 300);
    game.towers = [tower]; game.selected = tower; game.gold = 1000;
    assert.equal(game.upgrade(branch), false);
    const basicCost = tower.upgradeCost;
    assert.equal(game.upgrade(), true);
    assert.equal(game.upgrade(), false);
    assert.equal(game.upgrade(branch), true);
    assert.equal(tower.branch, branch);
    assert.equal(game.gold, 1000 - basicCost - TOWERS[type].paths[branch].cost);
    assert.equal(game.upgrade(1 - branch), false);
    assert.equal(game.upgrade(), true);
    assert.equal(tower.level, 4); assert.equal(game.upgrade(), false);
  }
});
test('unaffordable upgrades leave level and economy unchanged; sell refunds investment', () => {
  const { game } = battle(); game.click({ x: 180, y: 340 }); game.selectBuild('arrow'); game.selected = game.towers[0];
  game.gold = 0; assert.equal(game.upgrade(), false); assert.equal(game.selected.level, 1);
  game.sell(); assert.equal(game.gold, 56); assert.equal(game.towers.length, 0);
});
test('armor, shield overflow and enhanced shield damage resolve correctly', () => {
  const { game, Enemy } = battle(), route = game.road.path(0);
  const armor = new Enemy('armor', route); armor.hit(100, game); assert.equal(armor.health, 85);
  armor.hit(50, game, { pierce: true }); assert.equal(armor.health, 35);
  const shield = new Enemy('shield', route); shield.hit(40, game, { shieldMultiplier: 2.5 });
  assert.equal(shield.shield, 0); assert.equal(shield.health, 81);
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
  assert.equal(children.length, 3); assert.equal(children[0].segment, 1);
  assert.equal(children[0].path, enemy.path); assert.equal(children[0].x, 210); assert.equal(game.gold, gold);
});
test('control respects boss resistance and burn deals ongoing damage', () => {
  const { game, Enemy, applyHit } = battle(); const boss = new Enemy('boss', game.road.path(0));
  boss.slow(0.5, 2); assert.equal(boss.slowFactor, 0.8);
  boss.stun(3); assert.ok(Math.abs(boss.stunTime - 1.2) < 1e-8);
  applyHit(boss, 0, { burn: 16, duration: 3 }, game);
  boss.update(0.1, game); assert.ok(Math.abs(boss.health - 948.4) < 1e-8);
});
test('cannon splash, multi-shot, chaining and laser focus have distinct effects', () => {
  const { game, Enemy, Tower, Projectile } = battle(); const route = game.road.path(0);
  const a = new Enemy('armor', route), b = new Enemy('armor', route); game.enemies = [a, b];
  const cannon = new Tower('cannon', a.x, a.y); new Projectile(cannon, a, cannon.stats).update(0.1, game);
  assert.ok(a.health < a.maxHealth && b.health < b.maxHealth);
  const arrow = new Tower('arrow', a.x, a.y); arrow.level = 3; arrow.branch = 1; arrow.update(0.1, game);
  assert.equal(game.projectiles.length, 2);
  const tesla = new Tower('tesla', a.x, a.y); tesla.update(0.1, game); assert.equal(game.beams.length, 2);
  const laser = new Tower('laser', a.x, a.y); laser.level = 3; laser.branch = 0;
  const target = new Enemy('boss', route); game.enemies = [target];
  laser.update(0.1, game); const firstDamage = target.maxHealth - target.health;
  laser.cooldown = 0; laser.update(0.1, game);
  assert.ok(target.maxHealth - target.health > firstDamage * 2);
});
test('target priority can focus healer instead of nearer exit', () => {
  const { game, Enemy, Tower } = battle();
  const healer = new Enemy('healer', game.road.path(0)), scout = new Enemy('scout', game.road.path(0));
  scout.x += 40; game.enemies = [scout, healer];
  const tower = new Tower('arrow', 100, 340); tower.targetMode = 2; tower.update(0.1, game);
  assert.equal(game.projectiles[0].target, healer);
});
test('skills require enemies, pause prevents casting and cooldown prevents reuse', () => {
  const { game, Enemy } = battle(); game.selectSkill('strike'); game.cast({ x: 300, y: 300 });
  assert.equal(game.skillCooldowns.strike, 0);
  const enemy = new Enemy('armor', game.road.path(0)); game.enemies = [enemy];
  game.paused = true; game.cast(enemy); assert.equal(enemy.health, enemy.maxHealth);
  game.paused = false; game.cast(enemy); assert.ok(enemy.dead);
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
  assert.equal(JSON.parse(stored()).stars[0], 3); assert.equal(Progress.load().stars[0], 3);
  game.startLevel(0); game.lives = 1; game.finish(true); assert.equal(game.progress.stars[0], 3);
  game.startLevel(1); assert.equal(game.gold, 378); assert.equal(game.towers.length, 0); assert.equal(game.lives, 20);
});
test('defeat never unlocks or saves and replay preserves earlier progress', () => {
  const { game, Enemy } = battle(); game.startWave(); game.spawnQueue = []; game.lives = 1;
  const enemy = new Enemy('boss', game.road.path(0)); enemy.segment = enemy.path.length - 2; enemy.x = 893.99; enemy.y = 390;
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
  for (const modal of ['intel', 'restart', 'leave', 'loadout', 'records']) { game.modal = modal; Renderer.draw(game); }
  game.modal = null; game.finish(true); Renderer.draw(game);
});

test('opening stage and all chapter finales are winnable with legal spending and timed waves', () => {
  const { game, LEVELS, Collision } = setup();
  for (const stage of (process.env.TD_TEST_STAGES?.split(',').map(Number)||[0,7,15,23,31,39,47])) {
    game.progress.stars=LEVELS.map((_,i)=>i<stage?3:0);
    assert.equal(game.startLevel(stage), true);
    // 按道路覆盖选择真实地块，避免测试依赖某一版地图的手写坐标。
    const samples = game.road.routes.flatMap(route => route.slice(1).flatMap((b,i) => {
      const a = route[i], steps = Math.ceil(Collision.distance(a,b)/20), total=route.slice(1).reduce((sum,p,j)=>sum+Collision.distance(route[j],p),0);
      return Array.from({length:steps},(_,step)=>({x:a.x+(b.x-a.x)*(step+.5)/steps,y:a.y+(b.y-a.y)*(step+.5)/steps,weight:1000/total}));
    }));
    const placements = [], coverage=samples.map(()=>0);
    for (let n=0;n<16;n++) {
      const score = site => samples.reduce((total,p,i)=>total+(Collision.distance(site,p)<140 ? p.weight/(1+coverage[i]) : 0),0);
      const candidates=game.sites.filter(site=>!placements.includes(site)).map(site=>({site,score:score(site)}));
      const chosen=candidates.sort((a,b)=>b.score-a.score)[0].site;
      placements.push(chosen); samples.forEach((p,i)=>{if(Collision.distance(chosen,p)<140)coverage[i]++;});
    }
    let ticks = 0;
    while (game.screen === 'battle' && ticks < 60000) {
      if (ticks % 30 === 0) {
        if (game.towers.length < (stage>=32?4:6)) {
          const index = game.towers.length;
          game.click(placements[index]);
          game.selectBuild(stage>=32 ? (index<2?game.loadout[2]:index===2?'slow':'arrow') : index===5?'slow':'arrow');
        } else {
          const tower = game.towers.find(t => t.level < 4);
          if (tower) { game.selected = tower; game.upgrade(tower.level === 2 ? (tower.type==='slow'?1:0) : null); }
          else if (game.towers.length < placements.length) {
            game.click(placements[game.towers.length]); game.selectBuild(game.loadout[2] || 'arrow');
          }
        }
        for(const tower of game.towers) tower.targetMode=tower.type==='laser'?1:0;
        if(game.towers[1])game.towers[1].targetMode=2;
        for (const type of ['strike', 'freeze']) {
          if (!game.skillCooldowns[type] && game.enemies.length) {
            const target = game.enemies.find(e => e.spec.boss) || game.enemies[Math.floor(game.enemies.length / 2)];
            if (game.enemies.length >= 3 || target.spec.boss) { game.selectSkill(type); game.cast(target); }
          }
        }
        if (game.state === 'prepare') game.startWave();
      }
      game.update(1 / 60); ticks++;
      assert.ok(game.gold >= 0, 'no overspending');
    }
    assert.equal(game.won, true, `stage ${stage + 1} (${LEVELS[stage].name}), wave ${game.wave}, towers ${game.towers.length}, gold ${game.gold}`);
    assert.ok(game.progress.stars[stage] > 0);
  }
});

test('building is a two-step site-first operation and selling frees the same site', () => {
  const { game } = battle();
  assert.equal(game.selectBuild('arrow'), false);
  game.click({ x: 400, y: 340 }); assert.equal(game.selectedSite, null); assert.equal(game.towers.length, 0);
  const site = game.sites[0]; game.click(site);
  assert.equal(game.selectedSite, site); assert.equal(game.gold, 350);
  assert.equal(game.selectBuild('arrow'), true); assert.equal(game.gold, 270);
  assert.equal(game.canBuild(site), false); assert.equal(game.selectedSite, null);
  game.sell(); assert.equal(game.canBuild(site), true);
  game.click(site); assert.equal(game.selectBuild('slow'), true);
  assert.equal(game.towers[0].siteId, site.id);
});
test('dense construction sites stay close to roads, clear of lanes and other sites, and stable on retry', () => {
  const { LEVELS, RoadNetwork, Collision, CONFIG, planConstructionSites } = setup();
  for (const level of LEVELS) {
    const road = new RoadNetwork(level);
    const sites = level.sites.map(([x,y]) => ({x,y}));
    assert.ok(sites.length >= 28, `${level.name} has only ${sites.length} sites`);
    assert.deepEqual(planConstructionSites(level),level.sites);
    for (const [i,site] of sites.entries()) {
      assert.equal(road.isRoad(site, CONFIG.towerRadius + 4), false, `${level.name} site ${i+1} overlaps road`);
      assert.ok(site.x >= 50 && site.x <= 896 && site.y >= 188 && site.y <= 652);
      assert.ok(Math.min(...road.edges.map(([a,b])=>Collision.segmentDistance(site,a,b))) <= CONFIG.siteRoadOffset+1);
      for (const other of sites.slice(i+1)) assert.ok(Collision.distance(site,other) >= CONFIG.spacing);
    }
  }
});
test('loadouts cap at four types, preserve per-level choices, and freeze on battle entry', () => {
  const { game, Progress } = setup(JSON.stringify({stars:[3,3,3,0]}));
  game.menuLevel = 3; game.progress.decks[3]=["arrow","slow","cannon","laser"];
  assert.equal(game.getDeck(3).length, 4);
  assert.equal(game.toggleDeck('tesla'), false);
  assert.equal(game.toggleDeck('cannon'), true); assert.equal(game.toggleDeck('tesla'), true);
  assert.equal(game.getDeck(3).includes('cannon'), false);
  assert.equal(game.getDeck(3).includes('tesla'), true);
  assert.equal(Progress.load().decks[3].includes('tesla'), true);
  assert.equal(game.getDeck(2).includes('cannon'), true);
  game.startLevel(3); game.click(game.sites[0]);
  assert.equal(game.selectBuild('cannon'), false);
  assert.equal(game.toggleDeck('cannon'), false);
  assert.equal(game.selectBuild('tesla'), true);
});
test('empty loadouts cannot start and legacy saves migrate without losing stars', () => {
  const { game } = setup(JSON.stringify({stars:[3,2,0,0]}));
  assert.equal(game.unlocked, 2); game.menuLevel = 0;
  for (const type of [...game.getDeck(0)]) game.toggleDeck(type);
  assert.equal(game.startLevel(0), false); assert.equal(game.screen, 'menu');
  game.recommendDeck(); assert.equal(game.startLevel(0), true);
  assert.equal(game.progress.stars[1], 2);
});
test('boss spawns only in marked stages and only in the final wave', () => {
  const { game, LEVELS } = setup(JSON.stringify({stars:Array(48).fill(3)}));
  LEVELS.forEach((level,index) => {
    game.startLevel(index);
    for(let wave=1;wave<=level.waves;wave++) assert.equal(game.wavePlan(wave).includes(level.bossType),level.boss && wave===level.waves);
  });
});
test('build popup registers only carried tower choices and prevents double purchase', () => {
  const { game, Renderer } = battle(); game.click(game.sites[0]); Renderer.draw(game);
  const popup = game.buildPopupRect; assert.ok(popup);
  game.click({x:popup.x+65,y:popup.y+70});
  assert.equal(game.towers.length,1); assert.equal(game.gold,270);
  game.click({x:popup.x+65,y:popup.y+70}); assert.equal(game.towers.length,1);
});

test('map tower popup handles upgrade, specialization, targeting and selling without sidebar actions', () => {
  const { game, Renderer } = battle();
  const site=game.sites[0]; game.click(site); game.selectBuild('arrow');
  game.cancel(); Renderer.draw(game); game.click(site); Renderer.draw(game);
  const tower=game.selected, popup=game.towerPopupRect;
  assert.equal(tower,game.towers[0]); assert.ok(popup);
  assert.equal(game.buttons.some(b=>b.x>=948&&b.y>=452&&b.y<690),false);
  game.click({x:popup.x+130,y:popup.y+120}); Renderer.draw(game);
  assert.equal(tower.level,2); assert.equal(game.gold,210);
  const branches=game.towerPopupRect;
  // 点击菜单文字不会穿透到下面的设备地块。
  game.click({x:branches.x+15,y:branches.y+78}); assert.equal(game.selected,tower);
  game.click({x:branches.x+110,y:branches.y+180}); Renderer.draw(game);
  assert.equal(tower.branch,1); assert.equal(tower.level,3); assert.equal(game.gold,95);
  const specialized=game.towerPopupRect;
  game.click({x:specialized.x+130,y:specialized.y+120}); assert.equal(tower.level,3); // 金币不足
  game.click({x:specialized.x+70,y:specialized.y+specialized.h-30}); assert.equal(tower.targetMode,1);
  game.click({x:specialized.x+200,y:specialized.y+specialized.h-30});
  assert.equal(game.towers.length,0); assert.equal(game.gold,95+Math.floor(255*.7));
  Renderer.draw(game); assert.equal(game.towerPopupRect,null); assert.equal(game.canBuild(site),true);
});

test('tower menus stay fully inside the map at every site and tower level', () => {
  const { game, Renderer, LEVELS, Tower }=setup(JSON.stringify({stars:Array(48).fill(3)}));
  for(let index=0;index<LEVELS.length;index++) {
    game.startLevel(index);
    for(const site of game.sites) for(const level of [1,2,3,4]) {
      game.selected=new Tower('arrow',site.x,site.y); game.selected.level=level; game.selected.branch=level>2?0:null;
      Renderer.towerPopup(game);
      const r=game.towerPopupRect;
      assert.ok(r.x>=24&&r.y>=112&&r.x+r.w<=924&&r.y+r.h<=686,`${index} site ${site.id}`);
    }
  }
});

test('chapter previews remain locked and crossing a chapter opens the correct next map', () => {
  const { game, Renderer, LEVELS, CHAPTERS }=setup(JSON.stringify({stars:[3,2,1,3,3,3,3,0],decks:[['arrow','slow']]}));
  assert.equal(CHAPTERS.length,6); assert.equal(LEVELS.length,48);
  assert.equal(game.progress.stars.length,48); assert.equal(game.progress.decks.length,48);
  assert.deepEqual(Array.from(game.progress.stars.slice(0,4)),[3,2,1,3]);
  assert.deepEqual(Array.from(game.progress.decks[0]),['arrow','slow']);
  game.selectChapter(2); assert.equal(game.menuChapter,2); assert.equal(game.menuLevel,16);
  assert.equal(game.startLevel(16),false);
  Renderer.draw(game); game.modal='records'; Renderer.draw(game); game.modal=null;
  game.startLevel(7); game.finish(true); Renderer.draw(game);
  game.click({x:640,y:494});
  assert.equal(game.screen,'menu'); assert.equal(game.menuChapter,1); assert.equal(game.menuLevel,8);
  assert.equal(game.unlocked,8); assert.equal(game.startLevel(8),true); assert.equal(game.startLevel(9),false);
});

test('timed waves overlap living enemies and preserve earlier queued enemy scaling', () => {
  const {game,Enemy,CONFIG,ENEMIES}=battle();
  game.startWave();
  const sentinel=new Enemy('boss',game.road.path(0));sentinel.stunTime=999;sentinel.health=1e9;
  game.enemies.push(sentinel); game.spawnTimer=9;
  const queued=game.spawnQueue.length; game.prepareTime=.01; const gold=game.gold;
  game.update(.02);
  assert.equal(game.wave,2); assert.ok(game.enemies.includes(sentinel));
  assert.ok(game.spawnQueue.length>queued); assert.equal(game.gold,gold+CONFIG.waveReward);
  assert.equal(game.spawnQueue[0].wave,1);
  game.spawnTimer=0;game.update(.01);
  assert.equal(game.enemies[1].maxHealth,ENEMIES[game.enemies[1].type].hp*game.level.scale);
  const seconds=game.prepareTime;game.paused=true;game.update(10);assert.equal(game.prepareTime,seconds);
  game.paused=false;game.modal='intel';game.update(10);assert.equal(game.prepareTime,seconds);game.modal=null;
  while(game.wave<game.level.waves)game.startWave();
  const finalGold=game.gold;assert.equal(game.startWave(),false);assert.equal(game.gold,finalGold);
  game.spawnQueue=[];game.update(.01);assert.equal(game.screen,'battle');
  sentinel.dead=true;game.enemies.forEach(e=>e.dead=true);game.update(.01);
  assert.equal(game.won,true);assert.equal(game.wave,game.level.waves);
});

test('clearing a wave early does not reset the countdown or start the next wave early', () => {
  const {game}=battle();game.startWave();game.spawnQueue=[];game.enemies=[];game.prepareTime=5;
  game.update(1);assert.equal(game.wave,1);assert.equal(game.prepareTime,4);assert.equal(game.screen,'battle');
});

test('new saves unlock exactly one new tower per four unique clears, including the final reward', () => {
  const {game,TOWERS,LEVELS,Progress}=setup();
  assert.equal(game.towerUnlocked('cannon'),false);
  const milestones=Object.values(TOWERS).filter(t=>t.unlock>0).map(t=>t.unlock);
  assert.deepEqual(Array.from(milestones),Array.from({length:12},(_,i)=>(i+1)*4));
  for(let count=1;count<=48;count++) {
    game.progress.stars[count-1]=1;
    assert.equal(Object.keys(TOWERS).filter(type=>game.towerUnlocked(type)).length,2+Math.floor(count/4));
  }
  assert.equal(game.towerUnlocked('solar'),true);
  Progress.save(game.progress);assert.equal(Progress.load().schema,2);
  assert.equal(game.progress.stars.length,LEVELS.length);
  const old=setup(JSON.stringify({stars:[3,3,3,0],decks:[['laser']]}));
  assert.equal(old.game.towerUnlocked('laser'),true);assert.deepEqual(Array.from(old.game.getDeck(0)),['laser']);
  assert.equal(setup(JSON.stringify({stars:[]})).game.towerUnlocked('cannon'),false);
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
      assert.ok(level.waveInterval>=20&&level.waveInterval<=32);
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
    for(const modal of ['records','intel']){game.modal=modal;game.intelChapter=chapter;Renderer.draw(game);}
  }
  game.modal='loadout';
  for(let page=0;page<3;page++) {
    game.towerPage=page;Renderer.draw(game);
    for(const b of game.buttons)assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=1280&&b.y+b.h<=820);
  }
});
