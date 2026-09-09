'use client';

import { cn } from '@/lib';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, FolderSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Pagination } from './pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Pass the search input value to enable client-side global filtering */
  globalFilter?: string;
  emptyMessage?: string;
  emptyDescription?: string;
  loading?: boolean;
  skeletonRowCount?: number;
  /** Enable client-side pagination of the already-fetched rows */
  paginate?: boolean;
  pageSize?: number;
  containerClassName?: string;
  tableClassName?: string;
}

export function DataTable<TData>({
  columns,
  data,
  globalFilter,
  emptyMessage = 'No results found',
  emptyDescription = 'Try adjusting your search or filters.',
  loading = false,
  skeletonRowCount = 5,
  paginate = false,
  pageSize = 10,
  containerClassName,
  tableClassName,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: globalFilter ?? '', ...(paginate ? { pagination } : {}) },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginate ? { getPaginationRowModel: getPaginationRowModel() } : {}),
  });

  // Jumping back to page 1 whenever the filtered/search result set changes keeps the
  // pager from landing on an out-of-range page with no rows to show.
  useEffect(() => {
    if (paginate) table.setPageIndex(0);
  }, [globalFilter, data.length, paginate, table]);

  return (
    <div className="space-y-4">
      <Table containerClassName={containerClassName} className={tableClassName}>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const isSorted = header.column.getIsSorted();

                return (
                  <TableHead
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={cn(
                      canSort && 'cursor-pointer select-none group',
                      isSorted && 'text-gray-900 dark:text-white'
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="shrink-0 transition-opacity">
                          {isSorted === 'asc' ? (
                            <ArrowUp size={13} className="text-brand-600 dark:text-brand-400" />
                          ) : isSorted === 'desc' ? (
                            <ArrowDown size={13} className="text-brand-600 dark:text-brand-400" />
                          ) : (
                            <ArrowUpDown
                              size={13}
                              className="text-gray-400 opacity-40 group-hover:opacity-100 dark:text-gray-500"
                            />
                          )}
                        </span>
                      )}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: skeletonRowCount }).map((_, rIdx) => (
              <TableRow key={`skeleton-row-${rIdx}`} className="animate-pulse">
                {columns.map((_, cIdx) => (
                  <TableCell key={`skeleton-cell-${rIdx}-${cIdx}`}>
                    <div
                      className={cn(
                        'h-4 rounded bg-gray-200/80 dark:bg-gray-800',
                        cIdx === 0
                          ? 'w-3/4'
                          : cIdx === columns.length - 1
                            ? 'w-16 ml-auto'
                            : 'w-1/2'
                      )}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-14 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                    <FolderSearch size={20} />
                  </div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {emptyMessage}
                  </p>
                  {emptyDescription && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">
                      {emptyDescription}
                    </p>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {paginate && table.getPageCount() > 1 && (
        <Pagination
          currentPage={table.getState().pagination.pageIndex + 1}
          totalPages={table.getPageCount()}
          onPageChange={(page) => table.setPageIndex(page - 1)}
        />
      )}
    </div>
  );
}
