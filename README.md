# Breaking Blocks 🎮

スマホを傾けて操作する **PWA(Progressive Web App)** 形式のブロック崩しゲームです。
オフライン動作・ホーム画面追加対応。GitHub Pagesで公開できます。

## ✨ 特徴

- **傾きセンサー操作** … スマホを左右に傾けてバーを動かす（タッチ操作にもフォールバック）
- **ランダム生成ステージ** … 7種のレイアウトパターン × ランダム配置で毎回違う盤面
- **5種のブロック** … 通常 / タフ（複数ヒット） / 鋼鉄（破壊不可） / 爆発 / アイテム入り
- **7種のアイテム** … バー延長 / マルチボール / スロー / 貫通 / マグネット / 1UP / スコア倍
- **コンボシステム** … 連続破壊でスコア倍率UP
- **ステージ進行制** … クリアごとに難化
- **オフライン対応** … Service Workerで全資産をキャッシュ
- **効果音内蔵** … Web Audio API生成（音声ファイル不要）
- **ハイスコア保存** … LocalStorage

## 🎯 操作方法

| 操作 | 内容 |
|------|------|
| スマホを傾ける | バーを左右に移動 |
| 画面ドラッグ | バーを左右に移動（センサー無効時のフォールバック） |
| 画面タップ | ボールを発射 / マグネット保持中のボールをリリース |
| 一時停止ボタン | ポーズ |

## 📦 ファイル構成

```
BreakingBlocks/
├── index.html              # 説明画面 + ゲーム画面
├── manifest.webmanifest    # PWAマニフェスト
├── service-worker.js       # オフライン用キャッシュ
├── css/
│   └── style.css
├── js/
│   ├── main.js             # 画面遷移・初期化
│   ├── game.js             # ゲームループ・状態管理
│   ├── entities.js         # Ball / Paddle / Block / Item / Particle
│   ├── stage.js            # ランダムステージ生成
│   ├── input.js            # 傾き＋タッチ入力
│   └── audio.js            # 効果音（Web Audio）
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-180.png
└── README.md
```

## ⚠️ iOS の注意点

- **HTTPS必須**：GitHub Pagesは自動でHTTPSなので問題なし
- **モーションセンサー権限**：iOS 13以降、`DeviceOrientationEvent.requestPermission()`によるユーザー操作起点の許可が必須
- **音声**：初回タップでAudioContextをresume（実装済み）
- ゲーム開始ボタンを押すと許可ダイアログが出ます。「許可しない」を選ぶとタッチ操作で遊べます
- **画面向き固定**：縦向き専用ゲームです。
  - PWAインストール後（ホーム画面起動）：マニフェストの`orientation: portrait`で縦固定
  - Safariで直接プレイ時：iOSはJSで画面回転をロックできないため、横向きにすると「縦向きにしてください」オーバーレイが表示され、ゲームは自動的に一時停止します。縦に戻すと一時停止メニューから再開できます
  - Android Chrome：Screen Orientation APIで縦固定（実装済み）

## 🛠 ローカル動作確認

PWAはhttp(s)で動作する必要があります。シンプルにはPythonの組み込みサーバを利用：

```bash
# プロジェクトディレクトリで実行
python -m http.server 8080
```

ブラウザで `http://localhost:8080/` を開く。
※ Service Worker は `localhost` または HTTPS でのみ動作します。

スマホ実機テストは、PCと同一WiFiでPCのIPにアクセス、または `ngrok http 8080` などでHTTPS化を推奨。

## 🎨 カスタマイズ

- **ステージ生成ロジック**：`js/stage.js` の `PATTERNS` 配列とパラメータ
- **アイテム種別**：`js/entities.js` の `ITEM_DEFS`、効果は `js/game.js` の `applyItem()`
- **配色**：`css/style.css` のCSS変数 / `js/entities.js` の `BLOCK_COLORS`
- **難易度カーブ**：`js/stage.js` の各 `Chance` 値

## 📜 ライセンス

MIT
