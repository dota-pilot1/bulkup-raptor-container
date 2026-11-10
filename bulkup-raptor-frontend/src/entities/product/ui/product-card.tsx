"use client";

import { useRef, useState } from "react";
import { useAddCartItem } from "@/features/add-to-cart/model/use-add-cart-item";
import { Dialog } from "@/shared/ui/dialog";
import { ProductVisual } from "./product-visual";
import { productVisualClass, type Product } from "../model/product";

const formatPrice = (price: number) => `${price.toLocaleString("ko-KR")}원`;

export function ProductCard({ product }: { product: Product }) {
  const { add, isPending } = useAddCartItem();
  const soldOut = product.availableQuantity <= 0;
  // 갱신된 상품 정보로 재확인하도록 이전 상품의 확인창은 닫힌 상태로 표시한다.
  const [confirmingProduct, setConfirmingProduct] = useState<Product | null>(null);
  const isConfirmOpen = confirmingProduct === product && !soldOut;
  const confirming = useRef(false);
  const [quantity, setQuantity] = useState(1);
  const maxQuantity = Math.min(99, product.availableQuantity);

  function openConfirm() {
    setQuantity(1);
    setConfirmingProduct(product);
  }

  function closeConfirm() {
    if (!confirming.current) setConfirmingProduct(null);
  }

  async function confirmAdd() {
    if (confirming.current || quantity > maxQuantity) return;
    confirming.current = true;
    try {
      await add(product.id, quantity);
      setConfirmingProduct(null);
    } finally {
      confirming.current = false;
    }
  }

  return (
    <article className="group">
      <div className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl ${productVisualClass[product.category]}`}>
        {!soldOut && product.badge && <span className="absolute left-3 top-3 z-10 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold tracking-wider text-zinc-700">{product.badge}</span>}
        <ProductVisual product={product} placeholderOutlined />
        {soldOut && <div className="absolute inset-0 z-10 grid place-items-center bg-white/55">
          <span role="status" className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-bold tracking-wide text-white">품절</span>
        </div>}
        {!soldOut && <button
          type="button"
          onClick={openConfirm}
          disabled={isPending}
          aria-busy={isPending}
          className="absolute bottom-3 right-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white text-xl text-zinc-900 opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100 hover:bg-zinc-950 hover:text-white cursor-pointer disabled:cursor-wait disabled:opacity-60"
          aria-label={`${product.name} 장바구니에 담기`}
        >
          {isPending ? "…" : "+"}
        </button>}
      </div>
      <div className="mt-4">
        <p className="text-xs font-medium text-emerald-700">{product.categoryLabel}</p>
        <h3 className="mt-1 font-semibold text-zinc-950">{product.name}</h3>
        <p className="mt-1 text-sm text-zinc-500">{product.description}</p>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <p className="text-sm font-bold text-zinc-950">{formatPrice(product.price)}</p>
          <p className={`text-xs font-semibold tabular-nums ${soldOut ? "text-zinc-400" : "text-zinc-600"}`}>재고 {product.availableQuantity.toLocaleString("ko-KR")}개</p>
        </div>
      </div>
      <Dialog
        isOpen={isConfirmOpen}
        title="장바구니에 담기"
        onClose={closeConfirm}
        closeDisabled={isPending}
        maxWidthClassName="max-w-xl"
        scrollable
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 items-start gap-3 rounded-xl bg-zinc-50 p-4">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <ProductVisual product={product} compact sizes="64px" />
            </div>
            <div className="min-w-0">
              <p className="break-words font-semibold text-zinc-950">{product.name}</p>
              <p className="mt-1 text-sm text-zinc-500">개당 {formatPrice(product.price)}</p>
              <p className="mt-2 text-xs font-semibold text-emerald-700">현재 구매 가능 {product.availableQuantity.toLocaleString("ko-KR")}개</p>
              <p className="mt-3 text-xs leading-relaxed text-zinc-500">장바구니에 담아도 재고는 확보되지 않습니다.</p>
            </div>
          </div>

          <div className="min-w-0 border-t border-zinc-200 pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <p className="mb-2 text-sm font-semibold text-zinc-700">수량</p>
            <div role="group" aria-label="담을 수량" className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center rounded-lg border border-zinc-200 bg-zinc-50">
              <button type="button" aria-label="수량 감소" disabled={isPending || quantity <= 1}
                onClick={() => setQuantity(current => Math.max(1, current - 1))}
                className="h-11 rounded-l-lg border-r border-zinc-200 text-lg text-zinc-900 enabled:cursor-pointer enabled:hover:bg-zinc-200 disabled:text-zinc-400">−</button>
              <span aria-live="polite" className="text-center text-sm font-semibold tabular-nums">{quantity}개</span>
              <button type="button" aria-label="수량 증가" disabled={isPending || quantity >= maxQuantity}
                onClick={() => setQuantity(current => Math.min(maxQuantity, current + 1))}
                className="h-11 rounded-r-lg border-l border-zinc-200 text-lg text-zinc-900 enabled:cursor-pointer enabled:hover:bg-zinc-200 disabled:text-zinc-400">+</button>
            </div>
            <p className="my-4 flex items-baseline justify-between gap-2 text-sm text-zinc-600">
              <span>상품 합계</span>
              <strong className="text-base text-zinc-950">{formatPrice(product.price * quantity)}</strong>
            </p>
            <button type="button" onClick={() => void confirmAdd()} disabled={isPending} aria-busy={isPending}
              className="min-h-11 w-full rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white enabled:cursor-pointer enabled:hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60">
              {isPending ? "담는 중…" : "담기"}
            </button>
          </div>
        </div>
      </Dialog>
    </article>
  );
}
