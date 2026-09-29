#!/usr/bin/env bash
# Google Fonts から Noto Serif JP / Noto Sans JP を fonts/ に取得し、ローカル参照用CSSを作る
set -euo pipefail
cd "$(dirname "$0")" && mkdir -p fonts && cd fonts
curl -sS "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@700;900&family=Noto+Sans+JP:wght@500;700;900&display=swap" > fonts.css
python3 - <<'PY'
import re, subprocess
css = open('fonts.css').read()
for fam, w, url in re.findall(r"font-family: '([^']+)';.*?font-weight: (\d+);.*?src: url\(([^)]+)\)", css, re.S):
    fn = fam.replace(' ', '') + f'-{w}.ttf'
    subprocess.run(['curl', '-sS', '-o', fn, url], check=True)
    css = css.replace(url, fn)
open('fonts.local.css', 'w').write(css)
PY
rm -f fonts.css
