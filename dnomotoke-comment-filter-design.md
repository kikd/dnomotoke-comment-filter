# dnomotoke.com コメントフィルタ拡張機能 設計書

- 統合日：2026-09-21
- 対象：Phase 1 MVP
- 出典：[専用ブラウザ作成相談](chatgpt-conversation://6ab0bc74-c594-83e8-98e3-e2875eca7d18)
- 元会話の設計書と、その後に確定したdislike・プレースホルダー・ツリー仕様を統合した版。後続の確定仕様を優先する。
- 本書で「NGによる非表示」とは、そのコメント自身の通常表示領域を隠してプレースホルダーへ置き換えることを指す。
- 本書は設計の整理であり、拡張機能の実装や実ブラウザでの動作検証の完了を示すものではない。

# 1. 概要

`dnomotoke.com` を閲覧する際に、利用者が指定したコメントの識別情報を基準として、該当するコメントを自動的に非表示にするブラウザ拡張機能を開発する。

加えて、サイト側CSSによって非表示にされているコメントの dislike 操作リンクを、拡張機能側で再表示する。

**Phase 1から以下のブラウザを正式対応対象とする。**

- Google Chrome
- Microsoft Edge
- Mozilla Firefox

Chromium向けを先に実装して後からFirefoxへ移植するのではなく、最初からWebExtensionsベースのクロスブラウザ拡張として設計する。

将来的には、同じコメント解析・フィルタロジックをFlutter + WebViewによるモバイルアプリへ移植できる構造とする。

---

# 2. 開発目的

主な目的は、`dnomotoke.com` のコメント欄において、利用者が見たくないコメント投稿元を継続的に非表示にできるようにすることである。

また、サイト側で非表示にされている dislike 操作UIを再表示し、ブラウザ上から利用できるようにする。

対象サイトではコメント投稿者について、概ね以下の形式の情報が表示される。

```text
596：DU3NhMjVi-1Nm(211.7.96.176)-OW
```

本設計では便宜上、各要素を以下のように呼ぶ。

```text
596
└─ commentNumber

DU3NhMjVi-1Nm
└─ identifier

211.7.96.176
└─ host

OW
└─ suffix
```

`host` には以下のような値が入る可能性がある。

```text
211.7.96.176

softbank126...

spmode.ne.jp

その他のホスト名
```

`identifier` または `host` を現実世界の特定人物と同一視しない。

本拡張機能ではあくまで、

> Webページ上に表示されている識別文字列に一致したコメントを利用者の端末上でフィルタリングする

という扱いとする。

---

# 3. 基本要件

コメント投稿環境によって、少なくとも以下の2ケースが存在する。

## 3.1 同一identifier・異なるhost

例：

```text
GUyN5OWY4-1OT(126.10.10.1)-XX

GUyN5OWY4-1OT(126.20.20.2)-YY

GUyN5OWY4-1OT(example.ne.jp)-ZZ
```

この場合、一度

```text
GUyN5OWY4-1OT
```

をNG登録したら、hostが変わっても該当コメントを非表示にする。

---

## 3.2 同一host・異なるidentifier

例：

```text
GUyN5OWY4-1OT(126.10.10.1)-XX

ABC123456789(126.10.10.1)-YY
```

この場合、一度

```text
126.10.10.1
```

をNG登録したら、identifierが異なっていても該当コメントを非表示にする。

---

# 4. NG判定仕様

NG判定は **OR条件** とする。

```text
identifier がNGリストに存在する
        OR
host がNGリストに存在する
        ↓
コメントを非表示
```

概念実装：

```ts
function shouldHideComment(
  comment: ParsedComment,
  rules: BlockRules,
): boolean {
  return (
    rules.identifiers.has(comment.identifier) ||
    rules.hosts.has(comment.host)
  );
}
```

---

# 5. 自動学習は禁止する

NGコメントを発見したことを理由に、そのコメントが持つ別のidentifierやhostを自動的にNGリストへ追加してはならない。

例えば、

```text
A(id-A, IP-1)
```

を利用者が手動で登録したとする。

その後、

```text
B(id-B, IP-1)
```

がhost一致によってNG判定されたとしても、

```text
id-B
```

を新たにNG identifierとして登録してはならない。

そのため、

```text
B(id-B, IP-2)
```

は表示される。

---

# 6. NG登録仕様

各コメントに本拡張機能独自のNG操作を追加する。

対象コメントが、

```text
GUyN5OWY4-1OT(126.10.10.1)-AB
```

だった場合、NG操作時に以下の選択肢を表示する。

```text
このコメントをNG登録

☑ 識別ID
  GUyN5OWY4-1OT

☑ IP / ホスト
  126.10.10.1

[キャンセル] [NGに追加]
```

デフォルトでは両方を選択済みとする。片方のみを選択して登録できる。両方OFFの場合は登録ボタンを無効にする。

---

# 7. コメントDOM

基本的なコメント構造は以下を前提とする。

```html
<ol class="comments-list">
  <li
    class="comment even thread-even depth-1"
    id="comment-3366596"
  >
    <div
      id="div-comment-3366596"
      class="comment-body"
    >
      <div class="comment-balloon">

        <div class="comment-meta">
          <b>596</b>：DU3NhMjVi-1Nm(211.7.96.176)-OW
          <br>
          <small>
            2026年9月21日 13:42
          </small>
        </div>

        <p>
          コメント本文
        </p>

        <div class="cld-like-dislike-wrap cld-custom">
          ...
        </div>

      </div>
    </div>
  </li>
</ol>
```

コメント単位は以下で取得する。

```ts
document.querySelectorAll<HTMLLIElement>(
  "ol.comments-list li.comment",
);
```

---

# 8. ParsedComment

```ts
export interface ParsedComment {
  element: HTMLLIElement;
  wordpressCommentId: string;
  commentNumber: string;
  identifier: string;
  host: string;
  suffix: string;
}
```

---

# 9. コメント解析

初期実装では `.comment-meta` の文字列を解析する。

```ts
const COMMENT_META_PATTERN =
  /(\d+)：([^(]+)\(([^)]+)\)-([A-Za-z0-9]+)/;
```

解析処理：

```ts
export function parseComment(
  element: HTMLLIElement,
): ParsedComment | null;
```

解析不能なコメントは例外を投げず `null` を返し、そのコメントをスキップして他のコメントを処理する。identifierとhostの前後の空白は除去する。

ツリー内の各コメントを独立して解析するため、対象li直下の `.comment-body` に属する `.comment-meta` だけを参照する。親の情報が欠けた場合に子コメントのmetadataを代わりに取得してはならない。

---

# 10. WordPress comment ID

```html
<li id="comment-3366596">
```

から、

```text
3366596
```

を取得する。

NG判定には使用しない。

---

# 11. suffix

suffixは解析して保持してもよいが、Phase 1ではNG判定に使用しない。

---

# 12. NGルール

```ts
export interface BlockRules {
  identifiers: Set<string>;
  hosts: Set<string>;
}
```

永続化形式：

```ts
export interface StoredBlockRules {
  version: 1;
  identifiers: string[];
  hosts: string[];
}
```

---

# 13. Storage

WebExtensionsの、

```ts
browser.storage.local
```

を使用する。

`window.localStorage` は使用しない。Phase 1で永続化するのはNGルールだけとする。Setは配列に変換して保存し、復元時にSetへ戻す。同一値は重複保存しない。ブラウザ間の自動同期・NGリスト共有はPhase 1の対象外とする。

Storageのload/saveはPromiseベースのadapterに分離する。schema versionと不正データ時のfallbackを管理する。

---

# 14. クロスブラウザAPI

Phase 1から、

```text
Chrome
Edge
Firefox
```

を対象とする。

アプリケーションコードでは原則として、

```ts
browser.*
```

を使用する。

必要に応じてMozillaのWebExtension polyfillを使用する。

---

# 15. NGコメント表示方式

NG対象コメントはDOMから削除しない。

また、`li.comment` 全体を非表示にしてはならない。

対象コメント自身の表示領域である `.comment-body` のみを非表示にし、代わりにプレースホルダーを表示する。

表示例：

```text
101：NGコメントを非表示にしています  [表示]
```

コメント番号は元コメントの `commentNumber` をそのまま使用する。

---

## 15.1 ツリー構造を維持する

コメント返信は、親コメントの `li.comment` 配下にある `ul.children` 内へネストされる構造を前提とする。

概念例：

```html
<li class="comment depth-1">

  <div class="comment-body">
    親コメント
  </div>

  <ul class="children">

    <li class="comment depth-2">

      <div class="comment-body">
        返信コメント
      </div>

    </li>

  </ul>

</li>
```

NG判定された親コメントについても、`li.comment` 自体は残す。

以下は禁止する。

```css
li.dnm-filter-blocked {
  display: none !important;
}
```

これを行うと、配下の `ul.children` まで非表示になり、返信ツリー全体が失われるためである。

---

## 15.2 非表示対象

NG対象コメントでは、そのコメント自身の `.comment-body` のみを非表示にする。

例：

```html
<li class="comment depth-1 dnm-filter-blocked">

  <div class="dnm-filter-placeholder">
    101：NGコメントを非表示にしています
    <button
      type="button"
      class="dnm-filter-show-button"
    >
      表示
    </button>
  </div>

  <div class="comment-body dnm-filter-original-content">
    元コメント
  </div>

  <ul class="children">

    <li class="comment depth-2">
      <div class="comment-body">
        返信コメント
      </div>
    </li>

  </ul>

</li>
```

CSS例：

```css
li.dnm-filter-blocked
> .dnm-filter-original-content {
  display: none !important;
}
```

`ul.children` には非表示指定を適用してはならない。

---

## 15.3 親コメントのみNGの場合

表示イメージ：

```text
101：NGコメントを非表示にしています  [表示]

    105：通常コメント
    このコメントは返信です

        108：通常コメント
        返信への返信です
```

親コメントがNGでも、子コメント・孫コメントは通常どおり表示する。

---

## 15.4 子コメントのみNGの場合

表示イメージ：

```text
101：通常コメント
親コメント本文

    105：NGコメントを非表示にしています  [表示]

        108：通常コメント
        返信への返信です
```

親コメントの表示状態には影響を与えない。

---

## 15.5 親子ともNGの場合

表示イメージ：

```text
101：NGコメントを非表示にしています  [表示]

    105：NGコメントを非表示にしています  [表示]

        108：通常コメント
        返信への返信です
```

各コメントノードを個別に判定する。

親がNGであることを理由に、子コメントを自動的に非表示にしてはならない。

---

## 15.6 ツリー単位のNGは禁止する

Phase 1では以下の挙動を実装しない。

```text
親コメントがNG
        ↓
配下の返信をすべて非表示
```

NG判定は必ずコメント単位で行う。

つまり、

```text
コメントA → NG判定
コメントB → NG判定
コメントC → NG判定
```

をそれぞれ独立して実施する。

親子関係はNG判定条件へ使用しない。

---

## 15.7 プレースホルダー

NG判定されたコメントには、拡張機能独自のプレースホルダーを表示する。

例：

```html
<div class="dnm-filter-placeholder">
  <span class="dnm-filter-comment-number">
    101：
  </span>

  <span class="dnm-filter-placeholder-message">
    NGコメントを非表示にしています
  </span>

  <button
    type="button"
    class="dnm-filter-show-button"
  >
    表示
  </button>
</div>
```

表示：

```text
101：NGコメントを非表示にしています  [表示]
```

---

## 15.8 「表示」操作

`[表示]` を押した場合、そのコメント自身だけを一時表示する。

例：

```text
101：NGコメントを非表示にしています  [表示]

    105：通常コメント
```

↓

```text
101：元コメント本文  [再び隠す]

    105：通常コメント
```

子コメントの表示状態は変更しない。

つまり、親コメントを一時表示しても、

```text
子コメントのNG判定
孫コメントのNG判定
```

は再評価・変更しない。

---

## 15.9 子コメントの一時表示

子コメントがNGの場合も、その子コメントだけを一時表示する。

例：

```text
101：通常コメント

    105：NGコメントを非表示にしています  [表示]

        108：通常コメント
```

↓

```text
101：通常コメント

    105：元コメント本文  [再び隠す]

        108：通常コメント
```

親・孫コメントには影響を与えない。

---

## 15.10 「再び隠す」操作

一時表示したコメントには、

```text
[再び隠す]
```

操作を提供してよい。

押下すると、そのコメント自身だけをプレースホルダー表示へ戻す。

NGルールは変更しない。

---

## 15.11 一時表示状態

一時表示状態はページ内のUI状態としてのみ保持する。

以下へ保存してはならない。

```text
browser.storage.local
```

ページ再読み込み後は、NGルールに従って再びプレースホルダー表示へ戻す。

---

## 15.12 DOM操作ルール

NG対象コメントについて、以下を厳守する。

### 行ってよい

```text
li.commentへ状態classを追加

直下のcomment-bodyを非表示

プレースホルダーを追加

一時表示状態のclassを追加・削除
```

### 行ってはならない

```text
li.commentをremove()

li.comment全体をdisplay:none

ul.childrenをremove()

ul.childrenをdisplay:none

親コメントがNGという理由で子コメントを非表示

親コメントを一時表示した際に子コメントの表示状態を変更
```

## 15.13 プレースホルダーの内容と一時表示

非表示時には対象コメント自身の本文、投稿者情報、like/dislike等を含む通常表示部分を隠す。非NGコメントにはプレースホルダーを追加しない。元コメント番号を変更・再採番しない。

Phase 1ではNG理由を通常UIへ表示しない。内部で判定理由を保持する設計は任意とする。

本統合版では最新のMVP完成条件に従い、[再び隠す]を提供する。一時表示はNG解除ではなく、NGルールを変更しない。操作ボタンは対象ノードに所属させ、隠れたプレースホルダーの中だけに配置しない。

---

# 16. NG操作UI

各コメントへ、

```text
[NG]
```

操作を追加する。

独自classには、

```text
dnm-filter-
```

prefixを使用する。

---

# 17. dislikeリンク再表示

## 17.1 対象

サイト側では以下のCSSによって dislike リンクが非表示にされている。

```css
div.comment-balloon
> div.cld-like-dislike-wrap.cld-custom
> div.cld-dislike-wrap.cld-common-wrap
> a {
  display: none;
}
```

Phase 1では、この `display: none` を拡張機能側で無効化し、対象の `<a>` 要素を表示する。

---

## 17.2 対象セレクタ

対象セレクタは以下とする。

```css
div.comment-balloon
> div.cld-like-dislike-wrap.cld-custom
> div.cld-dislike-wrap.cld-common-wrap
> a
```

---

## 17.3 実装方式

原則として拡張機能のcontent CSSで上書きする。

```css
div.comment-balloon
> div.cld-like-dislike-wrap.cld-custom
> div.cld-dislike-wrap.cld-common-wrap
> a {
  display: inline-block !important;
}
```

実際のサイト本来のレイアウトに合わせて、`inline` の方が適切であれば以下でもよい。

```css
div.comment-balloon
> div.cld-like-dislike-wrap.cld-custom
> div.cld-dislike-wrap.cld-common-wrap
> a {
  display: inline !important;
}
```

どちらを採用するかは、実ページ上で既存likeリンクとの表示差を確認して決定する。

重要なのは、

```text
display: none
```

を無効化することである。

---

## 17.4 JavaScriptによるstyle直接変更は原則使用しない

以下のような処理は第一選択としない。

```ts
element.style.display = "inline";
```

サイト側CSSとの競合管理が難しくなるため、可能な限りcontent stylesheetで解決する。

ただしサイト側がinline style等で強制的に非表示にする場合には、JavaScriptによる補正を検討してよい。

---

## 17.5 既存イベントは変更しない

再表示した `<a>` 要素について、

- href
- data属性
- class
- click handler
- Ajax処理

などを拡張機能側で置換してはならない。

拡張機能が行うのは**表示状態の変更のみ**とする。

サイト既存のdislike処理をそのまま利用する。

---

# 18. 初期化済み管理

content scriptの再実行等によってNGボタン、プレースホルダー、再び隠すボタンが重複しないようにする。初期化済み状態は各li単位で管理する。子孫全体に対するボタン検索で、親を初期化済みと誤判定しない。

---

# 19. コメント処理フロー

```text
ページ表示
    ↓
Content Script起動
    ↓
BlockRules取得
    ↓
comments-list検索
    ↓
li.commentを走査
    ↓
parseComment()
    ↓
NG操作UI追加
    ↓
shouldHideComment()
    ↓
identifier一致 OR host一致
    ↓
コメント非表示
```

dislikeリンク再表示はこのコメント解析処理とは独立して、content CSSによって常時適用する。

---

# 20. NG追加フロー

```text
利用者がNGボタン押下
        ↓
ParsedComment取得
        ↓
登録ダイアログ表示
        ↓
identifier / hostを選択
        ↓
BlockRules更新
        ↓
browser.storage.localへ保存
        ↓
対象ページのコメント再評価
```

NG登録後はリロードなしで現在ページへ反映する。

---

# 21. NG解除

Options画面でidentifierとhostを別々に一覧表示し、各値を個別に解除できること。Phase 1では解除後に対象ページを再読み込みして反映されればよい。storage変更イベントによる即時反映は将来候補とする。

---

# 22. コメントページネーション

以下でも同一ルールが適用されること。

```text
/archives/{articleId}/
/archives/{articleId}/comment-page-2/
/archives/{articleId}/comment-page-3/
```

dislikeリンク再表示についても、すべてのコメントページで適用する。

---

# 23. MutationObserver

サイト側で後からコメントDOMが追加される場合にのみ検討する。使用する場合は追加node周辺の解析やdebounceで無制限の全件再走査を避け、拡張自身のDOM変更による反復処理を防ぐ。

dislikeリンク再表示がCSSのみで実現できる場合、追加DOMにも自動的に適用されるため、dislike対応目的でMutationObserverを使用する必要はない。

---

# 24. 推奨プロジェクト構成

```text
dnomotoke-comment-filter/
│
├─ src/
│  ├─ content/
│  │  ├─ index.ts
│  │  ├─ comment-parser.ts
│  │  ├─ comment-renderer.ts
│  │  └─ observer.ts
│  │
│  ├─ domain/
│  │  ├─ block-rules.ts
│  │  └─ types.ts
│  │
│  ├─ storage/
│  │  ├─ block-rules-storage.ts
│  │  └─ webextension-storage.ts
│  │
│  ├─ browser-api/
│  │  └─ index.ts
│  │
│  └─ options/
│     ├─ index.ts
│     └─ options.html
│
├─ styles/
│  ├─ content.css
│  └─ options.css
│
├─ manifests/
│  ├─ base.json
│  ├─ chromium.json
│  └─ firefox.json
│
├─ tests/
│  ├─ fixtures/
│  │  └─ comments.html
│  ├─ comment-parser.test.ts
│  ├─ block-rules.test.ts
│  └─ storage.test.ts
│
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

# 25. content.css

NGコメントについて、`li.comment` 全体を非表示にしてはならない。

そのコメント自身の本文だけを非表示にする。

```css
li.dnm-filter-blocked
> .dnm-filter-original-content {
  display: none !important;
}

li.dnm-filter-blocked
> .dnm-filter-placeholder {
  display: block;
}
```

一時表示時：

```css
li.dnm-filter-blocked.dnm-filter-temporarily-visible
> .dnm-filter-original-content {
  display: block !important;
}

li.dnm-filter-blocked.dnm-filter-temporarily-visible
> .dnm-filter-placeholder {
  display: none !important;
}
```

重要：

```css
li.dnm-filter-blocked > ul.children
```

には非表示指定を適用しない。

返信ツリーは常に維持する。

dislikeリンク再表示については既存仕様を維持する。

```css
div.comment-balloon
> div.cld-like-dislike-wrap.cld-custom
> div.cld-dislike-wrap.cld-common-wrap
> a {
  display: inline-block !important;
}
```

このCSS例では元の本文領域をblock表示としている。実装時は元のレイアウトを保つこと。dislikeリンクの再表示指定は、NG本文の非表示を解除するものではない。NG中は評価UIも隠れ、一時表示時に対象リンクが見える。

---

# 26. Manifest

Manifest V3を使用する。

```json
{
  "manifest_version": 3,
  "name": "dnomotoke Comment Filter",
  "version": "0.1.0",
  "permissions": [
    "storage"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://dnomotoke.com/*"
      ],
      "js": [
        "content.js"
      ],
      "css": [
        "content.css"
      ],
      "run_at": "document_idle"
    }
  ],
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  }
}
```

---

# 27. 権限方針

Phase 1では原則 `storage` のみ使用する。

以下は要求しない。

```text
tabs
history
cookies
webRequest
downloads
bookmarks
```

---

# 28. Chrome / Edge / Firefoxのビルド

```bash
npm run build:chrome
npm run build:firefox
npm run build
```

ChromeとEdgeは同一Chromium buildを利用してよい。共通ソースを使い、必要なmanifest差分のみブラウザ別に管理する。ビルドツールの選択は実装時に行う。

成果物：

```text
dist/
├─ chromium/
└─ firefox/
```

---

## 28.1 READMEに含める開発用導入手順

- Chrome：chrome://extensions のデベロッパーモードで dist/chromium を読み込む。
- Edge：edge://extensions の開発者モードで dist/chromium を読み込む。
- Firefox：about:debugging の「このFirefox」から一時的なアドオンとして dist/firefox/manifest.json を読み込む。

# 29. モジュール責務

## comment-parser.ts

- DOM解析
- identifier取得
- host取得
- suffix取得
- commentNumber取得

## block-rules.ts

- NG判定
- identifier追加 / 削除
- host追加 / 削除

## webextension-storage.ts

- browser.storage.local

## comment-renderer.ts

- NG操作UI
- コメント非表示 / 再表示

## content.css

- NGコメント非表示
- dislikeリンク再表示

---

DOM解析、NG判定、永続化、UIの責務を分離する。parserはStorageを参照せず、domainはDOM・WebExtensions APIに依存しない。rendererにNGルールを持たせない。ブラウザ差異はadapterへ閉じ込める。

# 30. テストケース

## NG判定

以下をテストする。

```text
同一identifier・異なるhost
同一host・異なるidentifier
両方不一致
identifierのみNG
hostのみNG
自動伝播しない
```

## NGコメントツリー表示の必須テスト


### Case 1：親のみNG

構造：

```text
101 A
 └─ 105 B
     └─ 108 C
