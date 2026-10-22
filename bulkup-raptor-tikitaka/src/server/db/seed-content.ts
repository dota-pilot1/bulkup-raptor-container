const textNode = (text: string) => ({ detail: 0, format: 0, mode: "normal", style: "", text, type: "text", version: 1 });
const paragraph = (text: string) => ({ children: [textNode(text)], direction: "ltr", format: "", indent: 0, type: "paragraph", version: 1 });
const heading = (text: string, tag: "h1" | "h2" = "h2") => ({ children: [textNode(text)], direction: "ltr", format: "", indent: 0, tag, type: "heading", version: 1 });
const emptyParagraph = () => ({ children: [], direction: null, format: "", indent: 0, type: "paragraph", version: 1 });
const quoteBlock = (children: unknown[]) => ({ children, direction: "ltr", format: "", indent: 0, type: "quote", version: 1 });
const bulletList = (items: string[]) => ({ children: items.map((item, index) => ({ children: [textNode(item)], direction: "ltr", format: "", indent: 0, type: "listitem", value: index + 1, version: 1 })), direction: "ltr", format: "", indent: 0, listType: "bullet", start: 1, tag: "ul", type: "list", version: 1 });
const codeBlock = (text: string, language = "typescript") => ({ children: [{ text, type: "code-highlight", version: 1 }], direction: "ltr", format: "", indent: 0, language, type: "code", version: 1 });

const createState = (children: unknown[]) => JSON.stringify({
  root: { children, direction: null, format: "", indent: 0, type: "root", version: 1 },
});
const sampleStep = (number: number, title: string, description: string, file: string, code: string, language: string) => [
  heading(`Step ${number}. ${title}`),
  quoteBlock([paragraph(description)]),
  paragraph("파일:"),
  codeBlock(file, "text"),
  emptyParagraph(),
  paragraph("코드:"),
  codeBlock(code, language),
  emptyParagraph(),
  emptyParagraph(),
];

const todoPlan = (number: number, title: string, description: string) => [
  heading(`TODO ${number}. ${title}`),
  quoteBlock([paragraph(description)]),
  emptyParagraph(),
  emptyParagraph(),
];

/** 2차 주제 본문 문서: 전체 목표와 TODO 계획만 담는 샘플입니다. */
export const TODO_PLAN_SAMPLE_LEXICAL_STATE = createState([
  heading("앱 내부 샘플 노트 조회 API 구현 전체 계획", "h1"),
  quoteBlock([paragraph("Next.js Route Handler와 앱 내부 SQLite로 샘플 노트 조회 API를 구현하고, 실제 HTTP 조회와 오류 조건까지 검증합니다.")]),
  emptyParagraph(),
  emptyParagraph(),
  heading("TODO 계획"),
  quoteBlock([bulletList([
    "TODO 1. 샘플 문서 식별자와 응답 계약 구현",
    "TODO 2. Next.js 샘플 조회 Route Handler 구현",
    "TODO 3. 내부 SQLite 시드와 로컬 API 검증",
  ])]),
]);

/** TODO 하위 문서: 하나의 TODO 안에서 Step 1~N을 관리하는 샘플입니다. */
export const STEP1_SAMPLE_LEXICAL_STATE = createState([
  heading("TODO 1. 내부 API 응답과 화면 모델 분리", "h1"),
  quoteBlock([paragraph("Next.js 내부 API의 응답 계약과 화면 모델을 분리하고, 변환 경계가 보이도록 주요 타입에 역할 주석을 작성합니다.")]),
  emptyParagraph(),
  emptyParagraph(),
  ...sampleStep(1, "화면 모델 타입 정의", "화면 컴포넌트가 사용하는 샘플 키와 문서 응답 구조를 주요 타입 주석과 함께 정의한다.", "pkt-study-fullstack/src/features/hospital-playbook/api.ts", `/** 문서 ID 대신 안정적으로 조회하는 샘플 식별자다. */
export type PlaybookSampleKey =
  | "API_IMPLEMENTATION"
  | "FRONTEND_IMPLEMENTATION";

/** 샘플 미리보기가 사용하는 내부 API 응답 모델이다. */
export type PlaybookSampleDocument = {
  sampleKey: PlaybookSampleKey;
  documentId: number;
  topicId: number;
  title: string;
  content: string;
  version: number;
  updatedAt: string;
};`, "typescript"),
  ...sampleStep(2, "내부 API 호출 정의", "브라우저에서는 외부 호스트가 아닌 동일한 Next.js 앱의 상대 경로만 호출한다.", "pkt-study-fullstack/src/features/hospital-playbook/api.ts", `/** 동일 앱의 Route Handler에서 최신 샘플 문서를 조회한다. */
sampleDocument: (sampleKey: PlaybookSampleKey) =>
  request<PlaybookSampleDocument>(
    \`/api/llm/hospital-playbook/samples/\${sampleKey}\`,
    { errorMessage: "구현 노트 샘플을 불러오지 못했습니다." },
  ),`, "typescript"),
]);

