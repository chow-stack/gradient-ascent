import { Flame, Lightbulb, Snowflake, Star } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Adam, type AdamMood } from '../components/Adam'
import { CodeBlock } from '../components/CodeBlock'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Chip, Tag } from '../components/ui/Chip'
import { ProgressBar, SegmentedProgress } from '../components/ui/ProgressBar'
import { LessonDemo } from '../features/lesson-demo/LessonDemo'

const colorGroups: Array<{ title: string; tokens: string[] }> = [
  { title: 'Surfaces', tokens: ['bg', 'sidebar', 'surface', 'choice', 'raised', 'progress-track', 'code-bg'] },
  { title: 'Text', tokens: ['text', 'muted', 'faint'] },
  { title: 'Brand & feedback', tokens: ['accent', 'sky', 'success', 'danger', 'xp'] },
  { title: 'Tracks', tokens: ['track-foundations', 'track-web', 'track-ml'] },
]

const typeScale = [
  { token: 'display', className: 'text-display font-[650]', sample: 'Summit reached' },
  { token: 'h1', className: 'text-h1 font-[650]', sample: 'Today' },
  { token: 'h2', className: 'text-h2 font-[650]', sample: 'Why does this loop never stop?' },
  { token: 'h3', className: 'text-h3 font-semibold', sample: 'Warm-up review' },
  { token: 'body', className: 'text-body', sample: 'range(5) stops right before 5.' },
  { token: 'small', className: 'text-small text-muted', sample: 'Secondary text and labels' },
  { token: 'caption', className: 'text-caption text-faint', sample: 'Lesson 3 of 8 · 12 min' },
  { token: 'code', className: 'font-mono text-code', sample: 'for i in range(5): print(i)' },
]

const moods: AdamMood[] = ['idle', 'happy', 'think', 'oops']
const moodNote: Record<AdamMood, string> = {
  idle: 'Breathes, blinks, flicks an ear now and then.',
  happy: 'Double hop on a correct answer.',
  think: 'Tilts his head while a hint is open.',
  oops: 'Flinches and droops on a wrong answer.',
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div>
        <h2 id={id} className="text-h2">
          {title}
        </h2>
        {note && <p className="mt-1 text-small text-muted">{note}</p>}
      </div>
      {children}
    </section>
  )
}

