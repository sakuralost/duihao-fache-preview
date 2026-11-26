# 对号发车与云朵果冻铺

这个仓库里有两个项目，放在一起只是为了集中保存代码和记录。

- **《对号发车》**：个人主体的微信休闲小游戏。微信小游戏主工程在 [`duihao-fache/wechat-minigame/`](duihao-fache/wechat-minigame/)。仓库根目录的 `index.html` 只是更早的网页试玩页，不是主版本。
- **《云朵果冻铺》**：仍在研讨的手感 MVP，还没有进入正式开发。代码和玩法方案在 [`yunduo-guodong/`](yunduo-guodong/)。

已确认的决策全文在 [`docs/沟通与决策记录.md`](docs/沟通与决策记录.md)。下面的摘要不替代原文。

## 目录

| 路径 | 内容 | 阶段 |
| --- | --- | --- |
| `index.html` | 原来的自包含网页试玩页 | 约 2026-11-17 的试玩预览 |
| `duihao-fache/` | 《对号发车》Origin `main` 的完整工程 | 快照版本 `DUIHAO-WX-1.0.2`，40 关 |
| `duihao-fache/wechat-minigame/` | 微信小游戏主工程（`game.js` + Canvas） | 同上，广告位 ID 仍为空 |
| `duihao-fache/wechat-minigame-upload/` | 与主工程对应的一份目录副本 | 同上 |
| `duihao-fache/v2/` | 网页版 | 与主工程快照同期 |
| `duihao-fache/index.html` | 更早的三关网页原型 | 见 `早期三关网页原型.md` |
| `duihao-fache/origin-pr-2/` | Origin 上仍开放的 PR #2，未合并 | `DUIHAO-WX-1.0.4`，100 关，已写广告位 |
| `yunduo-guodong/` | 《云朵果冻铺》MVP v5 | 等试玩确认，未进入正式开发 |
| `docs/` | 沟通与决策记录 | 2026-11-26 整理 |

## 当前阶段

《对号发车》的微信主版本按 `game.js` + Canvas 做，不把网页 HTML 当主版本。本仓库里的 **main 快照**来自 Cursor Origin 仓库 `304722377/duihao-fache` 的默认分支 `main`，提交 `e2a99687e4db11acdbc5504b1aafbeb880547d09`。这一份代码的版本号是 `DUIHAO-WX-1.0.2`，`wechat-minigame/js/levels.js` 里是 40 关，`AD_UNIT_ID` 为空。

Origin 上的 **Pull Request #2**（标题「可读性、100 关和连发三星（DUIHAO-WX-1.0.4）」，分支 `cursor/readability-100-levels-6de1`，提交 `289918b6aa6310cf66a9707d4c4ed4ce5dc87470`）在取代码时仍是开放状态。它没有合并进 Origin 的 `main`，也没有合并进本仓库的 `duihao-fache/wechat-minigame/`。对应文件在 `duihao-fache/origin-pr-2/`。同一仓库里还有一个更早的开放 PR #1（分支 `cursor/readable-capacity-groups-3e99`，容量铭牌和分组间距）。这次没有单独再导出 PR #1，也没有合并它。

沟通记录里的版本状态（2026-11-26）是另一层事实：线上版 1.0.4 已发布，同号开发版 1.0.4（含流量主逻辑）已上传，审核版 1.0.4 审核中。那份记录同时写明，未经要求不要正式发布审核中的版本，也不要合并 Origin 上仍开放的流量主相关 Pull Request。本仓库只保存代码和记录，不代替那些操作。

《云朵果冻铺》于 2026-11-25 立项。MVP v5 已放在 https://guodong.sakuralost.com/ ，等试玩确认。记录写明：没说「通过」之前，不开始完整开发。

## 本地打开和预览

### 原来的网页试玩

用浏览器直接打开仓库根目录的 `index.html`。

公开试玩地址仍是 https://sakuralost.github.io/duihao-fache-preview/ 。GitHub Pages 从 `gh-pages` 分支的根目录发布，这次没有改 `gh-pages`。根目录这份 `index.html` 和当前 `gh-pages` 上的试玩页是同一份文件。

### 《对号发车》微信小游戏主工程

