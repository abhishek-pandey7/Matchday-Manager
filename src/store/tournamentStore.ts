import { create } from 'zustand';
import { Team, Lineup, MatchEvent, Position } from '@/lib/simulation/types';
import { TEAMS } from '@/lib/simulation/data';
import { getAutoLineup } from '@/lib/simulation/formations';
import { simulateMatch } from '@/lib/simulation/engine';
import { useCoachStore } from './matchStore';

export interface GroupTeamStats {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export type TournamentRound =
  | 'group_stage'
  | 'r32'
  | 'r16'
  | 'qf'
  | 'sf'
  | 'final'
  | 'ended';

export interface TournamentMatch {
  id: string;
  round: TournamentRound;
  groupName?: string; // e.g. 'Group A' if group stage
  matchday?: number;  // 1, 2, 3 if group stage
  teamAId: string;
  teamBId: string;
  score?: [number, number];
  shootoutScore?: [number, number];
  winnerId?: string;
  isSimulated: boolean;
  events?: MatchEvent[];
}

interface TournamentState {
  // Navigation & General
  mode: 'menu' | 'single' | 'tournament';
  tournamentStep: 'setup' | 'draw' | 'hub';
  setMode: (mode: 'menu' | 'single' | 'tournament') => void;
  setTournamentStep: (step: 'setup' | 'draw' | 'hub') => void;

  // Selection
  userTeamIds: string[];
  toggleUserTeam: (teamId: string) => void;

  // Pots & Draw
  pots: string[][]; // 4 pots of 12 team IDs
  groups: Record<string, string[]>; // Group A to L (12 groups of 4)
  remainingPots: string[][]; // copy of pots to track draw progress
  drawHistory: { teamId: string; groupName: string }[];
  currentPotIdx: number;
  currentGroupIdx: number;

  // Standings & Matches
  standings: Record<string, GroupTeamStats[]>; // Group A-L to stats
  matches: TournamentMatch[];
  currentRound: TournamentRound;
  groupMatchday: number; // 1, 2, 3

  // Active Playback
  activeTournamentMatchId: string | null;

