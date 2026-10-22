import { playbookModuleLabelForDomain } from "./modules";

/**
 * 앱을 다시 열어도 특정 노트와 그 소속 공간을 복원할 수 있는 내부 링크를 만든다.
 * hash는 셸의 모듈 선택에, query는 HospitalPlaybookModule의 문서 선택에 사용한다.
 */
export function buildDocumentDeepLink(documentId: number, domain: string) {
  const moduleLabel = playbookModuleLabelForDomain(domain);
  if (!moduleLabel) return null;

  const url = new URL(window.location.href);
  url.searchParams.set("playbookDocument", String(documentId));
  url.searchParams.set("spaceCode", domain);
  url.hash = encodeURIComponent(moduleLabel);
  return url.toString();
}
