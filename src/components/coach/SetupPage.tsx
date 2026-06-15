'use client';

import { useState, useMemo, useCallback } from 'react';
import { useCoachStore } from '@/store/matchStore';
import { Team } from '@/lib/simulation/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Users, Shield, Swords, ChevronDown, ChevronUp, X } from 'lucide-react';

const CONTINENTS = [
  { id: 'all', label: 'All', emoji: '🌍' },
  { id: 'UEFA', label: 'Europe', emoji: '🇪🇺' },
  { id: 'CONMEBOL', label: 'S. America', emoji: '🌎' },
  { id: 'CONCACAF', label: 'N. America', emoji: '🌎' },
  { id: 'AFC', label: 'Asia', emoji: '🌏' },
  { id: 'CAF', label: 'Africa', emoji: '🌍' },
  { id: 'OFC', label: 'Oceania', emoji: '🌏' },
];

function positionColor(pos: string): string {
  if (['GK'].includes(pos)) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-300';
  return 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-300';
}

function SquadPreview({ team }: { team: Team }) {
  const [expanded, setExpanded] = useState(false);

  const gks = team.players.filter(p => p.position === 'GK');
  const defs = team.players.filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position));
  const mids = team.players.filter(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.position));
  const fwds = team.players.filter(p => ['ST', 'CF', 'LW', 'RW'].includes(p.position));

  return (
    <div className="mt-2">
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        <Users className="w-3 h-3" />
        {expanded ? 'Hide' : 'Show'} Squad ({team.players.length} players)
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="space-y-2 mt-1 text-xs">
          {[
            { label: 'GK', players: gks, icon: '🧤' },
            { label: 'DEF', players: defs, icon: '🛡️' },
            { label: 'MID', players: mids, icon: '⚙️' },
            { label: 'FWD', players: fwds, icon: '⚡' },
          ].map(group => (
            <div key={group.label}>
              <div className="text-[10px] font-medium text-muted-foreground mb-0.5">
                {group.icon} {group.label} ({group.players.length})
              </div>
              <div className="space-y-0.5">
                {group.players.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-muted/50">
                    <span className="font-medium">{p.name}</span>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">
                      {p.rating}
                    </Badge>
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
  teamId,
  setTeam,
  teams,
  colorDot,
  accentClass,
  disabledTeamId,
}: {
  label: string;
  teamId: string;
  setTeam: (id: string) => void;
  teams: Team[];
  colorDot: string;
  accentClass: string;
  disabledTeamId: string;
}) {
  const [continent, setContinent] = useState('all');
  const [search, setSearch] = useState('');
  const [previewTeam, setPreviewTeam] = useState<string | null>(null);

  const filteredTeams = useMemo(() => {
    return teams.filter(t => {
      if (continent !== 'all' && t.continent !== continent) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [teams, continent, search]);

  const selectedTeam = teamId ? teams.find(t => t.id === teamId) : null;

  const handleSelectTeam = useCallback((id: string) => {
    if (id === disabledTeamId) return;
    setTeam(id);
    setPreviewTeam(null);
  }, [setTeam, disabledTeamId]);

  const handleDeselect = useCallback(() => {
    setTeam('');
  }, [setTeam]);

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${colorDot}`} />
          {label}
          {selectedTeam && (
            <Badge variant="outline" className="ml-auto text-[10px]">
              Selected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Selected team display */}
        {selectedTeam && (
          <div className={`p-3 rounded-lg border-2 ${accentClass} mb-3 relative`}>
            <button
              onClick={handleDeselect}
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-background/80 hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title="Deselect team"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedTeam.flag}</span>
              <div className="flex-1">
                <div className="font-bold">{selectedTeam.name}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{selectedTeam.continent}</span>
                  <span>•</span>
                  <span>Overall: {selectedTeam.overallRating}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black">{selectedTeam.overallRating}</div>
                <div className="text-[10px] text-muted-foreground">OVR</div>
              </div>
            </div>
            {/* Team stats */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="text-center p-1 rounded bg-background/50">
                <div className="flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground">
                  <Swords className="w-2.5 h-2.5" /> ATK
                </div>
                <div className="font-bold text-sm">{selectedTeam.attackRating}</div>
              </div>
              <div className="text-center p-1 rounded bg-background/50">
                <div className="flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground">
                  <Shield className="w-2.5 h-2.5" /> MID
                </div>
                <div className="font-bold text-sm">{selectedTeam.midfieldRating}</div>
              </div>
              <div className="text-center p-1 rounded bg-background/50">
                <div className="flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground">
                  <Shield className="w-2.5 h-2.5" /> DEF
                </div>
                <div className="font-bold text-sm">{selectedTeam.defenseRating}</div>
              </div>
            </div>
            <SquadPreview team={selectedTeam} />
          </div>
        )}

        {/* Prompt when no team selected */}
        {!selectedTeam && (
          <div className="p-3 rounded-lg border-2 border-dashed border-muted-foreground/30 mb-3 text-center">
            <p className="text-sm text-muted-foreground">Select a team below</p>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Continent filter */}
        <div className="flex flex-wrap gap-1">
          {CONTINENTS.map(c => (
            <button
              key={c.id}
              onClick={() => setContinent(c.id)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                continent === c.id
                  ? accentClass
                  : 'bg-muted/50 hover:bg-muted'
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {/* Team count */}
        <div className="text-[10px] text-muted-foreground text-center">
          {filteredTeams.length} team{filteredTeams.length !== 1 ? 's' : ''}
        </div>

        {/* Team list */}
        <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
          {filteredTeams.map(team => {
            const isSelected = teamId === team.id;
            const isOtherSelected = team.id === disabledTeamId;

            return (
              <div key={team.id}>
                <button
                  onClick={() => handleSelectTeam(team.id)}
                  onMouseEnter={() => setPreviewTeam(team.id)}
                  onMouseLeave={() => setPreviewTeam(null)}
                  disabled={isOtherSelected}
                  className={`w-full p-2 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? accentClass
                      : isOtherSelected
                      ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                      : 'border-border hover:border-primary/50 hover:shadow-md cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{team.flag}</span>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold"
                        style={{ backgroundColor: team.color, color: team.textColor }}
                      >
                        {team.shortName}
                      </div>
                      <div>
                        <span className="font-medium text-sm">{team.name}</span>
                        <div className="text-[10px] text-muted-foreground">{team.continent}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isOtherSelected && (
                        <span className="text-[9px] text-muted-foreground italic">other side</span>
                      )}
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {team.overallRating}
                      </Badge>
                    </div>
                  </div>
                </button>
                {/* Hover preview */}
                {previewTeam === team.id && !isSelected && !isOtherSelected && (
                  <div className="px-2 pb-1">
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      <span>ATK {team.attackRating}</span>
                      <span>MID {team.midfieldRating}</span>
                      <span>DEF {team.defenseRating}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SetupPage() {
  const {
    teams,
    teamAId,
    teamBId,
    setTeamA,
    setTeamB,
    setStep,
  } = useCoachStore();

  const canProceed = !!(teamAId && teamBId && teamAId !== teamBId);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="text-4xl">🏆</div>
        <h2 className="text-2xl md:text-3xl font-bold">FIFA World Cup 2026</h2>
        <p className="text-muted-foreground">Pick two national teams and predict the outcome</p>
      </div>

      {/* Selected teams VS display */}
      {teamAId && teamBId && (() => {
        const teamA = teams.find(t => t.id === teamAId);
        const teamB = teams.find(t => t.id === teamBId);
        if (!teamA || !teamB) return null;
        return (
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="text-4xl">{teamA.flag}</span>
                <span className="font-bold text-sm">{teamA.name}</span>
                <Badge variant="secondary">OVR {teamA.overallRating}</Badge>
              </div>
            </div>
            <span className="text-2xl font-bold text-muted-foreground">VS</span>
            <div className="text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="text-4xl">{teamB.flag}</span>
                <span className="font-bold text-sm">{teamB.name}</span>
                <Badge variant="secondary">OVR {teamB.overallRating}</Badge>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TeamSelector
          label="Home Team"
          teamId={teamAId}
          setTeam={setTeamA}
          teams={teams}
          colorDot="bg-green-500"
          accentClass="border-primary bg-primary/5 shadow-sm"
          disabledTeamId={teamBId}
        />
        <TeamSelector
          label="Away Team"
          teamId={teamBId}
          setTeam={setTeamB}
          teams={teams}
          colorDot="bg-red-500"
          accentClass="border-destructive bg-destructive/5 shadow-sm"
          disabledTeamId={teamAId}
        />
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          disabled={!canProceed}
          onClick={() => setStep('tactics')}
          className="px-12 text-lg"
        >
          Configure Tactics →
        </Button>
      </div>
    </div>
  );
}