  // Actions
  initTournament: () => void;
  runDrawStep: () => boolean; // returns true if draw is finished
  completeDraw: () => void;
  simulateCPUMatches: () => void;
  startMatchPlayback: (matchId: string) => void;
  submitMatchResult: (score: [number, number], shootoutScore?: [number, number], events?: MatchEvent[]) => void;
  advanceTournamentRound: () => void;
  resetTournament: () => void;
}

const defaultTactics = {
  pressingIntensity: 50,
  tempo: 50,
  width: 50,
  defensiveLine: 50,
  mentality: 'balanced' as const,
};

const createDefaultLineup = (team: Team): Lineup => {
  const starting11 = getAutoLineup(team.players, '4-3-3');
  const subs = team.players
    .filter(p => !starting11.includes(p.id))
    .map(p => p.id);

  return {
    formation: '4-3-3',
    starting11,
    subs,
    substitutions: [],
    tactics: { ...defaultTactics },
  };
};

const GROUP_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export const useTournamentStore = create<TournamentState>((set, get) => ({
  mode: 'menu',
  tournamentStep: 'setup',
  setMode: (mode) => set({ mode }),
  setTournamentStep: (step) => set({ step }),

  userTeamIds: [],
  toggleUserTeam: (teamId) => {
    set({ userTeamIds: [teamId] });
  },

  pots: [],
  groups: {},
  remainingPots: [],
  drawHistory: [],
  currentPotIdx: 0,
  currentGroupIdx: 0,

  standings: {},
  matches: [],
  currentRound: 'group_stage',
  groupMatchday: 1,

  activeTournamentMatchId: null,

  initTournament: () => {
    // 1. Sort all 48 teams by overallRating descending to partition pots
    const sortedTeams = [...TEAMS].sort((a, b) => b.overallRating - a.overallRating);
    
    // Pot 1: 1-12, Pot 2: 13-24, Pot 3: 25-36, Pot 4: 37-48
    const pots = [
      sortedTeams.slice(0, 12).map(t => t.id),
      sortedTeams.slice(12, 24).map(t => t.id),
      sortedTeams.slice(24, 36).map(t => t.id),
      sortedTeams.slice(36, 48).map(t => t.id),
    ];

    // Initialize groups A-L as empty
    const groups: Record<string, string[]> = {};
    const standings: Record<string, GroupTeamStats[]> = {};
    for (const g of GROUP_NAMES) {
      groups[g] = [];
      standings[g] = [];
    }

    set({
      pots,
      remainingPots: pots.map(p => [...p]),
      groups,
      standings,
      drawHistory: [],
      currentPotIdx: 0,
      currentGroupIdx: 0,
      matches: [],
      currentRound: 'group_stage',
      groupMatchday: 1,
      activeTournamentMatchId: null,
      tournamentStep: 'draw',
    });
  },

  runDrawStep: () => {
    const { remainingPots, currentPotIdx, currentGroupIdx, groups, drawHistory } = get();
    if (currentPotIdx >= 4) return true; // Draw already complete

    const pot = remainingPots[currentPotIdx];
    if (pot.length === 0) return false;

    // Pick a random team from the current pot
    const randIdx = Math.floor(Math.random() * pot.length);
    const drawnTeamId = pot[randIdx];

    // Remove from remaining pot
    const newRemainingPots = remainingPots.map((p, idx) => 
      idx === currentPotIdx ? p.filter(id => id !== drawnTeamId) : p
    );

    // Add to group
    const groupName = GROUP_NAMES[currentGroupIdx];
    const newGroups = {
      ...groups,
      [groupName]: [...groups[groupName], drawnTeamId],
    };

    const newDrawHistory = [...drawHistory, { teamId: drawnTeamId, groupName }];

    // Advance group and pot indices
    let nextGroupIdx = currentGroupIdx + 1;
    let nextPotIdx = currentPotIdx;

    if (nextGroupIdx >= 12) {
      nextGroupIdx = 0;
      nextPotIdx = currentPotIdx + 1;
    }

    set({
      remainingPots: newRemainingPots,
      groups: newGroups,
      drawHistory: newDrawHistory,
      currentPotIdx: nextPotIdx,
      currentGroupIdx: nextGroupIdx,
    });

    if (nextPotIdx >= 4) {
      // Draw finished, build fixtures and standings
      get().completeDraw();
      return true;
    }

    return false;
  },

  completeDraw: () => {
    const state = get();
    let { groups, remainingPots, currentPotIdx, currentGroupIdx, drawHistory } = state;

    // Complete any remaining teams in pots
    const newGroups = { ...groups };
    const newDrawHistory = [...drawHistory];

    while (currentPotIdx < 4) {
      const pot = remainingPots[currentPotIdx];
      if (pot.length === 0) {
        currentPotIdx++;
        currentGroupIdx = 0;
        continue;
      }

      const randIdx = Math.floor(Math.random() * pot.length);
      const drawnTeamId = pot[randIdx];
      pot.splice(randIdx, 1);

      const groupName = GROUP_NAMES[currentGroupIdx];
      newGroups[groupName] = [...newGroups[groupName], drawnTeamId];
      newDrawHistory.push({ teamId: drawnTeamId, groupName });

      currentGroupIdx++;
      if (currentGroupIdx >= 12) {
        currentGroupIdx = 0;
        currentPotIdx++;
      }
    }

    // Initialize standings & schedule
    const standings: Record<string, GroupTeamStats[]> = {};
    const matches: TournamentMatch[] = [];

    for (const g of GROUP_NAMES) {
      const teamIds = newGroups[g];
      standings[g] = teamIds.map(id => ({
        teamId: id,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      }));

      // Generate 3 matchdays for the group stage
      // T0 vs T1, T2 vs T3
      matches.push({
        id: `g_${g}_md1_m1`,
        round: 'group_stage',
        groupName: g,
        matchday: 1,
        teamAId: teamIds[0],
        teamBId: teamIds[1],
        isSimulated: false,
      });
      matches.push({
        id: `g_${g}_md1_m2`,
        round: 'group_stage',
        groupName: g,
        matchday: 1,
        teamAId: teamIds[2],
        teamBId: teamIds[3],
        isSimulated: false,
      });

      // T0 vs T2, T1 vs T3
      matches.push({
        id: `g_${g}_md2_m1`,
        round: 'group_stage',
        groupName: g,
        matchday: 2,
        teamAId: teamIds[0],
        teamBId: teamIds[2],
        isSimulated: false,
      });
      matches.push({
        id: `g_${g}_md2_m2`,
        round: 'group_stage',
        groupName: g,
        matchday: 2,
        teamAId: teamIds[1],
        teamBId: teamIds[3],
        isSimulated: false,
      });

      // T0 vs T3, T1 vs T2
      matches.push({
        id: `g_${g}_md3_m1`,
        round: 'group_stage',
        groupName: g,
        matchday: 3,
        teamAId: teamIds[0],
        teamBId: teamIds[3],
        isSimulated: false,
      });
      matches.push({
        id: `g_${g}_md3_m2`,
        round: 'group_stage',
        groupName: g,
        matchday: 3,
        teamAId: teamIds[1],
        teamBId: teamIds[2],
        isSimulated: false,
      });
    }

    set({
      groups: newGroups,
      drawHistory: newDrawHistory,
      remainingPots: [[], [], [], []],
      currentPotIdx: 4,
      currentGroupIdx: 0,
      standings,
      matches,
      tournamentStep: 'hub',
    });
  },

  simulateCPUMatches: () => {
    const { matches, currentRound, groupMatchday, userTeamIds } = get();

    const updatedMatches = matches.map(m => {
      // Simulate only unplayed matches of the current round/matchday that do not involve user teams
      if (m.round !== currentRound || m.isSimulated) return m;
      if (currentRound === 'group_stage' && m.matchday !== groupMatchday) return m;

      const involvesUser = userTeamIds.includes(m.teamAId) || userTeamIds.includes(m.teamBId);
      if (involvesUser) return m; // Play user matches manually

      const teamA = TEAMS.find(t => t.id === m.teamAId)!;
      const teamB = TEAMS.find(t => t.id === m.teamBId)!;
      const lineupA = createDefaultLineup(teamA);
      const lineupB = createDefaultLineup(teamB);
      
      const seed = Math.floor(Math.random() * 1000000);
      const isKO = currentRound !== 'group_stage';
      const result = simulateMatch(teamA, teamB, lineupA, lineupB, seed, isKO);

      let winnerId: string | undefined = undefined;
      if (isKO) {
        if (result.score[0] > result.score[1]) winnerId = teamA.id;
        else if (result.score[0] < result.score[1]) winnerId = teamB.id;
        else if (result.shootoutScore) {
          winnerId = result.shootoutScore[0] > result.shootoutScore[1] ? teamA.id : teamB.id;
        }
      }

      return {
        ...m,
        score: result.score,
        shootoutScore: result.shootoutScore,
        winnerId,
        isSimulated: true,
        events: result.events,
      };
    });

    set({ matches: updatedMatches });
    
    // Update standings tables
    if (currentRound === 'group_stage') {
      get().submitMatchResult([0, 0], undefined, []); // Trigger recalculation of tables
    }
  },

  startMatchPlayback: (matchId) => {
    const match = get().matches.find(m => m.id === matchId);
    if (!match) return;

    set({ activeTournamentMatchId: matchId });

    // Sync match parameters into coachStore
    const coach = useCoachStore.getState();
    coach.resetMatch();
    coach.setTeamA(match.teamAId);
    coach.setTeamB(match.teamBId);
    coach.setStep('tactics');
  },

  submitMatchResult: (score, shootoutScore, events) => {
    const { activeTournamentMatchId, matches, currentRound, groupMatchday } = get();

    let updatedMatches = [...matches];

    if (activeTournamentMatchId) {
      updatedMatches = matches.map(m => {
        if (m.id !== activeTournamentMatchId) return m;

        const teamA = TEAMS.find(t => t.id === m.teamAId)!;
        const teamB = TEAMS.find(t => t.id === m.teamBId)!;

        let winnerId: string | undefined = undefined;
        if (currentRound !== 'group_stage') {
          if (score[0] > score[1]) winnerId = teamA.id;
          else if (score[0] < score[1]) winnerId = teamB.id;
          else if (shootoutScore) {
            winnerId = shootoutScore[0] > shootoutScore[1] ? teamA.id : teamB.id;
          }
        }

        return {
          ...m,
          score,
          shootoutScore,
          winnerId,
          isSimulated: true,
          events,
        };
      });

      set({ activeTournamentMatchId: null });
    }

    // Recalculate standings for group stage
    if (currentRound === 'group_stage') {
      const standings: Record<string, GroupTeamStats[]> = {};
      
      // Initialize empty standings
      for (const g of GROUP_NAMES) {
        const teamIds = get().groups[g];
        standings[g] = teamIds.map(id => ({
          teamId: id,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
        }));
      }

      // Populate based on played matches
      updatedMatches.forEach(m => {
        if (m.round !== 'group_stage' || !m.isSimulated || !m.score) return;
        const g = m.groupName!;
        const [goalsA, goalsB] = m.score;

        const statsA = standings[g].find(s => s.teamId === m.teamAId)!;
        const statsB = standings[g].find(s => s.teamId === m.teamBId)!;

        statsA.played++;
        statsB.played++;
        statsA.goalsFor += goalsA;
        statsA.goalsAgainst += goalsB;
        statsB.goalsFor += goalsB;
        statsB.goalsAgainst += goalsA;
        statsA.goalDifference = statsA.goalsFor - statsA.goalsAgainst;
        statsB.goalDifference = statsB.goalsFor - statsB.goalsAgainst;

        if (goalsA > goalsB) {
          statsA.won++;
          statsA.points += 3;
          statsB.lost++;
        } else if (goalsA < goalsB) {
          statsB.won++;
          statsB.points += 3;
          statsA.lost++;
        } else {
          statsA.drawn++;
          statsA.points += 1;
          statsB.drawn++;
          statsB.points += 1;
        }
      });

      // Sort tables according to tiebreakers
      for (const g of GROUP_NAMES) {
        standings[g].sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
          if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
          
          // deterministic fallback based on overall rating
          const rateA = TEAMS.find(t => t.id === a.teamId)?.overallRating || 0;
          const rateB = TEAMS.find(t => t.id === b.teamId)?.overallRating || 0;
          return rateB - rateA;
        });
      }

      set({ standings });
    }

    set({ matches: updatedMatches });
  },

  advanceTournamentRound: () => {
    const { currentRound, groupMatchday, matches, standings, groups } = get();

    if (currentRound === 'group_stage') {
      if (groupMatchday < 3) {
        set({ groupMatchday: groupMatchday + 1 });
      } else {
        // Group stage finished! Establish Round of 32
        // Get top 2 teams from each group
        const qualified24: string[] = [];
        const thirdPlacedTeams: GroupTeamStats[] = [];

        for (const g of GROUP_NAMES) {
          const table = standings[g];
          qualified24.push(table[0].teamId);
          qualified24.push(table[1].teamId);
          thirdPlacedTeams.push(table[2]);
        }

        // Sort third placed teams to find top 8
        thirdPlacedTeams.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
          if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
          const rateA = TEAMS.find(t => t.id === a.teamId)?.overallRating || 0;
          const rateB = TEAMS.find(t => t.id === b.teamId)?.overallRating || 0;
          return rateB - rateA;
        });

        const qualified8Thirds = thirdPlacedTeams.slice(0, 8).map(s => s.teamId);

        // Map qualified teams into Round of 32 matchups
        // Winners: W_A to W_L
        // Runners-up: R_A to R_L
        // Thirds: T_1 to T_8
        const W = (g: string) => standings[g][0].teamId;
        const R = (g: string) => standings[g][1].teamId;
        const T = qualified8Thirds;

        const koMatches: Omit<TournamentMatch, 'isSimulated'>[] = [
          { id: 'r32_m1', round: 'r32', teamAId: W('A'), teamBId: T[0] },
          { id: 'r32_m2', round: 'r32', teamAId: W('B'), teamBId: T[1] },
          { id: 'r32_m3', round: 'r32', teamAId: W('C'), teamBId: T[2] },
          { id: 'r32_m4', round: 'r32', teamAId: W('D'), teamBId: T[3] },
          { id: 'r32_m5', round: 'r32', teamAId: W('E'), teamBId: T[4] },
          { id: 'r32_m6', round: 'r32', teamAId: W('F'), teamBId: T[5] },
          { id: 'r32_m7', round: 'r32', teamAId: W('G'), teamBId: T[6] },
          { id: 'r32_m8', round: 'r32', teamAId: W('H'), teamBId: T[7] },
          { id: 'r32_m9', round: 'r32', teamAId: W('I'), teamBId: R('A') },
          { id: 'r32_m10', round: 'r32', teamAId: W('J'), teamBId: R('B') },
          { id: 'r32_m11', round: 'r32', teamAId: W('K'), teamBId: R('C') },
          { id: 'r32_m12', round: 'r32', teamAId: W('L'), teamBId: R('D') },
          { id: 'r32_m13', round: 'r32', teamAId: R('E'), teamBId: R('G') },
          { id: 'r32_m14', round: 'r32', teamAId: R('F'), teamBId: R('H') },
          { id: 'r32_m15', round: 'r32', teamAId: R('I'), teamBId: R('K') },
          { id: 'r32_m16', round: 'r32', teamAId: R('J'), teamBId: R('L') },
        ];

        set({
          currentRound: 'r32',
          matches: [...matches, ...koMatches.map(m => ({ ...m, isSimulated: false }))]
        });
      }
    } else {
      // Knockout stages progression: r32 -> r16 -> qf -> sf -> final -> ended
      const roundFlow: Record<string, { next: TournamentRound; matchCount: number; keyPrefix: string }> = {
        r32: { next: 'r16', matchCount: 8, keyPrefix: 'r16' },
        r16: { next: 'qf', matchCount: 4, keyPrefix: 'qf' },
        qf: { next: 'sf', matchCount: 2, keyPrefix: 'sf' },
        sf: { next: 'final', matchCount: 1, keyPrefix: 'final' },
      };

      if (currentRound === 'final') {
        set({ currentRound: 'ended' });
        return;
      }

      const flow = roundFlow[currentRound];
      if (!flow) return;

      const activeRoundMatches = matches.filter(m => m.round === currentRound);
      const nextRoundMatches: TournamentMatch[] = [];

      for (let i = 0; i < flow.matchCount; i++) {
        const matchA = activeRoundMatches[i * 2];
        const matchB = activeRoundMatches[i * 2 + 1];
        
        nextRoundMatches.push({
          id: `${flow.keyPrefix}_m${i + 1}`,
          round: flow.next,
          teamAId: matchA.winnerId || matchA.teamAId,
          teamBId: matchB.winnerId || matchB.teamBId,
          isSimulated: false,
        });
      }

      set({
        currentRound: flow.next,
        matches: [...matches, ...nextRoundMatches],
      });
    }
  },

  resetTournament: () => {
    set({
      mode: 'menu',
      tournamentStep: 'setup',
      userTeamIds: [],
      pots: [],
      groups: {},
      remainingPots: [],
      drawHistory: [],
      currentPotIdx: 0,
      currentGroupIdx: 0,
      standings: {},
      matches: [],
      currentRound: 'group_stage',
      groupMatchday: 1,
      activeTournamentMatchId: null,
    });
  },
}));
