"use strict";

// 三个独立战役位。只保存通关/研究进度，不保存正在进行的战斗。
const Progress = {
  blank: () => ({schema:5, stars:LEVELS.map(() => 0), skills:SkillBook.blank()}),
  clean(data) {
    const stars=LEVELS.map((_,i) => Number.isInteger(data?.stars?.[i]) ? Math.max(0,Math.min(3,data.stars[i])) : 0);
    return {schema:5, stars, skills:SkillBook.clean(data?.skills,stars)};
  },
  read() {
    const empty={schema:4, activeSlot:0, slots:[null,null,null]};
    try {
      const data=JSON.parse(Platform.storage.getItem(CONFIG.saveKey));
      // 旧版只有一个战役；迁入第一位，保留星级，不猜测原始创建日期。
      if(Array.isArray(data?.stars)) {
        empty.slots[0]={...this.clean(data),createdAt:0,lastPlayedAt:0};
        return empty;
      }
      if(data?.schema!==4||!Array.isArray(data.slots))return empty;
      empty.slots=empty.slots.map((_,i)=>{
        const slot=data.slots[i];
        if(!Array.isArray(slot?.stars))return null;
        return {...this.clean(slot),createdAt:Number.isFinite(slot.createdAt)&&slot.createdAt>0?slot.createdAt:0,
          lastPlayedAt:Number.isFinite(slot.lastPlayedAt)&&slot.lastPlayedAt>0?slot.lastPlayedAt:0};
      });
      empty.activeSlot=Number.isInteger(data.activeSlot)&&empty.slots[data.activeSlot]?data.activeSlot:Math.max(0,empty.slots.findIndex(Boolean));
      return empty;
    } catch { return empty; }
  },
  list() { return this.read().slots; },
  exists() { return this.list().some(Boolean); },
  load(slotId=this.read().activeSlot) { return this.clean(this.read().slots[slotId]); },
  write(data) {
    try { Platform.storage.setItem(CONFIG.saveKey,JSON.stringify(data)); return true; }
    catch { return false; }
  },
  save(progress,slotId=this.read().activeSlot,replace=false) {
    if(!Number.isInteger(slotId)||slotId<0||slotId>=3)return false;
    const data=this.read(),previous=replace?null:data.slots[slotId],now=Date.now();
    data.slots[slotId]={...this.clean(progress),createdAt:previous?previous.createdAt:now,lastPlayedAt:now};
    data.activeSlot=slotId;
    return this.write(data);
  },
  select(slotId) {
    const data=this.read();
    if(!Number.isInteger(slotId)||!data.slots[slotId])return false;
    data.activeSlot=slotId;data.slots[slotId].lastPlayedAt=Date.now();
    return this.write(data);
  },
  dateLabel(timestamp) {
    if(!timestamp)return "旧存档 · 原始日期未记录";
    const date=new Date(timestamp),pad=value=>String(value).padStart(2,"0");
    return `${date.getFullYear()}/${pad(date.getMonth()+1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },
  unlocked(progress) { let index=0;while(index<LEVELS.length-1&&progress.stars[index]>0)index++;return index; }
};
