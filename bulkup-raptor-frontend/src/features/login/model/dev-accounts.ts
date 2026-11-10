export const devAccounts = [
  { id: "customer", label: "주문자", email: "terecal2@daum.net", password: "password123", href: "/orders/2085" },
  { id: "driver", label: "배송 기사", email: "driver@bulkup.test", password: "driver123", href: "/admin/deliveries" },
  { id: "admin", label: "관리자", email: "terecal2@daum.net", password: "password123", href: "/admin" },
] as const;

export type DevAccount = (typeof devAccounts)[number];
