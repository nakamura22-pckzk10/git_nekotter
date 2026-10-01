// 年代別の時価総額ランキング（3列）。usage: node render_eras.js [data_eras.json] [out.png]
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const { logoHTML, esc } = require("./logo");

const [, , dataPath = "data_eras.json", outPath = "eras.png"] = process.argv;
const D = JSON.parse(fs.readFileSync(path.resolve(__dirname, dataPath), "utf8"));
const W = 1200, H = 1500, N = 20;

// 2026年分は fetch.js の出力から読む
for (const e of D.eras) {
  if (!e.fromData) continue;
  const src = JSON.parse(fs.readFileSync(path.resolve(__dirname, e.fromData), "utf8"));
  const { META } = require("./logo");
  e.rows = src.jp.slice(0, N).map((r) => ({ name: r.name || META.jp[r.key].name, logo: r.key, mcap: r.mcap }));
}
const max = Math.max(...D.eras.flatMap((e) => e.rows.map((r) => r.mcap || 0)));
const incomplete = D.eras.some((e) => e.rows.length < N || e.rows.some((r) => r.mcap == null));
// 長い社名は語の切れ目でだけ改行させる（keep-all + <wbr>）
const breakable = (name) => esc(name).replace(/(フィナンシャル|ホールディング|グループ|・)/g, (m, w, i) => (i ? "<wbr>" : "") + m);
const fmt = (v) => (v / 1e12).toFixed(1);

function panel(e, idx) {
  const rows = Array.from({ length: N }, (_, i) => {
    const r = e.rows[i];
    if (!r) return `<div class="row empty"><div class="rk">${i + 1}</div><div></div><div class="nm na">未確認</div><div class="mc na">—</div></div>`;
    return `<div class="row${i < 3 ? " top" : ""}">
      ${r.mcap ? `<div class="bar" style="width:${((r.mcap / max) * 100).toFixed(1)}%"></div>` : ""}
      <div class="rk"><span class="${i < 3 ? `medal m${i + 1}` : ""}">${i + 1}</span></div>
      ${logoHTML(r.logo, r.name)}
      <div class="nm">${breakable(r.name)}</div>
      <div class="mc${r.mcap ? "" : " na"}">${r.mcap ? `${fmt(r.mcap)}<small>兆円</small>` : "—"}</div>
    </div>`;
  }).join("");
  const now = idx === D.eras.length - 1;
  return `<div class="panel${now ? " now" : ""}">
    <div class="ph"><div class="yr">${esc(e.year)}<small>${esc(e.label.replace(e.year, "").replace(/^年/, "年"))}</small></div><div class="pn">${esc(e.note)}</div></div>
    <div class="cols"><div>順位</div><div>企業名</div><div>時価総額</div></div>
    ${rows}</div>`;
}

const fontCss = ["noto-sans-jp/500", "noto-sans-jp/700", "noto-sans-jp/900", "inter/600", "inter/700", "inter/800", "inter/900"]
  .map((f) => `<link rel="stylesheet" href="node_modules/@fontsource/${f}.css">`).join("");