```

NG：

```text
Aのみ
```

期待：

```text
101：NGコメントを非表示にしています  [表示]

    105：Bのコメント

        108：Cのコメント
```

---

### Case 2：子のみNG

NG：

```text
Bのみ
```

期待：

```text
101：Aのコメント

    105：NGコメントを非表示にしています  [表示]

        108：Cのコメント
```

---

### Case 3：親子ともNG

NG：

```text
A
B
```

期待：

```text
101：NGコメントを非表示にしています  [表示]

    105：NGコメントを非表示にしています  [表示]

        108：Cのコメント
```

---

### Case 4：親コメントを一時表示

初期：

```text
101：NGコメントを非表示にしています  [表示]

    105：Bのコメント
```

`101` の `[表示]` を押す。

期待：

```text
101：Aのコメント  [再び隠す]

    105：Bのコメント
```

105の状態は変化しない。

---

### Case 5：親と子がともにNGで親だけ一時表示

初期：

```text
101：NGコメントを非表示にしています  [表示]

    105：NGコメントを非表示にしています  [表示]
```

101だけ `[表示]` を押す。

期待：

```text
101：Aのコメント  [再び隠す]

    105：NGコメントを非表示にしています  [表示]
```

子コメントまで表示してはならない。

---

### Case 6：li.comment全体を隠さない

NG対象の `li.comment` に対して、

```text
display:none
```

が適用されていないこと。

配下の `ul.children` が引き続き表示されること。

## プレースホルダーの追加テスト

- コメント番号が元の値と一致する。
- 非表示中は本文・投稿者情報・like/dislikeが表示されない。
- 非NGコメントにはプレースホルダーがない。
- [表示]と[再び隠す]で保存済みNGルールが変わらない。
- 一時表示状態を永続化せず、再読み込み後はプレースホルダーへ戻る。
- 子だけを一時表示しても親・孫の状態が変わらない。
- 初期化の再実行でボタンやプレースホルダーが重複しない。

## 自動伝播禁止

登録済みidentifier=A、host=IP-1の場合、A(IP-1)とB(IP-1)はNG、B(IP-2)は通常表示とする。BやIP-2を自動登録せず、判定の前後でNGルールが変わらないこと。

## Parser・Storage

通常IP、ホスト名、返信コメント、WordPress comment ID、解析不能コメントをfixtureで検証する。1件の失敗で処理を停止しない。Storageは保存・復元・重複排除・不正データ時のfallbackを検証する。

---

# 31. dislikeリンク表示テスト

以下をPhase 1の受け入れテストへ追加する。

## Case 1

対象DOM：

```html
<div class="comment-balloon">
  <div class="cld-like-dislike-wrap cld-custom">
    <div class="cld-dislike-wrap cld-common-wrap">
      <a href="#">
        dislike
      </a>
    </div>
  </div>
