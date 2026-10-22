"use client";

import { useMemo, useState } from "react";
import { LexicalDocumentEditor } from "./LexicalDocumentEditor";
import { Button, IconButton, Input } from "@/shared/ui/Control";

type DocumentItem = { id: number; title: string; content: string; version: number };
type Topic = { id: number; title: string; documents: DocumentItem[] };
type Category = { id: number; title: string; topics: Topic[] };
type Tree = { name: string; categories: Category[] };
type IconName = "grip" | "file" | "trash" | "plus" | "chevron" | "branch" | "json" | "edit" | "save" | "cancel";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    grip: <><circle cx="8" cy="7" r="1" /><circle cx="8" cy="12" r="1" /><circle cx="8" cy="17" r="1" /><circle cx="16" cy="7" r="1" /><circle cx="16" cy="12" r="1" /><circle cx="16" cy="17" r="1" /></>,
    file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    chevron: <path d="m14 7-5 5 5 5" />,
    branch: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 5h3a4 4 0 0 1 4 4v7M8 5v10a3 3 0 0 0 3 3h5" /></>,
    json: <path d="M9 4H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2M15 4h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2" />,
    edit: <><path d="M13 5H5v14h14v-8" /><path d="m14 4 6 6M12 12l2-7 5 5z" /></>,
    save: <><path d="M5 3h12l2 2v16H5z" /><path d="M8 3v6h8V3M8 21v-8h8v8" /></>,
    cancel: <><path d="M4 4v6h6" /><path d="M5 10a8 8 0 1 1 2 8" /></>,
  };
  return <svg className="pb-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

type ListColumnProps = {
  title: string;
  count: number;
  items: Array<{ id: number; title: string; count: number }>;
  selectedId: number | null;
  file?: boolean;
  onSelect: (id: number) => void;
};

function ListColumn({ title, count, items, selectedId, file, onSelect }: ListColumnProps) {
  return <nav className="pb-column" aria-label={title}>
    <header className="pb-column-header">
      <div><strong>{title}</strong><span className="pb-count">{count}</span></div>
      <div className="pb-column-actions"><IconButton title={`${title} 접기`} aria-label={`${title} 접기`}><Icon name="chevron" /></IconButton><IconButton title={`${title} 추가`} aria-label={`${title} 추가`}><Icon name="plus" /></IconButton></div>
    </header>
    <div className="pb-column-list">
      {items.map((item) => <div className={`pb-menu-row${item.id === selectedId ? " is-selected" : ""}`} key={item.id} onClick={() => onSelect(item.id)}>
        <Icon name="grip" />{file ? <Icon name="file" /> : null}
        <button type="button" className="pb-row-label" onClick={() => onSelect(item.id)}>{item.title}</button>
        <span className="pb-row-count">{item.count}개</span>
        <IconButton title="삭제" aria-label={`${item.title} 삭제`} onClick={(event) => event.stopPropagation()}><Icon name="trash" /></IconButton>
      </div>)}
    </div>
  </nav>;
}

