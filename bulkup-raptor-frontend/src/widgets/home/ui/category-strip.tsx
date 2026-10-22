"use client";

import { useSearchParams } from "next/navigation";
import { categoryFromQuery, categoryHref, type ProductCategory } from "@/entities/product/model/product";

const categories: { emoji: string; title: string; description: string; value: ProductCategory }[] = [
  { emoji: "🥤", title: "보충제", description: "매일 채우는 기본 루틴", value: "SUPPLEMENT" },
  { emoji: "🍪", title: "건강 간식", description: "가볍게 즐기는 에너지", value: "SNACK" },
  { emoji: "🏋️", title: "운동용품", description: "움직임을 더 편하게", value: "GEAR" },
  { emoji: "🎁", title: "스타터 세트", description: "처음이라면 여기부터", value: "STARTER_SET" },
];

export function CategoryStrip() {
  const selected = categoryFromQuery(useSearchParams().get("category"));

  return (
    <section className="mt-16">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-emerald-700">SHOP BY CATEGORY</p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-950">필요한 루틴을 찾아보세요</h2>
        </div>
        <a href={categoryHref("ALL")} className="text-sm font-medium text-zinc-500 hover:text-zinc-950">전체 보기 →</a>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => {
          const active = selected === category.value;
          return (
            <a
              key={category.value}
              href={categoryHref(category.value)}
              aria-current={active ? "true" : undefined}
              className={`rounded-2xl border bg-white p-5 transition hover:-translate-y-1 hover:shadow-sm ${
                active ? "border-emerald-400 shadow-sm" : "border-zinc-200 hover:border-emerald-300"
              }`}
            >
              <span className="text-3xl">{category.emoji}</span>
              <h3 className="mt-5 font-semibold text-zinc-950">{category.title}</h3>
              <p className="mt-1 text-xs text-zinc-500">{category.description}</p>
            </a>
          );
        })}
      </div>
    </section>
  );
}
