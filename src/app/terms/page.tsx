import Link from 'next/link'

export const metadata = {
  title: '利用規約 | 顧客管理シート',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-[#14252A] text-white py-4 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors">
            &larr; ログインに戻る
          </Link>
          <span className="text-sm font-bold">顧客管理シート</span>
        </div>
      </header>

      {/* 本文 */}
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-10">
          <h1 className="text-2xl font-bold text-[#14252A] mb-2">利用規約</h1>
          <p className="text-sm text-gray-500 mb-8">施行日: 2026年3月27日</p>

          <div className="space-y-8 text-sm leading-relaxed text-gray-700">
            {/* 第1条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第1条（本サービスの概要）</h2>
              <p>
                本規約は、大口神経整体院（以下「当院」といいます）が提供するクラウド型顧客管理サービス「顧客管理シート」（以下「本サービス」といいます）の利用条件を定めるものです。本サービスは、治療院・整骨院・鍼灸院等の施術者向けに、患者情報の管理、来院履歴の記録、売上集計等の機能を提供するSaaSです。
              </p>
              <p className="mt-2">
                利用者は、本規約に同意のうえ本サービスを利用するものとし、アカウントを作成した時点で本規約に同意したものとみなします。
              </p>
            </section>

            {/* 第2条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第2条（アカウントと責任）</h2>
              <ol className="list-decimal pl-5 space-y-1">
                <li>利用者は、正確な情報を登録し、自己の責任においてアカウントを管理するものとします。</li>
                <li>ログイン情報の管理不備により生じた損害について、当院は一切の責任を負いません。</li>
                <li>アカウントの共有・譲渡は禁止します。院内スタッフの追加はスタッフ招待機能をご利用ください。</li>
              </ol>
            </section>

            {/* 第3条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第3条（利用料金）</h2>
              <ol className="list-decimal pl-5 space-y-1">
                <li>本サービスの利用料金は、各プランの内容に準じます。</li>
                <li>料金の変更がある場合は、事前に通知いたします。</li>
                <li>支払い済みの料金は、原則として返金いたしません。</li>
              </ol>
            </section>

            {/* 第4条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第4条（禁止事項）</h2>
              <p>利用者は、以下の行為を行ってはなりません。</p>
              <ol className="list-decimal pl-5 space-y-1 mt-2">
                <li>不正アクセス、またはそれを試みる行為</li>
                <li>本サービスで管理するデータの二次利用、転売、外部公開</li>
                <li>他の利用者のアカウントを不正に利用する行為</li>
                <li>本サービスの運営を妨害する行為</li>
                <li>法令または公序良俗に反する行為</li>
                <li>リバースエンジニアリング、スクレイピング等の技術的な不正行為</li>
              </ol>
            </section>

            {/* 第5条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第5条（サービスの変更・停止）</h2>
              <ol className="list-decimal pl-5 space-y-1">
                <li>当院は、事前の通知なく本サービスの内容を変更、または一時的に停止することがあります。</li>
                <li>システムメンテナンス、天災、その他やむを得ない事由による停止について、当院は責任を負いません。</li>
                <li>サービスの重大な変更・終了については、30日前までに通知いたします。</li>
              </ol>
            </section>

            {/* 第6条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第6条（免責事項）</h2>
              <ol className="list-decimal pl-5 space-y-1">
                <li>当院は、本サービスの利用により生じた損害について、当院の故意または重大な過失による場合を除き、一切の責任を負いません。</li>
                <li>データの消失・破損については、バックアップ体制を整備しておりますが、完全な復旧を保証するものではありません。利用者自身でも定期的なデータのバックアップを推奨します。</li>
                <li>本サービスは現状有姿で提供されるものであり、特定目的への適合性を保証するものではありません。</li>
              </ol>
            </section>

            {/* 第7条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第7条（知的財産権）</h2>
              <p>
                本サービスに関する著作権、商標権その他一切の知的財産権は当院に帰属します。利用者が本サービスに入力したデータの権利は利用者に帰属します。
              </p>
            </section>

            {/* 第8条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第8条（規約の変更）</h2>
              <p>
                当院は、必要に応じて本規約を変更することがあります。変更後の規約は、本サービス上に掲載した時点で効力を生じるものとします。重要な変更については、メール等で通知いたします。
              </p>
            </section>

            {/* 第9条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第9条（準拠法・管轄裁判所）</h2>
              <ol className="list-decimal pl-5 space-y-1">
                <li>本規約は日本法に準拠し、日本法に従って解釈されるものとします。</li>
                <li>本サービスに関する紛争については、当院所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。</li>
              </ol>
            </section>

            {/* 運営者情報 */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-base font-bold text-[#14252A] mb-2">運営者情報</h2>
              <table className="text-sm">
                <tbody>
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">運営者</td>
                    <td className="py-1">大口神経整体院（個人事業主）</td>
                  </tr>
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">代表</td>
                    <td className="py-1">大口 陽平</td>
                  </tr>
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">お問い合わせ</td>
                    <td className="py-1">oguchi.seitai@gmail.com</td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>

          {/* フッターリンク */}
          <div className="mt-10 pt-6 border-t flex flex-wrap gap-4 text-sm">
            <Link href="/privacy" className="text-blue-600 hover:underline">
              プライバシーポリシー
            </Link>
            <Link href="/login" className="text-blue-600 hover:underline">
              ログイン
            </Link>
            <Link href="/signup" className="text-blue-600 hover:underline">
              アカウント作成
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
