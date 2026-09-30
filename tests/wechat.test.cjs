const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),base=path.join(root,'wechat');
const {createPlatform}=require('../wechat/platform/wechat.js');
function boot(saved=new Map(),legacy=false,device=null){
  const listeners={},players=[],frames=[],draws=[];
  let windowInfo=device||{windowWidth:844,windowHeight:390,pixelRatio:3,safeArea:{left:44,top:0,right:800,bottom:369}};
  const makeContext=()=>new Proxy({}, {get:(o,k)=>k in o?o[k]:legacy&&['roundRect','ellipse'].includes(k)?undefined:k==='drawImage'?(...args)=>draws.push(args):()=>{},set:(o,k,v)=>(o[k]=v,true)});
  const wx={createCanvas:()=>({getContext:()=>makeContext()}),getWindowInfo:()=>windowInfo,getMenuButtonBoundingClientRect:()=>windowInfo.menuButton||({left:windowInfo.windowWidth-102,top:8,width:90,height:32}),
    getStorageSync:key=>saved.get(key)||'',setStorageSync:(key,value)=>saved.set(key,value),
    setInnerAudioOption:options=>{wx.audioOptions=options;},
    createInnerAudioContext:()=>{const p={playCount:0,stopCount:0,pauseCount:0,onPause(fn){this.paused=fn;},onStop(fn){this.stopped=fn;},pause(){this.pauseCount++;this.paused?.();},onError(fn){this.error=fn;},onEnded(fn){this.end=fn;},play(){this.playCount++;},stop(){this.stopCount++;this.stopped?.();}};players.push(p);return p;}};
  for(const name of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show','WindowResize','AudioInterruptionBegin','AudioInterruptionEnd'])wx['on'+name]=fn=>listeners[name]=fn;
  const module={exports:{}};
  const sandbox={wx,module,console,requestAnimationFrame:fn=>frames.push(fn),require:name=>{assert.equal(name,'./platform/wechat.js');return{createPlatform};}};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(base,'game.bundle.js'),'utf8')+'\nmodule.exports={game,Platform,Renderer,Sound,CONFIG,LEVELS,MAP,Progress,Collision,MobileLayout,AtlasArt,Traffic,Enemy};',sandbox);
  const api=module.exports;
  let time=0;const frame=()=>{time+=16.667;frames.shift()(time);};frame();
  function tap(x,y,moved=false){const v=api.Platform.viewport,t={identifier:7,clientX:v.left+x*v.scale,clientY:v.top+y*v.scale};listeners.TouchStart({touches:[t]});if(moved)listeners.TouchMove({touches:[{...t,clientX:t.clientX+30}]});listeners.TouchEnd({changedTouches:[t]});frame();}
  const press=label=>{frame();const b=api.game.buttons.find(b=>b.label===label);assert.ok(b,label);tap(b.x+b.w/2,b.y+b.h/2);};
  const tapWorld=(x,y)=>{const p=api.MobileLayout.toScreen(api.game,{x,y});tap(p.x,p.y);};
  return {...api,press,tapWorld,wx,listeners,players,frames,frame,tap,saved,draws,resize:info=>{windowInfo=info;listeners.WindowResize();}};
}
test('native bundle boots without document, window or localStorage and renders through wx Canvas',()=>{
  const {game,Platform,draws,players}=boot(new Map(),true);
  assert.equal(game.screen,'home');assert.equal(Platform.touch,true);assert.ok(draws.length);assert.equal(players.length,0);
  assert.equal(Platform.viewport.left,0);assert.equal(Platform.viewport.top,0);
  assert.equal(Platform.viewport.width,844);assert.equal(Platform.viewport.height,390);
  const draw=draws.at(-1);assert.deepEqual(draw.slice(-4),[0,0,1688,780]);
});
test('home opens three independent dated saves, preserving progress and confirming replacement',()=>{
  const api=boot(),{game,press,frame,wx,Progress}=api;
  press('读取存档');assert.equal(game.modal,'saveSlots');assert.equal(game.buttons.filter(b=>b.label==='读取'&&b.disabled).length,3);
  assert.equal(api.saved.size,0);press('关闭');press('开始游戏');assert.equal(game.modal,'saveSlots');press('新建');
  assert.equal(game.screen,'menu');assert.equal(game.activeSlot,0);
  const created=Progress.list()[0].createdAt;assert.ok(created>0);
  game.startLevel(0);game.finish(true);game.screen='home';frame();
  press('开始游戏');game.chooseSaveSlot(1);game.startLevel(0);game.lives=8;game.finish(true);
  game.screen='home';press('开始游戏');game.chooseSaveSlot(2);
  assert.equal(Progress.list().filter(Boolean).length,3);assert.equal(Progress.list()[0].stars[0],3);assert.equal(Progress.list()[1].stars[0],1);
  game.screen='home';press('读取存档');game.chooseSaveSlot(0);assert.equal(game.completed,1);assert.equal(game.menuLevel,1);
  assert.equal(Progress.list()[0].createdAt,created);assert.equal(game.activeSlot,0);
  game.screen='home';press('开始游戏');game.chooseSaveSlot(1);assert.equal(game.modal,'newCampaign');
  press('取消');assert.equal(game.modal,'saveSlots');assert.equal(Progress.list()[1].stars[0],1);
  game.chooseSaveSlot(1);press('开始新战役');assert.equal(game.completed,0);assert.equal(Progress.list()[0].stars[0],3);
  assert.equal(Progress.list()[1].stars[0],0);assert.equal(Progress.list().length,3);assert.equal(game.chooseSaveSlot(3),false);
  game.screen='home';let exited=0;wx.exitMiniProgram=()=>exited++;press('退出游戏');assert.equal(exited,1);
  const restored=boot(api.saved);assert.equal(restored.game.activeSlot,1);assert.equal(restored.Progress.list()[0].stars[0],3);
});

