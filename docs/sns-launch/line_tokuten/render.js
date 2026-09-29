// 使い方: node render.js  →  output.png を書き出す（fonts/ は fetch-fonts.sh で取得）
// 「無料」の色は index.html?free=gold|ink で切替（採用：gold）
const path = require('path');
const { chromium } = require('playwright');
const variants = { gold: 'output.png' };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 });
  for (const [v, file] of Object.entries(variants)) {
    await page.goto('file://' + path.join(__dirname, 'index.html') + '?free=' + v);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('body[data-ready]');
    await page.waitForTimeout(300);
    const el = await page.$('#canvas');
    const box = await el.boundingBox();
    console.log(file, Math.round(box.width), 'x', Math.round(box.height));
    await el.screenshot({ path: path.join(__dirname, file) });
  }
  await browser.close();
})();
