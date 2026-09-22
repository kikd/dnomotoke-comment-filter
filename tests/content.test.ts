import { beforeEach, expect, test, vi } from "vitest";
import { initializeComments } from "../src/content/controller";
import { deserialize, applyChange, serialize } from "../src/domain/block-rules";
import { resetDOM } from "./helpers";
import type { RuleChange } from "../src/domain/types";
beforeEach(()=>{
  resetDOM();
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");this.dispatchEvent(new Event("close"));};
});
function client(ids:string[]=[],hosts:string[]=[]){
  let rules=deserialize({version:1,identifiers:ids,hosts});
  return {load:vi.fn(async()=>rules),mutate:vi.fn(async(c:RuleChange)=>rules=applyChange(rules,c))};
}
const node=(id:number)=>document.getElementById("comment-"+id)!;
const click=(id:number,cls:string)=>(node(id).querySelector(":scope > .dnm-filter-placeholder "+cls)??node(id).querySelector(":scope > .dnm-filter-original-content "+cls) as HTMLButtonElement).dispatchEvent(new MouseEvent("click",{bubbles:true}));
test.each([["A"],["B"],["A","B"]])("tree remains intact for rules %j",async(...ids)=>{
  await initializeComments(client(ids));
  expect(node(101).classList.contains("dnm-filter-blocked")).toBe(ids.includes("A"));
  expect(node(105).classList.contains("dnm-filter-blocked")).toBe(ids.includes("B"));
  expect(node(108).classList.contains("dnm-filter-blocked")).toBe(false);
  expect(node(101).querySelector(":scope > ul.children")!.contains(node(105))).toBe(true);
  expect(node(108).isConnected).toBe(true);
});
test("parent and child reveal independently; hiding never mutates storage",async()=>{
  const api=client(["A","B"]); await initializeComments(api);
  click(101,".dnm-filter-show-button");
  expect(node(101).classList.contains("dnm-filter-temporarily-visible")).toBe(true);
  expect(node(105).classList.contains("dnm-filter-temporarily-visible")).toBe(false);
  click(105,".dnm-filter-show-button"); click(101,".dnm-filter-hide-button");
  expect(node(101).classList.contains("dnm-filter-temporarily-visible")).toBe(false);
  expect(node(105).classList.contains("dnm-filter-temporarily-visible")).toBe(true);
  expect(api.mutate).not.toHaveBeenCalled();
  resetDOM();await initializeComments(api);
  expect(document.querySelector(".dnm-filter-temporarily-visible")).toBeNull();
});
test("no duplicate controls on reinjection and no placeholder for non-NG",async()=>{
  const api=client(["A"]);await initializeComments(api);await initializeComments(api);
  expect(document.querySelectorAll(".dnm-filter-block-button")).toHaveLength(5);
  expect(document.querySelectorAll(".dnm-filter-placeholder")).toHaveLength(1);
  expect(document.querySelector(".dnm-filter-placeholder")!.textContent).toContain("101：NGコメントを非表示にしています");
});
test("register defaults to both checked, prevents empty, can save just ID and refresh all comments",async()=>{
  const api=client();await initializeComments(api);
  (node(101).querySelector(".dnm-filter-block-button") as HTMLButtonElement).click();
  const inputs=[...document.querySelectorAll<HTMLInputElement>(".dnm-filter-dialog input")];
  expect(inputs.every(x=>x.checked)).toBe(true);
  inputs.forEach(x=>{x.checked=false;x.dispatchEvent(new Event("change"));});
  const add=document.querySelector<HTMLButtonElement>(".dnm-filter-add-button")!;
  expect(add.disabled).toBe(true);
  inputs[0].checked=true;inputs[0].dispatchEvent(new Event("change"));add.click();
  await vi.waitFor(()=>expect(document.querySelector(".dnm-filter-dialog")).toBeNull());
  expect(api.mutate).toHaveBeenCalledWith({type:"add",identifiers:["A"],hosts:[]});
  expect(node(101).classList.contains("dnm-filter-blocked")).toBe(true);
  expect(node(105).classList.contains("dnm-filter-blocked")).toBe(false);
});
test("failed save leaves comments and saved rules unchanged",async()=>{
  const api=client();api.mutate.mockRejectedValueOnce(Error("quota"));await initializeComments(api);
  (node(101).querySelector(".dnm-filter-block-button") as HTMLButtonElement).click();
  document.querySelector<HTMLButtonElement>(".dnm-filter-add-button")!.click();
  await vi.waitFor(()=>expect(document.querySelector('[role="alert"]')!.textContent).toContain("保存できません"));
  expect(document.querySelector(".dnm-filter-blocked")).toBeNull();
  expect(serialize(await api.load()).identifiers).toEqual([]);
});
