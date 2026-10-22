import './layout-demo.css';

type LayoutMode = 'grid' | 'responsive' | 'dashboard' | 'list-detail' | 'master-detail';

export function LayoutDemo({ mode = 'grid' }: { mode?: LayoutMode }) {
  if (mode === 'dashboard') return <div className="layout-demo layout-dashboard"><div className="layout-stat"><small>오늘 생산</small><strong>1,284</strong><span>+8.4%</span></div><div className="layout-stat"><small>진행 LOT</small><strong>24</strong><span>정상</span></div><div className="layout-stat"><small>가동 설비</small><strong>18/20</strong><span>90%</span></div><div className="layout-panel layout-panel-wide"><strong>생산 현황</strong><div className="layout-bars"><i style={{height:'48%'}}/><i style={{height:'72%'}}/><i style={{height:'58%'}}/><i style={{height:'88%'}}/><i style={{height:'66%'}}/></div></div></div>;
  if (mode === 'list-detail') return <div className="layout-demo layout-split"><div className="layout-list"><strong>LOT 목록</strong><button>LOT-24081</button><button className="is-active">LOT-24082</button><button>LOT-24083</button></div><div className="layout-detail"><small>선택한 LOT</small><strong>LOT-24082</strong><p>제품 PKT-A100 · 식각 공정 · 진행 중</p></div></div>;
  if (mode === 'master-detail') return <div className="layout-demo layout-split layout-master"><div className="layout-list"><strong>설비</strong><button className="is-active">EQ-101 · 노광</button><button>EQ-102 · 식각</button><button>EQ-201 · 검사</button></div><div className="layout-detail"><small>설비 상세</small><strong>EQ-101</strong><div className="layout-detail-grid"><span>상태</span><b>가동</b><span>담당 라인</span><b>1라인</b></div></div></div>;
  return <div className={`layout-demo ${mode === 'responsive' ? 'layout-responsive' : 'layout-grid'}`}><div>영역 A</div><div>영역 B</div><div>영역 C</div><div>영역 D</div>{mode === 'responsive' ? <small>창 너비에 따라 4열 → 2열 → 1열로 줄어듭니다.</small> : null}</div>;
}
