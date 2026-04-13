'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getClinicId } from '@/lib/clinic'

interface PrintPatient {
  id: string
  name: string
  furigana: string
  zipcode: string
  prefecture: string
  city: string
  address: string
  building: string
}

interface FacilityInfo {
  facility_name: string
  zipcode: string
  address: string
  phone: string
}

export default function PrintAddressPage() {
  const supabase = createClient()
  const clinicId = getClinicId()
  const [patients, setPatients] = useState<PrintPatient[]>([])
  const [facility, setFacility] = useState<FacilityInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      // sessionStorageから選択IDを取得
      const raw = sessionStorage.getItem('printAddressIds')
      if (!raw) { setLoading(false); return }
      const ids: string[] = JSON.parse(raw)
      if (ids.length === 0) { setLoading(false); return }

      // 患者データ取得（住所あり）
      const { data: pData } = await supabase
        .from('cm_patients')
        .select('id, name, furigana, zipcode, prefecture, city, address, building')
        .eq('clinic_id', clinicId)
        .in('id', ids)

      if (pData) {
        setPatients(pData.filter(p => p.prefecture || p.city || p.address))
      }

      // 施設情報取得
      const { data: fData } = await supabase
        .from('cm_facility_info')
        .select('facility_name, zipcode, address, phone')
        .eq('clinic_id', clinicId)
        .limit(1)
        .single()

      if (fData) setFacility(fData)
      setLoading(false)
    }
    load()
  }, [])

  const formatZip = (zip: string) => {
    if (!zip) return ''
    const digits = zip.replace(/[^\d]/g, '')
    if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return zip
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    )
  }

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-500">住所のある患者が選択されていません</p>
        <Link href="/patients" className="text-blue-600 hover:underline text-sm">患者一覧に戻る</Link>
      </div>
    )
  }

  return (
    <>
      {/* 画面操作バー（印刷時は非表示） */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b shadow-sm px-4 py-3 flex items-center gap-3">
        <Link href="/patients" className="text-sm text-gray-600 hover:text-gray-800">
          ← 患者一覧に戻る
        </Link>
        <div className="flex-1" />
        <span className="text-sm text-gray-500">{patients.length}枚</span>
        <button
          onClick={() => window.print()}
          className="px-6 py-2 rounded-lg text-white font-bold text-sm bg-orange-500 hover:bg-orange-600 shadow-sm"
        >
          印刷する
        </button>
      </div>

      {/* はがきカード */}
      <div className="print:p-0 p-4 flex flex-wrap justify-center gap-4 print:gap-0 print:block">
        {patients.map((p, idx) => (
          <div
            key={p.id}
            className="hagaki-card border border-gray-300 print:border-none bg-white relative overflow-hidden"
            style={{
              width: '100mm',
              height: '148mm',
              padding: '10mm',
              boxSizing: 'border-box',
              pageBreakAfter: idx < patients.length - 1 ? 'always' : 'auto',
            }}
          >
            {/* 郵便番号枠 */}
            <div className="absolute" style={{ top: '12mm', left: '44mm', display: 'flex', gap: '3.5mm' }}>
              {formatZip(p.zipcode).replace('-', '').split('').map((d, i) => (
                <div key={i} style={{
                  width: '6mm', height: '8.5mm',
                  border: '0.5px solid #cc0000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontFamily: 'serif', color: '#333',
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* 宛先住所（右側） */}
            <div className="absolute" style={{ top: '30mm', right: '12mm', writingMode: 'vertical-rl' }}>
              <p style={{ fontSize: '12px', lineHeight: '1.8', color: '#333', fontFamily: 'serif' }}>
                {p.prefecture}{p.city}{p.address}
              </p>
              {p.building && (
                <p style={{ fontSize: '10px', lineHeight: '1.8', color: '#555', fontFamily: 'serif', marginRight: '4mm' }}>
                  {p.building}
                </p>
              )}
            </div>

            {/* 宛名（中央） */}
            <div className="absolute" style={{ top: '35mm', left: '50%', transform: 'translateX(-50%)', writingMode: 'vertical-rl', textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'serif', color: '#111', letterSpacing: '4px' }}>
                {p.name}
                <span style={{ fontSize: '16px', marginTop: '6mm', display: 'inline-block' }}> 様</span>
              </p>
            </div>

            {/* 差出人（左下） */}
            {facility && (
              <div className="absolute" style={{ bottom: '10mm', left: '8mm', writingMode: 'vertical-rl' }}>
                {facility.zipcode && (
                  <p style={{ fontSize: '7px', color: '#666', fontFamily: 'serif' }}>
                    〒{formatZip(facility.zipcode)}
                  </p>
                )}
                <p style={{ fontSize: '8px', color: '#555', fontFamily: 'serif', lineHeight: '1.6' }}>
                  {facility.address}
                </p>
                <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#333', fontFamily: 'serif', marginRight: '2mm' }}>
                  {facility.facility_name}
                </p>
                {facility.phone && (
                  <p style={{ fontSize: '7px', color: '#666', fontFamily: 'serif', marginRight: '1mm' }}>
                    TEL {facility.phone}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 印刷用CSS */}
      <style jsx global>{`
        @media print {
          @page {
            size: 100mm 148mm;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .hagaki-card {
            width: 100mm !important;
            height: 148mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </>
  )
}
