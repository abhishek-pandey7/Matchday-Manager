'use client';

import { useState, useMemo, useCallback } from 'react';
import { useCoachStore } from '@/store/matchStore';
import { Team } from '@/lib/simulation/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ChevronDown, ChevronUp, X, Users } from 'lucide-react';

const CONTINENTS = [
  { id: 'all', label: 'ALL' },
  { id: 'UEFA', label: 'EUR' },
  { id: 'CONMEBOL', label: 'SAM' },
  { id: 'CONCACAF', label: 'NAM' },
  { id: 'AFC', label: 'ASI' },
  { id: 'CAF', label: 'AFR' },
  { id: 'OFC', label: 'OCE' },
];

function StatBar({ value, max = 99 }: { value: number; max?: number }) {
  return (
    <div className="relative h-0.5 bg-border w-full overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 transition-all duration-500"
        style={{ width: `${(value / max) * 100}%`, background: 'var(--primary)' }}
      />
    </div>
  );
}

function SquadPreview({ team }: { team: Team }) {
  const [expanded, setExpanded] = useState(false);

  const groups = [
    { label: 'GK', players: team.players.filter(p => p.position === 'GK') },
    { label: 'DEF', players: team.players.filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position)) },
    { label: 'MID', players: team.players.filter(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.position)) },
    { label: 'FWD', players: team.players.filter(p => ['ST', 'CF', 'LW', 'RW'].includes(p.position)) },
  ];

  return (
    <div className="mt-3 border-t border-border/50 pt-2">
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="w-full flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors tracking-widest uppercase py-1"
      >
        <Users className="w-3 h-3" />
        {expanded ? 'Hide' : 'Show'} Squad ({team.players.length})
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {groups.map(group => (
            <div key={group.label}>
              <div className="text-[9px] font-bold tracking-widest text-muted-foreground mb-1 uppercase">
                {group.label}
              </div>
              <div className="space-y-px">
                {group.players.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-0.5">
                    <span className="text-[11px]">{p.name}</span>
                    <span className="font-mono text-[11px] font-bold" style={{ color: 'var(--primary)' }}>
                      {p.rating}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamSelector({
  label,
  side,
  teamId,
  setTeam,
  teams,
  disabledTeamId,
}: {
  label: string;
  side: 'home' | 'away';
  teamId: string;
  setTeam: (id: string) => void;
  teams: Team[];
  disabledTeamId: string;
}) {
  const [continent, setContinent] = useState('all');
  const [search, setSearch] = useState('');

  const filteredTeams = useMemo(() => {
    return teams.filter(t => {
      if (continent !== 'all' && t.continent !== continent) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [teams, continent, search]);

  const selectedTeam = teamId ? teams.find(t => t.id === teamId) : null;

  const handleSelectTeam = useCallback(
    (id: string) => {
      if (id === disabledTeamId) return;
      setTeam(id);
    },
    [setTeam, disabledTeamId]
  );

  const accentBorder = side === 'home' ? 'border-primary' : 'border-destructive';
  const accentText = side === 'home' ? 'text-primary' : 'text-destructive';

  return (
    <div className="border border-border bg-card flex flex-col">
      {/* Panel label */}
      <div
        className="px-4 py-2.5 border-b border-border flex items-center justify-between"
        style={side === 'home' ? { background: 'var(--primary)', color: 'var(--primary-foreground)' } : {}}
      >
        <span className="text-[11px] font-bold tracking-widest uppercase">
          {side === 'home' ? '01 /' : '02 /'} {label}
        </span>
        {selectedTeam && (
          <button
            onClick={() => setTeam('')}
            className="opacity-60 hover:opacity-100 transition-opacity"
            title="Deselect"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Selected team display */}
      {selectedTeam ? (
        <div className={`border-b ${accentBorder} border-l-4 px-4 py-4`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl leading-none">{selectedTeam.flag}</span>
              <div>
                <div className="font-bold text-lg leading-tight">{selectedTeam.name}</div>
                <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-0.5">
                  {selectedTeam.continent}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-3xl font-black font-mono ${accentText}`}>
                {selectedTeam.overallRating}
              </div>
              <div className="text-[9px] text-muted-foreground tracking-widest uppercase">OVR</div>
            </div>
          </div>

          {/* Rating bars */}
          <div className="mt-4 grid grid-cols-3 gap-4 text-[10px]">
            {[
              { label: 'ATK', val: selectedTeam.attackRating },
              { label: 'MID', val: selectedTeam.midfieldRating },
              { label: 'DEF', val: selectedTeam.defenseRating },
            ].map(({ label: l, val }) => (
              <div key={l}>
                <div className="flex justify-between mb-1 tracking-widest uppercase text-muted-foreground">
                  <span>{l}</span>
                  <span className="font-mono font-bold text-foreground">{val}</span>
                </div>
                <StatBar value={val} />
              </div>
            ))}
          </div>

          <SquadPreview team={selectedTeam} />
        </div>
      ) : (
        <div className="px-4 py-6 text-center border-b border-dashed border-border/50">
          <div className="text-xs text-muted-foreground tracking-widest uppercase">
            Select a team below
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs border-border focus:border-primary rounded-none"
          />
        </div>
      </div>

      {/* Continent filter */}
      <div className="px-3 pb-2 flex flex-wrap gap-1">
        {CONTINENTS.map(c => (
          <button
            key={c.id}
            onClick={() => setContinent(c.id)}
            className={`px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase transition-all border ${
              continent === c.id
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Count */}
      <div className="px-3 pb-1.5 text-[9px] text-muted-foreground tracking-widest uppercase">
        {filteredTeams.length} team{filteredTeams.length !== 1 ? 's' : ''}
      </div>

      {/* Team list */}
      <div className="overflow-y-auto max-h-[280px] divide-y divide-border/40">
        {filteredTeams.map(team => {
          const isSelected = teamId === team.id;
          const isDisabled = team.id === disabledTeamId;

          return (
            <button
              key={team.id}
              onClick={() => handleSelectTeam(team.id)}
              disabled={isDisabled}
              className={`w-full px-3 py-2.5 text-left flex items-center justify-between transition-all group ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isDisabled
                  ? 'opacity-30 cursor-not-allowed'
                  : 'hover:bg-muted cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base leading-none">{team.flag}</span>
                <div>
                  <div className={`text-sm font-semibold leading-tight ${isSelected ? 'text-primary-foreground' : ''}`}>
                    {team.name}
                  </div>
                  <div className={`text-[9px] tracking-widest uppercase ${isSelected ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {team.continent}
                  </div>
                </div>
              </div>
              <span className={`font-mono text-sm font-black ${isSelected ? 'text-primary-foreground' : accentText}`}>
                {team.overallRating}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SetupPage() {
  const { teams, teamAId, teamBId, setTeamA, setTeamB, setStep } = useCoachStore();
  const canProceed = !!(teamAId && teamBId && teamAId !== teamBId);

  const teamA = teams.find(t => t.id === teamAId);
  const teamB = teams.find(t => t.id === teamBId);

  return (
    <div className="space-y-8">
      {/* Hero heading */}
      <div className="space-y-1">
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
          Step 01 — Team Selection
        </div>
        <h2 className="text-5xl md:text-6xl font-black leading-none tracking-tighter uppercase">
          FIFA
          <br />
          <span style={{ color: 'var(--primary)' }}>WC 2026</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick two national teams and simulate the outcome.
        </p>
      </div>

      {/* VS banner — shown once both selected */}
      {teamA && teamB && (
        <div className="flex items-center gap-0 border border-border overflow-hidden">
          <div className="flex-1 flex items-center gap-3 px-5 py-4 bg-primary text-primary-foreground">
            <span className="text-3xl">{teamA.flag}</span>
            <div>
              <div className="font-black text-lg leading-tight">{teamA.name}</div>
              <div className="text-[9px] opacity-60 tracking-widest uppercase font-mono">{teamA.overallRating} OVR</div>
            </div>
          </div>
          <div className="px-5 py-4 border-x border-border bg-card shrink-0">
            <span className="font-black text-xl tracking-widest text-muted-foreground">VS</span>
          </div>
          <div className="flex-1 flex items-center justify-end gap-3 px-5 py-4 bg-card">
            <div className="text-right">
              <div className="font-black text-lg leading-tight">{teamB.name}</div>
              <div className="text-[9px] text-muted-foreground tracking-widest uppercase font-mono">{teamB.overallRating} OVR</div>
            </div>
            <span className="text-3xl">{teamB.flag}</span>
          </div>
        </div>
      )}

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-border md:divide-x divide-y md:divide-y-0 divide-border">
        <TeamSelector
          label="Home Team"
          side="home"
          teamId={teamAId}
          setTeam={setTeamA}
          teams={teams}
          disabledTeamId={teamBId}
        />
        <TeamSelector
          label="Away Team"
          side="away"
          teamId={teamBId}
          setTeam={setTeamB}
          teams={teams}
          disabledTeamId={teamAId}
        />
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between border-t border-border pt-6">
        <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
          {canProceed ? 'Both teams selected — ready to proceed' : 'Select two different teams to continue'}
        </span>
        <Button
          size="lg"
          disabled={!canProceed}
          onClick={() => setStep('tactics')}
          className="rounded-none font-bold tracking-wider uppercase text-sm px-8 h-11 disabled:opacity-30"
        >
          Configure Tactics →
        </Button>
      </div>
    </div>
  );
}