export function PlaybookPanel({ tree }: { tree: Tree | null }) {
  const [localTree, setLocalTree] = useState<Tree | null>(tree);
  const [categoryId, setCategoryId] = useState<number | null>(tree?.categories[0]?.id ?? null);
  const category = localTree?.categories.find((item) => item.id === categoryId) ?? localTree?.categories[0] ?? null;
  const [topicId, setTopicId] = useState<number | null>(category?.topics[0]?.id ?? null);
  const topic = category?.topics.find((item) => item.id === topicId) ?? category?.topics[0] ?? null;
  const documents = useMemo(() => topic?.documents ?? [], [topic]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const selected = documents.find((document) => document.id === editingId) ?? null;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState(false);

  function selectCategory(id: number) {
    const next = localTree?.categories.find((item) => item.id === id);
    setCategoryId(id);
    setTopicId(next?.topics[0]?.id ?? null);
    setEditingId(null);
  }
  function selectTopic(id: number) { setTopicId(id); setEditingId(null); }
  function editDocument(document: DocumentItem) { setEditingId(document.id); setTitle(document.title); setBody(document.content); setSaved(false); }

  async function createDocument() {
    if (!topic) return;
    const response = await fetch(`/api/hospital-playbook/topics/${topic.id}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "새 문서" }) });
    if (!response.ok) return;
    const document = await response.json() as DocumentItem;
    setLocalTree((current) => current ? ({ ...current, categories: current.categories.map((categoryItem) => ({ ...categoryItem, topics: categoryItem.topics.map((topicItem) => topicItem.id === topic.id ? { ...topicItem, documents: [...topicItem.documents, document] } : topicItem) })) }) : current);
    editDocument(document);
  }

  async function save() {
    if (!selected) return;
    const response = await fetch(`/api/hospital-playbook/documents/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content: body }) });
    if (!response.ok) return;
    const updated = await response.json() as DocumentItem;
    setLocalTree((current) => current ? ({ ...current, categories: current.categories.map((categoryItem) => ({ ...categoryItem, topics: categoryItem.topics.map((topicItem) => ({ ...topicItem, documents: topicItem.documents.map((document) => document.id === updated.id ? updated : document) })) })) }) : current);
    setSaved(true);
  }
  function cancel() { if (selected) { setTitle(selected.title); setBody(selected.content); } setSaved(false); }

  return <section className="playbook-workspace">
    <div className="pb-layout">
      <ListColumn title="1차 메뉴" count={localTree?.categories.length ?? 0} items={(localTree?.categories ?? []).map((item) => ({ id: item.id, title: item.title, count: item.topics.length }))} selectedId={category?.id ?? null} onSelect={selectCategory} />
      <ListColumn title="2차 메뉴" count={category?.topics.length ?? 0} items={(category?.topics ?? []).map((item) => ({ id: item.id, title: item.title, count: item.documents.length }))} selectedId={topic?.id ?? null} file onSelect={selectTopic} />
      <section className="pb-document-panel">
        <header className="pb-document-header">
          <div className="pb-document-heading"><p>{category?.title ?? "영역 없음"} &gt; {topic?.title ?? "주제 없음"}</p><h1>{topic?.title ?? "문서"} <span>({documents.length})</span></h1></div>
          <div className="pb-document-actions"><Button><span>2차 주제 관리</span><Icon name="json" /></Button><Button variant="primary" onClick={createDocument} disabled={!topic}><Icon name="plus" />문서 추가</Button></div>
        </header>
        {editingId && selected ? <div className="pb-edit-view">
          <div className="pb-back-row"><Button onClick={() => setEditingId(null)}>목록으로</Button></div>
          <div className="pb-editor-card">
            <Input value={title} onChange={(event) => { setTitle(event.target.value); setSaved(false); }} aria-label="문서 제목" />
            <LexicalDocumentEditor key={selected.id} initialContent={body} onChange={(content) => { setBody(content); setSaved(false); }} />
            <footer className="pb-editor-footer"><span>{saved ? "저장됨" : ""}</span><Button variant="primary" onClick={save}><Icon name="save" />저장</Button><Button onClick={cancel}><Icon name="cancel" />취소</Button></footer>
          </div>
        </div> : <div className="pb-document-list">
          {documents.map((document, index) => <div className="pb-document-row" key={document.id}>
            <Icon name="grip" /><span className="pb-document-index">{index + 1}</span><Icon name="file" /><button type="button" className="pb-row-label" onClick={() => editDocument(document)}>{document.title}</button>
            <div className="pb-row-actions"><IconButton title="문서 관계" aria-label="문서 관계"><Icon name="branch" /></IconButton><IconButton title="JSON 보기" aria-label="JSON 보기"><Icon name="json" /></IconButton><IconButton title="문서 편집" aria-label="문서 편집" onClick={() => editDocument(document)}><Icon name="edit" /></IconButton></div>
          </div>)}
          {!documents.length ? <p className="pb-empty">아직 문서가 없습니다.</p> : null}
        </div>}
      </section>
    </div>
  </section>;
}
