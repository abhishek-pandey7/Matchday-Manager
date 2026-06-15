'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useCoachStore, validateLineup, FormationIssue } from '@/store/matchStore';
import { TEAMS } from '@/lib/simulation/data';
import {
  FormationType,
  TacticalSettings,
  Substitution,
  Player,
  Position,
} from '@/lib/simulation/types';
import { FORMATIONS, FormationPosition } from '@/lib/simulation/formations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Play,
  ArrowLeft,
  Plus,
  X,
  Shield,
  Swords,
  Zap,
  Gauge,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  ArrowRightLeft,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────

const FORMATION_LIST: FormationType[] = [
  '4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '5-4-1', '4-1-4-1',
];

const MENTALITIES: {
  value: TacticalSettings['mentality'];
  label: string;
  icon: string;
}[] = [
  { value: 'defensive', label: 'Defensive', icon: '🛡️' },
  { value: 'cautious', label: 'Cautious', icon: '🔶' },
  { value: 'balanced', label: 'Balanced', icon: '⚖️' },
  { value: 'attacking', label: 'Attacking', icon: '⚡' },
  { value: 'very_attacking', label: 'All Out', icon: '🔥' },
];

const POSITION_NAMES: Record<Position, string> = {
  GK: 'Goalkeeper',
  CB: 'Center Back',
  LB: 'Left Back',
  RB: 'Right Back',
  LWB: 'Left Wing Back',
  RWB: 'Right Wing Back',
  CDM: 'Def. Midfielder',
  CM: 'Central Mid.',
  CAM: 'Att. Midfielder',
  LM: 'Left Mid.',
  RM: 'Right Mid.',
  LW: 'Left Wing',
  RW: 'Right Wing',
  CF: 'Center Forward',
  ST: 'Striker',
};

const SLOT_COMPATIBILITY: Record<Position, Position[]> = {
  GK: ['GK'],
  CB: ['CB'],
  LB: ['LB', 'LWB'],
  RB: ['RB', 'RWB'],
  LWB: ['LWB', 'LB'],
  RWB: ['RWB', 'RB'],
  CDM: ['CDM', 'CM', 'CB'],
  CM: ['CM', 'CDM', 'CAM'],
  CAM: ['CAM', 'CM', 'CF'],
  LM: ['LM', 'LW', 'LB'],
  RM: ['RM', 'RW', 'RB'],
  LW: ['LW', 'LM', 'CF', 'ST'],
  RW: ['RW', 'RM', 'CF', 'ST'],
  CF: ['CF', 'ST', 'CAM'],
  ST: ['ST', 'CF', 'LW', 'RW'],
};

// ─── Helpers ────────────────────────────────────────────────────────

type PositionCategory = 'gk' | 'def' | 'mid' | 'fwd';

function getPositionCategory(pos: Position): PositionCategory {
  if (pos === 'GK') return 'gk';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'def';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'mid';
  return 'fwd';
}

function positionColor(pos: Position): string {
  const cat = getPositionCategory(pos);
  switch (cat) {
    case 'gk': return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300';
    case 'def': return 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300';
    case 'mid': return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-300';
    case 'fwd': return 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-300';
  }
}

function positionBgColor(pos: Position): string {
  const cat = getPositionCategory(pos);
  switch (cat) {
    case 'gk': return 'bg-yellow-500';
    case 'def': return 'bg-blue-500';
    case 'mid': return 'bg-green-500';
    case 'fwd': return 'bg-red-500';
  }
}

function positionBorderColor(pos: Position): string {
  const cat = getPositionCategory(pos);
  switch (cat) {
    case 'gk': return 'border-yellow-400';
    case 'def': return 'border-blue-400';
    case 'mid': return 'border-green-400';
    case 'fwd': return 'border-red-400';
  }
}

function positionGradient(pos: Position): string {
  const cat = getPositionCategory(pos);
  switch (cat) {
    case 'gk': return 'linear-gradient(135deg, #eab308, #ca8a04)';
    case 'def': return 'linear-gradient(135deg, #3b82f6, #2563eb)';
    case 'mid': return 'linear-gradient(135deg, #22c55e, #16a34a)';
    case 'fwd': return 'linear-gradient(135deg, #ef4444, #dc2626)';
  }
}

function isCompatible(playerPos: Position, slotPos: Position): boolean {
  return SLOT_COMPATIBILITY[slotPos]?.includes(playerPos) ?? false;
}

function getLastName(name: string): string {
  const parts = name.trim().split(' ');
  return parts[parts.length - 1] || name;
}

// ─── Drag Data Types ────────────────────────────────────────────────

interface PitchDragData {
  type: 'pitch';
  teamKey: 'A' | 'B';
  slotIndex: number;
  playerId: string;
}

interface BenchDragData {
  type: 'bench';
  teamKey: 'A' | 'B';
  playerId: string;
}

type DragData = PitchDragData | BenchDragData;

