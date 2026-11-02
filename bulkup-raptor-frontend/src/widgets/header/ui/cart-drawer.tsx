"use client";

import { useRouter } from "next/navigation";
import type { UseQueryResult } from "@tanstack/react-query";
import type { CartResponse } from "@/entities/cart/model/types";
import type { MemberSession } from "@/entities/session";
import { ProductVisual } from "@/entities/product/ui/product-visual";
import { Drawer } from "@/components/ui/drawer";
import { useUpdateCartItemQuantity } from "@/features/update-cart-item-quantity/model/use-update-cart-item-quantity";

import { useDeleteCartItem } from "@/features/delete-cart-item/model/use-delete-cart-item";

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  member: UseQueryResult<MemberSession | null, Error>;
  cart: UseQueryResult<CartResponse, Error>;
};

const FREE_SHIPPING_THRESHOLD = 50000;

export function CartDrawer({ isOpen, onClose, onLogin, member, cart }: CartDrawerProps) {
  const router = useRouter();
  const quantityChange = useUpdateCartItemQuantity();
  const deletion = useDeleteCartItem();
  const isChanging = quantityChange.isPending || deletion.isPending;
  const loading = member.isPending || (!!member.data && (cart.isPending || cart.isFetching));
  const hasError = member.isError || (!!member.data && cart.isError);
  const data = !loading && !hasError && member.data ? cart.data : undefined;
  const items = data?.items ?? [];
  const itemCount = data?.items.length;
  const itemsTotal = data?.totalAmount ?? 0;
  const shippingFee = itemsTotal >= FREE_SHIPPING_THRESHOLD || itemsTotal === 0 ? 0 : 3000;
  const grandTotal = itemsTotal + shippingFee;
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - itemsTotal);
  const progressPercent = Math.min(100, Math.round((itemsTotal / FREE_SHIPPING_THRESHOLD) * 100));

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>장바구니</span>
          {itemCount !== undefined && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
              {itemCount}
            </span>
          )}
        </div>
      }
      description={items.length > 0 ? `${itemCount}종의 상품이 담겨 있습니다.` : undefined}
      footer={items.length > 0 ? (
        <div className="space-y-3">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-zinc-500">
              <span>상품 금액</span>
              <span className="font-semibold text-zinc-900">{itemsTotal.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>배송비 (예상)</span>
              <span className="font-semibold text-zinc-900">
                {shippingFee === 0 ? <span className="font-bold text-emerald-600">무료</span> : `+${shippingFee.toLocaleString()}원`}
              </span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-bold text-zinc-950">
              <span>총 결제 예상 금액</span>
              <span className="text-base font-black text-emerald-700">{grandTotal.toLocaleString()}원</span>
            </div>
          </div>
          <button
            type="button"
            disabled={isChanging}
            onClick={() => { onClose(); router.push("/orders/new"); }}
            className="flex w-full cursor-pointer items-center justify-center rounded-xl bg-zinc-950 py-3.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            주문하기
          </button>
        </div>
      ) : null}
    >
      {loading ? (
        <div role="status" className="grid h-64 place-items-center text-sm text-zinc-500">장바구니를 불러오는 중입니다.</div>
      ) : hasError ? (
        <div role="alert" className="grid h-64 place-items-center text-center">
          <div>
            <h3 className="text-sm font-bold text-zinc-800">장바구니를 불러오지 못했습니다</h3>
            <p className="mt-1 text-xs text-zinc-500">잠시 후 다시 시도해 주세요.</p>
            <button
              type="button"
              onClick={() => void (member.isError ? member.refetch() : cart.refetch())}
              className="mt-5 rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800"
            >
              다시 시도
            </button>
          </div>
        </div>
      ) : !member.data ? (
        <div className="grid h-64 place-items-center text-center">
          <div>
            <h3 className="text-sm font-bold text-zinc-800">로그인이 필요합니다</h3>
            <p className="mt-1 text-xs text-zinc-500">로그인하면 저장된 장바구니를 볼 수 있어요.</p>
            <button type="button" onClick={onLogin} className="mt-5 rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800">
              로그인
            </button>
          </div>
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-800">
                {remainingForFreeShipping === 0 ? "무료배송 대상 예상" : <>무료배송까지 <strong className="text-emerald-700">{remainingForFreeShipping.toLocaleString()}원</strong> 남았어요</>}
              </span>
              <span className="text-[11px] font-semibold text-emerald-600">{progressPercent}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100">
              <div className="h-full rounded-full bg-emerald-600 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          {isChanging && (
            <p role="status" className="text-xs text-zinc-500">장바구니 변경을 처리하는 중입니다.</p>
          )}
          <div className="divide-y divide-zinc-100" aria-busy={isChanging}>
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-3">
                <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-zinc-100">
                  <ProductVisual product={item.product} compact sizes="56px" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold leading-5 text-zinc-900">{item.product.name}</h4>
                      <span className="text-xs text-zinc-400">{item.product.categoryLabel}</span>
                    </div>
                    <button type="button" disabled={isChanging} onClick={() => void deletion.remove(item.id)} title="상품 삭제" aria-label={`${item.product.name} 삭제`} className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-2xs transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:border-zinc-100 disabled:bg-zinc-50 disabled:text-zinc-300 disabled:shadow-none">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-zinc-900">{item.lineTotal.toLocaleString()}원</span>
                    <div className="flex items-center rounded-lg border border-zinc-200 bg-white shadow-2xs">
                      <button type="button" disabled={isChanging || item.quantity <= 1} onClick={() => void quantityChange.update(item.id, item.quantity - 1)} aria-label={`${item.product.name} 수량 감소`} className="grid h-6 w-6 cursor-pointer place-items-center text-xs font-bold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300">-</button>
                      <span className="min-w-6 text-center text-xs font-bold text-zinc-900">{item.quantity}</span>
                      <button type="button" disabled={isChanging || item.quantity >= 99} onClick={() => void quantityChange.update(item.id, item.quantity + 1)} aria-label={`${item.product.name} 수량 증가`} className="grid h-6 w-6 cursor-pointer place-items-center text-xs font-bold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300">+</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid h-72 place-items-center text-center">
          <div>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-zinc-100 text-2xl text-zinc-400">🛒</div>
            <h3 className="mt-4 text-sm font-bold text-zinc-800">장바구니가 비어 있습니다</h3>
            <p className="mt-1 text-xs text-zinc-400">내 몸에 필요한 건강한 루틴을 담아보세요.</p>
            <button type="button" onClick={() => { onClose(); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }}
              className="mt-5 rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800">
              추천 상품 둘러보기
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
