// 浏览器适配回归：使用真实入口、真实输入事件和冻结微信数据，无外部依赖。
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const scripts=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script defer src="([^"]+)"><\/script>/g)].map(m=>m[1]);
const source=scripts.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
const exportsCode='({game,Platform,Renderer,MobileLayout,Sound,Progress,CONFIG,MAP,LEVELS,CHAPTERS,TOWERS,ENEMIES,EVOLUTIONS,ROAD_TYPES,SKILLS})';

function boot(width=1366,height=768,saved=new Map()){
  let rect={left:7,top:11,width,height};
  const listeners={canvas:{},window:{},document:{}},frames=[],texts=[],transforms=[];
  const noop=()=>{};
  const context=new Proxy({fillText:(text,x,y)=>texts.push({text,x,y}),setTransform:(...args)=>transforms.push(args)},
    {get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
  const canvas={style:{},focus:noop,getContext:()=>context,getBoundingClientRect:()=>rect,
    addEventListener:(name,fn)=>listeners.canvas[name]=fn,
    requestFullscreen:async()=>{document.fullscreenElement=canvas;listeners.document.fullscreenchange();}};
  const document={hidden:false,getElementById:()=>canvas,addEventListener:(name,fn)=>listeners.document[name]=fn,
    exitFullscreen:async()=>{document.fullscreenElement=null;listeners.document.fullscreenchange();}};
  const window={devicePixelRatio:3,addEventListener:(name,fn)=>listeners.window[name]=fn};
  const sandbox={console,document,window,requestAnimationFrame:fn=>frames.push(fn),
    localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)}};
  vm.createContext(sandbox);
  const api=vm.runInContext(source+'\n'+exportsCode,sandbox);
  const draw=()=>{texts.length=0;api.Renderer.draw(api.game);api.Platform.present(api.game);};
  const event=(point,extra={})=>({clientX:rect.left+point.x*api.Platform.viewport.scale,
    clientY:rect.top+point.y*api.Platform.viewport.scale,button:0,pointerId:1,isPrimary:true,...extra});
  const move=point=>{listeners.canvas.pointermove(event(point));draw();};
  const tap=point=>{listeners.canvas.pointerdown(event(point));listeners.canvas.pointerup(event(point));draw();};
  const press=match=>{draw();const b=api.game.buttons.find(typeof match==='function'?match:b=>b.label===match);
    assert.ok(b,'button '+match);tap({x:b.x+b.w/2,y:b.y+b.h/2});};
  const key=(key,extra={})=>{listeners.window.keydown({key,preventDefault:noop,...extra});draw();};
  let time=0;const frame=(delta=16.667)=>{time+=delta;frames.shift()(time);};
  draw();
  return {...api,canvas,document,listeners,frames,texts,transforms,saved,draw,event,tap,move,press,key,frame,
    tapWorld:p=>tap(api.MobileLayout.toScreen(api.game,p)),
    resize:(width,height)=>{rect={...rect,width,height};listeners.window.resize();draw();}};
}
function start(api){api.press('开始游戏');api.press('新建');api.press(b=>b.levelIndex===0);api.press('开始战斗');}

test('web opens home, dated saves, atlas and brief before battle, and exits without erasing progress',()=>{
  const a=boot(),{game,press}=a;
  assert.equal(game.screen,'home');press('读取存档');assert.equal(game.modal,'saveSlots');
  assert.equal(game.buttons.filter(b=>b.label==='读取'&&b.disabled).length,3);press('关闭');
  start(a);assert.equal(game.screen,'battle');assert.equal(a.Progress.list().filter(Boolean).length,1);
  a.key('Escape');assert.equal(game.modal,'battleMenu');press('返回章节地图');press('确认');
  press('‹ 首页');const saved=JSON.stringify([...a.saved]);press('退出游戏');
  assert.equal(a.Platform.hidden,true);assert.ok(a.texts.some(t=>t.text==='已退出游戏'));
  assert.equal(JSON.stringify([...a.saved]),saved);press('返回首页');assert.equal(game.screen,'home');assert.equal(a.Platform.hidden,false);
  press('读取存档');press(b=>b.label==='读取'&&!b.disabled);assert.equal(game.screen,'menu');
});

