import type { BlockRules, CommentIdentity, RuleChange, StoredBlockRules } from "./types";
export function emptyRules(): BlockRules { return { identifiers: new Set(), hosts: new Set() }; }
export function shouldHideComment(comment: CommentIdentity, rules: BlockRules): boolean {
  return rules.identifiers.has(comment.identifier) || rules.hosts.has(comment.host);
}
export function deserialize(value: unknown): BlockRules {
  if (!value || typeof value !== "object") return emptyRules();
  const data = value as Partial<StoredBlockRules>;
  if (data.version !== 1) throw new Error("未対応の保存形式です。拡張機能を更新してください。");
  const strings = (values: unknown): Set<string> => new Set(Array.isArray(values)
    ? values.filter((v): v is string => typeof v === "string").map(v => v.trim()).filter(Boolean) : []);
  return { identifiers: strings(data.identifiers), hosts: strings(data.hosts) };
}
export function serialize(rules: BlockRules): StoredBlockRules {
  return { version: 1, identifiers: [...rules.identifiers], hosts: [...rules.hosts] };
}
export function applyChange(rules: BlockRules, change: RuleChange): BlockRules {
  const next = { identifiers: new Set(rules.identifiers), hosts: new Set(rules.hosts) };
  if (change.type === "add") {
    for (const kind of ["identifiers", "hosts"] as const)
      for (const value of change[kind]) { if (value.trim()) next[kind].add(value.trim()); }
  } else next[change.kind].delete(change.value);
  return next;
}
export function isRuleChange(value: unknown): value is RuleChange {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  const list = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === "string" && x.trim().length > 0);
  return c.type === "add" ? list(c.identifiers) && list(c.hosts)
    && ((c.identifiers as string[]).length + (c.hosts as string[]).length > 0)
    : c.type === "remove" && (c.kind === "identifiers" || c.kind === "hosts")
      && typeof c.value === "string" && c.value.length > 0;
}
