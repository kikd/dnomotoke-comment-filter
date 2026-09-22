import { chromium, firefox } from "playwright";
import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const fixture = await readFile("tests/fixtures/comments.html", "utf8");
const css = await readFile("styles/content.css", "utf8");
const siteCSS = `
body { max-width: 720px; margin: 20px auto; font: 14px/1.5 sans-serif; }
ol.comments-list { list-style: none; padding: 0; }
ul.children { list-style: none; padding-left: 24px; }
.comment-body { margin: 5px 0; }
.comment-balloon { box-sizing: border-box; width: calc(100% - 40px); margin-left: 25px; padding: 6px 8px; border: 2px solid #aaa; border-radius: 10px; }
div.comment-balloon > div.cld-like-dislike-wrap.cld-custom > div.cld-dislike-wrap.cld-common-wrap > a { display:none; }
`;
await mkdir("artifacts", {recursive:true});
const bundle = await build({stdin:{contents:`
import { initializeComments } from "./src/content/controller";
import { deserialize, applyChange, serialize } from "./src/domain/block-rules";
const rules = deserialize({version:1,identifiers:["A","B"],hosts:[]});
window.testRules = rules;
window.testWrites = 0;
window.testReady = initializeComments({
 load: async()=>rules,
 mutate: async(change)=>{ window.testWrites++; const next=applyChange(rules,change); rules.identifiers=next.identifiers;rules.hosts=next.hosts;return rules; }
});
`, resolveDir: process.cwd(), loader:"ts"},bundle:true,write:false,format:"iife",target:"es2022"});
const summary=[];
for (const [name, type, config] of [
 ["chromium",chromium,{}], ["edge",chromium,{channel:"msedge"}], ["firefox",firefox,{}]
]) {
 let browser;
 try {
  browser=await type.launch({headless:true,...config});
  const page=await browser.newPage({viewport:{width:1100,height:850}});
  const errors=[]; page.on("pageerror", e=>errors.push(e.message));
  await page.setContent('<html lang="ja"><head><meta charset="utf-8"><style>'+siteCSS+'</style></head><body>'+fixture+'</body></html>');
  await page.addStyleTag({content:css});
  const baseline = {};
  for (const width of [1100, 360]) {
    await page.setViewportSize({width,height:850});
    baseline[width] = {};
    for (const id of [101,105]) baseline[width][id] = await page.locator('#comment-'+id+' > .comment-body > .comment-balloon').boundingBox();
  }
  await page.setViewportSize({width:1100,height:850});
  await page.evaluate(()=>{window.voteCount=0; document.querySelector('[data-action="dislike"]').addEventListener("click",event=>{event.preventDefault();window.voteCount++;});});
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.evaluate(()=>window.testReady);
  const parent=page.locator("#comment-101"), child=page.locator("#comment-105"), grandchild=page.locator("#comment-108");
  for (const width of [1100, 360]) {
    await page.setViewportSize({width,height:850});
    for (const id of [101,105]) {
      const box = await page.locator('#comment-'+id+' > .dnm-filter-placeholder > .comment-balloon').boundingBox();
      assert.ok(Math.abs(box.x-baseline[width][id].x)<1, 'placeholder left edge matches original');
      assert.ok(Math.abs(box.width-baseline[width][id].width)<1, 'placeholder width matches original');
    }
  }
  await page.setViewportSize({width:1100,height:850});
  assert.equal(await parent.locator(":scope > .dnm-filter-original-content").isVisible(),false);
  assert.equal(await child.locator(":scope > .dnm-filter-original-content").isVisible(),false);
  assert.equal(await grandchild.locator(":scope > .dnm-filter-original-content").isVisible(),true);
  assert.equal(await parent.locator(":scope > ul.children").isVisible(),true);
  assert.equal(await parent.locator(":scope > .dnm-filter-placeholder").innerText(),"101：NGコメントを非表示にしています 表示");
  await parent.locator(":scope > .dnm-filter-placeholder button").click();
  const balloonBox=await parent.locator(':scope > .dnm-filter-original-content > .comment-balloon').boundingBox();
  const hideBox=await parent.locator(':scope > .dnm-filter-original-content .dnm-filter-hide-button').boundingBox();
  assert.ok(hideBox.x>=balloonBox.x && hideBox.x+hideBox.width<=balloonBox.x+balloonBox.width);
  assert.ok(hideBox.y>=balloonBox.y && hideBox.y+hideBox.height<=balloonBox.y+balloonBox.height);
  assert.equal(await parent.locator(":scope > .dnm-filter-original-content").isVisible(),true);
  assert.equal(await child.locator(":scope > .dnm-filter-original-content").isVisible(),false);
  assert.equal(await page.locator('[data-action="dislike"]').evaluate(e=>getComputedStyle(e).display),"inline-block");
  assert.equal(await page.locator('[data-action="like"]').evaluate(e=>getComputedStyle(e).display),"inline");
  await page.locator('[data-action="dislike"]').click();
  assert.equal(await page.evaluate(()=>window.voteCount),1);
  await child.locator(":scope > .dnm-filter-placeholder button").click();
  await parent.locator(":scope > .dnm-filter-original-content .dnm-filter-hide-button").click();
  assert.equal(await child.locator(":scope > .dnm-filter-original-content").isVisible(),true);
  assert.equal(await grandchild.isVisible(),true);
  assert.equal(await page.evaluate(()=>window.testWrites),0);
  // Real native dialog interactions and per-host registration.
  await grandchild.locator(".dnm-filter-block-button").click();
  const checks=page.locator(".dnm-filter-dialog input");
  assert.equal(await checks.nth(0).isChecked(),true);
  assert.equal(await checks.nth(1).isChecked(),true);
  await checks.nth(0).uncheck(); await checks.nth(1).uncheck();
  assert.equal(await page.locator(".dnm-filter-add-button").isDisabled(),true);
  await checks.nth(1).check(); await page.locator(".dnm-filter-add-button").click();
  await page.locator(".dnm-filter-dialog").waitFor({state:"detached"});
  assert.equal(await grandchild.locator(":scope > .dnm-filter-original-content").isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>[...window.testRules.hosts]),["example.ne.jp"]);
  assert.equal(await child.locator(":scope > .dnm-filter-original-content").isVisible(),true);
  await page.screenshot({path:"artifacts/"+name+"-tree.png",fullPage:true});
  assert.deepEqual(errors,[]);
  summary.push({browser:name,version:browser.version(),status:"passed",scope:"Real browser DOM/CSS/dialog + in-memory storage adapter; not installed extension"});
  console.log(name+": DOM/CSS/dialog passed");
 } catch (error) {
  summary.push({browser:name,status:"failed",error:String(error)});
  console.error(name+": "+String(error));process.exitCode=1;
 } finally { await browser?.close(); }
}
await writeFile("artifacts/browser-results.json",JSON.stringify(summary,null,2));

