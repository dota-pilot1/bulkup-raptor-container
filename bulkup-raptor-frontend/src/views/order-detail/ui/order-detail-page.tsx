"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/widgets/header/ui/header";
import { currentMember } from "@/lib/api";
import { useOrder } from "@/entities/order/model/use-order";
import { OrderDetails } from "@/entities/order/ui/order-details";
import { PreparePaymentButton } from "@/features/prepare-payment";
import { ApiError } from "@/shared/api/client";

const statusBoxClassName =
  "mt-8 rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600";
const retryButtonClassName = "ml-3 font-bold underline";

export default function OrderResultPage() {
  const params = useParams<{ orderId: string }>();

  // URL의 주문 ID가 숫자로만 구성된 양의 정수인지 확인한다.
  const orderId = /^\d+$/.test(params.orderId) ? Number(params.orderId) : NaN;
  const validId = Number.isSafeInteger(orderId) && orderId > 0;

  const member = useQuery({ queryKey: ["me"], queryFn: currentMember });
  // 훅은 항상 호출하되, 회원 또는 유효한 주문 ID가 없으면 내부에서 요청을 막는다.
  const order = useOrder(member.data?.id ?? null, orderId);

  const needsLogin =
    member.data === null ||
    (order.error instanceof ApiError && order.error.status === 401);
  const notFound =
    !validId ||
    (order.error instanceof ApiError && order.error.status === 404);

  function renderContent() {
    // 회원 상태를 먼저 확인한 뒤 주문 조회 상태에 맞는 화면을 표시한다.
    if (member.isPending) {
      return (
        <div role="status" className={statusBoxClassName}>
          회원 정보를 확인하고 있습니다.
        </div>
      );
    }

    if (member.isError) {
      return (
        <div role="alert" className={statusBoxClassName}>
          회원 정보를 확인하지 못했습니다.
          <button onClick={() => void member.refetch()} className={retryButtonClassName}>
            다시 시도
          </button>
        </div>
      );
    }

    if (needsLogin) {
      return (
        <div className={statusBoxClassName}>
          로그인 후 주문을 확인할 수 있습니다.
          <Link href="/login" className="ml-3 font-bold text-emerald-700 underline">
            로그인
          </Link>
        </div>
      );
    }

    if (notFound) {
      return (
        <div role="alert" className={statusBoxClassName}>
          주문을 찾을 수 없습니다.
        </div>
      );
    }

    if (order.isPending) {
      return (
        <div role="status" className={statusBoxClassName}>
          주문을 불러오고 있습니다.
        </div>
      );
    }

    if (order.isError) {
      return (
        <div role="alert" className={statusBoxClassName}>
          주문을 불러오지 못했습니다.
          <button onClick={() => void order.refetch()} className={retryButtonClassName}>
            다시 시도
          </button>
        </div>
      );
    }

    if (!order.data || !member.data) return null;

    // 주문 표시와 결제 기능은 페이지에서 조합한다.
    // 회원이나 주문이 바뀌면 key를 바꿔 이전 버튼의 요청 상태를 초기화한다.
    return (
      <OrderDetails
        order={order.data}
        paymentAction={
          <PreparePaymentButton
            key={`${member.data.id}:${order.data.orderId}`}
            order={order.data}
            memberId={member.data.id}
          />
        }
      />
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-950">
            ← 쇼핑 계속하기
          </Link>
          <Link
            href="/orders"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            주문 내역 보기
          </Link>
        </div>
        <div className="mt-8">{renderContent()}</div>
      </main>
    </>
  );
}
