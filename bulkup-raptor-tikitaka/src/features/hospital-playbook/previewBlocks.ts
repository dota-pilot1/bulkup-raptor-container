type LexicalNode = {
  type?: string;
  tag?: string;
  text?: string;
  html?: string;
  css?: string;
  componentId?: string;
  props?: Record<string, unknown>;
  title?: string;
  source?: string;
  viewport?: "mobile" | "tablet" | "desktop" | "responsive";
  theme?: "light" | "dark";
  children?: LexicalNode[];
};

/**
 * 본문에서 뽑아낸 미리보기 하나.
 * html은 저장된 마크업 스냅샷, component는 갤러리에 등록된 실제 컴포넌트다.
 */
export type PreviewBlock =
  | { kind: "html"; label: string; html: string; css: string }
  | { kind: "component"; label: string; componentId: string; props: Record<string, unknown> }
  | { kind: "tailwind-tsx"; label: string; title: string; source: string; viewport: "mobile" | "tablet" | "desktop" | "responsive"; theme: "light" | "dark" };

function inlineText(node: LexicalNode): string {
  if (typeof node.text === "string") return node.text;
  return (node.children ?? []).map(inlineText).join("");
}

/**
 * 문서 본문에서 미리보기 노드만 문서 순서대로 뽑아낸다.
 * 바로 앞에 나온 heading을 라벨로 달아 variant를 구분할 수 있게 한다.
 */
export function collectPreviewBlocks(serialized: string): PreviewBlock[] {
  let parsed: (LexicalNode & { root?: LexicalNode }) | null = null;
  try {
    parsed = JSON.parse(serialized) as LexicalNode & { root?: LexicalNode };
  } catch {
    // 이전 버전에서 일반 텍스트로 저장된 문서에는 미리보기 블록이 없다.
    return [];
  }

  const blocks: PreviewBlock[] = [];
  let lastHeading = "";

  const walk = (node: LexicalNode) => {
    if (node.type === "heading") {
      lastHeading = inlineText(node).trim();
      return;
    }
    if (node.type === "html-preview") {
      blocks.push({ kind: "html", label: lastHeading, html: node.html ?? "", css: node.css ?? "" });
      return;
    }
    if (node.type === "component-preview" && node.componentId) {
      blocks.push({
        kind: "component",
        label: lastHeading,
        componentId: node.componentId,
        props: node.props ?? {},
      });
      return;
    }
    if (node.type === "tailwind-tsx-preview" && node.source) {
      blocks.push({
        kind: "tailwind-tsx",
        label: lastHeading,
        title: node.title ?? "Tailwind TSX 컴포넌트",
        source: node.source,
        viewport: node.viewport ?? "desktop",
        theme: node.theme ?? "light",
      });
      return;
    }
    (node.children ?? []).forEach(walk);
  };

  const root = parsed.root ?? parsed;
  (root.children ?? []).forEach(walk);
  return blocks;
}
