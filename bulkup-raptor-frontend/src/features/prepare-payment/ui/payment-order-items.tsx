"use client";

import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/lib/api";
import type { OrderResponse } from "@/entities/order/model/order-types";
import { ProductVisual } from "@/entities/product/ui/product-visual";

export function PaymentOrderItems({ order }: { order: OrderResponse }) {
  // 현재 상품 정보는 이미지에만 사용하고, 이름·수량·금액은 주문 저장값을 표시한다.
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts, staleTime: 60_000 });
  return (
    <div className="divide-y divide-zinc-200/70">
      {order.items.map((item, index) => (
        <div key={`${item.productId}:${index}`} className="flex gap-4 py-4 first:pt-0 last:pb-0">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-zinc-200/70 bg-white sm:size-24">
            <ProductVisual product={{ name: item.productName, imageUrl: products.data?.find(product => product.id === item.productId)?.imageUrl }} compact sizes="96px" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="break-words text-sm font-semibold leading-relaxed text-zinc-900">{item.productName}</p>
            <p className="mt-1 text-xs text-zinc-500">{item.quantity}개 · 개당 {item.unitPrice.toLocaleString("ko-KR")}원</p>
            <p className="mt-2 text-sm font-bold tabular-nums text-zinc-900">{item.lineTotal.toLocaleString("ko-KR")}원</p>
          </div>
        </div>
      ))}
    </div>
  );
}
