/**
 * Adam the mountain goat — Gradient Ascent's mascot (named after the Adam optimizer).
 * Flat shapes + one outline weight so he reads at 32px and at 200px.
 *
 * Animation (styles in components.css, "Adam" section):
 * - always: gentle breathing bob, blinking, an occasional ear flick
 * - on mood change: happy = double hop, oops = flinch + droop, think = head tilt (held)
 * Everything stops under prefers-reduced-motion, or with animated={false}.
 */
export type AdamMood = 'idle' | 'happy' | 'think' | 'oops'

const INK = '#2A2238'
const FUR = '#F6EEE2'
const FUR_SHADE = '#E7DAC6'
const HORN = '#CDB596'
const EAR_IN = '#F1B9A6'
const BANDANA = '#FF7A2F'
const BANDANA_SHADE = '#D9601C'

type AdamProps = { mood?: AdamMood; size?: number; title?: string; animated?: boolean; className?: string }

export function Adam({ mood = 'idle', size = 96, title, animated = true, className }: AdamProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={['adam', className].filter(Boolean).join(' ')}
      data-mood={mood}
      data-animated={animated ? 'true' : undefined}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      strokeLinecap="round"
      strokeLinejoin="round"
      overflow="visible"
    >
      <g className="adam-react">
        <g className="adam-idle">
          {/* Horns (behind head) */}
          <path d="M44 34 C38 20 26 12 16 14 C24 18 30 26 34 40 Z" fill={HORN} stroke={INK} strokeWidth="2.5" />
          <path d="M76 34 C82 20 94 12 104 14 C96 18 90 26 86 40 Z" fill={HORN} stroke={INK} strokeWidth="2.5" />
          <path d="M33 22 L38 26 M27 17 L31 22" stroke={INK} strokeWidth="1.6" opacity=".45" />
          <path d="M87 22 L82 26 M93 17 L89 22" stroke={INK} strokeWidth="1.6" opacity=".45" />

          {/* Ears */}
          <g className="adam-ear adam-ear-l">
            <path d="M33 50 C22 46 12 50 8 56 C16 60 26 60 35 57 Z" fill={FUR} stroke={INK} strokeWidth="2.5" />
            <path d="M30 53 C23 52 17 54 14 56 C19 58 25 58 30 56 Z" fill={EAR_IN} />
          </g>
          <g className="adam-ear adam-ear-r">
            <path d="M87 50 C98 46 108 50 112 56 C104 60 94 60 85 57 Z" fill={FUR} stroke={INK} strokeWidth="2.5" />
            <path d="M90 53 C97 52 103 54 106 56 C101 58 95 58 90 56 Z" fill={EAR_IN} />
          </g>

          {/* Bandana (behind chin) */}
          <path d="M38 92 L82 92 L68 112 Q60 118 52 112 Z" fill={BANDANA} stroke={INK} strokeWidth="2.5" />
          <path d="M44 96 L76 96" stroke={BANDANA_SHADE} strokeWidth="2" />

          {/* Head */}
          <path
            d="M60 26 C80 26 90 40 89 58 C88 74 80 90 60 92 C40 90 32 74 31 58 C30 40 40 26 60 26 Z"
            fill={FUR}
            stroke={INK}
            strokeWidth="2.5"
          />
          <path d="M52 30 C55 24 58 27 60 23 C62 27 66 24 68 30" fill={FUR} stroke={INK} strokeWidth="2.2" />

          {/* Muzzle */}
          <ellipse cx="60" cy="77" rx="17" ry="12" fill={FUR_SHADE} />
          <path d="M55 72 Q56 74 54 75 M65 72 Q64 74 66 75" stroke={INK} strokeWidth="2" fill="none" />

          {/* Beard */}
          <path d="M54 90 C55 98 58 103 60 104 C62 103 65 98 66 90" fill={FUR_SHADE} stroke={INK} strokeWidth="2.2" />

          <Face mood={mood} />
        </g>
      </g>
    </svg>
  )
}

function Eyes({ y, dx = 0, r = 5.2 }: { y: number; dx?: number; r?: number }) {
  return (
    <g className="adam-eyes">
      <circle cx={48 + dx} cy={y} r={r} fill={INK} />
      <circle cx={72 + dx} cy={y} r={r} fill={INK} />
      <circle cx={49.8 + dx} cy={y - 1.8} r={1.8} fill="#fff" />
      <circle cx={73.8 + dx} cy={y - 1.8} r={1.8} fill="#fff" />
    </g>
  )
}

function Face({ mood }: { mood: AdamMood }) {
  switch (mood) {
    case 'happy':
      return (
        <g stroke={INK} strokeWidth="3" fill="none">
          <path d="M43 57 Q48 51 53 57" />
          <path d="M67 57 Q72 51 77 57" />
          <path d="M53 80 Q60 88 67 80 Z" fill={INK} strokeWidth="2.2" />
          <circle cx="40" cy="66" r="4" fill="#F4A08A" stroke="none" opacity=".7" />
          <circle cx="80" cy="66" r="4" fill="#F4A08A" stroke="none" opacity=".7" />
        </g>
      )
    case 'think':
      return (
        <g>
          <path d="M42 47 L53 45" stroke={INK} strokeWidth="2.6" />
          <path d="M67 43 L78 47" stroke={INK} strokeWidth="2.6" />
          <Eyes y={55} dx={1.5} />
          <path d="M55 82 L66 81" stroke={INK} strokeWidth="2.6" />
        </g>
      )
    case 'oops':
      return (
        <g>
          <path d="M42 46 L53 49" stroke={INK} strokeWidth="2.6" />
          <path d="M78 46 L67 49" stroke={INK} strokeWidth="2.6" />
          <Eyes y={57} r={5} />
          <ellipse cx="60" cy="83" rx="3.4" ry="4" fill={INK} />
        </g>
      )
    default:
      return (
        <g>
          <Eyes y={57} />
          <path d="M54 81 Q60 86 66 81" stroke={INK} strokeWidth="2.6" fill="none" />
        </g>
      )
  }
}