用微信开发者工具导入 **小游戏** 项目（不是小程序），目录选 `duihao-fache/wechat-minigame`。AppID 使用工程里的 `wx3fad237336dba3ba`（`project.config.json` 已写上）。入口是该目录的 `game.js`。更细的说明在 [`duihao-fache/wechat-minigame/README.md`](duihao-fache/wechat-minigame/README.md)。那份说明写于 40 关、广告位尚未填写的时候，和 main 快照一致。

不想开开发者工具时，可以在本机看一页预览（预览不能代替开发者工具）：

```bash
cd duihao-fache/wechat-minigame
node tools/bundle-preview.js
PORT=33605 node tools/preview-server.js
```

然后打开 http://127.0.0.1:33605/ 。

网页版在 `duihao-fache/v2/index.html`。三关原型在 `duihao-fache/index.html`，说明见 [`早期三关网页原型.md`](duihao-fache/早期三关网页原型.md)。

要看未合并的 PR #2，导入 `duihao-fache/origin-pr-2/wechat-minigame`，不要把它和上面的主工程混成一个目录。

### 《云朵果冻铺》

用浏览器打开 `yunduo-guodong/index.html`。若本地图片被浏览器拦住，在该目录执行 `python3 -m http.server`，再打开提示的地址。已部署的试玩是 https://guodong.sakuralost.com/ 。

## 源码是否取到

取到了。Origin 私有仓库 `304722377/duihao-fache` 的 `main` 共 354 个文件，已放进 `duihao-fache/`（不含后来加上的说明和 `origin-pr-2/`）。最大的图片 `duihao-fache/assets/btn-hud-icons.png` 为 992458 字节，微信背景 `wechat-minigame/assets/bg-play.jpg` 为 277186 字节，与 Origin 中的文件大小一致。

PR #2 的完整微信工程（含图片）在 `duihao-fache/origin-pr-2/wechat-minigame/`，上传目录副本在同级的 `wechat-minigame-upload/`。相对 `main`，这个 PR 改动的是关卡、逻辑、绘制和流量主配置，图片本身没有另一套。

没有发现需要从源码里删掉的密钥文件。Origin 的忽略规则本来就排除 `*.key`、`secrets/`、`project.private.config.json` 和备案截图目录，快照里也没有这些文件，没有 `.env`，也没有带 `token=` 的链接。`duihao-fache/ci-tools/upload.js` 和 PR #2 里的同名脚本只写了本机路径 `/home/box/secrets/wx3fad237336dba3ba-upload.key`，密钥文件本身不在仓库中。AppID `wx3fad237336dba3ba` 和 PR #2 中的广告位 ID `adunit-03972ec4b8c2815a` 按约定保留。游戏圈 openlink、评价组件 openlink 是写在客户端配置里的字符串，随源码保留。

`duihao-fache/00-当前进度说明.txt` 和 `origin仓库说明.md` 是 Origin 仓库根上、打包时间记为 2026-11-24 的说明，描述的是当时的 1.0.2 包，不覆盖 2026-11-26 的沟通记录。

## 已确认决策摘要

以下只压缩沟通记录里已经写明的内容。

- 个人主体做微信小游戏，只靠广告、不做内购；先单机。主版本用 `game.js` + Canvas。画面用生图素材，不用代码直接画粗糙图形。分享和广告奖励只对当前这一局有效。
- 开发分阶段，每阶段经确认再进入下一阶段。不可逆的微信操作（含提交版本审核、正式发布）必须先确认。版本审核由本人提交。
- 《对号发车》玩法是点选同色乘客上车，路通后发车。名称与简称均为「对号发车」。目标 100 关：1–60 关默认 3 个车位，61 关起默认 2 个。默认车位下、不分享、不看广告也要能过。第 5 关起有 6 座长巴士，第 9 关起有「N 人团」，第 15 关起有问号车。三星要在一关内打出 4 次以上连发。
- 流量主已开通。本局第一次复活或开车位可以分享或看激励视频；成功分享一次后，本局后面的复活和开车位只看广告。官方推荐组件不要用道具去奖励推荐。
- 2026-11-26 已同意的低成本推广项，以及明确不做的游戏礼包、虚拟支付、广告主投放，以沟通记录原文为准。分享标题「路通了，快来一起发车」留到以后改代码时再做。
- 《云朵果冻铺》对标街机 Magical Drop 的手感，主题换成云朵 / 果冻。保留从下往上发射。抓取、蓄力、发射要有看得懂的动效，动效不能被发射台挡住。底部提示环不要乱跳，只在前 2 关对建议的那一列跳两下。同期的《茶好了》已废弃。
