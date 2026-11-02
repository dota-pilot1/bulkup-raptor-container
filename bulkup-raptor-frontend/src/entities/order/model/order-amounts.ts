// 주문서의 예상 금액이다. 확정 금액은 주문 생성 시 서버가 계산한다.
export function orderAmounts(itemsTotal: number) {
  const shippingFee = itemsTotal >= 50_000 || itemsTotal === 0 ? 0 : 3_000;
  return { itemsTotal, shippingFee, totalAmount: itemsTotal + shippingFee };
}
