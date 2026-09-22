import { chromium } from 'playwright';
import { build } from 'esbuild';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = 'store-assets/screenshots';
await mkdir(out, { recursive: true });
const css = await readFile('styles/content.css', 'utf8');
const bundle = async (options = false) => (await build({ stdin: {
  contents: `import { ${options ? 'initializeOptions' : 'initializeComments'} as init } from './src/${options ? 'options' : 'content'}/controller';
  import { deserialize, applyChange } from './src/domain/block-rules';
  let rules = deserialize({version:1,identifiers:['DemoFan02'],hosts:['blocked.example.test']});
  window.ready = init({load:async()=>rules,mutate:async change=>(rules=applyChange(rules,change))});`,
  resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'iife' })).outputFiles[0].text;
const siteCSS = `
body{margin:0;color:#223441;background:#f4f7f9;font:16px/1.6 'Yu Gothic UI',Meiryo,sans-serif}
header{padding:28px 64px;background:#173e57;color:white}header p{margin:0;color:#b9dbea;font-size:15px}header h1{font-size:30px;margin:5px 0 0;font-weight:700}
main{width:920px;margin:22px auto}h2{font-size:21px;margin:0 0 12px}ol,ul{list-style:none;padding:0;margin:0}ul.children{padding-left:44px;border-left:2px solid #d9e3ea;margin-left:18px}
.comment-body{margin:9px 0}.comment-balloon{box-sizing:border-box;width:100%;padding:6px 15px;border:1px solid #b3c1cb;border-radius:9px;background:#fff}
.comment-meta{font-size:13px;color:#486171}.comment-meta small{font-size:12px;color:#657d8b}.comment-balloon p{margin:7px 0;font-size:16px}
.cld-like-dislike-wrap,.cld-common-wrap{display:inline-block}.cld-common-wrap a{font-size:12px;padding:3px 8px;border-radius:3px;color:#fff;text-decoration:none;background:#db6675;margin-right:8px}.cld-dislike-wrap a{background:#6389ca}
div.comment-balloon > div.cld-like-dislike-wrap.cld-custom > div.cld-dislike-wrap.cld-common-wrap > a{display:none}
.comment-reply-link{float:right;color:#42708d;font-size:12px}footer{position:fixed;bottom:15px;left:0;right:0;text-align:center;color:#738590;font-size:12px}
`;
const comment = (num, id, text, child = '') => `<li class="comment" id="comment-${num}"><div class="comment-body"><div class="comment-balloon"><div class="comment-meta"><b>${num}</b>：${id}(reader${num}.example.test)-XX<br><small>2026年9月22日 18:30</small></div><p>${text}</p><div class="cld-like-dislike-wrap cld-custom"><div class="cld-like-wrap cld-common-wrap"><a href="#like">よーやっとる</a></div><div class="cld-dislike-wrap cld-common-wrap"><a href="#dislike">よーやっとらん</a></div></div><a class="comment-reply-link" href="#reply">返信</a></div></div>${child ? `<ul class="children">${child}</ul>` : ''}</li>`;
const html = `<html lang="ja"><meta charset="utf-8"><style>${siteCSS}</style><header><p>dnomotoke Comment Filter</p><h1>気になるコメントを、すっきり折りたたむ。</h1></header><main><h2>コメント</h2><ol class="comments-list">${comment(101,'DemoFan01','今日の試合、最後まで見応えがありました。')}${comment(102,'DemoFan02','このコメントはNG設定による折りたたみの表示例です。',comment(103,'DemoFan03','返信はそのまま読めます。次の試合も楽しみですね。'))}${comment(104,'DemoFan04','若手選手の活躍がうれしい！　これからも応援しています。')}</ol></main><footer>デモデータによる表示例 ・ 実際のコメントや投稿者の情報は使用していません</footer></html>`;
const browser = await chromium.launch({headless:true});
try {
 const page = await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 await page.setContent(html);
 await page.addStyleTag({content:css});
 await page.addScriptTag({content:await bundle()});
 await page.evaluate(()=>window.ready);
 const shot = async name => {await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${out}/${name}.png`,fullPage:false});};
 assert.equal(await page.locator('#comment-102 > .dnm-filter-original-content').isVisible(),false);
 assert.equal(await page.locator('#comment-103 > .comment-body').isVisible(),true);
 await shot('01-comment-filter');
 await page.locator('#comment-102 > .dnm-filter-placeholder button').click();
 await page.locator('header h1').evaluate(el=>el.textContent='読みたいときだけ表示。返信の流れもそのまま。');
 assert.equal(await page.locator('#comment-102 .dnm-filter-hide-button').first().isVisible(),true);
 await shot('02-temporary-display');
 await page.locator('#comment-104 .dnm-filter-block-button').click();
 await page.locator('header h1').evaluate(el=>el.textContent='コメントの「NG」から、かんたん登録。');
 await shot('03-register-rule');
 await page.setContent((await readFile('src/options/options.html','utf8')).replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,''));
 await page.addStyleTag({content:await readFile('styles/options.css','utf8')});
 await page.addScriptTag({content:await bundle(true)});
 await page.evaluate(()=>window.ready);
 await page.evaluate(()=>{const f=document.createElement('footer');f.textContent='デモデータによる表示例';f.style.cssText='position:fixed;bottom:18px;width:100%;text-align:center;color:#738590;font-size:12px';document.body.append(f);});
 assert.equal(await page.locator('#identifiers li').count(),1);
 await shot('04-options');
 console.log('Created 4 PNG screenshots, each 1280 x 800. UI assertions passed.');
} finally {await browser.close();}

