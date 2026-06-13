'use client';

import { useCoachStore } from '@/store/matchStore';
import SetupPage from '@/components/coach/SetupPage';
import TacticsPage from '@/components/coach/TacticsPage';
import SimulationPage from '@/components/coach/SimulationPage';

export default function Home() {
  const step = useCoachStore((s) => s.step);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white text-sm font-bold shadow">
              ⚽
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">If I Were the Coach</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">FIFA World Cup 2026 | Substitution Simulator & Match Predictor</p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 text-xs">
            {[
              { key: 'setup', label: 'Teams', num: 1 },
              { key: 'tactics', label: 'Tactics', num: 2 },
              { key: 'simulation', label: 'Match', num: 3 },
            ].map((s, i) => {
              const stepOrder = ['setup', 'tactics', 'simulation'];
              const currentIdx = stepOrder.indexOf(step);
              const isCompleted = i < currentIdx;
              const isCurrent = step === s.key;

              return (
                <div key={s.key} className="flex items-center gap-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      isCurrent
                        ? 'bg-primary text-primary-foreground scale-110'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? '✓' : s.num}
                  </div>
                  <span className={`hidden sm:inline transition-all ${
                    isCurrent ? 'font-medium' : 'text-muted-foreground'
                  }`}>
                    {s.label}
                  </span>
                  {i < 2 && (
                    <span className={`mx-1 transition-all ${
                      i < currentIdx ? 'text-green-500' : 'text-muted-foreground'
                    }`}>→</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {step === 'setup' && <SetupPage />}
        {step === 'tactics' && <TacticsPage />}
        {step === 'simulation' && <SimulationPage />}
      </main>

      {/* Footer */}
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        If I Were the Coach — FIFA World Cup 2026 | AI-Powered Match Simulator
      </footer>
    </div>
  );
}
