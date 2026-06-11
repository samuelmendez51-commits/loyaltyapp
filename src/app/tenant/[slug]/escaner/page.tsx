'use client'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function RedirectToDashboardScanner() {
  const router = useRouter()
  const { slug } = useParams()
  
  useEffect(() => {
    router.replace(`/tenant/${slug}/dashboard?tab=escaner`)
  }, [router, slug])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#dc2626]"></div>
    </div>
  )
}