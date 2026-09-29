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
  const api = vm.runInContext(source + '\n({game, Game, Enemy, Tower, Projectile, Renderer, Progress, LEVELS, CHAPTERS, TOWERS, ENEMIES, CONFIG, Collision, RoadNetwork, applyHit, planConstructionSites, Soldier, Sound, SoundEngine, EVOLUTIONS, evolutionRequirement, MUSIC_TRACKS, ROAD_LAYOUTS})', sandbox);
  return { ...api, sandbox, stored: () => stored };
}
function battle() { const api = setup(); api.game.startLevel(0); return api; }

test('new campaign locks later levels and requires a site before building', () => {
  const { game } = setup();
  assert.equal(game.startLevel(1), false);
  game.startLevel(0); game.selectBuild('missile');
  assert.equal(game.towers.length, 0); assert.equal(game.selectedSite, null);
});
test('road, map boundary and overlapping towers reject construction', () => {
  const { game } = battle();
  assert.equal(game.canBuild({ x: 100, y: 390 }), false);
  assert.equal(game.canBuild({ x: 20, y: 200 }), false);
  game.click({ x: 180, y: 340 }); game.selectBuild('rail');
  assert.equal(game.towers.length, 1); assert.equal(game.gold, 270);
  assert.equal(game.canBuild({ x: 200, y: 300 }), false);
  game.gold = 0; game.click({ x: 180, y: 480 });
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
  const { game } = battle(); game.click({ x: 180, y: 340 }); game.selectBuild('rail'); game.selected = game.towers[0];
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
          game.selectBuild(['rail','signal','missile','depot','rail','signal'][index]);
        } else {
          const tower = game.towers.find(t => t.level < 4 && (t.level!==2 || [0,1].some(b=>game.branchUnlocked(t.type,t.theme,b))));
          if (tower) { game.selected = tower; game.upgrade(tower.level === 2 ? ([0,1].find(b=>game.branchUnlocked(tower.type,tower.theme,b))) : null); }
          else if (game.towers.length < placements.length) {
            game.click(placements[game.towers.length]); game.selectBuild(game.loadout[game.towers.length%4]);
          }
        }
        for(const tower of game.towers) tower.targetMode=tower.type==='signal'?1:0;
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
  assert.equal(game.selectBuild('rail'), false);
  game.click({ x: 400, y: 340 }); assert.equal(game.selectedSite, null); assert.equal(game.towers.length, 0);
  const site = game.sites[0]; game.click(site);
  assert.equal(game.selectedSite, site); assert.equal(game.gold, 350);
  assert.equal(game.selectBuild('rail'), true); assert.equal(game.gold, 270);
  assert.equal(game.canBuild(site), false); assert.equal(game.selectedSite, null);
  game.sell(); assert.equal(game.canBuild(site), true);
  game.click(site); assert.equal(game.selectBuild('signal'), true);
  assert.equal(game.towers[0].siteId, site.id);
});
test('dense construction sites stay close to roads, clear of lanes and other sites, and stable on retry', () => {
  const { LEVELS, RoadNetwork, Collision, CONFIG, planConstructionSites } = setup();
  for (const level of LEVELS) {
    const road = new RoadNetwork(level, true);
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
test('four core towers are always available and legacy stars survive migration', () => {
  const {game,Progress}=setup(JSON.stringify({schema:2,stars:[3,2,0],decks:[['laser']],legacyTowers:['tesla']}));
  assert.equal(game.unlocked,2); assert.equal(game.progress.schema,3);
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
  const { game, Renderer } = battle(); game.click(game.sites[0]); Renderer.draw(game);
  const popup = game.buildPopupRect; assert.ok(popup);
  game.click({x:popup.x+65,y:popup.y+70});
  assert.equal(game.towers.length,1); assert.equal(game.gold,270);
  game.click({x:popup.x+65,y:popup.y+70}); assert.equal(game.towers.length,1);
});

test('map tower popup handles upgrade, specialization, targeting and selling without sidebar actions', () => {
  const { game, Renderer } = battle(); game.progress.stars.fill(3);
  const site=game.sites[0]; game.click(site); game.selectBuild('rail');
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
  assert.equal(tower.branch,1); assert.equal(tower.level,3); assert.equal(game.gold,70);
  const specialized=game.towerPopupRect;
  game.click({x:specialized.x+130,y:specialized.y+120}); assert.equal(tower.level,3); // 金币不足
  game.click({x:specialized.x+70,y:specialized.y+specialized.h-30}); assert.equal(tower.targetMode,1);
  game.click({x:specialized.x+200,y:specialized.y+specialized.h-30});
  assert.equal(game.towers.length,0); assert.equal(game.gold,70+Math.floor(280*.7));
  Renderer.draw(game); assert.equal(game.towerPopupRect,null); assert.equal(game.canBuild(site),true);
});

test('tower menus stay fully inside the map at every site and tower level', () => {
  const { game, Renderer, LEVELS, Tower }=setup(JSON.stringify({stars:Array(48).fill(3)}));
  for(let index=0;index<LEVELS.length;index++) {
    game.startLevel(index);
    for(const site of game.sites) for(const level of [1,2,3,4]) {
      game.selected=new Tower('rail',site.x,site.y); game.selected.level=level; game.selected.branch=level>2?0:null;
      Renderer.towerPopup(game);
      const r=game.towerPopupRect;
      assert.ok(r.x>=24&&r.y>=112&&r.x+r.w<=924&&r.y+r.h<=686,`${index} site ${site.id}`);
    }
  }
});

test('chapter previews remain locked and crossing a chapter opens the correct next map', () => {
  const { game, Renderer, LEVELS, CHAPTERS }=setup(JSON.stringify({stars:[3,2,1,3,3,3,3,0],decks:[['rail','slow']]}));
  assert.equal(CHAPTERS.length,6); assert.equal(LEVELS.length,48);
  assert.equal(game.progress.stars.length,48);
  assert.deepEqual(Array.from(game.progress.stars.slice(0,4)),[3,2,1,3]);
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
  assert.ok(game.earnedEvolutions.includes('狙击塔'));const count=game.completed;
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
  game.selected=t;Renderer.draw(game);const r=game.towerPopupRect;
  game.click({x:r.x+70,y:r.y+r.h-30});assert.equal(game.rallyTower,t);
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
  const {LEVELS,RoadNetwork,CONFIG}=setup();
  for(let chapter=0;chapter<6;chapter++) {
    const levels=LEVELS.filter(l=>l.chapter===chapter);
    const signatures=levels.map(l=>[l.routes.length,...l.routes.map(r=>r.length)].join(','));
    assert.ok(new Set(signatures).size>=5, `chapter ${chapter} needs different structures`);
    for(const level of levels) {
      const network=new RoadNetwork(level,true);
      for(const route of network.routes)for(let i=1;i<route.length;i++){
        assert.ok(route[i].x>=52&&route[i].x<=894&&route[i].y>=185&&route[i].y<=630);
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
