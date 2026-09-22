import browser from "./browser-api";
import type { Runtime } from "webextension-polyfill";
import { isRuleChange, serialize } from "./domain/block-rules";
import { RulesRepository } from "./storage/block-rules-storage";
const repository = new RulesRepository(browser.storage.local);
// The toolbar icon is a direct shortcut to the existing NG options page.
browser.action.onClicked.addListener(() => {
  void browser.runtime.openOptionsPage().catch(() => {
    console.error("NG設定を開けませんでした。拡張管理画面のオプションから開いてください。");
  });
});
// All tabs and the options page share one serialized read-modify-write queue.
browser.runtime.onMessage.addListener((message: unknown, sender: Runtime.MessageSender) => {
  if (!message || typeof message !== "object") return undefined;
  const request = message as { type?: unknown; change?: unknown };
  if (sender.id !== browser.runtime.id || request.type !== "dnm-filter-change") return undefined;
  if (!isRuleChange(request.change)) return Promise.resolve({ ok: false, error: "NG設定の形式が不正です。" });
  return repository.mutate(request.change).then(
    rules => ({ ok: true, rules: serialize(rules) }),
    () => ({ ok: false, error: "NG設定を保存できませんでした。拡張機能の状態や空き容量を確認してください。" }),
  );
});
