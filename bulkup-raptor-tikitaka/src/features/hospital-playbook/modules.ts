type BulkupDomain =
  | "SYSTEM" | "DOMAIN" | "API_RULES" | "APP_STRUCTURE" | "ORM_DATA_ACCESS"
  | "AUTH_LOGIN" | "AUTH_SIGNIN" | "AUTH_SIGNUP" | "AUTH_ROLE" | "AUTH_TOKEN" | "AUTH_POLICY"
  | "MENU" | "CATEGORY" | "PRODUCT_MODEL" | "DATABASE"
  | "ADMIN_LAYOUT" | "ADMIN_PRODUCT" | "ADMIN_INVENTORY" | "ADMIN_ORDER" | "ADMIN_MEMBER"
  | "PRODUCT_PAGE" | "SEARCH_FILTER" | "CART" | "SEO_CONTENT"
  | "ORDER_STATUS" | "PAYMENT" | "SHIPPING" | "REFUND" | "STOCK_FLOW"
  | "TEST" | "AUTH_TEST" | "INCIDENT" | "REVIEW_RETRO"
  | "LOCAL_ENV" | "CICD" | "DEPLOY" | "OBSERVABILITY" | "BACKUP";

type PlaybookModule = { domain: BulkupDomain; title: string; initialCategoryId?: number; initialTopicId?: number; initialTopicTitle?: string };

export const playbookModules: Record<string, PlaybookModule> = {
  "시스템 구성": { domain: "SYSTEM", title: "시스템 구성" }, "도메인 설계": { domain: "DOMAIN", title: "도메인 설계" }, "API 규칙": { domain: "API_RULES", title: "API 규칙" }, "백엔드·프론트 구조": { domain: "APP_STRUCTURE", title: "백엔드·프론트 구조" },
  "JPA 기본": { domain: "ORM_DATA_ACCESS", title: "JPA 기본" },
  "스프링 시큐리티": { domain: "AUTH_LOGIN", title: "스프링 시큐리티" },
  "회원가입": { domain: "AUTH_SIGNUP", title: "회원가입" }, "로그인·로그아웃": { domain: "AUTH_SIGNIN", title: "로그인·로그아웃" }, "권한·역할": { domain: "AUTH_ROLE", title: "권한·역할" }, "세션·토큰": { domain: "AUTH_TOKEN", title: "세션·토큰" },
  "메뉴 관리": { domain: "MENU", title: "메뉴 관리" }, "카테고리": { domain: "CATEGORY", title: "카테고리" }, "상품 데이터 모델": { domain: "PRODUCT_MODEL", title: "상품 데이터 모델" }, "PostgreSQL·마이그레이션": { domain: "DATABASE", title: "PostgreSQL·마이그레이션" },
  "관리자 레이아웃": { domain: "ADMIN_LAYOUT", title: "관리자 레이아웃" }, "상품 관리": { domain: "ADMIN_PRODUCT", title: "상품 관리" }, "재고 관리": { domain: "ADMIN_INVENTORY", title: "재고 관리" }, "주문 관리": { domain: "ADMIN_ORDER", title: "주문 관리" }, "회원 관리": { domain: "ADMIN_MEMBER", title: "회원 관리" },
  "상품 목록·상세": { domain: "PRODUCT_PAGE", title: "상품 목록·상세" }, "검색·필터": { domain: "SEARCH_FILTER", title: "검색·필터" }, "장바구니": { domain: "CART", title: "장바구니" }, "SEO·콘텐츠": { domain: "SEO_CONTENT", title: "SEO·콘텐츠" },
  "주문 생성·상태": { domain: "ORDER_STATUS", title: "주문 생성·상태" }, "결제 승인·실패·취소": { domain: "PAYMENT", title: "결제 승인·실패·취소" }, "배송·주문 조회": { domain: "SHIPPING", title: "배송·주문 조회" }, "환불·부분 환불": { domain: "REFUND", title: "환불·부분 환불" }, "재고 차감·복구": { domain: "STOCK_FLOW", title: "재고 차감·복구" },
  "단위·API 테스트": { domain: "TEST", title: "단위·API 테스트" }, "화면·권한 테스트": { domain: "AUTH_TEST", title: "화면·권한 테스트" }, "장애 시나리오": { domain: "INCIDENT", title: "장애 시나리오" }, "코드 리뷰·회고": { domain: "REVIEW_RETRO", title: "코드 리뷰·회고" },
  "로컬 개발 환경": { domain: "LOCAL_ENV", title: "로컬 개발 환경" }, "Docker·CI/CD": { domain: "CICD", title: "Docker·CI/CD" }, "배포": { domain: "DEPLOY", title: "배포" }, "모니터링·로그": { domain: "OBSERVABILITY", title: "모니터링·로그" }, "백업·복구": { domain: "BACKUP", title: "백업·복구" },
};

export function playbookModuleLabelForDomain(domain: string) {
  return Object.entries(playbookModules).find(([, module]) => module.domain === domain)?.[0] ?? null;
}
