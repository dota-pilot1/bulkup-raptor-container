"use client";

import { useRef } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { createStockAdjustment } from "@/entities/inventory/api/create-stock-adjustment";
import { getStockAdjustments } from "@/entities/inventory/api/get-stock-adjustments";
import type { StockAdjustmentRequest } from "@/entities/inventory/model/stock-adjustment";
import type { Product } from "@/entities/product/model/product";
import { hasPermission, type MemberSession } from "@/entities/session";
import { ApiError } from "@/shared/api/client";
import type { StockAdjustmentFieldErrors } from "./validate-stock-adjustment";

type Action = { kind: "save"; request: StockAdjustmentRequest } | { kind: "review" };
export type StockAdjustmentOutcome =
  | { status: "saved"; refreshFailed: boolean }
  | { status: "reviewed"; refreshFailed: boolean }
  | { status: "rejected"; message: string; fieldErrors?: StockAdjustmentFieldErrors }
  | { status: "uncertain"; message: string }
  | { status: "ignored" };

export function useStockAdjustment(productId: number, memberId: number, onRefresh: (productId: number) => void) {
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const mutationKey = ["stock-adjustment", memberId, productId];
  const pending = useIsMutating({ mutationKey });
  const isCurrentMember = () => {
    const member = queryClient.getQueryData<MemberSession | null>(["me"]);
    return member?.id === memberId && hasPermission(member, "PRODUCT_MANAGE");
  };

  async function refresh() {
    // 저장 전에 시작한 조회가 저장 결과를 덮어쓰지 않도록 중단한다.
    await Promise.all([
      queryClient.cancelQueries({ queryKey: ["products"] }),
      queryClient.cancelQueries({ queryKey: ["inventory-product", productId] }),
      queryClient.cancelQueries({ queryKey: ["inventory-history", memberId, productId] }),
    ]);
    if (!isCurrentMember()) return false;
    await queryClient.invalidateQueries({ queryKey: ["inventory-history", memberId, productId], refetchType: "none" });
    onRefresh(productId);
    const results = await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["products"] }, { throwOnError: true }),
      queryClient.invalidateQueries({ queryKey: ["inventory-product", productId] }, { throwOnError: true }),
      queryClient.fetchQuery({
        queryKey: ["inventory-history", memberId, productId, 0, 10],
        queryFn: ({ signal }) => getStockAdjustments(productId, 0, 10, signal),
        staleTime: 0, retry: false,
      }),
    ]);
    return results.every((result) => result.status === "fulfilled");
  }

  const mutation = useMutation<StockAdjustmentOutcome, Error, Action>({
    mutationKey,
    retry: false,
    mutationFn: async (action) => {
      if (!isCurrentMember()) return { status: "ignored" };
      if (action.kind === "review") {
        const refreshed = await refresh();
        return isCurrentMember() ? { status: "reviewed", refreshFailed: !refreshed } : { status: "ignored" };
      }
      let saved;
      try {
        saved = await createStockAdjustment(productId, action.request);
      } catch (error) {
        if (!isCurrentMember()) return { status: "ignored" };
        if (error instanceof ApiError && error.status < 500) {
          if (error.status === 409) {
            const refreshed = await refresh();
            const quantityError = error.code === "STOCK_INSUFFICIENT" || error.code === "STOCK_QUANTITY_OUT_OF_RANGE"
              ? error.message : undefined;
            return { status: "rejected", fieldErrors: quantityError ? { quantity: quantityError } : undefined, message: refreshed
              ? "재고를 변경할 수 없습니다. 최신 재고를 확인하고 수량을 다시 입력해 주세요."
              : "재고를 변경할 수 없습니다. 최신 재고 조회도 실패했습니다. 재고를 새로고침해 주세요." };
          }
          if (error.status === 401 || error.status === 403) {
            void queryClient.invalidateQueries({ queryKey: ["me"] });
          }
          return { status: "rejected", fieldErrors: error.status === 400 ? {
            quantity: error.fieldErrors?.delta, reason: error.fieldErrors?.reason,
          } : undefined, message: error.status === 401 ? "로그인이 만료되었습니다. 다시 로그인해 주세요."
            : error.status === 403 ? "재고를 변경할 권한이 없습니다."
            : error.status === 404 ? "상품을 찾을 수 없습니다. 삭제되었을 수 있습니다."
            : error.message };
        }
        return { status: "uncertain", message: "저장 결과를 확인할 수 없습니다. 재고와 이력을 확인한 뒤 다시 입력해 주세요." };
      }
      if (!isCurrentMember()) return { status: "ignored" };
      // POST 결과를 먼저 반영하고, 최신 조회로 목록·상세·이력을 맞춘다.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["products"] }),
        queryClient.cancelQueries({ queryKey: ["inventory-product", productId] }),
      ]);
      if (!isCurrentMember()) return { status: "ignored" };
      queryClient.setQueryData<Product[]>(["products"], (previous) => previous?.map((product) =>
        product.id === productId ? { ...product, stockQuantity: saved.afterQuantity } : product));
      queryClient.setQueryData<Product>(["inventory-product", productId], (previous) =>
        previous ? { ...previous, stockQuantity: saved.afterQuantity } : previous);
      const refreshed = await refresh();
      return isCurrentMember() ? { status: "saved", refreshFailed: !refreshed } : { status: "ignored" };
    },
  });

  async function run(action: Action): Promise<StockAdjustmentOutcome> {
    // React가 상태를 갱신하기 전의 연속 클릭과 다른 화면 인스턴스의 요청을 막는다.
    if (submitting.current || queryClient.isMutating({ mutationKey }) > 0) return { status: "ignored" };
    submitting.current = true;
    try {
      return await mutation.mutateAsync(action);
    } catch {
      return { status: "uncertain", message: "처리 결과를 확인할 수 없습니다. 재고와 이력을 먼저 확인해 주세요." };
    } finally {
      submitting.current = false;
    }
  }

  return { save: (request: StockAdjustmentRequest) => run({ kind: "save", request }),
    review: () => run({ kind: "review" }), isPending: mutation.isPending || pending > 0 };
}
