'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCoachStore } from '@/store/matchStore';
import { TEAMS } from '@/lib/simulation/data';
import { MatchEventType } from '@/lib/simulation/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  ChevronRight,
  Trophy,
  BarChart3,
  List,
  Gauge,
} from 'lucide-react';

const EVENT_ICONS: Record<MatchEventType, string> = {
  goal: '⚽',
  shot_on_target: '🎯',
  shot_off_target: '💨',
  corner: '🚩',
  foul: '⚠️',
  yellow_card: '🟨',
  red_card: '🟥',
  offside: '🚫',
  pass_sequence: '👟',
  substitution: '🔄',
  injury: '🩹',
  half_time: '⏸️',
  full_time: '🏁',
  kick_off: '🏟️',
};

export default function SimulationPage() {
  const store = useCoachStore();
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const teamA = TEAMS.find(t => t.id === store.teamAId)!;
  const teamB = TEAMS.find(t => t.id === store.teamBId)!;

  const frame = store.animationFrames[store.currentFrame];
  const result = store.matchResult;

  const stopAnimation = useCallback(() => {
    if (animRef.current) {
      clearInterval(animRef.current);
      animRef.current = null;
    }
  }, []);

  const startPlayback = useCallback(() => {
    stopAnimation();
    store.playAnimation();

    const speed = useCoachStore.getState().animationSpeed;
    animRef.current = setInterval(() => {
      const state = useCoachStore.getState();
      if (state.currentFrame >= 90) {
        useCoachStore.getState().pauseAnimation();
        stopAnimation();
        return;
      }
      useCoachStore.getState().setFrame(state.currentFrame + 1);
    }, Math.max(50, 800 / speed));
  }, [stopAnimation, store]);

  useEffect(() => {
    return () => stopAnimation();
  }, [stopAnimation]);

  useEffect(() => {
    if (store.isAnimating && !animRef.current) {
      startPlayback();
    }
  }, [store.isAnimating, startPlayback]);

  const togglePlay = () => {
    if (store.isAnimating) {
      store.pauseAnimation();
      stopAnimation();
    } else {
      if (store.currentFrame >= 90) store.setFrame(0);
      startPlayback();
    }
  };

  const goToStart = () => { stopAnimation(); store.pauseAnimation(); store.setFrame(0); };
  const goToEnd = () => { stopAnimation(); store.pauseAnimation(); store.setFrame(90); };
  const stepForward = () => { stopAnimation(); store.pauseAnimation(); store.setFrame(Math.min(90, store.currentFrame + 1)); };
  const stepBack = () => { stopAnimation(); store.pauseAnimation(); store.setFrame(Math.max(0, store.currentFrame - 1)); };

  if (!frame || !result) return null;

  const keyEvents = store.filteredEvents.filter(e => Math.floor(e.minute) <= store.currentFrame);

  return (
    <div className="space-y-4">
      {/* Scoreboard */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-muted/50 to-muted p-4 md:p-6">
          <div className="flex items-center justify-center gap-4 md:gap-8">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shadow"
                style={{ backgroundColor: teamA.color, color: teamA.textColor }}
              >
                {teamA.shortName}
              </div>
              <div className="text-right">
                <div className="font-bold text-sm md:text-base">{teamA.name}</div>
                <div className="text-xs text-muted-foreground">{frame.currentPhase === 'first_half' ? '1st Half' : frame.currentPhase === 'half_time' ? 'HT' : frame.currentPhase === 'second_half' ? '2nd Half' : 'FT'}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-3xl md:text-5xl font-black tabular-nums">{frame.score[0]}</span>
              <span className="text-xl md:text-2xl text-muted-foreground">-</span>
              <span className="text-3xl md:text-5xl font-black tabular-nums">{frame.score[1]}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-left">
                <div className="font-bold text-sm md:text-base">{teamB.name}</div>
                <div className="text-xs text-muted-foreground">{frame.minute}&apos;</div>
              </div>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shadow"
                style={{ backgroundColor: teamB.color, color: teamB.textColor }}
              >
                {teamB.shortName}
              </div>
            </div>
          </div>

          {/* Prediction bar */}
          {store.prediction && (
            <div className="mt-3 max-w-lg mx-auto">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{teamA.shortName} {store.prediction.winProbability[0]}%</span>
                <span>Draw {store.prediction.winProbability[1]}%</span>
                <span>{store.prediction.winProbability[2]}% {teamB.shortName}</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                <div className="bg-green-500 transition-all" style={{ width: `${store.prediction.winProbability[0]}%` }} />
                <div className="bg-gray-400 transition-all" style={{ width: `${store.prediction.winProbability[1]}%` }} />
                <div className="bg-red-500 transition-all" style={{ width: `${store.prediction.winProbability[2]}%` }} />
              </div>
              <div className="text-center text-xs text-muted-foreground mt-1">
                Predicted: {store.prediction.predictedScore[0]} - {store.prediction.predictedScore[1]}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Pitch */}
      <Card>
        <CardContent className="p-2 md:p-4">
          {/* Import PitchCanvas lazily */}
          <PitchCanvasWrapper />

          {/* Playback controls */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToStart}>
                <SkipBack className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={stepBack}>
                <ChevronRight className="w-3 h-3 rotate-180" />
              </Button>
              <Button
                size="lg"
                className="h-10 w-10 rounded-full"
                onClick={togglePlay}
              >
                {store.isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={stepForward}>
                <ChevronRight className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToEnd}>
                <SkipForward className="w-3 h-3" />
              </Button>
            </div>

            <div className="flex items-center gap-3 max-w-lg mx-auto">
              <span className="text-xs text-muted-foreground w-8">0&apos;</span>
              <Slider
                value={[store.currentFrame]}
                onValueChange={([v]) => { stopAnimation(); store.pauseAnimation(); store.setFrame(v); }}
                min={0}
                max={90}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-8">90&apos;</span>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Gauge className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Speed:</span>
              <Slider
                value={[store.animationSpeed]}
                onValueChange={([v]) => store.setAnimationSpeed(v)}
                min={1}
                max={20}
                step={1}
                className="w-24"
              />
              <span className="text-xs font-mono">{store.animationSpeed}x</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats & Timeline */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="timeline"><List className="w-3 h-3 mr-1" /> Timeline</TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="w-3 h-3 mr-1" /> Statistics</TabsTrigger>
          <TabsTrigger value="summary"><Trophy className="w-3 h-3 mr-1" /> Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-72">
                <div className="p-2 space-y-0.5">
                  {keyEvents.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">
                      Match events will appear here...
                    </p>
                  ) : (
                    keyEvents.map((event, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 p-2 rounded text-sm ${
                          event.type === 'goal'
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 font-medium'
                            : event.type === 'red_card'
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <Badge variant="outline" className="text-[10px] font-mono shrink-0 w-10 justify-center">
                          {event.minute}&apos;
                        </Badge>
                        <span className="shrink-0">{EVENT_ICONS[event.type]}</span>
                        <span className="text-xs leading-relaxed">{event.description}</span>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                {[
                  { label: 'Possession', a: frame.possession[0], b: frame.possession[1], suffix: '%' },
                  { label: 'Shots', a: frame.shots[0], b: frame.shots[1] },
                  { label: 'Shots on Target', a: frame.shotsOnTarget[0], b: frame.shotsOnTarget[1] },
                  { label: 'Corners', a: frame.corners[0], b: frame.corners[1] },
                  { label: 'Fouls', a: frame.fouls[0], b: frame.fouls[1] },
                  { label: 'Yellow Cards', a: frame.yellowCards[0], b: frame.yellowCards[1] },
                  { label: 'Red Cards', a: frame.redCards[0], b: frame.redCards[1] },
                  { label: 'Passes', a: frame.passes[0], b: frame.passes[1] },
                  { label: 'Pass Accuracy', a: frame.passAccuracy[0], b: frame.passAccuracy[1], suffix: '%' },
                ].map(stat => {
                  const total = (stat.a || 0) + (stat.b || 0) || 1;
                  return (
                    <div key={stat.label}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-bold w-10 text-right">{stat.a}{stat.suffix || ''}</span>
                        <span className="text-muted-foreground text-xs">{stat.label}</span>
                        <span className="font-bold w-10 text-left">{stat.b}{stat.suffix || ''}</span>
                      </div>
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                        <div
                          className="bg-green-500 rounded-l-full transition-all"
                          style={{ width: `${((stat.a || 0) / total) * 100}%` }}
                        />
                        <div
                          className="bg-red-500 rounded-r-full transition-all"
                          style={{ width: `${((stat.b || 0) / total) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold">Match Result</h3>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-right">
                    <div className="font-bold">{teamA.name}</div>
                  </div>
                  <div className="text-3xl font-black">
                    {result.score[0]} - {result.score[1]}
                  </div>
                  <div className="text-left">
                    <div className="font-bold">{teamB.name}</div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {result.score[0] > result.score[1]
                    ? `${teamA.name} wins!`
                    : result.score[0] < result.score[1]
                    ? `${teamB.name} wins!`
                    : 'Draw!'}
                </div>
              </div>

              <Separator />

              {store.prediction && (
                <div className="text-center space-y-2">
                  <h4 className="text-sm font-medium">Pre-Match Prediction vs Actual</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Predicted</div>
                      <div className="font-mono font-bold">{store.prediction.predictedScore[0]} - {store.prediction.predictedScore[1]}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Actual</div>
                      <div className="font-mono font-bold">{result.score[0]} - {result.score[1]}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Win Prob</div>
                      <div className="font-mono font-bold">{store.prediction.winProbability[0]}/{store.prediction.winProbability[1]}/{store.prediction.winProbability[2]}</div>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="text-center space-y-2">
                <h4 className="text-sm font-medium">Goal Scorers</h4>
                {result.events.filter(e => e.type === 'goal').map((e, i) => (
                  <div key={i} className="text-sm">
                    <Badge variant="outline" className="text-xs mr-1">{e.minute}&apos;</Badge>
                    {e.description}
                  </div>
                ))}
                {result.events.filter(e => e.type === 'goal').length === 0 && (
                  <p className="text-sm text-muted-foreground">No goals in this match</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reset button */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={store.resetMatch} className="gap-2">
          <RotateCcw className="w-4 h-4" /> New Match
        </Button>
      </div>
    </div>
  );
}

function PitchCanvasWrapper() {
  const [Canvas, setCanvas] = useState<any>(null);

  useEffect(() => {
    import('@/components/coach/PitchCanvas').then(mod => setCanvas(() => mod.default));
  }, []);

  if (!Canvas) return <div className="w-full h-64 bg-muted animate-pulse rounded-lg" />;
  return <Canvas />;
}
