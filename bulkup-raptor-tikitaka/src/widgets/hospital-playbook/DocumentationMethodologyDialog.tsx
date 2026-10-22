import { useEffect } from "react";
import { BookOpen, GitBranch, LayoutPanelTop, Network, X } from "lucide-react";

type DocumentationMethodologyDialogProps = {
  onClose: () => void;
};

const sections = [
  {
    icon: BookOpen,
    title: "CRUD 단위가 아닌 도메인 핵심을 문서화합니다",
    description: "모든 CRUD마다 기획 문서를 만들기보다, 여러 기능이 함께 참조하는 판단 기준을 남깁니다.",
    items: ["운영 정책: 코드 중복, 금액 범위, 수정·삭제 가능 조건", "주요 업무 프로세스: 생성 후 판매 시작, 변경 승인, 종료 처리", "데이터 관계와 권한: 판단에 필요한 경우에만 간단히 정리"],
  },
  {
    icon: GitBranch,
    title: "상태와 분기는 다이어그램으로 명확히 합니다",
    description: "상태 변경이나 조건 분기가 있으면 텍스트 대신 흐름을 한눈에 확인할 수 있게 합니다.",
    items: ["상태 전이: 예) DRAFT → ON_SALE → ENDED와 각 전환 조건", "조건 분기: 판매 시작일, 중복 코드, 수정 가능 여부", "업무 흐름: 역할이나 승인 단계가 함께 얽히는 경우"],
  },
  {
    icon: LayoutPanelTop,
    title: "화면 설계는 목적과 행동을 기록합니다",
    description: "완성된 시안을 반복 복제하지 않고, 화면에서 가능한 행동과 상태별 규칙을 중심으로 남깁니다.",
    items: ["화면 흐름: 목록 → 생성 → 상세 → 수정/상태 변경", "와이어프레임: 입력 항목, 버튼, 오류 메시지, 권한 차이", "실제 UI 시안·구현 화면은 링크 또는 스크린샷으로 연결"],
  },
  {
    icon: Network,
    title: "정책 문서와 구현 기록을 연결합니다",
    description: "기획 문서는 재사용되는 판단을, 구현 문서는 그 판단을 코드와 테스트로 연결한 기록을 담습니다.",
    items: ["단순 조회·삭제: 구현 TODO와 테스트 기록으로 충분", "생성·수정·상태 변경: 관련 정책 문서를 연결", "새 정책이나 예외가 생기면 정책 문서를 먼저 갱신"],
  },
] as const;

export default function DocumentationMethodologyDialog({ onClose }: DocumentationMethodologyDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-labelledby="documentation-methodology-title" onMouseDown={onClose}>
      <section className="flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-surface-border-soft px-5 py-4">
          <div className="min-w-0"><div className="flex items-center gap-2 text-brand-primary"><BookOpen className="size-4" /><span className="text-xs font-black">가이드</span></div><h2 id="documentation-methodology-title" className="mt-1 text-lg font-black text-text-primary">기획 방법론</h2><p className="mt-1 text-xs font-semibold text-text-muted">무엇을 먼저 설계하고, 어떤 판단을 사람·Agent와 공유할지 정리합니다.</p></div>
          <button type="button" onClick={onClose} className="ui-icon-button size-8 shrink-0" aria-label="기획 방법론 닫기"><X className="size-4" /></button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {sections.map(({ icon: Icon, title, description, items }) => (
              <section key={title} className="rounded-lg border border-surface-border-soft bg-surface-muted/25 p-4">
                <div className="flex items-start gap-2"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand-glass text-brand-primary"><Icon className="size-4" /></span><div><h3 className="text-[13px] font-black leading-5 text-text-primary">{title}</h3><p className="mt-1 text-[11px] leading-5 text-text-secondary">{description}</p></div></div>
                <ul className="mt-3 space-y-1.5 border-t border-surface-border-soft pt-3 text-[11px] leading-5 text-text-secondary">{items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-brand-primary" />{item}</li>)}</ul>
              </section>
            ))}
          </div>
          <p className="mt-4 rounded-lg border border-brand-border/50 bg-brand-glass/50 px-4 py-3 text-xs font-semibold leading-5 text-text-secondary"><strong className="text-text-primary">권장 구조:</strong> 도메인별로 <strong className="text-text-primary">운영 정책 논의</strong>와 <strong className="text-text-primary">화면 및 업무 흐름</strong>을 기준 문서로 두고, 생성·수정·상태 변경 같은 구현 문서는 정책 링크, 완료 조건, 검증 결과를 남깁니다.</p>
        </div>
      </section>
    </div>
  );
}
