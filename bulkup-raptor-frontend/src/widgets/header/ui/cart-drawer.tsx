"use client";

import { useState } from "react";
import { useCartStore } from "@/store/cart-store";
import { Drawer } from "@/components/ui/drawer";

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

const FREE_SHIPPING_THRESHOLD = 50000;

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, clear } = useCartStore();
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);

  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = itemsTotal >= FREE_SHIPPING_THRESHOLD || itemsTotal === 0 ? 0 : 3000;
  const grandTotal = itemsTotal + shippingFee;
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - itemsTotal);
  const progressPercent = Math.min(100, Math.round((itemsTotal / FREE_SHIPPING_THRESHOLD) * 100));

  const handleCheckout = () => {
    setIsOrdering(true);
    setTimeout(() => {
      setIsOrdering(false);
      setOrderComplete(true);
      clear();
      setTimeout(() => {
        setOrderComplete(false);
        onClose();
      }, 2000);
    }, 1000);
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>장바구니</span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
            {totalItemCount}
          </span>
        </div>
      }
      description={
        items.length > 0
          ? `${totalItemCount}개의 상품이 담겨 있습니다.`
          : undefined
      }
      footer={
        items.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-500">
                <span>상품 금액</span>
                <span className="font-semibold text-zinc-900">{itemsTotal.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>배송비</span>
                <span className="font-semibold text-zinc-900">
                  {shippingFee === 0 ? (
                    <span className="text-emerald-600 font-bold">무료</span>
                  ) : (
                    `+${shippingFee.toLocaleString()}원`
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-bold text-zinc-950">
                <span>총 결제 예상 금액</span>
                <span className="text-base font-black text-emerald-700">{grandTotal.toLocaleString()}원</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={isOrdering || orderComplete}
              className="flex w-full items-center justify-center rounded-xl bg-zinc-950 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              {isOrdering ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : orderComplete ? (
                "✓ 주문이 완료되었습니다!"
              ) : (
                `총 ${grandTotal.toLocaleString()}원 주문하기`
              )}
            </button>
          </div>
        ) : null
      }
    >
      {orderComplete ? (
        <div className="grid h-64 place-items-center text-center">
          <div>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-xl text-emerald-600">
              ✓
            </div>
            <h3 className="mt-3 text-base font-bold text-zinc-900">주문이 성공적으로 접수되었습니다!</h3>
            <p className="mt-1 text-xs text-zinc-400">루틴을 이어갈 상품을 빠르게 준비해 드릴게요.</p>
          </div>
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-4">
          {/* 무료배송 프로그레스 게이지 */}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-800">
                {remainingForFreeShipping === 0 ? (
                  "🎉 무료배송 혜택이 적용되었습니다!"
                ) : (
                  <>무료배송까지 <strong className="text-emerald-700 font-black">{remainingForFreeShipping.toLocaleString()}원</strong> 남았어요</>
                )}
              </span>
              <span className="text-[11px] font-semibold text-emerald-600">{progressPercent}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
              <div
                className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* 담긴 상품 목록 */}
          <div className="divide-y divide-zinc-100">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 py-3">
                {/* 썸네일 */}
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-zinc-100 text-2xl">
                  {item.visual ?? "📦"}
                </div>

                {/* 정보 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="truncate text-xs font-bold text-zinc-900">{item.name}</h4>
                      {item.category && (
                        <span className="text-[10px] text-zinc-400">{item.category}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="text-zinc-400 hover:text-rose-500 transition cursor-pointer p-0.5"
                      aria-label="삭제"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-zinc-900">
                      {(item.price * item.quantity).toLocaleString()}원
                    </span>

                    {/* 수량 조절 버튼 */}
                    <div className="flex items-center rounded-lg border border-zinc-200 bg-white shadow-2xs">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="grid h-6 w-6 place-items-center text-xs font-bold text-zinc-500 hover:bg-zinc-100 transition cursor-pointer rounded-l-md"
                        aria-label="수량 감소"
                      >
                        -
                      </button>
                      <span className="min-w-6 text-center text-xs font-bold text-zinc-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="grid h-6 w-6 place-items-center text-xs font-bold text-zinc-500 hover:bg-zinc-100 transition cursor-pointer rounded-r-md"
                        aria-label="수량 증가"
                      >
                        +
                      </button>
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
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-zinc-100 text-2xl text-zinc-400">
              🛒
            </div>
            <h3 className="mt-4 text-sm font-bold text-zinc-800">장바구니가 비어 있습니다</h3>
            <p className="mt-1 text-xs text-zinc-400">내 몸에 필요한 건강한 루틴을 담아보세요.</p>
            <button
              type="button"
              onClick={() => {
                onClose();
                document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="mt-5 inline-flex items-center rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-800 cursor-pointer"
            >
              추천 상품 둘러보기
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