test('mouse coordinates and hovered tower ranges stay correct across resize and high-DPI screens',()=>{
  const a=boot(),{game,Platform,MobileLayout}=a;start(a);game.paused=true;
  const site=game.sites[0];a.tapWorld(site);assert.equal(game.selectedSite,site);
  const card=game.buttons.find(b=>b.towerType==='rail');a.move({x:card.x+card.w/2,y:card.y+card.h/2});
  assert.equal(game.previewTowerType,'rail');assert.equal(a.canvas.style.cursor,'pointer');
  a.press(b=>b.towerType==='rail');const tower=game.towers[0];assert.ok(tower);assert.equal(game.gold,270);
  a.press(b=>b.label?.startsWith('强化'));assert.equal(tower.level,2);
  const locks=game.buttons.filter(b=>b.branch!==undefined);assert.equal(locks.length,2);assert.ok(locks.every(b=>b.disabled&&b.locked));
  a.press(b=>b.branch===0);assert.equal(tower.level,2);assert.equal(game.gold,210);
  a.key('Escape');a.resize(1920,1080);a.tapWorld(tower);assert.equal(game.selected,tower);
  assert.equal(game.towers[0],tower);assert.equal(a.canvas.width,3840);assert.equal(a.canvas.height,2160);
  assert.equal(Platform.viewport.scale,1.25);assert.equal(game.accumulator,0);
  const p=MobileLayout.toScreen(game,site),back=Platform.toCanvas(a.event(p));
  assert.ok(Math.abs(back.x-p.x)<1e-8&&Math.abs(back.y-p.y)<1e-8);
  a.key('Escape');a.resize(900,700);a.tapWorld(tower);assert.equal(game.selected,tower);
  assert.equal(tower.x,site.x);assert.equal(tower.y,site.y);assert.equal(game.gold,210);
});

test('all screen controls fit desktop, tablet, narrow and ultrawide browser windows',()=>{
  for(const [width,height] of [[900,700],[1024,768],[1366,768],[1920,1080],[2560,1080],[700,900]]){
    const a=boot(width,height),{game,Platform}=a;
    const bounds=()=>{for(const b of game.buttons){
      assert.ok(b.x>=-.01&&b.y>=-.01&&b.x+b.w<=Platform.layout.width+.01&&b.y+b.h<=Platform.layout.height+.01,
        width+'x'+height+' '+(b.label||b.towerType||b.levelIndex));
    }};
    bounds();a.press('开始游戏');bounds();a.press('新建');bounds();
    for(let i=0;i<6;i++){game.selectChapter(i);a.draw();bounds();}
    game.selectChapter(0);a.draw();a.press(b=>b.levelIndex===0);bounds();
    a.press('进化研究');bounds();a.press('关闭');a.press('开始战斗');bounds();
    const header=game.buttons.filter(b=>b.y<100);
    for(let i=0;i<header.length;i++)for(const b of header.slice(i+1)){
      const c=header[i];assert.ok(c.x+c.w<=b.x||b.x+b.w<=c.x||c.y+c.h<=b.y||b.y+b.h<=c.y,'overlapping header');
    }
    for(const site of [game.sites[0],game.sites.at(-1)]){
      game.cancel();a.draw();a.tapWorld(site);bounds();a.press(b=>b.towerType==='rail');bounds();
    }
    a.key('Escape');a.key('Escape');bounds();
    a.press('返回章节地图');bounds();a.press('取消');bounds();
    game.modal=null;game.finish(true);a.draw();bounds();
  }
});

