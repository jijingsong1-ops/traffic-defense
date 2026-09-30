"use strict";

// 合成音效与轻量配乐，交通广播从包内WAV播放；首次真实点击后启用音频上下文。
class SoundEngine {
  constructor() {
    this.enabled=true;this.musicEnabled=true;this.context=null;this.voices=new Set();this.musicVoices=new Set();this.theme=null;this.last={};this.note=0;this.nextMusic=0;this.unavailable=false;
    try{const saved=JSON.parse(Platform.storage.getItem("traffic-defense-audio"));if(saved){this.enabled=saved.effects!==false;this.musicEnabled=saved.music!==false;}}catch{}
  }
  unlock() {
    try {
      if(!this.context) {
        this.context=Platform.createAudioContext();
        if(!this.context){this.unavailable=true;return;}
        this.master=this.context.createGain();this.master.gain.value=CONFIG.audioVolume;this.master.connect(this.context.destination);
      }
      if(this.context.state==="suspended")this.context.resume().catch(()=>{});
    }catch{this.unavailable=true;}
  }
  stop(channel = null) {
    if(channel!=="music"&&this.radio){this.radio.pause();this.radio=null;}
    for (const voice of [...this.voices]) {
      const music = this.musicVoices.has(voice);
      if (channel && (channel === "music") !== music) continue;
      try { voice.stop(); } catch {}
      this.voices.delete(voice); this.musicVoices.delete(voice);
    }
    if (channel !== "effects") this.nextMusic = 0;
  }
  toggle(kind) {
    if(kind==="music")this.musicEnabled=!this.musicEnabled;else this.enabled=!this.enabled;
    this.stop(kind === "music" ? "music" : "effects");this.unlock();
    try{Platform.storage.setItem("traffic-defense-audio",JSON.stringify({effects:this.enabled,music:this.musicEnabled}));}catch{}
  }
  tone(frequency,duration=.12,wave="triangle",volume=.15,delay=0,endFrequency=frequency,channel="effects") {
    const c=this.context;if(!c||c.state!=="running"||Platform.hidden||this.voices.size>=24)return;
    const oscillator=c.createOscillator(),gain=c.createGain(),start=c.currentTime+delay;
    oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency,start);oscillator.frequency.exponentialRampToValueAtTime(Math.max(25,endFrequency),start+duration);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    oscillator.connect(gain);gain.connect(this.master);this.voices.add(oscillator);if(channel==="music")this.musicVoices.add(oscillator);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(oscillator);this.musicVoices.delete(oscillator);};
    oscillator.start(start);oscillator.stop(start+duration+.02);
  }
  play(kind) {
    if(!this.enabled||!this.context||this.unavailable)return;
    const now=this.context.currentTime;if(now-(this.last[kind]??-100)<(kind==="brake"?1.8:kind==="rail"?.1:.18))return;this.last[kind]=now;
    if(kind.startsWith("radio-")){
      if(typeof Audio!=="undefined"&&!Platform.hidden){if(this.radio)this.radio.pause();this.radio=new Audio(`assets/audio/${kind}.wav`);this.radio.volume=.55;this.radio.play().catch(()=>{});}
      return;
    }
    if(kind==="rail")this.tone(730,.08,"triangle",.13,0,180);
    else if(kind==="signal")[660,440].forEach((f,i)=>this.tone(f,.08,"sine",.1,i*.09));
    else if(kind==="missile"){this.tone(140,.22,"triangle",.14,0,55);this.tone(850,.06,"square",.04,.1,430);}
    else if(kind==="strike")this.tone(105,.28,"sawtooth",.16,0,28);
    else if(kind==="gate")[880,660].forEach((f,i)=>this.tone(f,.11,"sine",.14,i*.13));
    else if(kind==="brake"){this.tone(1100,.3,"sawtooth",.035,0,230);this.tone(180,.22,"triangle",.1);}
    else if(kind==="engine")for(let i=0;i<10;i++)this.tone(68+i%3*8,.3,"triangle",.1,i*.2,62);
    else if(kind==="clash")this.tone(210,.08,"square",.07,0,80);
    else if(kind==="build") [262,392].forEach((f,i)=>this.tone(f,.18,"triangle",.2,i*.1));
    else if(kind==="upgrade"||kind==="win")[262,330,392,523].forEach((f,i)=>this.tone(f,.3,"triangle",.2,i*.12));
    else if(kind==="lose"||kind==="leak")[220,164,110].forEach((f,i)=>this.tone(f,.2,"triangle",.18,i*.09));
    else if(kind==="wave")[196,294,392].forEach((f,i)=>this.tone(f,.18,"square",.09,i*.12));
    else this.tone(530,.1,"sine",.13,0,780);
  }
  musicNote(note, duration, voice, volume) {
    if (note === null || note === undefined) return;
    const frequency = 440 * 2 ** ((note - 69) / 12);
    this.tone(frequency, duration, voice, volume, 0, frequency, "music");
  }
  update(game) {
    const active = this.context && !Platform.hidden && !(game.screen === "battle" && game.paused) && !game.modal;
    if (!active) { if (this.wasActive) this.stop(); this.wasActive = false; return; }
    this.wasActive = true;
    if(this.enabled&&typeof Traffic!=="undefined"&&game.traffic&&this.context.currentTime>=(this.nextEngine||0)){
      const volume=Traffic.engineLevel(game);
      if(volume>0)this.tone(75,.48,"triangle",volume,0,62);
      this.nextEngine=this.context.currentTime+.38;
    }
    const chapter = game.screen === "menu" || game.screen === "home" ? game.menuChapter : game.level.chapter;
    const theme = CHAPTERS[chapter].theme;
    if (theme !== this.theme) { this.stop("music"); this.theme = theme; this.note = 0; }
    if (!this.musicEnabled || this.context.currentTime < this.nextMusic) return;
    const track = MUSIC_TRACKS[theme], step = 30 / track.bpm;
    const beat = this.note % track.meter, bar = Math.floor(this.note / track.meter);
    const note = track.melody[this.note % track.melody.length];
    this.musicNote(note, step * track.gate, track.voice, track.voice === "square" ? .024 : .065);
    if (theme === "forest" && note !== null) this.musicNote(note + 12, step * .7, "sine", .018);
    if (beat === 0) {
      this.musicNote(track.bass[bar % track.bass.length], step * 2.7, "triangle", .075);
      for (const chord of track.chords[bar % track.chords.length]) this.musicNote(chord, step * 3.2, "sine", .014);
    } else if (beat === Math.floor(track.meter / 2)) {
      this.musicNote(track.bass[bar % track.bass.length] + 7, step * 1.4, "triangle", .036);
    }
    if (track.drums.includes(beat)) this.tone(beat === 0 ? 100 : 190, .08, "triangle", .048, 0, 38, "music");
    this.note++;
    // 按音频时钟推进，不受游戏倍速影响；卡顿后不补发积压音符。
    this.nextMusic = this.context.currentTime + step;
  }
}
const Sound = Platform.createSound ? Platform.createSound({config:CONFIG,chapters:CHAPTERS}) : new SoundEngine();
