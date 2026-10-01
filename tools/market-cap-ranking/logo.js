// ロゴタイルのHTML: 実ロゴ画像(logos/<key>.*) > simple-icons > モノグラム
const fs = require("fs");
const path = require("path");
const si = require("simple-icons");
const META = require("./meta");

const LOGO_DIR = path.join(__dirname, "logos");
const siBySlug = Object.fromEntries(Object.values(si).filter((x) => x && x.slug).map((x) => [x.slug, x]));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function logoHTML(key, fallbackName = key) {
  const m = META.jp[key] || { name: fallbackName, color: "#444", mono: fallbackName[0] };
  for (const ext of ["png", "webp", "svg", "jpg"]) {
    const f = path.join(LOGO_DIR, `${key}.${ext}`);
    if (fs.existsSync(f)) {
      const mime = { png: "image/png", webp: "image/webp", svg: "image/svg+xml", jpg: "image/jpeg" }[ext];
      return `<div class="logo"><img src="data:${mime};base64,${fs.readFileSync(f).toString("base64")}"></div>`;
    }
  }
  const icon = m.si && siBySlug[m.si];
  if (icon) return `<div class="logo"><svg viewBox="0 0 24 24"><path fill="${/^f+$/i.test(icon.hex) ? "#000" : m.color}" d="${icon.path}"/></svg></div>`;
  const t = m.mono || fallbackName[0];
  return `<div class="logo mono" style="background:${m.color}"><span style="font-size:${[0, 19, 15, 12, 11, 11, 11][Math.min(t.length, 6)]}px">${esc(t)}</span></div>`;
}

module.exports = { logoHTML, esc, META };
