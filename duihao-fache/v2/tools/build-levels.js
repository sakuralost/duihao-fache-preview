// 把 /tmp/gen 里选中的候选写成 js/levels.js（第 1 关手工）
const fs = require('fs');
const META = {
  1: { name: '点亮着的车', tutorial: true },
  2: { name: '先挖出来' },
  3: { name: '只有 3 个车位' },
  4: { name: '层层堵车' },
  5: { name: '长巴士来了', isNew: '长巴士（6 座）', intro: { img: 'intro-long', title: '长巴士：6 个座位', text: '长巴士占 3 格，要坐满 6 个人才发车。' } },
  6: { name: '长短混搭' },
  7: { name: '先放谁？' },
  8: { name: '高峰时段', peak: true },
  9: { name: '团体票', isNew: '团体票（N 人团）', intro: { img: 'intro-group', title: '团体票：一起上同一辆车', text: '「N 人团」必须整团坐进同一辆车，座位不够就整团等着。' } },
  10: { name: '三人团' },
  11: { name: '算好座位' },
  12: { name: '换个思路' },
  13: { name: '团团转' },
  14: { name: '晚高峰', peak: true },
  15: { name: '问号车', isNew: '问号车', intro: { img: 'intro-mystery', title: '问号车：开出前看不到颜色', text: '盖着布的车，前面的路一空就会揭开颜色。' } },
  16: { name: '揭开看看' },
  17: { name: '暗中有团' },
  18: { name: '终极拥堵', peak: true },
  19: { name: '看准再开' },
  20: { name: '车站之王', peak: true },
};
const L1 = { vehicles: [{ c: 'A', x: 1, y: 3, dir: 'U' }, { c: 'B', x: 4, y: 3, dir: 'U' }, { c: 'B', x: 0, y: 5, dir: 'R' }, { c: 'B', x: 3, y: 6, dir: 'U' }], queue: 'AAAABBBBBBBBBBBB' };
const out = [];
for (let i = 1; i <= 20; i++) {
  const lv = i === 1 ? L1 : JSON.parse(fs.readFileSync((fs.existsSync(`/tmp/genh/${i}.json`) ? `/tmp/genh/${i}.json` : `/tmp/gen/${i}.json`), 'utf8')).lv;
  out.push(Object.assign({}, META[i], { vehicles: lv.vehicles, queue: lv.queue }));
}
const body = out.map(l => '    ' + JSON.stringify(l)).join(',\n');
fs.writeFileSync(__dirname + '/../js/levels.js', `/* 对号发车 关卡 1–20（固定布局与颜色，无随机；默认 3 个车位均可解，见 tools/solver-report.txt） */
(function (root) {
  const LEVELS = [
${body}
  ];
  if (typeof module !== 'undefined') module.exports = LEVELS; else root.LEVELS = LEVELS;
})(this);
`);
fs.mkdirSync(__dirname + '/../levels-src', { recursive: true });
for (let i = 2; i <= 20; i++) fs.copyFileSync(`/tmp/gen/${i}.json`, `${__dirname}/../levels-src/${i}.json`);
console.log('ok', out.length);
