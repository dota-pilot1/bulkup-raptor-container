import "server-only";

import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import bcrypt from "bcryptjs";
import { applyMigrations } from "@/server/db/migrations";
import { ensureOrmNoteSpace } from "@/server/db/orm-note-space";
import { databaseExistedBeforeOpen, databasePath, dataDirectory, pendingRestorePath, sqlite } from "@/server/db/connection";

type InitializationGlobal = typeof globalThis & {
  __pktStudyDatabaseInitialized?: boolean;
};

/** 마이그레이션과 호환성 시드는 HMR 중 다시 import되더라도 한 번만 실행한다. */
function initializeDatabase() {
applyMigrations(sqlite);

const legacyComponentGallery = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("COMPONENT_GALLERY") as { id: number } | undefined;
const legacyCodeLab = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("CODE_LAB") as { id: number } | undefined;
const componentSketch = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("COMPONENT_SKETCH") as { id: number } | undefined;
if (!componentSketch && (legacyComponentGallery || legacyCodeLab)) {
  sqlite.prepare("UPDATE playbook_spaces SET code = ?, name = ? WHERE id = ?").run("COMPONENT_SKETCH", "컴포넌트 스케치", (legacyComponentGallery ?? legacyCodeLab)!.id);
}

function moveComponentPracticeCategories() {
  const frontendSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("FRONTEND") as { id: number } | undefined;
  if (!frontendSpace) return;

  const now = new Date().toISOString();
  let componentSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("BASIC_COMPONENTS") as { id: number } | undefined;
  if (!componentSpace) {
    const result = sqlite.prepare("INSERT INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run("BASIC_COMPONENTS", "기본 컴포넌트", now, now);
    componentSpace = { id: Number(result.lastInsertRowid) };
  }

  // 실제 UI 구현·클론 기록만 별도 공간으로 옮기고 React 원리·FSD는 FRONTEND에 남긴다.
  sqlite.prepare("UPDATE playbook_categories SET space_id = ?, updated_at = ? WHERE space_id = ? AND title IN (?, ?)")
    .run(componentSpace.id, now, frontendSpace.id, "기본 UI", "클론 UI");
}

moveComponentPracticeCategories();

const now = new Date().toISOString();
sqlite.prepare(
  "INSERT OR IGNORE INTO roles (code, name, description, system_role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
).run("ROLE_ADMIN", "관리자", "로컬 앱 관리자", 1, now, now);
const adminRole = sqlite.prepare("SELECT id FROM roles WHERE code = ?").get("ROLE_ADMIN") as { id: number };
const roleId = adminRole.id;
const bootstrapEmail = process.env.PKT_STUDY_BOOTSTRAP_EMAIL ?? "terecal@daum.net";
const existingUser = sqlite.prepare("SELECT id FROM users WHERE email = ?").get(bootstrapEmail) as { id: number } | undefined;
if (!existingUser) {
  const password = process.env.PKT_STUDY_BOOTSTRAP_PASSWORD ?? "password123";
  sqlite.prepare(
    "INSERT OR IGNORE INTO users (email, password_hash, username, role_id, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(bootstrapEmail, bcrypt.hashSync(password, 10), "Bulkup Raptor 관리자", roleId, 1, now, now);
}

const defaultSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("PKT_FRONT_LEV1") as { id: number } | undefined;
if (!defaultSpace) {
  sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run("PKT_FRONT_LEV1", "기본 화면 설계", now, now);
  const space = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("PKT_FRONT_LEV1") as { id: number };
  sqlite.prepare("INSERT OR IGNORE INTO playbook_categories (space_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(space.id, "폐쇄망 개발 환경", 0, now, now);
  const category = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ?").get(space.id, "폐쇄망 개발 환경") as { id: number };
  sqlite.prepare("INSERT OR IGNORE INTO playbook_topics (category_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(category.id, "Next.js + SQLite 전환", 0, now, now);
}

// 클론 코딩은 개별 컴포넌트 전시 대신 실제 화면·흐름을 분석하고 구현하는 프로젝트 실습 공간이다.
sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
  .run("CLONE_CODING", "클론 코딩", now, now);

sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
  .run("PRODUCT_DESIGN", "제품 설계", now, now);

sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
  .run("DOMAIN_DESIGN", "도메인 설계", now, now);

sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
  .run("ARCHITECTURE", "아키텍처 설계", now, now);

// 파일럿은 백엔드와 프론트를 독립 공간으로 나눠, 한쪽 주제가 다른 쪽의 2차 메뉴를 밀어내지 않게 한다.
sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
  .run("PROTOTYPE", "백엔드 프로토타입", now, now);
sqlite.prepare("UPDATE playbook_spaces SET name = ?, updated_at = ? WHERE code = ? AND name = ?")
  .run("백엔드 프로토타입", now, "PROTOTYPE", "프로토타입");
sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
  .run("PROTOTYPE_FRONT", "프론트 프로토타입", now, now);

// 기존 프로토타입의 프론트 1차 메뉴는 문서·주제 ID를 보존한 채 새 프론트 공간으로 옮긴다.
const prototypeSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("PROTOTYPE") as { id: number } | undefined;
const prototypeFrontSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("PROTOTYPE_FRONT") as { id: number } | undefined;
if (prototypeSpace && prototypeFrontSpace) {
  sqlite.prepare("UPDATE playbook_categories SET space_id = ?, updated_at = ? WHERE space_id = ? AND title = ?")
    .run(prototypeFrontSpace.id, now, prototypeSpace.id, "프론트");
}

// AX 실습과 UI 챌린지는 왼쪽 레일에서 독립 플레이북으로 관리한다.
for (const [code, name] of [["AX_BASIC", "AX 기초"], ["AX_CHALLENGE", "AX 챌린지"], ["UI_CHALLENGE", "UI 챌린지"], ["JAVA_OOP", "OOP 실습"], ["TESTING", "테스팅"], ["DEBUGGING", "디버깅"], ["CI_CD", "CI/CD"], ["DEPLOYMENT", "배포"], ["MONITORING", "모니터링"], ["INFRASTRUCTURE", "환경·인프라"]] as const) {
  sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(code, name, now, now);
}

// 최초 설치 DB에 필요한 일반 노트의 시작 구조만 만든다. 기존 사용자 DB에는
// 다시 실행하지 않아 삭제한 메뉴를 복원하지 않는다.
if (!databaseExistedBeforeOpen) {
  const initialNoteSeeds = [
    ["SPRING_BOOT", "스프링 노트", "스프링 핵심", "Spring Boot 시작하기"],
    ["JAVA", "자바 노트", "Java 기초", "객체와 컬렉션"],
    ["DB", "DB 테이블 설계", "데이터 모델링", "고정 계층과 무한 계층"],
    ["FRONTEND", "리액트 노트", "프론트 도메인 분석", "상태·전이 설계"],
    ["FRONTEND", "리액트 노트", "리액트 노트", "React·Next.js 기술 노트"],
    ["FRONTEND_DOMAIN", "프론트 도메인 분석", "도메인 분석", "상태·전이 설계"],
    ["JS_TS", "JS·TS 노트", "JavaScript·TypeScript 기초", "배열 메서드와 타입"],
    ["UI_NAV", "메뉴·네비게이션", "기본 UI 실습", "Sidebar와 Header"],
    ["UI_FORM", "폼 UI", "인증 폼", "로그인 폼"],
    ["UI_LAYOUT", "레이아웃·페이지", "레이아웃 기초", "Grid·Flex"],
    ["UI_STATE", "인터랙션·상태", "인터랙션 패턴", "Hover"],
  ] as const;
  for (const [code, name, categoryTitle, topicTitle] of initialNoteSeeds) {
    sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(code, name, now, now);
    const space = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get(code) as { id: number };
    sqlite.prepare("INSERT INTO playbook_categories (space_id, title, order_idx, created_at, updated_at) SELECT ?, ?, 0, ?, ? WHERE NOT EXISTS (SELECT 1 FROM playbook_categories WHERE space_id = ? AND title = ?)").run(space.id, categoryTitle, now, now, space.id, categoryTitle);
    const category = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1").get(space.id, categoryTitle) as { id: number };
    sqlite.prepare("INSERT INTO playbook_topics (category_id, title, order_idx, created_at, updated_at) SELECT ?, ?, 0, ?, ? WHERE NOT EXISTS (SELECT 1 FROM playbook_topics WHERE category_id = ? AND title = ?)").run(category.id, topicTitle, now, now, category.id, topicTitle);
  }
}

// 기존 스프링 노트에 Spring Security 학습 주제를 업데이트로 추가한다.
// 같은 카테고리·제목이 이미 있으면 기존 순서와 문서를 보존한다.
const springSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ? LIMIT 1").get("SPRING_BOOT") as { id: number } | undefined;
if (springSpace) {
  sqlite.prepare("UPDATE playbook_spaces SET name = ?, updated_at = ? WHERE id = ? AND name = ?")
    .run("스프링 부트", now, springSpace.id, "스프링 노트");
}

// JPA는 DB 모델링과 달리 스프링에서 객체를 저장·조회하는 방식을 다루므로 독립 학습 공간으로 둔다.
sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
  .run("JPA", "JPA", now, now);
const jpaSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ? LIMIT 1").get("JPA") as { id: number };
let jpaCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
  .get(jpaSpace.id, "JPA 기초") as { id: number } | undefined;
if (!jpaCategory) {
  sqlite.prepare("INSERT INTO playbook_categories (space_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(jpaSpace.id, "JPA 기초", 0, now, now);
  jpaCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
    .get(jpaSpace.id, "JPA 기초") as { id: number };
}
const jpaTopic = sqlite.prepare("SELECT id FROM playbook_topics WHERE category_id = ? AND title = ? LIMIT 1")
  .get(jpaCategory.id, "JPA 시작하기") as { id: number } | undefined;
if (!jpaTopic) {
  sqlite.prepare("INSERT INTO playbook_topics (category_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(jpaCategory.id, "JPA 시작하기", 0, now, now);
}

if (springSpace) {
  const springCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
    .get(springSpace.id, "스프링 핵심") as { id: number } | undefined;
  if (springCategory) {
    const securityTopic = sqlite.prepare("SELECT id, title FROM playbook_topics WHERE category_id = ? AND title IN (?, ?) ORDER BY CASE title WHEN ? THEN 0 ELSE 1 END LIMIT 1")
      .get(springCategory.id, "스프링 시큐리티", "인증·인가", "스프링 시큐리티") as { id: number; title: string } | undefined;
    if (!securityTopic) {
      const topicCount = sqlite.prepare("SELECT COUNT(*) AS count FROM playbook_topics WHERE category_id = ?")
        .get(springCategory.id) as { count: number };
      sqlite.prepare("INSERT INTO playbook_topics (category_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .run(springCategory.id, "스프링 시큐리티", topicCount.count, now, now);
    } else if (securityTopic.title === "인증·인가") {
      sqlite.prepare("UPDATE playbook_topics SET title = ?, updated_at = ? WHERE id = ?")
        .run("스프링 시큐리티", now, securityTopic.id);
    }
    // 이전 실행에서 생긴 중복 옛 이름은 문서가 없을 때만 제거한다.
    sqlite.prepare("DELETE FROM playbook_topics WHERE category_id = ? AND title = ? AND NOT EXISTS (SELECT 1 FROM playbook_documents WHERE topic_id = playbook_topics.id) AND EXISTS (SELECT 1 FROM playbook_topics AS target WHERE target.category_id = playbook_topics.category_id AND target.title = ?)")
      .run(springCategory.id, "인증·인가", "스프링 시큐리티");
  }
}

// API 설계는 스프링 노트와 같은 백엔드 레일에 두되, 독립 플레이북 공간으로 관리한다.
// 이전 버전에서 스프링 핵심 아래에 생성된 주제는 새 공간으로 이동하고 문서는 보존한다.
sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
  .run("SPRING_API", "API 설계 및 문서화", now, now);
const apiSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ? LIMIT 1").get("SPRING_API") as { id: number };
let apiCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
  .get(apiSpace.id, "API 설계 및 문서화") as { id: number } | undefined;
if (!apiCategory) {
  sqlite.prepare("INSERT INTO playbook_categories (space_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(apiSpace.id, "API 설계 및 문서화", 0, now, now);
  apiCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
    .get(apiSpace.id, "API 설계 및 문서화") as { id: number };
}
const legacyApiTopic = springSpace
  ? sqlite.prepare("SELECT id FROM playbook_topics WHERE category_id = (SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1) AND title = ? LIMIT 1")
    .get(springSpace.id, "스프링 핵심", "API 설계 및 문서화") as { id: number } | undefined
  : undefined;
const apiTopic = sqlite.prepare("SELECT id FROM playbook_topics WHERE category_id = ? AND title = ? LIMIT 1")
  .get(apiCategory.id, "API 설계 및 문서화") as { id: number } | undefined;
if (!apiTopic && legacyApiTopic) {
  sqlite.prepare("UPDATE playbook_topics SET category_id = ?, order_idx = 0, updated_at = ? WHERE id = ?")
    .run(apiCategory.id, now, legacyApiTopic.id);
} else if (!apiTopic) {
  sqlite.prepare("INSERT INTO playbook_topics (category_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(apiCategory.id, "API 설계 및 문서화", 0, now, now);
}
if (springSpace) {
  sqlite.prepare("UPDATE playbook_topics SET order_idx = 1, updated_at = ? WHERE category_id = (SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1) AND title = ?")
    .run(now, springSpace.id, "스프링 핵심", "스프링 시큐리티");
}

// 스프링 시큐리티를 백엔드 레일의 독립 메뉴로 분리한다.
// 기존 스프링 핵심 아래의 주제와 문서는 새 공간으로 이동해 내용을 보존한다.
sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
  .run("SPRING_SECURITY", "스프링 시큐리티", now, now);
const securitySpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ? LIMIT 1").get("SPRING_SECURITY") as { id: number };
let securityCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
  .get(securitySpace.id, "스프링 시큐리티") as { id: number } | undefined;
if (!securityCategory) {
  sqlite.prepare("INSERT INTO playbook_categories (space_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(securitySpace.id, "스프링 시큐리티", 0, now, now);
  securityCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
    .get(securitySpace.id, "스프링 시큐리티") as { id: number };
}
const existingSecurityTopic = sqlite.prepare("SELECT id FROM playbook_topics WHERE category_id = ? AND title = ? LIMIT 1")
  .get(securityCategory.id, "스프링 시큐리티") as { id: number } | undefined;
const legacySecurityTopic = springSpace
  ? sqlite.prepare("SELECT id FROM playbook_topics WHERE category_id = (SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1) AND title = ? LIMIT 1")
    .get(springSpace.id, "스프링 핵심", "스프링 시큐리티") as { id: number } | undefined
  : undefined;
if (!existingSecurityTopic && legacySecurityTopic) {
  sqlite.prepare("UPDATE playbook_topics SET category_id = ?, order_idx = 0, updated_at = ? WHERE id = ?")
    .run(securityCategory.id, now, legacySecurityTopic.id);
} else if (!existingSecurityTopic) {
  sqlite.prepare("INSERT INTO playbook_topics (category_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(securityCategory.id, "스프링 시큐리티", 0, now, now);
}
if (springSpace) {
  // 분리 전에 생성된 옛 공간의 빈 중복만 제거하고, 문서가 있으면 보존한다.
  sqlite.prepare("DELETE FROM playbook_topics WHERE category_id = (SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1) AND title = ? AND NOT EXISTS (SELECT 1 FROM playbook_documents WHERE topic_id = playbook_topics.id)")
    .run(springSpace.id, "스프링 핵심", "스프링 시큐리티");
}

// 사내 지식 검색과 업무 자동화에 사용하는 Spring AI를 독립 백엔드 메뉴로 추가한다.
sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
  .run("SPRING_AI", "스프링 AI", now, now);
const aiSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ? LIMIT 1").get("SPRING_AI") as { id: number };
let aiCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
  .get(aiSpace.id, "스프링 AI 핵심") as { id: number } | undefined;
if (!aiCategory) {
  sqlite.prepare("INSERT INTO playbook_categories (space_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(aiSpace.id, "스프링 AI 핵심", 0, now, now);
  aiCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
    .get(aiSpace.id, "스프링 AI 핵심") as { id: number };
}
const aiTopic = sqlite.prepare("SELECT id FROM playbook_topics WHERE category_id = ? AND title = ? LIMIT 1")
  .get(aiCategory.id, "Spring AI 시작하기") as { id: number } | undefined;
if (!aiTopic) {
  sqlite.prepare("INSERT INTO playbook_topics (category_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(aiCategory.id, "Spring AI 시작하기", 0, now, now);
}

// FRONTEND_LIBRARY는 사용자가 구성하는 학습 공간이다. 이전 릴리즈는 이 위치에
// "라이브러리 활용"과 하위 주제를 매 시작마다 보충했지만, 삭제한 메뉴까지 다시
// 만들어 사용자의 트리 편집을 무효화했다. 공간만 보장하고 메뉴 구조는 시드와 UI/API
// 작업으로만 변경한다.
sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
  .run("FRONTEND_LIBRARY", "라이브러리 활용", now, now);

// 리액트 기본 영역에 컴포넌트 설계 학습 주제를 추가한다.
// 왼쪽 레일이나 별도 플레이북을 만들지 않고, 리액트 노트의 기존 1차 영역을 사용한다.
const reactSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ? LIMIT 1").get("FRONTEND") as { id: number } | undefined;
if (reactSpace) {
  const reactCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
    .get(reactSpace.id, "리액트 기본") as { id: number } | undefined;
  if (reactCategory) {
    const componentDesignTopic = sqlite.prepare("SELECT id FROM playbook_topics WHERE category_id = ? AND title = ? LIMIT 1")
      .get(reactCategory.id, "컴포넌트 설계와 렌더링") as { id: number } | undefined;
    if (!componentDesignTopic) {
      const topicCount = sqlite.prepare("SELECT COUNT(*) AS count FROM playbook_topics WHERE category_id = ?")
        .get(reactCategory.id) as { count: number };
      sqlite.prepare("INSERT INTO playbook_topics (category_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .run(reactCategory.id, "컴포넌트 설계와 렌더링", topicCount.count, now, now);
    }
  }
}

// 리액트 기본 흐름 다음에 프로젝트 구조를 다루는 FSD 주제를 추가한다.
const fsdTopicExists = reactSpace
  ? sqlite.prepare("SELECT id FROM playbook_topics WHERE category_id = (SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1) AND title = ? LIMIT 1")
    .get(reactSpace.id, "리액트 기본", "FSD 레이어 설계") as { id: number } | undefined
  : undefined;
if (reactSpace && !fsdTopicExists) {
  const reactCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
    .get(reactSpace.id, "리액트 기본") as { id: number } | undefined;
  if (reactCategory) {
    const topicCount = sqlite.prepare("SELECT COUNT(*) AS count FROM playbook_topics WHERE category_id = ?")
      .get(reactCategory.id) as { count: number };
    sqlite.prepare("INSERT INTO playbook_topics (category_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(reactCategory.id, "FSD 레이어 설계", topicCount.count, now, now);
  }
}

// CodeMirror로 작성한 Lexical TSX 문서를 모아 두는 일반 사용자 영역이다.
sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
  .run("COMPONENT_SKETCH", "컴포넌트 스케치", now, now);
const codeLabSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("COMPONENT_SKETCH") as { id: number };
let codeLabCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
  .get(codeLabSpace.id, "TSX 컴포넌트") as { id: number } | undefined;
if (!codeLabCategory) {
  sqlite.prepare("INSERT INTO playbook_categories (space_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(codeLabSpace.id, "TSX 컴포넌트", 0, now, now);
  codeLabCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
    .get(codeLabSpace.id, "TSX 컴포넌트") as { id: number };
}
if (!sqlite.prepare("SELECT id FROM playbook_topics WHERE category_id = ? AND title = ? LIMIT 1").get(codeLabCategory.id, "Lexical TSX 블록")) {
  sqlite.prepare("INSERT INTO playbook_topics (category_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(codeLabCategory.id, "Lexical TSX 블록", 0, now, now);
}

// 폼 UI는 기술 목록이 아니라 바로 조합해 쓰는 화면 패턴으로 유지한다.
const uiFormSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("UI_FORM") as { id: number };
const uiFormCategories = [
  ["인증 폼", ["로그인 폼", "회원가입 폼", "비밀번호 변경 폼"]],
  ["조회 폼", ["검색 폼", "필터 폼", "날짜 범위 폼"]],
  ["등록·수정 폼", ["LOT 등록 폼", "설비 등록 폼", "공통 수정 폼"]],
  ["업로드 폼", ["파일 업로드 폼", "이미지 업로드 폼"]],
] as const;
for (const [categoryTitle, topicTitles] of uiFormCategories) {
  let category = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1").get(uiFormSpace.id, categoryTitle) as { id: number } | undefined;
  if (!category) {
    const count = sqlite.prepare("SELECT COUNT(*) AS count FROM playbook_categories WHERE space_id = ?").get(uiFormSpace.id) as { count: number };
    sqlite.prepare("INSERT INTO playbook_categories (space_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(uiFormSpace.id, categoryTitle, count.count, now, now);
    category = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1").get(uiFormSpace.id, categoryTitle) as { id: number };
  }
  for (const topicTitle of topicTitles) {
    const exists = sqlite.prepare("SELECT id FROM playbook_topics WHERE category_id = ? AND title = ? LIMIT 1").get(category.id, topicTitle);
    if (!exists) {
      const count = sqlite.prepare("SELECT COUNT(*) AS count FROM playbook_topics WHERE category_id = ?").get(category.id) as { count: number };
      sqlite.prepare("INSERT INTO playbook_topics (category_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(category.id, topicTitle, count.count, now, now);
    }
  }
}

const uiLayoutSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("UI_LAYOUT") as { id: number };
const uiLayoutCategories = [
  ["레이아웃 기초", ["Grid·Flex", "반응형"]],
  ["화면 패턴", ["Dashboard", "List·Detail", "Master-Detail"]],
] as const;
for (const [categoryTitle, topicTitles] of uiLayoutCategories) {
  let category = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1").get(uiLayoutSpace.id, categoryTitle) as { id: number } | undefined;
  if (!category) {
    const count = sqlite.prepare("SELECT COUNT(*) AS count FROM playbook_categories WHERE space_id = ?").get(uiLayoutSpace.id) as { count: number };
    sqlite.prepare("INSERT INTO playbook_categories (space_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(uiLayoutSpace.id, categoryTitle, count.count, now, now);
    category = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1").get(uiLayoutSpace.id, categoryTitle) as { id: number };
  }
  for (const topicTitle of topicTitles) {
    const exists = sqlite.prepare("SELECT id FROM playbook_topics WHERE category_id = ? AND title = ? LIMIT 1").get(category.id, topicTitle);
    if (!exists) {
      const count = sqlite.prepare("SELECT COUNT(*) AS count FROM playbook_topics WHERE category_id = ?").get(category.id) as { count: number };
      sqlite.prepare("INSERT INTO playbook_topics (category_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(category.id, topicTitle, count.count, now, now);
    }
  }
}

const uiStateSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("UI_STATE") as { id: number };
const uiStateCategories = [
  ["인터랙션 패턴", ["Hover", "Dropdown", "Accordion", "Animation"]],
  ["상태·피드백", ["Loading", "Skeleton", "Empty", "페이지 에러", "Toast", "상태 조합"]],
] as const;
for (const [categoryTitle, topicTitles] of uiStateCategories) {
  let category = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1").get(uiStateSpace.id, categoryTitle) as { id: number } | undefined;
  if (!category) {
    const count = sqlite.prepare("SELECT COUNT(*) AS count FROM playbook_categories WHERE space_id = ?").get(uiStateSpace.id) as { count: number };
    sqlite.prepare("INSERT INTO playbook_categories (space_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(uiStateSpace.id, categoryTitle, count.count, now, now);
    category = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1").get(uiStateSpace.id, categoryTitle) as { id: number };
  }
  for (const topicTitle of topicTitles) {
    const exists = sqlite.prepare("SELECT id FROM playbook_topics WHERE category_id = ? AND title = ? LIMIT 1").get(category.id, topicTitle);
    if (!exists) {
      const count = sqlite.prepare("SELECT COUNT(*) AS count FROM playbook_topics WHERE category_id = ?").get(category.id) as { count: number };
      sqlite.prepare("INSERT INTO playbook_topics (category_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(category.id, topicTitle, count.count, now, now);
    }
  }
}

// 구현 노트 모범 예시는 일반 학습 노트와 분리해 편집하고, sample_key로 API에서 안정적으로 조회한다.
sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
  .run("NOTE_SAMPLE", "샘플 노트", now, now);
const sampleSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("NOTE_SAMPLE") as { id: number };
let sampleCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
  .get(sampleSpace.id, "구현 노트 모범 예시") as { id: number } | undefined;
if (!sampleCategory) {
  sqlite.prepare("INSERT INTO playbook_categories (space_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(sampleSpace.id, "구현 노트 모범 예시", 0, now, now);
  sampleCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1")
    .get(sampleSpace.id, "구현 노트 모범 예시") as { id: number };
}
// 페이지 단위 실습의 대표 주제. 기존 데이터에도 중복 없이 추가해 작업 관리 화면 실습을 복구한다.
const pktSpace = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?").get("PKT_FRONT_LEV1") as { id: number };
let pageCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1").get(pktSpace.id, "기본 페이지 작업 - 1") as { id: number } | undefined;
if (!pageCategory) {
  const categoryCount = sqlite.prepare("SELECT COUNT(*) AS count FROM playbook_categories WHERE space_id = ?").get(pktSpace.id) as { count: number };
  sqlite.prepare("INSERT INTO playbook_categories (space_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(pktSpace.id, "기본 페이지 작업 - 1", categoryCount.count, now, now);
  pageCategory = sqlite.prepare("SELECT id FROM playbook_categories WHERE space_id = ? AND title = ? ORDER BY id LIMIT 1").get(pktSpace.id, "기본 페이지 작업 - 1") as { id: number };
}
let workManagementTopic = sqlite.prepare("SELECT id FROM playbook_topics WHERE category_id = ? AND title = ? ORDER BY id LIMIT 1").get(pageCategory.id, "작업 관리") as { id: number } | undefined;
if (!workManagementTopic) {
  const topicCount = sqlite.prepare("SELECT COUNT(*) AS count FROM playbook_topics WHERE category_id = ?").get(pageCategory.id) as { count: number };
  sqlite.prepare("INSERT INTO playbook_topics (category_id, title, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(pageCategory.id, "작업 관리", topicCount.count, now, now);
  workManagementTopic = sqlite.prepare("SELECT id FROM playbook_topics WHERE category_id = ? AND title = ? ORDER BY id LIMIT 1").get(pageCategory.id, "작업 관리") as { id: number };
}

ensureOrmNoteSpace(sqlite);

// 인증·인가의 1·2차 메뉴도 사용자 데이터이므로 초기화 때 생성하거나 이름을 덮어쓰지 않는다.

}

const initializationGlobal = globalThis as InitializationGlobal;
if (!initializationGlobal.__pktStudyDatabaseInitialized) {
  initializeDatabase();
  initializationGlobal.__pktStudyDatabaseInitialized = true;
}

// 개발 HMR에서는 전체 초기화를 건너뛰어도 새로 추가된 메뉴 공간을 생성한다.
// 기존 카테고리·주제·문서는 수정하지 않는다.
function ensureBulkupNoteSpaces() {
  const now = new Date().toISOString();
  // Bulkup Raptor 전용 노트 공간만 보장한다.
  // 카테고리·주제·문서는 사용자가 직접 입력한 것만 유지한다.
  const bulkupNoteSpaces = [
    ["SYSTEM", "시스템 구성"], ["DOMAIN", "도메인 설계"], ["API_RULES", "API 규칙"], ["APP_STRUCTURE", "백엔드·프론트 구조"],
    ["AUTH_LOGIN", "스프링 시큐리티"], ["AUTH_SIGNUP", "회원가입"],
    ["AUTH_SIGNIN", "로그인·로그아웃"], ["AUTH_ROLE", "권한·역할"], ["AUTH_TOKEN", "세션·토큰"],
    ["MENU", "메뉴 관리"], ["CATEGORY", "카테고리"], ["PRODUCT_MODEL", "상품 데이터 모델"], ["DATABASE", "PostgreSQL·마이그레이션"],
    ["ADMIN_LAYOUT", "관리자 레이아웃"], ["ADMIN_PRODUCT", "상품 관리"], ["ADMIN_INVENTORY", "재고 관리"], ["ADMIN_ORDER", "주문 관리"], ["ADMIN_MEMBER", "회원 관리"],
    ["PRODUCT_PAGE", "상품 목록·상세"], ["SEARCH_FILTER", "검색·필터"], ["CART", "장바구니"], ["SEO_CONTENT", "SEO·콘텐츠"],
    ["ORDER_STATUS", "주문 생성·상태"], ["PAYMENT", "결제 승인·실패·취소"], ["SHIPPING", "배송·주문 조회"], ["REFUND", "환불·부분 환불"], ["STOCK_FLOW", "재고 차감·복구"],
    ["TEST", "단위·API 테스트"], ["AUTH_TEST", "화면·권한 테스트"], ["INCIDENT", "장애 시나리오"], ["REVIEW_RETRO", "코드 리뷰·회고"],
    ["LOCAL_ENV", "로컬 개발 환경"], ["CICD", "Docker·CI/CD"], ["DEPLOY", "배포"], ["OBSERVABILITY", "모니터링·로그"], ["BACKUP", "백업·복구"],
  ] as const;
  for (const [code, title] of bulkupNoteSpaces) {
    sqlite.prepare("INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run(code, title, now, now);
  }
}

ensureBulkupNoteSpaces();

export const db = drizzle(sqlite, { schema });

export { databasePath, dataDirectory, pendingRestorePath };

export function checkpointDatabase() {
  sqlite.pragma("wal_checkpoint(TRUNCATE)");
}

export function getDatabaseStatus() {
  const sqliteVersion = sqlite.prepare("SELECT sqlite_version() AS version").get() as { version: string };
  return { databasePath, sqliteVersion: sqliteVersion.version };
}