test('dragging, canceled pointers and non-primary input cannot build; keyboard respects modal state',()=>{
  const a=boot(),{game,listeners}=a;start(a);a.key(' ');assert.equal(game.paused,true);
  const site=game.sites[0],p=a.MobileLayout.toScreen(game,site),down=a.event(p);
  listeners.canvas.pointerdown(down);listeners.canvas.pointermove({...down,clientX:down.clientX+30});listeners.canvas.pointerup(down);
  assert.equal(game.selectedSite,null);
  listeners.canvas.pointerdown(down);listeners.canvas.pointercancel();listeners.canvas.pointerup(down);assert.equal(game.selectedSite,null);
  listeners.canvas.pointerdown(down);listeners.canvas.pointerdown({...down,pointerId:2,isPrimary:false});listeners.canvas.pointerup(down);assert.equal(game.selectedSite,null);
  a.tapWorld(site);a.key('1');assert.equal(game.towers.length,1);
  a.key('Escape');a.key('Escape');assert.equal(game.modal,'battleMenu');
  const before=game.paused;a.key(' ');a.key('q');assert.equal(game.paused,before);assert.equal(game.skill,null);
  a.key('Escape');a.key('q');assert.equal(game.skill,'strike');
  listeners.canvas.contextmenu({preventDefault:()=>{}});assert.equal(game.skill,null);
  const music=a.Sound.musicEnabled;a.key('m');assert.equal(a.Sound.musicEnabled,!music);
  a.key('m',{ctrlKey:true});assert.equal(a.Sound.musicEnabled,!music);
});

test('background and focus transitions pause simulation without applying elapsed wall time',()=>{
  const a=boot(),{game,listeners,Platform}=a;start(a);game.startWave();a.frame();a.frame();
  const state=()=>JSON.stringify({gold:game.gold,wave:game.wave,lives:game.lives,time:game.prepareTime,positions:game.enemies.map(e=>[e.x,e.y])});
  const before=state();listeners.window.blur();assert.equal(game.paused,true);assert.equal(Platform.hidden,true);
  a.frame(60000);assert.equal(state(),before);listeners.window.focus();a.frame(60000);assert.equal(state(),before);
  a.press('继续');a.frame();assert.notEqual(state(),before);
  a.document.hidden=true;listeners.document.visibilitychange();assert.equal(game.paused,true);
  const paused=state();a.frame(60000);a.document.hidden=false;listeners.document.visibilitychange();a.frame(60000);
  assert.equal(state(),paused);assert.equal(game.accumulator,0);
});

test('fullscreen can enter and exit, and unavailable or rejected requests show a browser message',async()=>{
  const a=boot(),{Platform}=a;
  await Platform.toggleFullscreen();assert.equal(a.document.fullscreenElement,a.canvas);
  await Platform.toggleFullscreen();assert.equal(a.document.fullscreenElement,null);
  a.canvas.requestFullscreen=undefined;await Platform.toggleFullscreen();assert.match(a.game.message,/不支持全屏/);
  a.canvas.requestFullscreen=async()=>{throw Error('denied');};await Platform.toggleFullscreen();assert.match(a.game.message,/无法进入全屏/);
});

test('web keeps the established map geometry and tower art while traffic rules evolve independently',()=>{
  const a=boot(),noop=()=>{},ctx=new Proxy({},{get:()=>noop});
  const Platform={touch:true,canvas:{getContext:()=>ctx},storage:{getItem:()=>null},initialize:noop,bindInput:noop};
  const sandbox={console,wx:{},module:{exports:{}},requestAnimationFrame:noop,require:()=>({createPlatform:()=>Platform})};
  vm.createContext(sandbox);
  const phone=vm.runInContext(fs.readFileSync(path.join(root,'wechat/game.bundle.js'),'utf8')+'\n'+exportsCode,sandbox);
  for(const key of ['MAP','LEVELS','CHAPTERS','TOWERS','EVOLUTIONS','ROAD_TYPES','SKILLS']){
    assert.equal(JSON.stringify(a[key]),JSON.stringify(phone[key]),key);
  }
  assert.ok(a.CONFIG.enemyHealthMultiplier>phone.CONFIG.enemyHealthMultiplier);
  assert.ok(a.CONFIG.bossHealthMultiplier>phone.CONFIG.bossHealthMultiplier);
  assert.ok(a.ENEMIES.demolisher.bridgeDamage>0&&a.ENEMIES.raider.busDamage>0);
});
