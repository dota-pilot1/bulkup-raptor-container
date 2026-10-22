import { useState, type FormEvent } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Select } from './select';
import './form-demo.css';

export type FormDemoMode = 'login' | 'signup' | 'password' | 'search' | 'filter' | 'date' | 'lot' | 'equipment' | 'edit' | 'file' | 'image';

const LABELS: Record<FormDemoMode, string> = {
  login: '로그인 폼', signup: '회원가입 폼', password: '비밀번호 변경 폼', search: '검색 폼', filter: '필터 폼', date: '날짜 범위 폼', lot: 'LOT 등록 폼', equipment: '설비 등록 폼', edit: '공통 수정 폼', file: '파일 업로드 폼', image: '이미지 업로드 폼',
};

export function FormDemo({ mode = 'login' }: { mode?: FormDemoMode }) {
  const [submitted, setSubmitted] = useState(false);
  const [fileName, setFileName] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSubmitted(true); };
  const file = mode === 'file' || mode === 'image';
  return <form className="form-demo" onSubmit={submit}>
    <div className="form-demo-heading"><div><strong>{LABELS[mode]}</strong><span>실제 컴포넌트</span></div><small>Light 기본</small></div>
    <div className="form-demo-fields">
      {mode === 'login' && <><Input label="이메일 또는 사번" placeholder="user@example.com" required /><Input label="비밀번호" type="password" placeholder="비밀번호 입력" required /></>}
      {mode === 'signup' && <><Input label="이름" placeholder="홍길동" required /><Input label="이메일" type="email" placeholder="user@example.com" required /><Input label="비밀번호" type="password" placeholder="8자 이상" required /></>}
      {mode === 'password' && <><Input label="현재 비밀번호" type="password" required /><Input label="새 비밀번호" type="password" hint="영문·숫자·특수문자 포함 8자 이상" required /></>}
      {mode === 'search' && <Input label="검색어" placeholder="LOT 번호, 품목명 검색" />}
      {mode === 'filter' && <><Select label="상태" options={['전체', '진행', '완료', '이상']} placeholder="상태 선택" /><Select label="공정" options={['전체', '노광', '식각', '검사']} placeholder="공정 선택" /></>}
      {mode === 'date' && <><Input label="시작일" type="date" defaultValue="2026-08-01" required /><Input label="종료일" type="date" defaultValue="2026-08-26" required /></>}
      {mode === 'lot' && <><Input label="LOT 번호" placeholder="LOT-24086" required /><Input label="수량" type="number" placeholder="0" required /><Select label="설비" options={['EQ-101', 'EQ-102', 'EQ-201']} placeholder="설비 선택" /></>}
      {mode === 'equipment' && <><Input label="설비 코드" placeholder="EQ-301" required /><Input label="설비명" placeholder="세정 설비" required /><Select label="운영 상태" options={['가동', '점검', '중지']} placeholder="상태 선택" /></>}
      {mode === 'edit' && <><Input label="이름" defaultValue="기존 데이터" required /><Input label="설명" defaultValue="수정할 설명을 입력하세요." /></>}
      {file && <label className="form-demo-upload"><span>{mode === 'image' ? '이미지 파일' : '첨부 파일'}</span><input type="file" accept={mode === 'image' ? 'image/*' : undefined} onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')} />{fileName ? <small>{fileName}</small> : <small>파일을 선택하세요</small>}</label>}
    </div>
    <div className="form-demo-actions"><Button type="submit">{mode === 'search' || mode === 'filter' || mode === 'date' ? '조회' : mode === 'login' ? '로그인' : file ? '업로드' : '저장'}</Button><Button type="button" variant="secondary" onClick={() => setSubmitted(false)}>초기화</Button></div>
    {submitted ? <p className="form-demo-success" role="status">입력값을 확인하고 제출할 수 있습니다.</p> : null}
  </form>;
}
