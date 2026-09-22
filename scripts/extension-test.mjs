import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
await mkdir("artifacts",{recursive:true});
const extension=resolve("dist/chromium");
const context=await chromium.launchPersistentContext("",{
 channel:"chromium",headless:true,
 args:["--disable-extensions-except="+extension,"--load-extension="+extension]
});
try {
 const worker=context.serviceWorkers()[0]??await context.waitForEvent("serviceworker");
 const id=new URL(worker.url()).host;
 const fixture=await readFile("tests/fixtures/comments.html","utf8");
 await context.route("https://dnomotoke.com/**",route=>route.fulfill({contentType:"text/html",body:'<!doctype html><html><head><meta charset="utf-8"><style>div.comment-balloon > div.cld-like-dislike-wrap.cld-custom > div.cld-dislike-wrap.cld-common-wrap > a {display:none}</style></head><body>'+fixture+'</body></html>'}));
 const page=await context.newPage();await page.goto("https://dnomotoke.com/archives/test/");
 await page.locator("#comment-101 .dnm-filter-block-button").first().waitFor();
 await page.locator("#comment-101 .dnm-filter-block-button").first().click();
 await page.locator(".dnm-filter-add-button").click();
 await page.locator("#comment-101 > .dnm-filter-placeholder").waitFor();
 assert.equal(await page.locator("#comment-105 > .dnm-filter-original-content").isVisible(),false);
 assert.equal(await page.locator("#comment-108 > .dnm-filter-original-content").isVisible(),true);
 assert.equal(await page.locator("#comment-110 > .dnm-filter-original-content").isVisible(),true);
 await page.locator("#comment-101 > .dnm-filter-placeholder button").click();
 await page.reload();
 await page.locator("#comment-101 > .dnm-filter-placeholder").waitFor();
 assert.equal(await page.locator("#comment-101 > .dnm-filter-original-content").isVisible(),false);
 const second=await context.newPage();await second.goto("https://dnomotoke.com/archives/other/comment-page-2/");
 await second.locator("#comment-101 > .dnm-filter-placeholder").waitFor();
 const options=await context.newPage();await options.goto("chrome-extension://"+id+"/options.html");
 await options.locator("#identifiers button").waitFor();
 assert.equal(await options.locator("#identifiers").innerText(),"A\n解除");
 await options.locator("#identifiers button").click();
 await options.getByText("解除しました。記事ページを再読み込みすると反映されます。").waitFor();
 await options.locator("#hosts button").click();
 await options.locator("#hosts").getByText("登録はありません").waitFor();
 await page.reload();await page.locator("#comment-101 .dnm-filter-block-button").first().waitFor();
 assert.equal(await page.locator(".dnm-filter-placeholder").count(),0);
 assert.equal(await page.locator('[data-action="dislike"]').isVisible(),true);
 await page.screenshot({path:"artifacts/chromium-extension.png",fullPage:true});
 await writeFile("artifacts/extension-results.json",JSON.stringify({browser:"Playwright Chromium",version:context.browser()?.version(),status:"passed",scope:"Installed MV3 extension, content script, background queue, storage.local, reload, another article/page-2, options removal; fixture responses, no live site voting"},null,2));
 console.log("Installed Chromium extension: persistence, navigation and options passed");
} finally {await context.close();}

