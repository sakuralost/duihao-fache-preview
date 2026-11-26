# pixelfx 与该 X 帖对《对号发车》的评估

- 评估对象：govin.eth / G哥（@goan999999）于 2026-11-17 12:17（Asia/Shanghai，下同）发布的帖子  
  https://x.com/goan999999/status/2122544596928676108
- 引用帖（Playable Ads，2026-11-14 15:36）：https://x.com/goan999999/status/2121507612223267293
- 本报告只做调研，未改游戏代码、未部署、未做 Page。
- 帖中两段视频（本帖约 7 秒、引用帖约 13 秒）未能实际观看，结论主要依据仓库 README / 文档 / 许可证 / GitHub API，以及微信开放文档。
- 核查时间：2026-11-17 14:40 左右（Asia/Shanghai）。

## 1. 结论（先看这节）

**现在不要把 pixelfx 接入《对号发车》。** 仓库本身是认真、好用的像素风特效库，但和我们的技术栈、美术约束、当前阶段都不匹配。帖子里「微信小游戏不用备案就能上架」是误导，已对照官方文档核实，见第 6 节。引用帖的 Playable Ads 是另一条生意，现在不要转产品方向；等游戏本身好玩、要做买量素材时再回头看。

建议：继续用生图模型出特效图，叠在现有 DOM/CSS/JS 动画上做连击、发车、解锁、复活反馈。pixelfx 只当「游戏手感该在哪些瞬间给反馈」的参考，不当素材源，也不当运行时库。

## 2. 帖子在说什么

作者定位是分享 AI 工具与赚钱实践的内容号，不是微信小游戏官方或引擎方。

本帖核心两句：微信小游戏门槛被 AI 打下来了，而且「不用备案就能上架」；然后推荐开源项目 **pixelfx**，号称 244 个现成特效、可直接接入网页游戏或导出精灵图、可换色、还带 Claude Code Skill，让 AI 按「给法师大招加一个魔法星」这种方式生成并迭代特效。后面又列了一批「AI 游戏开发 Skills」（游戏生成、引擎、联机、UI、手感、Three.js 等），自称都用过。

引用帖讲的是另一件事：用 AI 做 **Playable Ads（可试玩游戏广告）**，并指向 Scenario 官方案例库（约 24 个可试玩小游戏，时长大约 35–45 秒，可下载 HTML 研究）。这是「给手游做买量试玩广告」的生意，不是「把我们的微信小游戏做出来」。

帖内短链需自行展开。短链本身不是仓库地址：`t.co/zkscCpFUyS` 是本帖视频，`t.co/c5KQ8sWxOG` 与 `t.co/DKU78rc6iU` 指向引用帖或其视频。pixelfx 仓库在长文里：https://github.com/patch-gg/pixelfx 。帖中其余 GitHub 短链有的只链到组织首页，有的路径被截断，有的 404，不能当可靠清单用。

## 3. pixelfx 实际是什么

| 项 | 事实 |
|---|---|
| 仓库 | https://github.com/patch-gg/pixelfx |
| 在线画廊 | https://patch-gg.github.io/pixelfx/ |
| 作者 | Patch（patch.gg），方法来自 Hugo Duprez / Sprite Fusion 的「用代码写像素特效」思路 |
| 许可 | MIT（代码与特效可商用）。画廊字体 Patch Pixel 不在 MIT 范围内，见仓库 `NOTICE.md` |
| 成熟度 | 2026-10-30 14:43 建库，最近一次提交约 2026-11-12 16:42，最近推送约 2026-11-13 16:43。截至本次核查约 **7820 Star / 1025 Fork / 14 个未关闭 Issue**。很新，但体量和文档已经像样，属于近期爆款，不是空壳 |
| 形态 | **特效是代码，不是图。** 每个效果一个 JS 文件，往 `color` + `light` 两个像素缓冲区里画；可实时播放、换色、镜像，也可渲染成精灵图 + Aseprite 风格 JSON |

接入方式有两种：

1. **浏览器里直接跑代码**（官方例子：纯 canvas、Phaser、PixiJS、Kaplay、three.js），无依赖。`createFx` / `createFrame` / `composite`，再 `putImageData` 到 canvas，并按像素风放大。
2. **导出精灵图**给任意引擎：`node tools/render.mjs ice/frost-nova --sheet`，可给 Godot、Unity、GameMaker、Defold、LÖVE、Bevy 等用。

