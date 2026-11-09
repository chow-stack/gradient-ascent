/** A checkpoint's questions as a row of segments: filled once answered, ringed where you are. Click one to go there. */
export function QuestionNav({
  answered,
  current,
  disabled,
  onGo,
}: {
  answered: boolean[]
  current: number
  disabled?: boolean
  onGo: (i: number) => void
}) {
  const count = answered.filter(Boolean).length
  return (
    <nav className="ga-qnav" aria-label={`Questions, ${count} of ${answered.length} answered`}>
      {answered.map((done, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          data-done={done || undefined}
          aria-current={i === current ? 'step' : undefined}
          aria-label={`Question ${i + 1}${done ? ', answered' : ''}`}
          title={`Question ${i + 1}`}
          onClick={() => onGo(i)}
        />
      ))}
    </nav>
  )
}
