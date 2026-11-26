// 用法: node qa.js <url> <outDir> [quick]
const { chromium } = require('playwright-core');
const L = require('../js/logic.js'); const LV = require('../js/levels.js'); const { analyze } = require('./solver.js');
const url = process.argv[2], out = process.argv[3] || '/tmp/qa';
require('fs').mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await sleep(900);
  const ver = await page.evaluate(() => document.querySelector('#stage').dataset.version);
  console.log('version', ver);
  const shot = async n => { await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
  await shot('01-start');
  await page.click('#btn-select'); await sleep(500); await shot('02-select');
  await page.click('#sel-back'); await sleep(400);
  await page.click('#btn-start'); await sleep(1300); await shot('03-L1-tutorial');
  let comboShot = false;
  async function tapV(id) { await page.locator(`.veh[data-id="${id}"]`).click({ force: true }); }
  async function play(levelIdx, seq, opts = {}) {
    for (let i = 0; i < seq.length; i++) {
      await tapV(seq[i]);
      if (opts.midShot && opts.midShot.at === i) { await sleep(opts.midShot.ms); await shot(opts.midShot.name); }
      // 抓连发
      const until = Date.now() + (opts.gap || 900);
      while (Date.now() < until) {
        if (!comboShot && await page.$('.fx-text.combo')) { await sleep(120); await shot('06-combo'); comboShot = true; }
        await sleep(40);
      }
    }
  }
  // L1
  const s1 = analyze(LV[0]).solution; await play(0, s1, { midShot: { at: 0, ms: 950, name: '04-L1-boarding' } });
  await page.waitForSelector('#card-win:not(.hidden)', { timeout: 15000 }); await sleep(900); await shot('05-L1-win');
  await page.click('#win-next'); await sleep(1300);
  // L2
  const s2 = analyze(LV[1]).solution; await play(1, s2, { gap: 700 });
  await page.waitForSelector('#card-win:not(.hidden)', { timeout: 20000 }); await sleep(900); await shot('07-L2-win');
  await page.click('#win-next'); await sleep(1300); await shot('08-L3-start');
  // L3 win
  const s3 = analyze(LV[2]).solution; await play(2, s3, { gap: 900, midShot: { at: 1, ms: 1150, name: '09-L3-boarding' } });
  await page.waitForSelector('#card-win:not(.hidden)', { timeout: 30000 }); await sleep(250); await shot('10-L3-confetti'); await sleep(900); await shot('11-L3-win');
  const unlocked = await page.evaluate(() => JSON.parse(localStorage.getItem('duihao-v2-progress')));
  console.log('progress', JSON.stringify(unlocked));
  // L3 lose
  await page.click('#win-select'); await sleep(500); await shot('12-select-after');
  await page.click('.lv[data-level="3"]'); await sleep(1300);
  const lose = analyze(LV[2]).losing; console.log('losing seq', lose);
  for (let i = 0; i < lose.length; i++) { await tapV(lose[i]); await sleep(i === lose.length - 2 ? 2600 : 1100); if (i === lose.length - 2) await shot('13-L3-lastspot'); }
  await sleep(600); await shot('14-L3-failfreeze');
  await page.waitForSelector('#card-fail:not(.hidden)', { timeout: 15000 }); await sleep(500); await shot('15-L3-fail');
  // 撤销
  await page.click('#fail-undo'); await sleep(200); await shot('16-undo-rewind'); await sleep(700); await shot('17-after-undo');
  // 被挡
  const st = await page.evaluate(() => { const s = DH.G.state; return s.veh.map(v => v.where); });
  const blocked = await page.evaluate(() => { const G = DH.G; for (const v of G.state.veh) if (v.where === 'lot' && window.Logic.blocker(G.state, v.id) >= 0) return v.id; return -1; });
  if (blocked >= 0) { await tapV(blocked); await sleep(130); await shot('18-blocked'); }
  console.log('errors', JSON.stringify(errors));
  console.log('comboShot', comboShot);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
