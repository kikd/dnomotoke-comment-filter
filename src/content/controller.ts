import type { BlockRules, ParsedComment } from "../domain/types";
import type { RulesClient } from "../storage/webextension-storage";
import { shouldHideComment } from "../domain/block-rules";
import { COMMENT_SELECTOR, parseComment } from "./comment-parser";
import { createCommentView, type CommentView } from "./comment-renderer";
import { openRegisterDialog } from "./register-dialog";
export async function initializeComments(client: RulesClient): Promise<void> {
  // DOM marker also protects against reinjection of the bundled content script.
  if (document.documentElement.hasAttribute("data-dnm-filter-running")) return;
  document.documentElement.setAttribute("data-dnm-filter-running", "true");
  try {
    let rules: BlockRules = await client.load();
    const entries: { comment: ParsedComment; view: CommentView }[] = [];
    for (const li of document.querySelectorAll<HTMLLIElement>(COMMENT_SELECTOR)) {
      const comment = parseComment(li);
      if (!comment) continue;
      const view = createCommentView(comment, () => openRegisterDialog(comment, async change => {
        rules = await client.mutate(change);
        for (const entry of entries) entry.view.setBlocked(shouldHideComment(entry.comment, rules));
      }));
      entries.push({ comment, view });
      view.setBlocked(shouldHideComment(comment, rules));
    }
  } catch {
    document.documentElement.removeAttribute("data-dnm-filter-running");
    const warning = document.createElement("p"); warning.className = "dnm-filter-error";
    warning.setAttribute("role", "alert"); warning.textContent = "コメントフィルタの設定を読み込めませんでした。ページを再読み込みしてください。";
    document.querySelector("ol.comments-list")?.before(warning);
  }
}