interface SlotDropData {
  type: 'pitch-slot';
  teamKey: 'A' | 'B';
  slotIndex: number;
}

interface BenchDropData {
  type: 'bench-area';
  teamKey: 'A' | 'B';
}

// ─── PitchSlot Component ────────────────────────────────────────────

function PitchSlot({
  slotIndex,
  teamKey,
  player,
  slot,
  isPickerOpen,
  onPickerToggle,
}: {
  slotIndex: number;
  teamKey: 'A' | 'B';
  player: Player | null | undefined;
  slot: FormationPosition;
  isPickerOpen: boolean;
  onPickerToggle: (index: number | null) => void;
}) {
  const store = useCoachStore();
  const teamId = teamKey === 'A' ? store.teamAId : store.teamBId;
  const lineup = teamKey === 'A' ? store.lineupA : store.lineupB;
  const team = TEAMS.find(t => t.id === teamId);

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `pitch-${teamKey}-${slotIndex}`,
    data: {
      type: 'pitch',
      teamKey,
      slotIndex,
      playerId: player?.id || '',
    } as PitchDragData,
    disabled: !player,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `slot-${teamKey}-${slotIndex}`,
    data: {
      type: 'pitch-slot',
      teamKey,
      slotIndex,
    } as SlotDropData,
  });

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef]
  );

  const benchPlayers = useMemo(() => {
    if (!team) return [];
    return lineup.subs
      .map(id => team.players.find(p => p.id === id))
      .filter((p): p is Player => !!p);
  }, [team, lineup.subs]);

  const compatibleBench = useMemo(() => {
    const slotPos = slot.position;
    const compatible = benchPlayers.filter(p => isCompatible(p.position, slotPos));
    return compatible.length > 0 ? compatible : benchPlayers;
  }, [benchPlayers, slot.position]);

  const isOutOfPosition = player && !isCompatible(player.position, slot.position);
  const isSeverelyOutOfPosition =
    player &&
    ((player.position === 'GK' && slot.position !== 'GK') ||
      (['CB', 'LB', 'RB'].includes(player.position) &&
        ['ST', 'LW', 'RW', 'CF'].includes(slot.position)) ||
      (['ST', 'LW', 'RW', 'CF'].includes(player.position) &&
        ['CB', 'LB', 'RB'].includes(slot.position)));

  return (
    <div
      className="absolute"
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isPickerOpen ? 25 : isOver ? 30 : 10,
      }}
    >
      {/* Draggable + Droppable node */}
      <div
        ref={setRefs}
        {...(player ? { ...attributes, ...listeners } : {})}
        onClick={() => onPickerToggle(isPickerOpen ? null : slotIndex)}
        className={`
          relative cursor-pointer select-none transition-all duration-200
          ${isDragging ? 'opacity-30 scale-90' : ''}
          ${isOver ? 'scale-110' : ''}
          ${!player ? 'opacity-70 hover:opacity-100' : 'hover:scale-105'}
        `}
      >
        {/* Player circle */}
        <div
          className={`
            w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full
            flex flex-col items-center justify-center
            border-2 shadow-lg
            ${player
              ? isSeverelyOutOfPosition
                ? 'border-red-400 ring-2 ring-red-400/50'
                : isOutOfPosition
                ? 'border-orange-400'
                : positionBorderColor(player.position)
              : 'border-white/40 border-dashed'
            }
            ${isOver ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-transparent' : ''}
            ${isPickerOpen ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent' : ''}
          `}
          style={{
            background: player ? positionGradient(player.position) : 'rgba(0,0,0,0.35)',
          }}
        >
          {player ? (
            <>
              <span className="text-[7px] sm:text-[8px] md:text-[9px] font-bold leading-none text-white truncate max-w-[30px] sm:max-w-[36px] md:max-w-[46px]">
                {getLastName(player.name)}
              </span>
              <span className="text-[7px] sm:text-[8px] md:text-[9px] leading-none text-white/80 font-semibold">
                {player.rating}
              </span>
            </>
          ) : (
            <Plus className="w-4 h-4 text-white/60" />
          )}
        </div>

        {/* Position label */}
        <div className="mt-0.5 text-center">
          <span
            className={`text-[7px] sm:text-[8px] md:text-[9px] font-bold px-1 rounded ${positionColor(slot.position)}`}
          >
            {slot.position}
          </span>
          {player && player.position !== slot.position && (
            <div className="text-[6px] sm:text-[7px] text-orange-400 mt-0.5 truncate max-w-[48px] mx-auto">
              {player.position}
            </div>
          )}
        </div>

        {/* Warning badges */}
        {player && isSeverelyOutOfPosition && (
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-2 h-2 text-white" />
          </div>
        )}
        {player && isOutOfPosition && !isSeverelyOutOfPosition && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full flex items-center justify-center">
            <span className="text-[6px] text-white font-bold">!</span>
          </div>
        )}
      </div>

      {/* Bench player picker popover */}
      {isPickerOpen && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 max-h-52 overflow-y-auto bg-popover border rounded-lg shadow-xl z-50"
          onClick={e => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-popover p-2 border-b">
            <div className="text-xs font-medium">Add to {slot.position}</div>
            <div className="text-[10px] text-muted-foreground">
              {compatibleBench.length} available
            </div>
          </div>
          <div className="p-1">
            {compatibleBench.length === 0 ? (
              <div className="text-xs text-muted-foreground p-2 text-center">
                No players available
              </div>
            ) : (
              compatibleBench.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    if (!lineup.starting11[slotIndex]) {
                      store.addPlayerToStarting(teamKey, p.id, slotIndex);
                    } else {
                      store.swapPlayerIn(teamKey, slotIndex, p.id);
                    }
                    onPickerToggle(null);
                  }}
                  className={`w-full flex items-center gap-2 p-1.5 rounded text-left hover:bg-muted/50 transition-colors ${
                    !isCompatible(p.position, slot.position) ? 'opacity-60' : ''
                  }`}
                >
                  <Badge
                    variant="outline"
                    className={`text-[8px] px-1 py-0 ${positionColor(p.position)}`}
                  >
                    {p.position}
                  </Badge>
                  <span className="text-xs font-medium flex-1 truncate">
                    {p.name}
                  </span>
                  <Badge variant="secondary" className="text-[8px] px-1 py-0">
                    {p.rating}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Squad Player Card Component ────────────────────────────────────

function SquadPlayerCard({
  player,
  teamKey,
  isStarting,
  slotPosition,
}: {
  player: Player;
  teamKey: 'A' | 'B';
  isStarting: boolean;
  slotPosition: Position | null;
}) {
  const store = useCoachStore();
  const lineup = teamKey === 'A' ? store.lineupA : store.lineupB;
  const formationSlots = FORMATIONS[lineup.formation];

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bench-${teamKey}-${player.id}`,
    data: {
      type: 'bench',
      teamKey,
      playerId: player.id,
    } as BenchDragData,
    disabled: isStarting,
  });

  const emptySlots = useMemo(() => {
    return formationSlots
      .map((s, i) => ({ ...s, index: i }))
      .filter(s => !lineup.starting11[s.index]);
  }, [formationSlots, lineup.starting11]);

  const handleRemoveFromStarting = useCallback(() => {
    const slotIdx = lineup.starting11.indexOf(player.id);
    if (slotIdx >= 0) {
      store.swapPlayerOut(teamKey, slotIdx);
    }
  }, [lineup.starting11, store, teamKey, player.id]);

  return (
    <div
      ref={isStarting ? undefined : setNodeRef}
      {...(isStarting ? {} : { ...attributes, ...listeners })}
      className={`
        flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all text-xs
        ${isStarting
          ? 'bg-primary/5 border-primary/20 shadow-sm'
          : isDragging
          ? 'opacity-40 bg-card border-border'
          : 'bg-card border-border hover:shadow-md cursor-grab active:cursor-grabbing'
        }
      `}
    >
      {/* Position badge */}
      <Badge
        variant="outline"
        className={`text-[8px] px-1.5 py-0 shrink-0 ${positionColor(player.position)}`}
      >
        {player.position}
      </Badge>

      {/* Name */}
      <span className="font-medium flex-1 truncate">{player.name}</span>

      {/* Rating */}
      <Badge variant="secondary" className="text-[8px] px-1.5 py-0 shrink-0">
        {player.rating}
      </Badge>

      {/* Slot position badge if starting */}
      {isStarting && slotPosition && (
        <Badge className="text-[7px] px-1 py-0 shrink-0 bg-primary/10 text-primary border border-primary/20">
          {slotPosition}
        </Badge>
      )}

      {/* Action button */}
      {isStarting ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 shrink-0 hover:bg-red-500/10"
          onClick={handleRemoveFromStarting}
          title="Remove from starting XI"
        >
          <X className="w-3 h-3 text-red-500" />
        </Button>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 shrink-0 hover:bg-green-500/10"
              title="Add to starting XI"
            >
              <Plus className="w-3 h-3 text-green-600" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-1" align="end" side="left">
            <div className="p-1.5 border-b mb-1">
              <div className="text-xs font-medium">
                Assign {getLastName(player.name)} to:
              </div>
            </div>
            {emptySlots.length === 0 ? (
              <div className="text-xs text-muted-foreground p-2 text-center">
                No empty slots — remove a player first
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto">
                {emptySlots.map(s => (
                  <button
                    key={s.index}
                    onClick={() => {
                      store.addPlayerToStarting(teamKey, player.id, s.index);
                    }}
                    className={`w-full flex items-center gap-2 p-1.5 rounded text-left hover:bg-muted/50 transition-colors ${
                      !isCompatible(player.position, s.position) ? 'opacity-60' : ''
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0 ${positionBgColor(s.position)}`}
                    >
                      {s.position}
                    </div>
                    <span className="text-xs">{POSITION_NAMES[s.position]}</span>
                    {!isCompatible(player.position, s.position) && (
                      <span className="text-[9px] text-orange-500 ml-auto">⚠</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ─── Bench Drop Zone Component ──────────────────────────────────────

function BenchDropZone({
  teamKey,
  children,
  className,
}: {
  teamKey: 'A' | 'B';
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `bench-area-${teamKey}`,
    data: {
      type: 'bench-area',
      teamKey,
    } as BenchDropData,
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all rounded-lg ${
        isOver ? 'ring-2 ring-yellow-400 bg-yellow-400/5' : ''
      } ${className || ''}`}
    >
      {children}
    </div>
  );
}

// ─── Football Pitch SVG Markings ────────────────────────────────────

function PitchMarkings() {
  const lineColor = 'rgba(255,255,255,0.35)';
  const lineW = 2;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1050 680"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
    >
      {/* Outer boundary */}
      <rect x="0" y="0" width="1050" height="680" stroke={lineColor} strokeWidth={lineW} />

      {/* Halfway line */}
      <line x1="525" y1="0" x2="525" y2="680" stroke={lineColor} strokeWidth={lineW} />

      {/* Center circle */}
      <circle cx="525" cy="340" r="91.5" stroke={lineColor} strokeWidth={lineW} />
      <circle cx="525" cy="340" r="4" fill={lineColor} />

      {/* Left penalty area */}
      <rect x="0" y="138.4" width="165" height="403.2" stroke={lineColor} strokeWidth={lineW} />

      {/* Left goal area */}
      <rect x="0" y="248.4" width="55" height="183.2" stroke={lineColor} strokeWidth={lineW} />

      {/* Left penalty spot */}
      <circle cx="110" cy="340" r="4" fill={lineColor} />

      {/* Left penalty arc */}
      <path
        d="M 165 266.88 A 91.5 91.5 0 0 1 165 413.12"
        stroke={lineColor}
        strokeWidth={lineW}
      />

      {/* Left goal */}
      <rect
        x="-22"
        y="303.4"
        width="22"
        height="73.2"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth={2.5}
        fill="rgba(255,255,255,0.05)"
        rx="2"
      />

      {/* Right penalty area */}
      <rect x="885" y="138.4" width="165" height="403.2" stroke={lineColor} strokeWidth={lineW} />

      {/* Right goal area */}
      <rect x="995" y="248.4" width="55" height="183.2" stroke={lineColor} strokeWidth={lineW} />

      {/* Right penalty spot */}
      <circle cx="940" cy="340" r="4" fill={lineColor} />

      {/* Right penalty arc */}
      <path
        d="M 885 266.88 A 91.5 91.5 0 0 0 885 413.12"
        stroke={lineColor}
        strokeWidth={lineW}
      />

      {/* Right goal */}
      <rect
        x="1050"
        y="303.4"
        width="22"
        height="73.2"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth={2.5}
        fill="rgba(255,255,255,0.05)"
        rx="2"
      />

      {/* Corner arcs */}
      <path d="M 10 0 A 10 10 0 0 0 0 10" stroke={lineColor} strokeWidth={lineW} />
      <path d="M 1040 0 A 10 10 0 0 1 1050 10" stroke={lineColor} strokeWidth={lineW} />
      <path d="M 0 670 A 10 10 0 0 0 10 680" stroke={lineColor} strokeWidth={lineW} />
      <path d="M 1050 670 A 10 10 0 0 1 1040 680" stroke={lineColor} strokeWidth={lineW} />
    </svg>
  );
}

