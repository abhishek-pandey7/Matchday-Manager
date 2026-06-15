'use client';

import { useState } from 'react';
import { useTournamentStore, TournamentMatch } from '@/store/tournamentStore';
import { TEAMS } from '@/lib/simulation/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Shield, Calendar, Layers, RefreshCw, Play, FastForward } from 'lucide-react';

export default function TournamentHub() {
  const store = useTournamentStore();
  const [activeTab, setActiveTab] = useState<'standings' | 'fixtures' | 'bracket'>('standings');
  const [fixturesMatchday, setFixturesMatchday] = useState(1);

  const getTeam = (teamId: string) => {
    return TEAMS.find(t => t.id === teamId)!;
  };

  const getMatchStatus = (m: TournamentMatch) => {
    if (m.isSimulated && m.score) {
      const etText = m.shootoutScore ? ' (AET)' : '';
      const scoreText = `${m.score[0]} - ${m.score[1]}${etText}`;
      if (m.shootoutScore) {
        return (
          <div className="flex flex-col items-center">
            <span className="font-bold tabular-nums">{scoreText}</span>
            <span className="text-[9px] font-mono text-muted-foreground">
              PEN: {m.shootoutScore[0]} - {m.shootoutScore[1]}
            </span>
          </div>
        );
      }
      return <span className="font-bold tabular-nums">{scoreText}</span>;
    }

    const involvesUser = store.userTeamIds.includes(m.teamAId) || store.userTeamIds.includes(m.teamBId);
    if (involvesUser) {
      return (
        <Button
          size="sm"
          onClick={() => store.startMatchPlayback(m.id)}
          className="rounded-none font-bold text-[10px] tracking-wider uppercase text-background"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Play className="w-3 h-3 mr-1" /> PLAY
        </Button>
      );
    }
    return <span className="text-[10px] font-mono text-muted-foreground uppercase">CPU</span>;
  };

  const currentRoundMatches = store.matches.filter(m => {
    if (store.currentRound === 'group_stage') {
      return m.round === 'group_stage' && m.matchday === store.groupMatchday;
    }
    return m.round === store.currentRound;
  });

  const isRoundFinished = currentRoundMatches.every(m => m.isSimulated);
  const remainingUserMatches = currentRoundMatches.filter(m => 
    !m.isSimulated && (store.userTeamIds.includes(m.teamAId) || store.userTeamIds.includes(m.teamBId))
  );

  const getRoundLabel = (round: string, md?: number) => {
    switch (round) {
      case 'group_stage': return `Group Stage — Matchday ${md}`;
      case 'r32': return 'Round of 32';
      case 'r16': return 'Round of 16';
      case 'qf': return 'Quarter-Finals';
      case 'sf': return 'Semi-Finals';
      case 'final': return 'Grand Final';
      case 'ended': return 'Tournament Finished';
      default: return round;
    }
  };

  // Bracket visualization grouping
  const getBracketRounds = () => {
    const roundsList: { label: string; matches: TournamentMatch[] }[] = [];
    const rNames: ('r32' | 'r16' | 'qf' | 'sf' | 'final')[] = ['r32', 'r16', 'qf', 'sf', 'final'];
    
    rNames.forEach(rn => {
      const rMatches = store.matches.filter(m => m.round === rn);
      if (rMatches.length > 0) {
        roundsList.push({
          label: getRoundLabel(rn),
          matches: rMatches,
        });
      }
    });

    return roundsList;
  };

  return (
    <div className="space-y-6">
      {/* Overview Dashboard Card */}
      <div className="border border-border p-4 bg-muted/10 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="space-y-1">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            FIFA WC 2026 Dashboard
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight">
            {getRoundLabel(store.currentRound, store.groupMatchday)}
          </h3>
          <p className="text-[11px] text-muted-foreground uppercase font-mono">
            Coached Nation: {store.userTeamIds.length > 0 ? (
              <span className="font-bold text-foreground">
                {getTeam(store.userTeamIds[0]).flag} {getTeam(store.userTeamIds[0]).name.toUpperCase()}
              </span>
            ) : 'NONE'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap gap-2">
          {!isRoundFinished && (
            <Button
              variant="outline"
              onClick={() => store.simulateCPUMatches()}
              className="rounded-none border-border font-bold text-xs tracking-wider uppercase bg-background"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> SIM CPU MATCHES
            </Button>
          )}

          {isRoundFinished && store.currentRound !== 'ended' && (
            <Button
              onClick={() => store.advanceTournamentRound()}
              className="rounded-none font-bold text-xs tracking-wider uppercase text-background animate-pulse"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              ADVANCE TO NEXT ROUND <FastForward className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => store.resetTournament()}
            className="rounded-none border-border font-bold text-xs tracking-wider uppercase bg-background"
          >
            EXIT TOURNAMENT
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('standings')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold tracking-widest uppercase border-b-2 rounded-none transition-all ${
            activeTab === 'standings' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" /> Standings
        </button>
        <button
          onClick={() => setActiveTab('fixtures')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold tracking-widest uppercase border-b-2 rounded-none transition-all ${
            activeTab === 'fixtures' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Fixtures
        </button>
        <button
          onClick={() => setActiveTab('bracket')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold tracking-widest uppercase border-b-2 rounded-none transition-all ${
            activeTab === 'bracket' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Bracket
        </button>
      </div>

      {/* Standings View */}
      {activeTab === 'standings' && (
        <div className="space-y-6">
          {store.currentRound === 'group_stage' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.keys(store.groups).map(g => {
                const table = store.standings[g] || [];
                return (
                  <div key={g} className="border border-border/80 p-3 bg-muted/5">
                    <h4 className="font-black text-sm tracking-tight border-b border-border/60 pb-1 mb-2 uppercase">
                      GROUP {g}
                    </h4>
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border/20">
                          <th className="py-1 font-bold">#</th>
                          <th className="py-1 font-bold">TEAM</th>
                          <th className="py-1 text-center font-bold">P</th>
                          <th className="py-1 text-center font-bold">GD</th>
                          <th className="py-1 text-right font-bold">PTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.map((stats, idx) => {
                          const team = getTeam(stats.teamId);
                          const isUser = store.userTeamIds.includes(stats.teamId);
                          const qualifies = idx < 2; // Top 2 qualify

                          return (
                            <tr
                              key={stats.teamId}
                              className={`border-b border-border/10 py-1 transition-all ${
                                isUser ? 'font-bold bg-primary/5' : ''
                              }`}
                              style={isUser ? { borderLeft: '2.5px solid var(--primary)', paddingLeft: '2px' } : {}}
                            >
                              <td className="py-1">
                                <span className={qualifies ? 'text-primary font-bold' : 'text-muted-foreground'}>
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-1 flex items-center gap-1.5 truncate">
                                <span>{team.flag}</span>
                                <span className="truncate uppercase">{team.name}</span>
                              </td>
                              <td className="py-1 text-center">{stats.played}</td>
                              <td className="py-1 text-center tabular-nums">
                                {stats.goalDifference > 0 ? `+${stats.goalDifference}` : stats.goalDifference}
                              </td>
                              <td className="py-1 text-right font-bold tabular-nums">
                                {stats.points}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center border border-border p-12 bg-muted/10 space-y-3">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
              <h4 className="font-bold uppercase text-sm tracking-widest">GROUP STAGE FINISHED</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto uppercase">
                The group stage is complete. Head over to the Bracket tab to view knockout pairings and follow progression.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Fixtures View */}
      {activeTab === 'fixtures' && (
        <div className="space-y-4">
          {/* Matchday filters for group stage */}
          {store.currentRound === 'group_stage' && (
            <div className="flex gap-1 border-b border-border/30 pb-3">
              {[1, 2, 3].map(md => (
                <button
                  key={md}
                  onClick={() => setFixturesMatchday(md)}
                  className={`px-3 py-1 text-[10px] font-bold tracking-wider rounded-none uppercase transition-all ${
                    fixturesMatchday === md
                      ? 'text-background'
                      : 'text-foreground border border-border bg-background hover:bg-muted/50'
                  }`}
                  style={fixturesMatchday === md ? { backgroundColor: 'var(--primary)' } : {}}
                >
                  Matchday {md}
                </button>
              ))}
            </div>
          )}

          {/* Fixtures List */}
          <div className="border border-border/80 divide-y divide-border/60">
            {store.matches
              .filter(m => {
                if (store.currentRound === 'group_stage') {
                  return m.round === 'group_stage' && m.matchday === fixturesMatchday;
                }
                return m.round === store.currentRound;
              })
              .map(m => {
                const teamA = getTeam(m.teamAId);
                const teamB = getTeam(m.teamBId);
                const isUserA = store.userTeamIds.includes(m.teamAId);
                const isUserB = store.userTeamIds.includes(m.teamBId);

                return (
                  <div
                    key={m.id}
                    className={`p-3 md:px-6 flex items-center justify-between gap-4 transition-all ${
                      m.isSimulated ? 'bg-muted/5' : 'bg-background'
                    }`}
                  >
                    <div className="flex-1 flex items-center justify-end gap-2 text-right">
                      <span className={`text-xs uppercase truncate ${isUserA ? 'font-bold' : ''}`}>
                        {teamA.name}
                      </span>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: teamA.color, color: teamA.textColor }}
                      >
                        {teamA.shortName}
                      </div>
                      <span className="text-base shrink-0">{teamA.flag}</span>
                    </div>

                    <div className="shrink-0 flex items-center justify-center w-24">
                      {getMatchStatus(m)}
                    </div>

                    <div className="flex-1 flex items-center justify-start gap-2 text-left">
                      <span className="text-base shrink-0">{teamB.flag}</span>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: teamB.color, color: teamB.textColor }}
                      >
                        {teamB.shortName}
                      </div>
                      <span className={`text-xs uppercase truncate ${isUserB ? 'font-bold' : ''}`}>
                        {teamB.name}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Bracket View */}
      {activeTab === 'bracket' && (
        <div className="space-y-6 overflow-x-auto">
          {store.matches.some(m => m.round !== 'group_stage') ? (
            <div className="flex gap-8 py-4 min-w-[800px] pr-8">
              {getBracketRounds().map((roundObj, roundIdx) => (
                <div key={roundIdx} className="flex flex-col gap-6 w-52 shrink-0">
                  <h4 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase border-b border-border/60 pb-1.5">
                    {roundObj.label}
                  </h4>
                  <div className="flex-1 flex flex-col justify-around gap-4">
                    {roundObj.matches.map(m => {
                      const teamA = getTeam(m.teamAId);
                      const teamB = getTeam(m.teamBId);
                      const isUserA = store.userTeamIds.includes(m.teamAId);
                      const isUserB = store.userTeamIds.includes(m.teamBId);
                      
                      const scoreA = m.score ? m.score[0] : null;
                      const scoreB = m.score ? m.score[1] : null;
                      const wonA = m.winnerId === m.teamAId;
                      const wonB = m.winnerId === m.teamBId;

                      return (
                        <div
                          key={m.id}
                          className="border border-border/80 bg-muted/5 flex flex-col divide-y divide-border/20 text-xs text-foreground/90 font-mono"
                        >
                          {/* Team A */}
                          <div className={`p-2 flex items-center justify-between gap-2 ${wonA ? 'bg-primary/5 font-bold' : ''}`}>
                            <div className="flex items-center gap-1.5 truncate">
                              <span>{teamA.flag}</span>
                              <span className="truncate uppercase">{teamA.shortName}</span>
                              {isUserA && <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />}
                            </div>
                            {scoreA !== null && (
                              <span className="tabular-nums">
                                {scoreA}
                                {m.shootoutScore && wonA && ` (${m.shootoutScore[0]})`}
                              </span>
                            )}
                          </div>

                          {/* Team B */}
                          <div className={`p-2 flex items-center justify-between gap-2 ${wonB ? 'bg-primary/5 font-bold' : ''}`}>
                            <div className="flex items-center gap-1.5 truncate">
                              <span>{teamB.flag}</span>
                              <span className="truncate uppercase">{teamB.shortName}</span>
                              {isUserB && <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />}
                            </div>
                            {scoreB !== null && (
                              <span className="tabular-nums">
                                {scoreB}
                                {m.shootoutScore && wonB && ` (${m.shootoutScore[1]})`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center border border-border p-12 bg-muted/10 space-y-3">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
              <h4 className="font-bold uppercase text-sm tracking-widest">NO KNOCKOUT MATCHES YET</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto uppercase">
                The knockout bracket will generate once the Group Stage is complete. Top 2 teams from each group and the 8 best third-placed teams qualify for the Round of 32.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
