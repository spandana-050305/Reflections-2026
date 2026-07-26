import { redirect } from 'next/navigation'

// The landing page now goes straight to the school sign-in.
// (Middleware already redirects logged-in users to their dashboard before
// this ever renders; this covers logged-out visitors and acts as a fallback.)
// The old marketing/about content now lives at /about.
export default function RootPage() {
  redirect('/school/login')
}