/** Next.js API 구현 노트의 상위 계획 문서 샘플입니다. */
export const API_IMPLEMENTATION_NOTE_SAMPLE_LEXICAL_STATE = createState([
  heading("앱 내부 샘플 노트 API 구현 전체 계획", "h1"),
  quoteBlock([paragraph("외부 서버 없이 Next.js Route Handler와 같은 앱의 SQLite만 사용해 샘플 문서를 조회·생성·수정하고, LLM이 상위 계획과 TODO 하위 문서를 한 번에 참조할 수 있게 한다.")]),
  emptyParagraph(),
  emptyParagraph(),
  heading("구현 범위"),
  quoteBlock([bulletList([
    "샘플 문서를 documentId가 아닌 sampleKey로 조회한다.",
    "문서 생성과 본문 수정은 내부 Next.js Route Handler에서 처리한다.",
    "샘플 본문과 TODO 하위 문서를 같은 SQLite 트리로 저장하고 함께 반환한다.",
    "외부 API 서버, Spring 서버, 원격 데이터베이스는 사용하지 않는다.",
  ])]),
  emptyParagraph(),
  emptyParagraph(),
  heading("TODO 계획"),
  quoteBlock([bulletList([
    "TODO 1. 샘플 조회 Route Handler와 계층 응답 구현",
    "TODO 2. 문서 생성·수정과 expectedVersion 충돌 처리 구현",
    "TODO 3. SQLite 샘플 트리 시드와 로컬 검증",
  ])]),
  emptyParagraph(),
  emptyParagraph(),
  heading("선행·후행 관계"),
  quoteBlock([paragraph("TODO 1에서 조회 응답 계약을 고정한 뒤 TODO 2에서 생성·수정 계약을 연결한다. TODO 3은 앞선 계약을 실제 SQLite 시드와 HTTP 응답으로 최종 검증한다.")]),
  emptyParagraph(),
  emptyParagraph(),
  heading("완료 기준"),
  quoteBlock([bulletList([
    "GET 샘플 조회에서 본문과 children 하위 문서가 순서대로 반환된다.",
    "PATCH는 최신 expectedVersion만 허용하고 충돌 시 409를 반환한다.",
    "샘플 노트 화면에서 상위 문서와 TODO 하위 문서 3개가 계층으로 표시된다.",
    "TypeScript, ESLint, Next.js 운영 빌드와 localhost API 조회를 통과한다.",
  ])]),
]);

