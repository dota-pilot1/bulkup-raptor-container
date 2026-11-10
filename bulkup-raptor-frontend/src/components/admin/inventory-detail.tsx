"use client";

import { useState, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProduct } from "@/entities/product/api/get-product";
import type { Product } from "@/entities/product/model/product";
import { ProductImagePreview } from "@/entities/product/ui/product-image-preview";
import { ApiError } from "@/shared/api/client";
import { InventoryHistory } from "./inventory-history";
import { StockAdjustmentForm } from "@/features/adjust-stock/ui/stock-adjustment-form";

export function InventoryDetail({ productId, memberId, canAdjust, historyVersion, onRefresh, onClose }: {
  productId: number; memberId: number; canAdjust: boolean; historyVersion: number;
  onRefresh: (productId: number) => void; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");
  const prefix = `inventory-${memberId}-${productId}`;

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>) {
    const next = event.key === "Home" ? "current" : event.key === "End" ? "history"
      : event.key === "ArrowLeft" || event.key === "ArrowRight" ? activeTab === "current" ? "history" : "current" : null;
    if (!next) return;
    event.preventDefault();
    setActiveTab(next);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#${prefix}-${next}-tab`)?.focus();
  }
  const detail = useQuery({
    queryKey: ["inventory-product", productId],
    queryFn: async ({ signal }) => {
      const product = await getProduct(productId, signal);
      queryClient.setQueryData<Product[]>(["products"], (previous) => previous?.map((item) => item.id === product.id ? product : item));
      return product;
    },
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  const product = detail.data;

  return <>
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 p-5">
      <h2 className="font-bold text-zinc-950">재고 상세</h2>
      <button type="button" onClick={onClose} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600">닫기</button>
    </div>
    <div className="space-y-5 p-5">
      {(detail.isPending || detail.isFetching) && <p role="status" className="text-sm text-zinc-500">현재 재고를 불러오는 중입니다.</p>}
      {detail.isError && !detail.isFetching && <p role="alert" className="text-sm text-rose-700">
        {detail.error instanceof ApiError && detail.error.status === 404 ? "상품을 찾을 수 없습니다. 삭제되었을 수 있습니다." : "현재 재고를 불러오지 못했습니다."}
      </p>}
      {product && <>
        <div className="flex items-center gap-3">
          <ProductImagePreview product={product} compact sizes="64px" className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-zinc-100" />
          <div className="min-w-0"><p className="text-xs font-semibold text-emerald-700">{product.categoryLabel}</p>
            <h3 className="mt-1 break-words font-bold text-zinc-950">{product.name}</h3>
            <p className="mt-1 text-xs text-zinc-400">상품 #{product.id}</p></div>
        </div>
        <p className="break-words text-sm text-zinc-500">{product.description}</p>
      </>}
    </div>
    <div role="tablist" aria-label="재고 상세 보기" className="grid grid-cols-2 border-b border-zinc-200 px-5">
      {(["current", "history"] as const).map((tab) => <button key={tab} type="button" role="tab"
        id={`${prefix}-${tab}-tab`} aria-controls={`${prefix}-${tab}-panel`} aria-selected={activeTab === tab}
        tabIndex={activeTab === tab ? 0 : -1} onClick={() => setActiveTab(tab)} onKeyDown={navigateTabs}
        className={`border-b-2 px-3 py-3 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 ${activeTab === tab ? "border-emerald-600 text-emerald-800" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>
        {tab === "current" ? "재고 현황·조정" : "변경 이력"}
      </button>)}
    </div>
    <div role="tabpanel" id={`${prefix}-current-panel`} aria-labelledby={`${prefix}-current-tab`}
      hidden={activeTab !== "current"} tabIndex={0} className="space-y-5 p-5">
      {product && <>
        <dl className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
          <dt className="text-sm font-medium text-zinc-500">현재 재고</dt>
          <dd className="mt-2 text-3xl font-bold text-zinc-950">{product.stockQuantity.toLocaleString("ko-KR")}<span className="ml-1 text-base font-medium">개</span></dd>
        </dl>
        {canAdjust ? <StockAdjustmentForm key={`${memberId}:${productId}`} productId={productId} memberId={memberId}
          currentStock={product.stockQuantity} disabled={detail.isFetching || detail.isError} onRefresh={onRefresh} />
          : <p className="text-xs text-zinc-500">재고 조회만 가능합니다. 변경하려면 상품 관리 권한이 필요합니다.</p>}
      </>}
      <button type="button" disabled={detail.isFetching} onClick={() => void detail.refetch()}
        className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 disabled:opacity-40">재고 새로고침</button>
      <button type="button" onClick={(event) => {
        setActiveTab("history");
        event.currentTarget.closest("section")?.querySelector<HTMLButtonElement>(`#${prefix}-history-tab`)?.focus();
      }} className="w-full text-sm font-semibold text-emerald-700 underline underline-offset-4">변경 이력 보기</button>
    </div>
    <div role="tabpanel" id={`${prefix}-history-panel`} aria-labelledby={`${prefix}-history-tab`}
      hidden={activeTab !== "history"} tabIndex={0}>
      <InventoryHistory key={`${memberId}:${productId}${historyVersion ? `:${historyVersion}` : ""}`} productId={productId} memberId={memberId} />
    </div>
  </>;
}
