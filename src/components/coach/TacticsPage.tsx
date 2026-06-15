'use client';

import { useState, useCallback, useRef } from 'react';
import { useCoachStore } from '@/store/matchStore';
import { TEAMS } from '@/lib/simulation/data';
import { FormationType, TacticalSettings, Substitution, Player, Position } from '@/lib/simulation/types';
import { FORMATIONS, FormationPosition } from '@/lib/simulation/formations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Play, ArrowLeft, Plus, X, Shield, Swords, Zap, Gauge, Users, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

const FORMATION_LIST: FormationType[] = [
  '4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '5-4-1', '4-1-4-1',
];

const MENTALITIES: { value: TacticalSettings['mentality']; label: string; icon: string }[] = [
  { value: 'defensive', label: 'Defensive', icon: '🛡️' },
  { value: 'cautious', label: 'Cautious', icon: '🔶' },
  { value: 'balanced', label: 'Balanced', icon: '⚖️' },
  { value: 'attacking', label: 'Attacking', icon: '⚡' },
  { value: 'very_attacking', label: 'All Out', icon: '🔥' },
];

function positionColor(pos: string): string {
  if (['GK'].includes(pos)) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-300';
  return 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-300';
}

function positionBgColor(pos: string): string {
  if (['GK'].includes(pos)) return 'bg-yellow-500';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'bg-blue-500';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'bg-green-500';
  return 'bg-red-500';
}

function positionBorderColor(pos: string): string {
  if (['GK'].includes(pos)) return 'border-yellow-400';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'border-blue-400';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'border-green-400';
  return 'border-red-400';
}

// Compatibility: which real positions can play in a formation slot
const SLOT_COMPATIBILITY: Record<Position, Position[]> = {
  'GK': ['GK'],
  'CB': ['CB'],
  'LB': ['LB', 'LWB'],
  'RB': ['RB', 'RWB'],
  'LWB': ['LWB', 'LB'],
  'RWB': ['RWB', 'RB'],
  'CDM': ['CDM', 'CM', 'CB'],
  'CM': ['CM', 'CDM', 'CAM'],
  'CAM': ['CAM', 'CM', 'CF'],
  'LM': ['LM', 'LW', 'LB'],
  'RM': ['RM', 'RW', 'RB'],
  'LW': ['LW', 'LM', 'CF', 'ST'],
  'RW': ['RW', 'RM', 'CF', 'ST'],
  'CF': ['CF', 'ST', 'CAM'],
  'ST': ['ST', 'CF', 'LW', 'RW'],
};

function isCompatible(playerPos: Position, slotPos: Position): boolean {
  return SLOT_COMPATIBILITY[slotPos]?.includes(playerPos) ?? false;
}

