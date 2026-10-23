// 以真实金币、技能冷却和定时波次验证网页版可通关性；冻结微信包不追随新平衡。
const assert=require('node:assert/strict');
module.exports=function simulateCampaign({game,LEVELS,Collision,Traffic,Encounters,SkillBook,ENEMIES},stages){
  const failures=[],reports=[];
  for (const stage of stages) {
    game.progress.stars=LEVELS.map((_,i)=>i<stage?3:0);
    if(Encounters){
      game.screen='menu';game.resetSkills();
      // 用此前关卡真实可获得的星星研究，首关仍为零星、一级技能。
      const second=['bridge','bus'].includes(LEVELS[stage].mission)?'repair':LEVELS[stage].theme==='forest'?'emp':'freeze';game.equipSkill(second,1);
      for(const type of ['strike',second])for(const rank of [2,3,4]){
        if(!game.upgradeSkill(type,rank===3?(type==='repair'?0:1):null))break;
      }
    }
    assert.equal(game.startLevel(stage), true);
    // 按道路覆盖选择真实地块，避免测试依赖某一版地图的手写坐标。
    const objectives=game.level.mission==='bridge'?(game.traffic.bridges||[game.traffic.bridge]):game.level.mission==='bus'&&Traffic.busStops?game.road.routes.flatMap(path=>Traffic.busStops(path)):[];
    const entryDefense=Encounters?.entrances(game.level).map(entry=>{
      const roster=Encounters.roster(game.level,entry.id),sum=Object.values(roster.counts).reduce((a,b)=>a+b,0);
      return {routes:entry.routes,armor:Object.entries(roster.counts).reduce((n,[type,count])=>n+(ENEMIES[type].armor||0)*count,0)/sum,
        magic:Object.entries(roster.counts).reduce((n,[type,count])=>n+(ENEMIES[type].magicResist||0)*count,0)/sum};
    });
    const samples = game.buildRoad.routes.flatMap((route,routeIndex) => route.slice(1).flatMap((b,i) => {
      const a = route[i], steps = Math.ceil(Collision.distance(a,b)/20), total=route.slice(1).reduce((sum,p,j)=>sum+Collision.distance(route[j],p),0);
      const defense=entryDefense?.find(entry=>entry.routes.includes(routeIndex));
      return Array.from({length:steps},(_,step)=>{const p={x:a.x+(b.x-a.x)*(step+.5)/steps,y:a.y+(b.y-a.y)*(step+.5)/steps};return {...p,routeIndex,defense,future:routeIndex>=game.level.routes.length,weight:1000/total*(objectives.some(o=>Collision.distance(p,o)<180)?1.6:1)};});
    }));
    const coordinatedGuards=Encounters&&game.level.chapter>0&&game.level.routeEvent;
    const build=(type,reserve)=>{
      if(game.gold<({rail:80,signal:125,missile:145,depot:110}[type])+reserve)return;
      const coverage=samples.map(p=>game.towers.reduce((n,t)=>n+(Collision.distance(t,p)<t.stats.range?t.level/2:0),0));
      const range={rail:125,signal:108,missile:132,depot:125}[type];
      const routeCoverage=game.buildRoad.routes.map((_,ri)=>samples.reduce((sum,p,i)=>sum+(p.routeIndex===ri?coverage[i]*p.weight:0),0)/Math.max(1,samples.reduce((sum,p)=>sum+(p.routeIndex===ri?p.weight:0),0)));
      const score=site=>samples.reduce((n,p,i)=>n+(Collision.distance(site,p)<range?p.weight*(1-(type==='depot'?0:p.defense?.[type==='signal'?'magic':'armor']||0))**2*(game.routeChanged?(p.future?1:.1):(p.future ? .55 : 1))*(Encounters?(1+Math.min(coverage[i],1))/(1+routeCoverage[p.routeIndex])**2:1/(1+coverage[i])):0),0);
      const choices=game.sites.filter(s=>game.canBuild(s));
      // 固定点很少时，不在无主火力支援的偏远入口再堆兵营；把该点留给远程塔。
      const candidates=coordinatedGuards&&type==='depot'?choices.filter(site=>game.towers.some(t=>(t.type==='missile'||t.type==='rail')&&Collision.distance(t,game.road.nearestPoint(site))<t.stats.range)):choices;
      if(coordinatedGuards&&type==='depot'&&!candidates.length){build('rail',reserve);return;}
      const site=candidates.map(s=>({site:s,score:score(s)})).sort((a,b)=>b.score-a.score)[0]?.site;
      if(site){
        game.cancel();game.click(site,true);
        if(game.selectBuild(type)&&coordinatedGuards&&type==='depot'){
          const depot=game.towers.at(-1),ranged=game.towers.filter(t=>t.type!=='depot');
          // 通过真实集合指令把队员移入友军火力，避免入口孤立勤务站单挑整列车流。
          const rallies=samples.map(p=>game.road.nearestPoint(p)).filter(p=>Collision.distance(depot,p)<=depot.stats.rallyRange)
            .map(point=>({point,score:ranged.reduce((sum,t)=>sum+Math.max(0,t.stats.range-Collision.distance(t,point)),0)})).sort((a,b)=>b.score-a.score);
          for(const candidate of rallies){game.rallyTower=depot;if(game.setRally(candidate.point))break;}
          game.cancel();
        }
      }
    };
    let ticks = 0, maximumTowers = 0;
    while (game.screen === 'battle' && ticks < 60000) {
      if (ticks % 30 === 0) {
        if(Traffic){
          const t=game.traffic;
          if(game.level.mission==='bridge'&&t.integrity<=70)Traffic.action(game);
          if(game.level.mission==='toll'&&game.enemies.some(e=>e.remaining<100))Traffic.action(game);
          if(game.level.mission==='bus'&&t.pending.length&&!t.civilians.length)Traffic.dispatch?.(game);
          if(t.civilians.some(c=>c.kind==='emergency'?c.blocked:game.enemies.some(e=>!e.dead&&e.stunTime<=0&&!e.blocker&&(e.raidTarget||c.health<60)&&Collision.distance(c,e)<100)))Traffic.action(game);
          if(t.fork&&Traffic.branch&&t.switchCooldown===0&&game.enemies.some(e=>!e.dead&&e.segment<t.fork.segment)){
            const routeValue=path=>{
              const points=path.slice(t.fork.segment,path.mergeSegment+1);
              const coverage=points.reduce((n,p)=>n+game.towers.reduce((s,tower)=>s+(Collision.distance(tower,p)<tower.stats.range+60?tower.level:0),0),0);
              const civilian=t.civilians.find(c=>c.path===path);
              return coverage-(civilian?8:0)+(path.trafficBranch===1?3:0);
            };
            const best=game.road.routes.map((path,index)=>({index,score:routeValue(path)})).sort((a,b)=>b.score-a.score)[0];
            Traffic.switchRoute(game,best.index);
          }
        }
        if(game.routeChanged)for(const tower of [...game.towers]){
          if(Collision.distance(tower,game.road.nearestPoint(tower))>tower.stats.range+10&&!game.enemies.some(e=>Collision.distance(e,tower)<tower.stats.range)){
            game.selected=tower;game.sell();
          }
        }
        const reserve=game.level.mission==='bridge'&&game.traffic.integrity<60?60:0;
        // 多入口先覆盖两侧；后期短路先集中进化两座塔，避免四座一级塔平均分摊预算。
        const separateEntries=game.road.routes.length>1&&!game.traffic.fork;
        const opening=Encounters?(separateEntries?4:stage>=16&&Math.min(...game.road.routes.map(path=>Traffic.length(path)))<1600?2:stage>=16?4:6):(separateEntries||stage>=16?4:6);
        if (game.towers.length < opening) {
          const index = game.towers.length;
          const type=(Encounters?(separateEntries?['signal','rail','missile','signal']:['signal','missile','rail','signal','missile','depot']):separateEntries?['rail','signal','rail','signal']:['rail','signal','missile','depot','rail','signal'])[index];
          build(type,reserve);
        } else {
          const candidates=game.towers.filter(t => t.level < 4 && (t.level!==2 || [0,1].some(b=>game.branchUnlocked(t.type,t.theme,b))));
          // 先完成清障台的群伤进化，再建立减速与穿甲联动，而非把稀缺金币平均升级。
          if(Encounters)candidates.sort((a,b)=>{
            const priority=t=>(t.level>=3?10:0)+(['missile','signal','rail','depot'].indexOf(t.type))+(t.level===4?10:0);
            return priority(a)-priority(b);
          });
          const tower = candidates[0];
          if (tower) {
            game.selected=tower;
            const preferSecond=Encounters?(tower.type==='rail'&&tower.theme!=='city'||tower.type==='signal'&&tower.theme==='forest'||tower.type==='missile'&&tower.theme==='sea'):tower.theme==='hills'&&tower.type==='rail';
            const branches=preferSecond?[1,0]:[0,1];
            const branch=tower.level===2?branches.find(b=>game.branchUnlocked(tower.type,tower.theme,b)):null;
            if(game.gold>=(branch===null?tower.upgradeCost:tower.paths[branch].cost)+reserve)game.upgrade(branch);
          }
          else if (game.towers.length < (Encounters?game.sites.length:16)) {
            build(game.loadout[game.towers.length%4],reserve);
          }
        }
        for(const [index,tower] of game.towers.entries()) tower.targetMode=index===1?2:tower.type==='signal'?1:0;
        // 尾声回收远离主火力的勤务站，避免只靠队员磨掉首领的大量生命。
        if(Encounters&&game.wave===game.level.waves&&!game.spawnQueue.length)for(const depot of game.towers.filter(t=>t.type==='depot')){
          const target=depot.soldiers.find(s=>s.target?.spec.boss)?.target;
          if(target&&!game.towers.some(t=>t!==depot&&Collision.distance(t,target)<=t.stats.range)){
            game.selected=depot;game.sell();
          }
        }
        for (const type of game.skillLoadout||['strike', 'freeze']) {
          if(type==='repair'){
            const damaged=game.level.mission==='bus'?game.traffic.civilians.find(c=>c.health<55):game.traffic.integrity<65?game.traffic.bridge:null;
            if(!game.skillCooldowns.repair&&damaged){game.selectSkill('repair');game.cast(damaged);}
            continue;
          }
          if (!game.skillCooldowns[type] && game.enemies.length) {
            const radius=game.skillSpecs?.[type]?.radius||105;
            const priority=enemy=>1+(enemy.spec.boss?2:0)+(enemy.spec.bridgeDamage&&Traffic.bridgeAt(game,enemy)?3:0)+(enemy.remaining<160?2:0)+(game.traffic.civilians.some(c=>Collision.distance(enemy,c)<100)?3:0);
            const target=Encounters?game.enemies.map(e=>({enemy:e,score:game.enemies.reduce((sum,other)=>sum+(Collision.distance(e,other)<radius?priority(other):0),0)})).sort((a,b)=>b.score-a.score)[0].enemy:
              game.enemies.find(e => e.spec.bridgeDamage&&Traffic.bridgeAt(game,e)) || game.enemies.find(e=>game.traffic?.civilians.some(c=>Collision.distance(e,c)<100)) || game.enemies.find(e => e.spec.boss) || game.enemies.find(e=>e.spec.heal) || game.enemies.filter(e=>e.remaining<160).sort((a,b)=>a.remaining-b.remaining)[0] || game.enemies[Math.floor(game.enemies.length / 2)];
            if (game.enemies.length >= 3 || coordinatedGuards&&game.spawnQueue.some(item=>item.due<game.spawnClock-8) || target.spec.boss || target.spec.heal || target.spec.bridgeDamage || target.raidTarget || target.remaining<160) { game.selectSkill(type); game.cast(target); }
          }
        }
        if (game.state === 'prepare' && (!Encounters || game.wave>0 || game.gold<80 || ticks>=300)) game.startWave();
      }
      game.update(1 / 60); ticks++; maximumTowers=Math.max(maximumTowers,game.towers.length);
      assert.ok(game.gold >= 0, 'no overspending');
    }
    if(Encounters)assert.ok(SkillBook.spent(game.progress.skills)<=stage*3,'research only spends stars attainable before this level');
    const report={stage:stage+1,sites:game.sites.length,maximumTowers,researchStars:Encounters?SkillBook.spent(game.progress.skills):0,won:game.won,lives:game.lives,seconds:Math.round(ticks/60),minimumBridge:Math.round(game.traffic.minimumIntegrity),repairs:game.traffic.repairs||0,busRewards:game.traffic.busRewards||0,diversions:game.traffic.diversions||0};reports.push(report);
    if(process.env.TD_TEST_REPORT)console.log(JSON.stringify(report));
    if(game.screen!=='result'||!game.won)failures.push(`stage ${stage + 1} (${LEVELS[stage].name}), ${game.failureReason}, wave ${game.wave}, towers ${game.towers.length}, gold ${game.gold}, queued ${game.spawnQueue.length}, build ${game.towers.map(t=>`${t.type}${t.level}b${t.branch}@${t.x},${t.y}`).join('|')}, alive ${game.enemies.length}, ${game.enemies.slice(0,3).map(e=>`${e.type}@${Math.round(e.x)},${Math.round(e.y)} HP${Math.round(e.health)}`).join(';')}`);
    else assert.ok(game.progress.stars[stage] > 0);
  }
  assert.deepEqual(failures,[],failures.join("; "));
  return reports;
};
