"use client";

import Image from "next/image";
import { useState } from "react";
import { ImagePlaceholder } from "@/shared/ui/image-placeholder";
import type { Product } from "../model/product";

type Props = { product: Pick<Product, "name" | "imageUrl">; compact?: boolean; sizes?: string; fit?: "cover" | "contain"; placeholderOutlined?: boolean };

export function ProductVisual({ product, compact = false, sizes = "(max-width: 640px) 100vw, 400px", fit = "cover", placeholderOutlined = false }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = product.imageUrl;
  if (url && url !== failedUrl) {
    return <Image src={url} alt={product.name} fill sizes={sizes} unoptimized className={fit === "contain" ? "object-contain" : "object-cover"}
      onError={() => setFailedUrl(url)} />;
  }
  return <ImagePlaceholder compact={compact} outlined={placeholderOutlined} label={`${product.name} 이미지 준비 중`} />;
}