附带 Claude Code Skill（`skills/pixelfx`），走「起草 → 渲染联系表 → 目视检查 → 再改」的循环写新特效。分类里和我们可能沾边的是 **UI**（combo counter、confetti、achievement、coin collect）和 **pickups / explosions** 一类爆发，不是刀光冰冻法术本身。

**没有把微信小游戏、Laya、Cocos 列为官方目标。** 微信小游戏运行时本质是 canvas，理论上能塞进去，但要自己做适配，不是开箱即用。当前《对号发车》v2 是静态 HTML/CSS/JS 的 DOM 原型，没有 canvas 游戏循环，要对齐的代价更高。

## 4. 对《对号发车》有没有帮助

现有原型（`/workspace/duihao-fache/v2`）已经有一套自己的反馈：路径行驶、上客、发车「嘀嘀」、连击字、车位闪光/告警、解锁弹出、复活临时车位、失败抖动等，用的是 **生图 PNG/JPG + CSS 动画 + JS 缓动**，不是粒子引擎。设计稿第 4 章也把动态效果当成玩法的一部分，禁止瞬移和跳过发车。缺的是「更饱满的达成反馈」，不是「从零做特效系统」。

和用户约束的冲突要说清楚：

- 用户要求：**所有视觉美术由生图模型生成**，不用代码 / canvas / SVG 程序化绘制游戏美术。
- pixelfx 的自我定义就是「没有图片，全部用代码画像素」。无论是运行时往 canvas 里画，还是先导出精灵图再贴进游戏，**画面来源都是程序化像素绘图，不是生图模型**。导出成 PNG 也不能绕过这条规则。
- 在已生成的车辆、乘客、站台图上做位移、缩放、透明度、滤镜，或把生图出来的火花/烟尘/印章图当成粒子贴图来飞，这与规则相容，我们也已经在做。pixelfx 不属于这一类。
- 风格也不合：pixelfx 是低分辨率像素风（示例分辨率如 320×180，邻近取样放大）；《对号发车》要的是精美写实/插画向画面。硬叠上去会像两套游戏。

工作量对比：把 pixelfx 接进当前 DOM 原型，至少要加一块叠加 canvas、处理合成与缩放、还要处理和现有发车/上客时间轴抢戏的问题，收益是一批和车站题材不太贴、且违规的像素特效。自己补 4–6 张生图特效（尾气、彩纸、连击条、解锁金锁、复活光、失败尘土），用现有 `burstAt` / `fxText` / tween 播，工作量更小，也更符合「画面精美 + 全生图」的要求。

因此：**对「让连击、发车、解锁、复活更有反馈」这一目标，库本身的思路有参考价值，直接采用库没有好处。**

可参考、不要搬代码的部分：把反馈绑在「做对了」的瞬间（满员发车、连发、解锁车位、看广告复活）；连击要看得见、听得见；一次只强化一种高潮，避免满屏法术。这些与设计稿第 4 章一致，用生图素材就能做。

## 5. Playable Ads：现在无关，以后或有用

引用帖推荐的是 https://www.scenario.com/explorations/playable-ads/#all ，讲的是接手游厂商、发行商、海外买量团队的试玩广告制作。这和我们「先做一款能玩的微信 IAA 小游戏」不是同一条路。

- **现在**：不要转向「做 Playable Ads 赚钱」或改产品形态。先把关卡、难度、动画和微信适配做完。
- **以后**：等核心循环稳定、真要做投放素材时，可以把「前 30–45 秒只保留点车、上客、满员连发」压成一条试玩广告。那是发行/买量阶段的事，且微信侧投放形态和海外 Playable Ads 并不完全一样，到时再单独调研，不要现在就按 Scenario 案例改玩法。

## 6. 必须纠正的说法（备案：已核）

帖子原句：「微信小游戏不用备案就能上架。」**与现行微信开放文档不符，不能当事实用。** 用户此前按备案路径规划是对的，不要因这条帖子改计划。

官方依据（均为 developers.weixin.qq.com，已核）：