test('chapter map opens a modal, locked levels stay locked and battle starts only after confirmation',()=>{
  const api=boot(),{game,tap,frame,CONFIG}=api;game.newCampaign();game.chooseSaveSlot(0);frame();
  const node=game.buttons.find(b=>b.levelIndex===0);tap(node.x+node.w/2,node.y+35);
  assert.equal(game.screen,'menu');assert.equal(game.modal,'level');
  assert.equal(game.towers,undefined);
  const bounds=()=>{for(const b of game.buttons){assert.ok(b.x>=0&&b.y>=0);assert.ok(b.x+b.w<=api.Platform.layout.width&&b.y+b.h<=api.Platform.layout.height);}};
  bounds();let b=game.buttons.find(b=>b.label==='进化研究');tap(b.x+50,b.y+30);assert.equal(game.modal,'loadout');bounds();
  b=game.buttons.find(b=>b.label==='关闭');tap(b.x+40,b.y+30);assert.equal(game.modal,'level');
  game.modal=null;game.openLevel(1);frame();b=game.buttons.find(b=>b.label.includes('后解锁'));
  assert.equal(b.disabled,true);tap(b.x+50,b.y+30);assert.equal(game.screen,'menu');
  game.openLevel(0);frame();b=game.buttons.find(b=>b.label==='开始战斗');tap(b.x+50,b.y+30);
  assert.equal(game.screen,'battle');bounds();
});
test('native touch follows the camera after fullscreen resize and ignores drags',()=>{
  const api=boot(),{game,tap,press,tapWorld,frame}=api;
  const start=game.buttons.find(b=>b.label==='开始游戏');tap(start.x+50,start.y+40,true);assert.equal(game.screen,'home');
  press('开始游戏');press('新建');game.openLevel(0);frame();press('开始战斗');
  const site=game.sites[0];tapWorld(site.x,site.y);assert.ok(game.selectedSite);const gold=game.gold;
  const card=game.buttons.find(b=>b.towerType==='rail');tap(card.x+card.w/2,card.y+card.h/2);
  assert.equal(game.towers.length,1);assert.equal(game.gold,gold-80);
  const upgrade=game.buttons.find(b=>b.label?.startsWith('强化'));tap(upgrade.x+50,upgrade.y+35);assert.equal(game.selected.level,2);
  press('取消');assert.equal(game.selected,null);
  const before=game.towers.length;tap(-50,350);assert.equal(game.towers.length,before);
});

