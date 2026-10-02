# 开发与目录说明

网页版无需构建工具、依赖安装或外部素材。双击根目录 `index.html` 即可运行；部署时需上传 `index.html`、`src/`、`assets/`，不能只上传 HTML。当前只维护网页版，微信产物冻结在 v0.13.0；不要因网页修改重建或上传微信工程。

## 目录

```text
index.html                 网页入口，按顺序加载脚本
README.md                  运行方式、操作说明和当前版本
src/
  config.js                难度、人物比例、画布和通用参数
  data/
    towers.js              四种设施、48条章节进化与研究条件
    skills.js              六种技能、二选一进化、星星预算与等级数值
    mechanics.js           独立机制词条与搭配建议
    enemies.js             敌人属性与图鉴介绍
    levels.js              六章48关、独立路线、变道事件与波次参数
    music.js               六章独立旋律、和弦、节拍与音色
  core/
    collision.js           距离、线段和矩形检测
    combat-rules.js         物理/魔法抗性、敌军能力、图鉴机制与反制说明
    skills.js              六技能施放、持续区域、抢修和超频
    road-network.js        有向路网、道路投影和固定建造地块
    encounters.js          出车口倾向、确定性车组、战前统计与实际出场
    lanes.js               四车道偏移、转角衔接与占道检测
    traffic.js             路况速度、临时分流、站点伏击、桥梁载重与民用车辆
    storage.js             本地星级存档
    audio.js               合成音效、音乐和静音设置
  entities.js              车辆、设施、拦截队员、弹体与伤害规则
  game.js                  主循环、定时波次、点击交互与经济
  render/
    renderer.js            地图、车辆、界面和基础绘图函数
    facilities.js          四种设施、队员、信标与后坐外观
    traffic.js             交通设施、任务HUD、导航与民用车绘制
    vehicles.js            车辆细节、轮胎、装甲、船体与章节设备
    combat.js              分级弹体、命中特效、波阵与连锁动画
    mobile-art.js          沿用手机的纸质交通图册、路牌、地标与铁链
    mobile.js              统一战场坐标及建造/升级/关卡/研究面板
    mobile-layout.js       全屏布局、安全区域与镜头换算
    browser.js             网页版号、桌面弹窗位置、全屏入口和悬停射程
    codex.js               简洁单位图鉴、机制详情、技能进化树与装备
  platform/browser.js      浏览器窗口、鼠标、快捷键、存储与生命周期
  main.js                  网页画布初始化与首页启动
assets/css/game.css        页面布局与画布样式
tests/game.test.cjs        玩法与战役自动化测试
tests/browser.test.cjs     浏览器输入、图鉴研究、布局、全屏及保留章节/基础造型一致性
tests/campaign-simulation.cjs 合法经济、目标保护与变道重新布防的通关模拟
tests/fixtures/            冻结微信 v0.13.0 的33文件哈希清单
docs/
  CHANGELOG.md             版本历史
  DEVELOPMENT.md           本说明
  TOWER-DESIGN.md          设施定位、美术与进化设计
  previews/
    current/               当前版本截图
    archive/               保留的旧版本截图
```

## 常见修改位置

v0.15新增技能/克制模块：技能数值只由 `SkillBook.stats()` 生成，开战时按当前关卡保存快照；图鉴直接读取 `Tower.stats`、敌人数据和 `SkillBook.stats()`。永久研究写入三个存档各自的 `skills`，花费由等级推导，避免维护容易漂移的第二份星星余额。技能装槽、升级和重配仅在章节地图允许，战斗图鉴只读。`core/combat-rules.js` 与 `core/skills.js` 在实体/Game前加载，`render/codex.js` 在网页渲染适配后、main前加载。微信构建若日后恢复，需单独评估这些新增模块的移植与兼容性。

- 人物大小：`src/config.js` 的 `soldierScale`，当前为 `0.64`。只影响绘制，不改变碰撞、生命或拦截能力；血条独立绘制。
- 设施数值与解锁：`src/data/towers.js`。城市第一路线按1/2/3/4次通关开放，第二路线按4/5/6/7次；后续章节延续章节研究。
- 设施外观：`src/render/facilities.js`。基础轮廓、专精模块和四级强化都在 `tower()`，小队员在 `soldier()`。
- 建造空地：`src/render/renderer.js` 的 `site()` 沿用交通图册地表，使用最近道路确定朝向和连接小径。造塔后仍保留底部地表；悬停/选中仅高亮空地。v0.16将路宽改为80、基座中心距路70、间距50，并沿路口补足合法地块；每关至少24处，排除当前和未来道路。冻结微信地块不改变。
- 新增关卡：`src/data/levels.js`；道路/建造规则在 `src/core/road-network.js`。
- 新增效果：先在 `src/entities.js` 实现战斗规则，再在 `towers.js` 配置能力与说明。

## 加载约定

