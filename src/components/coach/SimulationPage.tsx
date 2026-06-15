'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCoachStore } from '@/store/matchStore';
import { useTournamentStore } from '@/store/tournamentStore';
import { TEAMS } from '@/lib/simulation/data';
import { MatchEventType, MatchEvent } from '@/lib/simulation/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  ArrowLeftRight,
  X,
  Clock,
  Zap,
  Shield,
  Swords,
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

const EVENT_COLORS: Record<MatchEventType, string> = {
  goal: 'border-l-4 border-yellow-400 bg-yellow-400/10',
  shot_on_target: 'border-l-4 border-blue-400 bg-blue-400/10',
  shot_off_target: 'border-l-4 border-border bg-muted/30',
  corner: 'border-l-4 border-orange-400 bg-orange-400/10',
  foul: 'border-l-4 border-amber-400 bg-amber-400/10',
  yellow_card: 'border-l-4 border-yellow-500 bg-yellow-500/10',
  red_card: 'border-l-4 border-red-500 bg-red-500/10',
  offside: 'border-l-4 border-purple-400 bg-purple-400/10',
  pass_sequence: 'border-l-4 border-primary/60 bg-primary/5',
  substitution: 'border-l-4 border-sky-400 bg-sky-400/10',
  injury: 'border-l-4 border-rose-400 bg-rose-400/10',
  half_time: 'border-l-4 border-border bg-muted/40',
  full_time: 'border-l-4 border-primary bg-primary/10',
  kick_off: 'border-l-4 border-border bg-muted/20',
};

function getTeamName(teamId: string, teamAId: string, teamBId: string): string {
  const teamA = TEAMS.find(t => t.id === teamAId);
  const teamB = TEAMS.find(t => t.id === teamBId);
  if (teamId === teamAId) return teamA?.shortName || 'H';
  if (teamId === teamBId) return teamB?.shortName || 'A';
  return '';
}

