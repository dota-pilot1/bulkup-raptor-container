type BulkupDomain =
  | "FRONTEND"
  | "JAVA_SYNTAX" | "SYSTEM" | "DOMAIN" | "API_RULES" | "APP_STRUCTURE" | "ORM_DATA_ACCESS" | "COMMON_LOGIC"
  | "UI_DESIGN" | "UX_DESIGN" | "COMMON_MENU" | "COMMON_ERROR" | "DDD_ARCHITECTURE" | "FSD_ARCHITECTURE" | "MAJOR_LIBRARIES"
  | "UI_HEADER" | "UI_ADMIN" | "UI_FORM_VALIDATION" | "UI_LIST_DETAIL" | "UI_COMPONENTS"
  | "ORM_MYBATIS" | "ORM_SQL"
  | "AUTH_LOGIN" | "AUTH_SIGNIN" | "AUTH_SIGNUP" | "AUTH_ROLE" | "AUTH_TOKEN" | "AUTH_POLICY"
  | "MENU" | "CATEGORY" | "PRODUCT_MODEL" | "DATABASE"
  | "ADMIN_LAYOUT" | "ADMIN_PRODUCT" | "IMAGE_UPLOAD" | "ADMIN_INVENTORY" | "ADMIN_ORDER" | "ADMIN_MEMBER"
  | "PRODUCT_PAGE" | "SEARCH_FILTER" | "CART" | "SEO_CONTENT"
  | "ORDER_STATUS" | "PAYMENT" | "SHIPPING" | "REFUND" | "STOCK_FLOW"
  | "TEST" | "AUTH_TEST" | "INCIDENT" | "REVIEW_RETRO"
  | "LOCAL_ENV" | "CICD" | "DEPLOY" | "OBSERVABILITY" | "BACKUP";

type PlaybookModule = { domain: BulkupDomain; title: string; initialCategoryId?: number; initialTopicId?: number; initialTopicTitle?: string };

