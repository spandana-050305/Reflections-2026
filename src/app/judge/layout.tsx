import { redirect } from 'next/navigation'

// The old fixed-account Judge 1-4 portal has been replaced by the
// Guest Evaluator system (see src/app/guest). This route is kept as a
// redirect stub only because the file can't be deleted on this mount.
export default function JudgeLayout() {
  redirect('/guest/evaluate')
}