`src/platform/browser.js` 最先提供浏览器输入、存档和声音接口；共享 `Game` 不直接注册 DOM 事件。网页在基础渲染后加载三个 `mobile-*.js` / `mobile.js` 文件，直接使用已有手机版的地图坐标与美术，再由 `src/render/browser.js` 补充网页交互，最后启动首页。这些文件保留原名是为了清楚追溯来源，不表示当前会更新微信工程。

`wechat/game.bundle.js`、微信平台文件和音频都是冻结产物，按 `tests/fixtures/wechat-v0.13.0.sha256.json` 校验。构建脚本默认拒绝执行；只有用户明确恢复手机维护后才运行 `node tools/build-wechat.cjs --update-wechat`。恢复时脚本会排除网页适配文件，并将三份通用界面各加载一次，避免重复变换地图；需要重新验证并更新冻结策略。当前网页版本号单独在 `src/render/browser.js` 声明。

使用原生普通脚本加 `defer`，不使用 ES Module 或 fetch，从而支持 `file://` 直接打开。所有脚本共享词法作用域；`index.html` 明确列出依赖顺序。数据先加载，基础逻辑和实体随后，渲染器先于设施美术扩展，`main.js` 最后启动。新增文件必须加入入口。

## 验证

```powershell
node --test tests/game.test.cjs tests/browser.test.cjs
node --test --test-name-pattern="frozen v0.13.0" tests/wechat.test.cjs
python -m http.server 8765
```

最后一条命令仅在需要网页服务时运行，浏览器打开 `http://localhost:8765`。测试读取 `index.html` 的脚本列表，使用与浏览器一致的顺序；包含模拟战斗、合法经济通关、研究门槛、拦截释放、声音、渲染与浏览器事件检查。

Git 上传前运行 `git status`。这次整理包含文件移动，`git add -A` 会同时记录新增路径和旧路径删除；提交后再 push。页面版本不会自动创建 Git 标签。

## 路线与章节音乐

`ROAD_LAYOUTS` 为每章提供8个独立布局。`paths` 是有向折线；`alternate` 是事件路线。动态关卡的新旧路线必须共享起点和第二个节点，车辆仅在第一个线段切换路径；经过岔口的车辆保留旧路径。`planConstructionSites` 同时排除当前和未来道路，保持地块坐标稳定。修改路线后应验证转角、交叉口和拦截位置。

`MUSIC_TRACKS` 独立配置 MIDI 音符、BPM、每小节八分拍数、和弦、低音、节奏与音色；海岛为6个八分拍。音乐用音频时钟，战斗倍速不改变节奏。音效与音乐共享总音量限制，但分别记录声音节点以便独立静音。

新增能力参数 `repair`（队员修复）、`shred`（削甲幅度，持续4秒）、`jam`（阻止护盾恢复的秒数）在实体中实现。章节外观模块由 `regionalEquipment` 绘制；`THEME_EQUIPMENT` 配置两路线配色。

## 攻击动画

`Tower.visual` 在发射时保存等级、分支、章节、颜色和连锁类型，交给弹体、光束和命中特效。`combat.js` 只绘制，不结算伤害；`fireTime`、`swingTime` 与特效寿命由模拟时间推进。新增特效仍应复用 `game.effect` / `game.beam` 的生命周期。基础射程在 towers.js，升级加成在 CONFIG 的 towerUpgradeRange / towerFinalRange。

## 统一战场与网页适配

`src/render/mobile.js` 在启动时一次性将战斗世界设为1280×720，按宽地图边界重算节点与地块。网页 CSS 默认将画布限制在居中的960×540窗口，保留四周至少24像素空白，空间不足时按16:9等比缩小；仅主动全屏时铺满屏幕。网页平台依据画布实际区域更新像素分辨率和 `Platform.layout`，像素比上限2，点击坐标扣除画布在页面中的偏移。`mobile-layout.js` 独立排列首页、章节地图、HUD、技能与弹窗，网页不预留微信胶囊。

战场通过等比镜头绘制固定世界；点击先检查屏幕按钮，再逆变换为世界坐标，调用 `Game.click(point, true)`，避免重复命中屏幕按钮。弹窗绘制时同步转换按钮命中框；网页弹窗就近放在所选设施一侧并约束在战场可用区域。调整尺寸不重新规划地块或重置战斗。`mobile-art.js` 只负责美术与视觉配色，研究判断与金币判断仍使用共享规则。网页监听 Pointer Events，拖动和取消手势不购买；失焦暂停、回前台不补算后台时间。

`Game.canStartWave` 统一约束界面和逻辑，手动/自动都要求上一波待出发队列为空。队列清空后才递减 `prepareTime`，时长由 `gapAfterWave(count)` 计算5–10秒；`waveDuration` 为圆环提供总时长。`startWave(true)` 自动发动不发钱，手动调用按 `earlyWaveReward` 计算剩余秒数奖励。通关测试的共用部署策略在 `tests/campaign-simulation.cjs`，同时覆盖已预告的变道道路。

## 三档与车距

`Progress.read()` 将旧单档规范为 schema 4 三位置容器，`save(progress, slotId)` 只写当前位并保留创建日期。`createdAt=0` 代表旧版未记录日期；禁止补造历史日期。`Game.activeSlot` 指定本次战役存档，`chooseSaveSlot` 将新建和读取分开，覆盖由 `pendingSlot` 指定。