/** API 상위 계획 문서 아래에 생성할 TODO 상세 리뷰 샘플입니다. */
export const API_IMPLEMENTATION_CHILD_SAMPLES = [
  {
    title: "TODO 1. 샘플 조회 Route Handler와 계층 응답 구현",
    content: createState([
      heading("TODO 1. 샘플 조회 Route Handler와 계층 응답 구현", "h1"),
      quoteBlock([paragraph("sampleKey로 상위 샘플 문서를 찾고, 같은 topic의 parentId 관계를 따라 TODO 하위 문서를 children으로 조립해 반환한다.")]),
      emptyParagraph(),
      emptyParagraph(),
      ...sampleStep(1, "Route Handler 요청 경계", "목적: URL의 sampleKey를 읽고 내부 조회 함수로 전달하는 Next.js HTTP 경계를 구현한다.", "pkt-study-fullstack/src/app/api/llm/hospital-playbook/samples/[sampleKey]/route.ts", `import { handleLlmRequest, llmSample } from "@/server/llm-playbook";

export const runtime = "nodejs";

// 동적 경로의 sampleKey를 내부 조회 함수에 전달한다.
export async function GET(
  request: Request,
  context: RouteContext<"/api/llm/hospital-playbook/samples/[sampleKey]">,
) {
  return handleLlmRequest(
    request,
    async () => llmSample((await context.params).sampleKey),
  );
}`, "typescript"),
      ...sampleStep(2, "내부 조회와 children 조립", "목적: sampleKey를 정규화해 본문을 찾고 parentId 관계를 재귀적으로 조립해 전체 샘플 트리를 반환한다.", "pkt-study-fullstack/src/server/llm-playbook.ts", `// sampleKey로 찾은 상위 문서와 하위 문서를 하나의 응답 트리로 만든다.
export async function llmSample(sampleKey: string) {
  const [document] = await db.select().from(playbookDocuments)
    .where(eq(playbookDocuments.sampleKey, sampleKey.trim().toUpperCase())).limit(1);
  if (!document) throw new LlmPlaybookError(404, "샘플 문서를 찾을 수 없습니다.");
  const documents = await db.select().from(playbookDocuments)
    .where(eq(playbookDocuments.topicId, document.topicId))
    .orderBy(asc(playbookDocuments.orderIdx), asc(playbookDocuments.id));
  const childNode = (current: typeof playbookDocuments.$inferSelect): PlaybookSampleChild => ({
    documentId: current.id,
    parentId: current.parentId,
    title: current.title,
    content: current.content,
    version: current.version,
    updatedAt: current.updatedAt,
    children: documents.filter((child) => child.parentId === current.id).map(childNode),
  });
  return { sampleKey: document.sampleKey, topicId: document.topicId, ...childNode(document) };
}`, "typescript"),
      ...sampleStep(3, "계층 응답 타입 연결", "목적: 프론트와 LLM이 하위 문서 content와 순서를 타입 안전하게 사용할 수 있도록 재귀 응답 계약을 정의한다.", "pkt-study-fullstack/src/features/hospital-playbook/api.ts", `export type PlaybookSampleChildDocument = {
  documentId: number;
  parentId: number | null;
  title: string;
  content: string;
  version: number;
  updatedAt: string;
  children: PlaybookSampleChildDocument[];
};

export type PlaybookSampleDocument = PlaybookSampleChildDocument & {
  sampleKey: PlaybookSampleKey;
  topicId: number;
};`, "typescript"),
    ]),
  },
  {
    title: "TODO 2. 문서 생성·수정과 expectedVersion 충돌 처리 구현",
    content: createState([
      heading("TODO 2. 문서 생성·수정과 expectedVersion 충돌 처리 구현", "h1"),
      quoteBlock([paragraph("본문과 TODO 하위 문서를 같은 Next.js API로 생성하고, 최신 version을 기준으로만 본문을 수정해 동시 편집 덮어쓰기를 방지한다.")]),
      emptyParagraph(),
      emptyParagraph(),
      ...sampleStep(1, "문서 생성 Route Handler", "목적: title·content·parentId를 검증하고 같은 topic 안에 본문 또는 하위 문서를 생성한다.", "pkt-study-fullstack/src/app/api/llm/hospital-playbook/topics/[topicId]/documents/route.ts", `import { createLlmDocument, handleLlmRequest, LlmPlaybookError } from "@/server/llm-playbook";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/llm/hospital-playbook/topics/[topicId]/documents">) {
  return handleLlmRequest(request, async () => {
    const body = await request.json().catch(() => null) as { title?: unknown; content?: unknown; parentId?: unknown } | null;
    if (typeof body?.title !== "string" || typeof body.content !== "string") throw new LlmPlaybookError(400, "title과 content가 필요합니다.");
    const parentId = typeof body.parentId === "number" ? body.parentId : null;
    return createLlmDocument(Number((await context.params).topicId), body.title, body.content, parentId);
  }, 201);
}`, "typescript"),
      ...sampleStep(2, "version 충돌과 계층 검증", "목적: 수정 직전 version과 parentId를 검증하고 성공한 저장만 version을 증가시킨다.", "pkt-study-fullstack/src/server/llm-playbook.ts", `export async function updateLlmDocument(documentId: number, title: string | undefined, content: string, expectedVersion: number | undefined, parentId: number | null | undefined) {
  const current = await llmDocument(documentId);
  if (expectedVersion !== undefined && current.version !== expectedVersion) throw new LlmPlaybookError(409, "문서 version이 변경되었습니다. 최신 문서를 다시 조회하세요.");
  if (parentId !== undefined && parentId !== null) {
    if (parentId === documentId) throw new LlmPlaybookError(400, "문서 자신을 상위 문서로 지정할 수 없습니다.");
    const [parent] = await db.select().from(playbookDocuments).where(and(eq(playbookDocuments.id, parentId), eq(playbookDocuments.topicId, current.topicId))).limit(1);
    if (!parent) throw new LlmPlaybookError(400, "같은 주제의 상위 문서만 지정할 수 있습니다.");
  }
  await db.update(playbookDocuments).set({
    title: title?.trim() || current.title,
    content,
    parentId: parentId === undefined ? current.parentId : parentId,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  }).where(eq(playbookDocuments.id, documentId));
  return llmDocument(documentId);
}`, "typescript"),
    ]),
  },
  {
    title: "TODO 3. SQLite 샘플 트리 시드와 로컬 검증",
    content: createState([
      heading("TODO 3. SQLite 샘플 트리 시드와 로컬 검증", "h1"),
      quoteBlock([paragraph("샘플 상위 문서와 TODO 하위 문서를 내부 SQLite에 중복 없이 구성하고, 계층·Lexical 코드 블록·빌드 결과를 localhost에서 검증한다.")]),
      emptyParagraph(),
      emptyParagraph(),
      ...sampleStep(1, "샘플 식별자 스키마", "목적: 일반 문서 계층을 유지하면서 상위 모범 문서만 안정적인 sampleKey로 조회할 수 있게 한다.", "pkt-study-fullstack/src/db/schema.ts", `export const playbookDocuments = sqliteTable("playbook_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  topicId: integer("topic_id").notNull().references(() => playbookTopics.id),
  parentId: integer("parent_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  orderIdx: integer("order_idx").notNull().default(0),
  version: integer("version").notNull().default(1),
  sampleKey: text("sample_key").unique(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});`, "typescript"),
      ...sampleStep(2, "하위 문서 시드", "목적: API 샘플 상위 문서 아래에 TODO별 하위 문서를 parentId와 orderIdx로 연결하고 사용자 편집본은 보존한다.", "pkt-study-fullstack/src/server/database.ts", `for (const [orderIdx, child] of API_IMPLEMENTATION_CHILD_SAMPLES.entries()) {
  const existingChild = sqlite.prepare(
    "SELECT id, version FROM playbook_documents WHERE topic_id = ? AND parent_id = ? AND title = ? LIMIT 1",
  ).get(topic.id, parentDocumentId, child.title) as { id: number; version: number } | undefined;
  if (!existingChild) {
    sqlite.prepare(
      "INSERT INTO playbook_documents (topic_id, parent_id, title, content, order_idx, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(topic.id, parentDocumentId, child.title, child.content, orderIdx, now, now);
  } else if (existingChild.version === 1) {
    sqlite.prepare(
      "UPDATE playbook_documents SET content = ?, order_idx = ?, updated_at = ? WHERE id = ?",
    ).run(child.content, orderIdx, now, existingChild.id);
  }
}`, "typescript"),
      ...sampleStep(3, "로컬 검증", "목적: 외부 호스트 없이 샘플 트리와 직접 조회 응답, 타입, 운영 빌드를 확인한다.", "pkt-study-fullstack/package.json", `curl -s 'http://localhost:4300/api/llm/hospital-playbook/tree?spaceCode=NOTE_SAMPLE'
curl -s http://localhost:4300/api/llm/hospital-playbook/samples/API_IMPLEMENTATION

npx tsc --noEmit
npx eslint src/app/api/llm src/server/llm-playbook.ts
npm run build`, "bash"),
    ]),
  },
] as const;

