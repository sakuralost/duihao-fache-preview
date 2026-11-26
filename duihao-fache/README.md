# 《对号发车》

这里是 Cursor Origin 仓库 `304722377/duihao-fache` 默认分支 `main`（`e2a99687e4db11acdbc5504b1aafbeb880547d09`）里的游戏工程，再加上尚未合并的 PR #2 目录。仓库总说明在上一级 [`README.md`](../README.md)。

## 哪个目录是微信主版本

微信小游戏主工程是 **[`wechat-minigame/`](wechat-minigame/)**。

- 入口：`wechat-minigame/game.js`
- 版本号：`wechat-minigame/js/config.js` 里的 `DUIHAO-WX-1.0.2`
- 关卡：同一快照中的 `js/levels.js` 为 40 关
- 广告位：`AD_UNIT_ID` 仍是空字符串
- AppID：`wx3fad237336dba3ba`

`wechat-minigame-upload/` 是一份并列的目录副本，不是另一款游戏。

用微信开发者工具时，选择小游戏并导入 `wechat-minigame` 这个文件夹。本地网页预览：

```bash
cd wechat-minigame
node tools/bundle-preview.js
PORT=33605 node tools/preview-server.js
```

浏览器打开 http://127.0.0.1:33605/ 。`tools/` 是本地预览用的，开发者工具工程配置里已忽略它。

## 其他目录

| 路径 | 说明 |
| --- | --- |
| `v2/` | 网页版。用浏览器打开 `v2/index.html` |
| `index.html` | 更早的三关网页原型，说明原文在 [`早期三关网页原型.md`](早期三关网页原型.md) |
| `origin-pr-2/` | Origin PR #2 的未合并快照，见该目录说明 |
| `ci-tools/` | 历史上用来调用上传工具的脚本。私钥不在本仓库 |
| `assets/`、`css/`、`js/` | 更早一版网页资源 |
| `DESIGN.md` 等 | 设计与调研原文 |
| `00-当前进度说明.txt` | 2026-11-24 的打包说明 |
| `origin仓库说明.md` | 当时 Origin 仓库根上的简短说明 |
| `origin.gitignore` | 当时仓库根上的忽略规则原文。本 GitHub 仓库根目录的 `.gitignore` 覆盖了这些规则 |

`00-当前进度说明.txt` 写的是 2026-11-24 前后的开发版 1.0.2 和当时的线上版 1.0.1。2026-11-26 的状态以 [`docs/沟通与决策记录.md`](../docs/沟通与决策记录.md) 为准。

## 和 PR #2 的关系

`wechat-minigame/` 保持 Origin `main` 的内容。100 关、连发三星和流量主广告位在 [`origin-pr-2/wechat-minigame/`](origin-pr-2/wechat-minigame/)，没有覆盖到这里。
