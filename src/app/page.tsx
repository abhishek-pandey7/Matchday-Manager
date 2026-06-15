'use client';

import { useCoachStore } from '@/store/matchStore';
import SetupPage from '@/components/coach/SetupPage';
import TacticsPage from '@/components/coach/TacticsPage';
import SimulationPage from '@/components/coach/SimulationPage';

const STEPS = [
  { key: 'setup', label: 'Teams', num: '01' },
  { key: 'tactics', label: 'Tactics', num: '02' },
  { key: 'simulation', label: 'Match', num: '03' },
] as const;

export default function Home() {
  const step = useCoachStore((s) => s.step);
  const stepOrder = ['setup', 'tactics', 'simulation'];
  const currentIdx = stepOrder.indexOf(step);

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

          {/* Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="w-8 h-8 flex items-center justify-center text-background font-black text-sm select-none"
              style={{ background: 'var(--primary)' }}
            >
              MM
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight">MATCHDAY MANAGER</div>
              <div className="text-[9px] text-muted-foreground tracking-widest uppercase">
                FIFA WC 2026 Simulator
              </div>
            </div>
          </div>

          {/* Step indicator */}
          <nav className="flex items-center gap-0 text-xs" aria-label="Progress steps">
            {STEPS.map((s, i) => {
              const isCompleted = i < currentIdx;
              const isCurrent = step === s.key;

              return (
                <div key={s.key} className="flex items-center">
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 transition-all ${
                      isCurrent
                        ? 'text-background font-bold'
                        : isCompleted
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    }`}
                    style={isCurrent ? { background: 'var(--primary)' } : {}}
                  >
                    <span className="font-mono text-[9px]">{isCompleted ? '✓' : s.num}</span>
                    <span className="hidden sm:inline tracking-wide uppercase text-[10px]">
                      {s.label}
                    </span>
                  </div>
                  {i < 2 && (
                    <span
                      className={`w-4 h-px mx-0.5 transition-colors ${
                        i < currentIdx ? 'bg-primary' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {step === 'setup' && <SetupPage />}
        {step === 'tactics' && <TacticsPage />}
        {step === 'simulation' && <SimulationPage />}
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border/60 py-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between text-[10px] text-muted-foreground tracking-widest uppercase">
          <span>Matchday Manager</span>
          <span>FIFA World Cup 2026</span>
        </div>
      </footer>
    </div>
  );
}
