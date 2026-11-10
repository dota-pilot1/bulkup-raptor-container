import { ApiError } from "@/shared/api/client";
import { deliveryLabels, type DeliveryHistory, type DeliveryInfo, type DeliveryStatus } from "../model/delivery-types";

const date = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" });
export function deliveryTime(value: string | null) { return value ? date.format(new Date(value)) : "미정"; }
export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const color = status === "DELIVERED" ? "bg-zinc-100 text-zinc-600" : status === "OUT_FOR_DELIVERY" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${color}`}>{deliveryLabels[status]}</span>;
}
export function DeliveryError({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const message = error instanceof ApiError
    ? error.status === 401 ? "로그인이 필요합니다."
      : error.status === 403 ? "배송 정보를 조회할 권한이 없습니다."
        : error.status === 404 ? "배송 정보가 아직 준비되지 않았거나 조회할 수 없는 주문입니다."
          : "배송 정보를 불러오지 못했습니다."
    : "배송 정보를 불러오지 못했습니다.";
  return <div role="alert" className="rounded-xl bg-rose-50 p-5 text-sm leading-6 text-rose-700">
    {message}<button type="button" onClick={onRetry} className="ml-3 font-semibold underline">다시 조회</button>
  </div>;
}
export function DeliveryDetails({ delivery, history, internal = false, progressOnly = false }: {
  delivery: DeliveryInfo; history: DeliveryHistory[]; internal?: boolean; progressOnly?: boolean;
}) {
  const entries = [
    ["수령인", delivery.recipientName], ["연락처", delivery.phone],
    ["수령지", `(${delivery.postalCode}) ${delivery.address} ${delivery.addressDetail}`.trim()],
  ];
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50 p-4">
      <div><p className="text-xs text-zinc-500">주문 #{delivery.orderId}</p><p className="mt-1 text-sm font-semibold text-zinc-900">배송 #{delivery.deliveryId}</p></div>
      <DeliveryStatusBadge status={delivery.status} />
    </div>
    <p className="text-sm text-zinc-600">배송 담당자 <span className="ml-2 font-semibold text-zinc-900">{delivery.handlerName ?? "미배정"}</span></p>
    {!progressOnly && <>
    <section aria-label="배송 상품"><h3 className="mb-3 text-sm font-bold text-zinc-900">배송 상품</h3>
      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 px-4">{delivery.items.map((item, index) => <li key={index} className="flex justify-between gap-3 py-3 text-sm">
        <span className="break-words text-zinc-700">{item.productName}</span><span className="shrink-0 font-semibold">{item.quantity}개</span>
      </li>)}</ul>
    </section>
    <section aria-label="수령 정보"><h3 className="mb-3 text-sm font-bold text-zinc-900">수령 정보</h3>
      <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">{entries.map(([label, value]) => <div key={label} className="contents"><dt className="text-zinc-500">{label}</dt><dd className="break-words text-zinc-800">{value}</dd></div>)}</dl>
      <p className="mt-3 text-xs leading-5 text-zinc-400">주문할 때 확정한 배송지를 수령지로 사용합니다.</p>
    </section>
    </>}
    <section aria-label="배송 처리 이력"><div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-zinc-900">배송 처리 이력</h3><span className="text-xs text-zinc-400">한국 시간</span></div>
      <ol className="ml-2 space-y-5 border-l border-zinc-200 pl-5">
        <li className="relative text-sm"><span aria-hidden="true" className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-zinc-300" /><p className="font-semibold text-zinc-700">배송 준비</p><time className="mt-1 block text-xs text-zinc-500" dateTime={delivery.createdAt}>{deliveryTime(delivery.createdAt)}</time></li>
        {history.map((entry, index) => <li key={index} className="relative text-sm">
          <span aria-hidden="true" className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-emerald-600" />
          <p className="font-semibold text-zinc-800">{deliveryLabels[entry.fromStatus]} → {deliveryLabels[entry.toStatus]}</p>
          <time dateTime={entry.createdAt} className="mt-1 block text-xs text-zinc-500">{deliveryTime(entry.createdAt)}</time>
          {internal && "actorId" in entry && <p className="mt-1 text-xs text-zinc-400">{entry.actorName ? `처리자 ${entry.actorName}` : entry.actorId ? `처리자 #${entry.actorId}` : "처리자 정보 없음"}</p>}
          {internal && "reason" in entry && entry.reason && <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">{entry.reason}</p>}
        </li>)}
      </ol>
      {history.length === 0 && <p className="mt-4 text-xs text-zinc-400">아직 배송 상태 변경 내역이 없습니다.</p>}
    </section>
  </div>;
}