1. [小游戏接入指南](https://developers.weixin.qq.com/minigame/introduction/guide/)（文档标称最近编辑 2026-07-04）明确写：**「小游戏发布前，必须先完成版本审核和备案流程。」** 不开通虚拟支付的 IAA 游戏，发布指引预计约 13–37 个工作日。
2. [IAA 游戏发布指引](https://developers.weixin.qq.com/minigame/introduction/guide/iaa.html)（2026-08-26）：广告变现游戏要走注册、类目、微信认证、适龄提示、资质审核等流程；版本审核可与小程序备案并行提交，不是「跳过备案」。
3. [小游戏备案](https://developers.weixin.qq.com/minigame/introduction/guide/nrjs.html)（**2026-11-16，比该帖更新**）：IAA 仍要做【小游戏备案】这一前置审批。更细的规则是：
   - **单机**：完成【小游戏备案】后可以发布上线，之后继续完善【小程序备案】（工信侧）；
   - **联机**：必须完成【小程序备案】才能发布。
   - 文档同时提醒：长时间不按要求完成工信备案，或备案信息与小程序信息不一致，可能被限制搜索、限制新增用户等。
4. [版本审核](https://developers.weixin.qq.com/minigame/introduction/guide/bbsh)（2026-04-01）仍写：版本审核通过后，需在「小程序备案」完成后才可发布。此页日期早于上面第 3 条，和「单机完成小游戏备案即可先发、小程序备案后补」不完全一致。**应以较新的「小游戏备案」页理解当前单机流程，但不能据此理解成「不用备案」。**

社区里确有「单机审核过就能发、备案还在审也能上」的讨论（例如 Cocos 中文社区 2026-09 的帖子），也有个人博客把流程写得更松。这些**不是官方规则**，有人还提醒未完成备案就上线有处罚、清退风险。我们不应采用这种说法，更不应拿来给个人主体、纯广告变现的《对号发车》做合规结论。

一句话：不是「不用备案」；至少要完成【小游戏备案】（单机）或连同【小程序备案】（联机），再加上版本审核等发布流程。本项目继续走备案路径。

帖中其它容易夸大的点：

- 「零基础靠 AI 做小游戏」：pixelfx 只解决像素特效，不解决玩法、关卡、微信 API、审核与备案。
- 「网页小游戏可以直接引入代码」：只适用于 canvas / 游戏引擎项目；我们当前是 DOM 原型，且美术规则不允许这样引入。
- 后面那批 Skills 链接质量参差：如「游戏引擎」链到 `github.com/github/awesome`（404）；`rivet-dev/skil`、`Jeffallan/clau` 等路径被截断；`higgsfield-ai` 只链到组织页（较接近的是 [higgsfield-ai/skills](https://github.com/higgsfield-ai/skills)）；`gamedev-skills` 两条不同用途共用同一链接。其中不少偏 3D、联机或通用 Agent Skill，对这款微信车站解谜没有直接帮助，不必为用而用。

## 7. 具体建议

| 决策 | 说明 |
|---|---|
| **现在：跳过接入** | 不要把 pixelfx 打进 v2，不要为它改技术栈，不要用它的精灵图当游戏美术。 |
| **现在：可做的** | 用生图补齐连击、发车、分享解锁、广告复活、失败等反馈图，继续走现有动画时间轴。这和「提高难度、补关卡」不冲突，也不应打断另一路正在做的 4–20 关。 |
| **以后：仅作参考** | 若动画过关后仍觉得「做对了没痛快」，可打开画廊看 UI/confetti/combo 的节奏，再自己用生图重做同等功能。不要把像素风搬进成品。 |
| **不要采用** | 「不用备案就能上架」；把产品改成 Playable Ads 工作室；为了用库而引入 canvas 特效层或改成像素风；把帖里那批 Skills 当微信小游戏工具链。 |
| **上线合规** | 维持个人主体、IAA、无内购的设定，按[接入指南](https://developers.weixin.qq.com/minigame/introduction/guide/)和[小游戏备案](https://developers.weixin.qq.com/minigame/introduction/guide/nrjs.html)走版本审核与备案。网页试玩可以继续，正式上架不能跳过备案。 |

## 8. 主要出处

- 帖子与引用帖：见文首链接；Playable Ads 案例库 https://www.scenario.com/explorations/playable-ads/#all
- pixelfx：https://github.com/patch-gg/pixelfx 、https://patch-gg.github.io/pixelfx/ 、README / LICENSE / NOTICE.md；仓库元数据来自 2026-11-17 的 GitHub API（Star/Fork/提交时间）
- 微信官方：  
  https://developers.weixin.qq.com/minigame/introduction/guide/  
  https://developers.weixin.qq.com/minigame/introduction/guide/iaa.html  
  https://developers.weixin.qq.com/minigame/introduction/guide/nrjs.html  
  https://developers.weixin.qq.com/minigame/introduction/guide/bbsh  
  https://developers.weixin.qq.com/minigame/introduction/guide/xcxba.html