/** 프론트 구현 노트: API 집계부터 Query 상태와 페이지 렌더링까지의 흐름을 보여주는 샘플입니다. */
export const FRONTEND_IMPLEMENTATION_NOTE_SAMPLE_LEXICAL_STATE = createState([
  heading("샘플 노트 미리보기 구현", "h1"),
  quoteBlock([paragraph("같은 Next.js 앱의 샘플 조회 API를 호출해 API·프론트 모범 문서를 렌더링한다. TanStack Query로 로딩·오류·최신 version 반영을 관리하며 외부 서버 주소는 사용하지 않는다.")]),
  emptyParagraph(),
  emptyParagraph(),
  ...sampleStep(1, "내부 API 모델과 호출 정의", "목적: stable sampleKey와 응답 타입을 정의하고 동일 앱의 상대 경로만 호출한다.", "pkt-study-fullstack/src/features/hospital-playbook/api.ts", `export type PlaybookSampleKey =
  | "API_IMPLEMENTATION"
  | "FRONTEND_IMPLEMENTATION";

// 외부 base URL 없이 같은 앱의 Next.js Route Handler를 호출한다.
sampleDocument: (sampleKey: PlaybookSampleKey) =>
  request<PlaybookSampleDocument>(
    \`/api/llm/hospital-playbook/samples/\${sampleKey}\`,
    { errorMessage: "구현 노트 샘플을 불러오지 못했습니다." },
  ),`, "typescript"),
  ...sampleStep(2, "TanStack Query 상태 연결", "목적: 선택한 탭의 sampleKey를 쿼리 키로 사용해 로딩·오류·최신 문서 상태를 일관되게 관리한다.", "pkt-study-fullstack/src/widgets/hospital-playbook/ImplementationNoteSamplePreview.tsx", `const sampleKeys = {
  api: "API_IMPLEMENTATION",
  frontend: "FRONTEND_IMPLEMENTATION",
} satisfies Record<SampleTab, PlaybookSampleKey>;

// 탭이 바뀌면 대응하는 내부 샘플 문서를 조회한다.
const sampleKey = sampleKeys[tab];
const sample = useQuery({
  queryKey: ["hospital-playbook", "sample", sampleKey],
  queryFn: () => playbookApi.sampleDocument(sampleKey),
});`, "typescript"),
  ...sampleStep(3, "Lexical 미리보기 렌더링", "목적: 조회된 content를 읽기 전용 Lexical 문서로 렌더링하고 version 변경 시 편집기 상태를 새로 구성한다.", "pkt-study-fullstack/src/widgets/hospital-playbook/ImplementationNoteSamplePreview.tsx", `{sample.isLoading ? (
  <SampleLoading />
) : sample.isError || !sample.data ? (
  <SampleError role="alert" />
) : (
  // 샘플을 편집하면 증가한 version으로 미리보기를 즉시 다시 구성한다.
  <LexicalEditor
    key={\`\${sampleKey}-\${sample.data.version}\`}
    initialState={sample.data.content}
    onChange={() => undefined}
    readOnly
    scrollable
  />
)}`, "tsx"),
  heading("Step 4. 검증 결과"),
  quoteBlock([paragraph("npm run lint와 npm run build를 실행하고, 샘플 탭 전환·로딩·오류·샘플 편집 후 version 반영을 확인해 결과를 기록한다.")]),
]);

