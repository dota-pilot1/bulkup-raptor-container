import type { OrderFilter } from "../model/order-types";

const tabs: { status: OrderFilter; label: string }[] = [
  { status: "ALL", label: "전체" }, { status: "CREATED", label: "결제 대기" },
  { status: "PAID", label: "결제 완료" }, { status: "CANCELLABLE", label: "취소 가능" },
  { status: "CANCELLED", label: "주문 취소" },
];
export function OrderStatusTabs({ status, counts, onChange }: {
  status: OrderFilter; counts?: Record<OrderFilter, number>; onChange: (value: OrderFilter) => void;
}) {
  return <div role="tablist" aria-label="관리자 주문 상태" className="flex gap-1 overflow-x-auto border-b border-zinc-200">
    {tabs.map((tab, index) => <button key={tab.status} type="button" role="tab" aria-selected={status === tab.status}
      aria-controls="admin-orders-panel" tabIndex={status === tab.status ? 0 : -1} onClick={() => onChange(tab.status)}
      onKeyDown={event => {
        let next: number;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault(); onChange(tabs[next].status);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
      }} className={`shrink-0 cursor-pointer border-b-2 px-4 py-3 text-sm font-semibold ${status === tab.status ? "border-emerald-700 text-emerald-700" : "border-transparent text-zinc-500 hover:text-zinc-950"}`}>
      {tab.label}<span className={`ml-2 rounded-full px-2 py-0.5 text-xs tabular-nums ${status === tab.status ? "bg-emerald-50" : "bg-zinc-100"}`}>{counts?.[tab.status]?.toLocaleString("ko-KR") ?? "—"}</span><span className="sr-only">건</span>
    </button>)}
  </div>;
}
