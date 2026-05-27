'use client';

import { PageBreadcrumb } from '@/components/common';
import {
  Badge,
  Input,
  PageError,
  Pagination,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useActivityLogs } from './use-activity-logs';

const PER_PAGE = 10;

const actionColor = {
  create: 'success',
  update: 'warning',
  delete: 'error',
} as const;

export default function ActivityLogsPage() {
  const [query, setQuery] = useState('');
  const [debounceQuery, setDebounceQuery] = useState('');
  const [page, setPage] = useState(1);
  const { data, isPending, isFetching, error } = useActivityLogs(page, debounceQuery);

  const totalPages = Math.ceil((data?.total ?? 0) / PER_PAGE);

  useEffect(() => {
    const timer = setTimeout(() => setDebounceQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  if (error) return <PageError message={error.message} />;

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Activity Logs" />

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search logs..."
            className="pl-9"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <p className="text-sm text-gray-500">{data?.total ?? 0} total</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Module</TableHead>
            <TableHead>Document</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Initiated By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.data.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                {log.created_at ? format(new Date(log.created_at), 'MMM d, yyyy h:mm a') : '—'}
              </TableCell>
              <TableCell className="font-medium">{log.module}</TableCell>
              <TableCell>{log.doc_name}</TableCell>
              <TableCell>
                <Badge
                  color={actionColor[log.action as keyof typeof actionColor] ?? 'light'}
                  size="sm"
                >
                  {log.action}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">{log.user_id}</TableCell>
            </TableRow>
          ))}
          {(isPending || isFetching) && (
            <TableRow>
              <TableCell className="py-10" colSpan={5}>
                <Spinner center />
              </TableCell>
            </TableRow>
          )}
          {!data?.data.length && !isPending && !isFetching && (
            <TableRow>
              <TableCell className="py-10 text-center text-gray-400" colSpan={5}>
                No logs found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
