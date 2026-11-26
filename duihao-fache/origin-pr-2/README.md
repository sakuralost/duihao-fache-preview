# Origin PR #2（未合并）

这是 Cursor Origin 仓库 `304722377/duihao-fache` 上仍开放的 Pull Request #2 的一份拷贝，不是已经合并的结果。

- 标题：可读性、100 关和连发三星（DUIHAO-WX-1.0.4）
- 分支：`cursor/readability-100-levels-6de1`
- 提交：`289918b6aa6310cf66a9707d4c4ed4ce5dc87470`
- 对比基线：`main` 的 `e2a99687e4db11acdbc5504b1aafbeb880547d09`

取这份快照时，该 PR 在 Origin 上是开放的。本目录没有合并进上一级的 `wechat-minigame/`，Origin 上的 PR 也没有合并。

## 怎么打开

微信小游戏工程在 **`wechat-minigame/`**。用微信开发者工具按小游戏导入这个文件夹，不要导入上一级的 main 工程后再把两边文件掺在一起。

这一份代码里：

- `js/config.js` 的版本号是 `DUIHAO-WX-1.0.4`
- 激励视频广告位 ID 是 `adunit-03972ec4b8c2815a`
- `js/levels.js` 为 100 关
- 本局尚未成功分享时，复活和再开一个车位可以选分享或看广告；成功分享一次之后，这两件事只走广告。奖励只留在这一局

`wechat-minigame-upload/` 是同一份 PR 里的目录副本。`DESIGN.md` 的「v1.0.4 微信版」一节写了这一版规则。`wechat-minigame/tools/solve-report.json` 是求解记录。

`wechat-minigame/README.md` 在这个 PR 里没有改，正文仍按 40 关和「广告位还没填」来写。以本目录 `js/config.js`、`js/levels.js` 和 `DESIGN.md` 的 v1.0.4 一节为准。

图片与 main 快照相同，所以这里是一份可以单独打开的完整目录，不是只剩几个差异文件的补丁。

`ci-tools/upload.js` 只保留了 PR 里的脚本。它指向本机路径 `/home/box/secrets/wx3fad237336dba3ba-upload.key`，密钥文件不在本仓库。这里不写上传或提审的做法。
