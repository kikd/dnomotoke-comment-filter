import { describe, expect, test } from "vitest";
import { applyChange, deserialize, emptyRules, serialize, shouldHideComment, isRuleChange } from "../src/domain/block-rules";
describe("independent OR rules", () => {
  test.each([["A","IP-1",true],["A","IP-2",true],["B","IP-1",true],["B","IP-2",false]])("%s %s -> %s", (identifier, host, result) => {
    const rules = { identifiers: new Set(["A"]), hosts: new Set(["IP-1"]) };
    expect(shouldHideComment({ identifier, host }, rules)).toBe(result);
    expect(serialize(rules)).toEqual({version:1, identifiers:["A"], hosts:["IP-1"]});
  });
  test("identifier-only and host-only", () => {
    expect(shouldHideComment({ identifier:"A", host:"IP-2" }, {identifiers:new Set(["A"]),hosts:new Set()})).toBe(true);
    expect(shouldHideComment({ identifier:"B", host:"IP-1" }, {identifiers:new Set(),hosts:new Set(["IP-1"])})).toBe(true);
  });
  test("no propagation through a shared host", () => {
    const rules=deserialize({version:1,identifiers:["A"],hosts:["IP-1"]});
    expect([["A","IP-1"],["B","IP-1"],["B","IP-2"]].map(([identifier,host])=>shouldHideComment({identifier,host},rules))).toEqual([true,true,false]);
    expect([...rules.identifiers]).toEqual(["A"]);
  });
  test("deduplicates, trims, removes only selected kind, does not mutate input", () => {
    const initial=emptyRules();
    const added=applyChange(initial,{type:"add",identifiers:[" A ","A"],hosts:["A"]});
    expect(serialize(initial)).toEqual({version:1,identifiers:[],hosts:[]});
    expect(serialize(applyChange(added,{type:"remove",kind:"identifiers",value:"A"}))).toEqual({version:1,identifiers:[],hosts:["A"]});
  });
  test("invalid arrays fall back safely and unknown versions are not overwritten", () => {
    expect(serialize(deserialize(undefined))).toEqual({version:1,identifiers:[],hosts:[]});
    expect(serialize(deserialize({version:1,identifiers:[null," A ",""],hosts:"bad"}))).toEqual({version:1,identifiers:["A"],hosts:[]});
    expect(()=>deserialize({version:2})).toThrow();
    expect(isRuleChange({type:"add",identifiers:[],hosts:[]})).toBe(false);
    expect(isRuleChange({type:"remove",kind:"other",value:"A"})).toBe(false);
  });
});
