'use client';

import { useState, useMemo } from 'react';
import { useCoachStore } from '@/store/matchStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const CONTINENTS = [
  { id: 'all', label: 'All', emoji: '🌍' },
  { id: 'UEFA', label: 'Europe', emoji: '🇪🇺' },
  { id: 'CONMEBOL', label: 'S. America', emoji: '🌎' },
  { id: 'CONCACAF', label: 'N. America', emoji: '🌎' },
  { id: 'AFC', label: 'Asia', emoji: '🌏' },
  { id: 'CAF', label: 'Africa', emoji: '🌍' },
  { id: 'OFC', label: 'Oceania', emoji: '🌏' },
];

export default function SetupPage() {
  const {
    teams,
    teamAId,
    teamBId,
    setTeamA,
    setTeamB,
    setStep,
  } = useCoachStore();

  const [continentA, setContinentA] = useState('all');
  const [continentB, setContinentB] = useState('all');
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');

  const filteredTeamsA = useMemo(() => {
    return teams.filter(t => {
      if (continentA !== 'all' && t.continent !== continentA) return false;
      if (searchA && !t.name.toLowerCase().includes(searchA.toLowerCase())) return false;
      return true;
    });
  }, [teams, continentA, searchA]);

  const filteredTeamsB = useMemo(() => {
    return teams.filter(t => {
      if (continentB !== 'all' && t.continent !== continentB) return false;
      if (searchB && !t.name.toLowerCase().includes(searchB.toLowerCase())) return false;
      return true;
    });
  }, [teams, continentB, searchB]);

  const teamA = teams.find(t => t.id === teamAId);
  const teamB = teams.find(t => t.id === teamBId);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="text-4xl">🏆</div>
        <h2 className="text-2xl md:text-3xl font-bold">FIFA World Cup 2026</h2>
        <p className="text-muted-foreground">Pick two national teams and predict the outcome</p>
      </div>

      {/* Selected teams display */}
      <div className="flex items-center justify-center gap-4">
        <div className="text-center">
          {teamA && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-4xl">{teamA.flag}</span>
              <span className="font-bold text-sm">{teamA.name}</span>
              <Badge variant="secondary">OVR {teamA.overallRating}</Badge>
            </div>
          )}
        </div>
        <span className="text-2xl font-bold text-muted-foreground">VS</span>
        <div className="text-center">
          {teamB && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-4xl">{teamB.flag}</span>
              <span className="font-bold text-sm">{teamB.name}</span>
              <Badge variant="secondary">OVR {teamB.overallRating}</Badge>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Team A */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              Home Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={searchA}
                onChange={(e) => setSearchA(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            {/* Continent filter */}
            <div className="flex flex-wrap gap-1">
              {CONTINENTS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setContinentA(c.id)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                    continentA === c.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            {/* Team list */}
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
              {filteredTeamsA.map(team => (
                <button
                  key={team.id}
                  onClick={() => setTeamA(team.id)}
                  className={`w-full p-2.5 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                    teamAId === team.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{team.flag}</span>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: team.color, color: team.textColor }}
                      >
                        {team.shortName}
                      </div>
                      <div>
                        <span className="font-medium text-sm">{team.name}</span>
                        <div className="text-[10px] text-muted-foreground">{team.continent}</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {team.overallRating}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Team B */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              Away Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={searchB}
                onChange={(e) => setSearchB(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            {/* Continent filter */}
            <div className="flex flex-wrap gap-1">
              {CONTINENTS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setContinentB(c.id)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                    continentB === c.id
                      ? 'bg-destructive text-white'
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            {/* Team list */}
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
              {filteredTeamsB.map(team => (
                <button
                  key={team.id}
                  onClick={() => setTeamB(team.id)}
                  className={`w-full p-2.5 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                    teamBId === team.id
                      ? 'border-destructive bg-destructive/5 shadow-sm'
                      : 'border-border hover:border-destructive/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{team.flag}</span>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: team.color, color: team.textColor }}
                      >
                        {team.shortName}
                      </div>
                      <div>
                        <span className="font-medium text-sm">{team.name}</span>
                        <div className="text-[10px] text-muted-foreground">{team.continent}</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {team.overallRating}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {teamAId === teamBId && (
        <p className="text-center text-destructive font-medium">Please select two different teams</p>
      )}

      <div className="flex justify-center">
        <Button
          size="lg"
          disabled={teamAId === teamBId}
          onClick={() => setStep('tactics')}
          className="px-12 text-lg"
        >
          Configure Tactics →
        </Button>
      </div>
    </div>
  );
}
