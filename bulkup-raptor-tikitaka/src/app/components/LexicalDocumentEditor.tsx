"use client";

import { LexicalEditor } from "./lexical/lexical-editor";

export function LexicalDocumentEditor({ initialContent, onChange }: { initialContent: string; onChange: (content: string) => void }) {
  return <LexicalEditor initialState={initialContent} onChange={onChange} minHeight="320px" scrollable toolbarVariant="full" />;
}
