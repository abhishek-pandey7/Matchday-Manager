'use client';

import { useCoachStore } from '@/store/matchStore';
import { useTournamentStore } from '@/store/tournamentStore';
import SetupPage from '@/components/coach/SetupPage';
import TacticsPage from '@/components/coach/TacticsPage';
import SimulationPage from '@/components/coach/SimulationPage';
import TournamentSetup from '@/components/coach/TournamentSetup';
import TournamentDraw from '@/components/coach/TournamentDraw';
import TournamentHub from '@/components/coach/TournamentHub';
import { Button } from '@/components/ui/button';
import { Trophy, Swords, LogOut } from 'lucide-react';

const STEPS = [
  { key: 'setup', label: 'Teams', num: '01' },
  { key: 'tactics', label: 'Tactics', num: '02' },
  { key: 'simulation', label: 'Match', num: '03' },
] as const;

export default function Home() {
  const coachStep = useCoachStore((s) => s.step);
  const coachStepOrder = ['setup', 'tactics', 'simulation'];
  const currentIdx = coachStepOrder.indexOf(coachStep);

  const tStore = useTournamentStore();
  const mode = tStore.mode;
  const tournamentStep = tStore.tournamentStep;
  const activeMatchId = tStore.activeTournamentMatchId;

  // ── Menu Mode Render ───────────────────────────────────────────────
  if (mode === 'menu') {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-background px-4 py-8 max-w-4xl mx-auto">
        <header className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center text-background font-black text-base select-none"
            style={{ background: 'var(--primary)' }}
          >
            MM
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight uppercase">MATCHDAY MANAGER</h1>
            <p className="text-[9px] text-muted-foreground tracking-widest uppercase">FIFA WC 2026 Simulator</p>
          </div>
        </header>

        <main className="my-auto py-12 space-y-12">
          {/* Main Kinetic Title */}
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-7xl md:text-9xl font-black leading-none tracking-tighter uppercase select-none">
              MATCHDAY<br />
              <span className="text-outline text-transparent" style={{ WebkitTextStroke: '2px var(--foreground)' }}>MANAGER</span>
            </h2>
            <p className="text-xs md:text-sm tracking-widest text-muted-foreground uppercase font-mono mt-4">
              Tactical Football Engine / Seeded Match Playback / FIFA World Cup Simulation
            </p>
          </div>

          {/* Mode Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            {/* Single Match Mode Card */}
            <div 
              onClick={() => {
                tStore.setMode('single');
                const coach = useCoachStore.getState();
                coach.resetMatch();
                coach.setStep('setup');
              }}
              className="border-2 border-border p-6 rounded-none cursor-pointer bg-muted/5 hover:border-primary transition-all group flex flex-col justify-between gap-6"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Swords className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
                    QUICK MATCH
                  </span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight group-hover:text-primary transition-colors">
                  Single Match
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed uppercase">
                  Select two nations, design their tactical philosophies, customize formations, build lineups, and run a head-to-head live pitch simulation.
                </p>
              </div>
              <div className="text-xs font-bold tracking-wider uppercase group-hover:underline flex items-center gap-1.5">
                START QUICK PLAY →
              </div>
            </div>

            {/* Tournament Mode Card */}
            <div 
              onClick={() => {
                tStore.setMode('tournament');
                tStore.setTournamentStep('setup');
              }}
              className="border-2 border-border p-6 rounded-none cursor-pointer bg-muted/5 hover:border-primary transition-all group flex flex-col justify-between gap-6"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Trophy className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
                    48-TEAM WORLD CUP
                  </span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight group-hover:text-primary transition-colors">
                  World Cup 2026
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed uppercase">
                  Coach one or more nations through the full World Cup. Simulate the random group draw, manage standings, run CPU fixtures, and guide your team through knockouts.
                </p>
              </div>
              <div className="text-xs font-bold tracking-wider uppercase group-hover:underline flex items-center gap-1.5">
                START WC CAMPAIGN →
              </div>
            </div>
          </div>
        </main>

        <footer className="text-[9px] text-muted-foreground tracking-widest uppercase flex items-center justify-between border-t border-border/40 pt-4">
          <span>Matchday Manager v0.3.0</span>
          <span>FIFA World Cup 2026 Simulator</span>
        </footer>
      </div>
    );
  }

  // ── Active Mode Renders (Single Match or Tournament) ─────────────────
  const isPlayingActiveMatch = mode === 'tournament' && activeMatchId !== null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo / Back Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (confirm('Exit current mode and return to main menu?')) {
                  tStore.resetTournament();
                }
              }}
              className="text-muted-foreground hover:text-foreground text-xs font-bold flex items-center gap-1.5 tracking-wider uppercase"
            >
              <LogOut className="w-3.5 h-3.5" /> MENU
            </button>
            <span className="text-border">|</span>
            <div className="hidden sm:flex items-center gap-2">
              <div
                className="w-6 h-6 flex items-center justify-center text-background font-black text-xs select-none"
                style={{ background: 'var(--primary)' }}
              >
                MM
              </div>
              <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
                {mode === 'tournament' ? 'WORLD CUP 2026' : 'SINGLE MATCH'}
              </span>
            </div>
          </div>

          {/* Progress Indicator */}
          {(mode === 'single' || isPlayingActiveMatch) && (
            <nav className="flex items-center gap-0 text-xs" aria-label="Progress steps">
              {STEPS.map((s, i) => {
                const isCompleted = i < currentIdx;
                const isCurrent = coachStep === s.key;

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
          )}

          {mode === 'tournament' && !isPlayingActiveMatch && (
            <div className="text-xs font-bold uppercase tracking-widest text-primary">
              {tournamentStep === 'setup' && '01 SETUP'}
              {tournamentStep === 'draw' && '02 GROUP DRAW'}
              {tournamentStep === 'hub' && '03 TOURNAMENT HUB'}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {mode === 'single' && (
          <>
            {coachStep === 'setup' && <SetupPage />}
            {coachStep === 'tactics' && <TacticsPage />}
            {coachStep === 'simulation' && <SimulationPage />}
          </>
        )}

        {mode === 'tournament' && (
          <>
            {tournamentStep === 'setup' && <TournamentSetup />}
            {tournamentStep === 'draw' && <TournamentDraw />}
            {tournamentStep === 'hub' && (
              <>
                {isPlayingActiveMatch ? (
                  <>
                    {coachStep === 'tactics' && <TacticsPage />}
                    {coachStep === 'simulation' && <SimulationPage />}
                  </>
                ) : (
                  <TournamentHub />
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between text-[10px] text-muted-foreground tracking-widest uppercase">
          <span>Matchday Manager</span>
          <span>FIFA World Cup 2026</span>
        </div>
      </footer>
    </div>
  );
}
