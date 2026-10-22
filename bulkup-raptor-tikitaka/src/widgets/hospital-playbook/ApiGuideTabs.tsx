import { useState } from "react";

export type ApiGuideTab = {
  id: string;
  label: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  summary: string;
  content: string;
};

const methodClass = {
  GET: "bg-emerald-100 text-emerald-700",
  POST: "bg-blue-100 text-blue-700",
  PATCH: "bg-amber-100 text-amber-700",
  DELETE: "bg-rose-100 text-rose-700",
};

export default function ApiGuideTabs({ sections }: { sections: ApiGuideTab[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const active = sections.find((section) => section.id === activeId) ?? sections[0];
  if (!active) return null;

  return (
    <div className="flex min-h-full flex-col bg-surface-raised">
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-surface-border-soft px-4 py-3" role="tablist" aria-label="API 지침 분류">
        {sections.map((section) => (
          <button key={section.id} type="button" role="tab" aria-selected={active.id === section.id} onClick={() => setActiveId(section.id)} className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-black transition ${active.id === section.id ? "bg-brand-primary text-white" : "text-text-muted hover:bg-surface-muted hover:text-text-primary"}`}>
            {section.method && <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${active.id === section.id ? "bg-white/20 text-white" : methodClass[section.method]}`}>{section.method}</span>}
            {section.label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div className="mb-4 rounded-lg border border-brand-primary/20 bg-brand-primary/5 px-4 py-3">
          <h3 className="text-base font-black text-text-primary">{active.label}</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-text-muted">{active.summary}</p>
        </div>
        <pre className="whitespace-pre-wrap rounded-lg border border-surface-border-soft bg-surface-muted px-5 py-4 font-mono text-[11px] leading-5 text-text-primary">{active.content}</pre>
      </div>
    </div>
  );
}