</div>
```

サイト側CSS：

```css
div.comment-balloon
> div.cld-like-dislike-wrap.cld-custom
> div.cld-dislike-wrap.cld-common-wrap
> a {
  display: none;
}
```

期待：

```text
対象a要素が画面上に表示される
```

---

## Case 2

期待：

```text
再表示後もa要素本来のclick処理が動作する
```

拡張機能側でclickイベントを差し替えない。

---

## Case 3

期待：

```text
like側のUI表示を変更しない
```

dislikeリンクだけを対象とする。

---

## Case 4

以下すべてで再表示されること。

```text
Chrome
Edge
Firefox
```

---

# 32. クロスブラウザテスト

Phase 1の完成条件として、

```text
Chrome
Edge
Firefox
```

すべてで以下を確認する。

- 拡張を読み込める
- コメント解析できる
- NG登録できる
- NGフィルタが動く
- Options画面が動く
- dislikeリンクが表示される
- dislikeリンク本来の動作を阻害しない

---

# 33. 非機能要件

## パフォーマンス

1000件程度のコメントでも大きな遅延を発生させない。判定にはSet.has()を使用する。

## 非侵襲性

既存の、

```text
返信
コメント評価
リンク
コメント投稿
```

を破壊しない。

dislikeリンクについても、表示状態のみ変更し、内部処理は変更しない。

---

# 34. プライバシー

外部通信を追加しない。

以下を外部へ送信しない。

```text
identifier
IP / host
NGリスト
閲覧記事
コメント本文
```

---

# 35. MVP完成条件

## ブラウザ

- Chrome対応
- Edge対応
- Firefox対応

## コメント解析

- identifier取得
- host取得
- suffix取得
- 解析失敗時も継続

## NG登録

- identifier登録
- host登録
- 両方登録
- 片方だけ登録

## NG判定

- identifier OR host
- 同一ID・異host対応
- 異ID・同一host対応
- 自動伝播しない

## 永続化

- ページリロード後も保持
- 別記事でも適用
- コメントページネーションでも適用

## 管理

- Options画面から解除可能

## dislikeリンク

- 指定セレクタの `display:none` を無効化できる
- dislikeリンクが表示される
- 元のclick処理が維持される
- likeリンク等、他のUIへ影響しない
- Chrome / Edge / Firefoxで同様に動作する

## NGコメントツリー

- NG対象の `li.comment` 自体を削除しない
- NG対象の `li.comment` 全体を `display:none` にしない
- 対象コメント自身の `.comment-body` のみを隠す
- `ul.children` を維持する
- 親がNGでも子コメントを表示する
- 子がNGでも親コメントへ影響しない
- 親子ともNGなら各ノードに個別プレースホルダーを表示する
- `[表示]` は対象コメントだけを一時表示する
- `[再び隠す]` は対象コメントだけを再度隠す
- 親コメントの表示操作で子コメントの状態を変更しない
- コメント番号とツリー階層を維持する

## 一時表示の保存禁止

- 一時表示でNGルールを変更しない。
- ページ再読み込み時は再びプレースホルダーを表示する。
- 非NGコメントにはプレースホルダーを追加しない。

---

# 36. Phase 1 実装順序

## Step 1

Chrome / Edge / Firefoxのビルド基盤作成。

## Step 2

WebExtensions互換層作成。

## Step 3

`content.css` を導入し、まず以下を確認する。

```css
div.comment-balloon
> div.cld-like-dislike-wrap.cld-custom
> div.cld-dislike-wrap.cld-common-wrap
> a {
  display: inline-block !important;
}
```

これによってdislikeリンクがChrome / Firefox双方で表示されることを確認する。

## Step 4

comment parser実装。

## Step 5

BlockRules実装。

## Step 6

単体テスト。

## Step 7

storage実装。

## Step 8

NGコメントのプレースホルダー表示、ツリー維持、[表示] / [再び隠す]。

## Step 9

NG操作UI。

## Step 10

登録ダイアログ。

## Step 11

Options画面。

## Step 12

Chrome / Edge / Firefox横断テスト。

---

# 37. Codexへの実装指示

この設計書を実装仕様の正とする。

以下を厳守すること。

1. TypeScriptで実装する。
2. Manifest V3を使用する。
3. Phase 1からChrome / Edge / Firefoxに対応する。
4. WebExtensionsベースのクロスブラウザ設計とする。
5. NG判定は `identifier OR host` とする。
6. NG判定結果からNGリストを自動拡張しない。
7. NG対象自身の直下 .comment-body のみを隠し、返信ツリーとプレースホルダーを維持する。
8. `browser.storage.local` を使用する。
9. 外部通信を追加しない。
10. 広告削除機能は実装しない。
11. 以下のセレクタに適用されている `display:none` を無効化する。

```css
div.comment-balloon
> div.cld-like-dislike-wrap.cld-custom
> div.cld-dislike-wrap.cld-common-wrap
> a
```

12. 原則としてcontent CSSから以下相当の上書きを行う。

```css
div.comment-balloon
> div.cld-like-dislike-wrap.cld-custom
> div.cld-dislike-wrap.cld-common-wrap
> a {
  display: inline-block !important;
}
```

13. dislikeリンクの既存clickイベントやサイト側処理を差し替えない。
14. dislikeリンク以外のlike/dislike UIを不要に変更しない。
15. Chrome / Edge / Firefoxすべてでdislikeリンク再表示を受け入れテストする。

## ツリー表示についての必須指示

NGコメントの処理では、コメントツリーを絶対に破壊しないこと。

特に以下を厳守する。

1. `li.comment` 全体を `display:none` にしない。
2. `li.comment` をDOMから削除しない。
3. NG対象コメント自身の直下 `.comment-body` のみを非表示対象とする。
4. `ul.children` は必ずDOM・表示とも維持する。
5. 親コメントがNGでも、その子・孫コメントを自動的に非表示にしない。
6. 各 `li.comment` を独立してNG判定する。
7. プレースホルダーは元コメントと同じ `li.comment` 内へ配置する。
8. `[表示]` 操作は対象ノードだけに作用する。
9. `[再び隠す]` 操作も対象ノードだけに作用する。
10. 親コメントの一時表示によって子コメントのNG状態を変更しない。

想定表示：

```text
101：NGコメントを非表示にしています  [表示]

    105：通常コメント

        108：NGコメントを非表示にしています  [表示]
```

このツリー構造が保持されることをPhase 1の必須受け入れ条件とする。

---

# 38. 最終設計方針

本拡張機能は以下の2機能に限定する。

```text
1. コメントフィルタ
2. 非表示になっているdislikeリンクの再表示
```

広告削除・広告通信ブロック等は要件に含めない。

コメントフィルタでは、

```text
identifier一致
       OR
host一致
```

を採用する。

dislikeリンクについては、サイト側の既存機能を改変せず、

```text
display:none
```

のみを拡張機能側から上書きして、利用可能な状態へ戻す。
