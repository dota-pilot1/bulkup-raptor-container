"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/widgets/header/ui/header";
import { currentMember } from "@/lib/api";
import { getCart } from "@/entities/cart/api/get-cart";
import { cartQueryKey } from "@/entities/cart/model/query-keys";
import { ApiError } from "@/shared/api/client";
import { OrderForm } from "@/features/create-order/ui/order-form";
import { useOrderAttempt } from "@/features/create-order/model/order-attempt-store";

export default function NewOrderPage() {
  const member = useQuery({ queryKey: ["me"], queryFn: currentMember });
  const memberId = member.data?.id ?? null;
  const attempt = useOrderAttempt(memberId);
  const cart = useQuery({ queryKey: cartQueryKey(memberId), queryFn: ({ signal }) => getCart(signal),
    enabled: memberId !== null, staleTime: 0, refetchOnMount: "always", retry: false });
  const needsLogin = member.data === null || (cart.error instanceof ApiError && cart.error.status === 401);
  const box = "rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600";
  return <><Header /><main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
    {!member.data && <Link href="/?cart=open" className="text-sm font-medium text-zinc-500 hover:text-zinc-950">← 장바구니로 돌아가기</Link>}
    <p className="mt-7 text-xs font-bold tracking-widest text-emerald-700">CHECKOUT</p>
    <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-950">주문서</h1>
    <p className="mb-8 mt-3 text-sm text-zinc-500">주문 상품과 배송지를 확인해 주세요.</p>
    {member.isPending ? <div role="status" className={box}>회원 정보를 확인하고 있습니다.</div>
      : member.isError ? <div role="alert" className={box}>회원 정보를 확인하지 못했습니다.<button onClick={() => void member.refetch()} className="ml-3 font-bold underline">다시 시도</button></div>
      : needsLogin ? <div className={box}>로그인 후 주문할 수 있습니다.<Link href="/login" className="ml-3 font-bold text-emerald-700 underline">로그인</Link></div>
      : memberId !== null && attempt ? <OrderForm key={memberId} memberId={memberId} cart={cart.data ?? { items: [], totalQuantity: 0, totalAmount: 0 }} isRefreshing={false} />
      : cart.isPending ? <div role="status" className={box}>주문 상품을 확인하고 있습니다.</div>
      : cart.isError ? <div role="alert" className={box}>장바구니를 불러오지 못했습니다.<button onClick={() => void cart.refetch()} className="ml-3 font-bold underline">다시 시도</button></div>
      : !cart.data?.items.length ? <div className={box}>장바구니가 비어 있습니다.<Link href="/" className="ml-3 font-bold text-emerald-700 underline">상품 둘러보기</Link></div>
      : memberId !== null ? <OrderForm key={memberId} memberId={memberId} cart={cart.data} isRefreshing={cart.isFetching} /> : null}
  </main></>;
}
