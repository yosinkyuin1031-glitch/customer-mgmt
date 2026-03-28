'use client'

/** SkeletonRow: 1行分のアニメーション付きプレースホルダー */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
        </td>
      ))}
    </tr>
  )
}

/** SkeletonTable: テーブル読み込み用プレースホルダー */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-gray-200 rounded animate-pulse flex-1" />
        ))}
      </div>
      {/* 行 */}
      <table className="w-full text-sm">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** SkeletonCard: カード型プレースホルダー */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 space-y-3 animate-pulse">
      {/* タイトル行 */}
      <div className="h-5 bg-gray-200 rounded w-2/5" />
      {/* コンテンツ行 */}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 rounded"
          style={{ width: `${70 + Math.random() * 25}%` }}
        />
      ))}
    </div>
  )
}
