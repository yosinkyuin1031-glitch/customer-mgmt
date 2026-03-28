'use client'

import { useCallback, useMemo, useState } from 'react'

interface PaginationProps {
  totalItems: number
  itemsPerPage: number
  currentPage: number
  onPageChange: (page: number) => void
  onItemsPerPageChange?: (perPage: number) => void
}

const PER_PAGE_OPTIONS = [25, 50, 100]

/** ページネーションコントロール */
export default function Pagination({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  onItemsPerPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const start = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const end = Math.min(currentPage * itemsPerPage, totalItems)

  /** 表示するページ番号リスト（省略記号含む） */
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = []

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
      return pages
    }

    // 常に1ページ目
    pages.push(1)

    if (currentPage > 3) {
      pages.push('ellipsis-start')
    }

    const rangeStart = Math.max(2, currentPage - 1)
    const rangeEnd = Math.min(totalPages - 1, currentPage + 1)
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i)
    }

    if (currentPage < totalPages - 2) {
      pages.push('ellipsis-end')
    }

    // 常に最終ページ
    if (totalPages > 1) pages.push(totalPages)

    return pages
  }, [currentPage, totalPages])

  const btnBase = 'px-3 py-1.5 text-sm rounded-lg transition-colors'
  const btnActive = 'text-white font-bold'
  const btnInactive = 'text-gray-600 hover:bg-gray-100'
  const btnDisabled = 'text-gray-300 cursor-not-allowed'

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3">
      {/* 件数表示 */}
      <p className="text-sm text-gray-500">
        全<span className="font-semibold text-gray-800">{totalItems.toLocaleString()}</span>件中{' '}
        <span className="font-semibold text-gray-800">{start.toLocaleString()}</span>-
        <span className="font-semibold text-gray-800">{end.toLocaleString()}</span>件を表示
      </p>

      {/* ページボタン */}
      <div className="flex items-center gap-1">
        {/* 前へ */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={`${btnBase} ${currentPage <= 1 ? btnDisabled : btnInactive}`}
          aria-label="前のページ"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {pageNumbers.map((p, idx) =>
          typeof p === 'string' ? (
            <span key={p} className="px-2 text-gray-400 text-sm select-none">...</span>
          ) : (
            <button
              key={`page-${p}`}
              onClick={() => onPageChange(p)}
              className={`${btnBase} ${p === currentPage ? btnActive : btnInactive}`}
              style={p === currentPage ? { background: '#14252A' } : undefined}
            >
              {p}
            </button>
          ),
        )}

        {/* 次へ */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={`${btnBase} ${currentPage >= totalPages ? btnDisabled : btnInactive}`}
          aria-label="次のページ"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 表示件数セレクター */}
      {onItemsPerPageChange && (
        <div className="flex items-center gap-2">
          <select
            value={itemsPerPage}
            onChange={(e) => {
              onItemsPerPageChange(Number(e.target.value))
              onPageChange(1)
            }}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#14252A]"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}件
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400">/ ページ</span>
        </div>
      )}
    </div>
  )
}

/** usePagination: 配列データに対するページネーションフック */
export function usePagination<T>(items: T[], initialPerPage = 50) {
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(initialPerPage)

  // アイテム数やperPage変更時にページをリセット
  const totalPages = Math.max(1, Math.ceil(items.length / perPage))
  const safePage = Math.min(currentPage, totalPages)

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * perPage
    return items.slice(start, start + perPage)
  }, [items, safePage, perPage])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handlePerPageChange = useCallback((newPerPage: number) => {
    setPerPage(newPerPage)
    setCurrentPage(1)
  }, [])

  const PaginationControls = items.length > perPage ? (
    <Pagination
      totalItems={items.length}
      itemsPerPage={perPage}
      currentPage={safePage}
      onPageChange={handlePageChange}
      onItemsPerPageChange={handlePerPageChange}
    />
  ) : items.length > 0 ? (
    <div className="px-4 py-3">
      <p className="text-sm text-gray-500">
        全<span className="font-semibold text-gray-800">{items.length.toLocaleString()}</span>件を表示
      </p>
    </div>
  ) : null

  return {
    paginatedItems,
    currentPage: safePage,
    setCurrentPage: handlePageChange,
    perPage,
    setPerPage: handlePerPageChange,
    PaginationControls,
  }
}
