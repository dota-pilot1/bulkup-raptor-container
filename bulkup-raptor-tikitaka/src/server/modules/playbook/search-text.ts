import "server-only";

type LexicalNode = { type?: unknown; text?: unknown; children?: unknown };

export function extractSearchText(content: string) {
  try {
    const root = (JSON.parse(content) as { root?: LexicalNode }).root;
    const collect = (node: LexicalNode | undefined): string[] => {
      if (!node || node.type === "code" || node.type === "code-highlight") return [];
      const text = typeof node.text === "string" ? [node.text] : [];
      const children = Array.isArray(node.children)
        ? node.children.flatMap((child) => collect(child as LexicalNode))
        : [];
      return [...text, ...children];
    };
    return collect(root).join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return content.replace(/\s+/g, " ").trim();
  }
}

export function makeSearchExcerpt(text: string, keyword: string, radius = 84) {
  const index = text.toLocaleLowerCase().indexOf(keyword.toLocaleLowerCase());
  if (index < 0) return "";
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + keyword.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
