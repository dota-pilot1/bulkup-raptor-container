"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addressesKey, getAddresses } from "@/entities/delivery/api/addresses";
import { deliveryInfo, emptyDelivery } from "@/entities/delivery/model/schema";
import { ApiError } from "@/shared/api/client";
import { Dialog } from "@/shared/ui/dialog";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { CartResponse } from "@/entities/cart/model/types";
import { ProductVisual } from "@/entities/product/ui/product-visual";
import { orderAmounts } from "@/entities/order/model/order-amounts";
import { useOrderAttempt } from "../model/order-attempt-store";
import { useCreateOrder } from "../model/use-create-order";
import { orderFormSchema, type OrderForm } from "../model/order-form-schema";

const fields: { name: keyof OrderForm; label: string; autoComplete: string; maxLength: number; placeholder?: string }[] = [
  { name: "recipientName", label: "수령인", autoComplete: "shipping name", maxLength: 80 },
  { name: "phone", label: "연락처", autoComplete: "shipping tel", maxLength: 30, placeholder: "01012345678" },
  { name: "postalCode", label: "우편번호", autoComplete: "shipping postal-code", maxLength: 5, placeholder: "숫자 5자리" },
  { name: "address", label: "주소", autoComplete: "shipping address-line1", maxLength: 200 },
  { name: "addressDetail", label: "상세주소 (선택)", autoComplete: "shipping address-line2", maxLength: 200 },
];

