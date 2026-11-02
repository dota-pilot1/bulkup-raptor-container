import type { Product } from "@/entities/product/model/product";

export type CartItemResponse = {
  id: number;
  product: Product;
  quantity: number;
  lineTotal: number;
};

export type CartResponse = {
  items: CartItemResponse[];
  totalQuantity: number;
  totalAmount: number;
};
