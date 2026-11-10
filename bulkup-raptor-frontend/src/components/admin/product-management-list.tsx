"use client";

import { useMemo, useState, type ReactNode } from "react";
import { productCategories, type Product } from "@/entities/product/model/product";
import { ProductImagePreview } from "@/entities/product/ui/product-image-preview";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Props = {
  title?: string;
  products: Product[];
  isPending: boolean;
  isError: boolean;
  selectedId: number | null;
  onSelect: (product: Product) => void;
  selectionLabel: string;
  controls: string;
  selectionDisabled?: boolean;
  showPrice?: boolean;
  showStockNeedFilter?: boolean;
  renderActions?: (product: Product) => ReactNode;
  onRetry: () => void;
};

export type StockNeed = "ALL" | "OUT" | "LOW";

export function matchesStockNeed(product: Pick<Product, "availableQuantity">, need: StockNeed) {
  if (need === "OUT") return product.availableQuantity <= 0;
  if (need === "LOW") return product.availableQuantity >= 1 && product.availableQuantity <= 5;
  return true;
}

export function ProductManagementList({ title = "상품 목록", products, isPending, isError, selectedId, onSelect,
  selectionLabel, controls, selectionDisabled = false, showPrice = true, showStockNeedFilter = false, renderActions, onRetry }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [stockNeed, setStockNeed] = useState<StockNeed>("ALL");
  const [filters, setFilters] = useState({ search: "", category: "ALL" });
  const filtered = useMemo(() => products.filter((product) =>
    (filters.category === "ALL" || product.category === filters.category) &&
    (!showStockNeedFilter || matchesStockNeed(product, stockNeed)) &&
    `${product.name} ${product.description}`.toLowerCase().includes(filters.search.toLowerCase()))
    .sort((a, b) => b.id - a.id), [products, filters, showStockNeedFilter, stockNeed]);

  return <section aria-label={title} className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
    <div className="border-b border-zinc-100 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-zinc-950">{title} <span className="ml-1 text-sm font-medium text-zinc-400">{filtered.length}</span></h2>
        <span className="text-xs text-zinc-400">전체 {products.length}개</span>
      </div>
      <form role="search" aria-label="상품 검색" onSubmit={(event) => {
        event.preventDefault(); setFilters({ search: search.trim(), category });
      }} className="space-y-2.5">
        <input type="search" aria-label="상품명 또는 설명 검색" placeholder="상품명 또는 설명 검색" value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
          onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} />
        <div className="flex flex-wrap gap-2">
          <div className="min-w-0 flex-1">
            <Select aria-label="상품 카테고리 필터" value={category} onChange={setCategory}
              options={[{ value: "ALL", label: "전체 카테고리" }, ...productCategories]} />
          </div>
          <button type="submit" className="rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white">검색</button>
          <button type="button" onClick={() => { setSearch(""); setCategory("ALL"); setStockNeed("ALL"); setFilters({ search: "", category: "ALL" }); }}
            className="rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-600">초기화</button>
        </div>
        {showStockNeedFilter && <div role="group" aria-label="채워야 할 재고" className="flex flex-wrap gap-2">
          {([["ALL", "전체"], ["OUT", "품절"], ["LOW", "부족"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={stockNeed === value}
            onClick={() => setStockNeed(value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${stockNeed === value ? "bg-zinc-950 text-white" : "border border-zinc-200 text-zinc-600"}`}>{label}</button>)}
        </div>}
      </form>
    </div>
    <div className="divide-y divide-zinc-100">
      {isPending && <p role="status" className="p-6 text-sm text-zinc-500">상품 데이터를 불러오는 중입니다...</p>}
      {isError && <p role="alert" className="p-6 text-sm text-rose-600">상품 목록을 불러오지 못했습니다. <button type="button" onClick={onRetry} className="underline">다시 시도</button></p>}
      {!isPending && !isError && !filtered.length && <p className="p-8 text-center text-sm text-zinc-500">조건에 일치하는 상품이 없습니다.</p>}
      {!isError && filtered.map((product) => <article key={product.id}
        className={`relative flex flex-wrap items-center gap-3 p-4 transition ${selectedId === product.id ? "bg-emerald-50 ring-1 ring-inset ring-emerald-200" : "hover:bg-zinc-50"}`}>
        <button type="button" disabled={selectionDisabled} onClick={() => onSelect(product)}
          aria-label={`${product.name} ${selectionLabel}`} aria-pressed={selectedId === product.id} aria-controls={controls}
          className="absolute inset-0 cursor-pointer focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 disabled:cursor-default" />
        <ProductImagePreview product={product} compact sizes="56px"
          className={`relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-zinc-100 ${product.imageUrl ? "z-10" : "pointer-events-none"}`} />
        <div className="pointer-events-none relative min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-emerald-700">{product.categoryLabel}</span>
            {product.badge && <Badge size="sm">{product.badge}</Badge>}
            {product.forSale === false && <Badge size="sm">판매 중지</Badge>}</div>
          <h3 className="mt-1 truncate text-sm font-bold text-zinc-900">{product.name}</h3>
          <p className="mt-0.5 truncate text-xs text-zinc-500">{product.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {showPrice && <p className="text-sm font-bold text-zinc-900">{product.price.toLocaleString("ko-KR")}원</p>}
            <span className={showPrice ? "text-xs font-medium text-zinc-500" : "text-sm font-bold text-zinc-900"}>{showStockNeedFilter ? "구매 가능" : "재고"} {(showStockNeedFilter ? product.availableQuantity : product.stockQuantity).toLocaleString("ko-KR")}개</span>
          </div>
        </div>
        {renderActions && <div className="relative z-10 flex shrink-0 items-center gap-2">{renderActions(product)}</div>}
      </article>)}
    </div>
  </section>;
}
