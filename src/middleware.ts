import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API routes handle their own auth — never redirect them
  if (pathname.startsWith('/api/')) return NextResponse.next()

  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value, ...options })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value: '', ...options })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role as string | undefined

  // Public routes — no login required
  const publicRoutes = ['/', '/login', '/results']
  if (!user && !publicRoutes.some(r => pathname === r || pathname.startsWith('/results'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Already logged in → skip login/landing page, go to dashboard
  if (user && (pathname === '/' || pathname === '/login')) {
    if (role === 'school')       return NextResponse.redirect(new URL('/school/dashboard', request.url))
    if (role === 'club_member')  return NextResponse.redirect(new URL('/club/dashboard', request.url))
    if (role === 'final_year')   return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    if (role === 'guest')        return NextResponse.redirect(new URL('/guest/evaluate', request.url))
    if (role === 'super_admin')  return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  // Portal protection — wrong role gets kicked back to login
  if (user) {
    if (pathname.startsWith('/school')      && role !== 'school')                                          return NextResponse.redirect(new URL('/login', request.url))
    if (pathname.startsWith('/club')        && role !== 'club_member')                                     return NextResponse.redirect(new URL('/login', request.url))
    if (pathname.startsWith('/admin')       && role !== 'final_year' && role !== 'super_admin')            return NextResponse.redirect(new URL('/login', request.url))
    if (pathname.startsWith('/superadmin')  && role !== 'super_admin')                                     return NextResponse.redirect(new URL('/login', request.url))
    if (pathname.startsWith('/guest')       && role !== 'guest')                                           return NextResponse.redirect(new URL('/login', request.url))
    if (pathname.startsWith('/judge')       && role !== 'guest')                                           return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
