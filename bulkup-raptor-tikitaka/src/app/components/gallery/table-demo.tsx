import { Badge } from './badge';
import { DataTable, type Column } from './table';
import './table.css';

type Lot = { lot: string; product: string; step: string; qty: number; status: string };

const SAMPLE: Lot[] = [
  { lot: 'LOT-24081', product: 'PKT-A100', step: '노광', qty: 1200, status: '진행' },
  { lot: 'LOT-24082', product: 'PKT-A100', step: '식각', qty: 980, status: '대기' },
  { lot: 'LOT-24083', product: 'PKT-B220', step: '검사', qty: 1500, status: '완료' },
  { lot: 'LOT-24084', product: 'PKT-B220', step: '노광', qty: 640, status: '이상' },
  { lot: 'LOT-24085', product: 'PKT-C310', step: '세정', qty: 2100, status: '진행' },
];

const TONE: Record<string, 'neutral' | 'info' | 'success' | 'danger'> = {
  대기: 'neutral', 진행: 'info', 완료: 'success', 이상: 'danger',
};

const COLUMNS: Column<Lot>[] = [
  { key: 'lot', header: 'LOT' },
  { key: 'product', header: '제품' },
  { key: 'step', header: '공정' },
  { key: 'qty', header: '수량', align: 'right', render: (row) => row.qty.toLocaleString() },
  { key: 'status', header: '상태', render: (row) => <Badge tone={TONE[row.status] ?? 'neutral'} size="sm" dot>{row.status}</Badge> },
];

/** 갤러리 전용 시연 래퍼. 실제 재사용 대상은 table.tsx의 DataTable이다. */
export function TableDemo({ rowCount = 5, ...props }: { rowCount?: number; compact?: boolean; striped?: boolean; hover?: boolean }) {
  return <DataTable columns={COLUMNS} rows={SAMPLE.slice(0, rowCount)} {...props} />;
}