// ─── Pitch Component ────────────────────────────────────────────
function FootballPitch({
  teamKey,
}: {
  teamKey: 'A' | 'B';
}) {
  const store = useCoachStore();
  const teamId = teamKey === 'A' ? store.teamAId : store.teamBId;
  const lineup = teamKey === 'A' ? store.lineupA : store.lineupB;
  const team = TEAMS.find(t => t.id === teamId);

  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);

  if (!team) return null;

  const formationSlots = FORMATIONS[lineup.formation];
  const startingPlayers = lineup.starting11.map(id =>
    id ? team.players.find(p => p.id === id) : null
  );
  const benchPlayers = lineup.subs.map(id => team.players.find(p => p.id === id)).filter(Boolean) as Player[];

  // Calculate avg rating
  const filledPlayers = startingPlayers.filter(Boolean) as Player[];
  const avgRating = filledPlayers.length > 0
    ? Math.round(filledPlayers.reduce((sum, p) => sum + p.rating, 0) / filledPlayers.length)
    : 0;

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, sourceType: 'pitch' | 'bench', sourceIndex: number) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ sourceType, sourceIndex }));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot(slotIndex);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverSlot(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetSlotIndex: number) => {
    e.preventDefault();
    setDragOverSlot(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));

      if (data.sourceType === 'bench') {
        // Bench player dropped onto a pitch slot
        const benchPlayerId = lineup.subs[data.sourceIndex];
        if (benchPlayerId) {
          store.swapPlayerIn(teamKey, targetSlotIndex, benchPlayerId);
        }
      } else if (data.sourceType === 'pitch') {
        // Pitch player dragged to another pitch slot — swap them
        if (data.sourceIndex !== targetSlotIndex) {
          store.swapPlayers(teamKey, data.sourceIndex, targetSlotIndex);
        }
      }
    } catch {}
  }, [lineup, store, teamKey]);

  const handleBenchDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleBenchDrop = useCallback((e: React.DragEvent, benchIndex: number) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.sourceType === 'pitch') {
        // Pitch player dragged to bench — remove from starting
        store.swapPlayerOut(teamKey, data.sourceIndex);
      }
    } catch {}
  }, [store, teamKey]);

  // Pick from bench for a specific slot
  const handlePickForSlot = useCallback((slotIndex: number, playerId: string) => {
    store.swapPlayerIn(teamKey, slotIndex, playerId);
    setPickerSlot(null);
  }, [store, teamKey]);

  // Get compatible bench players for a slot
  const getCompatibleBench = useCallback((slotIndex: number) => {
    const slotPos = formationSlots[slotIndex]?.position;
    if (!slotPos) return benchPlayers;
    const compatible = benchPlayers.filter(p => isCompatible(p.position, slotPos));
    // If no compatible, show all bench
    return compatible.length > 0 ? compatible : benchPlayers;
  }, [benchPlayers, formationSlots]);

  return (
    <div className="space-y-3">
      {/* Team header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{team.flag}</span>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ backgroundColor: team.color, color: team.textColor }}
        >
          {team.shortName.substring(0, 2)}
        </div>
        <span className="font-bold text-lg">{team.name}</span>
        <Badge variant="outline" className="ml-1">OVR {team.overallRating}</Badge>
        <Badge variant="secondary" className="ml-auto">Avg XI: {avgRating}</Badge>
      </div>

      {/* Formation selector */}
      <div className="flex flex-wrap gap-1.5">
        {FORMATION_LIST.map(f => (
          <button
            key={f}
            onClick={() => store.setFormation(teamKey, f)}
            className={`py-1 px-2.5 rounded-md text-sm font-mono border transition-all ${
              lineup.formation === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted/50 border-border hover:bg-muted'
            }`}
          >
            {f}
          </button>
        ))}
        <button
          onClick={() => store.autoFillLineup(teamKey)}
          className="py-1 px-2.5 rounded-md text-sm border border-dashed border-muted-foreground/50 hover:bg-muted/50 transition-all flex items-center gap-1"
          title="Auto-fill best XI"
        >
          <RotateCcw className="w-3 h-3" /> Auto
        </button>
      </div>

      {/* Football pitch */}
      <div className="relative w-full aspect-[1.6/1] rounded-xl overflow-hidden border-2 border-green-700/40 shadow-lg"
        style={{
          background: 'linear-gradient(180deg, #1a6e2e 0%, #228b3a 15%, #1a6e2e 30%, #228b3a 45%, #1a6e2e 60%, #228b3a 75%, #1a6e2e 100%)',
        }}
      >
        {/* Pitch markings */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 62.5" fill="none" preserveAspectRatio="none">
          {/* Outer border */}
          <rect x="2" y="2" width="96" height="58.5" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
          {/* Center line */}
          <line x1="50" y1="2" x2="50" y2="60.5" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
          {/* Center circle */}
          <circle cx="50" cy="31.25" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
          {/* Center spot */}
          <circle cx="50" cy="31.25" r="0.5" fill="rgba(255,255,255,0.3)" />
          {/* Left penalty area */}
          <rect x="2" y="13" width="14" height="36.5" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
          {/* Left goal area */}
          <rect x="2" y="21" width="6" height="20.5" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
          {/* Left penalty spot */}
          <circle cx="12" cy="31.25" r="0.4" fill="rgba(255,255,255,0.3)" />
          {/* Right penalty area */}
          <rect x="84" y="13" width="14" height="36.5" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
          {/* Right goal area */}
          <rect x="94" y="21" width="4" height="20.5" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
        </svg>

        {/* Players on pitch */}
        {formationSlots.map((slot, index) => {
          const player = startingPlayers[index];
          const isDragOver = dragOverSlot === index;
          const isPickerOpen = pickerSlot === index;

          // Convert formation x,y (0-100) to pitch positions
          // x: 0 = GK (left), 100 = ST (right) -> map to 6%-94%
          // y: 0 = top, 100 = bottom -> map to 6%-94%
          const px = 4 + (slot.x / 100) * 92;
          const py = 4 + (slot.y / 100) * 88;

          return (
            <div
              key={index}
              className="absolute"
              style={{
                left: `${px}%`,
                top: `${py}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isPickerOpen ? 25 : isDragOver ? 30 : 10,
              }}
            >
              {/* Player node */}
              <div
                draggable={!!player}
                onDragStart={player ? (e) => handleDragStart(e, 'pitch', index) : undefined}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onClick={() => setPickerSlot(isPickerOpen ? null : index)}
                className={`
                  relative cursor-pointer select-none transition-all duration-200
                  ${isDragOver ? 'scale-125' : ''}
                  ${!player ? 'opacity-70 hover:opacity-100' : 'hover:scale-105'}
                `}
              >
                {/* Player circle */}
                <div className={`
                  w-11 h-11 sm:w-12 sm:h-12 rounded-full flex flex-col items-center justify-center
                  border-2 shadow-lg backdrop-blur-sm
                  ${player
                    ? `${positionBorderColor(player.position)} border-2`
                    : 'border-white/40 border-dashed'
                  }
                  ${isDragOver ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-transparent' : ''}
                  ${isPickerOpen ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent' : ''}
                `}
                style={{
                  backgroundColor: player
                    ? team.color + 'dd'
                    : 'rgba(0,0,0,0.4)',
                }}
                >
                  {player ? (
                    <>
                      <span className="text-[7px] sm:text-[8px] font-bold leading-none text-white truncate max-w-[36px] sm:max-w-[44px]">
                        {player.name.length > 8 ? player.name.split(' ').slice(-1)[0]?.substring(0, 8) : player.name}
                      </span>
                      <span className="text-[7px] sm:text-[8px] leading-none text-white/80">{player.rating}</span>
                    </>
                  ) : (
                    <Plus className="w-4 h-4 text-white/60" />
                  )}
                </div>

                {/* Position label below */}
                <div className="mt-0.5 text-center">
                  <span className={`
                    text-[8px] sm:text-[9px] font-bold px-1 py-0 rounded
                    ${positionColor(slot.position)} bg-opacity-80 backdrop-blur-sm
                  `}>
                    {slot.position}
                  </span>
                </div>

                {/* Compatibility warning */}
                {player && !isCompatible(player.position, slot.position) && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-[6px] text-white font-bold">!</span>
                  </div>
                )}
              </div>

              {/* Bench player picker for this slot */}
              {isPickerOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 max-h-48 overflow-y-auto bg-popover border rounded-lg shadow-xl"
                  style={{ zIndex: 20 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-popover p-2 border-b">
                    <div className="text-xs font-medium">Add to {slot.position}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {getCompatibleBench(index).length} available
                    </div>
                  </div>
                  <div className="p-1">
                    {getCompatibleBench(index).length === 0 && (
                      <div className="text-xs text-muted-foreground p-2 text-center">No players available</div>
                    )}
                    {getCompatibleBench(index).map(p => (
                      <button
                        key={p.id}
                        onClick={() => handlePickForSlot(index, p.id)}
                        className={`w-full flex items-center gap-2 p-1.5 rounded text-left hover:bg-muted/50 transition-colors ${
                          !isCompatible(p.position, slot.position) ? 'opacity-60' : ''
                        }`}
                      >
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${positionColor(p.position)}`}>
                          {p.position}
                        </Badge>
                        <span className="text-xs font-medium flex-1 truncate">{p.name}</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">{p.rating}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Click-away overlay for picker */}
        {pickerSlot !== null && (
          <div
            className="absolute inset-0"
            onClick={() => setPickerSlot(null)}
            style={{ zIndex: 9 }}
          />
        )}
      </div>

      {/* Bench */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium flex items-center gap-1">
            🪑 Bench ({benchPlayers.length})
          </span>
          <span className="text-[10px] text-muted-foreground">Drag to pitch or click + on pitch to add</span>
        </div>
        <div
          className="flex flex-wrap gap-1.5 p-2 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/10 min-h-[40px]"
          onDragOver={handleBenchDragOver}
          onDrop={(e) => handleBenchDrop(e, 0)}
        >
          {benchPlayers.length === 0 && (
            <span className="text-xs text-muted-foreground py-2">No players on bench</span>
          )}
          {benchPlayers.map((player, benchIdx) => (
            <div
              key={player.id}
              draggable
              onDragStart={(e) => handleDragStart(e, 'bench', benchIdx)}
              className="flex items-center gap-1 px-2 py-1 rounded-md border bg-card cursor-grab active:cursor-grabbing hover:shadow-md transition-all text-xs"
            >
              <Badge variant="outline" className={`text-[8px] px-1 py-0 ${positionColor(player.position)}`}>
                {player.position}
              </Badge>
              <span className="font-medium max-w-[80px] truncate">{player.name.split(' ').pop()}</span>
              <Badge variant="secondary" className="text-[8px] px-1 py-0">{player.rating}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Tactics Page ──────────────────────────────────────────
function TeamTacticsPanel({ teamKey }: { teamKey: 'A' | 'B' }) {
  const store = useCoachStore();
  const teamId = teamKey === 'A' ? store.teamAId : store.teamBId;
  const lineup = teamKey === 'A' ? store.lineupA : store.lineupB;
  const team = TEAMS.find(t => t.id === teamId);

  const [showSubDialog, setShowSubDialog] = useState(false);
  const [subOut, setSubOut] = useState('');
  const [subIn, setSubIn] = useState('');
  const [subMinute, setSubMinute] = useState(60);
  const [showTactics, setShowTactics] = useState(false);

  if (!team) return null;

  const startingPlayers = lineup.starting11
    .map(id => id ? team.players.find(p => p.id === id) : null)
    .filter(Boolean) as Player[];
  const benchPlayers = lineup.subs
    .map(id => team.players.find(p => p.id === id))
    .filter(Boolean) as Player[];

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

  const avgRating = startingPlayers.length > 0
    ? Math.round(startingPlayers.reduce((sum, p) => sum + p.rating, 0) / startingPlayers.length)
    : 0;

  return (
    <Card className="border-2">
      <CardContent className="pt-4 space-y-3">
        {/* Pitch view */}
        <FootballPitch teamKey={teamKey} />

        <Separator />

        {/* Collapsible tactics */}
        <div>
          <button
            className="w-full flex items-center justify-between text-sm font-medium py-1"
            onClick={() => setShowTactics(!showTactics)}
          >
            <span className="flex items-center gap-1">⚙️ Tactics & Mentality</span>
            {showTactics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showTactics && (
            <div className="space-y-3 mt-2">
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
          )}
        </div>

        <Separator />

        {/* Substitutions */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium flex items-center gap-1">
              🔄 Substitutions
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
            <p className="text-xs text-muted-foreground">No substitutions planned.</p>
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
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => store.removeSubstitution(teamKey, sub.id)}>
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
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.position}) - {p.rating}
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
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.position}) - {p.rating}
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
                <Button size="sm" className="h-7 text-xs flex-1" onClick={handleAddSub}>Add</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowSubDialog(false)}>Cancel</Button>
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
        <h2 className="text-2xl md:text-3xl font-bold">Build Your Starting XI</h2>
        <p className="text-muted-foreground">Drag players between pitch slots and bench, or click + to pick from the bench</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
