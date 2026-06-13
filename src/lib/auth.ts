'use server'

import { cookies } from 'next/headers'

export type SessionRol = 'superadmin' | 'admin_comercio' | 'empleado'

export interface Session {
  rol: SessionRol
  nombre: string
  businessId?: string
  branchId?: string
  userId?: string
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const rol = cookieStore.get('session_rol')?.value as SessionRol | undefined
  const nombre = cookieStore.get('session_user')?.value || ''
  const businessId = cookieStore.get('session_business_id')?.value
  const branchId = cookieStore.get('session_branch_id')?.value
  const userId = cookieStore.get('session_user_id')?.value

  if (!rol) return null

  return { rol, nombre, businessId, branchId, userId }
}

export async function setSessionCookies(
  response: Response,
  session: Session,
  rememberMe: boolean = false
) {
  const maxAge = rememberMe ? 86400 : undefined // 24h o sesión
  const cookieOptions = `; path=/; SameSite=Strict${maxAge ? `; Max-Age=${maxAge}` : ''}`
  
  return [
    `session_rol=${session.rol}${cookieOptions}`,
    `session_user=${session.nombre}${cookieOptions}`,
    `session_business_id=${session.businessId || ''}${cookieOptions}`,
    `session_branch_id=${session.branchId || ''}${cookieOptions}`,
    `session_user_id=${session.userId || ''}${cookieOptions}`,
  ]
}
