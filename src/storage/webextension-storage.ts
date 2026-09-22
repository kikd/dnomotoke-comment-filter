import browser from "../browser-api";
import { deserialize } from "../domain/block-rules";
import type { BlockRules, RuleChange } from "../domain/types";
import { RulesRepository } from "./block-rules-storage";
export interface RulesClient { load(): Promise<BlockRules>; mutate(change: RuleChange): Promise<BlockRules> }
const repository = new RulesRepository(browser.storage.local);
export const rulesClient: RulesClient = {
  load: () => repository.load(),
  async mutate(change) {
    const result = await browser.runtime.sendMessage({ type: "dnm-filter-change", change }) as { ok?: boolean; error?: string; rules?: unknown } | undefined;
    if (!result?.ok) throw new Error(result?.error || "NG設定を保存できませんでした。");
    return deserialize(result.rules);
  },
};
