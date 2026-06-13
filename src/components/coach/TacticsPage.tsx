'use client';

import { useState } from 'react';
import { useCoachStore } from '@/store/matchStore';
import { TEAMS } from '@/lib/simulation/data';
import { FormationType, TacticalSettings, Substitution } from '@/lib/simulation/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Play, ArrowLeft, Plus, X, Shield, Swords, Zap, Gauge, Users } from 'lucide-react';

const FORMATIONS: FormationType[] = [
  '4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '5-4-1', '4-1-4-1',
];

const MENTALITIES: { value: TacticalSettings['mentality']; label: string; icon: string }[] = [
  { value: 'defensive', label: 'Defensive', icon: '🛡️' },
  { value: 'cautious', label: 'Cautious', icon: '🔶' },
  { value: 'balanced', label: 'Balanced', icon: '⚖️' },
  { value: 'attacking', label: 'Attacking', icon: '⚡' },
  { value: 'very_attacking', label: 'All Out', icon: '🔥' },
];

function positionColor(pos: string) {
  if (['GK'].includes(pos)) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-300';
  return 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-300';
}

function TeamTacticsPanel({ teamKey }: { teamKey: 'A' | 'B' }) {
  const store = useCoachStore();
  const teamId = teamKey === 'A' ? store.teamAId : store.teamBId;
  const lineup = teamKey === 'A' ? store.lineupA : store.lineupB;
  const team = TEAMS.find(t => t.id === teamId)!;

  const [showSubDialog, setShowSubDialog] = useState(false);
  const [subOut, setSubOut] = useState('');
  const [subIn, setSubIn] = useState('');
  const [subMinute, setSubMinute] = useState(60);

  const startingPlayers = lineup.starting11
    .map(id => team.players.find(p => p.id === id))
    .filter(Boolean);

  const benchPlayers = lineup.subs
    .map(id => team.players.find(p => p.id === id))
    .filter(Boolean);

  const handleAddSub = () => {
    if (!subOut || !subIn) return;
    const sub: Substitution = {
      id: `sub_${Date.now()}`,
      playerOutId: subOut,
      playerInId: subIn,
      minute: subMinute,
      executed: false,
    };
    store.addSubstitution(teamKey, sub);
    setSubOut('');
    setSubIn('');
    setShowSubDialog(false);
  };

  // Calculate average rating of starting XI
  const avgRating = startingPlayers.length > 0
    ? Math.round(startingPlayers.reduce((sum, p) => sum + (p?.rating || 0), 0) / startingPlayers.length)
    : 0;

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <span className="text-lg">{team.flag}</span>
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ backgroundColor: team.color, color: team.textColor }}
          >
            {team.shortName.substring(0, 2)}
          </div>
          {team.name}
          <Badge variant="outline" className="ml-auto">OVR {team.overallRating}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formation */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Formation</label>
          <div className="grid grid-cols-4 gap-1.5">
            {FORMATIONS.map(f => (
              <button
                key={f}
                onClick={() => store.setFormation(teamKey, f)}
                className={`py-1.5 px-2 rounded-md text-sm font-mono border transition-all ${
                  lineup.formation === f
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 border-border hover:bg-muted'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Starting XI */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium flex items-center gap-1">
              <Users className="w-3 h-3" /> Starting XI
            </label>
            <Badge variant="secondary" className="text-xs">
              Avg {avgRating}
            </Badge>
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
            {startingPlayers.map((player, i) => (
              <div key={player!.id} className="flex items-center justify-between p-1.5 rounded bg-muted/30 text-sm hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-4 text-center text-xs">{i + 1}</span>
                  <Badge variant="outline" className={`text-[10px] px-1 py-0 ${positionColor(player!.position)}`}>
                    {player!.position}
                  </Badge>
                  <span className="font-medium">{player!.name}</span>
                </div>
                <Badge variant="secondary" className="text-xs">{player!.rating}</Badge>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Tactics */}
        <div className="space-y-3">
          <label className="text-sm font-medium block">Tactics</label>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Mentality</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {MENTALITIES.map(m => (
                <button
                  key={m.value}
                  onClick={() => store.setTactics(teamKey, { mentality: m.value })}
                  className={`py-1 px-1 rounded text-[11px] border transition-all ${
                    lineup.tactics.mentality === m.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 border-border hover:bg-muted'
                  }`}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>

          {[
            { key: 'pressingIntensity', label: 'Pressing', low: 'Low', high: 'High', icon: <Zap className="w-3 h-3" /> },
            { key: 'tempo', label: 'Tempo', low: 'Slow', high: 'Fast', icon: <Gauge className="w-3 h-3" /> },
            { key: 'width', label: 'Width', low: 'Narrow', high: 'Wide', icon: <Swords className="w-3 h-3" /> },
            { key: 'defensiveLine', label: 'Def. Line', low: 'Deep', high: 'High', icon: <Shield className="w-3 h-3" /> },
          ].map(({ key, label, low, high, icon }) => (
            <div key={key}>
              <div className="flex justify-between text-xs mb-1">
                <span className="flex items-center gap-1">{icon} {label}</span>
                <span className="text-muted-foreground">{low} → {high}</span>
              </div>
              <Slider
                value={[lineup.tactics[key as keyof TacticalSettings] as number]}
                onValueChange={([v]) => store.setTactics(teamKey, { [key]: v })}
                min={0}
                max={100}
                step={5}
                className="py-1"
              />
            </div>
          ))}
        </div>

        <Separator />

        {/* Substitutions */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium flex items-center gap-1">
              🔄 Planned Substitutions
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSubDialog(true)}
              className="h-7 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" /> Add Sub
            </Button>
          </div>

          {lineup.substitutions.length === 0 && (
            <p className="text-xs text-muted-foreground">No substitutions planned. Add one or make live subs during the match.</p>
          )}

          <div className="space-y-1">
            {lineup.substitutions.map(sub => {
              const outPlayer = team.players.find(p => p.id === sub.playerOutId);
              const inPlayer = team.players.find(p => p.id === sub.playerInId);
              return (
                <div key={sub.id} className="flex items-center justify-between p-1.5 rounded bg-muted/30 text-xs hover:bg-muted/50 transition-colors">
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 w-8 justify-center">
                      {sub.minute}&apos;
                    </Badge>
                    <span className="text-red-500">{outPlayer?.name}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-green-600">{inPlayer?.name}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => store.removeSubstitution(teamKey, sub.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
          </div>

          {showSubDialog && (
            <div className="mt-2 p-3 rounded-lg border bg-card space-y-2">
              <Select value={subOut} onValueChange={setSubOut}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Player OFF" />
                </SelectTrigger>
                <SelectContent>
                  {startingPlayers.map(p => (
                    <SelectItem key={p!.id} value={p!.id}>
                      {p!.name} ({p!.position}) - {p!.rating}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={subIn} onValueChange={setSubIn}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Player ON" />
                </SelectTrigger>
                <SelectContent>
                  {benchPlayers.map(p => (
                    <SelectItem key={p!.id} value={p!.id}>
                      {p!.name} ({p!.position}) - {p!.rating}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div>
                <label className="text-xs text-muted-foreground">Minute: {subMinute}&apos;</label>
                <Slider
                  value={[subMinute]}
                  onValueChange={([v]) => setSubMinute(v)}
                  min={46}
                  max={85}
                  step={1}
                  className="py-1"
                />
              </div>

              {/* Rating comparison */}
              {subOut && subIn && (() => {
                const outP = team.players.find(p => p.id === subOut);
                const inP = team.players.find(p => p.id === subIn);
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
                <Button size="sm" className="h-7 text-xs flex-1" onClick={handleAddSub}>
                  Add
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowSubDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TacticsPage() {
  const { setStep, startSimulation } = useCoachStore();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold">Configure Your Tactics</h2>
        <p className="text-muted-foreground">Set formations, lineups, tactics, and substitutions for each team</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TeamTacticsPanel teamKey="A" />
        <TeamTacticsPanel teamKey="B" />
      </div>

      <div className="flex justify-center gap-4">
        <Button variant="outline" size="lg" onClick={() => setStep('setup')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button size="lg" onClick={startSimulation} className="px-12">
          <Play className="w-4 h-4 mr-2" /> Simulate Match
        </Button>
      </div>
    </div>
  );
}
