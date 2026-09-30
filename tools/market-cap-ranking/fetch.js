// 日本株 時価総額ランキングのライブ取得 → data.json と logos/ を生成する。
// 必要な許可ドメイン: finance.yahoo.co.jp / companiesmarketcap.com
// usage: node fetch.js [topN=30] [out=data.json]
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const META = require("./meta");

const TOP = +(process.argv[2] || 30);
const OUT = path.resolve(__dirname, process.argv[3] || "data.json");
const LOGO_DIR = path.join(__dirname, "logos");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36";
fs.mkdirSync(LOGO_DIR, { recursive: true });

// curl は HTTPS_PROXY と CA バンドルをそのまま使える
function get(url, out) {
  const args = ["-sSL", "--fail", "-m", "30", "-A", UA, url];
  if (out) args.push("-o", out);
  return execFileSync("curl", args, { maxBuffer: 64 << 20, encoding: out ? null : "utf8" });
}
const tryGet = (url, out) => { try { return get(url, out); } catch (e) { console.warn(`  ! ${url}: ${String(e.message).split("\n")[0]}`); return null; } };
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const preloaded = (html) => JSON.parse(html.match(/__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/)[1]);
const plain = (html) => html.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");
const num = (s) => parseFloat(String(s).replace(/,/g, ""));
// 表示名: meta優先、なければ Yahoo の社名から法人格を除いて半角化
const cleanName = (s) => s.normalize("NFKC").replace(/\(株\)|株式会社/g, "").replace(/\s+/g, "").trim();

// ---- 1. ランキング: Yahoo!ファイナンス「時価総額上位」(株価×発行済株式数（自己株含む）) ----
console.log("Yahoo!ファイナンス: 時価総額上位ランキング");
const list = [];
for (let page = 1; list.length < TOP; page++) {
  const html = get(`https://finance.yahoo.co.jp/stocks/ranking/marketCapitalHigh?market=all&page=${page}`);
  const results = preloaded(html).mainRankingList.results;
  if (!results.length) break;
  for (const r of results) {
    const t = r.rankingResult.totalPriceObj;
    list.push({ rank: +r.rank, key: r.stockCode, yName: r.stockName, mcap: num(t.totalPrice) * 1e6, updated: t.updateDateTime, priceTime: r.date });
  }
}
const jp = list.slice(0, TOP);

// ---- 2. 予想PER（会社予想）: 個別銘柄ページ ----
console.log("Yahoo!ファイナンス: PER（会社予想）");
for (const r of jp) {
  const html = tryGet(`https://finance.yahoo.co.jp/quote/${r.key}.T`);
  const m = html && plain(html).match(/PER\|（会社予想）\|用語\|(?:\([^)]*\)\|)?([\d,.]+|---)\|/);
  r.per = m && m[1] !== "---" ? num(m[1]) : null;
  console.log(`  ${String(r.rank).padStart(2)} ${r.key} ${cleanName(r.yName).padEnd(16, "　")} ${(r.mcap / 1e12).toFixed(2)}兆円  PER=${r.per ?? "—"}`);
  sleep(800);
}

// ---- 3. ロゴ: companiesmarketcap（日本株は ADR ティッカーのこともあるので社名でも照合） ----
console.log("logos");
const csv = tryGet("https://companiesmarketcap.com/japan/largest-companies-in-japan-by-market-cap/?download=csv") || "";
const cmc = csv.trim().split(/\r?\n/).slice(1).map((l) => { const c = l.split('","').map((x) => x.replace(/"/g, "")); return { name: c[1], symbol: c[2] }; });
const norm = (s) => s.toLowerCase().replace(/&amp;/g, "&").replace(/[^a-z0-9]/g, "");
for (const r of jp) {
  if (fs.readdirSync(LOGO_DIR).some((f) => f.startsWith(r.key + "."))) continue;
  const en = META.jp[r.key] && META.jp[r.key].en;
  const hit = cmc.find((c) => c.symbol === `${r.key}.T`) || (en && cmc.find((c) => norm(c.name).includes(norm(en))));
  if (!hit) { console.warn(`  ? ロゴ未取得: ${r.key}（meta.js の mono 表示になる）`); continue; }
  const out = path.join(LOGO_DIR, `${r.key}.png`);
  if (tryGet(`https://companiesmarketcap.com/img/company-logos/256/${hit.symbol}.png`, out) === null) fs.rmSync(out, { force: true });
}

// ---- 4. 出力 ----
const missing = jp.filter((r) => !META.jp[r.key]);
missing.forEach((r) => console.warn(`  ? meta未登録: ${r.key} ${r.yName} → 表示名「${cleanName(r.yName)}」で出力（必要なら meta.js に追記）`));
const [d, t] = jp[0].updated.split(" ");
const [y, mo, da] = d.split("/").map(Number);
const data = {
  asOf: jp[0].updated,
  asOfLabel: `${y}年${mo}月${da}日時点`,
  priceNote: `${mo}/${da} 終値ベース（データ更新 ${t}）`,
  perNote: "予想PER＝会社予想EPSベース。「—」はYahoo!ファイナンスに会社予想の掲載なし（予想非開示等）",
  source: "Yahoo!ファイナンス",
  jp: jp.map((r) => ({ key: r.key, ...(META.jp[r.key] ? {} : { name: cleanName(r.yName) }), mcap: r.mcap, per: r.per })),
};
fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
console.log(`→ ${OUT}`);
