import { ChartColumn, Table2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export interface TableSpec {
  columns: string[];
  rows: (string | number)[][];
}

/** A chart with a title, optional legend and a table-view twin of the same data. */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
  className = '',
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: ReactNode;
  table?: TableSpec;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className={`card flex min-w-0 flex-col ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {table && (
            <div className="inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label={`${title} view`}>
              {(['chart', 'table'] as const).map((v) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={view === v}
                  aria-label={v === 'chart' ? 'Chart view' : 'Table view'}
                  title={v === 'chart' ? 'Chart view' : 'Table view'}
                  onClick={() => setView(v)}
                  className={`grid size-7 place-items-center rounded-md transition-colors ${view === v ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink'}`}
                >
                  {v === 'chart' ? <ChartColumn size={15} /> : <Table2 size={15} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      {legend && view === 'chart' && <div className="px-5 pt-3">{legend}</div>}
      <div className="min-w-0 flex-1 px-5 pt-3 pb-5">{view === 'chart' || !table ? children : <DataTable table={table} />}</div>
    </section>
  );
}

function DataTable({ table }: { table: TableSpec }) {
  return (
    <div className="scroll-thin max-h-[300px] overflow-auto rounded-lg border border-line">
      <table className="w-full text-left text-[13px]">
        <thead className="sticky top-0 bg-surface-2">
          <tr>
            {table.columns.map((c, i) => (
              <th key={c} className={`px-3 py-2 font-semibold text-ink-2 ${i > 0 ? 'text-right' : ''}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r} className="border-t border-line">
              {row.map((cell, i) => (
                <td key={i} className={`px-3 py-1.5 ${i > 0 ? 'tnum text-right' : 'text-ink'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegendItem({ color, label, value, kind = 'line' }: { color: string; label: string; value?: ReactNode; kind?: 'line' | 'dot' }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-ink-2">
      {kind === 'line' ? <span className="h-[3px] w-4 rounded-full" style={{ background: color }} /> : <span className="size-2.5 rounded-full" style={{ background: color }} />}
      {label}
      {value !== undefined && <span className="font-semibold text-ink">{value}</span>}
    </span>
  );
}
