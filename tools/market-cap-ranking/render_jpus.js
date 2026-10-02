// 日米 × 2時点の時価総額TOP10（2×2グリッド）。usage: node render_jpus.js [data_jpus.json] [out.png]
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const { logoHTML, esc } = require("./logo");

const [, , dataPath = "data_jpus.json", outPath = "jpus.png"] = process.argv;
const D = JSON.parse(fs.readFileSync(path.resolve(__dirname, dataPath), "utf8"));
const W = 1200, H = 1500;

const cho = (yen) => { const x = yen / 1e12; return x >= 100 ? x.toFixed(0) : x.toFixed(1); };
const usd = (v) => (v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : `$${Math.round(v / 1e9)}B`);
const breakable = (name) => esc(name).replace(/(フィナンシャル|ホールディング|グループ|・)/g, (m, w, i) => (i ? "<wbr>" : "") + m);

const flagJP = `<svg class="flag" viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/></svg>`;
const flagUS = `<svg class="flag" viewBox="0 0 38 20">${Array.from({ length: 13 }, (_, i) => `<rect y="${(i * 20) / 13}" width="38" height="${20 / 13 + 0.02}" fill="${i % 2 ? "#fff" : "#B22234"}"/>`).join("")}<rect width="15.2" height="10.77" fill="#3C3B6E"/>${Array.from({ length: 20 }, (_, i) => `<circle cx="${1.9 + (i % 5) * 2.85}" cy="${1.5 + Math.floor(i / 5) * 2.6}" r="0.55" fill="#fff"/>`).join("")}</svg>`;

function panel(rows, country, era) {
  const yen = (v) => (country === "us" ? v * era.usdjpy : v);
  // バーは各パネルの1位を基準（日米の差は「日米1位の差」バッジで示す）
  const max = Math.max(...rows.map((r) => yen(r[2])));
  const body = rows.map(([name, key, v], i) => `<div class="row${i < 3 ? " top" : ""}">
      <div class="bar" style="width:${((yen(v) / max) * 100).toFixed(1)}%"></div>
      <div class="rk"><span class="${i < 3 ? `medal m${i + 1}` : ""}">${i + 1}</span></div>
      ${logoHTML(key, name)}
      <div class="nm">${breakable(name)}</div>
      <div class="mc"><div class="v">${cho(yen(v))}<small>兆円</small></div>${country === "us" ? `<div class="d">${usd(v)}</div>` : ""}</div>
    </div>`).join("");
  return `<div class="panel ${country}">
    <div class="ph">${country === "jp" ? flagJP : flagUS}<b>${country === "jp" ? "日本" : "米国"}</b></div>
    ${body}</div>`;
}

function era(e, idx) {
  const ratio = (e.us[0][2] * e.usdjpy) / e.jp[0][2];
  return `<section class="era${idx ? " now" : ""}">
    <div class="eh"><div class="el">${esc(e.label)}${e.note ? `<small>${esc(e.note)}</small>` : ""}</div>
      <div class="gap">日米1位の差 <b>${ratio.toFixed(1)}倍</b></div></div>
    <div class="grid">${panel(e.jp, "jp", e)}${panel(e.us, "us", e)}</div>
  </section>`;
}

const fontCss = ["noto-sans-jp/500", "noto-sans-jp/700", "noto-sans-jp/900", "inter/600", "inter/700", "inter/800", "inter/900"]
  .map((f) => `<link rel="stylesheet" href="node_modules/@fontsource/${f}.css">`).join("");