test('multitouch and canceled touch cannot purchase; lifecycle pauses without simulating background time',()=>{
  const api=boot(),{game,listeners,Platform,Sound,frame,tap}=api;
  game.startLevel(0);game.startWave();frame();const wave=game.wave,lives=game.lives,remaining=game.prepareTime;
  listeners.TouchStart({touches:[{identifier:1,clientX:300,clientY:200},{identifier:2,clientX:330,clientY:200}]});
  listeners.TouchEnd({changedTouches:[{identifier:1,clientX:300,clientY:200}]});assert.equal(game.selectedSite,null);
  listeners.Hide();assert.equal(Platform.hidden,true);assert.equal(game.paused,true);frame();
  assert.equal(game.prepareTime,remaining);assert.equal(Sound.musicPlaying,false);
  listeners.Show();frame();assert.equal(Platform.hidden,false);assert.equal(game.paused,true);
  assert.equal(game.lives,lives);assert.equal(game.wave,wave);assert.equal(game.accumulator,0);
  api.press('继续');assert.equal(game.paused,false);
});
test('WeChat save and sound preferences survive independent launches',()=>{
  const saved=new Map(),a=boot(saved);a.game.startLevel(0);a.game.finish(true);a.Sound.toggle('music');
  const b=boot(saved);assert.equal(b.game.progress.stars[0],3);assert.equal(b.game.unlocked,1);assert.equal(b.Sound.musicEnabled,false);
  assert.equal(b.game.towers,undefined,'battle deployment is not persisted');
});
test('native audio switches independently, limits effect players and handles unavailable music without retry storms',()=>{
  const {Sound,game,players}=boot();Sound.unlock();Sound.update(game);
  const music=players[0];assert.equal(music.src,'audio/music-city.wav');assert.equal(music.loop,true);assert.equal(music.playCount,1);
  Sound.play('build');const effect=players[1];Sound.toggle('music');assert.equal(effect.stopCount,0);assert.ok(music.pauseCount);
  Sound.toggle('music');Sound.update(game);const plays=music.playCount;Sound.toggle('effects');assert.equal(music.playCount,plays);assert.equal(effect.stopCount,1);
  Sound.toggle('effects');for(let i=0;i<20;i++){Sound.last={};Sound.play('rail');}assert.ok(Sound.pool.length<=6);
  music.error({errCode:10004});for(let i=0;i<30;i++)Sound.update(game);assert.equal(music.playCount,plays);
  game.screen='menu';game.selectChapter(1);Sound.update(game);assert.equal(music.src,'audio/music-country.wav');assert.equal(music.playCount,plays+1);
  Sound.stop();assert.ok(Sound.pool.every(s=>!s.busy));
});
test('all 48 native maps and evolution panels render with enlarged controls',()=>{
  const {game,Renderer,LEVELS,frame}=boot();game.progress.stars.fill(3);
  for(let i=0;i<LEVELS.length;i++){
    game.startLevel(i);frame();game.selectedSite=game.sites[0];Renderer.draw(game);
    assert.ok(game.buildPopupRect.w>=500);game.gold=5000;game.selectBuild('signal');game.upgrade();Renderer.draw(game);
    assert.ok(game.towerPopupRect.w>=500);game.upgrade(1);Renderer.draw(game);
    game.modal='loadout';Renderer.draw(game);game.modal='intel';Renderer.draw(game);game.modal=null;
  }
});
test('resizing recomputes viewport and touch mapping while retaining progress',()=>{
  const api=boot();api.resize({windowWidth:1024,windowHeight:768,pixelRatio:2,safeArea:{left:0,top:24,right:1024,bottom:748}});
  const v=api.Platform.viewport,p=api.Platform.toCanvas({clientX:v.left+v.width/2,clientY:v.top+v.height/2});
  assert.ok(Math.abs(p.x-640)<.0001);assert.ok(Math.abs(p.y-480)<.0001);api.press('开始游戏');api.press('新建');assert.equal(api.game.screen,'menu');
});
test('frozen v0.13.0 package retains its hashes, valid app ID and nonempty PCM audio',()=>{
  const config=JSON.parse(fs.readFileSync(path.join(base,'project.config.json'),'utf8'));assert.match(config.appid,/^wx[0-9a-f]{16}$/);assert.equal(config.compileType,'game');
  const settings=JSON.parse(fs.readFileSync(path.join(base,'game.json'),'utf8'));assert.equal(settings.deviceOrientation,'landscape');
  const bundle=fs.readFileSync(path.join(base,'game.bundle.js'),'utf8');
  const {createHash}=require('node:crypto');
  for(const file of require('./fixtures/wechat-v0.13.0.sha256.json')){
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(base,file.path))).digest('hex'),file.sha256,`frozen WeChat file changed: ${file.path}`);
  }
  const files=fs.readdirSync(path.join(base,'audio'));assert.equal(files.length,27);
  let total=Buffer.byteLength(bundle);
  for(const file of files){const b=fs.readFileSync(path.join(base,'audio',file));assert.equal(b.toString('ascii',0,4),'RIFF');let offset=12,data=null;while(offset+8<=b.length){const size=b.readUInt32LE(offset+4);if(b.toString('ascii',offset,offset+4)==='data')data=b.subarray(offset+8,offset+8+size);offset+=8+size+(size%2);}assert.ok(data&&data.length>100&&data.some(v=>v!==0),file);total+=b.length;}
  assert.ok(total<4*1024*1024);
});

