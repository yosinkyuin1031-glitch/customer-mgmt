'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'

interface Column {
  key: string
  label: string
  type?: 'text' | 'number' | 'boolean' | 'color' | 'select'
  options?: string[]
  width?: string
  required?: boolean
}

// 患者数カウント設定
interface PatientCountConfig {
  sourceTable: string       // 参照元テーブル (cm_patients or cm_slips)
  sourceField: string       // 参照元フィールド (chief_complaint, occupation等)
  matchKey?: string         // マスターデータのどのキーでマッチするか (デフォルト: 'name')
  label?: string            // カウント列のラベル (デフォルト: '該当者数')
  partialMatch?: boolean    // 部分一致（chief_complaintのようにカンマ区切り）
}

interface Props {
  title: string
  tableName: string
  columns: Column[]
  defaultValues?: Record<string, unknown>
  sortField?: string
  patientCount?: PatientCountConfig
}

// --- Skeleton Row ---
function SkeletonRow({ colCount }: { colCount: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
        </td>
      ))}
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <div className="h-4 w-8 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-8 bg-gray-200 rounded animate-pulse" />
        </div>
      </td>
    </tr>
  )
}

// --- Delete Confirmation Modal ---
function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="削除確認"
    >
      {/* overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      {/* modal */}
      <div className="relative bg-white rounded-xl shadow-xl p-6 w-80 text-center">
        <p className="text-sm text-gray-800 font-medium mb-5">この項目を削除しますか？</p>
        <div className="flex gap-3 justify-center">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            aria-label="削除をキャンセル"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
            aria-label="削除を確定"
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Undo Toast ---
function UndoToast({ onUndo, onDismiss }: { onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm animate-fade-in">
      <span>削除しました</span>
      <button
        onClick={onUndo}
        className="text-blue-300 hover:text-blue-200 font-medium underline underline-offset-2"
        aria-label="削除を元に戻す"
      >
        元に戻す
      </button>
    </div>
  )
}

