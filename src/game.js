"use strict";

// Game 负责流程与交互；渲染器只绘制状态并登记可见按钮。
class Game {
  constructor() {
    this.activeSlot = Progress.read().activeSlot;
    this.progress = Progress.load(this.activeSlot); this.hasSave = Progress.exists();
    this.screen = Platform.touch ? "home" : "menu"; this.modal = null; this.buttons = [];
    this.pointer = { x: -100, y: -100 }; this.levelIndex = 0; this.menuLevel = this.unlocked;
    this.menuChapter = LEVELS[this.menuLevel].chapter;
    this.message = "完成关卡，解锁防御塔进化研究。"; this.messageTime = 0; this.saveFailed = false;
    this.lastTime = null; this.accumulator = 0;
    Platform.bindInput(this, canvas);
    requestAnimationFrame(time => this.frame(time));
  }
  get unlocked() { return Progress.unlocked(this.progress); }
  get completed() { return this.progress.stars.filter(value=>value>0).length; }
  newCampaign(confirmed = false) {
    if (!confirmed) { this.saveMode="new"; this.modal="saveSlots"; this.buttons=[]; return; }
    if (!Number.isInteger(this.pendingSlot)||this.pendingSlot<0||this.pendingSlot>=3)return false;
    this.activeSlot=this.pendingSlot;this.pendingSlot=null;
    this.progress = Progress.blank(); this.saveFailed = !Progress.save(this.progress,this.activeSlot,true);
    this.hasSave = !this.saveFailed; this.menuLevel = 0; this.menuChapter = 0;
    this.screen = "menu"; this.modal = null; this.buttons = []; this.cancel();
    if(this.saveFailed)this.notify("保存失败，本次进度暂留在游戏内。");
  }
  chooseSaveSlot(slotId) {
    if(!Number.isInteger(slotId)||slotId<0||slotId>=3||this.modal!=="saveSlots")return false;
    if(this.saveMode==="load")return this.loadCampaign(slotId);
    this.pendingSlot=slotId;
    if(Progress.list()[slotId]){this.modal="newCampaign";this.buttons=[];return;}
    this.newCampaign(true);
  }
  loadCampaign(slotId) {
    if(slotId===undefined){this.saveMode="load";this.modal="saveSlots";this.buttons=[];return;}
    if(!Number.isInteger(slotId)||slotId<0||slotId>=3||!Progress.list()[slotId])return false;
    this.activeSlot=slotId;this.progress=Progress.load(slotId);this.saveFailed=!Progress.select(slotId);
    this.hasSave = true; this.menuLevel = this.unlocked;
    this.menuChapter = LEVELS[this.menuLevel].chapter; this.screen = "menu"; this.modal = null; this.buttons = []; this.cancel();
    return true;
  }
  openLevel(index) {
    if (this.screen !== "menu" || !Number.isInteger(index) || !LEVELS[index]) return;
    this.menuLevel = index; this.modal = "level"; this.buttons = [];
  }
  towerUnlocked(type) { return Object.prototype.hasOwnProperty.call(TOWERS,type); }
  selectChapter(index) {
    if (this.screen !== "menu" || !Number.isInteger(index) || !CHAPTERS[index]) return;
    this.menuChapter = index;
    const first = LEVELS.findIndex(level => level.chapter === index);
    this.menuLevel = Math.max(first, Math.min(first + CONFIG.levelsPerChapter - 1, this.unlocked));
    this.messageTime = 0;
  }
  getDeck() { return [...TOWER_ORDER]; }
  branchUnlocked(type,theme,branch) { return this.completed>=evolutionRequirement(type,theme,branch); }
  setRally(p) {
    const t=this.rallyTower;
    if(!t||!this.towers.includes(t))return false;
    const point=this.buildRoad.nearestPoint(p);
    if(Collision.distance(p,point)>30||Collision.distance(t,point)>t.stats.rallyRange){this.notify("集合点必须在勤务站范围内的道路上。");return false;}
    t.rally=point;t.soldiers.forEach(s=>s.release());this.rallyTower=null;this.selected=t;
    Sound.play("build");this.notify("队员正在前往新的集合点。");return true;
  }
  toCanvas(e) {
    return Platform.toCanvas(e, canvas);
  }
  notify(message) { this.message = message; this.messageTime = 4; }
  cancel() { this.rallyTower = null; this.selectedSite = null; this.skill = null; this.selected = null; this.inspected = null;if(this.traffic)this.traffic.routeMenu=false; }
  startLevel(index) {
    if (!Number.isInteger(index) || index < 0 || index > this.unlocked || index >= LEVELS.length) return false;
    const deck = this.getDeck(index);
    if (!deck.length) { this.notify("请先为本关选择至少一种防御塔。"); return false; }
    this.levelIndex = index; this.level = LEVELS[index]; this.road = new RoadNetwork(this.level);
    this.buildRoad = new RoadNetwork(this.level, true);
    this.routeChanged = false; this.previousRoad = null; this.routeFlash = 0;
    this.eventRoad = this.level.routeEvent ? new RoadNetwork({routes:this.level.routeEvent.routes}) : null;
    this.menuLevel = index; this.menuChapter = this.level.chapter; this.loadout = [...deck];
    this.sites = this.level.sites.map(([x, y], id) => ({ x, y, id }));
    this.screen = "battle"; this.modal = null; this.state = "prepare"; this.buttons = []; this.won = false;
    this.lives = CONFIG.lives; this.gold = this.level.gold; this.wave = 0; this.kills = 0;
    this.towers = []; this.enemies = []; this.projectiles = []; this.effects = []; this.floats = []; this.beams = [];
    this.spawnQueue = []; this.spawnTimer = 0; this.spawnIndex = 0;
    this.prepareTime = CONFIG.firstPreparation; this.waveDuration = CONFIG.firstPreparation;
    this.waveGap = CONFIG.waveGapMin; this.lastEarlyReward = 0;
    this.paused = false; this.speed = 1;
    this.skillCooldowns = { strike: 0, freeze: 0 };
    Traffic.init(this);
    this.cancel(); this.accumulator = 0;
    this.notify(Platform.touch?"轻触路边预留空地建塔，轻触炮台升级；顶部按钮暂停部署。":"点击道路旁的预留空地，再选择建造塔型。悬停显示金色边线，空格可暂停部署。");
    if(this.level.routeEvent)this.notify(`第 ${this.level.routeEvent.wave} 波：${this.level.routeEvent.name}。虚线路段将启用，请预留火力。`);
    return true;
  }
  wavePlan(number) {
    const pool = this.level.pool, available = pool.slice(0, Math.min(pool.length, number + 1));
    const count = 7 + CONFIG.extraWaveEnemies + number * 2 + (this.level.enemyExtra ?? this.levelIndex * 2);
    // 支援单位较少，避免治疗链覆盖整支车队；普通单位、分裂单位、支援单位权重为3:2:1。
    const weighted=available.flatMap(type=>Array(ENEMIES[type].heal?1:ENEMIES[type].split?2:3).fill(type));
    const result = Array.from({ length: count }, (_, i) => weighted[(i + number - 1) % weighted.length]);
    // 破拆车从正常入口加入车队，较早出场，让桥前部署和冻结真正有用。
    if(this.level.mission==="bridge"&&number%2===0)result.splice(2,0,"demolisher");
    if(this.level.mission==="bridge"&&number>=6&&number%2===0)result.splice(7,0,"demolisher");
    if (this.level.boss && number === this.level.waves) result.push(this.level.bossType);
    return result;
  }
  gapAfterWave(count) {
    return Math.min(CONFIG.waveGapMax,CONFIG.waveGapMin+Math.max(0,count-10)*CONFIG.waveGapPerEnemy);
  }
  get earlyWaveReward() {
    if(!this.canStartWave())return 0;
    return Math.min(CONFIG.earlyGoldMax,Math.ceil(Math.max(0,this.prepareTime)*CONFIG.earlyGoldPerSecond));
  }
  canStartWave() {
    if (this.screen !== "battle" || this.modal || this.paused || this.wave >= this.level.waves) return false;
    return this.spawnQueue.length===0;
  }
  startWave(automatic = false) {
    if (!this.canStartWave()) return false;
    const reward=automatic?0:this.earlyWaveReward;
    Sound.play("wave");
    this.wave++; this.state="wave";
    const shifted = this.applyRouteEvent();
    Traffic.onWave(this);
    // 每一批保存自己的生命倍率；跨波排队时不会被下一波的倍率覆盖。
    const scale=this.level.scale*CONFIG.enemyGrowth**(this.wave-1);
    const plan=this.wavePlan(this.wave);
    this.spawnQueue.push(...plan.map(type=>({type,scale,wave:this.wave})));
    this.spawnTimer=0;
    // 倒计时在本波最后一辆车实际进入地图后才开始，不能跨波塞满出场队列。
    this.waveGap=this.gapAfterWave(plan.length);
    this.prepareTime=this.waveGap;this.waveDuration=this.waveGap;
    this.lastEarlyReward=reward;this.gold+=reward;
    const warning=this.level.boss&&this.wave===this.level.waves?`首领 ${ENEMIES[this.level.bossType].name} 来袭！`:`第 ${this.wave} 波发动！`;
    this.notify(`${warning}${reward?`提前迎敌 +${reward} G。`:""}旧波仍需拦截。`);
    if(this.level.mission==="bridge"&&this.wave%2===0)this.notify(`${warning}破拆车驶向桥梁，冻结或队员拦截可中断破拆。`);
    if(this.level.mission==="bus"&&this.traffic.lastCivilWave===this.wave)this.notify("公交待发：先守住两处接人站，送达获金币和技能补给。点击发车或等待倒计时。");
    if(shifted)this.notify(`${this.level.routeEvent.name}！新车切换路线；已过路口的旧车继续驶出。`);
    return true;
  }
  applyRouteEvent() {
    const event = this.level.routeEvent;
    if (!event || this.routeChanged || this.wave < event.wave) return false;
    this.previousRoad = this.road;
    this.road = new RoadNetwork({routes:event.routes});
    this.routeChanged = true; this.routeFlash = 6;
    const path = this.road.path(0);
    for (const enemy of this.enemies) {
      // 只有尚未过共同岔口的车辆才换路径，位置、血量、控制状态均保留。
      if (!enemy.dead && enemy.segment === 0 && [0,1].every(i =>
        enemy.path[i].x === path[i].x && enemy.path[i].y === path[i].y)) enemy.path = path;
    }
    Traffic.onRouteEvent(this);
    return true;
  }
  towerAt(p) { return this.towers.find(t => Collision.distance(t, p) <= CONFIG.towerRadius + 7); }
  pickTower(p) {
    // 升级后塔身更高：塔顶也能选中；建造占地仍只按原来的基座计算。
    const base = this.towerAt(p);
    if (base) return base;
    // 高设备的选区可能覆盖后方地块，地块中心应始终可以用于建造。
    const site = this.siteAt(p);
    if (site && Collision.distance(site, p) <= 18) return undefined;
    return [...this.towers].sort((a,b)=>b.y-a.y).find(t=>
      Math.abs(p.x-t.x)<=24&&p.y>=t.y-(t.level>=3?75:t.level===2?58:45)&&p.y<=t.y+20);
  }
  siteAt(p) { return this.sites.find(site => Math.abs(site.x - p.x) <= 25 && Math.abs(site.y - p.y) <= 25); }
  canBuild(p) {
    return this.sites.some(site => site.x === p.x && site.y === p.y)
      && !this.buildRoad.isRoad(p, CONFIG.towerRadius + 4) && !this.towerAt(p);
  }
  selectBuild(type) {
    if (this.screen !== "battle" || this.modal || !this.loadout.includes(type) || !this.towerUnlocked(type)) return false;
    const site = this.selectedSite;
    if (!site || !this.canBuild(site)) { this.notify("先点击地图中的设备地块，再选择建造塔型。"); return false; }
    const spec = TOWERS[type];
    if (this.gold < spec.cost) { this.notify("金币不足，地块保留，稍后可以继续建造。"); return false; }
    this.gold -= spec.cost;
    const tower = new Tower(type, site.x, site.y, this.level.theme);
    tower.siteId = site.id; this.towers.push(tower);
    if(type==="depot"){tower.rally=this.buildRoad.nearestPoint(tower);tower.update(0,this);} Sound.play("build");
    this.cancel(); this.selected = tower;
    this.effect(site, spec.color, 28); this.notify(`${spec.name}部署完成。点击塔可强化或出售。`);
    return true;
  }
  selectSkill(type) {
    if (this.skillCooldowns[type] > 0) { this.notify("技能正在冷却。"); return; }
    this.cancel(); this.skill = type;
    this.notify(`点击地图施放${SKILLS[type].name}，右键或 Esc 取消。`);
  }
  upgrade(branch = null) {
    const t = this.selected;
    if (!t || !this.towers.includes(t) || this.screen !== "battle" || this.modal) return false;
    if (t.level >= CONFIG.maxLevel || (t.level === 2 && ![0, 1].includes(branch)) || (t.level !== 2 && branch !== null)) return false;
    if(t.level===2&&!this.branchUnlocked(t.type,t.theme,branch)){this.notify(`累计通关 ${evolutionRequirement(t.type,t.theme,branch)} 关解锁此进化。`);return false;}
    const cost = t.level === 2 ? t.paths[branch].cost : t.upgradeCost;
    if (this.gold < cost) { this.notify("金币不足，升级需要更多击杀奖励。"); return false; }
    this.gold -= cost; t.invested += cost;
    if (t.level === 2) t.branch = branch;
    t.level++; Sound.play("upgrade"); this.effect(t, t.spec.color, 40); this.notify(`${t.name} · Lv.${t.level} 已就绪。`);
    return true;
  }
  sell() {
    if (!this.selected || !this.towers.includes(this.selected) || this.screen !== "battle" || this.modal) return;
    const tower = this.selected; tower.soldiers.forEach(s=>s.release()); Sound.play("build");
    this.gold += tower.sellValue; this.towers = this.towers.filter(t => t !== tower); this.selected = null;
    this.notify(`回收防御塔，返还 ${tower.sellValue} 金币。`);
  }
  cast(p) {
    if (!this.skill || this.paused || this.modal || this.screen !== "battle" || this.skillCooldowns[this.skill] > 0) return;
    const type = this.skill, spec = SKILLS[type];
    const victims = this.enemies.filter(e => !e.dead && Collision.distance(e, p) <= spec.radius);
    if (!victims.length) { this.notify("范围内没有敌人，技能未消耗。"); return; }
    for (const enemy of victims) {
      if (type === "strike") enemy.hit(145 + this.level.chapter * 55 + (this.level.stage-1)*14, this, { pierce: true });
      else enemy.stun(3);
    }
    this.effect(p, spec.color, spec.radius); this.skillCooldowns[type] = spec.cooldown; this.skill = null;
    Sound.play(type);this.notify(`${spec.name}已施放！`);
  }
  click(p, worldOnly = false) {
    const button = !worldOnly && [...this.buttons].reverse().find(b => Collision.inside(p, b));
    if (button) { if (!button.disabled) button.action(); return; }
    if (this.modal || this.screen !== "battle" || !Collision.inside(p, MAP)) return;
    if(this.rallyTower){this.setRally(p);return;}
    if (this.selectedSite && this.buildPopupRect && Collision.inside(p, this.buildPopupRect)) return;
    if (this.selected && this.towerPopupRect && Collision.inside(p, this.towerPopupRect)) return;
    if (this.skill) { this.cast(p); return; }
    if(this.traffic.fork){
      const node=this.traffic.fork.node;
      const nearbySite=this.siteAt(p);
      // 地块中心优先，路牌加大的触控区域不能夺走合法建造/选塔位置。
      if(!(nearbySite&&Collision.distance(nearbySite,p)<=18)&&Math.abs(p.x-node.x)<34&&p.y>=node.y-48&&p.y<=node.y+12){const open=!this.traffic.routeMenu;this.cancel();this.traffic.routeMenu=open;return;}
    }
    const tower = this.pickTower(p);
    if (tower) { this.cancel(); this.selected = tower; return; }
    const enemy = this.enemies.find(e => !e.dead && Collision.distance(e, p) < (e.spec.boss ? 26 : 18));
    if (enemy) { this.cancel(); this.inspected = enemy; return; }
    const site = this.siteAt(p);
    this.cancel();
    if (site && this.canBuild(site)) { this.selectedSite = site; this.notify(Platform.touch?"轻触炮台卡片建造；取消选择可收起面板。":"选择塔型建造，悬停卡片预览射程。右键取消。"); }
    else this.notify("只能在道路旁有勘测桩或木栈台的预留空地建塔。");
  }
  effect(p, color, radius, visual = null, kind = "impact") {
    const duration = visual?.level >= 3 ? .6 : .45;
    this.effects.push({x:p.x,y:p.y,color,radius,visual,kind,duration,life:duration});
  }
  float(p, label, color) { this.floats.push({ x: p.x, y: p.y - 24, label, color, life: 0.85 }); }
  beam(a, b, color, visual = null) {
    const duration=visual?.level>=3?.28:.16;
    // 第一跳从信号天线发出，后续跳跃连接敌人的实际位置。
    const height=a instanceof Tower?(a.level===1?23:a.level===2?32:a.branch===0?43:35):0;
    this.beams.push({a:{x:a.x,y:a.y-height},b:{x:b.x,y:b.y},color,visual,duration,life:duration});
  }
  finish(won) {
    if (this.screen !== "battle") return;
    this.screen = "result"; this.buttons = []; this.cancel(); this.won = won; Sound.play(won?"win":"lose");
    this.earnedStars = won ? (this.lives >= 18 ? 3 : this.lives >= 12 ? 2 : 1) : 0;
    const before = this.unlocked, completedBefore=this.completed;
    if (won) {
      this.progress.stars[this.levelIndex] = Math.max(this.progress.stars[this.levelIndex], this.earnedStars);
      this.saveFailed = !Progress.save(this.progress,this.activeSlot);
      if (!this.saveFailed) this.hasSave = true;
    }
    this.newUnlock = this.unlocked > before;
    this.earnedEvolutions=[];
    if(this.completed>completedBefore)for(const chapter of CHAPTERS)for(const type of TOWER_ORDER)for(const branch of [0,1])
      if(evolutionRequirement(type,chapter.theme,branch)===this.completed)this.earnedEvolutions.push(pathsFor(type,chapter.theme)[branch].name);
  }
  update(dt) {
    if (this.screen !== "battle" || this.paused || this.modal) return;
    this.routeFlash = Math.max(0, this.routeFlash - dt);
    this.messageTime = Math.max(0, this.messageTime - dt);
    for (const type of Object.keys(SKILLS)) this.skillCooldowns[type] = Math.max(0, this.skillCooldowns[type] - dt);
    for (const list of [this.effects, this.floats, this.beams]) list.forEach(e => { e.life -= dt; });
    this.effects = this.effects.filter(e => e.life > 0); this.floats = this.floats.filter(e => e.life > 0); this.beams = this.beams.filter(e => e.life > 0);
    if (this.inspected?.dead) this.inspected = null;
    // 只等出场队列清空，不等存活敌人被消灭；部署结束后再计时 5–10 秒。
    if (this.wave < this.level.waves && !this.spawnQueue.length) {
      this.prepareTime=Math.max(0,this.prepareTime-dt);
      if(this.prepareTime===0)this.startWave(true);
    }
    if (this.state === "wave") {
      this.spawnTimer -= dt;
      if (this.spawnQueue.length && this.spawnTimer <= 0) {
        const batch=this.spawnQueue[0],path=Traffic.path(this,this.spawnIndex);
        const required=Enemy.bodyLength(ENEMIES[batch.type])/2+CONFIG.trafficGap;
        const clear=!this.enemies.some(enemy=>!enemy.dead&&Collision.distance(enemy,path[0])<required+enemy.bodyLength/2);
        if(clear){
          this.spawnQueue.shift();this.spawnIndex++;
          this.enemies.push(new Enemy(batch.type,path,batch.scale));
          this.spawnTimer=CONFIG.spawnInterval;
        }else this.spawnTimer=.08;
      }
    }
    this.towers.filter(t=>t.type==="depot").forEach(t=>t.update(dt,this));
    // 快照保证新分裂的单位从下一帧开始更新，不会提前结束波次。
    for (const enemy of [...this.enemies]) {
      if (!enemy.dead) enemy.update(dt, this);
      if (this.lives <= 0) { this.finish(false); return; }
    }
    this.towers.filter(t=>t.type!=="depot").forEach(t => t.update(dt, this)); this.projectiles.forEach(p => p.update(dt, this));
    this.enemies = this.enemies.filter(e => !e.dead); this.projectiles = this.projectiles.filter(p => !p.dead);
    Traffic.update(this,dt);
    if(this.screen!=="battle")return;
    if (this.state === "wave" && !this.spawnQueue.length && !this.enemies.length) {
      this.projectiles = [];
      if (this.wave === this.level.waves && Traffic.complete(this)) { this.finish(true); return; }
    }
  }
  frame(time) {
    const elapsed = this.lastTime === null ? 0 : Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    if (this.screen !== "battle") this.messageTime = Math.max(0, this.messageTime - elapsed);
    // 倍速仍使用固定模拟步长，避免高速时弹丸穿越和控制时间失真。
    if (!Platform.hidden && this.screen === "battle" && !this.paused && !this.modal) {
      this.accumulator += elapsed * this.speed;
      while (this.accumulator >= CONFIG.fixedStep) { this.update(CONFIG.fixedStep); this.accumulator -= CONFIG.fixedStep; }
    } else this.accumulator = 0;
    if(this.traffic)this.traffic.engineVolume=Traffic.engineLevel(this);
    Sound.update(this); Renderer.draw(this); Platform.present(this); requestAnimationFrame(t => this.frame(t));
  }
}
