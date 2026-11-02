"use client";

import { useState } from "react";
import { Dialog } from "@/shared/ui/dialog";
import type { Product } from "../model/product";
import { ProductVisual } from "./product-visual";

type Props = {
  product: Pick<Product, "name" | "imageUrl">;
  className: string;
  compact?: boolean;
  sizes?: string;
};

export function ProductImagePreview({ product, className, compact, sizes }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (!product.imageUrl) {
    return <div className={className}><ProductVisual product={product} compact={compact} sizes={sizes} /></div>;
  }

  return <>
    <button type="button" onClick={() => setIsOpen(true)} aria-label={`${product.name} 이미지 확대`}
      aria-haspopup="dialog" className={`${className} cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600`}>
      <ProductVisual product={product} compact={compact} sizes={sizes} />
    </button>
    <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)} title={product.name} maxWidthClassName="max-w-4xl">
      <div className="relative h-[min(65dvh,720px)] overflow-hidden rounded-xl bg-zinc-50">
        <ProductVisual product={product} fit="contain" sizes="(max-width: 896px) 100vw, 848px" />
      </div>
    </Dialog>
  </>;
}