test('fullscreen layouts cover common phone and tablet sizes and keep controls outside system areas',()=>{
  const devices=[
    {windowWidth:667,windowHeight:375,pixelRatio:2},
    {windowWidth:844,windowHeight:390,pixelRatio:3,safeArea:{left:44,top:0,right:800,bottom:369}},
    {windowWidth:932,windowHeight:430,pixelRatio:3,safeArea:{left:59,top:0,right:873,bottom:409}},
    {windowWidth:960,windowHeight:432,pixelRatio:2.75,safeArea:{left:28,top:0,right:960,bottom:432}},
    {windowWidth:1024,windowHeight:768,pixelRatio:2,safeArea:{left:0,top:24,right:1024,bottom:748}}
  ];
  for(const device of devices){
    const api=boot(new Map(),false,device),{game,Platform,frame,MobileLayout}=api;
    const visibleButtons=()=>{
      const {safe,capsule}=Platform.layout;
      for(const b of game.buttons){
        assert.ok(b.x>=safe.left&&b.y>=safe.top&&b.x+b.w<=safe.right+.001&&b.y+b.h<=safe.bottom+.001,`${device.windowWidth}: ${b.label||b.levelIndex} off screen`);
        assert.ok(!capsule||b.x+b.w<=capsule.x||b.x>=capsule.x+capsule.w||b.y+b.h<=capsule.y||b.y>=capsule.y+capsule.h,`${b.label} under capsule`);
      }
    };
    assert.equal(Platform.canvas.width,Math.round(device.windowWidth*Math.min(2,device.pixelRatio)));
    assert.equal(Platform.viewport.width,device.windowWidth);assert.equal(Platform.viewport.height,device.windowHeight);
    visibleButtons();game.newCampaign();frame();visibleButtons();game.chooseSaveSlot(0);frame();visibleButtons();
    for(let chapter=0;chapter<6;chapter++){game.selectChapter(chapter);frame();visibleButtons();}
    game.openLevel(0);frame();visibleButtons();game.startLevel(0);frame();visibleButtons();
    for(const site of game.sites){
      const p=MobileLayout.toScreen(game,site),back=MobileLayout.toWorld(game,p);
      assert.ok(Math.abs(back.x-site.x)<1e-7&&Math.abs(back.y-site.y)<1e-7);
      assert.ok(p.x>=Platform.layout.safe.left&&p.x<=Platform.layout.safe.right&&p.y>=Platform.layout.safe.top&&p.y<=Platform.layout.safe.bottom);
    }
    game.selectedSite=game.sites[0];frame();visibleButtons();game.selectBuild('rail');game.upgrade();frame();visibleButtons();
    game.modal='loadout';frame();visibleButtons();game.modal='battleMenu';frame();visibleButtons();
  }
});

test('locked evolutions draw chains, reject taps, and unlock without confusing insufficient gold',()=>{
  const api=boot(),{game,frame,tap,AtlasArt}=api;let chains=0;
  const draw=AtlasArt.chain;AtlasArt.chain=function(rect){chains++;draw.call(this,rect);};
  game.startLevel(0);game.selectedSite=game.sites[0];game.selectBuild('rail');game.upgrade();game.gold=5000;frame();
  const locked=game.buttons.filter(b=>b.locked);assert.equal(locked.length,2);assert.equal(chains,2);
  const before=game.gold;tap(locked[0].x+80,locked[0].y+50);assert.equal(game.selected.level,2);assert.equal(game.gold,before);
  game.progress.stars.fill(3);game.gold=0;chains=0;frame();
  assert.equal(game.buttons.filter(b=>b.locked).length,0);assert.equal(chains,0);
  assert.ok(game.buttons.filter(b=>b.branch!==undefined).every(b=>b.disabled));
  game.gold=5000;frame();const open=game.buttons.find(b=>b.branch===0);assert.equal(open.disabled,false);
  tap(open.x+80,open.y+50);assert.equal(game.selected.level,3);
  const tower=game.selected,position={x:tower.x,y:tower.y},gold=game.gold;
  api.resize({windowWidth:1024,windowHeight:768,pixelRatio:2});frame();
  assert.equal(game.gold,gold);assert.equal(tower.x,position.x);assert.equal(tower.y,position.y);
});

