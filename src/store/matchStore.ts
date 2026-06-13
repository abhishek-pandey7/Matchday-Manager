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
import { simulateMatch, predictMatch, generateAnimationFrames } from '@/lib/simulation/engine';

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

  // Simulation
  matchResult: MatchState | null;
  animationFrames: MatchState[];
  currentFrame: number;
  isAnimating: boolean;
  animationSpeed: number;
  prediction: { predictedScore: [number, number]; winProbability: [number, number, number] } | null;

  startSimulation: () => void;
  playAnimation: () => void;
  pauseAnimation: () => void;
  setFrame: (frame: number) => void;
  setAnimationSpeed: (speed: number) => void;

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

  teamAId: 'argentina',
  teamBId: 'france',
  teams: TEAMS,

  setTeamA: (id) => {
    const team = TEAMS.find(t => t.id === id);
    if (team) set({ teamAId: id, lineupA: createDefaultLineup(team) });
  },
  setTeamB: (id) => {
    const team = TEAMS.find(t => t.id === id);
    if (team) set({ teamBId: id, lineupB: createDefaultLineup(team) });
  },

  lineupA: createDefaultLineup(TEAMS[0]),
  lineupB: createDefaultLineup(TEAMS[1]),

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

  matchResult: null,
  animationFrames: [],
  currentFrame: 0,
  isAnimating: false,
  animationSpeed: 5,
  prediction: null,
  eventLog: [],
  filteredEvents: [],

  startSimulation: () => {
    const state = get();
    const teamA = TEAMS.find(t => t.id === state.teamAId)!;
    const teamB = TEAMS.find(t => t.id === state.teamBId)!;

    // Set step first so user sees we're loading, then compute
    set({ step: 'simulation', matchResult: null, animationFrames: [], prediction: null });

    // Use setTimeout to allow React to render the loading state before heavy computation
    setTimeout(() => {
      const result = simulateMatch(teamA, teamB, state.lineupA, state.lineupB);
      const frames = generateAnimationFrames(teamA, teamB, state.lineupA, state.lineupB);
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
