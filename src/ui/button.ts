export function button(text: string, className: string, action: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button"; el.className = className; el.textContent = text;
  el.addEventListener("click", action);
  return el;
}

