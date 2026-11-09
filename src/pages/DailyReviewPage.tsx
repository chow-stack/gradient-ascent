import { useState } from 'react'
import { useNavigate } from 'react-router'
import { dayKey } from '../lib/dates'
import { DailyReview } from '../features/session/DailyReview'

/** /daily — today's Daily 5, answered, with the right answers. Full-screen, like a session. */
export function DailyReviewPage() {
  const navigate = useNavigate()
  const [day] = useState(() => dayKey(new Date()))
  return <DailyReview day={day} onBack={() => navigate('/')} backLabel="Today" />
}
