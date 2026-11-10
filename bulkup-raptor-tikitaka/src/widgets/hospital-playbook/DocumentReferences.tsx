import { BookOpen, X } from "lucide-react";
import { useMemo, useRef } from "react";

type ContentNode = { type?: string; text?: string; url?: string; children?: ContentNode[] };

function readReferences(content: string) {
  try {
    const { root } = JSON.parse(content) as { root?: ContentNode };
    const blocks = root?.children ?? [];
    const headingIndex = blocks.findIndex((node) =>
      node.type === "heading" && node.children?.map((child) => child.text).join("") === "참고 문서");
    if (headingIndex < 0) return [];

    const references = new Map<string, string>();
    for (const block of blocks.slice(headingIndex + 1)) {
      if (block.type !== "paragraph") break;
      for (const node of block.children ?? []) {
        if (node.type !== "link" || !node.url?.startsWith("/?playbookDocument=")) continue;
        const title = node.children?.map((child) => child.text).join("").trim();
        if (title) references.set(node.url, title);
      }
    }
    return [...references].map(([url, title]) => ({ url, title }));
  } catch {
    return [];
  }
}

export default function DocumentReferences({ content }: { content: string }) {
  const references = useMemo(() => readReferences(content), [content]);
  const dialog = useRef<HTMLDialogElement>(null);
  if (!references.length) return null;

  return (
    <>
      <button type="button" className="ui-icon-button h-8 gap-1 px-2.5 text-[11px] font-black"
        aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <BookOpen className="size-3.5" />
        참고 문서 {references.length}
      </button>
      <dialog ref={dialog} aria-label="참고 문서"
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-surface-border bg-surface-raised text-text-primary shadow-2xl backdrop:bg-black/35"
        onKeyDown={(event) => {
          if (event.key === "Escape") event.stopPropagation();
        }}>
        <header className="flex items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
          <h2 className="text-base font-black">참고 문서</h2>
          <button type="button" className="ui-icon-button size-8" aria-label="참고 문서 닫기"
            onClick={() => dialog.current?.close()}><X className="size-4" /></button>
        </header>
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
          {references.map(({ url, title }) => (
            <li key={url}>
              <a href={url} className="block break-words rounded-lg border border-surface-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
                onClick={() => dialog.current?.close()}>
                {title}
              </a>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
