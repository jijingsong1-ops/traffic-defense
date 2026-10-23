"use strict";

// 局内设施不写入存档；金币、时间、范围和库存统一由本表提供。
const WORLD_RULES = {
  barrier:{name:"路障包",cost:60,stock:2,radius:125,duration:5,slow:.3},
  repair:{name:"抢修箱",cost:80,stock:2,heal:26},
  helpers:{name:"应急小队",cost:120,stock:1,duration:36},
  cache:{duration:8,reward:65,threatRange:120},
  relay:{cost:45,duration:12,cooldown:42,radius:220,haste:.3},
  mechanism:{cost:40,duration:8,cooldown:35,radius:150},
  challenge:{warning:3,duration:35,reward:100}
};
// 每章八关的可选行动：单设施关与双设施关交替，不把所有玩法堆进一张地图。
const WORLD_STAGE_ACTIONS = [
  ["shop"], ["shop","cache"], ["mechanism"], ["relay","challenge"],
  ["cache"], ["shop","mechanism"], ["relay"], ["shop","challenge"]
];
const WORLD_THEMES = {
  city:{shop:"公路驿站",cache:"备用物资",mechanism:"路口道闸",effect:"slow",note:"道闸放行减速：范围内敌车降速55%。"},
  country:{shop:"农机铺",cache:"谷仓物资",mechanism:"灌渠水闸",effect:"slow",note:"开启水闸形成湿滑路段，敌车降速55%。"},
  desert:{shop:"车队营地",cache:"遗落货箱",mechanism:"沙雾风机",effect:"silence",note:"沙雾抑制支援与护盾再生，并使敌车降速30%。"},
  hills:{shop:"山路工棚",cache:"矿场材料",mechanism:"落石机关",effect:"impact",note:"落石造成70物理范围伤害，再将敌车降速35%。"},
  sea:{shop:"救援船坞",cache:"漂流货箱",mechanism:"声呐浮标",effect:"silence",note:"声呐抑制支援与护盾再生，并使敌舰降速30%。"},
  forest:{shop:"巡林驿站",cache:"林间储备",mechanism:"藤蔓绞盘",effect:"roots",note:"绞盘拉紧藤障，敌车降速60%，普通车辆短暂冻结。"}
};
