import { beforeEach, expect, test } from "vitest";
import { parseComment, COMMENT_SELECTOR } from "../src/content/comment-parser";
import { resetDOM } from "./helpers";
import { readFileSync } from "node:fs";
beforeEach(resetDOM);
test("parses the independently authored nested comment fixture",()=>{
  document.body.innerHTML=readFileSync("tests/fixtures/saved-comment-tree.html","utf8");
  const nodes=[...document.querySelectorAll<HTMLLIElement>(COMMENT_SELECTOR)];
  expect(nodes.length).toBeGreaterThan(1);
  expect(nodes.map(parseComment).every(Boolean)).toBe(true);
  expect(parseComment(nodes[0])).toMatchObject({commentNumber:"600",identifier:"fixture-0",host:"example.test"});
});
test("parses nested nodes independently, trims metadata, keeps number and WordPress id",()=>{
  const results=[...document.querySelectorAll<HTMLLIElement>(COMMENT_SELECTOR)].map(parseComment);
  expect(results.map(x=>x?.identifier??null)).toEqual(["A","B","C","B",null,"D"]);
  expect(results[0]).toMatchObject({commentNumber:"101",wordpressCommentId:"101",host:"IP-1",suffix:"XX"});
  expect(results[2]?.host).toBe("example.ne.jp"); expect(results[5]?.host).toBe("127.0.0.1");
});
test("does not borrow child metadata when parent body is missing",()=>{
  document.querySelector("#comment-111 > .comment-body")!.remove();
  expect(parseComment(document.querySelector("#comment-111")!)).toBeNull();
});
test("does not parse empty identifier or malformed metadata",()=>{
  const meta=document.querySelector(".comment-meta")!;
  for(const text of ["101： (host)-AB","101：A( )-AB","unexpected"]) {
    meta.textContent=text; expect(parseComment(document.querySelector("#comment-101")!)).toBeNull();
  }
});
