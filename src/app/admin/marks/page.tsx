import { redirect } from 'next/navigation'

// The standalone Marks page has been merged into Guest Marks, which now
// records judges' marks and carries the lock/unlock, points-config and
// winner-computation features. This route redirects there for any old links.
export default function AdminMarksPage() {
  redirect('/admin/guest-marks')
}
