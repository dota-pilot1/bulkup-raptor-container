import Link from "next/link";
import type { OrderSummary } from "../model/order-types";

const date = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function OrderHistory({ orders }: { orders: OrderSummary[] }) {
  if (!orders.length) return <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-16 text-center">
    <p className="font-semibold text-zinc-900">아직 주문 내역이 없어요.</p>
    <p className="mt-2 text-sm text-zinc-500">주문한 상품과 주문 상태를 여기서 확인할 수 있어요.</p>
    <Link href="/" className="mt-6 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800">상품 둘러보기</Link>
  </div>;
  return <ul aria-label="주문 내역" className="space-y-4">{orders.map(order => <li key={order.orderId}>
    <Link href={`/orders/${order.orderId}`} aria-label={`주문 ${order.orderId} 상세 보기`}
      className="group block cursor-pointer overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:border-emerald-300 hover:shadow-[0_8px_30px_-12px_rgba(0,100,70,0.18)] focus-visible:border-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/60 px-5 py-4 transition-colors group-hover:bg-emerald-50/50 group-focus-visible:bg-emerald-50/50 sm:px-7">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <time dateTime={order.createdAt} className="text-sm font-semibold tabular-nums text-zinc-700">{date.format(new Date(order.createdAt))}</time>
          <span className="text-xs tabular-nums text-zinc-400">주문 번호 {order.orderId}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-600" />{order.status === "PAID" ? "결제 완료" : "주문 접수 · 결제 전"}</span>
      </div>
      <div className="flex flex-col gap-6 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-7">
        <div className="flex min-w-0 items-center gap-4">
          <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-zinc-100 text-zinc-400 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-700 group-focus-visible:bg-emerald-50 group-focus-visible:text-emerald-700">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" /><path d="m4 7 8 4 8-4M12 11v10M8 5l8 4" /></svg>
          </span>
          <div className="min-w-0"><h2 className="break-words text-base font-bold tracking-tight text-zinc-900 sm:text-lg">{order.items[0]?.productName ?? "주문 상품"}{order.items.length > 1 && <span className="ml-1.5 text-sm font-medium text-zinc-500">외 {order.items.length - 1}종</span>}</h2>
            <p className="mt-2 text-sm text-zinc-500">총 {order.items.reduce((sum, item) => sum + item.quantity, 0)}개 · 배송비 포함</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-5 border-t border-zinc-100 pt-4 sm:flex-col sm:items-end sm:gap-3 sm:border-0 sm:pt-0">
          <p className="text-xl font-extrabold tracking-tight tabular-nums text-zinc-950">{order.totalAmount.toLocaleString("ko-KR")}<span className="ml-0.5 text-sm font-semibold">원</span></p>
          <span className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-600 transition-colors group-hover:border-emerald-700 group-hover:bg-emerald-700 group-hover:text-white group-focus-visible:border-emerald-700 group-focus-visible:bg-emerald-700 group-focus-visible:text-white">
            주문 상세 보기 <svg aria-hidden="true" className="h-3.5 w-3.5 transition-transform motion-safe:group-hover:translate-x-0.5 motion-reduce:transition-none" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>
          </span>
        </div>
      </div>
    </Link>
  </li>)}</ul>;
}
