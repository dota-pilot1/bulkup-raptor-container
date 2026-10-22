import { arrayMove } from "@dnd-kit/helpers";
import type { DragEndEvent } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import type { PlaybookDocumentSummary } from "./api";

export function documentSortableGroup(document: Pick<PlaybookDocumentSummary, "topicId" | "parentId">) {
  return `documents-${document.topicId}-${document.parentId ?? "root"}`;
}

export function documentOrderAfterDrop(documents: PlaybookDocumentSummary[], event: DragEndEvent) {
  const { source, target } = event.operation;
  if (event.canceled || !target || !isSortable(source)) return null;

  const document = documents.find((item) => item.id === source.id);
  if (!document) return null;
  const group = documentSortableGroup(document);
  if (source.initialGroup !== group || source.group !== group) return null;

  // OptimisticSortingPlugin moves the DOM and sets target to source itself.
  // Its initial/current sibling indices describe the move even when IDs match.
  const from = source.initialIndex;
  const to = source.index;
  const siblings = documents.filter((item) => item.parentId === document.parentId);
  if (from === to || siblings[from]?.id !== document.id || !Number.isInteger(to) || to < 0 || to >= siblings.length) return null;

  return {
    ids: arrayMove(siblings, from, to).map((item) => item.id),
    parentId: document.parentId,
  };
}
