"use strict";

class Enemy {
  static bodyLength(spec) {
    const visual=spec.visual||Object.keys(ENEMIES).find(key=>ENEMIES[key]===spec);
    return (spec.boss?54:visual==="runner"||visual==="swarm"?23:visual==="splitter"?37:32)*CONFIG.enemyVisualScale;
  }
  get bodyLength() { return this.length; }
  constructor(type, path, scale = 1) {
    this.type = type; this.spec = ENEMIES[type]; this.path = path; this.scale = scale;
    this.length=Enemy.bodyLength(this.spec);
    this.segment = 0; this.x = path[0].x; this.y = path[0].y;
    this.maxHealth = this.spec.hp * scale * (this.spec.boss?CONFIG.bossHealthMultiplier:CONFIG.enemyHealthMultiplier); this.health = this.maxHealth;
    this.maxShield = (this.spec.shield || 0) * scale; this.shield = this.maxShield;
    this.slowTime = 0; this.slowFactor = 1; this.stunTime = 0;
    this.burnTime = 0; this.burnDamage = 0; this.sinceHit = 0; this.healTimer = 1.2;
    this.dead = false; this.angle = 0; this.shredTime=0; this.shredAmount=0; this.jamTime=0;
  }
  get remaining() {
    let distance = Collision.distance(this, this.path[this.segment + 1] || this);
    for (let i = this.segment + 1; i < this.path.length - 1; i++) distance += Collision.distance(this.path[i], this.path[i + 1]);
    return distance;
  }
  slow(factor, duration) {
    const effective = 1 - (1 - factor) * (1 - (this.spec.slowResist || 0));
    this.slowFactor = this.slowTime > 0 ? Math.min(this.slowFactor, effective) : effective;
    this.slowTime = Math.max(this.slowTime, duration);
  }
  stun(duration) { this.stunTime = Math.max(this.stunTime, duration * (1 - (this.spec.slowResist || 0))); }
  hit(damage, game, options = {}) {
    if (this.dead) return;
    this.sinceHit = 0;
    const multiplier = options.shieldMultiplier || 1;
    const absorbed = Math.min(this.shield, damage * multiplier);
    this.shield -= absorbed;
    damage = Math.max(0, damage - absorbed / multiplier);
    this.health -= damage * (options.pierce ? 1 : 1 - (Math.max(0,(this.spec.armor || 0)-(this.shredTime>0?this.shredAmount:0))));
    if (this.health <= 0) {
      if(this.blocker)this.blocker.release();
      const reward=Math.max(1,Math.round(this.spec.reward*CONFIG.killRewardMultiplier));
      this.dead = true; game.gold += reward; game.kills++;
      game.effect(this, this.spec.color, 25); game.float(this, `+${reward}`, COLORS.gold);
      if (this.spec.split) for (let i = 0; i < this.spec.split; i++) {
        const child = new Enemy(this.spec.splitType || "swarm", this.path, this.scale);
        child.x = this.x; child.y = this.y; child.segment = this.segment;child.angle=this.angle;
        // 子车沿已走过的道路依次排开，避免同一坐标一次堆出多个图形。
        child.moveBack((i+1)*(child.bodyLength+CONFIG.trafficGap));
        game.enemies.push(child);
      }
    }
  }
  moveBack(distance) {
    while(distance>0){
      const target=this.path[this.segment],remaining=Collision.distance(this,target);
      if(remaining>=distance&&remaining>0){
        this.x+=(target.x-this.x)*distance/remaining;this.y+=(target.y-this.y)*distance/remaining;return;
      }
      this.x=target.x;this.y=target.y;distance-=remaining;
      if(this.segment===0){
        const next=this.path[1],length=Collision.distance(target,next);
        this.x-=(next.x-target.x)*distance/length;this.y-=(next.y-target.y)*distance/length;return;
      }
      this.segment--;
    }
  }
  followingDistance(game,distance) {
    const from=this.path[this.segment],to=this.path[this.segment+1];
    if(!to)return distance;
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
    let ownRemaining;this.passOffset=0;
    for(const other of game.enemies){
      if(other===this||other.dead||Collision.distance(this,other)>90)continue;
      let ahead;
      if(other.path===this.path){
        ownRemaining??=this.remaining;ahead=ownRemaining-other.remaining;
      }else{
        // 分流/合流的共用直线路段同样保持车距；不同支路互不阻挡。
        const a=other.path[other.segment],b=other.path[other.segment+1];
        if(!b||dx*(b.x-a.x)+dy*(b.y-a.y)<=0||Math.abs(dx*(b.y-a.y)-dy*(b.x-a.x))>.01||Collision.segmentDistance(other,from,to)>1)continue;
        ahead=((other.x-this.x)*dx+(other.y-this.y)*dy)/length;
      }
      if(ahead>0){
        // 勤务队员只能拦住自己的目标，后车可从路肩绕过，不能一人锁死整波车队。
        if(other.blocker||other.stunTime>0){if(ahead<65)this.passOffset=10;continue;}
        distance=Math.min(distance,Math.max(0,ahead-(this.bodyLength+other.bodyLength)/2-CONFIG.trafficGap));
      }
    }
    return distance;
  }
  update(dt, game) {
    this.sinceHit += dt;
    this.shredTime=Math.max(0,this.shredTime-dt);this.jamTime=Math.max(0,this.jamTime-dt);
    if (this.burnTime > 0) {
      this.hit(this.burnDamage * Math.min(dt, this.burnTime) * (1-(this.spec.burnResist||0)), game, { pierce: true });
      this.burnTime = Math.max(0, this.burnTime - dt);
      if (this.dead) return;
    }
    if (this.sinceHit > 3 && this.maxShield && this.jamTime === 0) this.shield = Math.min(this.maxShield, this.shield + this.spec.regen * dt);
    if (this.spec.heal) {
      this.healTimer -= dt;
      if (this.healTimer <= 0) {
        this.healTimer = 1.2;
        let healed = false;
        for (const other of game.enemies) if (other !== this && !other.dead && other.health < other.maxHealth && Collision.distance(this, other) < 85) {
          other.health = Math.min(other.maxHealth, other.health + this.spec.heal * this.scale); healed = true;
        }
        if (healed) game.effect(this, "#7ee6b3", 85);
      }
    }
    const stunned = this.stunTime > 0;
    this.stunTime = Math.max(0, this.stunTime - dt);
    const factor = this.slowTime > 0 ? this.slowFactor : 1;
    this.slowTime = Math.max(0, this.slowTime - dt);
    const guard=this.blocker;
    if(guard && guard.alive && guard.target===this && game.towers.includes(guard.owner) && Collision.distance(this,guard)<35) {
      this.meleeCooldown=Math.max(0,(this.meleeCooldown||0)-dt);
      if(!stunned&&this.meleeCooldown===0) {
        guard.hit((this.spec.boss?38:this.spec.armor?16:10)*Math.sqrt(this.scale));
        this.meleeCooldown=.95;
      }
      return;
    }
    this.blocker=null;
    const roadFactor=Traffic.enemyMotion(game,this,Traffic.speed(game,this),stunned?0:dt);
    let distance = stunned ? 0 : this.followingDistance(game,this.spec.speed * factor * roadFactor * dt);
    while (distance > 0 && !this.dead) {
      const target = this.path[this.segment + 1];
      if (!target) { this.escape(game); break; }
      const remaining = Collision.distance(this, target);
      this.angle = Math.atan2(target.y - this.y, target.x - this.x);
      if (distance >= remaining) {
        this.x = target.x; this.y = target.y; distance -= remaining; this.segment++;
        if (this.segment === this.path.length - 1) this.escape(game);
      } else {
        this.x += Math.cos(this.angle) * distance; this.y += Math.sin(this.angle) * distance; distance = 0;
      }
    }
  }
  escape(game) {
    Sound.play("leak");
    Traffic.onEscape(game,this);
    this.dead = true; game.lives = Math.max(0, game.lives - this.spec.leak);
    game.effect(this, COLORS.red, 32); game.float(this, `-${this.spec.leak} ♥`, COLORS.red);
  }
}
// 1→2基础强化，2→3选择专精，3→4强化专精。专精本局不能切换。
class Tower {
  constructor(type, x, y, theme="city") {
    this.theme=theme; this.soldiers=[]; this.rally=null;
    this.type = type; this.x = x; this.y = y; this.level = 1; this.branch = null;
    this.fireTime = 0; this.cooldown = 0; this.angle = -Math.PI / 2; this.invested = TOWERS[type].cost;
    this.targetMode = 0; this.focusTarget = null; this.focusStacks = 0;
  }
  get spec() { return TOWERS[this.type]; }
  get paths() { return pathsFor(this.type,this.theme); }
  get stats() {
    const base = this.spec;
    const stats = { ...base, damage: base.damage * (this.level >= 2 ? 1.45 : 1), range: base.range + (this.level >= 2 ? CONFIG.towerUpgradeRange : 0) };
    if (this.branch !== null) {
      const path = this.paths[this.branch];
      stats.damage *= path.damage || 1; stats.range += path.range || 0; stats.cooldown *= path.cooldown || 1;
      for (const key of ["pierce", "slow", "duration", "stun", "splash", "burn", "multi", "chain", "chainRange", "shieldMultiplier", "focus", "focusGain", "repair", "shred", "jam"]) {
        if (path[key] !== undefined) stats[key] = path[key];
      }
    }
    if(this.type==="depot") {
      const path=this.branch===null?{}:this.paths[this.branch];
      stats.soldierHealth=base.soldierHealth*(1+(this.level-1)*.4)*(path.soldierHealth||1);
      for(const key of ["soldierCount","soldierArmor","soldierRegen","respawn"]) if(path[key]!==undefined)stats[key]=path[key];

    }
    if(this.branch!==null)stats.color=THEME_EQUIPMENT[this.theme].colors[this.branch];
    if (this.level === 4) { stats.damage *= 1.4; stats.range += CONFIG.towerFinalRange; }
    if(this.type==="depot")stats.rallyRange=stats.range;
    return stats;
  }
  // 发射时快照外观，飞行中的弹体不会因随后升级而改变。
  get visual() {
    const stats=this.stats;
    return {type:this.type,level:this.level,branch:this.branch,theme:this.theme,color:stats.color,beamStyle:stats.chain?"chain":"focus"};
  }
  get name() { return this.branch === null ? this.spec.name : this.paths[this.branch].name; }
  get upgradeCost() { return Math.round(this.spec.cost * (this.level === 1 ? 0.75 : 1.2)); }
  get sellValue() { return Math.floor(this.invested * CONFIG.sellRatio); }
  update(dt, game) {
    this.fireTime = Math.max(0, this.fireTime - dt);
    if(this.type==="depot") {
      if(!this.rally)this.rally=(game.buildRoad||game.road).nearestPoint(this);
      while(this.soldiers.length<this.stats.soldierCount)this.soldiers.push(new Soldier(this,this.soldiers.length));
      this.soldiers.forEach(s=>s.update(dt,game));return;
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    const stats = this.stats;
    if (stats.repair) {
      this.supportTimer = (this.supportTimer || 0) - dt;
      if (this.supportTimer <= 0) {
        this.supportTimer = 1.5;
        const allies = game.towers.flatMap(t => t.soldiers).filter(s => s.alive && s.health < s.maxHealth && Collision.distance(this, s) <= stats.range);
        for (const soldier of allies) soldier.health = Math.min(soldier.maxHealth, soldier.health + stats.repair);
        if (allies.length) game.effect(this, "#aee5b1", stats.range);
      }
    }
    const candidates = game.enemies.filter(e => !e.dead && Collision.distance(this, e) <= stats.range);
    candidates.sort((a, b) => {
      if (this.targetMode === 1) return (b.health + b.shield) - (a.health + a.shield);
      if (this.targetMode === 2) return Number(Boolean(b.spec.heal)) - Number(Boolean(a.spec.heal)) || a.remaining - b.remaining;
      return a.remaining - b.remaining;
    });
    if (!candidates.length) { this.focusTarget = null; this.focusStacks = 0; return; }
    const target = candidates[0];
    this.angle = Math.atan2(target.y - this.y, target.x - this.x);
    if (this.cooldown > 0) return;
    this.fireTime = .24;
    let damage = stats.damage;
    if (stats.focus) {
      this.focusStacks = this.focusTarget === target ? Math.min(5, this.focusStacks + 1) : 0;
      this.focusTarget = target; damage *= 1 + this.focusStacks * (stats.focusGain || .25);
    }
    // 信号站是周期性区域设备：基础形态同时干扰范围内车辆。
    // 跳频/聚焦专精改为连锁或定向输出；双目标专精保留独立锁定。
    if (this.type === "signal" && !stats.chain && !stats.focus && !stats.multi) {
      const radius = stats.range;
      candidates.filter(enemy => Collision.distance(this, enemy) <= radius)
        .forEach(enemy => applyHit(enemy, damage, stats, game));
      game.effect(this, stats.color, radius, this.visual, "pulse");
      this.cooldown = stats.cooldown;
      Sound.play(this.type);
      return;
    }
    for (const enemy of candidates.slice(0, stats.multi || 1)) {
      if (stats.chain || (this.type === "signal" && !stats.splash)) {
        let current = enemy, from = this;
        const visited = new Set();
        for (let i = 0; current && i < (stats.chain || 1); i++) {
          game.beam(from, current, stats.color, this.visual);
          applyHit(current, damage * (stats.chain ? 0.86 ** i : 1), stats, game);
          visited.add(current); from = current;
          current = game.enemies.filter(e => !e.dead && !visited.has(e) && Collision.distance(from, e) <= stats.chainRange)
            .sort((a, b) => Collision.distance(from, a) - Collision.distance(from, b))[0];
        }
      } else game.projectiles.push(new Projectile(this, enemy, { ...stats, damage }));
    }
    this.cooldown = stats.cooldown;
    Sound.play(this.type);
  }
}
// 一个队员只拦截一辆车；接近后才能拦车，阵亡、出售或调动会立即解除阻挡。
class Soldier {
  constructor(owner,slot) {
    this.owner=owner;this.slot=slot;this.x=owner.x;this.y=owner.y;
    this.health=owner.stats.soldierHealth;this.maxHealth=this.health;
    this.cooldown=0;this.swingTime=0;this.angle=0;this.respawnRemaining=0;this.target=null;
  }
  get alive(){return this.health>0;}
  release(){if(this.target?.blocker===this)this.target.blocker=null;this.target=null;}
  hit(damage){
    this.health=Math.max(0,this.health-damage*(1-this.owner.stats.soldierArmor));
    if(!this.alive){this.release();this.respawnRemaining=this.owner.stats.respawn;}
  }
  update(dt,game){
    this.swingTime=Math.max(0,this.swingTime-dt);
    const stats=this.owner.stats,rally=this.owner.rally;
    if(stats.soldierHealth!==this.maxHealth){if(this.alive)this.health+=stats.soldierHealth-this.maxHealth;this.maxHealth=stats.soldierHealth;}
    if(!this.alive){
      this.respawnRemaining=Math.max(0,this.respawnRemaining-dt);
      if(!this.respawnRemaining){this.health=this.maxHealth;this.x=this.owner.x;this.y=this.owner.y;}
      return;
    }
    this.health=Math.min(this.maxHealth,this.health+(stats.soldierRegen||0)*dt);
    this.cooldown=Math.max(0,this.cooldown-dt);
    if(this.target&&(this.target.dead||Collision.distance(this.target,rally)>CONFIG.soldierLeash||(this.target.blocker&&this.target.blocker!==this)))this.release();
    if(!this.target)this.target=game.enemies.filter(e=>!e.dead&&!e.blocker&&Collision.distance(e,rally)<=CONFIG.soldierLeash
      && !game.towers.some(t=>t.soldiers.some(s=>s!==this&&s.alive&&s.target===e)))
      .sort((a,b)=>a.remaining-b.remaining)[0]||null;
    const destination=this.target||{x:rally.x+Math.cos(this.slot*2.4)*12,y:rally.y+Math.sin(this.slot*2.4)*12};
    const distance=Collision.distance(this,destination);
    if(this.target&&distance<=CONFIG.soldierCatch){
      this.target.blocker=this;
      if(!this.cooldown){
        const target=this.target;this.angle=Math.atan2(target.y-this.y,target.x-this.x);
        this.swingTime=.24;this.owner.fireTime=.24;
        game.effect(target,stats.color,this.owner.level>=3?19:10,this.owner.visual,"strike");
        applyHit(target,stats.damage,stats,game);this.cooldown=stats.cooldown;
        Sound.play("clash");if(target.dead)this.release();
      }
    } else if(distance>1){const step=Math.min(distance,CONFIG.soldierSpeed*dt);this.x+=(destination.x-this.x)/distance*step;this.y+=(destination.y-this.y)/distance*step;}
  }
}
function applyHit(enemy, damage, stats, game) {
  enemy.hit(damage, game, stats);
  if (enemy.dead) return;
  if (stats.shred) {enemy.shredTime=4;enemy.shredAmount=Math.max(enemy.shredAmount,stats.shred);}
  if (stats.jam) enemy.jamTime=Math.max(enemy.jamTime,stats.jam);
  if (stats.slow) enemy.slow(stats.slow, stats.duration);
  if (stats.stun) enemy.stun(stats.stun);
  if (stats.burn) { enemy.burnDamage = Math.max(enemy.burnDamage, stats.burn); enemy.burnTime = Math.max(enemy.burnTime, stats.duration); }
}
class Projectile {
  constructor(tower, target, stats) {
    this.x = tower.x; this.y = tower.y; this.target = target;
    this.visual = tower.visual;
    this.type = tower.type; this.origin = {x: tower.x, y: tower.y}; this.travelled = 0;
    this.destination = { x: target.x, y: target.y }; this.stats = stats; this.dead = false;
  }
  update(dt, game) {
    if (!this.target.dead) this.destination = { x: this.target.x, y: this.target.y };
    const distance = Collision.distance(this, this.destination), step = CONFIG.projectileSpeed * dt;
    this.travelled += Math.min(distance, step);
    if (distance <= step) {
      this.dead = true;
      const victims = this.stats.splash ? game.enemies.filter(e => !e.dead && Collision.distance(e, this.destination) <= this.stats.splash)
        : (this.target.dead ? [] : [this.target]);
      victims.forEach(e => applyHit(e, this.stats.damage, this.stats, game));
      game.effect(this.destination, this.stats.color, this.stats.splash || 12, this.visual);
    } else {
      this.x += (this.destination.x - this.x) / distance * step; this.y += (this.destination.y - this.y) / distance * step;
    }
  }
}
