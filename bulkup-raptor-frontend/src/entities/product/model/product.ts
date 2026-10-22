export type ProductCategory = "SUPPLEMENT" | "SNACK" | "GEAR" | "STARTER_SET";

export const productCategories: { value: ProductCategory; label: string }[] = [
  { value: "SUPPLEMENT", label: "보충제" },
  { value: "SNACK", label: "간식" },
  { value: "GEAR", label: "운동용품" },
  { value: "STARTER_SET", label: "스타터 세트" },
];

export type CategoryFilter = "ALL" | ProductCategory;

export const catalogNav: { label: string; value: CategoryFilter }[] = [
  { label: "전체 상품", value: "ALL" },
  ...productCategories,
];

export function categoryHref(category: CategoryFilter) {
  return category === "ALL" ? "/#products" : `/?category=${category}#products`;
}

export function categoryFromQuery(value: string | null): CategoryFilter {
  return productCategories.some((category) => category.value === value) ? (value as ProductCategory) : "ALL";
}

export type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  categoryLabel: string;
  badge: string | null;
  visual: string;
};

export type ProductInput = {
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  badge: string;
  visual: string;
};

export const productVisualClass: Record<ProductCategory, string> = {
  SUPPLEMENT: "bg-[#e8f3ed]",
  SNACK: "bg-[#f7eadb]",
  GEAR: "bg-[#e7eef8]",
  STARTER_SET: "bg-[#e8edf5]",
};
