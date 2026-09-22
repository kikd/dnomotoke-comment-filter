import { readFileSync } from "node:fs";
export const fixture = readFileSync("tests/fixtures/comments.html", "utf8");
export function resetDOM() {
  document.documentElement.removeAttribute("data-dnm-filter-running");
  document.body.innerHTML = fixture;
}
