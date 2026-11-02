"use client";

import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/lib/api";
import { ProductVisual } from "@/entities/product/ui/product-visual";
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
    visual: <span className="relative block h-full w-full overflow-hidden rounded-lg"><ProductVisual product={product} compact sizes="44px" /></span>,
    visualClass: "bg-zinc-50",
    actionLabel: "+ 담기",
    actionDoneLabel: "✓ 담김",
    onAction: (item) => {
      addItem({
        productId: Number(item.id),
        name: item.title,
        price: item.price ?? 0,
        imageUrl: product.imageUrl,
        category: item.category,
        quantity: 1,
      });
    },
  }));

  const recommendItems = products.slice(0, 3).map((product) => ({
    id: product.id,
    title: product.name,
    price: product.price,
    visual: <span className="relative inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-md align-middle"><ProductVisual product={product} compact sizes="32px" /></span>,
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
