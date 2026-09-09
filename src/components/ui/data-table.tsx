'use client';

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
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Pagination } from './pagination';
import { Spinner } from './spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Pass the search input value to enable client-side global filtering */
  globalFilter?: string;
  emptyMessage?: string;
  loading?: boolean;
  /** Enable client-side pagination of the already-fetched rows */
  paginate?: boolean;
  pageSize?: number;
}

export function DataTable<TData>({
  columns,
  data,
  globalFilter,
  emptyMessage = 'No results found',
  loading = false,
  paginate = false,
  pageSize = 10,
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
    // `table` deliberately excluded: it's a new object each render, and only the result
    // set (filter text / row count) should trigger jumping back to page 1.
  }, [globalFilter, data.length]);

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                >
                  <span className="inline-flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() &&
                      (header.column.getIsSorted() === 'asc' ? (
                        <ChevronUp size={13} />
                      ) : header.column.getIsSorted() === 'desc' ? (
                        <ChevronDown size={13} />
                      ) : (
                        <ChevronsUpDown size={13} className="text-gray-300" />
                      ))}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-10 text-center">
                <Spinner center />
              </TableCell>
            </TableRow>
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
              <TableCell colSpan={columns.length} className="py-10 text-center text-gray-400">
                {emptyMessage}
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