`Enemy.followingDistance` 限制同车道快车的移动量，守卫拦截或冻结后车会在本车道排队，其他车道仍可通过。中心线里程用于路径进度，`Lanes` 用18间距生成四条车道，实际位置用于伤害、拦截、桥梁检测与车距校验，首领跨两条车道。分裂子车继承母车车道和实际路线，向后寻找空位；旧的无车道任务伏击车保留原有居中绕行行为。

## 确定性车组与敌情

`Encounters.entrances()` 按路径起点去重，每个入口保留可用路由编号、A/B/C标识及偏好。同入口的分流支路共用一份车组计划，调度改变路径而不改变敌军种类或总数；独立入口各自发车。`wave()` 返回带 `entry / due / members` 的编队，同组普通车同时进入四个不同车道，首领占1/2车道、两翼各一名护卫。一般每3.2秒出一组，随章节降至最低2.8秒；高速主力可按0.48秒计划间隔鱼贯进入。出场受实际入口空位约束，一个入口被堵不阻塞其他入口。

普通车计划数为 `7 + extraWaveEnemies + 波次×2 + enemyExtra + (入口数−1)×2`；当前 `extraWaveEnemies=4`。重甲、抗魔、高速入口优先配置对应车辆，支援入口约每组留一个辅助位，后期加入章节特殊能力车。破拆、首领和护卫另外加入。`roster()` 从全关计划统计主队数量及分裂增援上限，公交站点伏击单列，战前界面与实际出场共用这些计划。计数按静态关卡对象缓存；日后编辑器若原地改关卡，需要清除该对象的缓存。

普通生命倍率1.55、首领2.1，逐波增长1.15。不同终点需要独立布防，因此每多一个终点增加350G初始预算，配置在 `splitFrontGold`，简报展示的初始金币包含该预算。扩展敌人时同时维护偏好筛选、章节池、机制说明及48关的计划/实战数量测试。

图鉴单位页保留核心数值与标签，完整说明由机制页分页呈现。技能树的节点只修改预览状态；购买仍调用 `Game.upgradeSkill()`，互斥分支、星星预算、战斗只读与存档校验都在逻辑层执行。

## 交通规则与声音

`Traffic` 在 `startLevel` 初始化，从发波、事件切换、漏车和固定步更新接入。`CivilVehicle` 与敌车分开保存，塔和技能只索敌方，只有全部目标送达才允许战斗胜利。章节任务由 `level.mission` 配置，道路因子由 `ROAD_TYPES` 配置；桥段载荷和收费站漏车分别扣任务耐久，不能用旧生命判定替代任务条件。v0.14的参数在源码中服务网页版，冻结微信产物仍执行旧规则；一致性检查只约束保留的地图、四塔和进化数据。

手动分流按当前路网最长公共前缀找到岔口，最长公共后缀确定汇合段。普通发车轮流分配道路，`diversionTime` 有效期间选择指定支路；只修改岔口前敌车的路径。路线附带的 `trafficBranch` / `forkSegment` / `mergeSegment` 让速度差异仅作用于独立支路。民车不跟随手动调度；UI命中时优先保留建造位中心。原有动态路线事件仍使用共同前两点的约束，已驶入旧路线的车辆继续清场。

公交待发队列按12秒窗口串行出站，重复发波通知不会重复派车。两个接人站在路线累计长度的32%和67%处，车辆移动量限制在下一站距离内；每站4秒，提前190像素进入3秒伏击预警，劫掠车出场遵守38像素空位并逐辆生成。护航、冻结、队员拦截决定公交伤害；`arrive` 只执行一次，奖励与技能冷却在逻辑层结算。

桥面由 `bridgeSpan(path)` 统一确定，长度最多150像素；`bridgeAt` 按车辆实际路径和桥面距离查找，覆盖改道前后仍有车辆的两座桥。每辆车每座桥只结算一次入桥撞击，持续载重与破拆按固定步计算。`Enemy.update` 推进破拆停留计时，冻结/拦截时暂停破拆。`render/traffic.js` 与 `core/traffic.js` 共用速度、站点与桥面数据，界面不单独结算伤害或奖励。

通关模拟通过真实金币、出售返还、研究门槛和技能冷却进行操作；双路夹击优先建设与强化两侧火力，变道后出售失去道路覆盖的设施并重新部署。默认验证首关与六章终关，设置 `TD_TEST_STAGES` 为逗号分隔的零起始关卡下标可扩大范围，`TD_TEST_REPORT=1` 输出各关生命、桥梁最低耐久、抢修次数和公交奖励。这里只证明存在合法通关方案，不能替代玩家体验反馈。

网页广播使用包内HTML Audio；冻结微信包沿用音效池播放。`assets/audio/radio-*.wav` 是网页离线中文广播。修改广播文本时可在安装中文语音的Windows运行 `tools/generate-traffic-voice.ps1`，网页直接使用新音频；当前不将改动复制或构建到微信包。
