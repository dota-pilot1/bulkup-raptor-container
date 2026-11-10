"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminNavigation } from "./admin-navigation";
import type { Product, ProductInput } from "@/entities/product/model/product";
import { useImagePreview } from "@/entities/image/model/use-image-preview";
import { canAccessAdmin, hasPermission } from "@/entities/session";
import { currentMember, deleteProduct, listAdminProducts, setProductSale } from "@/lib/api";
import { useSaveProduct } from "@/features/product-registration/model/use-save-product";
import { ProductEditorForm } from "./product-editor-form";
import { ProductManagementList } from "./product-management-list";

// 기존 API의 필수 visual 필드에만 기본값을 전달한다. 화면에는 표시하지 않는다.
const emptyForm: ProductInput = { name: "", description: "", price: 0, category: "SUPPLEMENT", badge: "", visual: "📦", stockQuantity: 0 };

export function ProductManagement() {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["me"], queryFn: currentMember, refetchInterval: 15_000, refetchOnWindowFocus: true });
  const canView = canAccessAdmin(session.data);
  const canManage = hasPermission(session.data, "PRODUCT_MANAGE");
  const products = useQuery({ queryKey: ["admin-products"], queryFn: listAdminProducts, enabled: canView });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);
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
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => setMessage({ text: error.message, isError: true }),
  });
  const sale = useMutation({
    retry: false,
    mutationFn: ({ id, forSale }: { id: number; forSale: boolean }) => setProductSale(id, forSale),
    onSuccess: async (product) => {
      setMessage({ text: product.forSale === false ? "판매를 중지했습니다. 재고는 그대로입니다." : "판매를 다시 시작했습니다." });
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => setMessage({ text: error.message, isError: true }),
  });
  const busy = saving.isPending || removal.isPending || sale.isPending;

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
    if (editingId === null && (!Number.isInteger(form.stockQuantity) || form.stockQuantity! < 0 || form.stockQuantity! > 2_147_483_647)) {
      setMessage({ text: "초기 재고 수량은 0 이상 2,147,483,647 이하의 정수로 입력해 주세요.", isError: true });
      return;
    }
    setMessage(null);
    void saving.save({ id: editingId, file: preview.selectedFile,
      input: { ...form, name: form.name.trim(), description: form.description.trim(), badge: form.badge.trim(), visual: form.visual.trim() || emptyForm.visual } });
  }


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
          <ProductManagementList products={products.data ?? []} isPending={products.isPending} isError={products.isError}
            selectedId={editingId} onSelect={editProduct} selectionLabel="선택하여 수정" controls="product-editor"
            selectionDisabled={!canManage || busy} onRetry={() => void products.refetch()}
            renderActions={(product) => <>
              <button type="button" disabled={!canManage || busy} onClick={() => sale.mutate({ id: product.id, forSale: product.forSale === false })}
                className="inline-flex min-h-8 items-center rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40">
                {product.forSale === false ? "판매 재개" : "판매 중지"}</button>
              <button type="button" disabled={!canManage || busy} onClick={() => editProduct(product)}
                aria-label={`${product.name} 수정`} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-40">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 5 5M4 20l4-1L21 6a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></svg>
                수정</button>
              <button type="button" disabled={!canManage || busy} aria-label={`${product.name} 삭제`}
                onClick={() => { if (window.confirm(`'${product.name}' 상품을 정말 삭제하시겠습니까?`)) removal.mutate(product.id); }}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-40">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></svg>
                삭제</button>
            </>} />

          <ProductEditorForm editingId={editingId} form={form} onChange={setForm}
            selectedProduct={selectedProduct} preview={preview} canManage={canManage} busy={busy}
            isSaving={saving.isPending} message={message} onSubmit={submit} onReset={newProduct} editorRef={editorRef} />
        </div>
      </div>
    </main>
  );
}