export const playbookModules: Record<string, PlaybookModule> = {
  "React": { domain: "FRONTEND", title: "React" },
  "UI 디자인": { domain: "UI_DESIGN", title: "UI 디자인" },
  "UX 설계": { domain: "UX_DESIGN", title: "UX 설계" },
  "헤더": { domain: "UI_HEADER", title: "헤더" },
  "관리자": { domain: "UI_ADMIN", title: "관리자" },
  "폼·유효성 검사": { domain: "UI_FORM_VALIDATION", title: "폼·유효성 검사" },
  "목록·상세": { domain: "UI_LIST_DETAIL", title: "목록·상세" },
  "공통 컴포넌트": { domain: "UI_COMPONENTS", title: "공통 컴포넌트" },
  "주요 라이브러리": { domain: "MAJOR_LIBRARIES", title: "주요 라이브러리" },
  "공통 UI": { domain: "COMMON_LOGIC", title: "공통 UI" },
  "공통 메뉴": { domain: "COMMON_MENU", title: "공통 메뉴" },
  "공통 오류 처리": { domain: "COMMON_ERROR", title: "공통 오류 처리" },
  "JPA": { domain: "ORM_DATA_ACCESS", title: "JPA" },
  "MyBatis": { domain: "ORM_MYBATIS", title: "MyBatis" },
  "SQL": { domain: "ORM_SQL", title: "SQL" },
  "ORM·데이터 접근": { domain: "ORM_DATA_ACCESS", title: "JPA" },
  // 기존 문서 링크와 저장된 메뉴 이름도 계속 열 수 있도록 유지한다.
  "공통 로직": { domain: "COMMON_LOGIC", title: "공통 로직" },
  "이미지 업로드": { domain: "IMAGE_UPLOAD", title: "이미지 업로드" },
  // 기존 공간 코드를 유지해 문서 ID와 외부 링크를 보존한다.
  "시스템 구성": { domain: "SYSTEM", title: "시스템 구성" },
  "백엔드 구조": { domain: "DOMAIN", title: "백엔드 구조" },
  "프론트엔드": { domain: "APP_STRUCTURE", title: "프론트엔드" },
  "프론트엔드 구조": { domain: "APP_STRUCTURE", title: "프론트엔드" },
  "FSD": { domain: "APP_STRUCTURE", title: "FSD" },
  // 별도 메뉴를 합친 뒤에도 이전 아키텍처 링크는 해당 구조 노트로 연결한다.
  "DDD 아키텍처": { domain: "DOMAIN", title: "백엔드 구조" },
  "FSD 아키텍처": { domain: "APP_STRUCTURE", title: "프론트엔드" },
  "API 규칙": { domain: "API_RULES", title: "API 규칙" },
  "자바 문법": { domain: "JAVA_SYNTAX", title: "자바 문법" },
  "도메인 설계": { domain: "DOMAIN", title: "백엔드 구조" },
  "백엔드·프론트 구조": { domain: "DOMAIN", title: "백엔드 구조" },
  "JPA 기본": { domain: "ORM_DATA_ACCESS", title: "JPA" },
  "스프링 시큐리티": { domain: "AUTH_LOGIN", title: "스프링 시큐리티" },
  "회원가입": { domain: "AUTH_SIGNUP", title: "회원가입" }, "로그인·로그아웃": { domain: "AUTH_SIGNIN", title: "로그인·로그아웃" }, "권한·역할": { domain: "AUTH_ROLE", title: "권한·역할" }, "세션·토큰": { domain: "AUTH_TOKEN", title: "세션·토큰" },
  "메뉴 관리": { domain: "MENU", title: "메뉴 관리" }, "카테고리": { domain: "CATEGORY", title: "카테고리" },
  // 기존 공간 코드와 문서 ID를 유지하면서 전체 도메인의 데이터 설계로 범위를 넓힌다.
  "엔티티·ERD": { domain: "PRODUCT_MODEL", title: "엔티티·ERD" },
  "상품 데이터 모델": { domain: "PRODUCT_MODEL", title: "엔티티·ERD" },
  "PostgreSQL·마이그레이션": { domain: "DATABASE", title: "PostgreSQL·마이그레이션" },
  "관리자 레이아웃": { domain: "ADMIN_LAYOUT", title: "관리자 레이아웃" },
  "상품 등록·수정": { domain: "ADMIN_PRODUCT", title: "상품 등록·수정" },
  "상품 관리": { domain: "ADMIN_PRODUCT", title: "상품 등록·수정" },
  "재고 관리": { domain: "ADMIN_INVENTORY", title: "재고 관리" }, "주문 관리": { domain: "ADMIN_ORDER", title: "주문 관리" }, "회원 관리": { domain: "ADMIN_MEMBER", title: "회원 관리" },
  // 검색·필터는 상품 목록 학습에 포함한다. 기존 검색 링크도 같은 공간으로 연다.
  "상품 목록·상세": { domain: "PRODUCT_PAGE", title: "상품 목록·상세" }, "검색·필터": { domain: "PRODUCT_PAGE", title: "상품 목록·상세" }, "장바구니": { domain: "CART", title: "장바구니" }, "SEO·콘텐츠": { domain: "SEO_CONTENT", title: "SEO·콘텐츠" },
  "주문 생성·상태": { domain: "ORDER_STATUS", title: "주문 생성·상태" }, "결제 승인·실패·취소": { domain: "PAYMENT", title: "결제 승인·실패·취소" },
  "배송": { domain: "SHIPPING", title: "배송" },
  // 기존 배송 문서 링크는 같은 공간으로 연결한다.
  "배송·주문 조회": { domain: "SHIPPING", title: "배송" },
  "환불·부분 환불": { domain: "REFUND", title: "환불·부분 환불" }, "재고 차감·복구": { domain: "STOCK_FLOW", title: "재고 차감·복구" },
  "단위·API 테스트": { domain: "TEST", title: "단위·API 테스트" }, "화면·권한 테스트": { domain: "AUTH_TEST", title: "화면·권한 테스트" }, "장애 시나리오": { domain: "INCIDENT", title: "장애 시나리오" }, "코드 리뷰·회고": { domain: "REVIEW_RETRO", title: "코드 리뷰·회고" },
  "로컬 개발 환경": { domain: "LOCAL_ENV", title: "로컬 개발 환경" }, "Docker·CI/CD": { domain: "CICD", title: "Docker·CI/CD" }, "배포": { domain: "DEPLOY", title: "배포" }, "모니터링·로그": { domain: "OBSERVABILITY", title: "모니터링·로그" }, "백업·복구": { domain: "BACKUP", title: "백업·복구" },
};

export function playbookModuleLabelForDomain(domain: string) {
  return Object.entries(playbookModules).find(([, module]) => module.domain === domain)?.[0] ?? null;
}
