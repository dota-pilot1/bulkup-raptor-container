"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { canAccessAdmin, hasPermission } from "@/entities/session";
import { currentMember, listProducts } from "@/lib/api";
import type { Product } from "@/entities/product/model/product";
import { AdminNavigation } from "./admin-navigation";
import { ProductManagementList } from "./product-management-list";
import { InventoryDetail } from "./inventory-detail";

export function InventoryManagement() {
  const session = useQuery({ queryKey: ["me"], queryFn: currentMember, refetchInterval: 15_000, refetchOnWindowFocus: true });
  const allowed = canAccessAdmin(session.data);
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts, enabled: allowed });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [historyVersions, setHistoryVersions] = useState<Record<number, number>>({});
  const detailRef = useRef<HTMLElement>(null);

  function refreshHistory(productId: number) {
    setHistoryVersions((previous) => ({ ...previous, [productId]: (previous[productId] ?? 0) + 1 }));
  }

  function selectProduct(product: Product) {
    setSelectedId(product.id);
    if (window.matchMedia("(max-width: 1279px)").matches) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (session.isPending) return <main role="status" className="px-6 py-16 text-sm text-zinc-500">계정 확인 중입니다.</main>;
  if (session.isError) return <main role="alert" className="px-6 py-16 text-sm text-rose-700">계정 정보를 불러오지 못했습니다. <button type="button" onClick={() => void session.refetch()} className="underline">다시 시도</button></main>;
  if (!allowed) return <main className="mx-auto max-w-3xl px-6 py-16">
    <h1 className="text-2xl font-bold">관리 권한이 필요해요</h1>
    <p className="mt-2 text-sm text-zinc-500">관리자 페이지 접근 권한이 없습니다.</p>
    <Link href="/" className="mt-6 inline-block text-sm font-semibold underline">상점으로 돌아가기</Link>
  </main>;

  return <main className="flex w-full flex-col gap-5 px-4 py-6 sm:px-6 lg:flex-row lg:items-start">
    <AdminNavigation activeTab="inventory" productCount={products.data?.length} />
    <div className="min-w-0 flex-1 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-zinc-950">재고 관리</h1>
          <p className="mt-2 text-sm text-zinc-500">상품을 선택하면 현재 재고와 변경 이력을 확인할 수 있습니다.</p></div>
        <button type="button" disabled={products.isFetching} onClick={() => void products.refetch()}
          className="shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-600 disabled:opacity-40">목록 새로고침</button>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <ProductManagementList title="재고 목록" products={products.data ?? []} isPending={products.isPending} isError={products.isError}
          selectedId={selectedId} onSelect={selectProduct} selectionLabel="재고 조회" controls="inventory-detail"
          showPrice={false} onRetry={() => void products.refetch()} />
        <aside ref={detailRef} aria-label="재고 상세 및 변경 이력" className="min-w-0 scroll-mt-24 space-y-5 xl:sticky xl:top-24">
          <section id="inventory-detail" aria-label="재고 상세" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
            {selectedId === null || !session.data
              ? <div className="p-6"><h2 className="font-bold text-zinc-950">현재 재고</h2><p className="mt-3 text-sm text-zinc-500">목록에서 상품을 선택해 주세요.</p></div>
              : <InventoryDetail key={`${session.data.id}:${selectedId}`} productId={selectedId}
                memberId={session.data.id} canAdjust={hasPermission(session.data, "PRODUCT_MANAGE")}
                historyVersion={historyVersions[selectedId] ?? 0} onRefresh={refreshHistory} onClose={() => setSelectedId(null)} />}
          </section>
        </aside>
      </div>
    </div>
  </main>;
}