/** Live reference for DESIGN.md: every token and primitive, plus a playable sample lesson. */
export function StyleguidePage() {
  const [mood, setMood] = useState<AdamMood>('idle')

  return (
    <div className="flex flex-col gap-14 pt-2">
      <header>
        <h1 className="text-h1">Style guide</h1>
        <p className="mt-2 max-w-[60ch] text-muted">
          The Summit design system: layered indigo night, one orange for “go”, soft-blue for focus and selection.
          Everything here reads from <code className="rounded bg-raised px-1.5 text-[0.9em]">tokens.css</code>.
        </p>
      </header>

      <Section id="sg-lesson" title="Sample lesson" note="Click or press 1–4 to pick, Enter to check and continue.">
        <LessonDemo />
      </Section>

      <Section id="sg-adam" title="Adam" note="The mascot. Pick a mood to replay its animation.">
        <Card className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <div className="grid size-44 flex-none place-items-center rounded-lg bg-bg">
            <Adam key={mood} mood={mood} size={128} title={`Adam, ${mood}`} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Adam's mood">
              {moods.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mood === m}
                  onClick={() => setMood(m)}
                  className="ga-btn ga-btn--sm ga-btn--secondary capitalize aria-checked:border-sky! aria-checked:text-sky"
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-muted">{moodNote[mood]}</p>
            <div className="flex items-end gap-4">
              {moods.map((m) => (
                <Adam key={m} mood={m} size={44} animated={false} title={`Adam, ${m}`} />
              ))}
              <span className="pb-1 text-caption text-faint">Static versions, for small sizes</span>
            </div>
          </div>
        </Card>
      </Section>

      <Section id="sg-color" title="Color">
        <div className="flex flex-col gap-5">
          {colorGroups.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-small font-semibold text-muted">{g.title}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {g.tokens.map((t) => (
                  <div key={t} className="overflow-hidden rounded-md border border-border bg-surface">
                    <div className="h-12" style={{ background: `var(--color-${t})` }} />
                    <p className="px-3 py-2 font-mono text-[12px] text-muted">{t}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="sg-type" title="Type" note="Onest for everything you read, JetBrains Mono for code.">
        <Card className="flex flex-col gap-4">
          {typeScale.map((t) => (
            <div key={t.token} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
              <span className="w-16 shrink-0 font-mono text-[12px] text-faint">{t.token}</span>
              <span className={`${t.className} text-text`}>{t.sample}</span>
            </div>
          ))}
        </Card>
      </Section>

      <Section id="sg-buttons" title="Buttons">
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button kbd="↵">Check</Button>
            <Button variant="secondary">Keep going</Button>
            <Button variant="ghost">
              <Lightbulb size={16} aria-hidden /> Hint
            </Button>
            <Button disabled>Check</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="success" kbd="↵">
              Continue
            </Button>
            <Button variant="danger">Got it</Button>
            <Button size="sm">Small</Button>
            <Button size="sm" variant="secondary">
              Small secondary
            </Button>
          </div>
        </Card>
      </Section>

      <Section id="sg-choices" title="Answer choices" note="Default, selected, correct, wrong.">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: '4', state: undefined },
            { label: '8', state: 'selected' },
            { label: '8', state: 'correct' },
            { label: '[3, 1, 4]', state: 'wrong' },
          ].map((r, i) => (
            <button key={i} type="button" className="ga-choice" data-state={r.state} tabIndex={-1}>
              <span className="ga-choice-key">{i + 1}</span>
              <code>{r.label}</code>
              <span className="ml-auto text-caption font-normal text-faint">{r.state ?? 'default'}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section id="sg-progress" title="Progress, chips and tags">
        <Card className="flex flex-col gap-5">
          <SegmentedProgress total={8} done={3} current={3} label="Lesson progress (segmented)" />
          <ProgressBar value={0.42} label="Track progress" />
          <div className="flex flex-wrap items-center gap-2">
            <Chip icon={<Flame size={16} />} color="var(--color-accent)" label="Day streak">
              12
            </Chip>
            <Chip icon={<Star size={16} />} color="var(--color-xp)" label="XP">
              340
            </Chip>
            <Chip icon={<Snowflake size={16} />} color="var(--color-sky)" label="Streak freezes">
              2
            </Chip>
            <Tag>Predict the output</Tag>
            <Tag>Find the bug</Tag>
          </div>
        </Card>
      </Section>

      <Section id="sg-code" title="Code blocks" note="Line numbers appear only when an exercise refers to them.">
        <div className="grid gap-4 lg:grid-cols-2">
          <CodeBlock
            code={`def total(nums):
    # add each one
    s = 0
    for n in nums:
        s += n
    return s`}
            highlightLine={5}
          />
          <CodeBlock
            numbered
            showRun
            code={`i = 3
while i > 0:
    print(i)
    i -= 1
print("Liftoff!")`}
          />
        </div>
      </Section>

      <Section id="sg-feedback" title="Feedback bar" note="Slides up from the bottom of a lesson after Check.">
        <div className="flex flex-col gap-3 overflow-hidden rounded-lg border border-border">
          <div className="ga-footer border-t-0!" data-state="correct">
            <Adam mood="happy" size={48} animated={false} />
            <div className="min-w-0 flex-1">
              <p className="ga-footer-title">Nice — that’s right.</p>
              <p className="ga-footer-body">The loop adds each number: 0 + 3 + 1 + 4 = 8.</p>
            </div>
            <Button variant="success" kbd="↵">
              Continue
            </Button>
          </div>
          <div className="ga-footer" data-state="wrong">
            <Adam mood="oops" size={48} animated={false} />
            <div className="min-w-0 flex-1">
              <p className="ga-footer-title">Not quite.</p>
              <p className="ga-footer-body">i never changes, so i &gt; 0 stays true forever.</p>
            </div>
            <Button variant="danger" kbd="↵">
              Continue
            </Button>
          </div>
        </div>
      </Section>
    </div>
  )
}
