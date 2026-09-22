import type { RulesClient } from "../storage/webextension-storage";
import type { BlockRules } from "../domain/types";
import { button } from "../ui/button";

function createRuleRow(value: string, onRemove: () => void): HTMLLIElement {
  const row = document.createElement("li");
  const label = document.createElement("span");
  label.textContent = value;
  const remove = button("解除", "", onRemove);
  remove.setAttribute("aria-label", value + "を解除");
  row.append(label, remove);
  return row;
}

export async function initializeOptions(client: RulesClient): Promise<void> {
  const status = document.querySelector<HTMLElement>("#status")!;
  const lists = {
    identifiers: document.getElementById("identifiers")!,
    hosts: document.getElementById("hosts")!,
  };
  let busy = false;

  function setBusy(value: boolean) {
    busy = value;
    for (const list of Object.values(lists)) {
      list.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
        button.disabled = value;
      });
    }
  }

  function render(rules: BlockRules) {
    for (const kind of ["identifiers", "hosts"] as const) {
      const list = lists[kind];
      list.replaceChildren();
      if (!rules[kind].size) {
        const row = document.createElement("li");
        row.textContent = "登録はありません";
        list.append(row);
      }
      for (const value of rules[kind]) {
        list.append(createRuleRow(value, () => { void removeRule(kind, value); }));
      }
    }
  }

  async function removeRule(kind: keyof BlockRules, value: string) {
    if (busy) return;
    setBusy(true);
    try {
      render(await client.mutate({ type: "remove", kind, value }));
      status.textContent = "解除しました。記事ページを再読み込みすると反映されます。";
    } catch {
      status.textContent = "解除できませんでした。再試行してください。";
    } finally {
      setBusy(false);
    }
  }

  try {
    render(await client.load());
    status.textContent = "";
  } catch {
    status.textContent = "設定を読み込めませんでした。拡張機能を確認し、この画面を再読み込みしてください。";
  }
}
