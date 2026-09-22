import { expect,test,vi } from "vitest";
import { readFileSync } from "node:fs";
import { initializeOptions } from "../src/options/controller";
import { applyChange,deserialize } from "../src/domain/block-rules";
import type { RuleChange } from "../src/domain/types";
test("lists independent sets and removes only the chosen value safely",async()=>{
  document.body.innerHTML=readFileSync("src/options/options.html","utf8");
  let rules=deserialize({version:1,identifiers:["<script>bad</script>"],hosts:["IP-1"]});
  const api={load:async()=>rules,mutate:vi.fn(async(c:RuleChange)=>rules=applyChange(rules,c))};
  await initializeOptions(api);
  expect(document.querySelector("#identifiers script")).toBeNull();
  document.querySelector<HTMLButtonElement>("#identifiers button")!.click();
  await vi.waitFor(()=>expect(document.querySelector("#identifiers")!.textContent).toContain("登録はありません"));
  expect([...rules.hosts]).toEqual(["IP-1"]);
});