export function OrderForm({ memberId, cart, isRefreshing = false }: { memberId: number; cart: CartResponse; isRefreshing?: boolean }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState<{ values: OrderForm; cart: CartResponse } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [chosenAddressId, setChosenAddressId] = useState<string | null>(null);
  const creation = useCreateOrder();
  const attempt = useOrderAttempt(memberId);
  const [dismissedError, setDismissedError] = useState<Error | null>(null);
  const stockInsufficient = creation.error instanceof ApiError && creation.error.code === "ORDER_STOCK_INSUFFICIENT";
  const closeStockError = () => setDismissedError(creation.error);
  const form = useForm<OrderForm>({ resolver: zodResolver(orderFormSchema),
    defaultValues: { recipientName: "", phone: "", postalCode: "", address: "", addressDetail: "" } });
  const delivery = useQuery({ queryKey: addressesKey(memberId), queryFn: ({ signal }) => getAddresses(signal), retry: false });
  const enteredDelivery = useWatch({ control: form.control });
  const selectedAddress = delivery.data?.find(address =>
    (chosenAddressId === null ? address.defaultAddress : String(address.id) === chosenAddressId) &&
    Object.entries(deliveryInfo(address)).every(([key, value]) => enteredDelivery[key as keyof OrderForm] === value),
  )?.id ?? "";
  const initializedDelivery = useRef(false);
  const { reset } = form;
  const amounts = orderAmounts(cart.totalAmount);
  const isDirty = form.formState.isDirty;
  useEffect(() => {
    if (initializedDelivery.current || !delivery.isSuccess) return;
    initializedDelivery.current = true;
    const primary = delivery.data?.find(address => address.defaultAddress);
    if (primary && !isDirty && !attempt) {
      reset(deliveryInfo(primary));
    }
  }, [delivery.isSuccess, delivery.data, isDirty, attempt, reset]);

  function requestLeave() {
    if (creation.isPending) return;
    if (attempt || isDirty) setLeaving(true);
    else router.push("/?cart=open");
  }
  async function submit() {
    if (!confirmation) return;
    const approved = confirmation;
    setConfirmation(null);
    const order = await creation.submit(approved.values, approved.cart);
    if (order) router.replace(`/orders/${order.orderId}`);
  }
  async function retry() {
    const order = await creation.retry();
    if (order) router.replace(`/orders/${order.orderId}`);
  }

  return <><button type="button" disabled={creation.isPending} onClick={requestLeave} className="mb-5 cursor-pointer text-sm font-medium text-zinc-500 hover:text-zinc-950 disabled:cursor-wait disabled:opacity-50">← 장바구니로 돌아가기</button>
  <form onSubmit={form.handleSubmit(values => setConfirmation({ values, cart }))} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
    <div className="space-y-6">
      {attempt && <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-bold text-amber-950">{creation.isPending ? "주문을 처리하고 있습니다" : "이전 주문의 결과를 확인해 주세요"}</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">{creation.isPending ? "처리가 끝날 때까지 잠시 기다려 주세요." : "주문 내용은 보관되어 있습니다. 같은 요청으로 다시 확인하면 이미 생성된 주문을 받을 수 있습니다."}</p>
        <p className="mt-3 text-sm text-amber-900">수령인 {attempt.recipientName} · {attempt.address} {attempt.addressDetail}</p>
        <p className="mt-1 text-sm font-bold text-amber-950">확인 금액 {attempt.expectedTotalAmount.toLocaleString()}원</p>
      </section>}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-bold text-zinc-950">주문 상품 <span className="ml-1 text-sm text-emerald-700">{cart.items.length}종</span></h2>
        {cart.items.length === 0 ? <p className="mt-4 text-sm text-zinc-500">장바구니가 비어 있습니다. 이전 요청의 주문 결과를 먼저 확인해 주세요.</p>
          : <div className="mt-3 divide-y divide-zinc-100">{cart.items.map(item => <div key={item.id} className="flex items-center gap-4 py-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-50"><ProductVisual product={item.product} compact sizes="64px" /></div>
            <div className="min-w-0 flex-1"><p className="font-semibold text-zinc-900">{item.product.name}</p><p className="mt-1 text-sm text-zinc-500">{item.quantity}개 · 개당 {item.product.price.toLocaleString()}원</p></div>
            <p className="text-sm font-bold text-zinc-900">{item.lineTotal.toLocaleString()}원</p>
          </div>)}</div>}
      </section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2 className="text-lg font-bold text-zinc-950">배송지</h2>
          {!!delivery.data?.length && <div className="w-full sm:w-64 sm:shrink-0">
            <label htmlFor="order-address-choice" className="sr-only">배송지 선택</label>
            <select id="order-address-choice" value={selectedAddress} disabled={creation.isPending || isRefreshing || !!attempt}
              onChange={event => {
                const id = event.target.value;
                setChosenAddressId(id);
                initializedDelivery.current = true;
                const address = delivery.data?.find(value => String(value.id) === id);
                reset(address ? deliveryInfo(address) : { ...emptyDelivery });
              }} className="h-10 w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">
              <option value="">직접 입력</option>
              {delivery.data.map(address => <option key={address.id} value={String(address.id)}>{address.defaultAddress ? "[기본] " : ""}{address.label} · {address.recipientName}</option>)}
            </select>
          </div>}
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-500">{delivery.isPending ? "기본 배송지를 확인하고 있어요. 직접 입력할 수도 있어요." : delivery.isError ? "기본 배송지를 불러오지 못했어요. 직접 입력해 주세요." : delivery.data?.length ? "기본 배송지가 수령지로 자동 선택돼요. 다른 배송지를 선택하거나 직접 수정할 수 있고, 수정한 내용은 이번 주문에만 적용돼요." : "이번 주문을 받을 수령지를 입력해 주세요."}</p>
        <fieldset disabled={creation.isPending || isRefreshing || !!attempt} className="mt-5 grid gap-4 sm:grid-cols-2">
          {fields.map(field => <div key={field.name} className={field.name === "address" || field.name === "addressDetail" ? "sm:col-span-2" : ""}>
            <label htmlFor={`order-${field.name}`} className="mb-1.5 block text-sm font-semibold text-zinc-700">{field.label}</label>
            <input id={`order-${field.name}`} {...form.register(field.name)} autoComplete={field.autoComplete}
              maxLength={field.maxLength} placeholder={field.placeholder} type={field.name === "phone" ? "tel" : "text"}
              inputMode={field.name === "postalCode" ? "numeric" : undefined}
              aria-invalid={!!form.formState.errors[field.name]} aria-describedby={form.formState.errors[field.name] ? `error-${field.name}` : undefined}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-50 disabled:text-zinc-400" />
            {form.formState.errors[field.name] && <p id={`error-${field.name}`} role="alert" className="mt-1 text-xs text-red-600">{form.formState.errors[field.name]?.message}</p>}
          </div>)}
        </fieldset>
      </section>
    </div>
    <aside className="rounded-2xl border border-zinc-200 bg-white p-6 lg:sticky lg:top-24">
      <h2 className="text-lg font-bold text-zinc-950">주문 금액</h2>
      {!attempt && <dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-zinc-500">상품 금액</dt><dd>{amounts.itemsTotal.toLocaleString()}원</dd></div><div className="flex justify-between"><dt className="text-zinc-500">예상 배송비</dt><dd>{amounts.shippingFee === 0 ? "무료" : `${amounts.shippingFee.toLocaleString()}원`}</dd></div></dl>}
      <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4"><span className="text-sm font-bold">{attempt ? "이전 요청 금액" : "총 예상 금액"}</span><strong className="text-xl font-black text-emerald-700">{(attempt?.expectedTotalAmount ?? amounts.totalAmount).toLocaleString()}원</strong></div>
      <p className="mt-4 text-xs leading-5 text-zinc-500">주문 생성 시 가격과 배송비, 재고를 확인합니다. 결제 전에는 품절될 수 있습니다.</p>
      {attempt ? <button type="button" disabled={creation.isPending} onClick={() => void retry()} className="mt-5 h-12 w-full cursor-pointer rounded-xl bg-zinc-950 text-sm font-bold text-white hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-50">{creation.isPending ? "주문 생성 중" : "같은 주문 요청으로 결과 확인"}</button>
        : <button type="submit" disabled={creation.isPending || isRefreshing || cart.items.length === 0} className="mt-5 h-12 w-full cursor-pointer rounded-xl bg-emerald-700 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{creation.isPending ? "주문 생성 중" : isRefreshing ? "상품 확인 중" : "주문 생성"}</button>}
      <button type="button" disabled={creation.isPending} onClick={requestLeave} className="mt-3 h-11 w-full cursor-pointer rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-50">{attempt ? "장바구니로 돌아가기" : "주문 취소하고 돌아가기"}</button>
    </aside>
  </form>
  <Dialog isOpen={stockInsufficient && !creation.isPending && dismissedError !== creation.error}
    title="상품 재고가 부족합니다" onClose={closeStockError}
    footer={<button type="button" onClick={closeStockError}
      className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">확인</button>}>
    <p role="alert" className="text-sm leading-relaxed text-zinc-600">주문 상품 중 구매 가능한 재고가 부족한 상품이 있어 주문을 생성하지 못했습니다. 장바구니에서 상품과 수량을 확인해 주세요.</p>
  </Dialog>
  <ConfirmDialog isOpen={confirmation !== null} title="이 내용으로 주문할까요?" description="상품과 배송지를 마지막으로 확인해 주세요. 결제는 진행되지 않습니다."
    confirmLabel="확인하고 주문 생성" cancelLabel="계속 수정" isPending={creation.isPending}
    onClose={() => setConfirmation(null)} onConfirm={() => void submit()}>
    {confirmation && <div className="space-y-4 text-sm text-zinc-700">
      <p>상품 <strong>{confirmation.cart.items.length}종 · {confirmation.cart.totalQuantity}개</strong></p>
      <div className="rounded-xl bg-zinc-50 p-4"><p className="font-semibold">{confirmation.values.recipientName} · {confirmation.values.phone}</p><p className="mt-2">({confirmation.values.postalCode}) {confirmation.values.address} {confirmation.values.addressDetail}</p></div>
      <div className="flex justify-between border-t border-zinc-100 pt-4"><span>총 주문 금액</span><strong className="text-lg text-emerald-700">{orderAmounts(confirmation.cart.totalAmount).totalAmount.toLocaleString()}원</strong></div>
    </div>}
  </ConfirmDialog>
  <ConfirmDialog isOpen={leaving} title={attempt ? "주문 결과를 나중에 확인할까요?" : "주문 작성을 그만둘까요?"}
    description={attempt ? "이전 요청은 보관됩니다. 돌아가도 이미 전송한 주문이 취소되지는 않습니다." : "입력한 배송지는 저장되지 않습니다. 장바구니 상품은 그대로 유지됩니다."}
    confirmLabel="장바구니로 돌아가기" cancelLabel="주문서에 머무르기" isPending={creation.isPending}
    onClose={() => setLeaving(false)} onConfirm={() => router.push("/?cart=open")}><span className="sr-only">장바구니 복귀 확인</span></ConfirmDialog>
  </>;
}
