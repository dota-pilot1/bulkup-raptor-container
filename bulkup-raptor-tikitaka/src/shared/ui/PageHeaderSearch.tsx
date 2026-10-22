/* eslint-disable react-hooks/set-state-in-effect -- controlled search state mirrors the parent value. */
import { Search, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type PageHeaderSearchProps = {
  value?: string;
  placeholder?: string;
  onSearch: (keyword: string) => void;
  onClear?: () => void;
};

export default function PageHeaderSearch({
  value = "",
  placeholder = "문서 제목·본문 검색",
  onSearch,
  onClear,
}: PageHeaderSearchProps) {
  const [input, setInput] = useState(value);

  useEffect(() => {
    setInput(value);
  }, [value]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(input.trim());
  };

  const clear = () => {
    setInput("");
    onClear?.();
  };

  return (
    <form onSubmit={submit} className="flex h-9 w-full items-center gap-2">
      <div className="flex h-9 min-w-0 flex-1 overflow-hidden rounded-md border border-surface-border bg-surface-muted shadow-sm transition-colors focus-within:border-brand-border focus-within:bg-surface-raised">
        <Search className="ml-3 size-3.5 shrink-0 self-center text-text-muted" aria-hidden="true" />
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent px-2 text-xs font-semibold text-text-primary outline-none placeholder:text-text-muted"
        />
        {input && (
          <button type="button" onClick={clear} className="grid size-6 shrink-0 self-center place-items-center text-text-muted hover:text-text-primary" title="검색어 지우기" aria-label="검색어 지우기">
            <X className="size-3.5" />
          </button>
        )}
        <button type="submit" className="h-full shrink-0 border-l border-surface-border bg-brand-primary px-3 text-xs font-black text-white transition-colors hover:bg-brand-primary/90" title="검색" aria-label="검색">
          검색
        </button>
      </div>
    </form>
  );
}