export default function SimpleMasterPage({ title, tableName, columns, defaultValues = {}, sortField = 'sort_order', patientCount }: Props) {
  const supabase = createClient()
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [adding, setAdding] = useState(false)
  const [countMap, setCountMap] = useState<Record<string, number>>({})

  // Delete confirmation
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Undo state
  const [undoItem, setUndoItem] = useState<Record<string, unknown> | null>(null)
  const [showUndo, setShowUndo] = useState(false)

  const clinicId = getClinicId()

  // Determine which columns are required: explicitly marked, or 'name' column by default
  const isRequired = (col: Column) => {
    if (col.required !== undefined) return col.required
    return col.key === 'name'
  }

  const loadCounts = async () => {
    if (!patientCount) return
    const { sourceTable, sourceField } = patientCount
    const { data } = await supabase
      .from(sourceTable)
      .select(sourceField)
      .eq('clinic_id', clinicId)
    if (!data) return

    const counts: Record<string, number> = {}
    for (const row of data) {
      const val = (row as unknown as Record<string, unknown>)[sourceField]
      if (!val || typeof val !== 'string') continue
      if (patientCount.partialMatch) {
        const parts = val.split(/[,、\s]+/).map(s => s.trim()).filter(Boolean)
        for (const part of parts) {
          counts[part] = (counts[part] || 0) + 1
        }
      } else {
        counts[val] = (counts[val] || 0) + 1
      }
    }
    setCountMap(counts)
  }

  const load = async () => {
    const { data } = await supabase.from(tableName).select('*').eq('clinic_id', clinicId).order(sortField)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load(); loadCounts() }, [])

  // --- Validation ---
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    for (const col of columns) {
      if (isRequired(col)) {
        const val = form[col.key]
        if (val === undefined || val === null || val === '') {
          errors[col.key] = `${col.label}は必須です`
        }
      }
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleAdd = async () => {
    const newItem: Record<string, unknown> = { ...defaultValues }
    columns.forEach(col => {
      if (!(col.key in newItem)) {
        newItem[col.key] = col.type === 'number' ? 0 : col.type === 'boolean' ? true : ''
      }
    })
    newItem.sort_order = items.length + 1
    newItem.clinic_id = clinicId
    const { data, error } = await supabase.from(tableName).insert(newItem).select().single()
    if (error) {
      console.error('master add error:', error)
      if (error.code === '23505') {
        alert('このデータは既に登録されています')
      } else if (error.code === '42501' || error.message?.includes('RLS')) {
        alert('アクセス権がありません')
      } else {
        alert('データの保存に失敗しました')
      }
      return
    }
    if (data) {
      setItems([...items, data])
      setEditingId(data.id as string)
      setForm(data)
      setFormErrors({})
    }
  }

  const handleSave = async () => {
    if (!editingId) return
    if (!validateForm()) return
    const { error } = await supabase.from(tableName).update(form).eq('id', editingId)
    if (error) {
      console.error('master save error:', error)
      if (error.code === '23505') {
        alert('このデータは既に登録されています')
      } else if (error.code === '42501' || error.message?.includes('RLS')) {
        alert('アクセス権がありません')
      } else {
        alert('データの保存に失敗しました')
      }
      return
    }
    await load()
    setEditingId(null)
    setForm({})
    setFormErrors({})
  }

  // Step 1: open confirmation modal
  const requestDelete = (id: string) => {
    setDeleteTargetId(id)
  }

  // Step 2: confirmed delete with undo support
  const confirmDelete = useCallback(async () => {
    if (!deleteTargetId) return
    const deletedItem = items.find(i => i.id === deleteTargetId)
    await supabase.from(tableName).delete().eq('id', deleteTargetId)
    setItems(prev => prev.filter(i => i.id !== deleteTargetId))
    setDeleteTargetId(null)

    // Show undo toast
    if (deletedItem) {
      setUndoItem(deletedItem)
      setShowUndo(true)
    }
  }, [deleteTargetId, items, tableName])

  const handleUndo = useCallback(async () => {
    if (!undoItem) return
    // Re-insert the deleted item
    await supabase.from(tableName).insert(undoItem)
    setShowUndo(false)
    setUndoItem(null)
    await load()
  }, [undoItem, tableName])

  const dismissUndo = useCallback(() => {
    setShowUndo(false)
    setUndoItem(null)
  }, [])

  const cancelDelete = useCallback(() => {
    setDeleteTargetId(null)
  }, [])

  const inputClass = (colKey: string) => {
    const hasError = formErrors[colKey]
    return `w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#14252A] ${
      hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'
    }`
  }

  // Total columns for skeleton (data columns + patient count if present + actions)
  const skeletonColCount = columns.length + (patientCount ? 1 : 0)

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="font-bold text-gray-800">{title}</h2>
        <button
          onClick={handleAdd}
          className="text-white text-sm px-4 py-2 rounded-lg font-medium"
          style={{ background: '#14252A' }}
          aria-label={`${title}を追加`}
        >
          + 追加
        </button>
      </div>

      {loading ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                {columns.map(col => (
                  <th key={col.key} className="text-left px-4 py-2 text-xs font-medium text-gray-500" style={{ width: col.width }}>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-16" />
                  </th>
                ))}
                {patientCount && (
                  <th className="text-right px-4 py-2" style={{ width: '100px' }}>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-12 ml-auto" />
                  </th>
                )}
                <th className="px-4 py-2 w-24">
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-8" />
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} colCount={skeletonColCount} />
              ))}
            </tbody>
          </table>
        </div>
      ) : items.length === 0 ? (
        <p className="text-gray-400 text-center py-8 text-sm">データがありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                {columns.map(col => (
                  <th key={col.key} className="text-left px-4 py-2 text-xs font-medium text-gray-500" style={{ width: col.width }}>
                    {col.label}
                    {isRequired(col) && <span className="text-red-400 ml-0.5">*</span>}
                  </th>
                ))}
                {patientCount && (
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500" style={{ width: '100px' }}>
                    {patientCount.label || '該当者数'}
                  </th>
                )}
                <th className="px-4 py-2 text-xs text-gray-500 w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id as string} className="border-b hover:bg-gray-50">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-2">
                      {editingId === item.id ? (
                        <div>
                          {col.type === 'boolean' ? (
                            <input
                              type="checkbox"
                              checked={!!form[col.key]}
                              onChange={(e) => setForm({ ...form, [col.key]: e.target.checked })}
                              aria-label={col.label}
                            />
                          ) : col.type === 'color' ? (
                            <input
                              type="color"
                              value={(form[col.key] as string) || '#666'}
                              onChange={(e) => setForm({ ...form, [col.key]: e.target.value })}
                              className="w-10 h-8 rounded cursor-pointer"
                              aria-label={col.label}
                            />
                          ) : col.type === 'select' ? (
                            <select
                              value={(form[col.key] as string) || ''}
                              onChange={(e) => {
                                setForm({ ...form, [col.key]: e.target.value })
                                if (formErrors[col.key]) setFormErrors(prev => { const n = { ...prev }; delete n[col.key]; return n })
                              }}
                              className={inputClass(col.key)}
                              aria-label={col.label}
                              aria-required={isRequired(col)}
                            >
                              <option value="">選択</option>
                              {col.options?.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input
                              type={col.type === 'number' ? 'number' : 'text'}
                              value={(form[col.key] as string | number) ?? ''}
                              onChange={(e) => {
                                setForm({ ...form, [col.key]: col.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value })
                                if (formErrors[col.key]) setFormErrors(prev => { const n = { ...prev }; delete n[col.key]; return n })
                              }}
                              className={inputClass(col.key)}
                              aria-label={col.label}
                              aria-required={isRequired(col)}
                            />
                          )}
                          {formErrors[col.key] && (
                            <p className="text-red-500 text-xs mt-0.5">{formErrors[col.key]}</p>
                          )}
                        </div>
                      ) : (
                        col.type === 'boolean' ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${item[col.key] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {item[col.key] ? '有効' : '無効'}
                          </span>
                        ) : col.type === 'color' ? (
                          <span className="flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full inline-block" style={{ background: (item[col.key] as string) || '#666' }} />
                            <span className="text-xs text-gray-400">{item[col.key] as string}</span>
                          </span>
                        ) : (
                          <span>{item[col.key] as string | number}</span>
                        )
                      )}
                    </td>
                  ))}
                  {patientCount && (
                    <td className="px-4 py-2 text-right">
                      {(() => {
                        const matchKey = patientCount.matchKey || 'name'
                        const name = item[matchKey] as string
                        const count = countMap[name] || 0
                        return count > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-sm font-semibold text-[#14252A]">{count}</span>
                            <span className="text-xs text-gray-400">人</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">0</span>
                        )
                      })()}
                    </td>
                  )}
                  <td className="px-4 py-2">
                    {editingId === item.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={handleSave}
                          className="text-xs text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700 transition"
                          aria-label="保存"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setFormErrors({}) }}
                          className="text-xs text-gray-500 px-2 py-1 hover:text-gray-700 transition"
                          aria-label="編集をキャンセル"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingId(item.id as string); setForm(item); setFormErrors({}) }}
                          className="text-xs text-blue-600 px-2 py-1 hover:text-blue-800 transition"
                          aria-label={`${item.name || '項目'}を編集`}
                        >
                          編集
                        </button>
                        <button
                          onClick={() => requestDelete(item.id as string)}
                          className="text-xs text-red-400 px-2 py-1 hover:text-red-600 transition"
                          aria-label={`${item.name || '項目'}を削除`}
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <DeleteModal onConfirm={confirmDelete} onCancel={cancelDelete} />
      )}

      {/* Undo Toast */}
      {showUndo && (
        <UndoToast onUndo={handleUndo} onDismiss={dismissUndo} />
      )}
    </div>
  )
}
