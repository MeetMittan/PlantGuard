import { Suspense, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { FlaskConical, Menu, ScanLine } from 'lucide-react';
import { config } from '@/app/config';
import { useModelState } from '@/ai/model-manager/useModelManager';
import { ModelChip, OnlineChip } from '@/components/feedback/StatusChips';
import { UpdatePrompt } from '@/components/feedback/UpdatePrompt';
import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Logo, LogoMark } from './Logo';
import { NAV_ITEMS } from './navigation';
import { PageFallback } from './PageFallback';

function SidebarLink({ to, label, icon: Icon }: (typeof NAV_ITEMS)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
          isActive ? 'bg-forest-soft text-forest-strong dark:text-forest' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
        )
      }
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </NavLink>
  );
}

export function AppShell() {
  const online = useOnlineStatus();
  const model = useModelState();
  const [moreOpen, setMoreOpen] = useState(false);
  const mobileItems = NAV_ITEMS.filter((item) => item.mobile);

  return (
    <div className="min-h-dvh bg-canvas botanical-grain">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-full focus:bg-forest focus:px-4 focus:py-2 focus:text-on-forest"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/80 px-4 py-5 backdrop-blur lg:flex">
        <div className="px-2">
          <Logo name={config.appName} />
        </div>
        <nav aria-label="Main" className="mt-8 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="space-y-2 rounded-2xl border border-line bg-surface-muted/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">Status</p>
          <div className="flex flex-wrap gap-1.5">
            <OnlineChip />
            <ModelChip />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-canvas/85 px-4 py-2.5 backdrop-blur lg:hidden">
        <NavLink to="/" aria-label={`${config.appName} home`} className="flex items-center gap-2">
          <LogoMark className="size-8" />
          <span className="font-display text-base font-semibold">PlantGuard</span>
        </NavLink>
        <div className="flex items-center gap-1.5">
          {!online ? <OnlineChip /> : null}
          <ModelChip />
        </div>
      </header>

      <div className="lg:pl-64">
        {model.providerKind === 'demo' ? (
          <div role="note" className="flex items-center justify-center gap-2 bg-sun-soft px-4 py-2 text-center text-xs font-medium text-sun">
            <FlaskConical className="size-4 shrink-0" aria-hidden />
            Demo mode: AI results are simulated and do not come from a real model.
          </div>
        ) : null}
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom navigation with a prominent scanner action */}
      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5">
          {mobileItems.slice(0, 2).map((item) => (
            <MobileTab key={item.to} {...item} />
          ))}
          <div className="flex justify-center">
            <NavLink
              to="/scan"
              aria-label="Scan a plant"
              className={({ isActive }) =>
                cn(
                  '-mt-6 grid size-15 place-items-center rounded-full bg-forest text-on-forest shadow-float ring-4 ring-canvas transition-transform active:scale-95',
                  isActive && 'bg-forest-strong',
                )
              }
            >
              <ScanLine className="size-7" aria-hidden />
            </NavLink>
          </div>
          {mobileItems.slice(2).map((item) => (
            <MobileTab key={item.to} {...item} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-ink-muted"
            aria-haspopup="dialog"
          >
            <Menu className="size-5" aria-hidden />
            More
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="More" size="sm">
        <nav aria-label="More destinations" className="flex flex-col gap-1" onClick={() => setMoreOpen(false)}>
          {NAV_ITEMS.filter((item) => !item.mobile && item.to !== '/scan').map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>
      </Dialog>

      <UpdatePrompt />
    </div>
  );
}

function MobileTab({ to, label, icon: Icon }: (typeof NAV_ITEMS)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium',
          isActive ? 'text-forest' : 'text-ink-muted',
        )
      }
    >
      <Icon className="size-5" aria-hidden />
      {label.split(' ')[0]}
    </NavLink>
  );
}
