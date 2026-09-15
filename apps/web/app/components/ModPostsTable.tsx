import { channelHandle, type ModPostDto } from '@nocap/shared';
import {
  type ColumnDef,
  type SortingState,
  useTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type ModTableFeatures, modTableFeatures } from './mod-table-features';

// Fixed locale so server-rendered HTML matches client hydration.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const columns: ColumnDef<ModTableFeatures, ModPostDto>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => {
      const post = row.original;
      return (
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex max-w-[260px] items-center gap-1 font-medium hover:underline"
        >
          <span className="truncate">{post.title}</span>
          <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
        </a>
      );
    },
  },
  {
    accessorKey: 'domainSlug',
    header: 'Channel',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {channelHandle(row.original.domainSlug)}
      </span>
    ),
  },
  {
    accessorKey: 'author',
    header: 'Author',
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.author}</span>
    ),
  },
  {
    accessorKey: 'score',
    header: 'Score',
    cell: ({ row }) => (
      <span className="block text-right font-mono tabular-nums">
        {row.original.score}
      </span>
    ),
  },
  {
    accessorKey: 'openReports',
    header: 'Reports',
    cell: ({ row }) => {
      const count = row.original.openReports;
      return (
        <Badge variant={count > 0 ? 'destructive' : 'secondary'}>{count}</Badge>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => (
      <span className="font-mono text-xs whitespace-nowrap">
        {dateFormatter.format(new Date(row.original.createdAt))}
      </span>
    ),
  },
  {
    id: 'status',
    accessorFn: (row) => (row.removedAt === null ? 'live' : 'removed'),
    header: 'Status',
    cell: ({ row }) =>
      row.original.removedAt === null ? (
        <Badge variant="outline">live</Badge>
      ) : (
        <Badge variant="destructive">removed</Badge>
      ),
  },
];

interface ModPostsTableProps {
  posts: ModPostDto[];
}

export function ModPostsTable({ posts }: ModPostsTableProps): ReactElement {
  // Channel filter over derived data instead of the TanStack filtering
  // feature: one useState, trivially testable, smaller v9 API surface.
  const [channel, setChannel] = useState('all');
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);

  const channels = [...new Set(posts.map((post) => post.domainSlug))].sort();
  // Base UI's Select.Value renders the raw value string unless Root gets an
  // items map — build one from the same value→label pairs the menu renders.
  const channelItems = [
    { label: 'All channels', value: 'all' },
    ...channels.map((slug) => ({ label: channelHandle(slug), value: slug })),
  ];
  const data =
    channel === 'all'
      ? posts
      : posts.filter((post) => post.domainSlug === channel);

  const table = useTable({
    features: modTableFeatures,
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  const removedCount = posts.filter((post) => post.removedAt !== null).length;
  const openReportsTotal = posts.reduce(
    (sum, post) => sum + post.openReports,
    0,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <Select
          value={channel}
          onValueChange={(value) => setChannel(value ?? 'all')}
          items={channelItems}
        >
          <SelectTrigger aria-label="Filter by channel" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {channels.map((slug) => (
              <SelectItem key={slug} value={slug}>
                {channelHandle(slug)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="font-mono text-xs text-muted-foreground">
          {data.length} posts · {removedCount} removed · {openReportsTotal} open
          reports
        </p>
      </div>

      <Table>
        <TableHeader>
          {table.getFlatHeaders().map((header) => {
            const sorted = header.column.getIsSorted();
            return (
              <TableHead
                key={header.id}
                aria-sort={
                  sorted === 'asc'
                    ? 'ascending'
                    : sorted === 'desc'
                      ? 'descending'
                      : 'none'
                }
              >
                {header.column.getCanSort() ? (
                  <button
                    type="button"
                    onClick={header.column.getToggleSortingHandler()}
                    className="flex items-center gap-1 uppercase hover:text-foreground"
                  >
                    <table.FlexRender header={header} />
                    {sorted === 'asc' ? (
                      <ArrowUp className="size-3" />
                    ) : sorted === 'desc' ? (
                      <ArrowDown className="size-3" />
                    ) : (
                      <ArrowUpDown className="size-3 opacity-50" />
                    )}
                  </button>
                ) : (
                  <table.FlexRender header={header} />
                )}
              </TableHead>
            );
          })}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-8 text-center text-muted-foreground"
              >
                No posts.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
