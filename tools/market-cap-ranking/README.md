# 日米 時価総額TOP20 画像ジェネレーター（X投稿用）

1200×1500（4:5、@2x で 2400×3000 出力）の比較画像を生成する。

## 使い方
```bash
npm ci
node fetch.js            # ライブデータ → data.json, logos/
node render.js data.json ranking.png
```
デザイン確認だけなら `node render.js data.preview.json preview.png`（「仮データ」透かし入り）。

## 必要な許可ドメイン（Claude Code on the web の Network access）
- companiesmarketcap.com（米国ランキング・ロゴ・日本の検証用）
- fc.yahoo.com / query1.finance.yahoo.com / query2.finance.yahoo.com（米国予想PER・為替）
- finance.yahoo.co.jp（日本の時価総額ランキング・会社予想PER。日本側の正はこのサイト）

## データ定義
- 時価総額：日本は円建て、米国はドル建てを当日レートで兆円換算（ドル併記）
- 予想PER：日本＝会社予想、米国＝アナリスト予想（Forward P/E）
- 米国＝本社所在地が米国の企業（TSMC等のADRは含まない）
- `meta.js` にない銘柄が上位に入ると警告が出るので、表示名を追記する
