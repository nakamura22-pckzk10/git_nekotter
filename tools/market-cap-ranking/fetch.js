// ライブデータ取得 → data.json と logos/ を生成する。
// 必要な許可ドメイン: companiesmarketcap.com / fc.yahoo.com / query1.finance.yahoo.com /
//                    query2.finance.yahoo.com / finance.yahoo.co.jp
// usage: node fetch.js [out=data.json]
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const META = require("./meta");

const OUT = path.resolve(__dirname, process.argv[2] || "data.json");
const JAR = path.join(__dirname, ".cookies");
const LOGO_DIR = path.join(__dirname, "logos");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36";
fs.mkdirSync(LOGO_DIR, { recursive: true });

// curl は HTTPS_PROXY と CA バンドルをそのまま使える
function get(url, { binary = false, out } = {}) {
  const args = ["-sSL", "--fail", "-m", "30", "-A", UA, "-c", JAR, "-b", JAR, url];
  if (out) args.push("-o", out);
  return execFileSync("curl", args, { maxBuffer: 64 << 20, encoding: binary || out ? null : "utf8" });
}
const tryGet = (url, o) => { try { return get(url, o); } catch (e) { console.warn(`  ! ${url}: ${String(e.message).split("\n")[0]}`); return null; } };

function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/).map((l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')));
  const head = rows.shift().map((h) => h.trim().toLowerCase());
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// ---- 1. ランキングの母集団 (companiesmarketcap CSV) ----
function cmcList(slug) {
  const csv = tryGet(`https://companiesmarketcap.com/${slug}/?download=csv`);
  if (!csv) return [];
  return parseCSV(csv).map((r) => ({ rank: +r.rank, name: r.name, symbol: r.symbol, mcapUsd: +r.marketcap }));
}
console.log("companiesmarketcap: ranking CSV");
const cmcUS = cmcList("usa/largest-companies-in-the-usa-by-market-cap");
const cmcJP = cmcList("japan/largest-companies-in-japan-by-market-cap");
console.log(`  us=${cmcUS.length} jp=${cmcJP.length}`);

// ---- 2. Yahoo Finance (crumb 認証) ----
console.log("Yahoo Finance: crumb");
tryGet("https://fc.yahoo.com/");
const crumb = String(tryGet("https://query2.finance.yahoo.com/v1/test/getcrumb") || "").trim();
function yQuotes(symbols) {
  const res = {};
  for (let i = 0; i < symbols.length; i += 40) {
    const q = symbols.slice(i, i + 40).map(encodeURIComponent).join(",");
    const j = tryGet(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${q}&crumb=${encodeURIComponent(crumb)}`);
    if (j) for (const r of JSON.parse(j).quoteResponse.result) res[r.symbol] = r;
  }
  return res;
}
const fx = yQuotes(["JPY=X"])["JPY=X"];
if (!fx) throw new Error("USDJPY を取得できません");
const usdjpy = fx.regularMarketPrice;

// ---- 3. 日本: 候補 + CSV上位で母集団 → Yahoo で円建て時価総額 ----
// 正: Yahoo!ファイナンス「時価総額上位」ランキング（時価総額＝株価×発行済株式数（自己株含む））。
// Yahoo Finance(米) の marketCap は自己株を除くため、トヨタ等で数兆円ずれる → フォールバック専用。
function yjRanking() {
  const out = [];
  for (let page = 1; out.length < 20 && page <= 2; page++) {
    const html = tryGet(`https://finance.yahoo.co.jp/stocks/ranking/marketCapitalHigh?market=all&page=${page}`);
    if (!html) break;
    const m = html.match(/__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
    let items = [];
    if (m) {
      // 形が変わっても拾えるよう、コード(4桁英数)と数値を持つオブジェクト配列を探索する
      const walk = (o) => {
        if (Array.isArray(o) && o.length >= 10 && o.every((x) => x && typeof x === "object")) {
          const codeKey = Object.keys(o[0]).find((k) => /code/i.test(k) && /^\w{4}(\.T)?$/.test(String(o[0][k])));
          const capKey = Object.keys(o[0]).find((k) => /marketCap|totalPrice|rankingResult/i.test(k));
          if (codeKey && capKey) { items = o.map((x) => ({ code: String(x[codeKey]).replace(/\.T$/, ""), raw: x[capKey], x })); return; }
        }
        if (o && typeof o === "object") for (const v of Object.values(o)) { if (items.length) return; walk(v); }
      };
      try { walk(JSON.parse(m[1])); } catch (e) { console.warn("  ! PRELOADED_STATE parse失敗"); }
    }
    for (const it of items) {
      const raw = typeof it.raw === "object" ? JSON.stringify(it.raw) : String(it.raw);
      const n = parseFloat((raw.match(/[\d,]+(\.\d+)?/) || ["0"])[0].replace(/,/g, ""));
      out.push({ key: it.code, mcap: n * 1e6 }); // 表示単位は百万円
    }
    if (!items.length) console.warn(`  ! ランキングの構造を解釈できず (page=${page})。キー例: ${m ? m[1].slice(0, 300) : "PRELOADED_STATEなし"}`);
  }
  return out;
}
console.log("Yahoo!ファイナンス: 時価総額上位ランキング");
let jp = yjRanking().slice(0, 20);
let jpSource = "Yahoo!ファイナンス";
const jq = yQuotes([...new Set([...jp.map((r) => r.key), ...Object.keys(META.jp)])].map((c) => `${c}.T`));
if (jp.length < 20) {
  console.warn("  ! Yahoo!ファイナンスのランキング取得失敗 → Yahoo Finance(米) の marketCap で代替（自己株除外ベースになる点に注意）");
  jpSource = "Yahoo Finance（自己株除く）";
  jp = Object.keys(META.jp).map((c) => ({ key: c, mcap: (jq[`${c}.T`] || {}).marketCap })).filter((r) => r.mcap).sort((a, b) => b.mcap - a.mcap).slice(0, 20);
}
jp = jp.map((r) => { const q = jq[`${r.key}.T`] || {}; return { ...r, time: q.regularMarketTime, yForwardPE: q.forwardPE, yName: q.longName }; });
for (const r of cmcJP.slice(0, 25)) {
  const m = r.symbol.match(/^(\w{4})\.T$/);
  const known = m ? META.jp[m[1]] : Object.values(META.jp).some((x) => norm(r.name).includes(norm(x.en)));
  if (!known) console.warn(`  ? 検証: companiesmarketcap上位の未登録銘柄 ${r.name} (${r.symbol})`);
}
jp.forEach((r) => { if (!META.jp[r.key]) console.warn(`  ? meta未登録: ${r.key} ${r.yName} → 表示名を meta.js に追加`); });

// 会社予想PER: Yahoo!ファイナンス(日本) の個別ページ
console.log("Yahoo!ファイナンス: 会社予想PER");
let perSource = "会社予想";
for (const r of jp) {
  const html = tryGet(`https://finance.yahoo.co.jp/quote/${r.key}.T`);
  let per = null;
  if (html) {
    const m = html.match(/PER[^<]{0,12}会社予想[\s\S]{0,600}?>([\d,.]+|---)<\/span>\s*<span[^>]*>倍/) || html.match(/"per"\s*:\s*"?([\d,.]+|---)"?/);
    if (m && m[1] !== "---") per = parseFloat(m[1].replace(/,/g, ""));
  }
  if (per == null) { per = r.yForwardPE ?? null; if (per != null) perSource = "会社予想（一部アナリスト予想）"; }
  r.per = per;
  console.log(`  ${r.key} ${(r.mcap / 1e12).toFixed(2)}兆円 PER=${per}`);
}

// ---- 4. 米国: CSV上位 → Yahoo で予想PER ----
const usBase = (cmcUS.length ? cmcUS : Object.keys(META.us).map((s) => ({ symbol: s }))).slice(0, 30);
const toY = (s) => s.replace(".", "-");
const uq = yQuotes(usBase.map((r) => toY(r.symbol)));
let us = usBase
  .map((r) => {
    const q = uq[toY(r.symbol)] || {};
    return { key: toY(r.symbol), name: r.name, mcap: r.mcapUsd || q.marketCap, per: q.forwardPE ?? null, time: q.regularMarketTime };
  })
  .filter((r) => r.mcap)
  .sort((a, b) => b.mcap - a.mcap)
  .slice(0, 20);
us.forEach((r) => { if (META.us[r.key]) delete r.name; else console.warn(`  ? meta未登録: ${r.key} ${r.name} → 表示名を meta.js に追加`); });

// ---- 5. ロゴ (companiesmarketcap) ----
console.log("logos");
function logo(key, symbol) {
  if (!symbol) return;
  for (const f of fs.readdirSync(LOGO_DIR)) if (f.startsWith(key + ".")) return;
  for (const sz of [256, 128, 64]) {
    const out = path.join(LOGO_DIR, `${key}.webp`);
    if (tryGet(`https://companiesmarketcap.com/img/company-logos/${sz}/${symbol}.webp`, { out }) !== null && fs.statSync(out).size > 200) return;
    fs.rmSync(out, { force: true });
  }
}
for (const r of jp) {
  const m = META.jp[r.key];
  const hit = cmcJP.find((c) => c.symbol === `${r.key}.T`) || (m && cmcJP.find((c) => norm(c.name).includes(norm(m.en))));
  logo(r.key, hit && hit.symbol);
}
for (const r of us) logo(r.key, (usBase.find((b) => toY(b.symbol) === r.key) || {}).symbol);

// ---- 6. 出力 ----
const jst = (t) => new Date(t * 1000).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const today = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" });
const data = {
  asOf: new Date().toISOString(),
  asOfLabel: `${today}時点`,
  usdjpy,
  perNote: `予想PER：日本＝${perSource}、米国＝アナリスト予想（Forward P/E）`,
  priceNote: `株価 日本${jst(Math.max(...jp.map((r) => r.time)))}／米国${jst(Math.max(...us.map((r) => r.time || 0)))}（日本時間）`,
  source: `${jpSource}（日本）、Yahoo Finance・companiesmarketcap.com（米国）`,
  jp: jp.map(({ key, mcap, per }) => ({ key, mcap, per })),
  us: us.map(({ key, name, mcap, per }) => ({ key, ...(name ? { name } : {}), mcap, per })),
};
fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
console.log(`→ ${OUT}  USDJPY=${usdjpy}`);
