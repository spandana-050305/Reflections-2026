import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from './lib/local-auth'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API routes handle their own auth — never redirect them
  if (pathname.startsWith('/api/')) return NextResponse.next()

  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value

  let user: { user_metadata: { role: string } } | null = null
  try {
    if (sessionCookie) user = JSON.parse(decodeURIComponent(sessionCookie))
  } catch {}

  const role = user?.user_metadata?.role

  // Not logged in → send to login page
  if (!user && pathname !== '/') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Already logged in → skip login page, go to dashboard
  if (user && pathname === '/') {
    if (role === 'school')      return NextResponse.redirect(new URL('/school/dashboard', request.url))
    if (role === 'club_member') return NextResponse.redirect(new URL('/club/dashboard', request.url))
    if (role === 'final_year')  return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  // Portal protection — wrong role gets kicked back to login
  if (user) {
    if (pathname.startsWith('/school') && role !== 'school')      return NextResponse.redirect(new URL('/', request.url))
    if (pathname.startsWith('/club')   && role !== 'club_member') return NextResponse.redirect(new URL('/', request.url))
    if (pathname.startsWith('/admin')  && role !== 'final_year')  return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
