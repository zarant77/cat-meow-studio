/// <reference types="vite/client" />

const documents = import.meta.glob("/docs/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const nav = document.querySelector<HTMLElement>("#help-nav");
const content = document.querySelector<HTMLElement>("#help-content");

if (nav === null || content === null) {
  throw new Error("Help page root was not found.");
}

for (const [path, markdown] of Object.entries(documents).sort(([left], [right]) => left.localeCompare(right))) {
  const id = path.split("/").at(-1)?.replace(/\.md$/, "").toLowerCase() ?? "document";
  const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? id;
  const link = document.createElement("a");
  link.href = `#${id}`;
  link.textContent = title;
  nav.append(link);

  const section = document.createElement("section");
  section.id = id;
  section.className = "help-document";
  section.innerHTML = renderMarkdown(markdown);
  content.append(section);
}

function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;
  let codeFence = false;
  let codeLanguage = "";
  let codeLines: string[] = [];

  const closeParagraph = (): void => {
    if (paragraph.length > 0) {
      html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = (): void => {
    if (list !== null) {
      html.push(`</${list}>`);
      list = null;
    }
  };

  for (const line of lines) {
    const fence = /^```(.*)$/.exec(line);

    if (fence !== null) {
      closeParagraph();
      closeList();

      if (codeFence) {
        html.push(`<pre><code${codeLanguage === "" ? "" : ` data-language="${escapeHtml(codeLanguage)}"`}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeFence = false;
        codeLanguage = "";
        codeLines = [];
      } else {
        codeFence = true;
        codeLanguage = fence[1]?.trim() ?? "";
      }
      continue;
    }

    if (codeFence) {
      codeLines.push(line);
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    const unorderedItem = /^\s*[-*]\s+(.+)$/.exec(line);
    const orderedItem = /^\s*\d+\.\s+(.+)$/.exec(line);

    if (heading !== null) {
      closeParagraph();
      closeList();
      const level = heading[1]?.length ?? 1;
      html.push(`<h${level}>${renderInline(heading[2] ?? "")}</h${level}>`);
    } else if (unorderedItem !== null || orderedItem !== null) {
      closeParagraph();
      const nextList = unorderedItem !== null ? "ul" : "ol";

      if (list !== nextList) {
        closeList();
        list = nextList;
        html.push(`<${list}>`);
      }

      html.push(`<li>${renderInline((unorderedItem ?? orderedItem)?.[1] ?? "")}</li>`);
    } else if (/^\s*---+\s*$/.test(line)) {
      closeParagraph();
      closeList();
      html.push("<hr>");
    } else if (line.trim() === "") {
      closeParagraph();
      closeList();
    } else {
      paragraph.push(line.trim());
    }
  }

  closeParagraph();
  closeList();

  if (codeFence) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return html.join("\n");
}

function renderInline(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
