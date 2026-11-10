import type { OrderFilter } from "./order-types";

export const orderQueryKey = (memberId: number | null, orderId: number) =>
  ["orders", memberId, orderId] as const;

export const orderListKey = (memberId: number | null, page = 0, status: OrderFilter = "ALL") =>
  ["orders", memberId, "list", status, page] as const;

export const orderCountsKey = (memberId: number | null) =>
  ["orders", memberId, "counts"] as const;
