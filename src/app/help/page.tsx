'use client'

import { useState } from 'react'
import Link from 'next/link'

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

function HelpLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[#14252A] font-semibold underline underline-offset-2 hover:opacity-70">
      {children}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </Link>
  )
}

const sections: Section[] = [
  {
    id: 'intro',
    icon: '📖',
    title: 'はじめに — このアプリでできること',
    content: (
      <div className="space-y-3 pt-3">
        <p>顧客管理シートは、治療院の日々の業務をまとめて管理できるアプリです。</p>
        <ul className="space-y-2 ml-1">
          <li className="flex items-start gap-2"><span className="text-[#14252A] font-bold">1.</span>患者情報の登録・管理</li>
          <li className="flex items-start gap-2"><span className="text-[#14252A] font-bold">2.</span>来院記録（伝票）の管理</li>
          <li className="flex items-start gap-2"><span className="text-[#14252A] font-bold">3.</span>売上分析・リピート率・LTV分析</li>
          <li className="flex items-start gap-2"><span className="text-[#14252A] font-bold">4.</span>SMS送信による患者フォロー</li>
          <li className="flex items-start gap-2"><span className="text-[#14252A] font-bold">5.</span>回数券の発行・管理</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'register-patient',
    icon: '👤',
    title: '患者を登録する',
    content: (
      <div className="space-y-4 pt-3">
        <div>
          <h4 className="font-bold text-gray-800 mb-1">CSV一括インポート</h4>
          <p>既存の患者リストをCSVファイルで一括登録できます。</p>
          <ol className="list-decimal ml-5 mt-2 space-y-1">
            <li><HelpLink href="/patients/import">患者インポート画面</HelpLink> を開く</li>
            <li>CSVテンプレートをダウンロードして、患者情報を入力</li>
            <li>ファイルを選択してアップロード</li>
            <li>プレビューを確認して「インポート」をタップ</li>
          </ol>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">手動で1人ずつ登録</h4>
          <ol className="list-decimal ml-5 mt-2 space-y-1">
            <li><HelpLink href="/patients/new">新規患者登録画面</HelpLink> を開く</li>
            <li>氏名・フリガナ・電話番号などを入力</li>
            <li>「登録」ボタンをタップ</li>
          </ol>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">音声一括入力</h4>
          <p><HelpLink href="/visits/quick">音声クイック入力画面</HelpLink> から、声で患者情報と来院記録をまとめて入力できます。施術後すぐに記録したい時に便利です。</p>
        </div>
      </div>
    ),
  },
  {
    id: 'visit-record',
    icon: '📝',
    title: '来院記録をつける',
    content: (
      <div className="space-y-4 pt-3">
        <div>
          <h4 className="font-bold text-gray-800 mb-1">伝票の登録方法</h4>
          <ol className="list-decimal ml-5 mt-2 space-y-1">
            <li>患者の詳細画面を開く</li>
            <li>「来院記録を追加」ボタンをタップ</li>
            <li>日付・施術メニュー・担当スタッフ・金額を入力</li>
            <li>「保存」をタップ</li>
          </ol>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">音声入力で一括登録</h4>
          <p><HelpLink href="/visits/quick">音声クイック入力</HelpLink> を使えば、「山田太郎、骨盤矯正、5500円」のように話すだけで来院記録を登録できます。</p>
        </div>
      </div>
    ),
  },
  {
    id: 'sales-analysis',
    icon: '📊',
    title: '売上を分析する',
    content: (
      <div className="space-y-4 pt-3">
        <div>
          <h4 className="font-bold text-gray-800 mb-1">ダッシュボード</h4>
          <p><HelpLink href="/">ホーム画面</HelpLink> では、今月の売上・来院数・新規患者数などが一目で確認できます。</p>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">売上分析の各画面</h4>
          <ul className="space-y-2 ml-1 mt-2">
            <li><HelpLink href="/sales">売上概要</HelpLink> — 月別・日別の売上推移</li>
            <li><HelpLink href="/sales/slips">伝票一覧</HelpLink> — 登録した伝票の詳細確認</li>
            <li><HelpLink href="/stats">月間統計</HelpLink> — リピート率・LTV・来院頻度などの分析</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'coupon-books',
    icon: '🎟️',
    title: '回数券を管理する',
    content: (
      <div className="space-y-3 pt-3">
        <p><HelpLink href="/coupon-books">回数券管理画面</HelpLink> から操作できます。</p>
        <ol className="list-decimal ml-5 mt-2 space-y-1">
          <li>「新規発行」をタップ</li>
          <li>患者を選択し、回数券の種類・回数・金額を入力</li>
          <li>来院時に「消化」ボタンで1回分を消化</li>
          <li>残り回数はリストで一覧確認できます</li>
        </ol>
      </div>
    ),
  },
  {
    id: 'sms',
    icon: '💬',
    title: 'SMS送信',
    content: (
      <div className="space-y-4 pt-3">
        <div>
          <h4 className="font-bold text-gray-800 mb-1">患者にSMSを送る手順</h4>
          <ol className="list-decimal ml-5 mt-2 space-y-1">
            <li><HelpLink href="/sms">SMS送信画面</HelpLink> を開く</li>
            <li>送信先の患者を選択（複数選択可）</li>
            <li>メッセージを入力して「送信」をタップ</li>
          </ol>
        </div>
        <div>
          <h4 className="font-bold text-gray-800 mb-1">テンプレートの使い方</h4>
          <p>よく使うメッセージはテンプレートとして保存できます。送信画面でテンプレートを選択すると、本文が自動入力されます。</p>
        </div>
      </div>
    ),
  },
  {
    id: 'export',
    icon: '📤',
    title: 'データのエクスポート',
    content: (
      <div className="space-y-3 pt-3">
        <p><HelpLink href="/settings">設定画面</HelpLink> から、患者データや来院記録をCSVファイルとしてダウンロードできます。</p>
        <ol className="list-decimal ml-5 mt-2 space-y-1">
          <li>設定画面を開く</li>
          <li>「データエクスポート」セクションを探す</li>
          <li>ダウンロードしたいデータの種類を選択</li>
          <li>「CSVダウンロード」をタップ</li>
        </ol>
        <p className="text-xs text-gray-500">※ バックアップとして定期的にダウンロードしておくことをおすすめします。</p>
      </div>
    ),
  },
  {
    id: 'master',
    icon: '⚙️',
    title: 'マスタ設定',
    content: (
      <div className="space-y-3 pt-3">
        <p><HelpLink href="/master">マスター設定画面</HelpLink> から、アプリで使う基本情報を登録・編集できます。</p>
        <ul className="space-y-2 ml-1 mt-2">
          <li><strong>施術メニュー</strong> — メニュー名と金額を登録</li>
          <li><strong>スタッフ</strong> — 担当スタッフの追加・編集</li>
          <li><strong>来院動機</strong> — 患者がどこで院を知ったか（紹介、HP、チラシなど）</li>
        </ul>
        <p className="mt-2">ここで登録した項目が、伝票の入力画面などの選択肢に表示されます。</p>
      </div>
    ),
  },
  {
    id: 'faq',
    icon: '❓',
    title: 'よくある質問',
    content: (
      <div className="space-y-5 pt-3">
        <div>
          <p className="font-bold text-gray-800">Q: CSVファイルが文字化けします</p>
          <p className="mt-1">A: 本アプリのCSVはBOM付きUTF-8形式で出力されるため、Excel（2016以降）でそのまま開けます。古いExcelの場合は「データ」タブの「テキストファイルの取り込み」からUTF-8を指定して開いてください。</p>
        </div>
        <div>
          <p className="font-bold text-gray-800">Q: 患者数の上限を超えたと表示されます</p>
          <p className="mt-1">A: フリープランでは登録可能な患者数に上限があります。<HelpLink href="/settings">設定画面</HelpLink> からベーシックプランにアップグレードすると、上限が拡大されます。</p>
        </div>
        <div>
          <p className="font-bold text-gray-800">Q: データのバックアップはどうすればいいですか？</p>
          <p className="mt-1">A: <HelpLink href="/settings">設定画面</HelpLink> の「データエクスポート」からCSVをダウンロードしてください。定期的にダウンロードしておくと安心です。</p>
        </div>
      </div>
    ),
  },
]

export default function HelpPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-2xl">📘</span>
          使い方ガイド
        </h1>
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
        <p className="text-sm font-bold mb-1">お困りの点がありましたら</p>
        <p className="text-xs opacity-80">設定画面のお問い合わせ、またはサポートLINEまでご連絡ください</p>
      </div>
    </div>
  )
}
