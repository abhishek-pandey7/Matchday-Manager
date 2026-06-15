import { create } from 'zustand';
import {
  Team,
  Lineup,
  FormationType,
  TacticalSettings,
  Substitution,
  MatchState,
  MatchEvent,
} from '@/lib/simulation/types';
import { TEAMS } from '@/lib/simulation/data';
import { getAutoLineup } from '@/lib/simulation/formations';
import { simulateMatch, predictMatch, generateAnimationFrames, applyLiveSubstitution } from '@/lib/simulation/engine';

type AppStep = 'setup' | 'tactics' | 'simulation';

interface CoachStore {
  // App state
  step: AppStep;
  setStep: (step: AppStep) => void;

  // Team selection
  teamAId: string;
  teamBId: string;
  setTeamA: (id: string) => void;
  setTeamB: (id: string) => void;
  teams: Team[];

  // Lineups
  lineupA: Lineup;
  lineupB: Lineup;
  setFormation: (team: 'A' | 'B', formation: FormationType) => void;
  setTactics: (team: 'A' | 'B', tactics: Partial<TacticalSettings>) => void;
  addSubstitution: (team: 'A' | 'B', sub: Substitution) => void;
  removeSubstitution: (team: 'A' | 'B', subId: string) => void;
  autoFillLineup: (team: 'A' | 'B') => void;
  swapPlayerIn: (team: 'A' | 'B', slotIndex: number, playerId: string) => void;
  swapPlayerOut: (team: 'A' | 'B', slotIndex: number) => void;
  swapPlayers: (team: 'A' | 'B', slotIndex1: number, slotIndex2: number) => void;

  // Simulation
  matchResult: MatchState | null;
  animationFrames: MatchState[];
  currentFrame: number;
  isAnimating: boolean;
  animationSpeed: number;
  simulationSeed: number;
  prediction: { predictedScore: [number, number]; winProbability: [number, number, number] } | null;

  startSimulation: () => void;
  playAnimation: () => void;
  pauseAnimation: () => void;
  setFrame: (frame: number) => void;
  setAnimationSpeed: (speed: number) => void;

  // Live substitution
  liveSub: (team: 'A' | 'B', playerOutId: string, playerInId: string) => void;

  // Event log
  eventLog: MatchEvent[];
  filteredEvents: MatchEvent[];

  resetMatch: () => void;
}

