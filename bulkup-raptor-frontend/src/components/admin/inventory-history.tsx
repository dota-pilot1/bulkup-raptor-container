"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStockAdjustments } from "@/entities/inventory/api/get-stock-adjustments";
import { ApiError } from "@/shared/api/client";

const PAGE_SIZE = 10;
const formatQuantity = (value: number) => value.toLocaleString("ko-KR");
const formatDate = (value: string) => new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
const buttonClass = "rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 disabled:opacity-40";

// 상품 또는 계정이 바뀌면 부모의 key로 다시 마운트해 첫 페이지부터 조회한다.
export function InventoryHistory({ productId, memberId }: { productId: number; memberId: number }) {
  const [page, setPage] = useState(0);
  const history = useQuery({
    queryKey: ["inventory-history", memberId, productId, page, PAGE_SIZE],
    queryFn: ({ signal }) => getStockAdjustments(productId, page, PAGE_SIZE, signal),
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  const data = !history.isError && !history.isFetching ? history.data : undefined;
  const errorStatus = history.error instanceof ApiError ? history.error.status : undefined;

  function refresh() {
    if (page === 0) void history.refetch();
    else setPage(0);
  }

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 p-5">
      <div><h2 className="font-bold text-zinc-950">재고 변경 이력</h2>
        <p className="mt-1 text-xs text-zinc-500">상품 #{productId} · 최신순 · 한국 시간</p></div>
      <button type="button" disabled={history.isFetching} onClick={refresh} className={buttonClass}>이력 새로고침</button>
    </div>
    <div className="p-5" aria-busy={history.isFetching}>
      {(history.isPending || history.isFetching) && <p role="status" className="py-5 text-sm text-zinc-500">재고 변경 이력을 불러오는 중입니다.</p>}
      {history.isError && !history.isFetching && <div role="alert" className="space-y-3 py-3">
        <p className="text-sm text-rose-700">{errorStatus === 404 ? "상품을 찾을 수 없습니다. 삭제되었을 수 있습니다."
          : errorStatus === 401 ? "로그인이 필요합니다. 다시 로그인해 주세요."
          : errorStatus === 403 ? "재고 변경 이력을 조회할 권한이 없습니다."
          : "재고 변경 이력을 불러오지 못했습니다."}</p>
        <button type="button" onClick={() => void history.refetch()} className={buttonClass}>다시 시도</button>
      </div>}
      {data && <>
        <p className="mb-4 text-xs text-zinc-500">전체 {formatQuantity(data.totalElements)}건</p>
        {data.content.length === 0
          ? <p className="py-5 text-sm text-zinc-500">{data.totalElements === 0 ? "아직 재고 변경 이력이 없습니다." : "이 페이지에 표시할 이력이 없습니다. 첫 페이지에서 다시 확인해 주세요."}</p>
          : <ol className="max-h-[36rem] space-y-3 overflow-y-auto" aria-label="선택 상품의 재고 변경 이력 목록">
            {data.content.map((item) => <li key={item.id} className="min-w-0 rounded-xl border border-zinc-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`text-sm font-bold ${item.type === "INCREASE" ? "text-emerald-700" : "text-rose-700"}`}>
                  {item.type === "INCREASE" ? "증가" : "감소"} {item.delta > 0 ? "+" : ""}{formatQuantity(item.delta)}개
                </span>
                <time dateTime={item.createdAt} className="text-xs text-zinc-500">{formatDate(item.createdAt)}</time>
              </div>
              <dl className="mt-3 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
                <div className="min-w-0"><dt className="text-xs text-zinc-500">수정자</dt>
                  <dd className="mt-1 [overflow-wrap:anywhere]">{item.actorName} <span className="text-xs text-zinc-400">회원 #{item.actorId}</span></dd></div>
                <div><dt className="text-xs text-zinc-500">변경 전 → 변경 후</dt>
                  <dd className="mt-1 font-semibold">{formatQuantity(item.beforeQuantity)}개 → {formatQuantity(item.afterQuantity)}개</dd></div>
                <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-zinc-500">변경 사유</dt>
                  <dd className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{item.reason}</dd></div>
              </dl>
            </li>)}
          </ol>}
        {data.totalPages > 0 && <nav aria-label="재고 이력 페이지 이동" className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} className={buttonClass}>이전</button>
          <span className="text-xs text-zinc-500">{page + 1} / {data.totalPages} 페이지</span>
          <button type="button" disabled={page >= data.totalPages - 1} onClick={() => setPage((current) => current + 1)} className={buttonClass}>다음</button>
        </nav>}
      </>}
    </div>
  </>;
}
