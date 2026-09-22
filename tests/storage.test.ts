import { expect, test } from "vitest";
import { RulesRepository, STORAGE_KEY } from "../src/storage/block-rules-storage";
import { serialize } from "../src/domain/block-rules";
test("serializes concurrent changes and persists arrays, never UI state",async()=>{
  let data: Record<string,unknown>={};
  const repo=new RulesRepository({get:async()=>structuredClone(data),set:async v=>{await new Promise(r=>setTimeout(r,2));data=structuredClone(v);}});
  await Promise.all([repo.mutate({type:"add",identifiers:["A"],hosts:[]}),repo.mutate({type:"add",identifiers:["B"],hosts:["IP-1"]})]);
  expect(data[STORAGE_KEY]).toEqual({version:1,identifiers:["A","B"],hosts:["IP-1"]});
  await repo.mutate({type:"remove",kind:"identifiers",value:"A"});
  expect(serialize(await repo.load())).toEqual({version:1,identifiers:["B"],hosts:["IP-1"]});
});
test("failed saves do not poison later writes",async()=>{
  let failed=true; let data={};
  const repo=new RulesRepository({get:async()=>data,set:async v=>{if(failed){failed=false;throw Error("quota");}data=v;}});
  await expect(repo.mutate({type:"add",identifiers:["A"],hosts:[]})).rejects.toThrow("quota");
  await repo.mutate({type:"add",identifiers:["B"],hosts:[]});
  expect(serialize(await repo.load()).identifiers).toEqual(["B"]);
});