const defaultTactics: TacticalSettings = {
  pressingIntensity: 50,
  tempo: 50,
  width: 50,
  defensiveLine: 50,
  mentality: 'balanced',
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

export const useCoachStore = create<CoachStore>((set, get) => ({
  step: 'setup',
  setStep: (step) => set({ step }),

  teamAId: '',
  teamBId: '',
  teams: TEAMS,

  setTeamA: (id) => {
    if (!id) {
      set({ teamAId: '', lineupA: { formation: '4-3-3', starting11: [], subs: [], substitutions: [], tactics: { ...defaultTactics } } });
      return;
    }
    const team = TEAMS.find(t => t.id === id);
    if (team) {
      set({ teamAId: id, lineupA: createDefaultLineup(team) });
    }
  },
  setTeamB: (id) => {
    if (!id) {
      set({ teamBId: '', lineupB: { formation: '4-3-3', starting11: [], subs: [], substitutions: [], tactics: { ...defaultTactics } } });
      return;
    }
    const team = TEAMS.find(t => t.id === id);
    if (team) {
      set({ teamBId: id, lineupB: createDefaultLineup(team) });
    }
  },

  lineupA: {
    formation: '4-3-3',
    starting11: [],
    subs: [],
    substitutions: [],
    tactics: { ...defaultTactics },
  },
  lineupB: {
    formation: '4-3-3',
    starting11: [],
    subs: [],
    substitutions: [],
    tactics: { ...defaultTactics },
  },

  setFormation: (team, formation) => {
    const state = get();
    const teamData = team === 'A'
      ? TEAMS.find(t => t.id === state.teamAId)!
      : TEAMS.find(t => t.id === state.teamBId)!;

    const currentLineup = team === 'A' ? state.lineupA : state.lineupB;
    const newStarting11 = getAutoLineup(teamData.players, formation);

    const subs = teamData.players
      .filter(p => !newStarting11.includes(p.id))
      .map(p => p.id);

    const newLineup = { ...currentLineup, formation, starting11: newStarting11, subs };

    set(team === 'A' ? { lineupA: newLineup } : { lineupB: newLineup });
  },

  setTactics: (team, tactics) => {
    const state = get();
    const currentLineup = team === 'A' ? state.lineupA : state.lineupB;
    const newLineup = { ...currentLineup, tactics: { ...currentLineup.tactics, ...tactics } };
    set(team === 'A' ? { lineupA: newLineup } : { lineupB: newLineup });
  },

  addSubstitution: (team, sub) => {
    const state = get();
    const currentLineup = team === 'A' ? state.lineupA : state.lineupB;
    const newLineup = {
      ...currentLineup,
      substitutions: [...currentLineup.substitutions, sub],
    };
    set(team === 'A' ? { lineupA: newLineup } : { lineupB: newLineup });
  },

  removeSubstitution: (team, subId) => {
    const state = get();
    const currentLineup = team === 'A' ? state.lineupA : state.lineupB;
    const newLineup = {
      ...currentLineup,
      substitutions: currentLineup.substitutions.filter(s => s.id !== subId),
    };
    set(team === 'A' ? { lineupA: newLineup } : { lineupB: newLineup });
  },

  autoFillLineup: (team) => {
    const state = get();
    const teamData = team === 'A'
      ? TEAMS.find(t => t.id === state.teamAId)!
      : TEAMS.find(t => t.id === state.teamBId)!;
    const currentLineup = team === 'A' ? state.lineupA : state.lineupB;
    const newStarting11 = getAutoLineup(teamData.players, currentLineup.formation);
    const subs = teamData.players
      .filter(p => !newStarting11.includes(p.id))
      .map(p => p.id);
    const newLineup = { ...currentLineup, starting11: newStarting11, subs };
    set(team === 'A' ? { lineupA: newLineup } : { lineupB: newLineup });
  },

  // Swap a bench player into a specific starting slot
  swapPlayerIn: (team, slotIndex, playerId) => {
    const state = get();
    const currentLineup = team === 'A' ? { ...state.lineupA } : { ...state.lineupB };
    const starting11 = [...currentLineup.starting11];
    const subs = [...currentLineup.subs];

    if (slotIndex < 0 || slotIndex >= starting11.length) return;
    const currentPlayerId = starting11[slotIndex];

    // Remove incoming player from bench
    const benchIdx = subs.indexOf(playerId);
    if (benchIdx !== -1) subs.splice(benchIdx, 1);
    // Move current player to bench
    if (currentPlayerId) subs.push(currentPlayerId);
    // Place new player in starting slot
    starting11[slotIndex] = playerId;

    const newLineup = { ...currentLineup, starting11, subs };
    set(team === 'A' ? { lineupA: newLineup } : { lineupB: newLineup });
  },

  // Remove a player from starting slot to bench
  swapPlayerOut: (team, slotIndex) => {
    const state = get();
    const currentLineup = team === 'A' ? { ...state.lineupA } : { ...state.lineupB };
    const starting11 = [...currentLineup.starting11];
    const subs = [...currentLineup.subs];

    if (slotIndex < 0 || slotIndex >= starting11.length) return;
    const removedPlayerId = starting11[slotIndex];
    if (removedPlayerId) subs.push(removedPlayerId);
    starting11[slotIndex] = '';

    const newLineup = { ...currentLineup, starting11, subs };
    set(team === 'A' ? { lineupA: newLineup } : { lineupB: newLineup });
  },

  // Swap two players between starting slots
  swapPlayers: (team, slotIndex1, slotIndex2) => {
    const state = get();
    const currentLineup = team === 'A' ? { ...state.lineupA } : { ...state.lineupB };
    const starting11 = [...currentLineup.starting11];

    const temp = starting11[slotIndex1];
    starting11[slotIndex1] = starting11[slotIndex2];
    starting11[slotIndex2] = temp;

    const newLineup = { ...currentLineup, starting11 };
    set(team === 'A' ? { lineupA: newLineup } : { lineupB: newLineup });
  },

  matchResult: null,
  animationFrames: [],
  currentFrame: 0,
  isAnimating: false,
  animationSpeed: 5,
  simulationSeed: Date.now(),
  prediction: null,
  eventLog: [],
  filteredEvents: [],

  startSimulation: () => {
    const state = get();
    const teamA = TEAMS.find(t => t.id === state.teamAId)!;
    const teamB = TEAMS.find(t => t.id === state.teamBId)!;
    const seed = Date.now();

    // Set step first so user sees we're loading, then compute
    set({ step: 'simulation', matchResult: null, animationFrames: [], prediction: null, simulationSeed: seed });

    // Use setTimeout to allow React to render the loading state before heavy computation
    setTimeout(() => {
      const result = simulateMatch(teamA, teamB, state.lineupA, state.lineupB, seed);
      const frames = generateAnimationFrames(teamA, teamB, state.lineupA, state.lineupB, seed);
      const prediction = predictMatch(teamA, teamB, state.lineupA, state.lineupB, 100);

      set({
        matchResult: result,
        animationFrames: frames,
        currentFrame: 0,
        eventLog: result.events,
        filteredEvents: result.events.filter(e =>
          ['goal', 'shot_on_target', 'corner', 'yellow_card', 'red_card', 'substitution', 'half_time', 'full_time', 'kick_off'].includes(e.type)
        ),
        prediction,
        isAnimating: false,
      });
    }, 50);
  },

  playAnimation: () => set({ isAnimating: true }),
  pauseAnimation: () => set({ isAnimating: false }),
  setFrame: (frame) => set({ currentFrame: Math.max(0, Math.min(90, frame)) }),
  setAnimationSpeed: (speed) => set({ animationSpeed: speed }),

  // Live substitution during animation
  liveSub: (team, playerOutId, playerInId) => {
    const state = get();
    const teamA = TEAMS.find(t => t.id === state.teamAId)!;
    const teamB = TEAMS.find(t => t.id === state.teamBId)!;

    const newFrames = applyLiveSubstitution(
      teamA, teamB,
      state.lineupA, state.lineupB,
      team, playerOutId, playerInId,
      state.currentFrame,
      state.animationFrames,
      state.simulationSeed
    );

    // Update the lineup in the store too
    const lineup = team === 'A' ? { ...state.lineupA } : { ...state.lineupB };
    const updatedStarting11 = [...lineup.starting11];
    const idx = updatedStarting11.indexOf(playerOutId);
    if (idx !== -1) {
      updatedStarting11[idx] = playerInId;
      const updatedSubs = [...lineup.subs];
      const subIdx = updatedSubs.indexOf(playerInId);
      if (subIdx !== -1) {
        updatedSubs[subIdx] = playerOutId;
      }
      lineup.starting11 = updatedStarting11;
      lineup.subs = updatedSubs;
      lineup.substitutions = [...lineup.substitutions, {
        id: `live_sub_${Date.now()}`,
        playerOutId,
        playerInId,
        minute: state.currentFrame,
        executed: true,
      }];
    }

    // Rebuild event log from new frames
    const allEvents: MatchEvent[] = [];
    for (const frame of newFrames) {
      allEvents.push(...frame.events);
    }
    const filtered = allEvents.filter(e =>
      ['goal', 'shot_on_target', 'corner', 'yellow_card', 'red_card', 'substitution', 'half_time', 'full_time', 'kick_off'].includes(e.type)
    );

    set({
      animationFrames: newFrames,
      lineupA: team === 'A' ? lineup : state.lineupA,
      lineupB: team === 'B' ? lineup : state.lineupB,
      eventLog: allEvents,
      filteredEvents: filtered,
    });
  },

  resetMatch: () => set({
    step: 'setup',
    matchResult: null,
    animationFrames: [],
    currentFrame: 0,
    isAnimating: false,
    prediction: null,
    eventLog: [],
    filteredEvents: [],
  }),
}));
