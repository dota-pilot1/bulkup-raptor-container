"use client";

import Image from "next/image";
import { useId, useRef } from "react";
import type { useImagePreview } from "@/entities/image/model/use-image-preview";
import type { Product } from "@/entities/product/model/product";
import { ProductVisual } from "@/entities/product/ui/product-visual";

type Props = { preview: ReturnType<typeof useImagePreview>; disabled: boolean; editing?: boolean; currentProduct?: Pick<Product, "name" | "imageUrl"> };

export function ProductImagePicker({ preview, disabled, editing = false, currentProduct }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const errorId = useId();
  return (
    <section aria-label="상품 이미지 선택" className="space-y-2 rounded-xl border border-zinc-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-zinc-700">{editing ? "상품 이미지 변경" : "상품 이미지 (선택)"}</p>
        <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}
          aria-describedby={preview.error ? `${hintId} ${errorId}` : hintId}
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50">
          {preview.selectedFile ? "다른 이미지 선택" : editing ? "이미지 변경" : "이미지 선택"}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="상품 이미지 파일"
        disabled={disabled} className="hidden" onChange={(event) => {
          preview.selectFile(event.currentTarget.files?.[0] ?? null);
          event.currentTarget.value = "";
        }} />
      <div className="relative h-40 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
        <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}
          aria-label="상품 이미지 다시 선택" aria-describedby={preview.error ? `${hintId} ${errorId}` : hintId}
          className="absolute inset-0 grid cursor-pointer place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 disabled:cursor-default disabled:opacity-50">
          {preview.previewUrl ? <Image src={preview.previewUrl} alt="저장 전 상품 이미지 미리보기" fill sizes="460px" unoptimized
            className="object-contain" onError={() => preview.previewUrl && preview.rejectPreview(preview.previewUrl)} />
            : currentProduct ? <ProductVisual product={currentProduct} fit="contain" sizes="460px" />
            : <span className="text-xs text-zinc-400">이미지를 선택해 주세요.</span>}
        </button>
      </div>
      {(editing || preview.selectedFile || preview.error) && <div className="flex items-center justify-between gap-2">
        {editing && <p className="text-xs text-zinc-600">{preview.selectedFile ? "새 이미지 미리보기 · 저장 시 적용됩니다." : "현재 이미지 · 새 파일로 교체할 수 있습니다."}</p>}
        {(preview.selectedFile || preview.error) && <button type="button" disabled={disabled} onClick={preview.cancelSelection}
          className="shrink-0 rounded-lg px-3 py-2 text-xs text-zinc-500 disabled:opacity-50">선택 취소</button>}
      </div>}
      <p id={hintId} className="text-xs text-zinc-500">JPG·PNG·WebP · 최대 5MiB · {editing ? "새 파일을 선택하지 않으면 기존 이미지를 유지합니다." : "이미지는 선택 항목입니다."}</p>
      {preview.selectedFile && <p role="status" className="truncate text-xs text-emerald-700" title={preview.selectedFile.name}>
        {preview.selectedFile.name} · {editing ? "저장 시 이 이미지로 변경합니다." : "저장 전 미리보기"}
      </p>}
      {preview.error && <p id={errorId} role="alert" className="text-xs text-rose-600">{preview.error}</p>}
    </section>
  );
}
