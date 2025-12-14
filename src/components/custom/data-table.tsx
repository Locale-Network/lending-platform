import { DataTable } from '@/components/ui/data-table';
import Pagination from '@/components/custom/pagination';
import { ColumnDef } from '@tanstack/react-table';

export default function Table<T>({
  rows = [],
  columns = [],
  total = 0,
  totalPages = 0,
}: {
  rows: T[];
  columns: ColumnDef<T>[];
  total: number;
  totalPages: number;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto">
      <DataTable columns={columns} data={rows} />
      <div className="flex w-full items-center justify-center">
        <p className="flex flex-row gap-2 whitespace-nowrap">Total: {total}</p>
        <Pagination totalPages={totalPages} />
      </div>
    </div>
  );
}
