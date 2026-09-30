// usage: node render.js <data.json> <out.png>
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

const cho = (v) => v / 1e12;
const fmtCho = (x) => (x >= 100 ? x.toFixed(0) : x.toFixed(1));
const fmtPer = (p) => (p == null || !isFinite(p) || p <= 0 ? null : p >= 100 ? p.toFixed(0) : p.toFixed(1));
const list = D.jp;
const max = list[0].mcap;
const total = list.reduce((a, r) => a + r.mcap, 0);
const top10 = list.slice(0, 10).reduce((a, r) => a + r.mcap, 0);
const pers = list.filter((r) => fmtPer(r.per)).sort((a, b) => a.per - b.per);
const median = pers.length % 2 ? pers[(pers.length - 1) / 2].per : (pers[pers.length / 2 - 1].per + pers[pers.length / 2].per) / 2;
const gap12 = list[0].mcap - list[1].mcap;

function rows(slice, offset) {
  return slice
    .map((r, j) => {
      const i = offset + j;
      const per = fmtPer(r.per);
      const perCls = per == null ? "na" : r.per >= 40 ? "hot" : r.per < 15 ? "cool" : "";
      const name = nameOf(r);
      const len = [...name].reduce((a, c) => a + (c.charCodeAt(0) > 0xff ? 1 : 0.6), 0);
      return `<div class="row${i < 3 ? " top" : ""}">
        <div class="bar" style="width:${((r.mcap / max) * 100).toFixed(1)}%"></div>
        <div class="rk rk${i + 1}">${i + 1}</div>
        ${logoHTML(r)}
        <div class="nm" style="font-size:${Math.max(13, Math.min(20, Math.floor(206 / len)))}px">${esc(name)}</div>
        <div class="mc">${fmtCho(cho(r.mcap))}<small>兆円</small></div>
        <div class="pe ${perCls}">${per == null ? "—" : `${per}<small>倍</small>`}</div>
      </div>`;
    })
    .join("");
}
const half = Math.ceil(list.length / 2);
const panel = (from, to) => `<div class="panel">
  <div class="cols"><div>順位</div><div></div><div>企業名</div><div>時価総額</div><div>予想PER</div></div>
  ${rows(list.slice(from, to), from)}</div>`;

const fontCss = ["noto-sans-jp/500", "noto-sans-jp/700", "noto-sans-jp/900", "inter/500", "inter/600", "inter/700", "inter/800", "inter/900"]
  .map((f) => `<link rel="stylesheet" href="node_modules/@fontsource/${f}.css">`).join("");

