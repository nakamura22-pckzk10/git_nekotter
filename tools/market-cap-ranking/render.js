// usage: node render.js <data.json> <out.png>
// 配色: Xのライト(白)/ダーク(黒)どちらのタイムラインでも埋もれないよう、
// 外枠は日の丸の赤、表は白パネルにしている（白にも黒にも強いコントラスト）。
const fs = require("fs");
const path = require("path");
const si = require("simple-icons");
const { chromium } = require("playwright-core");
const META = require("./meta");

const [, , dataPath = "data.json", outPath = "ranking.png"] = process.argv;
const D = JSON.parse(fs.readFileSync(path.resolve(__dirname, dataPath), "utf8"));
const W = 1200, H = 1500;
const LOGO_DIR = path.join(__dirname, "logos");

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const siBySlug = Object.fromEntries(Object.values(si).filter((x) => x && x.slug).map((x) => [x.slug, x]));
const meta = (r) => META.jp[r.key] || { name: r.name || r.key, color: "#444", mono: (r.name || r.key)[0] };
const nameOf = (r) => r.name || meta(r).name;

// ロゴ: 実ロゴ画像(logos/<key>.*) > simple-icons > モノグラム
function logoHTML(r) {
  const m = meta(r);
  for (const ext of ["png", "webp", "svg", "jpg"]) {
    const f = path.join(LOGO_DIR, `${r.key}.${ext}`);
    if (fs.existsSync(f)) {
      const mime = { png: "image/png", webp: "image/webp", svg: "image/svg+xml", jpg: "image/jpeg" }[ext];
      return `<div class="logo"><img src="data:${mime};base64,${fs.readFileSync(f).toString("base64")}"></div>`;
    }
  }
  const icon = m.si && siBySlug[m.si];
  if (icon) return `<div class="logo"><svg viewBox="0 0 24 24"><path fill="${/^f+$/i.test(icon.hex) ? "#000" : m.color}" d="${icon.path}"/></svg></div>`;
  const t = m.mono || nameOf(r)[0];
  return `<div class="logo mono" style="background:${m.color}"><span style="font-size:${[0, 19, 15, 12, 10][Math.min(t.length, 4)]}px">${esc(t)}</span></div>`;
}

const fmtCho = (v) => (v / 1e12 >= 100 ? (v / 1e12).toFixed(0) : (v / 1e12).toFixed(1));
const list = D.jp;
const max = list[0].mcap;

function rows(slice, offset) {
  return slice
    .map((r, j) => {
      const i = offset + j;
      const name = nameOf(r);
      const len = [...name].reduce((a, c) => a + (c.charCodeAt(0) > 0xff ? 1 : 0.6), 0);
      return `<div class="row${i < 3 ? " top" : ""}">
        <div class="bar" style="width:${((r.mcap / max) * 100).toFixed(1)}%"></div>
        <div class="rk"><span class="${i < 3 ? `medal m${i + 1}` : ""}">${i + 1}</span></div>
        ${logoHTML(r)}
        <div class="nm" style="font-size:${Math.max(14, Math.min(23, Math.floor(290 / len)))}px">${esc(name)}</div>
        <div class="mc">${fmtCho(r.mcap)}<small>兆円</small></div>
      </div>`;
    })
    .join("");
}
const half = Math.ceil(list.length / 2);
const panel = (from, to) => `<div class="panel">
  <div class="cols"><div>順位</div><div>企業名</div><div>時価総額</div></div>
  ${rows(list.slice(from, to), from)}</div>`;

const fontCss = ["noto-sans-jp/500", "noto-sans-jp/700", "noto-sans-jp/900", "inter/600", "inter/700", "inter/800", "inter/900"]
  .map((f) => `<link rel="stylesheet" href="node_modules/@fontsource/${f}.css">`).join("");

