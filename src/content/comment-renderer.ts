import type { ParsedComment } from "../domain/types";
import { ownBody } from "./comment-parser";
import { button } from "../ui/button";
export interface CommentView { setBlocked(blocked: boolean): void }
export function createCommentView(comment: ParsedComment, onRegister: () => void): CommentView {
  const li = comment.element, body = ownBody(li)!;
  body.classList.add("dnm-filter-original-content");
  const register = button("NG", "dnm-filter-block-button", onRegister);
  register.setAttribute("aria-label", comment.commentNumber + "番のコメントをNG登録");
  body.querySelector(".comment-meta")!.append(register);
  let placeholder: HTMLDivElement | null = null;
  let hide: HTMLButtonElement | null = null;
  const setTemporary = (visible: boolean) => {
    li.classList.toggle("dnm-filter-temporarily-visible", visible);
    if (visible) hide?.focus(); else placeholder?.querySelector("button")?.focus();
  };
  return {
    setBlocked(blocked) {
      li.classList.toggle("dnm-filter-blocked", blocked);
      if (!blocked) {
        li.classList.remove("dnm-filter-temporarily-visible");
        placeholder?.remove();
        hide?.remove();
        placeholder = null;
        hide = null;
        return;
      }
      if (placeholder) return;
      const frame = createPlaceholderFrame(body);
      placeholder = frame.placeholder;
      const messageContainer = frame.messageContainer;
      const message = document.createElement("div");
      message.className = "dnm-filter-placeholder-message";
      const label = document.createElement("span");
      label.textContent = comment.commentNumber + "：NGコメントを非表示にしています  ";
      const controls = createVisibilityControls(comment.commentNumber, setTemporary);
      message.append(label, controls.show);
      messageContainer.append(message);
      hide = controls.hide;
      body.querySelector(".comment-meta")!.append(hide);
      li.insertBefore(placeholder, body);
    },
  };
}

function createPlaceholderFrame(body: HTMLElement) {
  const placeholder = document.createElement("div");
  // Reuse the site's body/balloon layout so margins and responsive widths match.
  placeholder.className = "comment-body dnm-filter-placeholder";
  const originalBalloon = body.querySelector<HTMLElement>(":scope > .comment-balloon");
  let messageContainer: HTMLElement = placeholder;
  if (originalBalloon) {
    for (const sibling of body.children) {
      if (sibling === originalBalloon) break;
      const spacer = document.createElement("div");
      spacer.className = sibling.className;
      spacer.setAttribute("aria-hidden", "true");
      placeholder.append(spacer);
    }
    const balloon = document.createElement("div");
    balloon.className = originalBalloon.className;
    placeholder.append(balloon);
    messageContainer = balloon;
  }
  return { placeholder, messageContainer };
}

function createVisibilityControls(commentNumber: string, setTemporary: (visible: boolean) => void) {
  const show = button("表示", "dnm-filter-show-button", () => setTemporary(true));
  show.setAttribute("aria-label", commentNumber + "番のNGコメントを一時表示");
  const hide = button("再び隠す", "dnm-filter-hide-button", () => setTemporary(false));
  hide.setAttribute("aria-label", commentNumber + "番のコメントを再び隠す");
  return { show, hide };
}

