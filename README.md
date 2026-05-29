# 電子黒板

iPhone SEなどのスマホブラウザで使う、インストール不要の電子黒板Webアプリです。

## できること

- 黒板情報の入力と端末内保存
- 電子黒板プレビュー
- 写真撮影/選択
- 写真と黒板のCanvas合成
- 合成画像の保存
- 履歴から再利用
- 写真帳連携用のCSV/JSON書き出し

## GitHub Pagesで公開

1. GitHubのリポジトリ画面で `Settings` を開く
2. `Pages` を開く
3. `Build and deployment` の `Source` を `Deploy from a branch` にする
4. `Branch` を `main`、フォルダを `/ (root)` にする
5. 保存後、表示されたURLをiPhoneのSafariで開く
6. Safariの共有メニューから `ホーム画面に追加`

## ローカル確認

```powershell
node dev-server.mjs
```

ブラウザで `http://127.0.0.1:5173/` を開きます。

## 注意

入力した工事件名や履歴は、現在の実装ではブラウザ内に保存されます。GitHubへ写真や入力データは送信しません。
