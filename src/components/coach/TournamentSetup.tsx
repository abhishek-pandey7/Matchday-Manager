'use client';

import { useState, useMemo } from 'react';
import { useTournamentStore } from '@/store/tournamentStore';
import { TEAMS } from '@/lib/simulation/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const CONTINENTS = [
  { id: 'all', label: 'ALL' },
  { id: 'UEFA', label: 'EUR' },
  { id: 'CONMEBOL', label: 'SAM' },
  { id: 'CONCACAF', label: 'NAM' },
  { id: 'AFC', label: 'ASI' },
  { id: 'CAF', label: 'AFR' },
  { id: 'OFC', label: 'OCE' },
];

export default function TournamentSetup() {
  const store = useTournamentStore();
  const [continent, setContinent] = useState('all');
  const [search, setSearch] = useState('');

  const filteredTeams = useMemo(() => {
    return TEAMS.filter(t => {
      if (continent !== 'all' && t.continent !== continent) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => b.overallRating - a.overallRating);
  }, [continent, search]);

  const handleSelectAll = () => {
    // If some or all are selected, clear all. Otherwise select all.
    if (store.userTeamIds.length > 0) {
      // Clear
      store.resetTournament();
      store.setMode('tournament');
      store.setTournamentStep('setup');
    } else {
      TEAMS.forEach(t => {
        if (!store.userTeamIds.includes(t.id)) {
          store.toggleUserTeam(t.id);
        }
      });
    }
  };

  const handleQuickSelect = (continentId: string) => {
    // Clear and select all teams of this continent
    TEAMS.forEach(t => {
      if (t.continent === continentId && !store.userTeamIds.includes(t.id)) {
        store.toggleUserTeam(t.id);
      } else if (t.continent !== continentId && store.userTeamIds.includes(t.id)) {
        store.toggleUserTeam(t.id);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Kinetic Heading */}
      <div className="space-y-1">
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
          World Cup 2026 Setup
        </div>
        <h2 className="text-5xl md:text-6xl font-black leading-none tracking-tighter uppercase">
          CHOOSE YOUR<br />
          <span style={{ color: 'var(--primary)' }}>NATION(S)</span>
        </h2>
        <p className="text-xs text-muted-foreground max-w-lg mt-2 uppercase tracking-wide">
          Select one or more teams to coach. You will make tactical adjustments, set starting lineups, and watch simulated pitch play for all user-controlled matches. CPU matches are simulated instantly.
        </p>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-y border-border py-4">
        {/* Continent Filter */}
        <div className="flex flex-wrap gap-1">
          {CONTINENTS.map((c) => {
            const isActive = continent === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setContinent(c.id)}
                className={`px-3 py-1 text-[11px] font-bold tracking-wider transition-all rounded-none uppercase ${
                  isActive
                    ? 'text-background'
                    : 'text-foreground hover:bg-muted/50 border border-border'
                }`}
                style={isActive ? { backgroundColor: 'var(--primary)' } : {}}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="SEARCH NATION..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/20 border-border rounded-none text-xs tracking-wider font-bold"
          />
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {filteredTeams.map((team) => {
          const isUser = store.userTeamIds.includes(team.id);

          return (
            <div
              key={team.id}
              onClick={() => store.toggleUserTeam(team.id)}
              className={`border p-3 flex flex-col justify-between cursor-pointer select-none transition-all group relative ${
                isUser
                  ? 'border-primary'
                  : 'border-border/60 bg-muted/10 hover:border-foreground/40'
              }`}
              style={isUser ? { backgroundColor: 'rgba(223, 225, 4, 0.05)' } : {}}
            >
              <div className="flex items-start justify-between">
                <span className="text-xl" role="img" aria-label={team.name}>{team.flag}</span>
                <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                  OVR {team.overallRating}
                </span>
              </div>

              <div className="mt-3">
                <div className="font-bold text-sm tracking-tight truncate uppercase">{team.name}</div>
                <div className="text-[8px] font-mono tracking-widest text-muted-foreground uppercase mt-0.5">
                  {team.continent}
                </div>
              </div>

              {/* Selection overlay */}
              {isUser && (
                <div 
                  className="absolute top-0 right-0 w-2 h-2"
                  style={{ background: 'var(--primary)' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer bar with sticky stats & CTA */}
      <div className="border-t border-border pt-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Selected Nations: <span className="font-bold text-foreground" style={{ color: store.userTeamIds.length > 0 ? 'var(--primary)' : 'inherit' }}>{store.userTeamIds.length} / 48</span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-none font-bold text-xs tracking-wider uppercase border-border"
            onClick={() => store.setMode('menu')}
          >
            CANCEL
          </Button>
          <Button
            className="rounded-none font-bold text-xs tracking-wider uppercase text-background hover:opacity-90"
            disabled={store.userTeamIds.length === 0}
            style={{ backgroundColor: 'var(--primary)' }}
            onClick={() => store.initTournament()}
          >
            PROCEED TO DRAW ({store.userTeamIds.length} TEAMS)
          </Button>
        </div>
      </div>
    </div>
  );
}
