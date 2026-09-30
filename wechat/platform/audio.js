"use strict";

// 音频资源由 tools/build-wechat.cjs 根据原有乐谱/音效确定性生成。
// 音乐独占一个播放器，音效最多六个；切后台立即停止，两种开关互不干扰。
class MiniGameSound {
  constructor(wx,{config,chapters},isHidden) {
    this.wx=wx;this.config=config;this.chapters=chapters;this.isHidden=isHidden;
    this.enabled=true;this.musicEnabled=true;this.unavailable=false;this.unlocked=false;
    this.theme=null;this.music=null;this.musicPlaying=false;this.pool=[];this.last={};this.active=false;this.failedMusic=new Set();
    this.interrupted=false;
    if(wx.onAudioInterruptionBegin)wx.onAudioInterruptionBegin(()=>{this.interrupted=true;this.stop();});
    if(wx.onAudioInterruptionEnd)wx.onAudioInterruptionEnd(()=>{this.interrupted=false;this.musicPlaying=false;this.failedMusic.clear();});
    try{const raw=wx.getStorageSync("traffic-defense-audio");const saved=raw?JSON.parse(raw):null;if(saved){this.enabled=saved.effects!==false;this.musicEnabled=saved.music!==false;}}catch{}
  }
  makePlayer() {
    const player=this.wx.createInnerAudioContext();player.volume=.4;player.obeyMuteSwitch=false;
    const stopped=()=>{if(player===this.music)this.musicPlaying=false;if(player===this.engine)this.enginePlaying=false;};
    if(player.onPause)player.onPause(stopped);
    if(player.onStop)player.onStop(stopped);
    player.onError(error=>{
      console.warn("音频播放失败",error.errCode||error.errMsg||"unknown");
      if(player===this.music){this.musicPlaying=false;this.failedMusic.add(this.theme);}
      if(player===this.engine){this.enginePlaying=false;this.engineFailed=true;}
      const slot=this.pool.find(item=>item.player===player);if(slot)slot.busy=false;
    });
    return player;
  }
  unlock() {
    if(this.unlocked||this.unavailable)return;
    try{
      // 手机静音拨片不应压过游戏内的音乐开关；仍遵守用户保存的静音设置。
      if(this.wx.setInnerAudioOption)this.wx.setInnerAudioOption({obeyMuteSwitch:false,mixWithOther:true});
      this.music=this.makePlayer();this.music.loop=true;this.music.volume=.5;this.unlocked=true;
    }
    catch{this.unavailable=true;}
  }
  stop(channel=null) {
    if(channel!=="music"&&this.engine){this.engine.stop();this.enginePlaying=false;}
    if(channel!=="effects"&&this.music){if(this.music.pause)this.music.pause();else this.music.stop();this.musicPlaying=false;}
    if(channel!=="music")for(const slot of this.pool){slot.player.stop();slot.busy=false;}
  }
  toggle(kind) {
    if(kind==="music")this.musicEnabled=!this.musicEnabled;else this.enabled=!this.enabled;
    this.stop(kind==="music"?"music":"effects");if(kind==="music")this.failedMusic.clear();this.unlock();
    try{this.wx.setStorageSync("traffic-defense-audio",JSON.stringify({effects:this.enabled,music:this.musicEnabled}));}catch{}
  }
  play(kind) {
    if(!this.enabled||!this.unlocked||this.unavailable||this.isHidden()||this.interrupted)return;
    const allowed=["rail","signal","missile","strike","clash","build","upgrade","win","lose","leak","wave","freeze","brake","gate","radio-construction","radio-tunnel","radio-tidal","radio-bridge","radio-bus","radio-emergency"];
    if(!allowed.includes(kind))kind="freeze";
    const now=Date.now();if(now-(this.last[kind]??-10000)<(kind==="brake"?1800:kind==="rail"?100:180))return;this.last[kind]=now;
    let slot=this.pool.find(item=>!item.busy);
    if(!slot&&this.pool.length<6){
      try{slot={player:this.makePlayer(),busy:false};const current=slot;slot.player.onEnded(()=>{current.busy=false;});this.pool.push(slot);}catch{return;}
    }
    if(!slot&&kind.startsWith("radio-")){slot=this.pool[0];slot.player.stop();}
    if(!slot)return;
    slot.busy=true;slot.player.volume=kind.startsWith("radio-")?.55:.4;slot.player.src=`audio/${kind}.wav`;slot.player.play();
  }
  update(game) {
    const active=this.unlocked&&!this.isHidden()&&!this.interrupted&&!game.modal&&!(game.screen==="battle"&&game.paused);
    if(!active){if(this.active)this.stop();this.active=false;return;}
    this.active=true;
    const volume=this.enabled&&game.traffic&&game.screen==="battle"?game.traffic.engineVolume||0:0;
    if(volume>0&&!this.engineFailed){
      if(!this.engine){this.engine=this.makePlayer();this.engine.loop=true;this.engine.src="audio/engine.wav";}
      this.engine.volume=volume;
      if(!this.enginePlaying){this.enginePlaying=true;this.engine.play();}
    }else if(this.enginePlaying){this.engine.stop();this.enginePlaying=false;}
    const theme=this.chapters[game.screen==="menu"||game.screen==="home"?game.menuChapter:game.level.chapter].theme;
    if(theme!==this.theme){if(this.theme)this.stop("music");this.theme=theme;this.music.src=`audio/music-${theme}.wav`;}
    if(this.musicEnabled&&!this.musicPlaying&&!this.failedMusic.has(theme)){this.musicPlaying=true;this.music.play();}
  }
}
module.exports={MiniGameSound};
