import type { ReactNode } from 'react';
import './table.css';

export type Column<Row> = {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render?: (row: Row) => ReactNode;
};

type DataTableProps<Row> = {
  columns: Column<Row>[];
  rows: Row[];
  compact?: boolean;
  striped?: boolean;
  hover?: boolean;
  emptyText?: string;
};

export function DataTable<Row extends Record<string, unknown>>({
  columns,
  rows,
  compact = false,
  striped = true,
  hover = true,
  emptyText = '표시할 데이터가 없습니다.',
}: DataTableProps<Row>) {
  const size = compact ? 'data-table-compact' : 'data-table-md';

  return (
    <div className="data-table-wrap">
      {rows.length === 0 ? (
        <div className="data-table-empty">{emptyText}</div>
      ) : (
        <table className={`data-table ${size} ${striped ? 'data-table-striped' : ''} ${hover ? 'data-table-hover' : ''}`}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.align === 'right' ? 'col-right' : undefined}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.key} className={column.align === 'right' ? 'col-right' : undefined}>
                    {column.render ? column.render(row) : String(row[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