const html = `<!doctype html><html><head><meta charset="utf-8">${fontCss}<style>
:root{--red:#D1002C;--red2:#A00022;--navy:#1E3A8A;--ink:#12141A;--mut:#6B7280;--line:#EEF0F3}
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W}px;height:${H}px;background:var(--red);color:var(--ink);font-family:Inter,"Noto Sans JP",sans-serif;overflow:hidden;position:relative;-webkit-font-smoothing:antialiased}
.bg{position:absolute;inset:0;background:radial-gradient(900px 700px at 88% 4%,#F0143F 0%,transparent 60%),linear-gradient(180deg,var(--red) 0%,var(--red2) 100%)}
.rays{position:absolute;inset:0;background:repeating-conic-gradient(from -4deg at 88% 6%,rgba(255,255,255,.07) 0 5deg,transparent 5deg 12deg);mask-image:radial-gradient(1100px 900px at 88% 6%,#000 20%,transparent 75%)}
.wrap{position:relative;padding:34px 32px 0}
.kicker{display:flex;align-items:center;gap:14px;font:800 14px Inter;letter-spacing:.26em;color:rgba(255,255,255,.85)}
.pill{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;background:#fff;color:var(--red);font:900 15px "Noto Sans JP";letter-spacing:.04em;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.pill i{width:8px;height:8px;border-radius:50%;background:var(--red)}
h1{margin-top:14px;font:900 56px/1 "Noto Sans JP";color:#fff;letter-spacing:-.01em;text-shadow:0 4px 18px rgba(80,0,10,.35);white-space:nowrap}
h1 .top{font:900 50px/1 Inter;color:var(--red);background:#fff;padding:6px 14px 8px;border-radius:12px;margin-left:12px;vertical-align:4px;box-shadow:0 6px 20px rgba(80,0,10,.3)}
.era{margin-top:18px}
.eh{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.el{font:900 26px "Noto Sans JP";color:#fff;display:flex;align-items:baseline;gap:12px}
.el small{font:700 12.5px "Noto Sans JP";color:rgba(255,255,255,.8)}
.gap{font:800 14px "Noto Sans JP";color:var(--ink);background:#FFE08A;border-radius:999px;padding:6px 14px;box-shadow:0 4px 12px rgba(0,0,0,.18)}
.gap b{font:900 19px Inter;color:var(--red2);margin-left:2px}
.now .gap{background:#FFD84D}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.panel{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 14px 34px rgba(70,0,12,.35)}
.ph{display:flex;align-items:center;gap:10px;height:34px;padding:0 14px;font:900 15px "Noto Sans JP";color:#fff}
.jp .ph{background:#1B1D24} .us .ph{background:var(--navy)}
.flag{height:16px;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.4)}
.row{position:relative;display:grid;grid-template-columns:30px 58px 1fr 104px;align-items:center;column-gap:10px;padding:0 14px 0 8px;height:56.6px;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}
.bar{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,rgba(209,0,44,0),rgba(209,0,44,.06))}
.us .bar{background:linear-gradient(90deg,rgba(30,58,138,0),rgba(30,58,138,.07))}
.bar::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,rgba(209,0,44,.15),rgba(209,0,44,.75));border-radius:0 2px 2px 0}
.us .bar::after{background:linear-gradient(90deg,rgba(30,58,138,.15),rgba(30,58,138,.8))}
.rk{position:relative;text-align:center;font:800 17px Inter;color:#9AA1AD}
.medal{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font:900 15px Inter;color:#fff;box-shadow:inset 0 -2px 0 rgba(0,0,0,.18),0 2px 6px rgba(0,0,0,.18)}
.m1{background:linear-gradient(160deg,#FFD84D,#E0A100)} .m2{background:linear-gradient(160deg,#D9DEE6,#9CA5B4)} .m3{background:linear-gradient(160deg,#EAB07A,#B86B2E)}
.logo{position:relative;width:58px;height:34px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #E6E8EC}
.logo img{max-width:48px;max-height:24px;object-fit:contain}
.logo svg{width:22px;height:22px}
.logo.mono span{font:900 13px "Noto Sans JP",Inter;color:#fff;letter-spacing:-.03em;white-space:nowrap}
.nm{position:relative;font:700 15.5px/1.2 "Noto Sans JP";letter-spacing:-.02em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all}
.top .nm{font-weight:900}
.mc{position:relative;text-align:right;line-height:1.05;white-space:nowrap}
.mc .v{font:900 22px Inter;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.top .mc .v{color:var(--red)} .us.panel .top .mc .v{color:var(--navy)}
.mc small{font:800 10.5px "Noto Sans JP";color:var(--mut);margin-left:2px}
.mc .d{font:700 10.5px Inter;color:var(--mut);margin-top:2px}
.foot{position:absolute;left:32px;right:32px;bottom:20px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px;color:#fff}
.note{font:500 11px/1.65 "Noto Sans JP";color:rgba(255,255,255,.85)}
.brand{text-align:right;white-space:nowrap}
.brand .h{font:900 24px Inter}
.brand .c{font:800 12px "Noto Sans JP";letter-spacing:.16em;margin-top:3px;color:#FFE08A}
.wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:9}
.wm span{transform:rotate(-24deg);font:900 110px "Noto Sans JP";color:rgba(0,0,0,.12);border:10px solid rgba(0,0,0,.12);padding:10px 40px;border-radius:24px;white-space:nowrap}
</style></head><body>
<div class="bg"></div><div class="rays"></div>
<div class="wrap">
  <div class="kicker"><span class="pill"><i></i>${esc(D.sub)}</span><span>JAPAN vs USA MARKET CAP</span></div>
  <h1>${esc(D.title.replace(/\s*TOP\d+$/, ""))}<span class="top">TOP10</span></h1>
  ${D.eras.map(era).join("")}
</div>
${D.provisional && D.provisional.length ? `<div class="wm"><span>確認中 PREVIEW</span></div>` : ""}
</body></html>`;

(async () => {
  const htmlPath = path.join(__dirname, "page.html");
  fs.writeFileSync(htmlPath, html);
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.goto("file://" + htmlPath);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.querySelectorAll(".nm").forEach((el) => {
    let s = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollHeight > el.clientHeight + 1 && s > 10) el.style.fontSize = (s -= 0.5) + "px";
  }));
  console.log(await page.evaluate(() => ({
    lastEraBottom: [...document.querySelectorAll(".era")].pop().getBoundingClientRect().bottom,
    
    h1Right: document.querySelector("h1 .top").getBoundingClientRect().right,
  })));
  await page.screenshot({ path: path.resolve(__dirname, outPath) });
  await browser.close();
})();
