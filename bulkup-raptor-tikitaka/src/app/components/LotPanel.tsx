type Lot = {
  id: number;
  lotCode: string;
  process: string;
  productCode: string;
  productName: string;
  status: string;
  updatedAt: string;
};

function statusLabel(status: string) {
  const labels: Record<string, string> = { READY: "대기", IN_PROGRESS: "진행", COMPLETED: "완료", HOLD: "보류" };
  return labels[status] ?? status;
}

export function LotPanel({ initialLots }: { initialLots: Lot[] }) {
  return (
    <section>
      <div className="section-heading">
        <div><p className="section-kicker">MES MODULE 01</p><h2>Lot 현황</h2></div>
        <a href="/api/lots">JSON API</a>
      </div>
      {initialLots.length === 0 ? <p className="hint">SQLite에 Lot 데이터가 없습니다. PostgreSQL import 검증 DB의 데이터를 앱 DB로 전환하는 단계가 필요합니다.</p> : (
        <div className="lot-table-wrap"><table className="lot-table"><thead><tr><th>Lot</th><th>제품</th><th>공정</th><th>상태</th><th>수정일</th></tr></thead><tbody>{initialLots.map((lot) => <tr key={lot.id}><td><strong>{lot.lotCode}</strong></td><td><span>{lot.productName}</span><small>{lot.productCode}</small></td><td>{lot.process}</td><td><span className={`status status-${lot.status.toLowerCase()}`}>{statusLabel(lot.status)}</span></td><td>{new Date(lot.updatedAt).toLocaleString("ko-KR")}</td></tr>)}</tbody></table></div>
      )}
    </section>
  );
}
