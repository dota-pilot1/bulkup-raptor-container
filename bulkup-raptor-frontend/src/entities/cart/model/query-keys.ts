// 회원별 장바구니 조회 결과를 구분하는 키이다.
export const cartQueryKey = (memberId: number | null) => ["cart", memberId] as const;

// 담기·수량 변경 요청의 진행 상태를 함께 확인하는 키이다. 실행 순서를 정하지는 않는다.
export const cartMutationKey = ["cart-write"] as const;

// 수량 변경의 연속 클릭은 버튼 비활성화와 훅의 검사로 차단한다.
// 아래 scope는 드로워를 닫고 담기를 누르는 등 드문 요청 겹침에 대비한 보완 설정이다.
// 두 요청이 같은 장바구니 전체를 반환하므로 응답 반영까지 하나씩 처리한다.
export const cartMutationScope = { id: "cart-write" };
