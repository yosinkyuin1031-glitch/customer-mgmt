/**
 * 患者名マッチングユーティリティ
 * 全角/半角スペース、表記ゆれ、部分一致に対応
 */

/** 名前を正規化（スペース除去、全角→半角、カタカナ→ひらがな） */
export function normalizeName(name: string): string {
  return name
    // 全角・半角スペースをすべて除去
    .replace(/[\s\u3000\u00A0]+/g, '')
    // 全角英数を半角に
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    // カタカナをひらがなに（ふりがなマッチング用）
    .replace(/[\u30A1-\u30F6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .toLowerCase()
}

interface PatientCandidate {
  id: string
  name: string
  furigana?: string | null
}

/**
 * 患者リストから最も一致する患者を見つける
 * 優先度: 完全一致 > 正規化一致 > 部分一致 > ふりがな一致
 */
export function findBestMatch(
  query: string,
  patients: PatientCandidate[]
): PatientCandidate | null {
  if (!query || query.trim() === '') return null

  const normalizedQuery = normalizeName(query)

  // 1. 完全一致（そのまま）
  const exact = patients.find(p => p.name === query)
  if (exact) return exact

  // 2. 正規化した名前で完全一致
  const normalizedExact = patients.find(p => normalizeName(p.name) === normalizedQuery)
  if (normalizedExact) return normalizedExact

  // 3. ふりがなで完全一致
  const furiganaExact = patients.find(p => p.furigana && normalizeName(p.furigana) === normalizedQuery)
  if (furiganaExact) return furiganaExact

  // 4. 名前に含まれている（部分一致）
  const nameContains = patients.find(p => normalizeName(p.name).includes(normalizedQuery))
  if (nameContains) return nameContains

  // 5. クエリに名前が含まれている（「山田太郎さん」→「山田太郎」）
  const queryContains = patients.find(p => normalizedQuery.includes(normalizeName(p.name)))
  if (queryContains) return queryContains

  // 6. ふりがなの部分一致
  const furiganaContains = patients.find(p =>
    p.furigana && normalizeName(p.furigana).includes(normalizedQuery)
  )
  if (furiganaContains) return furiganaContains

  // 7. 姓だけで一致（クエリが短い場合）
  if (normalizedQuery.length <= 4) {
    const lastNameMatch = patients.filter(p => normalizeName(p.name).startsWith(normalizedQuery))
    if (lastNameMatch.length === 1) return lastNameMatch[0] // 1人だけなら確定
  }

  // 8. レーベンシュタイン距離で最も近い候補（閾値付き）
  let bestDist = Infinity
  let bestCandidate: PatientCandidate | null = null
  for (const p of patients) {
    const dist = levenshtein(normalizedQuery, normalizeName(p.name))
    const threshold = Math.max(1, Math.floor(normalizeName(p.name).length * 0.3))
    if (dist < bestDist && dist <= threshold) {
      bestDist = dist
      bestCandidate = p
    }
  }

  return bestCandidate
}

/** レーベンシュタイン距離 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
      )
    }
  }
  return dp[m][n]
}
