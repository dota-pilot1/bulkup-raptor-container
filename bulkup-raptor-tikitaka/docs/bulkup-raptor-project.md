# Bulkup Raptor 프로젝트 기획

## 1. 프로젝트 개요

Bulkup Raptor는 상품 탐색부터 주문까지의 흐름을 제공하는 쇼핑몰 서비스다.
이 문서는 쇼핑몰의 기획 의도와 구현 과정을 기록하고, Agent와 협업할 때 재사용할 수 있는 기준점을 만든다.

## 2. 프로젝트 구성

```text
bulkup-raptor-container/
├── bulkup-raptor-backend/   # Spring Boot REST API, PostgreSQL
└── bulkup-raptor-frontend/  # Next.js 쇼핑몰 웹

bulkup-raptor-tikitaka/      # 기획·작업·리뷰·개발 노트
```

## 3. 기술 방향

- 웹: Next.js, TypeScript, Tailwind CSS
- 서버 데이터: TanStack Query
- 클라이언트 상태: Zustand
- 폼과 검증: React Hook Form, Zod
- 백엔드: Spring Boot, Spring Data JPA, Spring Security
- 데이터베이스: PostgreSQL

## 4. 핵심 사용자 흐름

1. 방문자가 홈·카테고리·검색에서 상품을 탐색한다.
2. 상품 상세에서 옵션과 수량을 선택하고 장바구니에 담는다.
3. 로그인 사용자가 배송지와 결제 정보를 입력한다.
4. 주문이 생성되고 주문 상태를 조회한다.
5. 운영자는 상품·재고·주문을 관리한다.

## 5. 1차 범위

- [ ] 상품 및 카테고리 조회
- [ ] 상품 상세 및 옵션 선택
- [ ] 장바구니
- [ ] 회원가입·로그인
- [ ] 주문 생성 및 주문 조회
- [ ] 관리자 상품·주문 관리
- [ ] 검색 엔진용 상품 메타데이터와 sitemap

## 6. 구현 원칙

- 상품·주문·회원처럼 서버가 소유하는 데이터는 TanStack Query로 관리한다.
- 장바구니 UI 상태나 모달처럼 브라우저에만 필요한 상태는 Zustand로 관리한다.
- 프론트와 백엔드의 요청·응답 타입을 문서화하고, 폼 입력은 Zod로 검증한다.
- 작업은 `기획 → 구현 → 검증 → 리뷰 → 노트` 순서로 기록한다.
- 완료 조건과 검증 방법이 없는 작업은 구현 작업으로 등록하지 않는다.

## 7. 다음 작업

- [ ] 백엔드 상품 도메인 모델 설계
- [ ] 상품 목록 API 계약 정의
- [ ] 프론트 API 클라이언트와 상품 Query 작성
- [ ] 상품 목록 화면을 실제 API와 연결
- [ ] 노트 앱의 기존 샘플 도메인을 Bulkup Raptor 용어로 교체
