import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export interface AdminListProps {
  title: string;
  description: string;
  headers: string[];
  rows: React.ReactNode[][];
  emptyTitle: string;
  emptyMessage: string;
  actions?: React.ReactNode;
}

export function AdminList({ title, description, headers, rows, emptyTitle, emptyMessage, actions }: AdminListProps) {
  return (
    <>
      <PageHeader title={title} description={description} actions={actions} />
      <Card>
        <CardHeader><CardTitle>{title} list</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="font-medium text-fg">{emptyTitle}</p>
              <p className="mt-1 text-sm text-fg-muted">{emptyMessage}</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-sm">
                  <thead><tr className="border-b border-line bg-muted/60">{headers.map((header) => <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">{header}</th>)}</tr></thead>
                  <tbody>{rows.map((row, index) => <tr key={index} className="border-b border-line last:border-0">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 text-fg">{cell}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <ul className="divide-y divide-line md:hidden">{rows.map((row, index) => <li key={index} className="space-y-2 px-4 py-3">{row.map((cell, cellIndex) => <div key={cellIndex} className="flex items-start justify-between gap-3"><span className="text-xs font-medium uppercase tracking-wide text-fg-muted">{headers[cellIndex]}</span><span className="text-right text-sm text-fg">{cell}</span></div>)}</li>)}</ul>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
