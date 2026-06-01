import { createElement as createLucideElement, type IconNode } from "lucide";

export type AppIcon = IconNode;

export function createIcon(icon: AppIcon, className = "lucide-icon"): SVGElement {
  const element = createLucideElement(icon, {
    "aria-hidden": "true",
    class: className,
    focusable: "false",
    height: "18",
    width: "18",
  });

  return element;
}

export function createIconLabel(icon: AppIcon, label: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(createIcon(icon), document.createTextNode(label));

  return fragment;
}
