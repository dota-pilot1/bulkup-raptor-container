import { useState } from "react";

type Viewport = "desktop" | "mobile";

const permissions = ["요금제 생성", "요금제 조회", "요금제 수정"];

/**
 * 문서에서 프로필 화면의 레이아웃 책임을 읽을 수 있게 만든 갤러리 전용 시연 컴포넌트다.
 * 실제 NOVA 데이터 대신 고정된 예시를 쓰며, 두 영역과 반응형 순서를 눈에 보이게 표시한다.
 */
export function ProfileLayoutDemo({
  viewport = "desktop",
  showGuides = true,
}: {
  viewport?: Viewport;
  showGuides?: boolean;
}) {
  const [selectedRole, setSelectedRole] = useState("전체");
  const mobile = viewport === "mobile";

  return (
    <div className="w-full rounded-xl border border-surface-border-soft bg-surface-muted p-3 text-text-primary">
      <div
        className={mobile ? "grid grid-cols-1 gap-3" : "grid grid-cols-[minmax(0,1fr)_220px] gap-3"}
      >
        <section
          className={
            "rounded-lg border bg-surface-raised p-4 " +
            (mobile ? "order-1 border-amber-300" : "border-sky-300")
          }
          aria-label="권한 탐색 미리보기"
        >
          {showGuides ? (
            <span className="mb-3 inline-flex rounded bg-sky-100 px-2 py-1 text-[11px] font-black text-sky-800">
              {mobile ? "두 번째 · 권한 탐색 section" : "좌측 주 영역 · Grid 첫 열"}
            </span>
          ) : null}
          <h3 className="m-0 text-sm font-black">권한 정보</h3>
          <p className="mt-1 text-xs font-semibold text-text-muted">역할을 선택하면 해당 권한을 확인합니다.</p>
          <div className="mt-3 flex flex-wrap gap-1.5 border-b border-surface-border-soft pb-3">
            {["전체", "시스템 관리자"].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={
                  "rounded-md border px-2.5 py-1.5 text-xs font-black " +
                  (selectedRole === role
                    ? "border-brand-primary bg-brand-glass text-brand-primary"
                    : "border-surface-border bg-surface-raised text-text-muted")
                }
              >
                {role}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {permissions.map((permission) => (
              <div key={permission} className="rounded-md border border-surface-border-soft bg-surface-muted p-2">
                <strong className="block text-[11px]">{permission}</strong>
                <span className="mt-1 block text-[10px] text-text-muted">RATE_PLAN</span>
              </div>
            ))}
          </div>
        </section>

        <aside
          className={
            "rounded-lg border bg-surface-raised p-4 " +
            (mobile ? "order-0 border-violet-300" : "border-violet-300")
          }
          aria-label="계정 요약 미리보기"
        >
          {showGuides ? (
            <span className="mb-3 inline-flex rounded bg-violet-100 px-2 py-1 text-[11px] font-black text-violet-800">
              {mobile ? "첫 번째 · order-0" : "우측 보조 영역 · sticky"}
            </span>
          ) : null}
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-glass text-sm font-black text-brand-primary">N</span>
            <div>
              <strong className="block text-sm">NOVA 관리자</strong>
              <span className="text-[11px] text-text-muted">admin@nova.local</span>
            </div>
          </div>
          <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">활성 계정</span>
          <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-surface-border-soft pt-3 text-[10px]">
            <div><dt className="text-text-muted">사용자 ID</dt><dd className="m-0 mt-0.5 font-black">5</dd></div>
            <div><dt className="text-text-muted">가입일</dt><dd className="m-0 mt-0.5 font-black">2026. 9. 14.</dd></div>
          </dl>
        </aside>
      </div>

      {showGuides ? (
        <div className="mt-3 grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950 sm:grid-cols-3">
          <p className="m-0"><mark className="rounded bg-amber-200 px-1 font-black">Grid</mark> 900px 이상에서 좌측 권한·우측 계정 요약을 두 열로 배치합니다.</p>
          <p className="m-0"><mark className="rounded bg-amber-200 px-1 font-black">order</mark> 모바일에서는 계정 요약 aside를 먼저 읽게 합니다.</p>
          <p className="m-0"><mark className="rounded bg-amber-200 px-1 font-black">sticky</mark> 데스크톱에서 계정 요약을 권한 목록과 함께 고정합니다.</p>
        </div>
      ) : null}
    </div>
  );
}
