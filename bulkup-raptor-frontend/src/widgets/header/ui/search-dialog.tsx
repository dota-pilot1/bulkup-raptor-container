"use client";

import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/lib/api";
import { productVisualClass } from "@/entities/product/model/product";
import { useCartStore } from "@/store/cart-store";
import { SearchDialog as CommonSearchDialog, type SearchDialogItem } from "@/components/ui/search-dialog";

type SearchDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const addItem = useCartStore((state) => state.addItem);

  const searchItems: SearchDialogItem[] = products.map((product) => ({
    id: product.id,
    title: product.name,
    description: product.description,
    category: product.categoryLabel,
    price: product.price,
    visual: product.visual,
    visualClass: productVisualClass[product.category] ?? "bg-zinc-100",
    actionLabel: "+ 담기",
    actionDoneLabel: "✓ 담김",
    onAction: (item) => {
      addItem({
        productId: Number(item.id),
        name: item.title,
        price: item.price ?? 0,
        visual: typeof item.visual === "string" ? item.visual : undefined,
        category: item.category,
        quantity: 1,
      });
    },
  }));

  const recommendItems = products.slice(0, 3).map((product) => ({
    id: product.id,
    title: product.name,
    price: product.price,
    visual: product.visual,
  }));

  return (
    <CommonSearchDialog
      isOpen={isOpen}
      onClose={onClose}
      placeholder="상품명, 카테고리를 입력하고 Enter를 누르세요"
      items={searchItems}
      recommendTags={["보충제", "간식", "운동용품", "스타터 세트", "단백질", "에너지"]}
      recommendItems={recommendItems}
      emptyMessage="다른 검색어로 다시 시도하거나 추천 키워드를 눌러보세요."
      footerHint="Enter로 검색하고 바로 장바구니에 담을 수 있어요"
    />
  );
}
