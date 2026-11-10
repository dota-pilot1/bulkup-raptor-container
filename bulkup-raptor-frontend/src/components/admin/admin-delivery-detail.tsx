"use client";

import { useQuery } from "@tanstack/react-query";
import { currentMember } from "@/lib/api";
import { canAccessAdmin, hasPermission } from "@/entities/session";
import { Dialog } from "@/shared/ui/dialog";
import { useAdminDelivery } from "@/entities/delivery/model/use-deliveries";
import { DeliveryDetails, DeliveryError } from "@/entities/delivery/ui/delivery-details";
import { ChangeDeliveryStatus } from "@/features/change-delivery-status/ui/change-delivery-status";

export function AdminDeliveryDetail({ memberId, deliveryId, onClose }: { memberId: number; deliveryId: number; onClose: () => void }) {
  const session = useQuery({ queryKey: ["me"], queryFn: currentMember });
  const allowed = session.data?.id === memberId && canAccessAdmin(session.data);
  const query = useAdminDelivery(allowed ? memberId : null, deliveryId);
  return <Dialog isOpen={allowed} onClose={onClose} title="배송 상세" description="수령 정보와 배송 진행 내역을 확인합니다." maxWidthClassName="max-w-xl" scrollable>
    {query.isPending ? <p role="status" className="py-12 text-center text-sm text-zinc-500">배송 정보를 불러오는 중입니다.</p>
      : query.isError ? <DeliveryError error={query.error} onRetry={() => void query.refetch()} />
        : <>
          <div className="mb-4 flex justify-end"><button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="text-xs font-semibold text-zinc-500 underline disabled:opacity-40">최신 정보 조회</button></div>
          <DeliveryDetails delivery={query.data.delivery} history={query.data.history} internal />
          {hasPermission(session.data, "SHIPPING_MANAGE")
            ? <ChangeDeliveryStatus memberId={memberId} delivery={query.data.delivery} disabled={query.isFetching} />
            : <p className="mt-6 border-t pt-4 text-xs text-zinc-500">배송 변경 권한이 없어 조회만 가능합니다.</p>}
        </>}
  </Dialog>;
}
