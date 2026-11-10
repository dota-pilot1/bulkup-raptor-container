"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { currentMember } from "@/lib/api";
import { Dialog } from "@/shared/ui/dialog";
import { useOrderDelivery } from "@/entities/delivery/model/use-deliveries";
import { DeliveryDetails, DeliveryError, DeliveryStatusBadge, deliveryTime } from "@/entities/delivery/ui/delivery-details";

export function OrderDeliveryButton({ memberId, orderId }: { memberId: number; orderId: number }) {
  const [open, setOpen] = useState(false);
  const session = useQuery({ queryKey: ["me"], queryFn: currentMember });
  const current = session.data?.id === memberId;
  const query = useOrderDelivery(current ? memberId : null, orderId, current);
  return <><div className="flex flex-wrap items-center justify-between gap-3" aria-label="배송 요약">
    <div className="flex flex-wrap items-center gap-3"><span className="text-xs font-semibold text-zinc-500">배송 정보</span>
    {current && (query.data ? <DeliveryStatusBadge status={query.data.delivery.status} /> : <span className="text-xs text-zinc-500">{query.isError ? "배송 상태 확인 필요" : "배송 상태 확인 중"}</span>)}
    {current && query.data && <span className="text-xs text-zinc-500">최근 처리 <time dateTime={query.data.delivery.deliveredAt ?? query.data.delivery.startedAt ?? query.data.delivery.createdAt}>{deliveryTime(query.data.delivery.deliveredAt ?? query.data.delivery.startedAt ?? query.data.delivery.createdAt)}</time></span>}
    </div>
    <button type="button" disabled={!current} onClick={() => setOpen(true)} aria-label={`주문 ${orderId} 배송 조회`}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-40">
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Z M3 7l9 4 9-4 M12 11v10" /></svg>
      배송 조회
    </button></div>
    <Dialog isOpen={open && current} onClose={() => setOpen(false)} title={`주문 #${orderId} 배송 조회`} maxWidthClassName="max-w-xl" scrollable>
      {query.isPending ? <p role="status" className="py-12 text-center text-sm text-zinc-500">배송 정보를 불러오는 중입니다.</p>
        : query.isError ? <DeliveryError error={query.error} onRetry={() => void query.refetch()} />
          : query.data && <>
            <div className="mb-4 flex justify-end"><button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="text-xs font-semibold text-zinc-500 underline disabled:opacity-40">최신 정보 조회</button></div>
            <DeliveryDetails delivery={query.data.delivery} history={query.data.history} />
          </>}
    </Dialog>
  </>;
}

export function OrderDeliveryPanel({ memberId, orderId }: { memberId: number; orderId: number }) {
  const session = useQuery({ queryKey: ["me"], queryFn: currentMember });
  const current = session.data?.id === memberId;
  const query = useOrderDelivery(current ? memberId : null, orderId, current);
  if (!current) return null;
  return <section aria-label="배송 진행 상황" className="rounded-2xl border border-zinc-200 bg-white p-6">
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold">배송 진행 상황</h2>
      <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="text-xs font-semibold text-zinc-500 underline disabled:opacity-40">최신 정보 조회</button>
    </div>
    {query.isPending ? <p role="status" className="text-sm text-zinc-500">배송 정보를 불러오는 중입니다.</p>
      : query.isError ? <DeliveryError error={query.error} onRetry={() => void query.refetch()} />
        : query.data && <DeliveryDetails delivery={query.data.delivery} history={query.data.history} progressOnly />}
  </section>;
}
