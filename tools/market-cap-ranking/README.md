# 日本株 時価総額ランキング画像ジェネレーター（X投稿用）

Yahoo!ファイナンスの「時価総額上位」ランキングから TOP30 を取得し、
1200×1500（4:5、@2x で 2400×3000）の画像を生成する。

## 使い方
```bash
npm ci && pip install pillow
node fetch.js 30 data.json     # ランキング・会社予想PER・ロゴを取得
python3 trim_logos.py          # ロゴの余白除去・シンボル切り出し
node render.js data.json ranking.png
```

## 必要な許可ドメイン（Claude Code on the web の「クラウド環境を編集」→ Network access）
- finance.yahoo.co.jp（ランキング・会社予想PER）
- companiesmarketcap.com（ロゴ）

## データ定義
- 時価総額：Yahoo!ファイナンス準拠（株価×発行済株式数、自己株式を含む）。海外サイトは自己株を除くため順位が異なることがある（例：トヨタ）
- 予想PER：会社予想EPSベース。会社予想の掲載がない銘柄は「—」
- meta.js にない銘柄がランク入りすると、Yahoo の社名から「(株)」を除いた名前で出力される（必要なら meta.js に追記）

## 過去の出力
- `ranking_2026-09-30.png` / `data_2026-09-30.json`
