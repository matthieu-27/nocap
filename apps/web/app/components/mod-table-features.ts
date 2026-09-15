import {
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table';

// Isolates the TanStack Table v9 wiring: only the sorting feature is
// declared, so pagination, selection, and filtering stay tree-shaken
// out of the bundle. If the installed major ever changes its API, this
// is the only file to adapt.
export const modTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
export type ModTableFeatures = typeof modTableFeatures;