const html = `<!doctype html><html><head><meta charset="utf-8">${fontCss}<style>
:root{--red:#D1002C;--red2:#A00022;--ink:#12141A;--mut:#6B7280;--line:#EEF0F3;--gold:#F2B705}
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W}px;height:${H}px;background:var(--red);color:var(--ink);font-family:Inter,"Noto Sans JP",sans-serif;overflow:hidden;position:relative;-webkit-font-smoothing:antialiased}
.bg{position:absolute;inset:0;background:
  radial-gradient(900px 700px at 88% 4%,#F0143F 0%,transparent 60%),
  linear-gradient(180deg,var(--red) 0%,var(--red2) 100%)}
.rays{position:absolute;inset:0;background:repeating-conic-gradient(from -4deg at 88% 6%,rgba(255,255,255,.07) 0 5deg,transparent 5deg 12deg);
  mask-image:radial-gradient(1100px 900px at 88% 6%,#000 20%,transparent 75%)}
.sun{position:absolute;right:52px;top:-86px;width:250px;height:250px;border-radius:50%;background:radial-gradient(circle at 45% 55%,rgba(255,255,255,.22),rgba(255,255,255,.06) 70%);border:2px solid rgba(255,255,255,.18)}
.wrap{position:relative;padding:40px 40px 0}
.kicker{display:flex;align-items:center;gap:14px;font:800 14px Inter;letter-spacing:.26em;color:rgba(255,255,255,.85)}
.pill{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;background:#fff;color:var(--red);font:900 15px "Noto Sans JP";letter-spacing:.04em;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.pill i{width:8px;height:8px;border-radius:50%;background:var(--red)}
h1{margin-top:18px;display:flex;align-items:center;gap:18px;color:#fff}
h1 .t{font:900 64px/1 "Noto Sans JP";letter-spacing:-.01em;text-shadow:0 4px 18px rgba(80,0,10,.35)}
h1 .top{font:900 60px/1 Inter;letter-spacing:-.02em;color:var(--red);background:#fff;padding:8px 18px 10px;border-radius:14px;box-shadow:0 6px 20px rgba(80,0,10,.3)}
.panels{margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:22px}
.panel{background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 18px 40px rgba(70,0,12,.35),0 0 0 1px rgba(0,0,0,.04)}
.cols,.row{display:grid;grid-template-columns:44px 64px 1fr 128px;align-items:center;column-gap:12px;padding:0 20px 0 16px}
.cols{height:42px;background:#F6F7F9;font:800 12px "Noto Sans JP";color:var(--mut);letter-spacing:.1em;border-bottom:1px solid var(--line)}
.cols div:nth-child(2){grid-column:2 / 4;padding-left:0}
.cols div:last-child{text-align:right}
.row{position:relative;height:77.4px;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}
.bar{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,rgba(209,0,44,0),rgba(209,0,44,.07))}
.bar::after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:linear-gradient(90deg,rgba(209,0,44,.15),rgba(209,0,44,.75));border-radius:0 2px 2px 0}
.rk{position:relative;text-align:center;font:800 22px Inter;color:#9AA1AD;font-variant-numeric:tabular-nums}
.medal{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;font:900 20px Inter;color:#fff;box-shadow:inset 0 -3px 0 rgba(0,0,0,.18),0 3px 8px rgba(0,0,0,.18)}
.m1{background:linear-gradient(160deg,#FFD84D,#E0A100)} .m2{background:linear-gradient(160deg,#D9DEE6,#9CA5B4)} .m3{background:linear-gradient(160deg,#EAB07A,#B86B2E)}
.logo{position:relative;width:64px;height:42px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #E6E8EC}
.logo img{max-width:54px;max-height:28px;object-fit:contain}
.logo svg{width:26px;height:26px}
.logo.mono span{font:900 15px "Noto Sans JP",Inter;color:#fff;letter-spacing:-.03em;white-space:nowrap}
.nm{position:relative;font-family:"Noto Sans JP";font-weight:700;white-space:nowrap;overflow:hidden;letter-spacing:-.01em;color:var(--ink)}
.top .nm{font-weight:900}
.mc{position:relative;text-align:right;font:900 30px Inter;font-variant-numeric:tabular-nums;letter-spacing:-.02em;color:var(--ink)}
.top .mc{color:var(--red)}
.mc small{font:800 13px "Noto Sans JP";color:var(--mut);margin-left:3px}
.foot{position:absolute;left:40px;right:40px;bottom:26px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;color:#fff}
.note{font:500 12px/1.7 "Noto Sans JP";color:rgba(255,255,255,.82)}
.brand{text-align:right;white-space:nowrap}
.brand .h{font:900 26px Inter;letter-spacing:-.01em}
.brand .c{font:800 12.5px "Noto Sans JP";letter-spacing:.16em;margin-top:3px;color:#FFE08A}
</style></head><body>
<div class="bg"></div><div class="rays"></div><div class="sun"></div>
<div class="wrap">
  <div class="kicker"><span class="pill"><i></i>${esc(D.asOfLabel)}</span><span>JAPAN MARKET CAP RANKING</span></div>
  <h1><span class="t">日本企業 時価総額ランキング</span><span class="top">TOP${list.length}</span></h1>
  <div class="panels">${panel(0, half)}${panel(half, list.length)}</div>
</div>
<div class="foot">
  <div class="note">${esc(D.priceNote)}　時価総額＝株価×発行済株式数（自己株式含む）<br>
    出所：${esc(D.source)}　※特定銘柄の推奨ではありません。投資判断はご自身の責任で</div>
  <div class="brand"><div class="h">@kazu22_stock</div><div class="c">銘柄攻略クラブ</div></div>
</div>
</body></html>`;

(async () => {
  const htmlPath = path.join(__dirname, "page.html");
  fs.writeFileSync(htmlPath, html);
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.goto("file://" + htmlPath);
  await page.evaluate(() => document.fonts.ready);
  // はみ出す社名は縮小
  await page.evaluate(() => document.querySelectorAll(".nm").forEach((el) => {
    let s = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth && s > 12) el.style.fontSize = (s -= 0.5) + "px";
  }));
  console.log(await page.evaluate(() => ({
    panelsBottom: document.querySelector(".panels").getBoundingClientRect().bottom,
    footTop: document.querySelector(".foot").getBoundingClientRect().top,
    titleRight: document.querySelector("h1 .top").getBoundingClientRect().right,
  })));
  await page.screenshot({ path: path.resolve(__dirname, outPath) });
  await browser.close();
})();
