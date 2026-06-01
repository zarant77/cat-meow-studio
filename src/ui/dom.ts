export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);

  if (className !== undefined) {
    element.className = className;
  }

  return element;
}

export function createTextElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  textContent: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = createElement(tagName, className);
  element.textContent = textContent;

  return element;
}

export function appendChildren(parent: Element, children: Array<Node | string>): void {
  for (const child of children) {
    parent.append(child);
  }
}

export function createIconButton(label: string, title: string, className = "icon-button"): HTMLButtonElement {
  const button = createTextElement("button", label, className);
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", title);

  return button;
}

export function createField(label: string, control: HTMLElement): HTMLLabelElement {
  const field = createElement("label", "field");
  field.append(createTextElement("span", label), control);

  return field;
}
