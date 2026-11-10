export type OrderStatus = "CREATED" | "PAID" | "CANCELLED";
export type OrderFilter = "ALL" | OrderStatus | "CANCELLABLE";

export type OrderDelivery = {
  recipientName: string;
  phone: string;
  postalCode: string;
  address: string;
  addressDetail: string;
};

export type CreateOrderRequest = OrderDelivery & {
  cartItemIds: number[];
  expectedTotalAmount: number;
  requestId: string;
};

export type OrderResponse = {
  orderId: number;
  status: OrderStatus;
  cancellationPending?: boolean;
  inventoryStatus?: string;
  deliveryStatus?: "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED" | null;
  cancellationReason?: string | null;
  reservationExpiresAt?: string | null;
  items: { productId: number | null; productName: string; unitPrice: number; quantity: number; lineTotal: number }[];
  itemsTotal: number;
  shippingFee: number;
  totalAmount: number;
  delivery: OrderDelivery;
  createdAt: string;
};

export type OrderSummary = Pick<OrderResponse, "orderId" | "status" | "totalAmount" | "createdAt" | "cancellationPending" | "deliveryStatus" | "reservationExpiresAt" | "cancellationReason"> & {
  items: { productName: string; quantity: number }[];
};
export type OrderPage = { content: OrderSummary[]; page: number; totalPages: number; totalElements: number };
