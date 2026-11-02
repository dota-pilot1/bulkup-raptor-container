import type { ReactNode } from "react";
import type { OrderResponse } from "../model/order-types";

type OrderDetailsProps = {
  order: OrderResponse;
  // 결제 기능은 페이지에서 전달한다. 이 컴포넌트는 features 계층을 직접 가져오지 않는다.
  paymentAction?: ReactNode;
};

export function OrderDetails({ order, paymentAction }: OrderDetailsProps) {
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950">
            주문 상세
          </h1>
          <span className="text-sm tabular-nums text-zinc-400">
            <span className="sr-only">주문 번호 </span>#{order.orderId}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          {order.status === "PAID" ? "결제 완료" : "주문 접수 · 결제 전"}
        </span>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* 현재 상품 정보가 아닌 주문 생성 당시 저장된 이름과 가격을 표시한다. */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-lg font-bold">주문 상품</h2>
            <div className="mt-3 divide-y divide-zinc-100">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between gap-4 py-4">
                  <div>
                    <p className="font-semibold text-zinc-900">{item.productName}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {item.quantity}개 · 개당 {item.unitPrice.toLocaleString()}원
                    </p>
                  </div>
                  <strong className="text-sm">
                    {item.lineTotal.toLocaleString()}원
                  </strong>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-lg font-bold">배송지</h2>
            <p className="mt-4 font-semibold">
              {order.delivery.recipientName} · {order.delivery.phone}
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              ({order.delivery.postalCode}) {order.delivery.address}{" "}
              {order.delivery.addressDetail}
            </p>
          </section>
        </div>

        <aside className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-bold">확정 주문 금액</h2>
          {/* 금액은 다시 계산하지 않고 서버에 저장된 주문 금액을 표시한다. */}
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">상품 금액</dt>
              <dd>{order.itemsTotal.toLocaleString()}원</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">배송비</dt>
              <dd>
                {order.shippingFee === 0
                  ? "무료"
                  : `${order.shippingFee.toLocaleString()}원`}
              </dd>
            </div>
            <div className="flex justify-between border-t border-zinc-100 pt-4">
              <dt className="font-bold">총 주문 금액</dt>
              <dd className="text-xl font-black text-emerald-700">
                {order.totalAmount.toLocaleString()}원
              </dd>
            </div>
          </dl>

          {/* 페이지가 전달한 결제 버튼을 금액 아래에 배치한다. */}
          {paymentAction}
        </aside>
      </div>
    </div>
  );
}
