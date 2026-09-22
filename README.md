# dnomotoke Comment Filter

dnomotoke.com のコメントを、登録した識別ID **または** IP / ホストに一致した場合に折りたたむ Manifest V3 拡張機能です。Chrome / Edge / Firefox 向けのPhase 1実装です。

## すぐに試す

GitHubのソースにはビルド成果物を含めていません。以下の「開発・ビルド」の手順でビルドすると、`dist/chromium` と `dist/firefox` が生成されます。

### Chrome

1. `chrome://extensions` を開きます。
2. 「デベロッパーモード」をオンにします。
3. 「パッケージ化されていない拡張機能を読み込む」を選びます。
4. このプロジェクトの `dist/chromium` フォルダーを選びます。
5. 開いていた dnomotoke.com の記事を再読み込みします。

### Edge

1. `edge://extensions` を開きます。
2. 「開発者モード」をオンにします。
3. 「展開して読み込み」（表記はバージョンにより異なります）を選びます。
4. `dist/chromium` フォルダーを選びます。
5. 記事ページを再読み込みします。

### Firefox

1. Firefox 140以降で `about:debugging#/runtime/this-firefox` を開きます。
2. 「一時的なアドオンを読み込む」を選びます。
3. `dist/firefox/manifest.json` を選びます。
4. 記事ページを再読み込みします。

Firefoxの一時アドオンは開発用です。ブラウザ再起動後も使う通常配布には署名が必要です。本成果物は署名・ストア公開をしていません。更新時は拡張管理画面で再読み込みし、記事ページも再読み込みしてください。

## 使い方

### NG設定を開く

ブラウザの拡張機能メニューで「dnomotoke Comment Filter」を選ぶか、ツールバーに固定した青い吹き出しアイコンをクリックすると、NG設定（オプションページ）が開きます。

拡張管理画面の「拡張機能のオプション」からも同じ画面を開けます。Firefoxではアドオン管理画面の設定項目からアクセスできます。

- 各コメントの「NG」から識別IDとIP / ホストを選択して登録します。初期状態は両方選択、片方のみの登録もできます。
- 一致したコメントは `101：NGコメントを非表示にしています [表示]` に変わります。
- 「表示」はそのコメントだけを一時表示します。「再び隠す」で戻ります。NGルールは変わりません。
- 親コメントを隠しても子・孫の返信は残ります。それぞれ独立して判定します。
- ページ再読み込みで一時表示はリセットされます。
- 拡張管理画面の「拡張機能のオプション」／Firefoxのアドオン設定からNG設定画面を開き、識別ID・ホストを個別に解除できます。解除後は記事ページを再読み込みしてください。
- dislikeリンクはCSSで再表示します。元のクリック処理・属性・評価処理は変更しません。

NGルールは各ブラウザの `browser.storage.local` に保存されます。他のコメントとの関連を推測してNGルールを自動追加することはありません。ブラウザ間同期、広告削除、独自の外部送信は実装していません。サイト本来の通信はそのままです。

## 開発・ビルド

### アイコン付き公開用パッケージ

修正版 `assets/comment-filter-icon-v2.png` から、16・32・48・64・96・128pxのPNGを生成してmanifestに組み込んでいます。吹き出しと白いフィルターの内部は不透明、外側は透過です。

- `release/dnomotoke-comment-filter-0.1.4-chromium.zip`：Chrome / Edgeへのアップロード用。
- `release/dnomotoke-comment-filter-0.1.4-firefox.zip`：Firefoxへのアップロード用（未署名）。
- `release/dnomotoke-comment-filter-0.1.4-source.zip`：審査・再ビルド用のソース。
- `store-assets/icon-128.png`：ストア掲載用アイコン。
- `store-assets/icon-300.png`：Edgeストア掲載用ロゴ。

通常のビルドでは生成済みPNGをコピーするため、画像処理ライブラリは不要です。ZIPを再生成するには、ビルド後に `python scripts/package-release.py` を実行してください。アーカイブ内のmanifest、参照ファイル、PNG寸法、ZIP整合性を検証し、SHA-256も出力します。

バージョン0.1.1では、非表示案内の枠幅と位置を元コメントに揃え、再び隠すボタンを枠内のNGボタンの隣に移しています。ストアへの送信・公開・Firefox署名は行っていません。既存の未検証項目は下記の検証結果を参照してください。

Node.js 18.15以降（新しく用意する場合はサポート中のLTSを使用）とnpmが必要です。

```sh
npm ci
npm run typecheck
npm test
npm run build
```

ブラウザ別に生成する場合：

```sh
npm run build:chrome
npm run build:firefox
```

ChromeとEdgeは同じ `dist/chromium`、Firefoxは `dist/firefox` を使います。依存関係はロックファイルで固定しています。

画面検証用ブラウザを導入して実行する場合：

```sh
npx playwright install chromium firefox
npm run test:browser
node scripts/extension-test.mjs
```

`test:browser` はChromium、インストール済みEdge、Playwright FirefoxでDOM/CSS/ダイアログを検証します。Storage部分はメモリ上のテスト用実装です。`extension-test.mjs` は別の一時プロファイルにビルド済みMV3拡張を読み込む統合テストです。いずれも合成HTMLを使い、実サイトへの投票・投稿はしません。結果は `artifacts/` に保存されます。

