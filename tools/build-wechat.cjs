"use strict";
// 不使用 eval / new Function：按网页版明确的脚本顺序，在构建时合并共享逻辑。
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
// 微信包已冻结；网页开发不触发重建。恢复手机维护时才显式传入此参数。
if(!process.argv.includes("--update-wechat")){
  console.error("微信版暂时冻结在 v0.13.0，网页版无需构建。明确恢复手机维护后才使用 --update-wechat。");
  process.exit(1);
}
const root=path.resolve(__dirname,".."),out=path.join(root,"wechat");
const read=file=>fs.readFileSync(path.join(root,file),"utf8").replace(/^\uFEFF/,"");
const adapters=new Set(["src/main.js","src/platform/browser.js","src/render/browser.js","src/render/mobile-art.js","src/render/mobile.js","src/render/mobile-layout.js"]);
const files=[...read("index.html").matchAll(/<script defer src="([^"]+)"><\/script>/g)].map(m=>m[1]).filter(f=>!adapters.has(f));
const shared=files.map(file=>`// ---- ${file} ----\n${read(file)}`).join("\n");
const prefix='"use strict";\n// 此文件自动生成；仅恢复手机维护时运行 node tools/build-wechat.cjs --update-wechat。\nconst Platform=require("./platform/wechat.js").createPlatform(wx);\nconst canvas=Platform.canvas;\nconst ctx=canvas.getContext("2d");\n';
const suffix='\nPlatform.initialize(CONFIG,ctx);\nconst game=new Game();\nmodule.exports={game};\n';
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,"game.bundle.js"),prefix+shared+'\n'+read("src/render/mobile-art.js")+'\n'+read("src/render/mobile.js")+'\n'+read("src/render/mobile-layout.js")+suffix);
// 使用现有声音代码调度音符，再离线合成 WAV，避免两套音乐内容漂移。
const sandbox={Platform:{storage:{getItem:()=>null}},console};vm.createContext(sandbox);
const api=vm.runInContext(read("src/config.js")+read("src/data/music.js")+read("src/core/audio.js")+'\n({SoundEngine,MUSIC_TRACKS})',sandbox);
const rate=16000;
function render(notes,duration,loop,filename){
  const samples=new Float64Array(Math.ceil(duration*rate));
  for(const n of notes){
    let phase=0;
    for(let i=0;i<Math.ceil(n.duration*rate);i++){
      const time=i/rate,fraction=time/n.duration;
      const frequency=n.frequency*Math.pow(n.endFrequency/n.frequency,fraction);phase+=frequency/rate;
      const cycle=phase%1;
      const wave=n.wave==="square"?(cycle<.5?1:-1):n.wave==="sawtooth"?2*cycle-1:n.wave==="triangle"?1-4*Math.abs(cycle-.5):Math.sin(phase*Math.PI*2);
      const envelope=time<.012?time/.012:Math.pow(.0001/n.volume,(time-.012)/Math.max(.001,n.duration-.012));
      let index=Math.floor(n.start*rate)+i;if(loop)index%=samples.length;
      if(index<samples.length)samples[index]+=wave*n.volume*envelope;
    }
  }
  let peak=0;for(const value of samples)peak=Math.max(peak,Math.abs(value));
  const gain=peak?Math.min(4,.72/peak):1;
  const buffer=Buffer.alloc(44+samples.length*2);
  buffer.write("RIFF",0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write("WAVEfmt ",8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write("data",36);buffer.writeUInt32LE(samples.length*2,40);
  for(let i=0;i<samples.length;i++)buffer.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]*gain))*32767),44+i*2);
  fs.writeFileSync(path.join(out,"audio",filename),buffer);
}
fs.mkdirSync(path.join(out,"audio"),{recursive:true});
function recorder(){
  const sound=new api.SoundEngine(),notes=[];sound.context={currentTime:0};
  sound.tone=(frequency,duration=.12,wave="triangle",volume=.15,delay=0,endFrequency=frequency)=>notes.push({frequency,duration,wave,volume,start:sound.context.currentTime+delay,endFrequency});
  return {sound,notes};
}
for(const [theme,track] of Object.entries(api.MUSIC_TRACKS)){
  sandbox.CHAPTERS=[{theme}];const {sound,notes}=recorder();const step=30/track.bpm;
  for(let i=0;i<track.melody.length;i++){sound.context.currentTime=i*step;sound.nextMusic=0;sound.update({screen:"menu",menuChapter:0});}
  render(notes,track.melody.length*step,true,`music-${theme}.wav`);
}
for(const kind of ["rail","signal","missile","strike","clash","build","upgrade","win","lose","leak","wave","freeze","brake","gate","engine"]){
  const {sound,notes}=recorder();sound.play(kind);
  render(notes,Math.max(...notes.map(n=>n.start+n.duration))+.025,false,`${kind}.wav`);
}
for(const kind of ["construction","tunnel","tidal","bridge","bus","emergency"]){
  const name=`radio-${kind}.wav`;
  fs.copyFileSync(path.join(root,"assets/audio",name),path.join(out,"audio",name));
}
const bytes=fs.readdirSync(path.join(out,"audio")).reduce((sum,f)=>sum+fs.statSync(path.join(out,"audio",f)).size,0)+Buffer.byteLength(prefix+shared+suffix);
console.log(`已生成微信工程：${out}\n共享脚本 ${files.length} 个，6首章节配乐、15种音效、6段中文广播，代码及音频约 ${(bytes/1024/1024).toFixed(2)} MiB。`);
