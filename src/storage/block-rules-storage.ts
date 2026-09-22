import { applyChange, deserialize, serialize } from "../domain/block-rules";
import type { BlockRules, RuleChange } from "../domain/types";
export const STORAGE_KEY = "dnm-filter-block-rules";
export interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}
export class RulesRepository {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly area: StorageArea) {}
  async load(): Promise<BlockRules> { return deserialize((await this.area.get(STORAGE_KEY))[STORAGE_KEY]); }
  mutate(change: RuleChange): Promise<BlockRules> {
    const task = this.tail.then(async () => {
      const next = applyChange(await this.load(), change);
      await this.area.set({ [STORAGE_KEY]: serialize(next) });
      return next;
    });
    this.tail = task.catch(() => undefined);
    return task;
  }
}