const html = `<!doctype html><html><head><meta charset="utf-8">${fontCss}<style>
:root{--bg:#070A12;--line:rgba(255,255,255,.07);--tx:#F4F6FB;--mut:#8A93A8;--red:#FF3B55;--gold:#F5C451;--silver:#C9D1DD;--bronze:#D9925B}
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W}px;height:${H}px;background:var(--bg);color:var(--tx);font-family:Inter,"Noto Sans JP",sans-serif;overflow:hidden;position:relative;-webkit-font-smoothing:antialiased}
.glow{position:absolute;inset:0;background:
  radial-gradient(760px 460px at -6% -10%,rgba(255,59,85,.30),transparent 70%),
  radial-gradient(620px 420px at 108% -6%,rgba(245,196,81,.16),transparent 70%),
  radial-gradient(900px 520px at 50% 118%,rgba(255,59,85,.08),transparent 70%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:40px 40px;mask-image:linear-gradient(#000 0,transparent 320px);opacity:.5}
.sun{position:absolute;right:-120px;top:-150px;width:460px;height:460px;border-radius:50%;background:radial-gradient(circle at 40% 60%,rgba(255,59,85,.32),rgba(188,0,45,.08) 60%,transparent 70%);filter:blur(2px)}
.wrap{position:relative;padding:36px 40px 0}
.kicker{display:flex;justify-content:space-between;align-items:center;font:700 13px Inter;letter-spacing:.24em;color:var(--mut)}
.pill{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);font:800 14px "Noto Sans JP";letter-spacing:.06em;color:var(--tx)}
.pill i{width:8px;height:8px;border-radius:50%;background:var(--gold);box-shadow:0 0 12px var(--gold)}
h1{margin-top:16px;display:flex;align-items:center;gap:18px}
h1 .flag{height:44px;border-radius:5px;box-shadow:0 0 0 1px rgba(255,255,255,.3),0 6px 20px rgba(0,0,0,.4)}
h1 .t{font:900 58px/1 "Noto Sans JP";letter-spacing:-.01em}
h1 .t em{font-style:normal;color:var(--red)}
h1 .top{font:900 64px/1 Inter;background:linear-gradient(180deg,#FFE7A3,#F5C451 55%,#C98B2B);-webkit-background-clip:text;color:transparent;letter-spacing:-.02em}
.kpis{margin-top:24px;display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:14px}
.kpi{position:relative;padding:16px 20px 15px;border-radius:16px;background:linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.10);box-shadow:inset 0 1px 0 rgba(255,255,255,.08);overflow:hidden}
.kpi .l{font:700 12px "Noto Sans JP";color:var(--mut);letter-spacing:.08em}
.kpi .v{margin-top:6px;display:flex;align-items:center;gap:10px;font:900 34px/1 Inter;letter-spacing:-.01em;white-space:nowrap}
.kpi .v small{font:800 15px "Noto Sans JP";margin-left:2px;color:var(--tx)}
.kpi .v .n{font:900 22px "Noto Sans JP";white-space:nowrap;overflow:hidden;min-width:0;flex:1}
.kpi .s{margin-top:8px;font:500 12px/1.4 "Noto Sans JP";color:var(--mut);white-space:nowrap}
.kpi .s b{color:var(--tx);font-weight:700}
.kpi.first{border-color:rgba(245,196,81,.35);background:linear-gradient(135deg,rgba(245,196,81,.14),rgba(255,255,255,.02))}
.kpi.first .l{color:var(--gold)}
.kpi .logo{width:58px;height:36px;flex:none}
.panels{margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:22px}
.panel{background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08);border-radius:18px;overflow:hidden;position:relative}
.panel::before{content:"";position:absolute;left:0;top:0;right:0;height:3px;background:linear-gradient(90deg,var(--red),transparent)}
.cols,.row{display:grid;grid-template-columns:30px 64px 1fr 106px 62px;align-items:center;column-gap:10px;padding:0 16px}
.cols{height:36px;font:700 11px "Noto Sans JP";color:var(--mut);letter-spacing:.06em;border-bottom:1px solid var(--line)}
.cols div:nth-child(n+4){text-align:right}
.row{position:relative;height:69px;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}
.bar{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,rgba(255,59,85,0),rgba(255,59,85,.16));border-right:2px solid rgba(255,59,85,.45)}
.rk{position:relative;font:800 19px Inter;color:#6F7890;text-align:center;font-variant-numeric:tabular-nums}
.rk1,.rk2,.rk3{font-size:22px;font-weight:900}
.rk1{color:var(--gold);text-shadow:0 0 16px rgba(245,196,81,.55)} .rk2{color:var(--silver)} .rk3{color:var(--bronze)}
.logo{position:relative;width:64px;height:40px;border-radius:9px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.4)}
.logo img{max-width:54px;max-height:28px;object-fit:contain}
.logo svg{width:24px;height:24px}
.logo.mono span{font:900 15px "Noto Sans JP",Inter;color:#fff;letter-spacing:-.03em;white-space:nowrap}
.nm{position:relative;font-family:"Noto Sans JP";font-weight:700;white-space:nowrap;overflow:hidden;letter-spacing:-.01em}
.top .nm{font-weight:900}
.mc{position:relative;text-align:right;font:800 23px Inter;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.mc small,.pe small{font:700 11px "Noto Sans JP";color:var(--mut);margin-left:2px}
.pe{position:relative;text-align:right;font:700 18px Inter;font-variant-numeric:tabular-nums;color:#D5DBE7}
.pe.hot{color:#FFB547} .pe.cool{color:#4FD1B5} .pe.na{color:#56607A}
.foot{position:absolute;left:40px;right:40px;bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px}
.note{font:500 11px/1.65 "Noto Sans JP";color:#707A92}
.note .lg{display:inline-flex;gap:12px;margin-left:8px}
.note .lg span::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;vertical-align:1px;background:currentColor}
.brand{text-align:right;white-space:nowrap}
.brand .h{font:800 22px Inter;letter-spacing:-.01em}
.brand .c{font:700 11.5px "Noto Sans JP";color:var(--gold);letter-spacing:.14em;margin-top:3px}
</style></head><body>
<div class="glow"></div><div class="grid"></div><div class="sun"></div>
<div class="wrap">
  <div class="kicker"><span>JAPAN MARKET CAP RANKING</span><span class="pill"><i></i>${esc(D.asOfLabel)}</span></div>
  <h1><svg class="flag" viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/></svg>
    <span class="t">日本企業 <em>時価総額</em>ランキング</span><span class="top">TOP${list.length}</span></h1>
  <div class="kpis">
    <div class="kpi first"><div class="l">👑 首位</div>
      <div class="v">${logoHTML(list[0])}<span class="n">${esc(nameOf(list[0]))}</span></div>
      <div class="s"><b>${fmtCho(cho(list[0].mcap))}兆円</b>　2位 ${esc(nameOf(list[1]))}に <b>${(gap12 / 1e12).toFixed(1)}兆円</b> 差</div></div>
    <div class="kpi"><div class="l">TOP${list.length} 時価総額 合計</div>
      <div class="v">${fmtCho(cho(total))}<small>兆円</small></div>
      <div class="s">うちTOP10で <b>${Math.round((top10 / total) * 100)}%</b> を占める</div></div>
    <div class="kpi"><div class="l">予想PER 中央値</div>
      <div class="v">${median.toFixed(1)}<small>倍</small></div>
      <div class="s">最高 <b>${esc(nameOf(pers[pers.length - 1]))} ${pers[pers.length - 1].per.toFixed(1)}倍</b><br>最低 <b>${esc(nameOf(pers[0]))} ${pers[0].per.toFixed(1)}倍</b></div></div>
  </div>
  <div class="panels">${panel(0, half)}${panel(half, list.length)}</div>
</div>
<div class="foot">
  <div class="note">${esc(D.priceNote)}　時価総額＝株価×発行済株式数（自己株式含む）<br>
    ${esc(D.perNote)}<span class="lg"><span style="color:#4FD1B5">15倍未満</span><span style="color:#FFB547">40倍以上</span></span><br>
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
  await page.evaluate(() => document.querySelectorAll(".nm,.kpi .n").forEach((el) => {
    let s = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth && s > 11) el.style.fontSize = (s -= 0.5) + "px";
  }));
  const box = await page.evaluate(() => ({
    panelsBottom: document.querySelector(".panels").getBoundingClientRect().bottom,
    footTop: document.querySelector(".foot").getBoundingClientRect().top,
    overflowKpi: [...document.querySelectorAll(".kpi .s,.kpi .v")].some((e) => e.scrollWidth > e.clientWidth + 1),
  }));
  console.log(box);
  await page.screenshot({ path: path.resolve(__dirname, outPath) });
  await browser.close();
})();
