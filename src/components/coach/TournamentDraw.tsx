'use client';

import { useState, useEffect, useRef } from 'react';
import { useTournamentStore } from '@/store/tournamentStore';
import { TEAMS } from '@/lib/simulation/data';
import { Button } from '@/components/ui/button';
import { Play, Pause, FastForward, ArrowRight } from 'lucide-react';

export default function TournamentDraw() {
  const store = useTournamentStore();
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isComplete = store.currentPotIdx >= 4;

  const stopDraw = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
  };

  const startDraw = () => {
    if (isComplete) return;
    setIsRunning(true);

    timerRef.current = setInterval(() => {
      const finished = store.runDrawStep();
      if (finished) {
        stopDraw();
      }
    }, 180); // Quick, snappy draw animation (180ms per team)
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const toggleAuto = () => {
    if (isRunning) {
      stopDraw();
    } else {
      startDraw();
    }
  };

  const handleNextStep = () => {
    stopDraw();
    store.runDrawStep();
  };

  const handleSkip = () => {
    stopDraw();
    store.completeDraw();
  };

  const getTeamName = (teamId: string) => {
    const team = TEAMS.find(t => t.id === teamId);
    return team ? team.name : teamId;
  };

  const getTeamFlag = (teamId: string) => {
    const team = TEAMS.find(t => t.id === teamId);
    return team ? team.flag : '🏳️';
  };

  return (
    <div className="space-y-6">
      {/* Kinetic Heading */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            Phase 01 — Group Draw Simulation
          </div>
          <h2 className="text-5xl md:text-6xl font-black leading-none tracking-tighter uppercase">
            GROUP<br />
            <span style={{ color: 'var(--primary)' }}>DRAW</span>
          </h2>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {!isComplete && (
            <>
              <Button
                onClick={toggleAuto}
                className="rounded-none font-bold text-xs tracking-wider uppercase text-background"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5 mr-1.5" /> PAUSE
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 mr-1.5" /> START DRAW
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleNextStep}
                className="rounded-none font-bold text-xs tracking-wider uppercase border-border"
              >
                NEXT STEP
              </Button>
              <Button
                variant="outline"
                onClick={handleSkip}
                className="rounded-none font-bold text-xs tracking-wider uppercase border-border"
              >
                <FastForward className="w-3.5 h-3.5 mr-1.5" /> SKIP DRAW
              </Button>
            </>
          )}

          {isComplete && (
            <Button
              onClick={() => store.setTournamentStep('hub')}
              className="rounded-none font-bold text-xs tracking-wider uppercase text-background animate-pulse"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              TOURNAMENT HUB <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Pots */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-bold tracking-widest uppercase border-b border-border pb-1">
            POTS STATUS
          </h3>
          <div className="space-y-4">
            {store.pots.map((pot, potIdx) => {
              const remaining = store.remainingPots[potIdx] || [];
              const isCurrentPot = store.currentPotIdx === potIdx && !isComplete;

              return (
                <div
                  key={potIdx}
                  className={`border p-3 rounded-none relative ${isCurrentPot ? 'border-primary bg-primary/5' : 'border-border/40 bg-muted/5'
                    }`}
                >
                  {isCurrentPot && (
                    <span
                      className="absolute top-0 right-0 px-1.5 py-0.5 text-[8px] font-mono font-bold text-background uppercase"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      DRAWING
                    </span>
                  )}
                  <h4 className="text-xs font-bold tracking-wider uppercase mb-2">
                    POT {potIdx + 1} ({remaining.length} / 12)
                  </h4>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {pot.map((teamId) => {
                      const isDrawn = !remaining.includes(teamId);
                      return (
                        <div
                          key={teamId}
                          className={`px-1.5 py-0.5 text-[10px] flex items-center gap-1 border border-border/40 ${isDrawn
                              ? 'line-through opacity-30 bg-muted/10'
                              : 'bg-muted/30 font-bold'
                            }`}
                        >
                          <span>{getTeamFlag(teamId)}</span>
                          <span className="font-mono text-[9px] uppercase">{teamId.slice(0, 3)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Groups A-L */}
        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-sm font-bold tracking-widest uppercase border-b border-border pb-1">
            GROUPS A - L
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.keys(store.groups).map((groupName) => {
              const teamIds = store.groups[groupName];
              const isCurrentGroup = store.currentGroupIdx === groupName.charCodeAt(0) - 65 && !isComplete;

              return (
                <div
                  key={groupName}
                  className={`border rounded-none p-3 transition-all ${isCurrentGroup
                      ? 'border-primary bg-primary/5 shadow-md scale-102'
                      : 'border-border/60 bg-muted/10'
                    }`}
                >
                  <div className="flex items-center justify-between border-b border-border/50 pb-1.5 mb-2">
                    <span className="text-sm font-black tracking-tight">GROUP {groupName}</span>
                    <span className="text-[9px] font-mono text-muted-foreground uppercase">{teamIds.length}/4 TEAMS</span>
                  </div>

                  <div className="space-y-1.5 min-h-[110px]">
                    {teamIds.map((teamId, idx) => {
                      const team = TEAMS.find(t => t.id === teamId)!;
                      const isUser = store.userTeamIds.includes(teamId);
                      return (
                        <div
                          key={teamId}
                          className="flex items-center justify-between text-xs py-1 px-1.5 border border-border/20 bg-muted/5 group"
                          style={isUser ? { borderLeft: '3px solid var(--primary)', paddingLeft: '5px' } : {}}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-[9px] text-muted-foreground">{idx + 1}</span>
                            <span>{team.flag}</span>
                            <span className={`truncate uppercase ${isUser ? 'font-bold' : ''}`}>
                              {team.name}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono text-muted-foreground">OVR {team.overallRating}</span>
                        </div>
                      );
                    })}

                    {/* Empty slots */}
                    {Array.from({ length: 4 - teamIds.length }).map((_, idx) => (
                      <div
                        key={idx}
                        className="border border-dashed border-border/30 h-7 flex items-center px-2 text-[10px] text-muted-foreground/40 font-mono tracking-widest uppercase justify-center"
                      >
                        EMPTY
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
