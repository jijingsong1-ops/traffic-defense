# 开发与目录说明

无需构建工具、依赖安装或外部素材。双击根目录 `index.html` 即可运行；部署时需上传整个项目中的 `index.html`、`src/`、`assets/`，不能只上传 HTML。

## 目录

```text
index.html                 网页入口，按顺序加载脚本
README.md                  运行方式、操作说明和当前版本
src/
  config.js                难度、人物比例、画布和通用参数
  data/
    towers.js              四种设施、48条章节进化与研究条件
    enemies.js             敌人属性与图鉴介绍
    levels.js              六章48关、独立路线、变道事件与波次参数
    music.js               六章独立旋律、和弦、节拍与音色
  core/
    collision.js           距离、线段和矩形检测
    road-network.js        有向路网、道路投影和固定建造地块
    storage.js             本地星级存档
    audio.js               合成音效、音乐和静音设置
  entities.js              车辆、设施、拦截队员、弹体与伤害规则
  game.js                  主循环、定时波次、点击交互与经济
  render/
    renderer.js            地图、车辆、界面和基础绘图函数
    facilities.js          四种设施、队员、信标与后坐外观
    combat.js              分级弹体、命中特效、波阵与连锁动画
  main.js                  画布像素比例与游戏启动
assets/css/game.css        页面布局与画布样式
tests/game.test.cjs       无依赖自动化测试
docs/
  CHANGELOG.md             版本历史
  DEVELOPMENT.md           本说明
  TOWER-DESIGN.md          设施定位、美术与进化设计
  previews/
    current/               当前版本截图
    archive/               保留的旧版本截图
```

## 常见修改位置

- 人物大小：`src/config.js` 的 `soldierScale`，当前为 `0.64`。只影响绘制，不改变碰撞、生命或拦截能力；血条独立绘制。
- 设施数值与解锁：`src/data/towers.js`。城市第一路线按1/2/3/4次通关开放，第二路线按4/5/6/7次；后续章节延续章节研究。
- 设施外观：`src/render/facilities.js`。基础轮廓、专精模块和四级强化都在 `tower()`，小队员在 `soldier()`。
- 新增关卡：`src/data/levels.js`；道路/建造规则在 `src/core/road-network.js`。
- 新增效果：先在 `src/entities.js` 实现战斗规则，再在 `towers.js` 配置能力与说明。

## 加载约定

使用原生普通脚本加 `defer`，不使用 ES Module 或 fetch，从而支持 `file://` 直接打开。所有脚本共享词法作用域；`index.html` 明确列出依赖顺序。数据先加载，基础逻辑和实体随后，渲染器先于设施美术扩展，`main.js` 最后启动。新增文件必须加入入口。

## 验证

```powershell
node --test tests/game.test.cjs
python -m http.server 8765
```

第二条命令仅在需要网页服务时运行，浏览器打开 `http://localhost:8765`。测试读取 `index.html` 的脚本列表，使用与浏览器一致的顺序；包含模拟战斗、合法经济通关、研究门槛、拦截释放、声音与渲染检查。

Git 上传前运行 `git status`。这次整理包含文件移动，`git add -A` 会同时记录新增路径和旧路径删除；提交后再 push。页面版本不会自动创建 Git 标签。

## 路线与章节音乐

`ROAD_LAYOUTS` 为每章提供8个独立布局。`paths` 是有向折线；`alternate` 是事件路线。动态关卡的新旧路线必须共享起点和第二个节点，车辆仅在第一个线段切换路径；经过岔口的车辆保留旧路径。`planConstructionSites` 同时排除当前和未来道路，保持地块坐标稳定。修改路线后应验证转角、交叉口和拦截位置。

`MUSIC_TRACKS` 独立配置 MIDI 音符、BPM、每小节八分拍数、和弦、低音、节奏与音色；海岛为6个八分拍。音乐用音频时钟，战斗倍速不改变节奏。音效与音乐共享总音量限制，但分别记录声音节点以便独立静音。

新增能力参数 `repair`（队员修复）、`shred`（削甲幅度，持续4秒）、`jam`（阻止护盾恢复的秒数）在实体中实现。章节外观模块由 `regionalEquipment` 绘制；`THEME_EQUIPMENT` 配置两路线配色。

## 攻击动画

`Tower.visual` 在发射时保存等级、分支、章节、颜色和连锁类型，交给弹体、光束和命中特效。`combat.js` 只绘制，不结算伤害；`fireTime`、`swingTime` 与特效寿命由模拟时间推进。新增特效仍应复用 `game.effect` / `game.beam` 的生命周期。基础射程在 towers.js，升级加成在 CONFIG 的 towerUpgradeRange / towerFinalRange。
