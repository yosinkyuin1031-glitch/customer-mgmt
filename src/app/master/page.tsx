import Link from 'next/link'

const sections = [
  { title: '1. 基本情報マスター管理', items: [
    { href: '/master/facility', label: '施設基本情報', desc: '院名・住所・営業時間' },
    { href: '/master/regular-holidays', label: '定休日設定', desc: '曜日ごとの定休日' },
    { href: '/master/irregular-holidays', label: '不定休日設定', desc: '臨時休業・祝日' },
    { href: '/master/display-columns', label: '顧客一覧表示項目', desc: '一覧に表示する列' },
  ]},
  { title: '2. 顧客関連マスター管理', items: [
    { href: '/master/visit-motives', label: '来店動機', desc: 'Google検索・紹介等' },
    { href: '/master/occupations', label: '職業', desc: '会社員・自営業等' },
    { href: '/master/customer-categories', label: '顧客区分', desc: '新規・リピーター・VIP等' },
    { href: '/master/symptoms', label: '症状', desc: '腰痛・肩こり等' },
  ]},
  { title: '3. メニューマスター管理', items: [
    { href: '/master/menu-categories', label: '分類', desc: 'メニューのカテゴリ' },
    { href: '/master/base-menus', label: '基本メニュー', desc: '施術メニュー・料金' },
    { href: '/master/option-menus', label: 'オプションメニュー', desc: '追加オプション' },
  ]},
  { title: '4. その他マスター管理', items: [
    { href: '/master/staff', label: '使用者管理', desc: 'スタッフ情報' },
  ]},
]

export default function MasterPage() {
  return (
    <div className="space-y-4">
      {sections.map(s => (
        <div key={s.title} className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-gray-800 text-sm mb-3 border-b pb-2">{s.title}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {s.items.map(item => (
              <Link key={item.href} href={item.href} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-all">
                <p className="font-medium text-sm text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
