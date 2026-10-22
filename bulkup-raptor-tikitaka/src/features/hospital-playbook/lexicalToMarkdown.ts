type LexicalNode = {
  type?: string;
  tag?: string;
  text?: string;
  language?: string;
  title?: string;
  source?: string;
  children?: LexicalNode[];
};

function inlineText(node: LexicalNode): string {
  if (typeof node.text === "string") return node.text;
  return (node.children ?? []).map(inlineText).join("");
}

function renderNode(node: LexicalNode): string {
  const children = node.children ?? [];
  const content = children.map(renderNode).join("");

  if (node.type === "code") {
    const code = children.map(inlineText).join("").replace(/\n{3,}/g, "\n\n").trim();
    return `\n\n\`\`\`${node.language ?? ""}\n${code}\n\`\`\`\n\n`;
  }
  if (node.type === "tailwind-tsx-preview") {
    return `\n\n## ${node.title ?? "Tailwind TSX 컴포넌트"}\n\n\`\`\`tsx\n${node.source ?? ""}\n\`\`\`\n\n`;
  }
  if (node.type === "heading") return `\n\n${"#".repeat(Number(node.tag?.replace("h", "")) || 2)} ${content.trim()}\n\n`;
  if (node.type === "quote") return `\n\n${content.trim().split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
  if (node.type === "listitem") return `\n- ${content.trim()}\n`;
  if (node.type === "list") return `\n${content}\n`;
  if (node.type === "linebreak") return "\n";
  if (node.type === "paragraph") return `\n\n${content.trim()}\n\n`;
  return typeof node.text === "string" ? node.text : content;
}

/** Lexical serialized state를 AI가 바로 읽을 수 있는 Markdown으로 바꾼다. */
export function lexicalToMarkdown(serialized: string): string {
  try {
    const parsed = JSON.parse(serialized) as LexicalNode & { root?: LexicalNode };
    // 저장 포맷은 { root: { children: [...] } } 형태다.
    const root = parsed.root ?? parsed;
    return (root.children ?? [])
      .map(renderNode)
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    // 이전 버전에서 일반 텍스트로 저장된 문서도 그대로 복사할 수 있게 한다.
    return serialized.trim();
  }
}
