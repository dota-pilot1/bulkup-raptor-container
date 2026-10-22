import { useState } from 'react';
import './state-demo.css';

type StateMode = 'hover'|'dropdown'|'accordion'|'animation'|'loading'|'skeleton'|'empty'|'error'|'toast'|'combo';
export function StateDemo({ mode = 'hover' }: { mode?: StateMode }) {
  const [open, setOpen] = useState(mode === 'accordion'); const [show, setShow] = useState(false);
  if (mode === 'dropdown') return <div className="state-demo"><button className="state-trigger" onClick={() => setShow(!show)}>작업 메뉴 ▾</button>{show && <div className="state-menu"><button>수정</button><button>복제</button><button>삭제</button></div>}</div>;
  if (mode === 'accordion') return <div className="state-demo state-accordion"><button onClick={() => setOpen(!open)}>상세 설명 <span>{open ? '−' : '+'}</span></button>{open && <p>접근성 있는 버튼으로 콘텐츠를 열고 닫습니다. 현재 상태는 시각적 변화와 함께 전달됩니다.</p>}</div>;
  if (mode === 'loading') return <div className="state-demo state-message"><span className="state-spinner"/> 데이터를 불러오는 중입니다…</div>;
  if (mode === 'skeleton') return <div className="state-demo state-skeleton"><i/><i/><i/></div>;
  if (mode === 'empty') return <div className="state-demo state-message"><strong>표시할 데이터가 없습니다.</strong><span>검색 조건을 바꾸거나 새 항목을 추가해 보세요.</span></div>;
  if (mode === 'error') return <div className="state-demo state-error"><strong>데이터를 불러오지 못했습니다.</strong><span>잠시 후 다시 시도해 주세요.</span><button onClick={() => setShow(true)}>다시 시도</button>{show && <small>재시도 요청을 보냈습니다.</small>}</div>;
  if (mode === 'toast') return <div className="state-demo"><button className="state-trigger" onClick={() => setShow(true)}>저장 완료 토스트 보기</button>{show && <div className="state-toast" role="status">✓ 저장되었습니다 <button onClick={() => setShow(false)}>×</button></div>}</div>;
  if (mode === 'animation') return <div className="state-demo"><div className="state-pulse">상태 변화</div></div>;
  if (mode === 'combo') return <div className="state-demo state-combo"><span className="state-spinner"/><strong>저장 중…</strong><button onClick={() => setShow(true)}>완료 상태 보기</button>{show && <em>저장 완료</em>}</div>;
  return <div className="state-demo"><button className="state-hover">마우스를 올려보세요</button><span className="state-tooltip">추가 설명</span></div>;
}