export default function SimulationPage() {
  const store = useCoachStore();
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [showSubPanel, setShowSubPanel] = useState(false);
  const [subTeam, setSubTeam] = useState<'A' | 'B'>('A');
  const [subOut, setSubOut] = useState('');
  const [subIn, setSubIn] = useState('');

  const teamA = TEAMS.find(t => t.id === store.teamAId)!;
  const teamB = TEAMS.find(t => t.id === store.teamBId)!;

  const maxFrameIdx = store.animationFrames.length - 1 || 90;
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
      const maxF = state.animationFrames.length - 1 || 90;
      if (state.currentFrame >= maxF) {
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

  // Auto-scroll timeline to bottom as events appear
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [store.filteredEvents.length]);

  const togglePlay = () => {
    if (store.isAnimating) {
      store.pauseAnimation();
      stopAnimation();
    } else {
      if (store.currentFrame >= maxFrameIdx) store.setFrame(0);
      startPlayback();
    }
  };

  const goToStart = () => { stopAnimation(); store.pauseAnimation(); store.setFrame(0); };
  const goToEnd = () => { stopAnimation(); store.pauseAnimation(); store.setFrame(maxFrameIdx); };
  const stepForward = () => { stopAnimation(); store.pauseAnimation(); store.setFrame(Math.min(maxFrameIdx, store.currentFrame + 1)); };
  const stepBack = () => { stopAnimation(); store.pauseAnimation(); store.setFrame(Math.max(0, store.currentFrame - 1)); };

  const handleLiveSub = () => {
    if (!subOut || !subIn) return;
    stopAnimation();
    store.pauseAnimation();
    store.liveSub(subTeam, subOut, subIn);
    setSubOut('');
    setSubIn('');
    setShowSubPanel(false);
  };

  // Get current players on pitch for substitution
  const currentLineup = subTeam === 'A' ? store.lineupA : store.lineupB;
  const currentTeam = subTeam === 'A' ? teamA : teamB;
  const pitchPlayers = currentLineup.starting11
    .map(id => currentTeam.players.find(p => p.id === id))
    .filter(Boolean);
  const benchPlayers = currentLineup.subs
    .map(id => currentTeam.players.find(p => p.id === id))
    .filter(p => p && p.id !== undefined);

  if (!frame || !result) return null;

  // Build key events list that accurately reflects animation frames
  const keyEvents = store.filteredEvents.filter(e => Math.floor(e.minute) <= store.currentFrame);

  // Build accurate summary from frame data
  const goalEvents = store.eventLog.filter(e => e.type === 'goal' && Math.floor(e.minute) <= store.currentFrame);
  const cardEvents = store.eventLog.filter(e => (e.type === 'yellow_card' || e.type === 'red_card') && Math.floor(e.minute) <= store.currentFrame);
  const subEvents = store.eventLog.filter(e => e.type === 'substitution' && Math.floor(e.minute) <= store.currentFrame);

  // Possession momentum flow (last 10 minutes)
  const possessionFlow = () => {
    const startMinute = Math.max(0, store.currentFrame - 10);
    let aCount = 0, bCount = 0;
    for (let m = startMinute; m <= store.currentFrame; m++) {
      const mEvents = store.eventLog.filter(e => Math.floor(e.minute) === m && e.teamId);
      if (mEvents.length > 0) {
        const last = mEvents[mEvents.length - 1];
        if (last.teamId === teamA.id) aCount++;
        else if (last.teamId === teamB.id) bCount++;
      }
    }
    const total = aCount + bCount || 1;
    return { a: Math.round((aCount / total) * 100), b: Math.round((bCount / total) * 100) };
  };
  const momentum = possessionFlow();

  const isHalfTime = frame.currentPhase === 'half_time' || frame.currentPhase === 'extra_time_half';
  const isFullTime = frame.isFinished;

  return (
    <div className="space-y-4">
      {/* Kinetic heading */}
      <div className="space-y-1">
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
          Step 03 — Match Simulation
        </div>
        <h2 className="text-5xl md:text-6xl font-black leading-none tracking-tighter uppercase">
          MATCH<br />
          <span style={{ color: 'var(--primary)' }}>DAY</span>
        </h2>
      </div>

      {/* Scoreboard */}
      <Card className="overflow-hidden rounded-none">
        <div className="bg-muted/30 border-b border-border p-4 md:p-6">
          <div className="flex items-center justify-center gap-4 md:gap-8">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{teamA.flag}</span>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shadow"
                style={{ backgroundColor: teamA.color, color: teamA.textColor }}
              >
                {teamA.shortName}
              </div>
              <div className="text-right">
                <div className="font-bold text-sm md:text-base">{teamA.name}</div>
                <div className="text-xs text-muted-foreground">
                  {
                    frame.currentPhase === 'first_half' ? '1st Half' :
                    frame.currentPhase === 'half_time' ? 'Half Time' :
                    frame.currentPhase === 'second_half' ? '2nd Half' :
                    frame.currentPhase === 'extra_time_first' ? 'ET 1st Half' :
                    frame.currentPhase === 'extra_time_half' ? 'ET Half Time' :
                    frame.currentPhase === 'extra_time_second' ? 'ET 2nd Half' :
                    frame.currentPhase === 'extra_time_finished' ? 'ET Finished' :
                    frame.currentPhase === 'penalty_shootout' ? 'Penalties' :
                    'Full Time'
                  }
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-3xl md:text-5xl font-black tabular-nums transition-all ${goalEvents.some(g => Math.floor(g.minute) === store.currentFrame) ? 'scale-110 text-yellow-500' : ''}`}>
                {frame.score[0]}
              </span>
              <span className="text-xl md:text-2xl text-muted-foreground">-</span>
              <span className={`text-3xl md:text-5xl font-black tabular-nums transition-all ${goalEvents.some(g => Math.floor(g.minute) === store.currentFrame) ? 'scale-110 text-yellow-500' : ''}`}>
                {frame.score[1]}
              </span>
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
              <span className="text-2xl">{teamB.flag}</span>
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
              {/* Live Sub Button */}
              <Button
                variant="outline"
                size="sm"
                className="ml-2 gap-1 text-xs"
                onClick={() => { stopAnimation(); store.pauseAnimation(); setShowSubPanel(true); }}
                title="Make a live substitution"
              >
                <ArrowLeftRight className="w-3 h-3" /> Sub
              </Button>
            </div>

            <div className="flex items-center gap-3 max-w-lg mx-auto">
              <span className="text-xs text-muted-foreground w-8">0&apos;</span>
              <Slider
                value={[store.currentFrame]}
                onValueChange={([v]) => { stopAnimation(); store.pauseAnimation(); store.setFrame(v); }}
                min={0}
                max={maxFrameIdx}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-8">{maxFrameIdx}&apos;</span>
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

      {/* Live Substitution Panel */}
      {showSubPanel && (
        <Card className="border-2 border-primary/50 animate-in slide-in-from-bottom-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4" /> Live Substitution — {store.currentFrame}&apos;
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSubPanel(false)}>
                <X className="w-3 h-3" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Team selector */}
            <div className="flex gap-2">
              <button
                onClick={() => { setSubTeam('A'); setSubOut(''); setSubIn(''); }}
                className={`flex-1 p-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  subTeam === 'A' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="mr-1">{teamA.flag}</span> {teamA.name}
              </button>
              <button
                onClick={() => { setSubTeam('B'); setSubOut(''); setSubIn(''); }}
                className={`flex-1 p-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  subTeam === 'B' ? 'border-destructive bg-destructive/5' : 'border-border hover:border-destructive/50'
                }`}
              >
                <span className="mr-1">{teamB.flag}</span> {teamB.name}
              </button>
            </div>

            {/* Player OUT */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Player OFF</label>
              <Select value={subOut} onValueChange={setSubOut}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select player to take off..." />
                </SelectTrigger>
                <SelectContent>
                  {pitchPlayers.map(p => (
                    <SelectItem key={p!.id} value={p!.id}>
                      {p!.name} ({p!.position}) - OVR {p!.rating}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Player IN */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Player ON</label>
              <Select value={subIn} onValueChange={setSubIn}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select substitute to bring on..." />
                </SelectTrigger>
                <SelectContent>
                  {benchPlayers.map(p => (
                    <SelectItem key={p!.id} value={p!.id}>
                      {p!.name} ({p!.position}) - OVR {p!.rating}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rating comparison */}
            {subOut && subIn && (() => {
              const outP = currentTeam.players.find(p => p.id === subOut);
              const inP = currentTeam.players.find(p => p.id === subIn);
              if (!outP || !inP) return null;
              const diff = inP.rating - outP.rating;
              return (
                <div className="text-center text-xs">
                  <span className="text-muted-foreground">Rating change: </span>
                  <span className={diff > 0 ? 'text-green-600 font-bold' : diff < 0 ? 'text-red-600 font-bold' : 'font-bold'}>
                    {diff > 0 ? '+' : ''}{diff}
                  </span>
                </div>
              );
            })()}

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 text-xs"
                disabled={!subOut || !subIn || subOut === subIn}
                onClick={handleLiveSub}
              >
                <ArrowLeftRight className="w-3 h-3 mr-1" /> Make Substitution
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowSubPanel(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                <div ref={timelineRef} className="p-2 space-y-1">
                  {keyEvents.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">
                      Match events will appear here as the match progresses...
                    </p>
                  ) : (
                    keyEvents.map((event, i) => {
                      const teamBadge = event.teamId
                        ? getTeamName(event.teamId, store.teamAId, store.teamBId)
                        : '';
                      const isTeamA = event.teamId === store.teamAId;

                      return (
                        <div
                          key={`${event.minute}-${event.type}-${i}`}
                          className={`flex items-start gap-2 p-2 rounded text-sm transition-all ${
                            EVENT_COLORS[event.type] || 'hover:bg-muted/50'
                          } ${event.type === 'goal' ? 'font-medium' : ''}`}
                        >
                          <Badge variant="outline" className="text-[10px] font-mono shrink-0 w-10 justify-center">
                            {Math.floor(event.minute)}&apos;
                          </Badge>
                          <span className="shrink-0 text-base">{EVENT_ICONS[event.type]}</span>
                          {teamBadge && (
                            <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isTeamA
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            }`}>
                              {teamBadge}
                            </span>
                          )}
                          <span className="text-xs leading-relaxed">{event.description}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Momentum indicator */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <Zap className="w-3 h-3" /> {teamA.shortName} {momentum.a}%
                  </span>
                  <span className="text-muted-foreground">Momentum (last 10 min)</span>
                  <span className="text-red-600 font-medium flex items-center gap-1">
                    {momentum.b}% {teamB.shortName} <Zap className="w-3 h-3" />
                  </span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                  <div className="bg-green-500 transition-all duration-500" style={{ width: `${momentum.a}%` }} />
                  <div className="bg-red-500 transition-all duration-500" style={{ width: `${momentum.b}%` }} />
                </div>
              </div>

              <Separator />

              {/* Full stats */}
              <div className="space-y-3">
                {[
                  { label: 'Possession', a: frame.possession[0], b: frame.possession[1], suffix: '%', icon: <Clock className="w-3 h-3" /> },
                  { label: 'Shots', a: frame.shots[0], b: frame.shots[1], icon: <Swords className="w-3 h-3" /> },
                  { label: 'Shots on Target', a: frame.shotsOnTarget[0], b: frame.shotsOnTarget[1], icon: <Zap className="w-3 h-3" /> },
                  { label: 'Corners', a: frame.corners[0], b: frame.corners[1], icon: <Shield className="w-3 h-3" /> },
                  { label: 'Fouls', a: frame.fouls[0], b: frame.fouls[1], icon: <Shield className="w-3 h-3" /> },
                  { label: 'Yellow Cards', a: frame.yellowCards[0], b: frame.yellowCards[1], icon: <Shield className="w-3 h-3" /> },
                  { label: 'Red Cards', a: frame.redCards[0], b: frame.redCards[1], icon: <Shield className="w-3 h-3" /> },
                  { label: 'Passes', a: frame.passes[0], b: frame.passes[1], icon: <Swords className="w-3 h-3" /> },
                  { label: 'Pass Accuracy', a: frame.passAccuracy[0], b: frame.passAccuracy[1], suffix: '%', icon: <Zap className="w-3 h-3" /> },
                ].map(stat => {
                  const total = (stat.a || 0) + (stat.b || 0) || 1;
                  const aRatio = (stat.a || 0) / total;
                  const bRatio = (stat.b || 0) / total;
                  const aLeading = (stat.a || 0) > (stat.b || 0);
                  const bLeading = (stat.b || 0) > (stat.a || 0);
                  return (
                    <div key={stat.label}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className={`font-bold w-12 text-right ${aLeading ? 'text-green-600' : ''}`}>
                          {stat.a}{stat.suffix || ''}
                        </span>
                        <span className="text-muted-foreground text-xs flex items-center gap-1">
                          {stat.icon} {stat.label}
                        </span>
                        <span className={`font-bold w-12 text-left ${bLeading ? 'text-red-600' : ''}`}>
                          {stat.b}{stat.suffix || ''}
                        </span>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                        <div
                          className="bg-green-500 rounded-l-full transition-all duration-300"
                          style={{ width: `${aRatio * 100}%` }}
                        />
                        <div
                          className="bg-red-500 rounded-r-full transition-all duration-300"
                          style={{ width: `${bRatio * 100}%` }}
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
              {/* Match Result */}
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold">
                  {isFullTime ? 'Full Time Result' : isHalfTime ? 'Half Time' : 'Match In Progress'}
                </h3>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-lg">{teamA.flag}</span>
                      <span className="font-bold">{teamA.name}</span>
                    </div>
                  </div>
                  <div className="text-3xl font-black">
                    {frame.score[0]} - {frame.score[1]}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{teamB.name}</span>
                      <span className="text-lg">{teamB.flag}</span>
                    </div>
                  </div>
                </div>
                {(isFullTime || isHalfTime) && (
                  <div className="text-sm font-medium mt-1">
                    {frame.score[0] > frame.score[1]
                      ? `${teamA.name} ${isFullTime ? 'wins!' : 'leads!'}`
                      : frame.score[0] < frame.score[1]
                      ? `${teamB.name} ${isFullTime ? 'wins!' : 'leads!'}`
                      : 'Level!'}
                  </div>
                )}
              </div>

              <Separator />

              {/* Goal Scorers */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <span>⚽</span> Goal Scorers
                </h4>
                {goalEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No goals yet</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {/* Team A goals */}
                    <div className="space-y-1">
                      {goalEvents
                        .filter(e => e.teamId === teamA.id)
                        .map((e, i) => (
                          <div key={`a-${i}`} className="text-sm flex items-center gap-2 p-1.5 rounded bg-green-50 dark:bg-green-900/10">
                            <Badge variant="outline" className="text-xs font-mono w-8 justify-center shrink-0">
                              {Math.floor(e.minute)}&apos;
                            </Badge>
                            <span>{e.playerId
                              ? teamA.players.find(p => p.id === e.playerId)?.name || 'Unknown'
                              : 'Unknown'
                            }</span>
                          </div>
                        ))
                      }
                    </div>
                    {/* Team B goals */}
                    <div className="space-y-1">
                      {goalEvents
                        .filter(e => e.teamId === teamB.id)
                        .map((e, i) => (
                          <div key={`b-${i}`} className="text-sm flex items-center gap-2 p-1.5 rounded bg-red-50 dark:bg-red-900/10">
                            <Badge variant="outline" className="text-xs font-mono w-8 justify-center shrink-0">
                              {Math.floor(e.minute)}&apos;
                            </Badge>
                            <span>{e.playerId
                              ? teamB.players.find(p => p.id === e.playerId)?.name || 'Unknown'
                              : 'Unknown'
                            }</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Cards */}
              {cardEvents.length > 0 && (
                <>
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <span>🟨</span> Disciplinary
                    </h4>
                    <div className="space-y-1">
                      {cardEvents.map((e, i) => (
                        <div key={i} className="text-sm flex items-center gap-2 p-1.5 rounded bg-muted/30">
                          <Badge variant="outline" className="text-xs font-mono w-8 justify-center shrink-0">
                            {Math.floor(e.minute)}&apos;
                          </Badge>
                          <span>{e.type === 'yellow_card' ? '🟨' : '🟥'}</span>
                          <span className="text-xs">{e.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Substitutions */}
              {subEvents.length > 0 && (
                <>
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <span>🔄</span> Substitutions
                    </h4>
                    <div className="space-y-1">
                      {subEvents.map((e, i) => (
                        <div key={i} className="text-sm flex items-center gap-2 p-1.5 rounded bg-muted/30">
                          <Badge variant="outline" className="text-xs font-mono w-8 justify-center shrink-0">
                            {Math.floor(e.minute)}&apos;
                          </Badge>
                          <span className="text-xs">{e.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Key Stats Comparison */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" /> Key Stats
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="p-2 rounded bg-green-50 dark:bg-green-900/10">
                    <div className="font-bold text-lg">{frame.possession[0]}%</div>
                    <div className="text-[10px] text-muted-foreground">Possession</div>
                  </div>
                  <div className="p-2 rounded bg-muted/30">
                    <div className="font-bold text-lg">{frame.shots[0]} - {frame.shots[1]}</div>
                    <div className="text-[10px] text-muted-foreground">Shots</div>
                  </div>
                  <div className="p-2 rounded bg-red-50 dark:bg-red-900/10">
                    <div className="font-bold text-lg">{frame.possession[1]}%</div>
                    <div className="text-[10px] text-muted-foreground">Possession</div>
                  </div>
                </div>
              </div>

              {/* Prediction vs Actual */}
              {store.prediction && isFullTime && (
                <>
                  <Separator />
                  <div className="text-center space-y-2">
                    <h4 className="text-sm font-medium">Pre-Match Prediction vs Actual</h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="p-2 rounded bg-muted/30">
                        <div className="text-muted-foreground text-xs">Predicted</div>
                        <div className="font-mono font-bold">{store.prediction.predictedScore[0]} - {store.prediction.predictedScore[1]}</div>
                      </div>
                      <div className="p-2 rounded bg-primary/10">
                        <div className="text-muted-foreground text-xs">Actual</div>
                        <div className="font-mono font-bold">{frame.score[0]} - {frame.score[1]}</div>
                      </div>
                      <div className="p-2 rounded bg-muted/30">
                        <div className="text-muted-foreground text-xs">Win Prob</div>
                        <div className="font-mono font-bold text-xs">{store.prediction.winProbability[0]}/{store.prediction.winProbability[1]}/{store.prediction.winProbability[2]}</div>
                      </div>
                    </div>
                    {(() => {
                      const predWinner = store.prediction.predictedScore[0] > store.prediction.predictedScore[1] ? teamA.name
                        : store.prediction.predictedScore[0] < store.prediction.predictedScore[1] ? teamB.name : 'Draw';
                      const actualWinner = frame.score[0] > frame.score[1] ? teamA.name
                        : frame.score[0] < frame.score[1] ? teamB.name : 'Draw';
                      const correct = predWinner === actualWinner;
                      return (
                        <Badge variant={correct ? 'default' : 'destructive'} className="text-xs">
                          {correct ? 'Prediction Correct!' : 'Prediction was wrong'}
                        </Badge>
                      );
                    })()}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Penalty Shootout Scorecard */}
      {frame.currentPhase === 'penalty_shootout' && (
        <Card className="rounded-none border-2 border-primary bg-muted/10">
          <CardHeader className="py-2.5 border-b border-border/60">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-center flex items-center justify-center gap-1.5">
              <Trophy className="w-4 h-4 text-primary" /> Penalty Shootout
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Shootout Score Display */}
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                PENALTY SHOOTOUT SCORE
              </div>
              <div className="text-4xl font-black tracking-tight tabular-nums">
                {frame.shootoutScore ? `${frame.shootoutScore[0]} - ${frame.shootoutScore[1]}` : '0 - 0'}
              </div>
            </div>

            {/* List of Kicks */}
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
              {store.eventLog
                .filter(e => e.type === 'penalty_shootout_kick' && Math.floor(e.minute) <= store.currentFrame)
                .map((e, idx) => {
                  const isA = e.teamId === teamA.id;
                  const scored = e.description.includes('SCORED');
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-1.5 border border-border/20 ${
                        scored ? 'bg-green-500/5' : 'bg-red-500/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{isA ? teamA.flag : teamB.flag}</span>
                        <span className="font-bold">{isA ? teamA.shortName : teamB.shortName}</span>
                      </div>
                      <span className="truncate max-w-[200px] text-muted-foreground">
                        {e.description.split(':').pop()?.trim()}
                      </span>
                      <span className={scored ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>
                        {scored ? '[✓]' : '[✗]'}
                      </span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reset/Submit button */}
      <div className="flex justify-center mt-4">
        {useTournamentStore.getState().mode === 'tournament' ? (
          <Button
            disabled={!isFullTime}
            onClick={() => {
              const score = frame.score;
              const shootoutScore = frame.shootoutScore;
              const events = store.eventLog;
              useTournamentStore.getState().submitMatchResult(score, shootoutScore, events);
              store.resetMatch();
            }}
            className="rounded-none font-bold text-xs tracking-wider uppercase text-background"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            SUBMIT RESULT & RETURN TO HUB
          </Button>
        ) : (
          <Button variant="outline" onClick={store.resetMatch} className="gap-2 rounded-none">
            <RotateCcw className="w-4 h-4" /> New Match
          </Button>
        )}
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
