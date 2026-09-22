import type { ParsedComment } from "../domain/types";
export const COMMENT_SELECTOR = "ol.comments-list li.comment";
export function ownBody(element: HTMLLIElement): HTMLElement | null {
  return element.querySelector<HTMLElement>(":scope > .comment-body:not(.dnm-filter-placeholder)");
}
export function parseComment(element: HTMLLIElement): ParsedComment | null {
  const meta = ownBody(element)?.querySelector<HTMLElement>(".comment-meta");
  if (!meta || meta.closest("li.comment") !== element) return null;
  // Read only metadata before its date, and before extension controls.
  let text = "";
  for (const node of meta.childNodes) {
    if (node instanceof Element && (node.tagName === "BR" || node.tagName === "SMALL")) break;
    if (node instanceof Element && (node.classList.contains("dnm-filter-block-button") || node.classList.contains("dnm-filter-hide-button"))) continue;
    text += node.textContent ?? "";
  }
  const match = text.trim().match(/^(\d+)：\s*([^()]+)\(([^()]+)\)-([A-Za-z0-9]+)\s*$/);
  if (!match || !match[2].trim() || !match[3].trim()) return null;
  return { element, wordpressCommentId: element.id.replace(/^comment-/, ""),
    commentNumber: match[1], identifier: match[2].trim(), host: match[3].trim(), suffix: match[4] };
}