test('mobile wide maps remain winnable with legal spending and automatic wave deadlines',()=>{
  require('./campaign-simulation.cjs')(boot(),process.env.TD_TEST_STAGES?.split(',').map(Number)||[0,7,15,23,31,39,47]);
});


test('chapter music continues during battle/building and resumes after interruption without overriding mute',()=>{
  const {game,Sound,players,listeners,wx}=boot();Sound.unlock();Sound.update(game);
  const music=players[0];assert.equal(wx.audioOptions.obeyMuteSwitch,false);assert.equal(music.volume,.5);
  game.startLevel(0);Sound.update(game);assert.equal(music.playCount,1);assert.equal(Sound.musicPlaying,true);
  game.selectedSite=game.sites[0];Sound.update(game);assert.equal(music.pauseCount,0);
  game.selectBuild('rail');Sound.update(game);assert.equal(music.pauseCount,0);
  listeners.AudioInterruptionBegin();Sound.update(game);const interrupted=music.playCount;
  for(let i=0;i<10;i++)Sound.update(game);assert.equal(music.playCount,interrupted);
  listeners.AudioInterruptionEnd();Sound.update(game);assert.equal(music.playCount,interrupted+1);
  game.paused=true;Sound.update(game);assert.equal(Sound.musicPlaying,false);
  game.paused=false;Sound.update(game);assert.equal(music.playCount,interrupted+2);
  Sound.toggle('music');listeners.AudioInterruptionBegin();listeners.AudioInterruptionEnd();Sound.update(game);
  assert.equal(music.playCount,interrupted+2);assert.equal(Sound.musicEnabled,false);
});

test('traffic dispatch and mission buttons remain touchable without overlapping wave controls after resize',()=>{
  const api=boot(),{game,frame,tap,Traffic}=api;game.startLevel(0);frame();
  for(const size of [[667,375],[844,390],[932,430],[960,432],[1024,768]]){
    api.resize({windowWidth:size[0],windowHeight:size[1],pixelRatio:2});frame();
    const control=game.buttons.find(b=>b.label?.startsWith('分流'));
    const mission=game.buttons.find(b=>b.label?.startsWith('落杆'));
    assert.ok(control&&mission);assert.ok(control.w>70&&mission.w>70);
    const v=api.Platform.viewport;assert.ok(control.w*v.scale>=40&&control.h*v.scale>=30);
    const others=game.buttons.filter(b=>b!==control&&b!==mission);
    for(const b of others)for(const c of [control,mission])assert.ok(c.x+c.w<=b.x||b.x+b.w<=c.x||c.y+c.h<=b.y||b.y+b.h<=c.y,'dispatch cannot mask another control');
  }
  game.traffic.switchCooldown=0;frame();let control=game.buttons.find(b=>b.label?.startsWith('分流'));
  tap(control.x+control.w/2,control.y+control.h/2);assert.equal(game.traffic.branch,1);
  let mission=game.buttons.find(b=>b.label?.startsWith('落杆'));tap(mission.x+mission.w/2,mission.y+mission.h/2);assert.ok(game.traffic.activeTime>0);
  game.paused=true;frame();const time=game.traffic.activeTime;game.update(5);assert.equal(game.traffic.activeTime,time);
});

test('native traffic engine and broadcast share effects mute and interruption handling',()=>{
  const {game,Sound,players,Enemy,frame,listeners}=boot();game.startLevel(0);Sound.unlock();
  game.enemies=[new Enemy('scout',game.road.path(0))];frame();
  const engine=players.find(p=>p.src==='audio/engine.wav');assert.ok(engine&&engine.playCount>0);assert.ok(engine.volume>0&&engine.volume<.2);
  Sound.play('radio-bus');assert.ok(players.some(p=>p.src==='audio/radio-bus.wav'&&p.playCount>0));
  Sound.toggle('effects');assert.equal(Sound.enginePlaying,false);const count=engine.playCount;frame();assert.equal(engine.playCount,count);
  Sound.toggle('effects');frame();assert.ok(engine.playCount>count);
  listeners.AudioInterruptionBegin();frame();assert.equal(Sound.enginePlaying,false);
  listeners.AudioInterruptionEnd();frame();assert.equal(Sound.enginePlaying,true);
  game.paused=true;frame();assert.equal(Sound.enginePlaying,false);
});
