import { NextResponse, type NextRequest } from 'next/server'
import { signInUser, signUpUser } from '@/lib/local-store.server'
import { SESSION_COOKIE } from '@/lib/local-auth'

const LOCAL_MODE = process.env.NEXT_PUBLIC_LOCAL_MODE === 'true'

export async function POST(req: NextRequest) {
  if (!LOCAL_MODE) {
    return NextResponse.json({ user: null, error: { message: 'Local mode disabled' } }, { status: 403 })
  }
  try {
    const body = await req.json()

    if (body.action === 'signin') {
      const result = signInUser(body.email, body.password)
      const response = NextResponse.json(result)
      if (result.user) {
        // Set cookie server-side so the browser stores it reliably
        // before window.location.href fires on the client.
        response.cookies.set(SESSION_COOKIE, encodeURIComponent(JSON.stringify(result.user)), {
          path: '/',
          maxAge: 86400,
          sameSite: 'lax',
          httpOnly: false,
        })
      }
      return response
    }

    if (body.action === 'signup') {
      const result = signUpUser(body.email, body.password, body.data ?? {})
      return NextResponse.json(result)
    }

    return NextResponse.json({ user: null, error: { message: 'Unknown action' } }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ user: null, error: { message: e?.message ?? 'Server error' } }, { status: 500 })
  }
}
