import Link from 'next/link'

export const metadata = {
  title: 'プライバシーポリシー | 顧客管理シート',
}

export default function PrivacyPage() {
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
          <h1 className="text-2xl font-bold text-[#14252A] mb-2">プライバシーポリシー</h1>
          <p className="text-sm text-gray-500 mb-8">施行日: 2026年3月27日</p>

          <div className="space-y-8 text-sm leading-relaxed text-gray-700">
            <p>
              大口神経整体院（以下「当院」といいます）は、クラウド型顧客管理サービス「顧客管理シート」（以下「本サービス」といいます）における個人情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。
            </p>

            {/* 第1条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第1条（収集する情報）</h2>
              <p>当院は、本サービスの提供にあたり、以下の情報を収集します。</p>
              <ol className="list-decimal pl-5 space-y-2 mt-2">
                <li>
                  <span className="font-medium">アカウント情報</span>
                  <br />メールアドレス、パスワード（ハッシュ化して保存）、院名
                </li>
                <li>
                  <span className="font-medium">患者情報</span>
                  <br />利用者が登録する患者の氏名、フリガナ、生年月日、性別、連絡先、住所、施術記録、来院履歴等
                </li>
                <li>
                  <span className="font-medium">利用ログ</span>
                  <br />アクセス日時、利用機能、IPアドレス、ブラウザ情報等
                </li>
              </ol>
            </section>

            {/* 第2条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第2条（利用目的）</h2>
              <p>収集した情報は、以下の目的で利用します。</p>
              <ol className="list-decimal pl-5 space-y-1 mt-2">
                <li>本サービスの提供、運用、維持</li>
                <li>利用者へのサポート対応</li>
                <li>サービスの改善、新機能の開発</li>
                <li>利用状況の分析、統計データの作成（個人を特定しない形式）</li>
                <li>重要なお知らせ、規約変更等の通知</li>
              </ol>
            </section>

            {/* 第3条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第3条（第三者提供）</h2>
              <p>当院は、以下の場合を除き、個人情報を第三者に提供いたしません。</p>
              <ol className="list-decimal pl-5 space-y-1 mt-2">
                <li>利用者の同意がある場合</li>
                <li>法令に基づく場合</li>
                <li>人の生命、身体または財産の保護のために必要な場合</li>
              </ol>
              <p className="mt-3">なお、本サービスの運営にあたり、以下の業務委託先サービスを利用しています。</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><span className="font-medium">Supabase</span> - データベース、認証基盤（データの保存・管理）</li>
                <li><span className="font-medium">Stripe</span> - 決済処理（クレジットカード情報の処理。当院ではカード情報を保持しません）</li>
                <li><span className="font-medium">Twilio</span> - SMS送信（予約リマインド等の通知）</li>
                <li><span className="font-medium">Vercel</span> - アプリケーションホスティング</li>
              </ul>
              <p className="mt-2">
                各委託先は、それぞれのプライバシーポリシーに基づき適切にデータを管理しています。
              </p>
            </section>

            {/* 第4条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第4条（安全管理措置）</h2>
              <p>当院は、個人情報の漏洩、紛失、改ざんを防止するために、以下の措置を講じています。</p>
              <ol className="list-decimal pl-5 space-y-1 mt-2">
                <li>SSL/TLS暗号化による通信の保護</li>
                <li>Supabase Row Level Security（RLS）による院ごとのデータアクセス制限</li>
                <li>パスワードのハッシュ化保存</li>
                <li>管理者のアクセス権限の制限</li>
                <li>定期的なセキュリティ対策の見直し</li>
              </ol>
            </section>

            {/* 第5条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第5条（データの保存期間）</h2>
              <ol className="list-decimal pl-5 space-y-1">
                <li>アカウント情報は、アカウント削除の申請を受けてから30日以内に削除します。</li>
                <li>患者情報は、利用者が削除するまで保存します。アカウント削除時には全データを削除します。</li>
                <li>利用ログは、サービス改善の目的で最大1年間保存し、その後自動的に削除します。</li>
              </ol>
            </section>

            {/* 第6条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第6条（開示・訂正・削除の請求）</h2>
              <p>
                利用者は、当院に対して自己の個人情報の開示、訂正、追加、削除、利用停止を請求することができます。請求は下記のお問い合わせ先までご連絡ください。本人確認のうえ、合理的な期間内に対応いたします。
              </p>
            </section>

            {/* 第7条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第7条（Cookieの利用）</h2>
              <p>
                本サービスでは、認証状態の維持のためにCookieを使用しています（Supabase Authによるセッション管理）。ブラウザの設定でCookieを無効にした場合、本サービスの一部機能が利用できなくなることがあります。
              </p>
            </section>

            {/* 第8条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第8条（ポリシーの変更）</h2>
              <p>
                当院は、必要に応じて本ポリシーを変更することがあります。変更後のポリシーは、本サービス上に掲載した時点で効力を生じるものとします。重要な変更については、メール等で通知いたします。
              </p>
            </section>

            {/* 第9条 */}
            <section>
              <h2 className="text-base font-bold text-[#14252A] mb-2">第9条（お問い合わせ）</h2>
              <p>個人情報の取扱いに関するお問い合わせは、以下までご連絡ください。</p>
              <table className="text-sm mt-3">
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
                    <td className="pr-4 py-1 text-gray-500">メール</td>
                    <td className="py-1">oguchi.seitai@gmail.com</td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>

          {/* フッターリンク */}
          <div className="mt-10 pt-6 border-t flex flex-wrap gap-4 text-sm">
            <Link href="/terms" className="text-blue-600 hover:underline">
              利用規約
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
