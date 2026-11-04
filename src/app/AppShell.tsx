import { Flame, FolderKanban, Home, LineChart, Map, Palette, Settings, Snowflake, Star, Target } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { Adam } from '../components/Adam'
import { Chip } from '../components/ui/Chip'
import { useProgress } from '../features/progress/progress'

type NavItem = { to?: string; label: string; icon: ReactNode }

// Items without `to` are planned for later phases (BUILD_PLAN.md §7).
const nav: NavItem[] = [
  { to: '/', label: 'Today', icon: <Home size={18} /> },
  { to: '/path', label: 'Path', icon: <Map size={18} /> },
  { label: 'Practice', icon: <Target size={18} /> },
  { label: 'Projects', icon: <FolderKanban size={18} /> },
  { label: 'Stats', icon: <LineChart size={18} /> },
]
const bottomNav: NavItem[] = [
  { to: '/settings', label: 'Settings', icon: <Settings size={18} /> },
  { to: '/styleguide', label: 'Style guide', icon: <Palette size={18} /> },
]

function NavEntry({ item }: { item: NavItem }) {
  if (!item.to) {
    return (
      <span
        className="ga-nav-item cursor-default! text-faint! hover:bg-transparent!"
        aria-disabled
        title="Coming in a later phase"
      >
        {item.icon}
        {item.label}
        <span className="ml-auto text-caption font-medium">Soon</span>
      </span>
    )
  }
  return (
    <NavLink to={item.to} end className="ga-nav-item">
      {item.icon}
      {item.label}
    </NavLink>
  )
}

export function AppShell() {
  const p = useProgress()
  return (
    <div className="flex min-h-dvh">
      <aside className="ga-sidebar sticky top-0 hidden h-dvh w-60 shrink-0 md:flex">
        <NavLink to="/" className="mb-5 flex items-center gap-2.5 rounded-md px-2 py-1">
          <Adam size={34} animated={false} />
          <span className="text-[17px] font-semibold tracking-[-0.01em]">Gradient Ascent</span>
        </NavLink>
        <nav className="flex flex-col gap-0.5" aria-label="Main">
          {nav.map((item) => (
            <NavEntry key={item.label} item={item} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
          {bottomNav.map((item) => (
            <NavEntry key={item.label} item={item} />
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-2 px-6 py-4">
          <Chip icon={<Flame size={16} />} color="var(--color-accent)" label="Day streak">
            {p?.streak.current ?? '–'}
          </Chip>
          <Chip icon={<Star size={16} />} color="var(--color-xp)" label="Total XP">
            {p?.totalXp ?? '–'}
          </Chip>
          <Chip icon={<Snowflake size={16} />} color="var(--color-sky)" label="Streak freezes left this week">
            {p?.streak.freezesLeft ?? '–'}
          </Chip>
        </header>
        <main className="mx-auto w-full max-w-[1040px] flex-1 px-4 pb-28 sm:px-6 md:pb-16">
          <Outlet />
        </main>
      </div>

      {/* Bottom tab bar on small screens. Only built routes are shown. */}
      <nav
        aria-label="Main (mobile)"
        className="fixed inset-x-0 bottom-0 flex items-center justify-around border-t border-border bg-sidebar px-2 py-2 md:hidden"
      >
        {[...nav, ...bottomNav]
          .filter((item) => item.to)
          .map((item) => (
            <NavLink
              key={item.label}
              to={item.to!}
              end
              className="flex flex-col items-center gap-0.5 rounded-md px-4 py-1.5 text-caption font-semibold text-muted aria-[current=page]:text-text [&[aria-current=page]_svg]:text-accent"
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
      </nav>
    </div>
  )
}
