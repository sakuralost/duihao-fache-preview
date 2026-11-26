'use strict'

const path = require('path')
const ci = require('miniprogram-ci')

const APPID = 'wx3fad237336dba3ba'
const VERSION = '1.0.4'
const DESC = '对号发车 1.0.4 流量主激励视频，本局首次可分享，之后复活和开车位看广告'
const projectPath = path.resolve(__dirname, '../wechat-minigame-upload')
const privateKeyPath = '/home/box/secrets/wx3fad237336dba3ba-upload.key'

async function main() {
  const project = new ci.Project({
    appid: APPID,
    type: 'miniGame',
    projectPath,
    privateKeyPath,
    ignores: ['node_modules/**/*', 'tools/**/*', 'beian-shots/**/*', 'README.md', 'project.private.config.json'],
  })
  const uploadResult = await ci.upload({
    project,
    version: VERSION,
    desc: DESC,
    setting: {
      useProjectConfig: true,
    },
    onProgressUpdate: (info) => {
      if (typeof info === 'string') {
        console.log(info)
        return
      }
      const msg = info && (info.message || info.status || info._status)
      const percent = info && (info.percentage ?? info.percent)
      console.log(percent != null ? `${msg || 'progress'} ${percent}%` : String(msg || JSON.stringify(info)))
    },
  })
  console.log('UPLOAD_OK')
  console.log(JSON.stringify(uploadResult, null, 2))
}

main().catch((err) => {
  console.error('UPLOAD_FAILED')
  console.error(err && err.stack ? err.stack : err)
  process.exit(1)
})
