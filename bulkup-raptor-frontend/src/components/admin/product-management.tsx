"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminNavigation } from "./admin-navigation";
import { productCategories, type Product, type ProductInput } from "@/entities/product/model/product";
import { ProductImagePreview } from "@/entities/product/ui/product-image-preview";
import { useImagePreview } from "@/entities/image/model/use-image-preview";
import { canAccessAdmin, hasPermission } from "@/entities/session";
import { currentMember, deleteProduct, listProducts } from "@/lib/api";
import { useSaveProduct } from "@/features/product-registration/model/use-save-product";
import { ProductEditorForm } from "./product-editor-form";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// 기존 API의 필수 visual 필드에만 기본값을 전달한다. 화면에는 표시하지 않는다.
const emptyForm: ProductInput = { name: "", description: "", price: 0, category: "SUPPLEMENT", badge: "", visual: "📦" };
const inputClass = "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 disabled:bg-zinc-50";

export function ProductManagement() {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["me"], queryFn: currentMember, refetchInterval: 15_000, refetchOnWindowFocus: true });
  const canView = canAccessAdmin(session.data);
  const canManage = hasPermission(session.data, "PRODUCT_MANAGE");
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts, enabled: canView });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [filters, setFilters] = useState({ search: "", category: "ALL" });
  const preview = useImagePreview();
  const editorRef = useRef<HTMLElement>(null);
  const selectedProduct = products.data?.find((product) => product.id === editingId);

  function clearForm() {
    setEditingId(null);
    setForm(emptyForm);
    preview.cancelSelection();
  }

  const saving = useSaveProduct((text) => {
    setMessage({ text });
    clearForm();
  }, (text) => setMessage({ text, isError: true }));

  const removal = useMutation({
    retry: false,
    mutationFn: deleteProduct,
    onSuccess: async (_, id) => {
      if (editingId === id) clearForm();
      setMessage({ text: "상품이 삭제되었습니다." });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => setMessage({ text: error.message, isError: true }),
  });
  const busy = saving.isPending || removal.isPending;

  function revealEditor() {
    if (window.matchMedia("(max-width: 1279px)").matches) editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function newProduct() {
    if (busy || !canManage) return;
    clearForm();
    setMessage(null);
    revealEditor();
  }

  function editProduct(product: Product) {
    if (busy || !canManage || editingId === product.id) return;
    setEditingId(product.id);
    setForm({ name: product.name, description: product.description, price: product.price, category: product.category,
      badge: product.badge ?? "", visual: product.visual });
    preview.cancelSelection();
    setMessage(null);
    revealEditor();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !canManage || preview.error) return;
    if (!form.name.trim() || !form.description.trim() || !Number.isFinite(form.price) || form.price < 1) {
      setMessage({ text: "상품명, 설명, 1원 이상의 가격을 입력해 주세요.", isError: true });
      return;
    }
    setMessage(null);
    void saving.save({ id: editingId, file: preview.selectedFile,
      input: { ...form, name: form.name.trim(), description: form.description.trim(), badge: form.badge.trim(), visual: form.visual.trim() || emptyForm.visual } });
  }

  const filtered = useMemo(() => (products.data ?? []).filter((product) =>
    (filters.category === "ALL" || product.category === filters.category) &&
    `${product.name} ${product.description}`.toLowerCase().includes(filters.search.toLowerCase()))
    .sort((a, b) => b.id - a.id), [products.data, filters]);

  if (session.isPending) return <main className="px-6 py-16 text-sm text-zinc-500">계정 확인 중입니다.</main>;
  if (!canView) return <main className="mx-auto max-w-3xl px-6 py-16">
    <h1 className="text-2xl font-bold">관리 권한이 필요해요</h1>
    <p className="mt-2 text-sm text-zinc-500">관리자 페이지 접근 권한이 없습니다.</p>
    <Link href="/" className="mt-6 inline-block text-sm font-semibold underline">상점으로 돌아가기</Link>
  </main>;

  return (
    <main className="flex w-full flex-col gap-5 px-4 py-6 sm:px-6 lg:flex-row lg:items-start">
      <AdminNavigation activeTab="products" productCount={products.data?.length} />
      <div className="min-w-0 flex-1 space-y-5">
        {!canManage && <p role="status" className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-600">조회 전용입니다. 등록·수정·삭제에는 상품 관리 권한이 필요합니다.</p>}
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
          <section aria-label="상품 목록" className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
            <div className="border-b border-zinc-100 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold text-zinc-950">상품 목록 <span className="ml-1 text-sm font-medium text-zinc-400">{filtered.length}</span></h2>
                <span className="text-xs text-zinc-400">전체 {products.data?.length ?? 0}개</span>
              </div>
              <form role="search" aria-label="상품 검색" onSubmit={(event) => {
                event.preventDefault(); setFilters({ search: search.trim(), category });
              }} className="space-y-2.5">
                <input type="search" aria-label="상품명 또는 설명 검색" placeholder="상품명 또는 설명 검색" value={search}
                  onChange={(event) => setSearch(event.target.value)} className={inputClass}
                  onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} />
                <div className="flex flex-wrap gap-2">
                  <div className="min-w-0 flex-1">
                    <Select aria-label="상품 카테고리 필터" value={category} onChange={setCategory}
                      options={[{ value: "ALL", label: "전체 카테고리" }, ...productCategories]} />
                  </div>
                  <button type="submit" className="rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white">검색</button>
                  <button type="button" onClick={() => { setSearch(""); setCategory("ALL"); setFilters({ search: "", category: "ALL" }); }}
                    className="rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-600">초기화</button>
                </div>
              </form>
            </div>
            <div className="divide-y divide-zinc-100">
              {products.isPending && <p className="p-6 text-sm text-zinc-500">상품 데이터를 불러오는 중입니다...</p>}
              {products.isError && <p role="alert" className="p-6 text-sm text-rose-600">상품 목록을 불러오지 못했습니다.</p>}
              {!products.isPending && !products.isError && !filtered.length && <p className="p-8 text-center text-sm text-zinc-500">조건에 일치하는 상품이 없습니다.</p>}
              {filtered.map((product) => <article key={product.id}
                className={`relative flex flex-wrap items-center gap-3 p-4 transition ${editingId === product.id ? "bg-emerald-50 ring-1 ring-inset ring-emerald-200" : "hover:bg-zinc-50"}`}>
                <button type="button" disabled={!canManage || busy} onClick={() => editProduct(product)}
                  aria-label={`${product.name} 선택하여 수정`} aria-pressed={editingId === product.id} aria-controls="product-editor"
                  className="absolute inset-0 cursor-pointer focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 disabled:cursor-default" />
                <ProductImagePreview product={product} compact sizes="56px"
                  className={`relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-zinc-100 ${product.imageUrl ? "z-10" : "pointer-events-none"}`} />
                <div className="pointer-events-none relative min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-emerald-700">{product.categoryLabel}</span>
                    {product.badge && <Badge size="sm">{product.badge}</Badge>}</div>
                  <h3 className="mt-1 truncate text-sm font-bold text-zinc-900">{product.name}</h3>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{product.description}</p>
                  <p className="mt-2 text-sm font-bold text-zinc-900">{product.price.toLocaleString("ko-KR")}원</p>
                </div>
                <div className="relative z-10 flex shrink-0 items-center gap-1">
                  <button type="button" disabled={!canManage || busy} onClick={() => editProduct(product)}
                    aria-label={`${product.name} 수정`} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">수정</button>
                  <button type="button" disabled={!canManage || busy} aria-label={`${product.name} 삭제`}
                    onClick={() => { if (window.confirm(`'${product.name}' 상품을 정말 삭제하시겠습니까?`)) removal.mutate(product.id); }}
                    className="rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40">삭제</button>
                </div>
              </article>)}
            </div>
          </section>

          <ProductEditorForm editingId={editingId} form={form} onChange={setForm}
            selectedProduct={selectedProduct} preview={preview} canManage={canManage} busy={busy}
            isSaving={saving.isPending} message={message} onSubmit={submit} onReset={newProduct} editorRef={editorRef} />
        </div>
      </div>
    </main>
  );
}