## 構成

- `src/domain/`：OR判定、明示的な追加・解除、保存形式の変換。DOMや拡張APIに依存しません。
- `src/content/`：コメント解析、ノード単位の表示、登録ダイアログ。
- `src/storage/`：保存と復元、APIへの接続。
- `src/background.ts`：複数タブと設定画面からの更新を順番に処理します。保存前に最新ルールを読み込みます。
- `src/options/`：NG一覧と解除画面。
- `manifests/`：共通設定とChrome/Edge・Firefoxの差分。
- `styles/content.css`：直下本文だけの非表示、dislikeリンク表示。
- `tests/fixtures/`：すべて独自作成の合成HTML。元サイトから抽出したHTMLは配布しません。

ブラウザAPIには同梱したMozilla WebExtension polyfillを使用します。Chrome/EdgeはService Worker、Firefoxはbackground scriptsを使い、保存キューの実装を共有しています。API権限は `storage` のみ、content scriptの対象は `https://dnomotoke.com/*` のみです。Firefox側にはデータ収集なしの宣言を含めています。

## 検証結果（2026-09-21）

実施環境と詳細は [検証記録](VERIFICATION.md) を参照してください。

| 項目 | 結果 |
| --- | --- |
| TypeScript型チェック | 通過 |
| 自動テスト | 22件通過 |
| Chrome/Edge用・Firefox用ビルド | 両方生成済み |
| 元会話の保存HTMLの解析 | 728件中728件成功、うち返信128件 |
| Chromium 141.0.7390.37のDOM/CSS/ダイアログ | 通過 |
| Edge 154.0.4258.24のDOM/CSS/ダイアログ | 通過 |
| Firefoxの実行検証 | 起動時の `spawn UNKNOWN` により未完了 |
| 拡張を丸ごと読み込む統合テスト | Chromium本体の起動エラーにより未完了 |
| 正式版Chrome/Edge/Firefoxへの手動導入 | 未検証 |
| 実サイトでの返信・dislike投票・投稿 | 未検証 |

**実装・単体テスト・ビルドは完了していますが、設計書の「3ブラウザすべてで拡張として動く」という最終受け入れは未完了です。**

## 既知の範囲・制限

- 初期表示時に存在するコメントを処理します。設計書で任意とされたMutationObserverは今回導入していません。後から追加されたコメントはページ再読み込みで反映します。
- 他タブからのNG追加、設定画面での解除は、開いている記事を再読み込みすると反映します。同じ記事内でのNG追加は即時反映します。
- サイト自身が `li.comment` を隠している場合、その既存の非表示を解除する機能はありません。添付HTMLにもサイト側の非表示指定がありました。拡張自身のNG処理は `li` や `ul.children` を隠しません。
- dislikeのアンカー自体を表示する機能です。非表示の祖先要素や、サイト側の投票制限・サーバーエラーを解除するものではありません。
- 解析不能なコメントはスキップします。保存形式の一部に不正な配列・値がある場合は除外します。未知のschema versionは上書きせずエラーにします。
- 本機能のidentifier / hostはページに表示される文字列です。人物の同一性を判定しません。

## 参照

- [設計書](dnomotoke-comment-filter-design.md)
- [Chrome: extension service workers](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)
- [Mozilla: browser_specific_settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)
- [Mozilla WebExtension polyfill](https://github.com/mozilla/webextension-polyfill)

同梱polyfillのライセンスは、ビルド成果物内の `LICENSE-webextension-polyfill.txt` を参照してください。

## 0.1.3 ライセンス通知の整備

NG設定の「使用ライブラリとライセンス」から、MPL-2.0全文、第三者通知、webextension-polyfill 0.12.0の編集用ソース入手先を確認できます。
公開用ZIPとソースZIPにTHIRD_PARTY_NOTICES.txt・ライセンス全文・未改変のライブラリ配布ファイルを含めています。
元サイト由来のテストHTMLを独自作成の合成データへ置き換え、解析スクリプトからもサイトHTMLをテストファイルへ書き出す処理を除去しました。
公開時は旧0.1.2以前のZIPではなく0.1.3を使用してください。第三者ライセンスの通知は、拡張独自コードに対するOSSライセンスの新規指定ではありません。

## 0.1.4 Firefox Androidの最低バージョン修正

Firefoxデスクトップは140以降、Android版は142以降と明示しました。
`browser_specific_settings.gecko_android.strict_min_version` を142.0に設定し、
Androidでdata_collection_permissionsが導入されたバージョンと整合させています。
データ収集なしの宣言とアドオンIDは変更していません。
Android実機動作・AMOアップロード後の検証結果は未確認です。

## プライバシー

[プライバシーポリシー](PRIVACY.md)を参照してください。NG設定はブラウザ内に保存され、拡張機能から外部へ送信されません。

## ソースコードの公開とライセンス

本リポジトリの独自コードに対するOSSライセンスは現時点では指定していません。第三者ライブラリのライセンスは THIRD_PARTY_NOTICES.txt を参照してください。
