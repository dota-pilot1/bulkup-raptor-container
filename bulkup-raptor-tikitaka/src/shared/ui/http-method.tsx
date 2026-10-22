import type { CSSProperties, SelectHTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";
import { CompactSelect } from "./compact-select";

export const HTTP_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

const METHOD_CLASS: Record<HttpMethod, string> = {
  GET: "http-method-get",
  POST: "http-method-post",
  PATCH: "http-method-patch",
  PUT: "http-method-put",
  DELETE: "http-method-delete",
};

// Tauri WebView에서도 메서드 의미가 유지되도록 색상은 컴포넌트에서 직접 보장한다.
// 전역 Tailwind/CSS 번들 캐시의 영향을 받지 않으며, 모든 HTTP 메서드 UI가 이 값을 공유한다.
const METHOD_STYLE: Record<HttpMethod, CSSProperties> = {
  GET: { color: "#1d4ed8" },
  POST: { color: "#047857" },
  PATCH: { color: "#b45309" },
  PUT: { color: "#6d28d9" },
  DELETE: { color: "#b91c1c" },
};

type HttpMethodSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "value"> & {
  value: HttpMethod;
  wrapperClassName?: string;
};

export function HttpMethodSelect({ className, wrapperClassName, value, children, style, ...props }: HttpMethodSelectProps) {
  return (
    <CompactSelect
      {...props}
      value={value}
      wrapperClassName={cn("w-20", wrapperClassName)}
      style={{ ...METHOD_STYLE[value], ...style }}
      className={cn("h-8 min-h-8 rounded-md py-0 pl-3 pr-7 text-[11px] font-bold", METHOD_CLASS[value], className)}
    >
      {children ?? HTTP_METHODS.map((method) => <option key={method}>{method}</option>)}
    </CompactSelect>
  );
}

export function HttpMethodBadge({ method, className }: { method: HttpMethod; className?: string }) {
  return (
    <span
      className={cn("inline-flex rounded-md border px-1.5 py-1 text-[10px] font-black", METHOD_CLASS[method], className)}
      style={METHOD_STYLE[method]}
    >
      {method}
    </span>
  );
}
