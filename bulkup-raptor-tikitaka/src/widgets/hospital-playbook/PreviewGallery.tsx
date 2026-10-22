import type { PreviewBlock } from "../../features/hospital-playbook/previewBlocks";
import { HtmlPreview } from "../../shared/ui/lexical/html-preview";
import { ComponentPreview } from "../../shared/ui/lexical/component-preview";
import { TailwindTsxPreviewCard } from "../../shared/ui/lexical/tailwind-tsx-preview";

/** 본문에서 뽑아낸 미리보기들을 문서 순서대로 늘어놓는다. variant 비교용 화면이다. */
export default function PreviewGallery({ blocks }: { blocks: PreviewBlock[] }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, index) => (
        <div key={index} className="overflow-visible rounded-lg border border-surface-border-soft bg-surface-raised">
          <div className="flex items-center gap-2 border-b border-surface-border-soft px-4 py-2.5">
            <span className="text-[14px] font-black text-text-primary">
              {block.label || `미리보기 ${index + 1}`}
            </span>
            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11.5px] font-black text-text-muted">
              {block.kind === "component" ? "실제 컴포넌트" : block.kind === "tailwind-tsx" ? "문서 TSX 샘플" : "마크업"}
            </span>
          </div>
          {block.kind === "html" ? (
            <HtmlPreview block={block} />
          ) : block.kind === "tailwind-tsx" ? (
            <TailwindTsxPreviewCard block={block} />
          ) : (
            <ComponentPreview block={block} framed={false} />
          )}
        </div>
      ))}
    </div>
  );
}
