// 用法: node qa3.js <url> <outDir> [levelsToPlay=20]
const { chromium } = require('playwright-core');
const LV = require('../js/levels.js'); const { analyze } = require('./solver.js');
const url = process.argv[2], out = process.argv[3] || '/tmp/qa3', NLV = +(process.argv[4] || 20);
require('fs').mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' }); await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' }); await sleep(900);
  console.log('version', await page.evaluate(() => DH.version));
  await page.evaluate(() => { window.__ov = 0; window.__ovEx = null; const loop = () => { const G = DH.G; if (G) { const vs = G.veh.filter(e => e.visible && e.y > 240 && e.y < 300 && e.x > 20 && e.x < 370); for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) if (Math.abs(vs[i].x - vs[j].x) < 34 && Math.abs(vs[i].y - vs[j].y) < 26) { window.__ov++; if (!window.__ovEx) window.__ovEx = [G.idx, vs[i].el.dataset.id, vs[j].el.dataset.id]; } } requestAnimationFrame(loop); }; loop(); });
  const shot = async n => { await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
  await shot('01-start');
  await page.click('#btn-select'); await sleep(500); await shot('02-select'); await page.click('#sel-back'); await sleep(400);
  const where = id => page.evaluate(i => DH.G.state.veh[i].where, id);
  async function tapV(id) {
    for (let k = 0; k < 20; k++) {
      await page.locator(`.veh[data-id="${id}"]`).click({ force: true }); await sleep(60);
      if (await where(id) !== 'lot') return;
      await sleep(150);
    }
    throw new Error('tap failed ' + id);
  }
  async function closeIntro(i) {
    if (await page.$('#card-intro:not(.hidden)')) { await sleep(400); await shot(`intro-L${i + 1}`); await page.click('#intro-ok'); await sleep(300); }
  }
  const comboSeen = {};
  await page.click('#btn-start'); await sleep(1300);
  for (let i = 0; i < NLV; i++) {
    await closeIntro(i);
    const sol = analyze(LV[i], 3, false).solution;
    for (let k = 0; k < sol.length; k++) {
      await tapV(sol[k]);
      if ((i === 2 || i === 17 || i === 19) && k === 3) { await sleep(700); await shot(`mid-L${i + 1}`); }
      const until = Date.now() + 650;
      while (Date.now() < until) { if (!comboSeen.c && await page.$('.fx-text.combo')) { await sleep(100); await shot('combo'); comboSeen.c = 1; } await sleep(40); }
    }
    await page.waitForSelector('#card-win:not(.hidden)', { timeout: 40000 });
    console.log('win L' + (i + 1));
    if (i === 0 || i === NLV - 1) { await sleep(900); await shot(`win-L${i + 1}`); }
    if (i < NLV - 1) { await page.click('#win-next'); await sleep(1300); }
  }
  console.log('road overlap frames', await page.evaluate(() => [window.__ov, window.__ovEx]));
  console.log('progress', JSON.stringify(await page.evaluate(() => DH.progress())));
  // 失败 + 复活（第 3 关）
  await page.evaluate(() => DH.start(2)); await sleep(1300);
  const lose = analyze(LV[2], 3).losing; console.log('losing seq', lose);
  for (let k = 0; k < lose.length; k++) { await tapV(lose[k]); await sleep(k === lose.length - 2 ? 2400 : 900); if (k === lose.length - 2) await shot('lastspot'); }
  await page.waitForSelector('#card-fail:not(.hidden)', { timeout: 15000 }); await sleep(500); await shot('fail-card');
  await page.click('#fail-revive'); await sleep(1200); await shot('revive-watch'); await sleep(2300); await shot('revive-anim'); await sleep(900); await shot('revive-after');
  const st = await page.evaluate(() => ({ spots: DH.G.state.spots.length, over: DH.G.state.over, ended: DH.G.ended }));
  console.log('after revive', JSON.stringify(st));
  // 继续乱点直到结束，确认复活后再失败没有复活按钮
  for (let n = 0; n < 20; n++) {
    const s = await page.evaluate(() => ({ over: DH.G.state.over, mov: window.Logic.movable(DH.G.state) }));
    if (s.over || !s.mov.length) break; await tapV(s.mov[0]); await sleep(1000);
  }
  await sleep(2500);
  const rv = await page.evaluate(() => ({ over: DH.G.state.over, reviveShown: getComputedStyle(document.querySelector('#fail-revive')).display }));
  console.log('second end', JSON.stringify(rv)); await shot('after-revive-end');
  // 分享解锁（第 4 关开局）
  await page.evaluate(() => { document.querySelectorAll('#card-fail,#card-mask').forEach(e => e.classList.add('hidden')); DH.start(3); }); await sleep(1400);
  await shot('locked-spots');
  await page.click('.spot.locked'); await sleep(400); await shot('share-modal');
  await page.click('#share-ok'); await sleep(600); await shot('share-busy'); await sleep(1750); await shot('share-unlock-anim'); await sleep(1200); await shot('share-after');
  console.log('extra', await page.evaluate(() => DH.progress().extraSpots), 'spots', await page.evaluate(() => DH.G.state.spots.length));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
