// usage: node render.js <data.json> <out.png>
const fs = require("fs");
const path = require("path");
const si = require("simple-icons");
const { chromium } = require("playwright-core");
const META = require("./meta");

const [, , dataPath = "data.preview.json", outPath = "out.png"] = process.argv;
const D = JSON.parse(fs.readFileSync(path.resolve(__dirname, dataPath), "utf8"));
const W = 1200, H = 1500;
const LOGO_DIR = path.join(__dirname, "logos");

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const siBySlug = Object.fromEntries(Object.values(si).filter((x) => x && x.slug).map((x) => [x.slug, x]));

// ロゴ: 実ロゴ画像(logos/<key>.png|webp|svg) > simple-icons > モノグラム
function logoHTML(key, m) {
  for (const ext of ["png", "webp", "svg", "jpg"]) {
    const f = path.join(LOGO_DIR, `${key}.${ext}`);
    if (fs.existsSync(f)) {
      const mime = { png: "image/png", webp: "image/webp", svg: "image/svg+xml", jpg: "image/jpeg" }[ext];
      return `<div class="logo"><img src="data:${mime};base64,${fs.readFileSync(f).toString("base64")}"></div>`;
    }
  }
  const icon = m.si && siBySlug[m.si];
  if (icon) {
    const fill = /^#?(fff|ffffff)$/i.test(icon.hex) ? "#000" : m.color || `#${icon.hex}`;
    return `<div class="logo"><svg viewBox="0 0 24 24"><path fill="${fill}" d="${icon.path}"/></svg></div>`;
  }
  const t = m.mono || m.name[0];
  const fs_ = t.length >= 4 ? 9 : t.length === 3 ? 11 : t.length === 2 ? 13 : 17;
  return `<div class="logo mono" style="background:${m.color}"><span style="font-size:${fs_}px">${esc(t)}</span></div>`;
}

const jpy = (v) => v / 1e12; // 兆円
const fmtCho = (x) => (x >= 100 ? x.toFixed(0) : x.toFixed(1));
const fmtUsd = (v) => (v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : `$${(v / 1e9).toFixed(0)}B`);
const fmtPer = (p) => (p == null || !isFinite(p) || p <= 0 ? null : p >= 100 ? p.toFixed(0) : p.toFixed(1));

function rows(list, country) {
  const vals = list.map((r) => (country === "us" ? r.mcap * D.usdjpy : r.mcap));
  const max = Math.max(...vals);
  return list
    .map((r, i) => {
      const m = META[country][r.key] || { name: r.name || r.key, color: "#444", mono: r.key.slice(0, 3) };
      const name = r.name || m.name;
      const v = vals[i];
      const per = fmtPer(r.per);
      const perCls = per == null ? "na" : r.per >= 50 ? "hot" : r.per < 15 ? "cool" : "";
      const len = [...name].reduce((a, c) => a + (c.charCodeAt(0) > 0xff ? 1 : 0.58), 0);
      const nameSize = Math.max(12, Math.min(17, Math.floor(222 / len)));
      return `<div class="row${i < 3 ? " top" : ""}">
        <div class="bar" style="width:${((v / max) * 100).toFixed(1)}%"></div>
        <div class="rk rk${i + 1}">${i + 1}</div>
        ${logoHTML(r.key, m)}
        <div class="nm" style="font-size:${nameSize}px">${esc(name)}</div>
        <div class="mc"><div class="mcv">${fmtCho(jpy(v))}<small>兆円</small></div>${
          country === "us" ? `<div class="usd">${fmtUsd(r.mcap)}</div>` : ""
        }</div>
        <div class="pe ${perCls}">${per == null ? "—" : `${per}<small>倍</small>`}</div>
      </div>`;
    })
    .join("");
}

const jpSum = D.jp.reduce((a, r) => a + r.mcap, 0);
const usSum = D.us.reduce((a, r) => a + r.mcap * D.usdjpy, 0);
const us1 = D.us[0], us1M = META.us[us1.key];
const us1Y = us1.mcap * D.usdjpy;
const ratio = usSum / jpSum;

