"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/entities/product/ui/product-card";
import { listProducts, currentMember } from "@/lib/api";
import { canAccessAdmin } from "@/entities/session";
import { catalogNav, categoryFromQuery, categoryHref, productCategories } from "@/entities/product/model/product";

type SortOption = "RECOMMENDED" | "PRICE_ASC" | "PRICE_DESC" | "NAME";

export function ProductSection() {
  const member = useQuery({ queryKey: ["me"], queryFn: currentMember });
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const selectedCategory = categoryFromQuery(useSearchParams().get("category"));
  const [keywordInput, setKeywordInput] = useState("");
  const [submittedKeyword, setSubmittedKeyword] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("RECOMMENDED");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedKeyword(keywordInput.trim());
  };

  const handleReset = () => {
    setKeywordInput("");
    setSubmittedKeyword("");
    setSortOption("RECOMMENDED");
  };

  const allProducts = products.data ?? [];
  const query = submittedKeyword.toLowerCase();

  const filteredProducts = allProducts
    .filter((product) => {
      // 1. 카테고리 필터
      if (selectedCategory !== "ALL" && product.category !== selectedCategory) {
        return false;
      }
      // 2. 검색어 필터 (제출된 키워드 기준)
      if (query) {
        const nameMatch = product.name.toLowerCase().includes(query);
        const descMatch = product.description?.toLowerCase().includes(query);
        const catMatch = product.categoryLabel.toLowerCase().includes(query);
        if (!nameMatch && !descMatch && !catMatch) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOption === "PRICE_ASC") return a.price - b.price;
      if (sortOption === "PRICE_DESC") return b.price - a.price;
      if (sortOption === "NAME") return a.name.localeCompare(b.name, "ko");
      return 0; // RECOMMENDED
    });

  const isFiltered = Boolean(submittedKeyword) || sortOption !== "RECOMMENDED";
  const selectedLabel = selectedCategory === "ALL"
    ? "추천 상품 목록"
    : productCategories.find((category) => category.value === selectedCategory)?.label ?? "추천 상품 목록";
  const categoryCounts = new Map(catalogNav.map((category) => [
    category.value,
    category.value === "ALL" ? allProducts.length : allProducts.filter((product) => product.category === category.value).length,
  ]));

  return (
    <section id="products" className="mt-20 scroll-mt-28">
      {/* 타이틀 및 상단 헤더 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-emerald-700">CURATED FOR YOU</p>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-zinc-950">
              {submittedKeyword ? "상품 검색 결과" : selectedLabel}
            </h2>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-600">
              총 {filteredProducts.length}개
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {(isFiltered || selectedCategory !== "ALL") && (
            <a
              href={categoryHref("ALL")}
              onClick={handleReset}
              className="text-xs font-semibold text-zinc-500 hover:text-emerald-700 underline"
            >
              필터 초기화
            </a>
          )}
          {canAccessAdmin(member.data) && <a href="/admin" className="text-sm font-medium text-zinc-500 hover:text-zinc-950">
            상품 관리 →
          </a>}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 lg:sticky lg:top-28 lg:w-56">
          <nav aria-label="카테고리 목록" className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-xs">
            <p className="px-3 pb-1 pt-2 text-[11px] font-bold tracking-[0.14em] text-zinc-400">CATEGORY</p>
            {catalogNav.map((category) => {
              const active = selectedCategory === category.value;
              return (
                <a
                  key={category.value}
                  href={categoryHref(category.value)}
                  aria-current={active ? "page" : undefined}
                  className={`mt-1 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
                    active ? "bg-zinc-950 font-bold text-white" : "font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                  }`}
                >
                  <span>{category.label}</span>
                  <span className={`text-xs ${active ? "text-zinc-300" : "text-zinc-400"}`}>{categoryCounts.get(category.value) ?? 0}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64" noValidate>
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) {
                    e.preventDefault();
                    setSubmittedKeyword(keywordInput.trim());
                  }
                }}
                placeholder="상품명 검색 (Enter)"
                className="h-9 w-full rounded-full border border-zinc-200 bg-zinc-50/60 pl-8 pr-16 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
              />
              <button
                type="submit"
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-zinc-800 cursor-pointer"
              >
                검색
              </button>
            </form>

            {/* 정렬 셀렉트 */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="h-9 rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 outline-none transition hover:border-zinc-300 focus:border-emerald-600 cursor-pointer"
            >
              <option value="RECOMMENDED">추천순</option>
              <option value="PRICE_ASC">낮은 가격순</option>
              <option value="PRICE_DESC">높은 가격순</option>
              <option value="NAME">상품명순</option>
            </select>
          </div>
        </div>

        {/* 현재 적용된 검색어 안내 배지 */}
        {submittedKeyword && (
          <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            <span>검색어:</span>
            <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
              &lsquo;{submittedKeyword}&rsquo;
              <button
                type="button"
                onClick={() => {
                  setKeywordInput("");
                  setSubmittedKeyword("");
                }}
                className="text-emerald-700/60 hover:text-emerald-900 cursor-pointer"
                aria-label="검색어 지우기"
              >
                ✕
              </button>
            </span>
          </div>
        )}
      </div>

      {/* 상태별 렌더링 */}
      {products.isPending && <p className="mt-7 text-sm text-zinc-500">상품을 불러오는 중입니다.</p>}
      {products.isError && <p className="mt-7 text-sm text-red-600">상품 목록을 불러오지 못했습니다. 백엔드가 켜져 있는지 확인해 주세요.</p>}
      {products.data && products.data.length === 0 && <p className="mt-7 text-sm text-zinc-500">등록된 상품이 없습니다. 상품 관리에서 추가해 주세요.</p>}

      {products.data && products.data.length > 0 && filteredProducts.length === 0 && (
        <div className="mt-12 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-12 text-center">
          <p className="text-sm font-semibold text-zinc-700">일치하는 상품을 찾을 수 없습니다.</p>
          <p className="mt-1 text-xs text-zinc-400">검색어를 변경하거나 다른 카테고리를 선택해 보세요.</p>
          <a
            href={categoryHref("ALL")}
            onClick={handleReset}
            className="mt-4 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-800"
          >
            전체 상품 보기
          </a>
        </div>
      )}

      {/* 상품 그리드 */}
      {filteredProducts.length > 0 && (
        <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3 sm:gap-6">
          {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}
        </div>
      </div>
    </section>
  );
}


