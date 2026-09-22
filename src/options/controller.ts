import type { RulesClient } from "../storage/webextension-storage";
import type { BlockRules } from "../domain/types";
export async function initializeOptions(client: RulesClient): Promise<void> {
  const status = document.querySelector<HTMLElement>("#status")!;
  let busy = false;
  const render = (rules: BlockRules) => {
    for (const kind of ["identifiers", "hosts"] as const) {
      const list = document.getElementById(kind)!; list.replaceChildren();
      if (!rules[kind].size) { const row = document.createElement("li"); row.textContent = "登録はありません"; list.append(row); }
      for (const value of rules[kind]) {
        const row = document.createElement("li"), label = document.createElement("span"), remove = document.createElement("button");
        label.textContent = value; remove.type = "button"; remove.textContent = "解除";
        remove.setAttribute("aria-label", value + "を解除");
        remove.addEventListener("click", async () => {
          if (busy) return; busy = true;
          document.querySelectorAll<HTMLButtonElement>("button").forEach(b => b.disabled = true);
          try {
            render(await client.mutate({ type: "remove", kind, value }));
            status.textContent = "解除しました。記事ページを再読み込みすると反映されます。";
          } catch { status.textContent = "解除できませんでした。再試行してください。"; }
          finally { busy = false; document.querySelectorAll<HTMLButtonElement>("button").forEach(b => b.disabled = false); }
        });
        row.append(label, remove); list.append(row);
      }
    }
  };
  try { render(await client.load()); status.textContent = ""; }
  catch { status.textContent = "設定を読み込めませんでした。拡張機能を確認し、この画面を再読み込みしてください。"; }
}
