"use strict";

// 存档只记录永久解锁与最好星级；金币、局内升级每次挑战重新计算。
const Progress = {
  blank:()=>({schema:3,stars:LEVELS.map(()=>0)}),
  load() {
    try {
      const data=JSON.parse(localStorage.getItem(CONFIG.saveKey));
      if(!Array.isArray(data?.stars))return this.blank();
      return {schema:3,stars:LEVELS.map((_,i)=>Number.isInteger(data.stars[i])?Math.max(0,Math.min(3,data.stars[i])):0)};
    } catch {return this.blank();}
  },
  save(progress) {try{localStorage.setItem(CONFIG.saveKey,JSON.stringify(progress));return true;}catch{return false;}},
  unlocked(progress) {let index=0;while(index<LEVELS.length-1&&progress.stars[index]>0)index++;return index;}
};
