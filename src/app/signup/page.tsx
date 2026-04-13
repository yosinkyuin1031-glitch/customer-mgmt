'use client'

import Link from 'next/link'

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #14252A 0%, #1a3a42 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Clinic Core</h1>
          <p className="text-gray-300 text-sm mt-1">治療院向け顧客管理システム</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 text-center space-y-4">
          <div className="py-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">
              このサービスはアカウント発行制です。<br />
              ご利用希望の方は管理者にお問い合わせください。
            </p>
          </div>

          <Link
            href="/login"
            className="block w-full py-3 rounded-xl text-white font-bold text-sm transition-all"
            style={{ background: '#14252A' }}
          >
            ログインはこちら
          </Link>
        </div>

        <div className="flex justify-center gap-4 mt-4 text-xs text-gray-400">
          <a href="https://kensa-sheet-app.vercel.app/terms/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-200 transition-colors">
            利用規約
          </a>
          <span>|</span>
          <a href="https://kensa-sheet-app.vercel.app/privacy/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-200 transition-colors">
            プライバシーポリシー
          </a>
        </div>
      </div>
    </div>
  )
}
