'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Section = {
  id: string
  icon: string
  title: string
  content: React.ReactNode
}

function Accordion({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-2xl flex-shrink-0">{section.icon}</span>
        <span className="font-bold text-[15px] text-gray-800 flex-1">{section.title}</span>
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-0 text-sm text-gray-600 leading-relaxed border-t border-gray-100">
          {section.content}
        </div>
      )}
    </div>
  )
}

const sections: Section[] = [
  {
    id: 'basic',
    icon: '📖',
    title: '① 基本操作',
    content: (
      <div className="space-y-4 pt-3">
        <div>
          <h4 className="font-bold text-gray-800 mb-1">ログイン・ログアウト</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>ログイン画面でメールアドレスとパスワードを入力して「サインイン」をタップ</li>
            <li>ログアウトはサイドメニュー下部の「ログアウト」から行えます</li>
            <li>パスワードを忘れた場合は、ログイン画面の「パスワードを忘れた方」からリセットメールを送信できます</li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">ホーム画面（ダッシュボード）の見方</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>今月の売上合計・来院数・新規患者数をカードで表示</li>
            <li>月別の売上推移グラフで傾向を確認できます</li>
            <li>直近の来院記録が一覧で表示されます</li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">サイドメニューの構成</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>ホーム — ダッシュボード</li>
            <li>患者一覧 — 患者情報の管理</li>
            <li>来院記録 — 伝票の登録・確認</li>
            <li>売上分析 — 売上・LTV・リピート・ROAS分析</li>
            <li>マスター設定 — 各種マスターデータの管理</li>
            <li>設定 — アカウント設定・データエクスポート</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'patient',
    icon: '👤',
    title: '② 患者管理',
    content: (
      <div className="space-y-4 pt-3">
        <div>
          <h4 className="font-bold text-gray-800 mb-1">患者を新規登録する</h4>
          <ol className="list-decimal ml-5 space-y-1">
            <li>サイドメニューから「患者一覧」を開く</li>
            <li>右上の「+ 新規登録」ボタンをタップ</li>
            <li>氏名・フリガナ・電話番号・生年月日・性別などを入力</li>
            <li>来院動機・主訴（症状）・職業なども登録可能</li>
            <li>「登録」ボタンで保存</li>
          </ol>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">CSVで一括インポート</h4>
          <ol className="list-decimal ml-5 space-y-1">
            <li>患者一覧画面の「インポート」ボタンをタップ</li>
            <li>テンプレートCSVをダウンロードして、患者情報を入力</li>
            <li>ファイルを選択してアップロード</li>
            <li>プレビューを確認して「インポート実行」をタップ</li>
          </ol>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">患者情報の編集・検索</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>患者一覧から名前をタップすると詳細画面に移動</li>
            <li>詳細画面で「編集」ボタンから情報を更新できます</li>
            <li>患者一覧上部の検索バーで氏名・フリガナで検索可能</li>
            <li>ステータス（アクティブ・休眠・離脱）でフィルタリングもできます</li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">音声クイック入力</h4>
          <p>音声クイック入力を使えば、患者名・施術内容・金額を声で入力して、患者登録と来院記録を同時に作成できます。施術直後の記録に便利です。</p>
        </div>
      </div>
    ),
  },
  {
    id: 'visit',
    icon: '📝',
    title: '③ 施術記録',
    content: (
      <div className="space-y-4 pt-3">
        <div>
          <h4 className="font-bold text-gray-800 mb-1">来院記録（伝票）の登録</h4>
          <ol className="list-decimal ml-5 space-y-1">
            <li>患者の詳細画面を開く</li>
            <li>「来院記録を追加」ボタンをタップ</li>
            <li>来院日・施術メニュー・担当スタッフ・金額を入力</li>
            <li>メモ欄に施術内容や経過を記録可能</li>
            <li>「保存」で登録完了</li>
          </ol>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">伝票一覧での確認</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>売上分析メニューの「伝票一覧」から全伝票を確認可能</li>
            <li>日付範囲やスタッフで絞り込みができます</li>
            <li>各伝票をタップすると詳細を確認・編集できます</li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">回数券の管理</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>回数券管理画面から新規発行が可能</li>
            <li>患者を選択し、回数券の種類・回数・金額を設定</li>
            <li>来院時に「消化」ボタンで1回分を消化</li>
            <li>残り回数は一覧で確認できます</li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">CSVインポートで来院履歴を一括登録</h4>
          <p>既存の来院履歴データがある場合、CSVファイルで一括登録が可能です。設定画面のインポート機能をご利用ください。</p>
        </div>
      </div>
    ),
  },
  {
    id: 'sales',
    icon: '📊',
    title: '④ 売上・分析',
    content: (
      <div className="space-y-4 pt-3">
        <div>
          <h4 className="font-bold text-gray-800 mb-1">売上概要</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>月別・日別の売上推移をグラフで確認</li>
            <li>前月比較で売上の増減を把握できます</li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">LTV分析</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>患者1人あたりの生涯売上（LTV）を分析</li>
            <li>性別・年代・症状・来院動機・職業でフィルタリング可能</li>
            <li>LTV上位の患者を把握して、効果的なフォローに活用できます</li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">リピート分析</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>リピート率・来院頻度・来院回数の分布を確認</li>
            <li>リピート率の高い属性を分析して集客施策に反映できます</li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">ROAS分析</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>広告媒体別のROAS（広告費用対効果）を確認</li>
            <li>来院動機別・症状別のROAS分析が可能</li>
            <li>媒体×動機のクロス分析で、どの広告がどの層に効いているか把握</li>
            <li>期間を指定してフィルタリングできます</li>
            <li>各タブの分析結果はCSVでエクスポート可能</li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">月間統計</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>月ごとの新規・再来・総来院数を確認</li>
            <li>来院頻度やリピート率の推移を把握できます</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'master',
    icon: '⚙️',
    title: '⑤ マスター設定',
    content: (
      <div className="space-y-4 pt-3">
        <p>マスター設定では、アプリ全体で使う基本データを管理します。ここで登録した項目が、患者登録や伝票作成時の選択肢に反映されます。</p>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">設定できる項目</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>施術メニュー</strong> — メニュー名と金額を登録。伝票作成時に選択肢として表示されます</li>
            <li><strong>使用者（スタッフ）</strong> — 担当スタッフの一覧。名前・役割・連絡先を管理</li>
            <li><strong>来院動機</strong> — 「紹介」「ホームページ」「チラシ」など、患者がどこで院を知ったか</li>
            <li><strong>症状</strong> — 「腰痛」「肩こり」「頭痛」など、よくある主訴を登録</li>
            <li><strong>職業</strong> — 患者の職業カテゴリを管理</li>
            <li><strong>区分</strong> — 患者のカテゴリ分類</li>
            <li><strong>広告費</strong> — 媒体ごとの月別広告費を登録。ROAS分析に使用されます</li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">操作方法</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>「+ 追加」ボタンで新しい項目を追加</li>
            <li>各行をタップして内容を直接編集</li>
            <li>不要な項目は削除ボタンで削除可能</li>
            <li>並び順はドラッグで変更できます</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'faq',
    icon: '❓',
    title: '⑥ よくある質問',
    content: (
      <div className="space-y-5 pt-3">
        <div>
          <p className="font-bold text-gray-800">Q: パスワードを忘れてしまいました</p>
          <p className="mt-1">A: ログイン画面の「パスワードを忘れた方」をタップしてください。登録メールアドレスにリセット用のメールが届きます。メール内のリンクから新しいパスワードを設定できます。</p>
        </div>
        <div>
          <p className="font-bold text-gray-800">Q: CSVファイルが文字化けします</p>
          <p className="mt-1">A: 本アプリのCSVはBOM付きUTF-8形式で出力されるため、Excel（2016以降）でそのまま開けます。古いExcelの場合は「データ」タブの「テキストファイルの取り込み」からUTF-8を指定して開いてください。</p>
        </div>
        <div>
          <p className="font-bold text-gray-800">Q: 患者データのバックアップはどうすればいいですか？</p>
          <p className="mt-1">A: 設定画面の「データエクスポート」からCSVをダウンロードしてください。患者データと来院記録のそれぞれをエクスポートできます。定期的にダウンロードしておくと安心です。</p>
        </div>
        <div>
          <p className="font-bold text-gray-800">Q: スマホからも使えますか？</p>
          <p className="mt-1">A: はい、スマホのブラウザからそのまま利用できます。ホーム画面に追加すると、アプリのように素早くアクセスできて便利です。</p>
        </div>
        <div>
          <p className="font-bold text-gray-800">Q: 複数のスタッフで使えますか？</p>
          <p className="mt-1">A: はい、スタッフごとにアカウントを作成して利用できます。全員が同じ院のデータを共有して操作できます。</p>
        </div>
        <div>
          <p className="font-bold text-gray-800">Q: その他のご質問・お困りごと</p>
          <p className="mt-1">A: 下記のLINEからお気軽にお問い合わせください。</p>
          <a
            href="https://lin.ee/182seszw"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-[#06C755] text-white text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            LINEでお問い合わせ
          </a>
        </div>
      </div>
    ),
  },
]

export default function HelpPage() {
  const router = useRouter()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* 戻るボタン */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        戻る
      </button>

      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">使い方ガイド</h1>
        <p className="text-sm text-gray-500 mt-1">各セクションをタップして詳細を確認できます</p>
      </div>

      {/* アコーディオンリスト */}
      <div className="space-y-3">
        {sections.map(section => (
          <Accordion key={section.id} section={section} />
        ))}
      </div>

      {/* フッター */}
      <div className="mt-8 p-4 bg-[#14252A] rounded-xl text-white text-center">
        <p className="text-sm font-bold mb-2">お困りの点がありましたら</p>
        <a
          href="https://lin.ee/182seszw"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2 bg-[#06C755] text-white text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
        >
          LINEでお問い合わせ
        </a>
      </div>
    </div>
  )
}
