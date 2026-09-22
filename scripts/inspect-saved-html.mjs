import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const path=process.argv[2]; if(!path)throw Error("Provide the saved HTML path");
const html=await readFile(path,"utf8");
// Script execution and external resource fetching are disabled.
const dom=new JSDOM(html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ""),{runScripts:"outside-only"});
const result=await build({entryPoints:["src/content/comment-parser.ts"],bundle:true,format:"iife",globalName:"parser",write:false});
const parser=dom.window.eval(result.outputFiles[0].text + "\nparser;");
const nodes=[...dom.window.document.querySelectorAll("ol.comments-list li.comment")];
const parsed=nodes.map(parser.parseComment);
const summary={comments:nodes.length,parsed:parsed.filter(Boolean).length,replies:nodes.filter(n=>n.closest("ul.children")).length,unparsed:nodes.filter((n,i)=>!parsed[i]).map(n=>n.id)};
await mkdir("artifacts",{recursive:true});
await writeFile("artifacts/saved-html-results.json",JSON.stringify(summary,null,2));
// Inspection reports remain local; never generate distributable fixtures from a saved page.
console.log(JSON.stringify(summary));dom.window.close();