const flagJP = `<svg class="flag" viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/></svg>`;
const flagUS = `<svg class="flag" viewBox="0 0 38 20">${Array.from({ length: 13 }, (_, i) => `<rect y="${(i * 20) / 13}" width="38" height="${20 / 13 + 0.02}" fill="${i % 2 ? "#fff" : "#B22234"}"/>`).join("")}<rect width="15.2" height="10.77" fill="#3C3B6E"/>${Array.from({ length: 20 }, (_, i) => `<circle cx="${1.9 + (i % 5) * 2.85}" cy="${1.5 + Math.floor(i / 5) * 2.6}" r="0.55" fill="#fff"/>`).join("")}</svg>`;

const fontCss = ["noto-sans-jp/500", "noto-sans-jp/700", "noto-sans-jp/900", "inter/500", "inter/600", "inter/700", "inter/800", "inter/900"]
  .map((f) => `<link rel="stylesheet" href="node_modules/@fontsource/${f}.css">`)
  .join("");

const html = `<!doctype html><html><head><meta charset="utf-8">${fontCss}<style>
:root{--bg:#070A12;--panel:#0E1320;--line:rgba(255,255,255,.07);--tx:#F4F6FB;--mut:#8A93A8;--jp:#FF3B55;--us:#3D8BFF;--gold:#F5C451;--silver:#C9D1DD;--bronze:#D9925B}
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W}px;height:${H}px;background:var(--bg);color:var(--tx);font-family:Inter,"Noto Sans JP",sans-serif;overflow:hidden;position:relative;-webkit-font-smoothing:antialiased}
.glow{position:absolute;inset:0;background:
  radial-gradient(700px 420px at -5% -8%,rgba(255,59,85,.28),transparent 70%),
  radial-gradient(700px 420px at 105% -8%,rgba(61,139,255,.30),transparent 70%),
  radial-gradient(900px 500px at 50% 115%,rgba(245,196,81,.07),transparent 70%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:40px 40px;mask-image:linear-gradient(#000 0,transparent 300px);opacity:.5}
.wrap{position:relative;padding:34px 40px 0}
.kicker{display:flex;justify-content:space-between;align-items:center;font:700 13px Inter;letter-spacing:.24em;color:var(--mut)}
.kicker b{color:var(--tx);font-weight:800}
.live{display:inline-flex;align-items:center;gap:8px}
.live i{width:8px;height:8px;border-radius:50%;background:var(--gold);box-shadow:0 0 12px var(--gold)}
h1{margin-top:14px;font:900 62px/1.05 "Noto Sans JP";letter-spacing:-.01em;display:flex;align-items:baseline;gap:14px}
h1 .jp{color:var(--jp)} h1 .us{color:var(--us)} h1 .vs{font:800 30px Inter;color:var(--mut);letter-spacing:0}
h1 .top{font:900 62px Inter;background:linear-gradient(180deg,#FFE7A3,#F5C451 55%,#C98B2B);-webkit-background-clip:text;color:transparent;letter-spacing:-.02em}
.hero{margin-top:22px;display:grid;grid-template-columns:1fr 1.25fr;gap:28px;align-items:center;padding:20px 26px;border-radius:18px;
  background:linear-gradient(135deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.10);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.hl{font:900 27px/1.35 "Noto Sans JP"}
.hl em{font-style:normal;color:var(--gold)}
.hl .sub{display:block;margin-top:6px;font:500 13.5px/1.5 "Noto Sans JP";color:var(--mut)}
.cmp{display:flex;flex-direction:column;gap:9px}
.cr{display:grid;grid-template-columns:118px 1fr;align-items:center;gap:12px;font:700 13px "Noto Sans JP";color:var(--mut)}
.track{position:relative;height:26px}
.fill{height:100%;border-radius:6px;display:flex;align-items:center;justify-content:flex-end;padding-right:10px;font:800 15px Inter;color:#fff;white-space:nowrap}
.fill.us{background:linear-gradient(90deg,#1F4FA8,var(--us))}
.fill.nv{background:linear-gradient(90deg,#4E7A00,#86C600)}
.fill.jp{background:linear-gradient(90deg,#9E1830,var(--jp))}
.fill small{font:700 11px "Noto Sans JP";margin-left:2px;opacity:.9}
.panels{margin-top:22px;display:grid;grid-template-columns:1fr 1fr;gap:24px}
.panel{background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08);border-radius:18px;overflow:hidden}
.ph{display:flex;align-items:center;gap:12px;padding:14px 18px 12px;border-bottom:1px solid var(--line);position:relative}
.ph::before{content:"";position:absolute;left:0;top:0;right:0;height:3px}
.jpP .ph::before{background:linear-gradient(90deg,var(--jp),transparent)} .usP .ph::before{background:linear-gradient(90deg,var(--us),transparent)}
.flag{height:22px;border-radius:3px;box-shadow:0 0 0 1px rgba(255,255,255,.25)}
.ph h2{font:900 22px "Noto Sans JP"} .ph h2 small{font:800 12px Inter;letter-spacing:.2em;color:var(--mut);margin-left:8px}
.ph .tot{margin-left:auto;text-align:right;font:500 11px "Noto Sans JP";color:var(--mut);line-height:1.25}
.ph .tot b{display:block;font:800 17px Inter;color:var(--tx)} .ph .tot b small{font:700 11px "Noto Sans JP";margin-left:1px}
.cols,.row{display:grid;grid-template-columns:30px 32px 1fr 104px 62px;align-items:center;column-gap:10px;padding:0 16px}
.cols{height:28px;font:700 10.5px "Noto Sans JP";color:var(--mut);letter-spacing:.06em;border-bottom:1px solid var(--line)}
.cols div:nth-child(n+4){text-align:right}
.row{position:relative;height:50px;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}
.bar{position:absolute;left:0;top:0;bottom:0;opacity:.11;pointer-events:none}
.jpP .bar{background:linear-gradient(90deg,transparent,var(--jp))} .usP .bar{background:linear-gradient(90deg,transparent,var(--us))}
.rk{position:relative;font:800 17px Inter;color:#6F7890;text-align:center;font-variant-numeric:tabular-nums}
.rk1,.rk2,.rk3{font-size:19px;font-weight:900}
.rk1{color:var(--gold);text-shadow:0 0 14px rgba(245,196,81,.5)} .rk2{color:var(--silver)} .rk3{color:var(--bronze)}
.logo{position:relative;width:32px;height:32px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.35)}
.logo img{width:26px;height:26px;object-fit:contain}
.logo svg{width:20px;height:20px}
.logo.mono span{font:900 13px "Noto Sans JP",Inter;color:#fff;letter-spacing:-.03em;white-space:nowrap}
.nm{position:relative;font-family:"Noto Sans JP";font-weight:700;white-space:nowrap;overflow:hidden;letter-spacing:-.01em}
.top .nm{font-weight:900}
.mc{position:relative;text-align:right;line-height:1.05}
.mcv{font:800 19px Inter;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.mcv small,.pe small{font:700 10.5px "Noto Sans JP";color:var(--mut);margin-left:2px}
.usd{font:600 10.5px Inter;color:var(--mut);margin-top:2px;font-variant-numeric:tabular-nums}
.pe{position:relative;text-align:right;font:700 16px Inter;font-variant-numeric:tabular-nums;color:#D5DBE7}
.pe.hot{color:#FFB547} .pe.cool{color:#4FD1B5} .pe.na{color:var(--mut)}
.foot{position:absolute;left:40px;right:40px;bottom:22px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px}
.note{font:500 10.5px/1.6 "Noto Sans JP";color:#6F7890}
.note .lg{display:inline-flex;gap:12px;margin-left:6px}
.note .lg span::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;vertical-align:1px;background:currentColor}
.brand{text-align:right;white-space:nowrap}
.brand .h{font:800 20px Inter;letter-spacing:-.01em}
.brand .c{font:700 11px "Noto Sans JP";color:var(--gold);letter-spacing:.12em;margin-top:2px}
.wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:9}
.wm span{transform:rotate(-24deg);font:900 120px "Noto Sans JP";color:rgba(255,40,40,.16);border:10px solid rgba(255,40,40,.16);padding:10px 40px;border-radius:24px;white-space:nowrap}
</style></head><body>
<div class="glow"></div><div class="grid"></div>
<div class="wrap">
  <div class="kicker"><span>MARKET CAP RANKING — JAPAN vs USA</span><span class="live"><i></i><b>${esc(D.asOfLabel)}</b></span></div>
  <h1><span><span class="jp">日本</span></span><span class="vs">vs</span><span><span class="us">米国</span> 時価総額</span><span class="top">TOP20</span></h1>
  <div class="hero">
    <div class="hl">${
      us1Y > jpSum
        ? `${esc(us1M.name)}<em>1社</em>で<br>日本TOP20の合計を<em>超える</em>`
        : `米国TOP20の合計は<br>日本TOP20の<em>${ratio.toFixed(1)}倍</em>`
    }<span class="sub">米国TOP20の合計は日本TOP20の <b style="color:#fff">${ratio.toFixed(1)}倍</b>（円換算）</span></div>
    <div class="cmp">
      <div class="cr"><span>米国TOP20 合計</span><div class="track"><div class="fill us" style="width:100%">${fmtCho(usSum / 1e12)}<small>兆円</small></div></div></div>
      <div class="cr"><span>${esc(us1M.name)} 1社</span><div class="track"><div class="fill nv" style="width:${((us1Y / usSum) * 100).toFixed(1)}%">${fmtCho(us1Y / 1e12)}<small>兆円</small></div></div></div>
      <div class="cr"><span>日本TOP20 合計</span><div class="track"><div class="fill jp" style="width:${((jpSum / usSum) * 100).toFixed(1)}%">${fmtCho(jpSum / 1e12)}<small>兆円</small></div></div></div>
    </div>
  </div>
  <div class="panels">
    <div class="panel jpP">
      <div class="ph">${flagJP}<h2>日本<small>JAPAN</small></h2><div class="tot">TOP20合計<b>${fmtCho(jpSum / 1e12)}<small>兆円</small></b></div></div>
      <div class="cols"><div>順位</div><div></div><div>企業</div><div>時価総額</div><div>予想PER</div></div>
      ${rows(D.jp, "jp")}
    </div>
    <div class="panel usP">
      <div class="ph">${flagUS}<h2>米国<small>USA</small></h2><div class="tot">TOP20合計<b>${fmtCho(usSum / 1e12)}<small>兆円</small></b></div></div>
      <div class="cols"><div>順位</div><div></div><div>企業</div><div>時価総額</div><div>予想PER</div></div>
      ${rows(D.us, "us")}
    </div>
  </div>
</div>
<div class="foot">
  <div class="note">${esc(D.priceNote || D.asOfLabel + "の株価・時価総額")}　為替 1ドル＝${D.usdjpy.toFixed(2)}円で円換算<br>
    ${esc(D.perNote || "予想PER：日本＝会社予想、米国＝アナリスト予想（Forward P/E）")}。赤字・非開示は「—」
    <span class="lg"><span style="color:#4FD1B5">15倍未満</span><span style="color:#FFB547">50倍以上</span></span><br>
    出所：${esc(D.source || "Yahoo!ファイナンス、companiesmarketcap.com")}　※投資判断はご自身の責任で</div>
  <div class="brand"><div class="h">@kazu22_stock</div><div class="c">銘柄攻略クラブ</div></div>
</div>
${D.preview ? `<div class="wm"><span>仮データ PREVIEW</span></div>` : ""}
</body></html>`;

(async () => {
  const htmlPath = path.join(__dirname, "page.html");
  fs.writeFileSync(htmlPath, html);
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.goto("file://" + htmlPath);
  await page.evaluate(() => document.fonts.ready);
  // 社名がはみ出す場合は縮小
  await page.evaluate(() => {
    document.querySelectorAll(".nm").forEach((el) => {
      let s = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth && s > 10) el.style.fontSize = (s -= 0.5) + "px";
    });
  });
  const overflow = await page.evaluate(() => {
    const p = document.querySelector(".panels").getBoundingClientRect();
    const f = document.querySelector(".foot").getBoundingClientRect();
    return { panelsBottom: p.bottom, footTop: f.top };
  });
  console.log(overflow);
  await page.screenshot({ path: path.resolve(__dirname, outPath) });
  await browser.close();
})();
