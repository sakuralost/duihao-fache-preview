const { chromium } = require('playwright-core');
const LV = require('../js/levels.js'); const { analyze } = require('./solver.js');
const url = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  // 模拟旧存档：永久解锁 2 个
  await p.goto(url); await p.evaluate(() => localStorage.setItem('duihao-v2-progress', JSON.stringify({ unlocked: 21, stars: {}, extraSpots: 2, seenIntro: { 5: 1, 9: 1, 15: 1 } }))); await p.reload(); await sleep(800);
  const res = {};
  res.version = await p.evaluate(() => DH.version);
  res.oldSaveCleared = await p.evaluate(() => !('extraSpots' in JSON.parse(localStorage.getItem('duihao-v2-progress'))));
  const share = async () => { await p.click('.spot.locked'); await sleep(300); await p.click('#share-ok'); await sleep(2600); };
  const tapV = async id => { for (let k = 0; k < 20; k++) { await p.locator(`.veh[data-id="${id}"]`).click({ force: true }); await sleep(60); if (await p.evaluate(i => DH.G.state.veh[i].where, id) !== 'lot') return; await sleep(150); } throw new Error('tap ' + id); };
  await p.evaluate(() => DH.start(2)); await sleep(1300);
  res.L3start = await p.evaluate(() => DH.spots());
  await share(); res.L3afterShare = await p.evaluate(() => DH.spots());
  await p.screenshot({ path: '/tmp/qaS-shared.png' });
  await p.click('#btn-retry'); await sleep(1300); res.afterRetry = await p.evaluate(() => DH.spots());
  await share(); res.shareAgain = await p.evaluate(() => DH.spots());
  for (const id of analyze(LV[2], 3, false).solution) { await tapV(id); await sleep(500); }
  await p.waitForSelector('#card-win:not(.hidden)', { timeout: 30000 });
  await p.click('#win-next'); await sleep(1400); res.nextLevel = await p.evaluate(() => [DH.G.idx + 1, DH.spots()]);
  await share(); res.L4shared = await p.evaluate(() => DH.spots());
  await p.reload(); await sleep(800); await p.evaluate(() => DH.start(3)); await sleep(1300); res.afterReload = await p.evaluate(() => DH.spots());
  await p.click('#play-back'); await sleep(400); await p.evaluate(() => DH.start(2)); await sleep(1300); res.backToSelect = await p.evaluate(() => DH.spots());
  // 复活后重来
  for (const id of analyze(LV[2], 3).losing) { await tapV(id); await sleep(900); }
  await p.waitForSelector('#card-fail:not(.hidden)', { timeout: 15000 });
  res.failShareText = await p.textContent('#fail-share span');
  await p.click('#fail-revive'); await sleep(4300); res.afterRevive = await p.evaluate(() => [DH.spots(), DH.G.tempSpot]);
  await p.click('#btn-retry'); await sleep(1300); res.reviveRetry = await p.evaluate(() => [DH.spots(), DH.G.tempSpot, DH.G.revived, DH.G.undoFree]);
  res.storage = await p.evaluate(() => localStorage.getItem('duihao-v2-progress'));
  res.errors = errs;
  console.log(JSON.stringify(res, null, 1)); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
