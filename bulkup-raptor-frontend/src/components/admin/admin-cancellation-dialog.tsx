"use client";

import { useQuery } from "@tanstack/react-query";
import { currentMember } from "@/lib/api";
import { canAccessAdmin } from "@/entities/session";
import { getAdminOrder, type AdminOrderDetail } from "@/entities/order/api/get-admin-orders";
import { Dialog } from "@/shared/ui/dialog";

export function CancellationSummary({ detail }: { detail: AdminOrderDetail }) {
  const payment = detail.payment;
  const paymentResult = !payment ? "결제 내역 없음" : payment.status === "CANCELLED" ? "결제 취소 완료"
    : payment.status === "PAID" ? "결제 취소 확인 필요" : payment.status === "RETIRED" ? "종료된 결제 시도" : "결제 전 주문";
  return <dl className="grid gap-5 rounded-xl bg-zinc-50 p-4 text-sm">
    <div><dt className="text-zinc-500">주문 상태</dt><dd className="mt-1 font-semibold text-zinc-900">{detail.order.status === "CANCELLED" ? "주문 취소됨" : detail.order.cancellationPending ? "취소 처리 중" : "결제 전 주문"}</dd></div>
    {detail.order.cancellationReason?.trim() && <div><dt className="text-zinc-500">취소 사유</dt><dd className="mt-1 whitespace-pre-wrap break-words text-zinc-900">{detail.order.cancellationReason.trim()}</dd></div>}
    <div><dt className="text-zinc-500">결제 취소 결과</dt><dd className="mt-1 font-semibold text-zinc-900">{paymentResult}</dd></div>
  </dl>;
}

export function AdminCancellationDialog({ memberId, orderId, onClose }: {
  memberId: number; orderId: number; onClose: () => void;
}) {
  const session = useQuery({ queryKey: ["me"], queryFn: currentMember });
  const current = session.data?.id === memberId && canAccessAdmin(session.data);
  const enabled = current && Number.isSafeInteger(orderId) && orderId > 0;
  const detail = useQuery({
    queryKey: ["admin-order", memberId, orderId],
    queryFn: async ({ signal }) => {
      const value = await getAdminOrder(orderId, signal);
      if (value.order.orderId !== orderId) throw new Error("주문 정보가 일치하지 않습니다.");
      return value;
    },
    enabled, retry: false,
  });
  if (!current) return null;
  return <Dialog isOpen onClose={onClose} title={`주문 #${orderId} 취소 상세`} maxWidthClassName="max-w-2xl" scrollable
    footer={<button type="button" onClick={onClose} className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700">닫기</button>}>
    {detail.isError ? <p role="alert" className="py-8 text-center text-sm text-zinc-600">취소 상세를 불러오지 못했습니다.
      <button type="button" onClick={() => void detail.refetch()} className="ml-2 underline">다시 시도</button></p>
      : detail.isPending ? <p role="status" className="py-10 text-center text-sm text-zinc-500">취소 상세를 불러오는 중입니다.</p>
        : <CancellationSummary detail={detail.data} />}
  </Dialog>;
}
