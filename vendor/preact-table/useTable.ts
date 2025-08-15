import { useRef, useState } from 'preact/hooks'
import {
  constructTable,
  coreFeatures,
  getInitialTableState,
} from '@tanstack/table-core'
import type {
  RowData,
  Table,
  TableFeatures,
  TableOptions,
  TableState,
} from '@tanstack/table-core'

/**
 * Creates a table instance and caches it in a ref so that it will only be constructed once.
 */
function useTableRef<TFeatures extends TableFeatures, TData extends RowData>(
  options: TableOptions<TFeatures, TData>,
): Table<TFeatures, TData> {
  const tableRef = useRef<Table<TFeatures, TData>>(null)

  if (!tableRef.current) {
    tableRef.current = constructTable(options)
  }

  return tableRef.current
}

/**
 * Will re-render the table whenever the state or options change. Works just like the `useReactTable` from v8.
 * @example const table = useTable({ columns, data, state, ...options })
 */
export function useTable<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(tableOptions: TableOptions<TFeatures, TData>): Table<TFeatures, TData> {
  const _features = { ...coreFeatures, ...tableOptions._features }

  const [state, setState] = useState<TableState<TFeatures>>(() =>
    getInitialTableState(_features, tableOptions.initialState),
  )

  const statefulOptions: TableOptions<TFeatures, TData> = {
    ...tableOptions,
    _features,
    state: { ...state, ...tableOptions.state },
    onStateChange: (updater) => {
      setState(updater)
      tableOptions.onStateChange?.(updater)
    },
  }

  const table = useTableRef(statefulOptions)

  table.setOptions((prev) => ({ ...prev, ...statefulOptions })) // force re-render when state or options change

  return table
}
