"use client";

import { useRef, useState } from "react";
import { useAddCartItem } from "@/features/add-to-cart/model/use-add-cart-item";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { ProductVisual } from "./product-visual";
import { productVisualClass, type Product } from "../model/product";

const formatPrice = (price: number) => `${price.toLocaleString("ko-KR")}원`;

export function ProductCard({ product }: { product: Product }) {
  const { add, isPending } = useAddCartItem();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const confirming = useRef(false);

  function closeConfirm() {
    if (!confirming.current) setIsConfirmOpen(false);
  }

  async function confirmAdd() {
    if (confirming.current) return;
    confirming.current = true;
    try {
      await add(product.id);
      setIsConfirmOpen(false);
    } finally {
      confirming.current = false;
    }
  }

  return (
    <article className="group">
      <div className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl ${productVisualClass[product.category]}`}>
        {product.badge && <span className="absolute left-3 top-3 z-10 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold tracking-wider text-zinc-700">{product.badge}</span>}
        <ProductVisual product={product} placeholderOutlined />
        <button
          type="button"
          onClick={() => setIsConfirmOpen(true)}
          disabled={isPending}
          aria-busy={isPending}
          className="absolute bottom-3 right-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white text-xl text-zinc-900 opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100 hover:bg-zinc-950 hover:text-white cursor-pointer disabled:cursor-wait disabled:opacity-60"
          aria-label={`${product.name} 장바구니에 담기`}
        >
          {isPending ? "…" : "+"}
        </button>
      </div>
      <div className="mt-4">
        <p className="text-xs font-medium text-emerald-700">{product.categoryLabel}</p>
        <h3 className="mt-1 font-semibold text-zinc-950">{product.name}</h3>
        <p className="mt-1 text-sm text-zinc-500">{product.description}</p>
        <p className="mt-3 text-sm font-bold text-zinc-950">{formatPrice(product.price)}</p>
      </div>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="장바구니에 담으시겠습니까?"
        description="선택한 상품 1개를 장바구니에 추가합니다."
        confirmLabel="담기"
        isPending={isPending}
        onClose={closeConfirm}
        onConfirm={() => void confirmAdd()}
      >
        <div className="flex items-center gap-4 rounded-xl bg-zinc-50 p-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white sm:h-20 sm:w-20">
            <ProductVisual product={product} compact sizes="80px" />
          </div>
          <div className="min-w-0">
            <p className="break-words font-semibold text-zinc-950">{product.name}</p>
            <p className="mt-1 text-sm text-zinc-500">수량 1개 · {formatPrice(product.price)}</p>
          </div>
        </div>
      </ConfirmDialog>
    </article>
  );
}
