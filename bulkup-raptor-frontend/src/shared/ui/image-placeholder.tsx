type Props = { compact?: boolean; label?: string; outlined?: boolean };

export function ImagePlaceholder({ compact = false, label = "이미지 준비 중", outlined = false }: Props) {
  return (
    <span role="img" aria-label={label}
      className={`absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 text-zinc-400 ${compact ? "gap-0.5" : "gap-3"} ${outlined ? "rounded-2xl border border-zinc-200" : ""}`}>
      <svg aria-hidden="true" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" className={compact ? "h-6 w-6" : "h-14 w-14"}>
        <rect x="10" y="12" width="44" height="40" rx="7" />
        <circle cx="24" cy="25" r="4" />
        <path d="m12 44 12-11 10 9 8-7 11 10" />
      </svg>
      <span aria-hidden="true" className={compact ? "text-[8px] font-medium leading-none" : "text-xs font-medium tracking-wide"}>
        {compact ? "준비 중" : "이미지 준비 중"}
      </span>
    </span>
  );
}