/** LLM이 앱 내부 SQLite의 최신 샘플 문서를 직접 조회하도록 안내합니다. */
export const SAMPLE_NOTE_REFERENCE_GUIDE = `# 샘플 노트 직접 조회

이 앱은 외부 서버를 사용하지 않습니다. 아래 API는 현재 Next.js 앱의 Route Handler가 같은 앱 내부 SQLite에서 조회합니다.

GET /api/llm/hospital-playbook/samples
GET /api/llm/hospital-playbook/samples/API_IMPLEMENTATION
GET /api/llm/hospital-playbook/samples/FRONTEND_IMPLEMENTATION

노트를 작성하기 전에 작업 종류에 맞는 샘플 문서를 GET으로 조회하고, 반환된 content의 Lexical 노드 순서와 문서 분리 기준을 따릅니다.

- API 구현 노트는 API_IMPLEMENTATION 샘플을 기준으로 합니다.
- API_IMPLEMENTATION의 content는 전체 TODO 계획이며 children 각 항목은 TODO 하나의 Step 1~N 상세 문서입니다.
- API 샘플의 children을 순서대로 모두 읽어 parentId·파일·코드·검증 구조까지 함께 따릅니다.
- 프론트 구현 노트는 FRONTEND_IMPLEMENTATION 샘플을 기준으로 합니다.
- 샘플 문서는 일반 메뉴에 노출하지 않는 내부 기준 데이터입니다.
- 샘플 documentId를 코드나 요청문에 고정하지 말고 sampleKey로 조회합니다.
- 샘플을 수정하면 API 가이드 미리보기와 이후 LLM 조회에 즉시 반영됩니다.

각 Step의 기본 순서는 heading → quote → '파일:' paragraph → 파일 경로 code(language: text) → '코드:' paragraph → 실제 코드 code → 빈 paragraph 2개입니다.
파일 경로 블록에는 경로만 기록하고, 주요 함수·타입·훅·컴포넌트 설명은 실제 코드 안에서 대상 바로 위에 주석으로 작성합니다.`;

/** 기존 호출부 호환용 기본 샘플입니다. */
export const DOCUMENT_API_SAMPLE_LEXICAL_STATE = TODO_PLAN_SAMPLE_LEXICAL_STATE;
