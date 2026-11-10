"use client";

import type { FormEventHandler, Ref } from "react";
import { productCategories, type Product, type ProductCategory, type ProductInput } from "@/entities/product/model/product";
import type { useImagePreview } from "@/entities/image/model/use-image-preview";
import { ProductImagePicker } from "@/features/product-registration/ui/product-image-picker";
import { Select } from "@/components/ui/select";

type Props = {
  editingId: number | null;
  form: ProductInput;
  onChange: (form: ProductInput) => void;
  selectedProduct?: Product;
  preview: ReturnType<typeof useImagePreview>;
  canManage: boolean;
  busy: boolean;
  isSaving: boolean;
  message: { text: string; isError?: boolean } | null;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onReset: () => void;
  editorRef: Ref<HTMLElement>;
};

const inputClass = "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 disabled:bg-zinc-50";
const labelClass = "mb-1.5 block text-xs font-semibold text-zinc-700";

export function ProductEditorForm({ editingId, form, onChange, selectedProduct, preview, canManage, busy,
  isSaving, message, onSubmit, onReset, editorRef }: Props) {
  const stockQuantity = form.stockQuantity ?? 0;
  const quickAddBase = Number.isInteger(stockQuantity) && stockQuantity >= 0 ? stockQuantity : 0;

  return (
    <section id="product-editor" ref={editorRef} aria-label="상품 편집" className="flex min-w-0 scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)]">
      <div className="shrink-0 border-b border-zinc-100 px-5 py-4">
        <h2 className="font-bold text-zinc-950">{editingId === null ? "상품 등록" : "상품 수정"}</h2>
        <p className="mt-1 text-xs text-zinc-500">{editingId === null ? "새 상품의 정보와 이미지를 입력하세요." : `상품 #${editingId}의 정보를 수정합니다.`}</p>
      </div>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
        <fieldset disabled={!canManage || busy} className="min-h-0 min-w-0 space-y-4 p-5 xl:overflow-y-auto">
          <div><label htmlFor="product-name" className={labelClass}>상품명 <span className="text-emerald-600">*</span></label>
            <input id="product-name" value={form.name} maxLength={80} onChange={(e) => onChange({ ...form, name: e.target.value })} placeholder="예: 데일리 프로틴 쉐이크" className={inputClass} /></div>
          <div><label htmlFor="product-description" className={labelClass}>설명 <span className="text-emerald-600">*</span></label>
            <textarea id="product-description" rows={3} value={form.description} maxLength={200} onChange={(e) => onChange({ ...form, description: e.target.value })} placeholder="상품에 대한 간략한 설명" className={inputClass} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="product-price" className={labelClass}>가격 (원) <span className="text-emerald-600">*</span></label>
              <input id="product-price" type="number" min={1} step={1} value={form.price || ""} onChange={(e) => onChange({ ...form, price: Number(e.target.value) })} placeholder="28000" className={inputClass} /></div>
            <Select label="카테고리" value={form.category} onChange={(value) => onChange({ ...form, category: value as ProductCategory })} options={productCategories} />
          </div>
          {editingId === null ? (
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="product-stock" className="text-xs font-semibold text-zinc-700">초기 재고 수량 (개) <span className="text-emerald-600">*</span></label>
              <div role="group" aria-label="초기 재고 빠른 입력" className="flex flex-wrap gap-1.5">
                {[10, 30, 50].map((quantity) => (
                  <button key={quantity} type="button" aria-label={`초기 재고 ${quantity}개 추가`}
                    disabled={quickAddBase + quantity > 2_147_483_647}
                    onClick={() => onChange({ ...form, stockQuantity: quickAddBase + quantity })}
                    className="min-h-8 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-40">
                    +{quantity}
                  </button>
                ))}
                <button type="button" aria-label="초기 재고 수량 초기화" onClick={() => onChange({ ...form, stockQuantity: 0 })}
                  className="min-h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-40">
                  초기화
                </button>
              </div>
              </div>
              <input id="product-stock" type="number" min={0} max={2_147_483_647} step={1} required
                value={Number.isNaN(form.stockQuantity) ? "" : form.stockQuantity ?? 0}
                onChange={(event) => onChange({ ...form, stockQuantity: event.target.valueAsNumber })}
                aria-describedby="product-stock-help" className={inputClass} />
              <p id="product-stock-help" className="mt-1.5 text-xs text-zinc-500">등록할 재고를 0 이상 정수로 입력하세요.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3">
              <p className="text-xs font-semibold text-zinc-700">현재 재고</p>
              <p className="mt-1 text-sm font-bold text-zinc-900">{selectedProduct?.stockQuantity.toLocaleString("ko-KR") ?? "—"}개</p>
              <p className="mt-1 text-xs text-zinc-500">상품 정보를 수정해도 재고 수량은 유지됩니다.</p>
            </div>
          )}
          <div><label htmlFor="product-badge" className={labelClass}>배지 (선택)</label>
            <input id="product-badge" value={form.badge} maxLength={12} onChange={(e) => onChange({ ...form, badge: e.target.value })} placeholder="BEST, NEW, HOT 등" className={inputClass} /></div>
          <ProductImagePicker preview={preview} disabled={!canManage || busy} editing={editingId !== null} currentProduct={selectedProduct} />
        </fieldset>
        <footer className="sticky bottom-0 z-10 shrink-0 space-y-3 border-t border-zinc-100 bg-white p-4">
          {message && <p role={message.isError ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-xs leading-5 ${message.isError ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`}>{message.text}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={!canManage || busy || !!preview.error}
              className="min-h-11 flex-1 rounded-xl bg-zinc-950 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {isSaving ? "저장 중..." : editingId === null ? "상품 등록하기" : "수정 내용 저장"}
            </button>
            <button type="button" disabled={!canManage || busy} onClick={onReset}
              className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 disabled:opacity-40">{editingId === null ? "초기화" : "수정 취소"}</button>
          </div>
        </footer>
      </form>
    </section>
  );
}
