export const orderQueryKey = (memberId: number | null, orderId: number) =>
  ["orders", memberId, orderId] as const;

export const orderListKey = (memberId: number | null, page = 0) =>
  ["orders", memberId, "list", page] as const;