const html = `<!doctype html><html><head><meta charset="utf-8">${fontCss}<style>
:root{--red:#D1002C;--red2:#A00022;--ink:#12141A;--mut:#6B7280;--line:#EEF0F3}
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W}px;height:${H}px;background:var(--red);color:var(--ink);font-family:Inter,"Noto Sans JP",sans-serif;overflow:hidden;position:relative;-webkit-font-smoothing:antialiased}
.bg{position:absolute;inset:0;background:radial-gradient(900px 700px at 88% 4%,#F0143F 0%,transparent 60%),linear-gradient(180deg,var(--red) 0%,var(--red2) 100%)}
.rays{position:absolute;inset:0;background:repeating-conic-gradient(from -4deg at 88% 6%,rgba(255,255,255,.07) 0 5deg,transparent 5deg 12deg);mask-image:radial-gradient(1100px 900px at 88% 6%,#000 20%,transparent 75%)}
.sun{position:absolute;right:52px;top:-86px;width:250px;height:250px;border-radius:50%;background:radial-gradient(circle at 45% 55%,rgba(255,255,255,.22),rgba(255,255,255,.06) 70%);border:2px solid rgba(255,255,255,.18)}
.wrap{position:relative;padding:36px 32px 0}
.kicker{display:flex;align-items:center;gap:14px;font:800 14px Inter;letter-spacing:.26em;color:rgba(255,255,255,.85)}
.pill{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;background:#fff;color:var(--red);font:900 15px "Noto Sans JP";letter-spacing:.04em;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.pill i{width:8px;height:8px;border-radius:50%;background:var(--red)}
h1{margin-top:16px;display:flex;align-items:center;gap:16px;color:#fff}
h1 .t{font:900 54px/1 "Noto Sans JP";white-space:nowrap;letter-spacing:-.01em;text-shadow:0 4px 18px rgba(80,0,10,.35)}
h1 .top{font:900 42px/1 Inter;letter-spacing:-.02em;color:var(--red);background:#fff;padding:8px 14px 9px;border-radius:12px;box-shadow:0 6px 20px rgba(80,0,10,.3)}
.panels{margin-top:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.panel{background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 18px 40px rgba(70,0,12,.35)}
.ph{display:flex;align-items:baseline;justify-content:space-between;padding:12px 14px 10px;background:#1B1D24;color:#fff}
.now .ph{background:linear-gradient(90deg,#FFD84D,#F2B705);color:var(--ink)}
.yr{font:900 38px/1 Inter;letter-spacing:-.02em}
.yr small{font:900 17px "Noto Sans JP";margin-left:3px;letter-spacing:0}
.pn{font:700 12px "Noto Sans JP";opacity:.75}
.cols,.row{display:grid;grid-template-columns:28px 48px 1fr 76px;align-items:center;column-gap:8px;padding:0 12px 0 8px}
.cols{height:28px;background:#F6F7F9;font:800 10.5px "Noto Sans JP";color:var(--mut);letter-spacing:.08em;border-bottom:1px solid var(--line)}
.cols div:nth-child(2){grid-column:2 / 4}
.cols div:last-child{text-align:right}
.row{position:relative;height:56.8px;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}
.bar{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,rgba(209,0,44,0),rgba(209,0,44,.06))}
.bar::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,rgba(209,0,44,.15),rgba(209,0,44,.75));border-radius:0 2px 2px 0}
.rk{position:relative;text-align:center;font:800 17px Inter;color:#9AA1AD;font-variant-numeric:tabular-nums}
.medal{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font:900 15px Inter;color:#fff;box-shadow:inset 0 -2px 0 rgba(0,0,0,.18),0 2px 6px rgba(0,0,0,.18)}
.m1{background:linear-gradient(160deg,#FFD84D,#E0A100)} .m2{background:linear-gradient(160deg,#D9DEE6,#9CA5B4)} .m3{background:linear-gradient(160deg,#EAB07A,#B86B2E)}
.logo{position:relative;width:48px;height:32px;border-radius:7px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #E6E8EC}
.logo img{max-width:40px;max-height:22px;object-fit:contain}
.logo svg{width:20px;height:20px}
.logo.mono span{font:900 13px "Noto Sans JP",Inter;color:#fff;letter-spacing:-.03em;white-space:nowrap}
.nm{position:relative;font:700 14.5px/1.22 "Noto Sans JP";letter-spacing:-.02em;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all;overflow-wrap:normal}
.top .nm{font-weight:900}
.mc{position:relative;text-align:right;font:900 21px Inter;font-variant-numeric:tabular-nums;letter-spacing:-.02em;white-space:nowrap}
.top .mc{color:var(--red)}
.mc small{font:800 10px "Noto Sans JP";color:var(--mut);margin-left:2px}
.na{color:#B0B6C0 !important;font-weight:700}
.foot{position:absolute;left:32px;right:32px;bottom:22px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px;color:#fff}
.note{font:500 11px/1.7 "Noto Sans JP";color:rgba(255,255,255,.85)}
.brand{text-align:right;white-space:nowrap}
.brand .h{font:900 24px Inter;letter-spacing:-.01em}
.brand .c{font:800 12px "Noto Sans JP";letter-spacing:.16em;margin-top:3px;color:#FFE08A}
.wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:9}
.wm span{transform:rotate(-24deg);font:900 110px "Noto Sans JP";color:rgba(0,0,0,.12);border:10px solid rgba(0,0,0,.12);padding:10px 40px;border-radius:24px;white-space:nowrap}
</style></head><body>
<div class="bg"></div><div class="rays"></div><div class="sun"></div>
<div class="wrap">
  <div class="kicker"><span class="pill"><i></i>${D.eras.map((e) => e.year).join(" → ")}</span><span>JAPAN MARKET CAP HISTORY</span></div>
  <h1><span class="t">${esc(D.title)}</span><span class="top">TOP${N}</span></h1>
  <div class="panels">${D.eras.map(panel).join("")}</div>
</div>
<div class="foot">
  <div class="note">時価総額＝株価×発行済株式数。社名は当時のもの、${esc(D.logoNote)}<br>出所：${esc(D.sources)}<br>※特定銘柄の推奨ではありません。投資判断はご自身の責任で</div>
  <div class="brand"><div class="h">@kazu22_stock</div><div class="c">銘柄攻略クラブ</div></div>
</div>
${incomplete ? `<div class="wm"><span>仮データ PREVIEW</span></div>` : ""}
</body></html>`;

(async () => {
  const htmlPath = path.join(__dirname, "page.html");
  fs.writeFileSync(htmlPath, html);
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.goto("file://" + htmlPath);
  await page.evaluate(() => document.fonts.ready);
  // 2行に収まらない社名は縮小
  await page.evaluate(() => document.querySelectorAll(".nm").forEach((el) => {
    let s = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollHeight > el.clientHeight + 1 && s > 10) el.style.fontSize = (s -= 0.5) + "px";
  }));
  console.log(await page.evaluate(() => ({
    panelsBottom: document.querySelector(".panels").getBoundingClientRect().bottom,
    footTop: document.querySelector(".foot").getBoundingClientRect().top,
    titleRight: document.querySelector("h1 .top").getBoundingClientRect().right,
  })));
  await page.screenshot({ path: path.resolve(__dirname, outPath) });
  await browser.close();
})();
