"use client";

import { useCartStore } from "@/store/cart-store";
import { productVisualClass, type Product } from "../model/product";

const formatPrice = (price: number) => `${price.toLocaleString("ko-KR")}원`;

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((state) => state.addItem);

  return (
    <article className="group">
      <div className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl ${productVisualClass[product.category]}`}>
        {product.badge && <span className="absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold tracking-wider text-zinc-700">{product.badge}</span>}
        <span className="text-7xl transition duration-300 group-hover:scale-110" role="img" aria-label={product.name}>{product.visual}</span>
        <button
          type="button"
          onClick={() =>
            addItem({
              productId: product.id,
              name: product.name,
              price: product.price,
              visual: product.visual,
              category: product.categoryLabel,
              quantity: 1,
            })
          }
          className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white text-xl text-zinc-900 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-zinc-950 hover:text-white cursor-pointer"
          aria-label={`${product.name} 장바구니에 담기`}
        >
          +
        </button>
      </div>
      <div className="mt-4">
        <p className="text-xs font-medium text-emerald-700">{product.categoryLabel}</p>
        <h3 className="mt-1 font-semibold text-zinc-950">{product.name}</h3>
        <p className="mt-1 text-sm text-zinc-500">{product.description}</p>
        <p className="mt-3 text-sm font-bold text-zinc-950">{formatPrice(product.price)}</p>
      </div>
    </article>
  );
}