// ─── Validation Banner ──────────────────────────────────────────────

function ValidationBanner({ issues }: { issues: FormationIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium text-green-700 dark:text-green-400">
          Valid lineup
        </span>
      </div>
    );
  }

  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');

  return (
    <div className="space-y-1.5">
      {errors.map((issue, i) => (
        <div
          key={`err-${i}`}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-400">{issue.message}</span>
        </div>
      ))}
      {warnings.map((issue, i) => (
        <div
          key={`warn-${i}`}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-400">{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main TacticsPage ───────────────────────────────────────────────

export default function TacticsPage() {
  const store = useCoachStore();
  const [activeTeam, setActiveTeam] = useState<'A' | 'B'>('A');
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);
  const [showTactics, setShowTactics] = useState(false);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [subOut, setSubOut] = useState('');
  const [subIn, setSubIn] = useState('');
  const [subMinute, setSubMinute] = useState(60);

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Current team data
  const teamKey = activeTeam;
  const teamId = teamKey === 'A' ? store.teamAId : store.teamBId;
  const lineup = teamKey === 'A' ? store.lineupA : store.lineupB;
  const team = TEAMS.find(t => t.id === teamId);

  // Both teams for toggle
  const teamA = TEAMS.find(t => t.id === store.teamAId);
  const teamB = TEAMS.find(t => t.id === store.teamBId);

  // Derived data
  const formationSlots = team ? FORMATIONS[lineup.formation] : [];
  const startingPlayers = useMemo(() => {
    if (!team) return [];
    return lineup.starting11.map(id =>
      id ? team.players.find(p => p.id === id) : null
    );
  }, [team, lineup.starting11]);

  const filledPlayers = useMemo(
    () => startingPlayers.filter((p): p is Player => !!p),
    [startingPlayers]
  );

  const avgRating =
    filledPlayers.length > 0
      ? Math.round(filledPlayers.reduce((sum, p) => sum + p.rating, 0) / filledPlayers.length)
      : 0;

  const issues = team ? validateLineup(lineup, team) : [];
  const hasErrors = issues.some(i => i.type === 'error');

  // Position counts — based on FORMATION SLOTS (not player natural position)
  // This matches how the validation counts positions
  const defCount = formationSlots.filter((slot, i) =>
    lineup.starting11[i] && lineup.starting11[i] !== '' &&
    ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(slot.position)
  ).length;
  const midCount = formationSlots.filter((slot, i) =>
    lineup.starting11[i] && lineup.starting11[i] !== '' &&
    ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(slot.position)
  ).length;
  const fwdCount = formationSlots.filter((slot, i) =>
    lineup.starting11[i] && lineup.starting11[i] !== '' &&
    ['ST', 'CF', 'LW', 'RW'].includes(slot.position)
  ).length;

  // All players grouped by position category
  const groupedPlayers = useMemo(() => {
    if (!team) return { gk: [], def: [], mid: [], fwd: [] };
    const sorted = [...team.players].sort((a, b) => b.rating - a.rating);
    const gk = sorted.filter(p => getPositionCategory(p.position) === 'gk');
    const def = sorted.filter(p => getPositionCategory(p.position) === 'def');
    const mid = sorted.filter(p => getPositionCategory(p.position) === 'mid');
    const fwd = sorted.filter(p => getPositionCategory(p.position) === 'fwd');
    return { gk, def, mid, fwd };
  }, [team]);

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveDragId(active.id as string);
    setActiveDragData((active.data.current as DragData) ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      setActiveDragData(null);

      const { active, over } = event;
      if (!over) return;

      const dragData = active.data.current as DragData | undefined;
      const dropData = over.data.current as SlotDropData | BenchDropData | undefined;

      if (!dragData || !dropData) return;
      if (dragData.teamKey !== teamKey) return;

      if (dragData.type === 'bench' && dropData.type === 'pitch-slot') {
        // Bench → pitch slot
        const currentLineup =
          dragData.teamKey === 'A' ? useCoachStore.getState().lineupA : useCoachStore.getState().lineupB;
        const slotPlayerId = currentLineup.starting11[dropData.slotIndex];
        if (slotPlayerId) {
          store.swapPlayerIn(dragData.teamKey, dropData.slotIndex, dragData.playerId);
        } else {
          store.addPlayerToStarting(dragData.teamKey, dragData.playerId, dropData.slotIndex);
        }
      } else if (dragData.type === 'pitch' && dropData.type === 'pitch-slot') {
        // Pitch → pitch slot (swap players)
        if (dragData.slotIndex !== dropData.slotIndex) {
          store.movePlayerToSlot(dragData.teamKey, dragData.slotIndex, dropData.slotIndex);
        }
      } else if (dragData.type === 'pitch' && dropData.type === 'bench-area') {
        // Pitch → bench area (remove from starting)
        store.swapPlayerOut(dragData.teamKey, dragData.slotIndex);
      }
    },
    [store, teamKey]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setActiveDragData(null);
  }, []);

  // Drag overlay player data
  const overlayPlayer = useMemo(() => {
    if (!activeDragData || !team) return null;
    const playerId =
      activeDragData.type === 'pitch' ? activeDragData.playerId : activeDragData.playerId;
    return team.players.find(p => p.id === playerId) ?? null;
  }, [activeDragData, team]);

  // Substitution handler
  const handleAddSub = useCallback(() => {
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
  }, [subOut, subIn, subMinute, store, teamKey]);

  // Validation for start button
  const validA = store.isLineupValid('A');
  const validB = store.isLineupValid('B');
  const canSimulate = validA && validB;

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-muted-foreground">Select teams on the Setup page first.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-4">
        {/* Header — kinetic typography */}
        <div className="space-y-1">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            Step 02 — Lineup &amp; Tactics
          </div>
          <h2 className="text-5xl md:text-6xl font-black leading-none tracking-tighter uppercase">
            BUILD<br />
            <span style={{ color: 'var(--primary)' }}>YOUR XI</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Drag players between positions, or click <span className="font-mono text-foreground">+</span> to pick from the squad.
          </p>
        </div>

        {/* Scrolling marquee ticker */}
        <div className="overflow-hidden border-y border-border py-2" aria-hidden="true">
          <div className="animate-marquee">
            {[
              '4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '5-4-1', '4-1-4-1',
              'FORMATION', 'TACTICS', 'SUBSTITUTE', 'XI', 'MENTALITY', 'PRESS', 'TEMPO', 'WIDTH',
              '4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '5-4-1', '4-1-4-1',
              'FORMATION', 'TACTICS', 'SUBSTITUTE', 'XI', 'MENTALITY', 'PRESS', 'TEMPO', 'WIDTH',
            ].map((t, i) => (
              <span
                key={i}
                className="mx-4 text-[11px] font-bold tracking-widest uppercase text-muted-foreground/60"
              >
                {t} <span style={{ color: 'var(--primary)' }}>·</span>
              </span>
            ))}
          </div>
        </div>

        {/* Team Toggle — brutalist tab style */}
        <div className="flex border border-border overflow-hidden">
          {teamA && (
            <button
              onClick={() => {
                setActiveTeam('A');
                setPickerSlot(null);
              }}
              className={`flex-1 flex items-center gap-2.5 px-4 py-3 transition-all text-sm font-bold ${
                activeTeam === 'A'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span className="text-xl">{teamA.flag}</span>
              <span>{teamA.name}</span>
              <span className="font-mono text-[10px] opacity-70">OVR {teamA.overallRating}</span>
              {!store.isLineupValid('A') && (
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 ml-auto" />
              )}
            </button>
          )}
          <div className="w-px bg-border" />
          {teamB && (
            <button
              onClick={() => {
                setActiveTeam('B');
                setPickerSlot(null);
              }}
              className={`flex-1 flex items-center gap-2.5 px-4 py-3 transition-all text-sm font-bold ${
                activeTeam === 'B'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span className="text-xl">{teamB.flag}</span>
              <span>{teamB.name}</span>
              <span className="font-mono text-[10px] opacity-70">OVR {teamB.overallRating}</span>
              {!store.isLineupValid('B') && (
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 ml-auto" />
              )}
            </button>
          )}
        </div>

        {/* Formation Selector + Position Counts */}
        <Card className="rounded-none">
          <CardContent className="pt-4 pb-3 space-y-2">
            <div className="flex flex-wrap items-center gap-1">
              {FORMATION_LIST.map(f => (
                <button
                  key={f}
                  onClick={() => store.setFormation(teamKey, f)}
                  className={`py-1 px-2.5 text-xs font-mono font-bold border transition-all ${
                    lineup.formation === f
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
              <button
                onClick={() => store.autoFillLineup(teamKey)}
                className="py-1 px-2.5 text-xs border border-dashed border-muted-foreground/50 hover:bg-muted/50 transition-all flex items-center gap-1 text-muted-foreground hover:text-foreground"
                title="Auto-fill best XI"
              >
                <RotateCcw className="w-3 h-3" /> Auto
              </button>
            </div>

            {/* Position counts */}
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${positionBgColor('CB')}`} />
                Def: {defCount}{' '}
                {defCount < 3 && <span className="text-red-500 font-bold">(min 3)</span>}
              </span>
              <span className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${positionBgColor('CM')}`} />
                Mid: {midCount}
                {midCount < 2 && <span className="text-amber-500">(min 2)</span>}
              </span>
              <span className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${positionBgColor('ST')}`} />
                Fwd: {fwdCount}
                {fwdCount === 0 && <span className="text-amber-500">(min 1)</span>}
              </span>
              <span className="text-muted-foreground ml-auto font-medium">
                {filledPlayers.length}/11
              </span>
              <Badge variant="secondary" className="text-[9px]">
                Avg: {avgRating}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Main Content: Pitch + Squad Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Left Column: Pitch + Validation + Tactics */}
          <div className="lg:col-span-2 space-y-4">
            {/* Click-away overlay for picker */}
            {pickerSlot !== null && (
              <div className="fixed inset-0 z-20" onClick={() => setPickerSlot(null)} />
            )}
            <div
              className="relative w-full rounded-xl overflow-hidden border-2 border-green-800/50 shadow-xl"
              style={{
                aspectRatio: '1.54 / 1',
                background: `repeating-linear-gradient(
                  90deg,
                  #2d8a4e 0%,
                  #2d8a4e 8.33%,
                  #329952 8.33%,
                  #329952 16.67%
                )`,
              }}
            >
              {/* Pitch markings SVG */}
              <PitchMarkings />

              {/* Player slots */}
              {formationSlots.map((slot, index) => (
                <PitchSlot
                  key={`${teamKey}-${lineup.formation}-${index}`}
                  slotIndex={index}
                  teamKey={teamKey}
                  player={startingPlayers[index]}
                  slot={slot}
                  isPickerOpen={pickerSlot === index}
                  onPickerToggle={setPickerSlot}
                />
              ))}
            </div>

            {/* Validation Banner below pitch */}
            <ValidationBanner issues={issues} />

            {/* Tactics Panel (Collapsible) - Moved inside the left column */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <button
                  className="w-full flex items-center justify-between text-sm font-medium py-1"
                  onClick={() => setShowTactics(!showTactics)}
                >
                  <span className="flex items-center gap-1.5">
                    ⚙️ Tactics &amp; Mentality
                  </span>
                  {showTactics ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {showTactics && (
                  <div className="space-y-4 mt-3">
                    {/* Mentality */}
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium">Mentality</span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {MENTALITIES.map(m => (
                          <button
                            key={m.value}
                            onClick={() => store.setTactics(teamKey, { mentality: m.value })}
                            className={`py-1.5 px-1 rounded-md text-[11px] border transition-all ${
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

                    {/* Sliders */}
                    {[
                      {
                        key: 'pressingIntensity' as const,
                        label: 'Pressing',
                        low: 'Low',
                        high: 'High',
                        icon: <Zap className="w-3 h-3" />,
                      },
                      {
                        key: 'tempo' as const,
                        label: 'Tempo',
                        low: 'Slow',
                        high: 'Fast',
                        icon: <Gauge className="w-3 h-3" />,
                      },
                      {
                        key: 'width' as const,
                        label: 'Width',
                        low: 'Narrow',
                        high: 'Wide',
                        icon: <Swords className="w-3 h-3" />,
                      },
                      {
                        key: 'defensiveLine' as const,
                        label: 'Def. Line',
                        low: 'Deep',
                        high: 'High',
                        icon: <Shield className="w-3 h-3" />,
                      },
                    ].map(({ key, label, low, high, icon }) => (
                      <div key={key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="flex items-center gap-1 font-medium">
                            {icon} {label}
                          </span>
                          <span className="text-muted-foreground">
                            {low} → {high}
                          </span>
                        </div>
                        <Slider
                          value={[lineup.tactics[key] as number]}
                          onValueChange={([v]) => store.setTactics(teamKey, { [key]: v })}
                          min={0}
                          max={100}
                          step={5}
                          className="py-1"
                        />
                      </div>
                    ))}

                    <Separator />

                    {/* Substitutions */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium flex items-center gap-1.5">
                          <ArrowRightLeft className="w-3.5 h-3.5" /> Substitutions
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

                      <div className="space-y-1.5">
                        {lineup.substitutions.map(sub => {
                          const outPlayer = team.players.find(p => p.id === sub.playerOutId);
                          const inPlayer = team.players.find(p => p.id === sub.playerInId);
                          return (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs hover:bg-muted/50 transition-colors"
                            >
                              <span className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="text-[9px] font-mono px-1.5 py-0 w-8 justify-center"
                                >
                                  {sub.minute}&apos;
                                </Badge>
                                <span className="text-red-600 dark:text-red-400 font-medium">
                                  {outPlayer?.name}
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  {inPlayer?.name}
                                </span>
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

                      {/* Add Sub Dialog */}
                      {showSubDialog && (
                        <div className="mt-3 p-3 rounded-lg border bg-card space-y-2.5">
                          <Select value={subOut} onValueChange={setSubOut}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Player OFF" />
                            </SelectTrigger>
                            <SelectContent>
                              {filledPlayers.map(p => (
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
                              {lineup.subs
                                .map(id => team.players.find(p => p.id === id))
                                .filter((p): p is Player => !!p)
                                .map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} ({p.position}) - {p.rating}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>

                          <div>
                            <label className="text-xs text-muted-foreground">
                              Minute: {subMinute}&apos;
                            </label>
                            <Slider
                              value={[subMinute]}
                              onValueChange={([v]) => setSubMinute(v)}
                              min={46}
                              max={85}
                              step={1}
                              className="py-1"
                            />
                          </div>

                          {subOut &&
                            subIn &&
                            (() => {
                              const outP = team.players.find(p => p.id === subOut);
                              const inP = team.players.find(p => p.id === subIn);
                              if (!outP || !inP) return null;
                              const diff = inP.rating - outP.rating;
                              return (
                                <div className="text-center text-xs">
                                  <span className="text-muted-foreground">Rating change: </span>
                                  <span
                                    className={
                                      diff > 0
                                        ? 'text-green-600 font-bold'
                                        : diff < 0
                                        ? 'text-red-600 font-bold'
                                        : 'font-bold'
                                    }
                                  >
                                    {diff > 0 ? '+' : ''}
                                    {diff}
                                  </span>
                                </div>
                              );
                            })()}

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs flex-1"
                              onClick={handleAddSub}
                            >
                              Add
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => setShowSubDialog(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Squad Panel */}
          <div className="lg:col-span-1 lg:h-full lg:sticky lg:top-20">
            <Card className="w-full flex flex-col shadow-xl">
              <CardContent className="pt-4 pb-3 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-1.5">
                    <Users className="w-4 h-4" /> Squad
                  </h3>
                  <span className="text-[10px] text-muted-foreground">
                    Drag bench players to pitch
                  </span>
                </div>

                <BenchDropZone teamKey={teamKey} className="flex-1 flex flex-col min-h-0">
                  <ScrollArea className="h-[480px] lg:h-[calc(100vh-280px)] pr-2">
                    <div className="space-y-3">
                      {/* Goalkeepers */}
                      {groupedPlayers.gk.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className={`w-2 h-2 rounded-full ${positionBgColor('GK')}`} />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Goalkeepers
                            </span>
                          </div>
                          <div className="space-y-1">
                            {groupedPlayers.gk.map(p => (
                              <SquadPlayerCard
                                key={p.id}
                                player={p}
                                teamKey={teamKey}
                                isStarting={lineup.starting11.includes(p.id)}
                                slotPosition={
                                  lineup.starting11.includes(p.id)
                                    ? FORMATIONS[lineup.formation][
                                        lineup.starting11.indexOf(p.id)
                                      ]?.position ?? null
                                    : null
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Defenders */}
                      {groupedPlayers.def.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className={`w-2 h-2 rounded-full ${positionBgColor('CB')}`} />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Defenders
                            </span>
                          </div>
                          <div className="space-y-1">
                            {groupedPlayers.def.map(p => (
                              <SquadPlayerCard
                                key={p.id}
                                player={p}
                                teamKey={teamKey}
                                isStarting={lineup.starting11.includes(p.id)}
                                slotPosition={
                                  lineup.starting11.includes(p.id)
                                    ? FORMATIONS[lineup.formation][
                                        lineup.starting11.indexOf(p.id)
                                      ]?.position ?? null
                                    : null
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Midfielders */}
                      {groupedPlayers.mid.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className={`w-2 h-2 rounded-full ${positionBgColor('CM')}`} />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Midfielders
                            </span>
                          </div>
                          <div className="space-y-1">
                            {groupedPlayers.mid.map(p => (
                              <SquadPlayerCard
                                key={p.id}
                                player={p}
                                teamKey={teamKey}
                                isStarting={lineup.starting11.includes(p.id)}
                                slotPosition={
                                  lineup.starting11.includes(p.id)
                                    ? FORMATIONS[lineup.formation][
                                        lineup.starting11.indexOf(p.id)
                                      ]?.position ?? null
                                    : null
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Forwards */}
                      {groupedPlayers.fwd.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className={`w-2 h-2 rounded-full ${positionBgColor('ST')}`} />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Forwards
                            </span>
                          </div>
                          <div className="space-y-1">
                            {groupedPlayers.fwd.map(p => (
                              <SquadPlayerCard
                                key={p.id}
                                player={p}
                                teamKey={teamKey}
                                isStarting={lineup.starting11.includes(p.id)}
                                slotPosition={
                                  lineup.starting11.includes(p.id)
                                    ? FORMATIONS[lineup.formation][
                                        lineup.starting11.indexOf(p.id)
                                      ]?.position ?? null
                                    : null
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </BenchDropZone>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Navigation — sticky on mobile */}
        <div className="sticky bottom-0 z-30 bg-background/95 backdrop-blur-sm border-t py-3 px-4 -mx-4 sm:mx-0 sm:border-0 sm:py-2 sm:static sm:bg-transparent sm:backdrop-blur-none">
          {!canSimulate && (
            <div className="text-xs text-red-500 mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {!validA && !validB
                ? 'Both teams need valid lineups'
                : !validA
                ? `${teamA?.name || 'Team A'} lineup incomplete — need 11 players with min 3 DEF & 1 GK`
                : `${teamB?.name || 'Team B'} lineup incomplete — need 11 players with min 3 DEF & 1 GK`}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
              {canSimulate ? 'Lineups ready — kick off!' : 'Complete both lineups to continue'}
            </span>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => store.setStep('setup')}
                className="rounded-none font-bold tracking-wider uppercase text-sm h-11"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                size="lg"
                onClick={() => store.startSimulation()}
                className="rounded-none font-bold tracking-wider uppercase text-sm px-8 h-11 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30"
                disabled={!canSimulate}
              >
                <Play className="w-4 h-4 mr-2" /> Simulate Match
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDragId && overlayPlayer ? (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-card border-2 shadow-2xl rotate-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 border-2 border-white/30"
              style={{ background: positionGradient(overlayPlayer.position) }}
            >
              {overlayPlayer.position}
            </div>
            <div>
              <div className="text-sm font-bold leading-tight">
                {getLastName(overlayPlayer.name)}
              </div>
              <div className="text-[11px] text-muted-foreground font-medium">
                {overlayPlayer.rating} OVR
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
