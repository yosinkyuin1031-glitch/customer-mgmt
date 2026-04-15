'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MapRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/sales/area-ltv')
  }, [router])
  return null
}
