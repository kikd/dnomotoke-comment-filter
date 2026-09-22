import type { ParsedComment, RuleChange } from "../domain/types";
import { button } from "../ui/button";
export function openRegisterDialog(comment: ParsedComment, save: (change: RuleChange) => Promise<void>): void {
  if (document.querySelector(".dnm-filter-dialog")) return;
  const previousFocus = document.activeElement as HTMLElement | null;
  const dialog = document.createElement("dialog");
  dialog.className = "dnm-filter-dialog"; dialog.setAttribute("aria-labelledby", "dnm-filter-dialog-title");
  const title = document.createElement("h2");
  title.id = "dnm-filter-dialog-title"; title.textContent = "このコメントをNG登録";
  const choices = (title: string, value: string) => {
    const label = document.createElement("label");
    const input = document.createElement("input"); input.type = "checkbox"; input.checked = true;
    const text = document.createElement("span"); text.textContent = title + "： " + value;
    label.append(input, text); return { label, input };
  };
  const id = choices("識別ID", comment.identifier), host = choices("IP / ホスト", comment.host);
  const status = document.createElement("p"); status.setAttribute("role", "alert");
  let saving = false;
  const close = () => { dialog.close(); };
  const cancel = button("キャンセル", "dnm-filter-cancel-button", close);
  const add = button("NGに追加", "dnm-filter-add-button", () => { void submit(); });
  const refresh = () => { add.disabled = saving || (!id.input.checked && !host.input.checked); };
  const setSaving = (value: boolean) => {
    saving = value;
    cancel.disabled = value;
    id.input.disabled = value;
    host.input.disabled = value;
    refresh();
  };
  id.input.addEventListener("change", refresh); host.input.addEventListener("change", refresh);
  const submit = async () => {
    if (saving || add.disabled) return;
    setSaving(true);
    try {
      await save({ type: "add", identifiers: id.input.checked ? [comment.identifier] : [],
        hosts: host.input.checked ? [comment.host] : [] });
      close();
    } catch {
      status.textContent = "保存できませんでした。設定は変更されていません。再試行してください。";
    } finally {
      setSaving(false);
    }
  };
  dialog.addEventListener("cancel", event => { if (saving) event.preventDefault(); });
  dialog.addEventListener("close", () => { dialog.remove(); previousFocus?.focus(); });
  const actions = document.createElement("div"); actions.className = "dnm-filter-dialog-actions"; actions.append(cancel, add);
  dialog.append(title, id.label, host.label, status, actions); document.body.append(dialog); dialog.showModal();
}

