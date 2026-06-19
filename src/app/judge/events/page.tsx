import { redirect } from 'next/navigation'

// Superseded by the Guest Evaluator system. Stub kept only because this
// file can't be deleted on this mount; the parent layout already redirects.
export default function JudgeEventsPage() {
  redirect('/guest/evaluate')
}
