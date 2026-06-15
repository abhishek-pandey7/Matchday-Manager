export type Position =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'LWB'
  | 'RWB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LM'
  | 'RM'
  | 'LW'
  | 'RW'
  | 'CF'
  | 'ST';

export interface Player {
  id: string;
  name: string;
  position: Position;
  rating: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  stamina: number;
  age: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  continent: string;
  flag: string;
  players: Player[];
  attackRating: number;
  midfieldRating: number;
  defenseRating: number;
  overallRating: number;
}

export type FormationType =
  | '4-4-2'
  | '4-3-3'
  | '4-2-3-1'
  | '3-5-2'
  | '3-4-3'
  | '5-3-2'
  | '5-4-1'
  | '4-1-4-1';

export interface TacticalSettings {
  pressingIntensity: number;
  tempo: number;
  width: number;
  defensiveLine: number;
  mentality: 'defensive' | 'cautious' | 'balanced' | 'attacking' | 'very_attacking';
}

export interface Substitution {
  id: string;
  playerOutId: string;
  playerInId: string;
  minute: number;
  executed: boolean;
}

export interface Lineup {
  formation: FormationType;
  starting11: string[];
  subs: string[];
  substitutions: Substitution[];
  tactics: TacticalSettings;
}

export type MatchEventType =
  | 'goal'
  | 'shot_on_target'
  | 'shot_off_target'
  | 'corner'
  | 'foul'
  | 'yellow_card'
  | 'red_card'
  | 'offside'
  | 'pass_sequence'
  | 'substitution'
  | 'injury'
  | 'half_time'
  | 'full_time'
  | 'kick_off'
  | 'penalty_shootout_start'
  | 'penalty_shootout_kick'
  | 'penalty_shootout_finish';

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  teamId: string;
  playerId?: string;
  secondaryPlayerId?: string;
  description: string;
  x: number;
  y: number;
}

export interface PlayerPosition {
  playerId: string;
  baseX: number;
  baseY: number;
  currentX: number;
  currentY: number;
  hasBall: boolean;
}

export interface MatchState {
  minute: number;
  score: [number, number];
  possession: [number, number];
  shots: [number, number];
  shotsOnTarget: [number, number];
  corners: [number, number];
  fouls: [number, number];
  yellowCards: [number, number];
  redCards: [number, number];
  passes: [number, number];
  passAccuracy: [number, number];
  ballX: number;
  ballY: number;
  teamAPositions: PlayerPosition[];
  teamBPositions: PlayerPosition[];
  events: MatchEvent[];
  isPlaying: boolean;
  isFinished: boolean;
  currentPhase: 'first_half' | 'half_time' | 'second_half' | 'full_time' | 'extra_time_first' | 'extra_time_half' | 'extra_time_second' | 'extra_time_finished' | 'penalty_shootout';
  ballHolderTeamId: string;
  shootoutScore?: [number, number];
}

export interface MatchConfig {
  teamA: Team;
  teamB: Team;
  lineupA: Lineup;
  lineupB: Lineup;
  isPreMatch: boolean;
}

export interface SimulationResult {
  events: MatchEvent[];
  finalScore: [number, number];
  finalStats: Omit<MatchState, 'teamAPositions' | 'teamBPositions' | 'isPlaying' | 'isFinished'>;
  predictedScoreline: [number, number];
  winProbability: [number, number, number];
}
