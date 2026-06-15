import {
  Team,
  Lineup,
  TacticalSettings,
  MatchEvent,
  MatchState,
  PlayerPosition,
  FormationType,
  Player,
  Position,
} from './types';
import { FORMATIONS, mirrorPosition } from './formations';

// ─── Seeded Random ──────────────────────────────────────────────────
class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

// ─── Matchup System ─────────────────────────────────────────────────
interface PlayerMatchup {
  attackerId: string;
  defenderId: string;
  attackerRating: number;
  defenderRating: number;
  advantage: number; // positive = attacker dominates
  side: 'left' | 'right' | 'center'; // which side of pitch
  attackerPosition: Position;
  defenderPosition: Position;
}

interface TeamMatchupAnalysis {
  leftAdvantage: number;   // Team A's left wing advantage
  rightAdvantage: number;  // Team A's right wing advantage
  centerAdvantage: number; // Team A's center advantage
  matchups: PlayerMatchup[];
  overallAdvantage: number; // -1 to 1, positive = team A stronger
}

// Position categories for matchup mapping
const ATTACK_POSITIONS: Position[] = ['ST', 'CF', 'LW', 'RW'];
const MID_POSITIONS: Position[] = ['CAM', 'CM', 'CDM', 'LM', 'RM'];
const DEF_POSITIONS: Position[] = ['CB', 'LB', 'RB', 'LWB', 'RWB'];

// Wing matchup mapping: which attacking position faces which defending position
const WING_MATCHUPS: Record<string, Position[]> = {
  'LW': ['RB', 'RWB'],   // Left winger attacks right back
  'LM': ['RB', 'RWB'],
  'RW': ['LB', 'LWB'],   // Right winger attacks left back
  'RM': ['LB', 'LWB'],
  'ST': ['CB'],           // Striker vs center back
  'CF': ['CB'],
  'CAM': ['CDM'],         // CAM vs CDM
  'CM': ['CM', 'CDM'],    // CM vs CM/CDM
  'CDM': ['CM', 'CAM'],   // CDM vs CM/CAM
};

function calculateMatchups(
  teamA: Team,
  teamB: Team,
  lineupA: Lineup,
  lineupB: Lineup,
  fatigue: Map<string, number>
): TeamMatchupAnalysis {
  const matchups: PlayerMatchup[] = [];

  // Get starting players with fatigue-adjusted ratings
  const getPlayers = (team: Team, lineup: Lineup) => {
    return lineup.starting11
      .map(id => team.players.find(p => p.id === id))
      .filter((p): p is Player => !!p);
  };

  const playersA = getPlayers(teamA, lineupA);
  const playersB = getPlayers(teamB, lineupB);

  const getEffectiveRating = (player: Player) => {
    const fatigueFactor = 1 - (fatigue.get(player.id) || 0) * 0.003;
    return player.rating * fatigueFactor;
  };

  // Helper to find best matching defender
  const findDefender = (attackers: Player[], defenders: Player[], attackerPos: Position): Player | null => {
    const targetPositions = WING_MATCHUPS[attackerPos];
    if (!targetPositions) return defenders[0] || null;

    // Find defender whose position matches the target
    const matchingDefender = defenders.find(d => targetPositions.includes(d.position));
    return matchingDefender || defenders[0] || null;
  };

  // Calculate wing matchups
  // Left wing: Team A's LW/LM vs Team B's RB/RWB
  const leftWingAttackersA = playersA.filter(p => ['LW', 'LM'].includes(p.position));
  const rightWingDefendersB = playersB.filter(p => ['RB', 'RWB'].includes(p.position));

  for (const attacker of leftWingAttackersA) {
    const defender = findDefender([attacker], rightWingDefendersB, attacker.position);
    if (defender) {
      const aRating = getEffectiveRating(attacker);
      const dRating = getEffectiveRating(defender);
      const advantage = (aRating - dRating) / 100; // Normalize to -1..1
      matchups.push({
        attackerId: attacker.id,
        defenderId: defender.id,
        attackerRating: aRating,
        defenderRating: dRating,
        advantage,
        side: 'left',
        attackerPosition: attacker.position,
        defenderPosition: defender.position,
      });
    }
  }

  // Right wing: Team A's RW/RM vs Team B's LB/LWB
  const rightWingAttackersA = playersA.filter(p => ['RW', 'RM'].includes(p.position));
  const leftWingDefendersB = playersB.filter(p => ['LB', 'LWB'].includes(p.position));

  for (const attacker of rightWingAttackersA) {
    const defender = findDefender([attacker], leftWingDefendersB, attacker.position);
    if (defender) {
      const aRating = getEffectiveRating(attacker);
      const dRating = getEffectiveRating(defender);
      const advantage = (aRating - dRating) / 100;
      matchups.push({
        attackerId: attacker.id,
        defenderId: defender.id,
        attackerRating: aRating,
        defenderRating: dRating,
        advantage,
        side: 'right',
        attackerPosition: attacker.position,
        defenderPosition: defender.position,
      });
    }
  }

  // Center: Team A's ST/CF vs Team B's CBs
  const centerAttackersA = playersA.filter(p => ['ST', 'CF'].includes(p.position));
  const centerDefendersB = playersB.filter(p => p.position === 'CB');

  for (const attacker of centerAttackersA) {
    // Match against best CB
    const bestCB = centerDefendersB.sort((a, b) => getEffectiveRating(b) - getEffectiveRating(a))[0];
    if (bestCB) {
      const aRating = getEffectiveRating(attacker);
      const dRating = getEffectiveRating(bestCB);
      const advantage = (aRating - dRating) / 100;
      matchups.push({
        attackerId: attacker.id,
        defenderId: bestCB.id,
        attackerRating: aRating,
        defenderRating: dRating,
        advantage,
        side: 'center',
        attackerPosition: attacker.position,
        defenderPosition: bestCB.position,
      });
    }
  }

  // Midfield battle: CAM vs CDM, CM vs CM
  const midAttackersA = playersA.filter(p => ['CAM', 'CM'].includes(p.position));
  const midDefendersB = playersB.filter(p => ['CDM', 'CM'].includes(p.position));

  for (const attacker of midAttackersA) {
    const targetPositions = WING_MATCHUPS[attacker.position] || ['CM', 'CDM'];
    const defender = midDefendersB.find(d => targetPositions.includes(d.position)) || midDefendersB[0];
    if (defender) {
      const aRating = getEffectiveRating(attacker);
      const dRating = getEffectiveRating(defender);
      const advantage = (aRating - dRating) / 100;
      matchups.push({
        attackerId: attacker.id,
        defenderId: defender.id,
        attackerRating: aRating,
        defenderRating: dRating,
        advantage,
        side: 'center',
        attackerPosition: attacker.position,
        defenderPosition: defender.position,
      });
    }
  }

  // Also do reverse matchups (Team B attacking vs Team A defending)
  // Left wing: Team B's LW/LM vs Team A's RB/RWB
  const leftWingAttackersB = playersB.filter(p => ['LW', 'LM'].includes(p.position));
  const rightWingDefendersA = playersA.filter(p => ['RB', 'RWB'].includes(p.position));

  for (const attacker of leftWingAttackersB) {
    const defender = findDefender([attacker], rightWingDefendersA, attacker.position);
    if (defender) {
      const aRating = getEffectiveRating(attacker);
      const dRating = getEffectiveRating(defender);
      const advantage = (dRating - aRating) / 100; // Negative because this is B attacking, we store from A's perspective
      matchups.push({
        attackerId: attacker.id,
        defenderId: defender.id,
        attackerRating: aRating,
        defenderRating: dRating,
        advantage, // negative means B has the advantage here
        side: 'right', // B's left wing = A's right side
        attackerPosition: attacker.position,
        defenderPosition: defender.position,
      });
    }
  }

  // Right wing: Team B's RW/RM vs Team A's LB/LWB
  const rightWingAttackersB = playersB.filter(p => ['RW', 'RM'].includes(p.position));
  const leftWingDefendersA = playersA.filter(p => ['LB', 'LWB'].includes(p.position));

  for (const attacker of rightWingAttackersB) {
    const defender = findDefender([attacker], leftWingDefendersA, attacker.position);
    if (defender) {
      const aRating = getEffectiveRating(attacker);
      const dRating = getEffectiveRating(defender);
      const advantage = (dRating - aRating) / 100;
      matchups.push({
        attackerId: attacker.id,
        defenderId: defender.id,
        attackerRating: aRating,
        defenderRating: dRating,
        advantage,
        side: 'left', // B's right wing = A's left side
        attackerPosition: attacker.position,
        defenderPosition: defender.position,
      });
    }
  }

  // Calculate aggregate advantages
  const leftMatchups = matchups.filter(m => m.side === 'left');
  const rightMatchups = matchups.filter(m => m.side === 'right');
  const centerMatchups = matchups.filter(m => m.side === 'center');

  const avgAdvantage = (ms: PlayerMatchup[]) =>
    ms.length > 0 ? ms.reduce((s, m) => s + m.advantage, 0) / ms.length : 0;

  const leftAdvantage = avgAdvantage(leftMatchups);
  const rightAdvantage = avgAdvantage(rightMatchups);
  const centerAdvantage = avgAdvantage(centerMatchups);
  const overallAdvantage = (leftAdvantage + rightAdvantage + centerAdvantage) / 3;

  return {
    leftAdvantage,
    rightAdvantage,
    centerAdvantage,
    matchups,
    overallAdvantage,
  };
}

// ─── Team Strength Calculation ──────────────────────────────────────
function getMentalityModifier(mentality: TacticalSettings['mentality']): {
  attackMod: number;
  defenseMod: number;
} {
  switch (mentality) {
    case 'defensive': return { attackMod: -0.2, defenseMod: 0.25 };
    case 'cautious': return { attackMod: -0.1, defenseMod: 0.12 };
    case 'balanced': return { attackMod: 0, defenseMod: 0 };
    case 'attacking': return { attackMod: 0.15, defenseMod: -0.1 };
    case 'very_attacking': return { attackMod: 0.3, defenseMod: -0.2 };
  }
}

function getFormationAttackBonus(formation: FormationType): number {
  const attackingFormations: Record<FormationType, number> = {
    '3-4-3': 0.12,
    '4-3-3': 0.08,
    '4-2-3-1': 0.06,
    '4-4-2': 0,
    '4-1-4-1': -0.02,
    '3-5-2': 0.02,
    '5-3-2': -0.08,
    '5-4-1': -0.12,
  };
  return attackingFormations[formation];
}

function calculateTeamStrength(
  team: Team,
  lineup: Lineup,
  fatigue: Map<string, number>
): { attack: number; midfield: number; defense: number; overall: number } {
  const startingPlayers = lineup.starting11
    .map(id => team.players.find(p => p.id === id))
    .filter(Boolean) as Player[];

  if (startingPlayers.length === 0) {
    return { attack: 50, midfield: 50, defense: 50, overall: 50 };
  }

  let attackSum = 0, midSum = 0, defSum = 0;
  let attackCount = 0, midCount = 0, defCount = 0;

  for (const player of startingPlayers) {
    const fatigueFactor = 1 - (fatigue.get(player.id) || 0) * 0.003;
    const effectiveRating = player.rating * fatigueFactor;

    if (ATTACK_POSITIONS.includes(player.position)) {
      attackSum += effectiveRating;
      attackCount++;
    } else if (MID_POSITIONS.includes(player.position)) {
      midSum += effectiveRating;
      midCount++;
    } else {
      defSum += effectiveRating;
      defCount++;
    }
  }

  const attack = attackCount > 0 ? attackSum / attackCount : team.attackRating;
  const midfield = midCount > 0 ? midSum / midCount : team.midfieldRating;
  const defense = defCount > 0 ? defSum / defCount : team.defenseRating;
  const overall = (attack * 0.35 + midfield * 0.35 + defense * 0.3);

  return { attack, midfield, defense, overall };
}

// ─── Goal Expectancy with Rating-Based Dominance ────────────────────
function calculateGoalExpectancy(
  attackStrength: number,
  oppositionDefense: number,
  midfieldDiff: number,
  tactics: TacticalSettings,
  formation: FormationType,
  isHome: boolean,
  overallRatingDiff: number // New: overall team quality difference
): number {
  const baseRate = 1.35;

  // Enhanced rating-based scaling: bigger gaps = more dominant
  const attackRatio = attackStrength / 80;
  const defenseRatio = oppositionDefense / 80;

  // Rating dominance multiplier: if a team is significantly better, they score more
  // Exponential effect makes gaps more decisive
  const ratingDominance = Math.pow(1.02, overallRatingDiff);

  const formationMod = getFormationAttackBonus(formation);
  const mentalityMod = getMentalityModifier(tactics.mentality);
  const pressingMod = (tactics.pressingIntensity - 50) / 500;
  const tempoMod = (tactics.tempo - 50) / 800;
  const homeMod = isHome ? 0.12 : -0.05;
  const midMod = midfieldDiff / 500;

  const expectancy =
    baseRate *
    attackRatio *
    (2 - defenseRatio) *
    ratingDominance *
    (1 + formationMod + mentalityMod.attackMod + pressingMod + tempoMod + homeMod + midMod);

  return Math.max(0.15, Math.min(4.0, expectancy));
}

function poissonRandom(lambda: number, rng: SeededRandom): number {
  let L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > L);
  return k - 1;
}

// ─── Substitution Execution ─────────────────────────────────────────
function executeSubstitutions(
  lineup: Lineup,
  minute: number,
  team: Team,
  fatigue: Map<string, number>
): { events: MatchEvent[]; updatedLineup: Lineup } {
  const events: MatchEvent[] = [];
  const updatedLineup = { ...lineup, starting11: [...lineup.starting11], substitutions: [...lineup.substitutions] };

  for (const sub of updatedLineup.substitutions) {
    if (!sub.executed && sub.minute <= minute) {
      const idx = updatedLineup.starting11.indexOf(sub.playerOutId);
      if (idx !== -1) {
        updatedLineup.starting11[idx] = sub.playerInId;
        sub.executed = true;

        const playerOut = team.players.find(p => p.id === sub.playerOutId);
        const playerIn = team.players.find(p => p.id === sub.playerInId);

        events.push({
          minute,
          type: 'substitution',
          teamId: team.id,
          playerId: sub.playerOutId,
          secondaryPlayerId: sub.playerInId,
          description: `Substitution: ${playerOut?.name || sub.playerOutId} ➜ ${playerIn?.name || sub.playerInId}`,
          x: 5,
          y: 50,
        });

        fatigue.set(sub.playerInId, 0);
      }
    }
  }

  return { events, updatedLineup };
}

// ─── Side-Based Attack Weighting ────────────────────────────────────
// Uses matchup data to weight which side attacks go through
function chooseAttackSide(
  isTeamA: boolean,
  matchupAnalysis: TeamMatchupAnalysis,
  rng: SeededRandom
): 'left' | 'right' | 'center' {
  // Base weights
  let leftWeight = 30;
  let rightWeight = 30;
  let centerWeight = 40;

  if (isTeamA) {
    // Team A attacks: positive advantage = A's attackers beat B's defenders
    leftWeight += matchupAnalysis.leftAdvantage * 150;
    rightWeight += matchupAnalysis.rightAdvantage * 150;
    centerWeight += matchupAnalysis.centerAdvantage * 150;
  } else {
    // Team B attacks: negative advantage (from A's perspective) means B has the edge
    leftWeight -= matchupAnalysis.leftAdvantage * 150;
    rightWeight -= matchupAnalysis.rightAdvantage * 150;
    centerWeight -= matchupAnalysis.centerAdvantage * 150;
  }

  // Ensure minimum weights
  leftWeight = Math.max(10, leftWeight);
  rightWeight = Math.max(10, rightWeight);
  centerWeight = Math.max(10, centerWeight);

  const total = leftWeight + rightWeight + centerWeight;
  const roll = rng.next() * total;

  if (roll < leftWeight) return 'left';
  if (roll < leftWeight + rightWeight) return 'right';
  return 'center';
}

// Get matchup advantage for a specific side and team
function getSideAdvantage(
  isTeamA: boolean,
  side: 'left' | 'right' | 'center',
  matchupAnalysis: TeamMatchupAnalysis
): number {
  let adv: number;
  switch (side) {
    case 'left': adv = matchupAnalysis.leftAdvantage; break;
    case 'right': adv = matchupAnalysis.rightAdvantage; break;
    case 'center': adv = matchupAnalysis.centerAdvantage; break;
  }
  return isTeamA ? adv : -adv;
}

// ─── Player Selection Based on Position and Side ────────────────────
function selectPlayerForAction(
  lineup: Lineup,
  team: Team,
  side: 'left' | 'right' | 'center',
  actionType: 'attack' | 'defend' | 'midfield',
  rng: SeededRandom,
  fatigue: Map<string, number>
): Player | null {
  const players = lineup.starting11
    .map(id => team.players.find(p => p.id === id))
    .filter((p): p is Player => !!p);

  // Score each player based on relevance to the action
  const scored = players.map(player => {
    let score = 0;
    const fatigueFactor = 1 - (fatigue.get(player.id) || 0) * 0.003;
    const effectiveRating = player.rating * fatigueFactor;

    // Position relevance
    if (actionType === 'attack') {
      if (side === 'left' && ['LW', 'LM', 'ST', 'CF'].includes(player.position)) score += 30;
      if (side === 'right' && ['RW', 'RM', 'ST', 'CF'].includes(player.position)) score += 30;
      if (side === 'center' && ['ST', 'CF', 'CAM'].includes(player.position)) score += 30;
      if (ATTACK_POSITIONS.includes(player.position)) score += 20;
      if (MID_POSITIONS.includes(player.position)) score += 10;
    } else if (actionType === 'defend') {
      if (DEF_POSITIONS.includes(player.position)) score += 20;
      if (player.position === 'GK') score += 15;
      if (['CDM'].includes(player.position)) score += 15;
    } else {
      if (MID_POSITIONS.includes(player.position)) score += 25;
      if (['CDM'].includes(player.position)) score += 15;
    }

    // Rating bonus
    score += (effectiveRating - 60) * 0.5;

    return { player, score: Math.max(0, score) };
  });

  // Weighted random selection
  const totalScore = scored.reduce((s, p) => s + p.score, 0);
  if (totalScore === 0) return players[0] || null;

  let roll = rng.next() * totalScore;
  for (const { player, score } of scored) {
    roll -= score;
    if (roll <= 0) return player;
  }

  return players[0] || null;
}

// ─── Main Simulation ────────────────────────────────────────────────
export function simulateMatch(
  teamA: Team,
  teamB: Team,
  lineupA: Lineup,
  lineupB: Lineup,
  seed: number = Date.now()
): MatchState {
  const rng = new SeededRandom(seed);
  const fatigue = new Map<string, number>();
  const events: MatchEvent[] = [];

  let currentLineupA = { ...lineupA, starting11: [...lineupA.starting11], substitutions: [...lineupA.substitutions] };
  let currentLineupB = { ...lineupB, starting11: [...lineupB.starting11], substitutions: [...lineupB.substitutions] };

  // Initialize fatigue
  [...currentLineupA.starting11, ...currentLineupB.starting11].forEach(id => fatigue.set(id, 0));

  // Calculate team strengths
  const strengthA = calculateTeamStrength(teamA, currentLineupA, fatigue);
  const strengthB = calculateTeamStrength(teamB, currentLineupB, fatigue);

  // Overall rating difference for dominance calculations
  const overallRatingDiff = strengthA.overall - strengthB.overall;

  // Calculate matchups
  const matchupAnalysis = calculateMatchups(teamA, teamB, currentLineupA, currentLineupB, fatigue);

  // Goal expectancy with enhanced rating dominance
  const expA = calculateGoalExpectancy(
    strengthA.attack, strengthB.defense, strengthA.midfield - strengthB.midfield,
    lineupA.tactics, lineupA.formation, true, overallRatingDiff
  );
  const expB = calculateGoalExpectancy(
    strengthB.attack, strengthA.defense, strengthB.midfield - strengthA.midfield,
    lineupB.tactics, lineupB.formation, false, -overallRatingDiff
  );

  const goalsA = poissonRandom(expA, rng);
  const goalsB = poissonRandom(expB, rng);

  // Generate goal minutes
  const goalMinutesA: number[] = [];
  const goalMinutesB: number[] = [];
  for (let i = 0; i < goalsA; i++) {
    goalMinutesA.push(rng.int(1, 90));
  }
  for (let i = 0; i < goalsB; i++) {
    goalMinutesB.push(rng.int(1, 90));
  }
  goalMinutesA.sort((a, b) => a - b);
  goalMinutesB.sort((a, b) => a - b);

  // Possession strength - stronger team dominates more
  const possessionStrength = 0.5 + (strengthA.midfield - strengthB.midfield) / 200;

  // Track stats
  let score: [number, number] = [0, 0];
  let shots: [number, number] = [0, 0];
  let shotsOnTarget: [number, number] = [0, 0];
  let corners: [number, number] = [0, 0];
  let fouls: [number, number] = [0, 0];
  let yellowCards: [number, number] = [0, 0];
  let redCards: [number, number] = [0, 0];
  let passes: [number, number] = [0, 0];
  let possessionCount: [number, number] = [0, 0];

  // Ball tracking
  let ballX = 50, ballY = 50;
  let ballHolderTeamId = rng.chance(possessionStrength) ? teamA.id : teamB.id;

  // Kick off
  events.push({
    minute: 0,
    type: 'kick_off',
    teamId: teamA.id,
    description: 'Kick off! The match begins.',
    x: 50,
    y: 50,
  });

  // ─── Minute-by-Minute Simulation ────────────────────────────────
  for (let minute = 1; minute <= 90; minute++) {
    // Fatigue increases - more for high-tempo teams
    const tempoFactorA = 1 + (lineupA.tactics.tempo - 50) / 500;
    const tempoFactorB = 1 + (lineupB.tactics.tempo - 50) / 500;

    for (const pid of currentLineupA.starting11) {
      fatigue.set(pid, (fatigue.get(pid) || 0) + rng.range(0.3, 0.6) * tempoFactorA);
    }
    for (const pid of currentLineupB.starting11) {
      fatigue.set(pid, (fatigue.get(pid) || 0) + rng.range(0.3, 0.6) * tempoFactorB);
    }

    // Execute substitutions
    const subResultA = executeSubstitutions(currentLineupA, minute, teamA, fatigue);
    const subResultB = executeSubstitutions(currentLineupB, minute, teamB, fatigue);
    events.push(...subResultA.events, ...subResultB.events);
    currentLineupA = subResultA.updatedLineup;
    currentLineupB = subResultB.updatedLineup;

    // Recalculate matchups periodically (every 15 min or after subs)
    let currentMatchupAnalysis = matchupAnalysis;
    if (minute % 15 === 0 || subResultA.events.length > 0 || subResultB.events.length > 0) {
      currentMatchupAnalysis = calculateMatchups(teamA, teamB, currentLineupA, currentLineupB, fatigue);
    }

    // Determine possession - stronger team dominates more
    const currentPossStrength = 0.5 + (calculateTeamStrength(teamA, currentLineupA, fatigue).midfield -
      calculateTeamStrength(teamB, currentLineupB, fatigue).midfield) / 200;
    const isTeamA = rng.chance(currentPossStrength + (lineupA.tactics.tempo - 50) / 400);
    const currentTeam = isTeamA ? teamA : teamB;
    const currentLineup = isTeamA ? currentLineupA : currentLineupB;
    const opponentLineup = isTeamA ? currentLineupB : currentLineupA;
    const teamIdx = isTeamA ? 0 : 1;

    ballHolderTeamId = currentTeam.id;
    possessionCount[teamIdx]++;

    // Choose attack side based on matchups
    const attackSide = chooseAttackSide(isTeamA, currentMatchupAnalysis, rng);
    const sideAdvantage = getSideAdvantage(isTeamA, attackSide, currentMatchupAnalysis);

    // Check if this is a goal minute
    const isGoalMinute = isTeamA ? goalMinutesA.includes(minute) : goalMinutesB.includes(minute);

    if (isGoalMinute) {
      score[teamIdx]++;
      shots[teamIdx]++;
      shotsOnTarget[teamIdx]++;

      // Goal location based on side
      let goalX: number, goalY: number;
      if (attackSide === 'left') {
        goalX = isTeamA ? rng.range(90, 98) : rng.range(2, 10);
        goalY = isTeamA ? rng.range(35, 55) : rng.range(45, 65);
      } else if (attackSide === 'right') {
        goalX = isTeamA ? rng.range(90, 98) : rng.range(2, 10);
        goalY = isTeamA ? rng.range(45, 65) : rng.range(35, 55);
      } else {
        goalX = isTeamA ? rng.range(92, 98) : rng.range(2, 8);
        goalY = rng.range(40, 60);
      }
      ballX = goalX;
      ballY = goalY;

      // Pick goal scorer based on side
      const scorer = selectPlayerForAction(
        currentLineup, currentTeam, attackSide, 'attack', rng, fatigue
      );

      // Pick assist provider
      const assister = selectPlayerForAction(
        currentLineup, currentTeam, attackSide, 'midfield', rng, fatigue
      );

      // Build-up passes leading to goal
      const passCount = rng.int(4, 10);
      for (let p = 0; p < passCount; p++) {
        const passLoc = generatePassLocation(rng, isTeamA, attackSide);
        events.push({
          minute: minute - 0.01 * (passCount - p),
          type: 'pass_sequence',
          teamId: currentTeam.id,
          description: `Passing move by ${currentTeam.name} down the ${attackSide}`,
          x: passLoc.x,
          y: passLoc.y,
        });
        passes[teamIdx]++;
      }

      // Goal event with matchup context
      const matchupDesc = Math.abs(sideAdvantage) > 0.1
        ? ` (${scorer?.name || 'Unknown'} exploited the ${attackSide} side advantage!)`
        : '';

      events.push({
        minute,
        type: 'goal',
        teamId: currentTeam.id,
        playerId: scorer?.id,
        secondaryPlayerId: assister?.id !== scorer?.id ? assister?.id : undefined,
        description: `GOAL! ${scorer?.name || 'Unknown'} scores for ${currentTeam.name}!${matchupDesc} ${score[0]} - ${score[1]}`,
        x: goalX,
        y: goalY,
      });
    } else {
      // Regular play events - influenced by matchups
      // Generate multiple passes per minute for realistic stats (3-7 passes/min)
      const basePassesThisMinute = rng.int(3, 7);
      const possessionBonus = isTeamA
        ? (strengthA.midfield - strengthB.midfield) / 100
        : (strengthB.midfield - strengthA.midfield) / 100;
      const passesThisMinute = Math.max(2, Math.round(basePassesThisMinute + possessionBonus * 2));

      for (let pIdx = 0; pIdx < passesThisMinute; pIdx++) {
        passes[teamIdx]++;
        // Move ball slightly with each pass
        const passLoc = generatePassLocation(rng, isTeamA, attackSide);
        ballX = ballX * 0.7 + passLoc.x * 0.3; // Blend for smoother ball movement
        ballY = ballY * 0.7 + passLoc.y * 0.3;
      }

      // Show a pass event in timeline occasionally
      if (rng.chance(0.25)) {
        const passer = selectPlayerForAction(
          currentLineup, currentTeam, attackSide, 'midfield', rng, fatigue
        );
        events.push({
          minute,
          type: 'pass_sequence',
          teamId: currentTeam.id,
          playerId: passer?.id,
          description: `${passer?.name || currentTeam.name} controls midfield on the ${attackSide} side`,
          x: ballX,
          y: ballY,
        });
      }

      // Side advantage affects event probabilities
      const advantageBoost = sideAdvantage * 0.12;
      const eventRoll = rng.next();

      if (eventRoll < 0.10 + advantageBoost) {
        // Shot on target - higher rated attackers more likely to get shots on target
        shots[teamIdx]++;
        shotsOnTarget[teamIdx]++;

        let shotX: number, shotY: number;
        if (attackSide === 'left') {
          shotX = isTeamA ? rng.range(88, 96) : rng.range(4, 12);
          shotY = isTeamA ? rng.range(30, 55) : rng.range(45, 70);
        } else if (attackSide === 'right') {
          shotX = isTeamA ? rng.range(88, 96) : rng.range(4, 12);
          shotY = isTeamA ? rng.range(45, 70) : rng.range(30, 55);
        } else {
          shotX = isTeamA ? rng.range(88, 96) : rng.range(4, 12);
          shotY = rng.range(35, 65);
        }
        ballX = shotX;
        ballY = shotY;

        const shooter = selectPlayerForAction(
          currentLineup, currentTeam, attackSide, 'attack', rng, fatigue
        );

        // Defender who made the save
        const saver = selectPlayerForAction(
          opponentLineup, isTeamA ? teamB : teamA, attackSide, 'defend', rng, fatigue
        );

        const saveDesc = saver?.position === 'GK'
          ? `Saved by ${saver.name}.`
          : saver ? `Blocked by ${saver.name}.` : 'Saved.';

        events.push({
          minute,
          type: 'shot_on_target',
          teamId: currentTeam.id,
          playerId: shooter?.id,
          description: `Shot on target by ${shooter?.name || 'Unknown'}! ${saveDesc}`,
          x: shotX,
          y: shotY,
        });
      } else if (eventRoll < 0.20 + advantageBoost * 0.5) {
        // Shot off target
        shots[teamIdx]++;

        let shotX: number, shotY: number;
        if (attackSide === 'left') {
          shotX = isTeamA ? rng.range(88, 98) : rng.range(2, 12);
          shotY = rng.chance(0.5) ? rng.range(5, 30) : rng.range(70, 95);
        } else if (attackSide === 'right') {
          shotX = isTeamA ? rng.range(88, 98) : rng.range(2, 12);
          shotY = rng.chance(0.5) ? rng.range(5, 30) : rng.range(70, 95);
        } else {
          shotX = isTeamA ? rng.range(88, 98) : rng.range(2, 12);
          shotY = rng.chance(0.5) ? rng.range(5, 30) : rng.range(70, 95);
        }
        ballX = shotX;
        ballY = shotY;

        const shooter = selectPlayerForAction(
          currentLineup, currentTeam, attackSide, 'attack', rng, fatigue
        );

        events.push({
          minute,
          type: 'shot_off_target',
          teamId: currentTeam.id,
          playerId: shooter?.id,
          description: `Shot goes wide by ${shooter?.name || 'Unknown'}`,
          x: shotX,
          y: shotY,
        });
      } else if (eventRoll < 0.24) {
        // Corner
        corners[teamIdx]++;
        const cornerX = isTeamA ? 95 : 5;
        const cornerY = attackSide === 'left'
          ? (isTeamA ? 5 : 95)
          : (isTeamA ? 95 : 5);
        ballX = cornerX;
        ballY = cornerY;

        events.push({
          minute,
          type: 'corner',
          teamId: currentTeam.id,
          description: `Corner kick for ${currentTeam.name} from the ${attackSide}`,
          x: cornerX,
          y: cornerY,
        });
      } else if (eventRoll < 0.32) {
        // Foul - more likely when defender is struggling against attacker
        // Foul is committed by the opponent, not the team with possession
        const opponentTeamIdx: 0 | 1 = isTeamA ? 1 : 0;
        fouls[opponentTeamIdx]++;
        const foulX = rng.range(20, 80);
        const foulY = attackSide === 'left' ? rng.range(15, 45)
          : attackSide === 'right' ? rng.range(55, 85)
          : rng.range(35, 65);
        ballX = foulX;
        ballY = foulY;

        const fouler = selectPlayerForAction(
          opponentLineup, isTeamA ? teamB : teamA, attackSide, 'defend', rng, fatigue
        );

        const fouled = selectPlayerForAction(
          currentLineup, currentTeam, attackSide, 'attack', rng, fatigue
        );

        // Foul is committed by the opponent (fouler), not by the team with possession
        const opponentTeamId = isTeamA ? teamB.id : teamA.id;

        events.push({
          minute,
          type: 'foul',
          teamId: opponentTeamId,
          playerId: fouler?.id,
          secondaryPlayerId: fouled?.id,
          description: `Foul by ${fouler?.name || 'Unknown'} on ${fouled?.name || 'Unknown'}`,
          x: foulX,
          y: foulY,
        });

        // Yellow card - more likely if defender is outmatched (desperate fouls)
        const yellowChance = 0.25 + Math.max(0, -sideAdvantage) * 0.2;
        if (rng.chance(yellowChance)) {
          yellowCards[opponentTeamIdx]++;

          events.push({
            minute: minute + 0.01,
            type: 'yellow_card',
            teamId: opponentTeamId,
            playerId: fouler?.id,
            description: `Yellow card for ${fouler?.name || 'Unknown'}`,
            x: foulX,
            y: foulY,
          });
        }

        // Very rare red card
        if (rng.chance(0.008)) {
          redCards[opponentTeamIdx]++;
          events.push({
            minute: minute + 0.02,
            type: 'red_card',
            teamId: opponentTeamId,
            playerId: fouler?.id,
            description: `Red card! ${fouler?.name || 'Unknown'} is sent off! ${opponentTeamId === teamA.id ? teamA.name : teamB.name} down to 10 men!`,
            x: foulX,
            y: foulY,
          });
        }
      } else if (eventRoll < 0.36) {
        // Offside
        const offX = isTeamA ? rng.range(80, 92) : rng.range(8, 20);
        const offY = attackSide === 'left' ? rng.range(20, 45)
          : attackSide === 'right' ? rng.range(55, 80)
          : rng.range(35, 65);
        ballX = offX;
        ballY = offY;

        const offsidePlayer = selectPlayerForAction(
          currentLineup, currentTeam, attackSide, 'attack', rng, fatigue
        );

        events.push({
          minute,
          type: 'offside',
          teamId: currentTeam.id,
          playerId: offsidePlayer?.id,
          description: `Offside against ${offsidePlayer?.name || currentTeam.name}`,
          x: offX,
          y: offY,
        });
      }
      // Passes were already generated at the top of the else block
    }

    // Half time
    if (minute === 45) {
      events.push({
        minute: 45,
        type: 'half_time',
        teamId: '',
        description: `Half time. ${teamA.name} ${score[0]} - ${score[1]} ${teamB.name}`,
        x: 50,
        y: 50,
      });
    }
  }

  // Full time
  events.push({
    minute: 90,
    type: 'full_time',
    teamId: '',
    description: `Full time! ${teamA.name} ${score[0]} - ${score[1]} ${teamB.name}`,
    x: 50,
    y: 50,
  });

  // Calculate possession
  const totalPoss = possessionCount[0] + possessionCount[1] || 1;
  const possession: [number, number] = [
    Math.round((possessionCount[0] / totalPoss) * 100),
    Math.round((possessionCount[1] / totalPoss) * 100),
  ];

  // Generate final player positions
  const teamAPositions = generatePlayerPositions(teamA, currentLineupA, ballX, ballY, true, lineupA.tactics);
  const teamBPositions = generatePlayerPositions(teamB, currentLineupB, ballX, ballY, false, lineupB.tactics);

  return {
    minute: 90,
    score,
    possession,
    shots,
    shotsOnTarget,
    corners,
    fouls,
    yellowCards,
    redCards,
    passes,
    passAccuracy: [
      Math.round(75 + strengthA.midfield / 15),
      Math.round(75 + strengthB.midfield / 15),
    ],
    ballX,
    ballY,
    teamAPositions,
    teamBPositions,
    events,
    isPlaying: false,
    isFinished: true,
    currentPhase: 'full_time',
    ballHolderTeamId,
  };
}

// ─── Pass Location Generation (Side-Aware) ─────────────────────────
function generatePassLocation(
  rng: SeededRandom,
  isTeamA: boolean,
  side: 'left' | 'right' | 'center'
): { x: number; y: number } {
  const baseX = isTeamA ? rng.range(30, 75) : rng.range(25, 70);

  let baseY: number;
  if (side === 'left') {
    baseY = rng.range(10, 40);
  } else if (side === 'right') {
    baseY = rng.range(60, 90);
  } else {
    baseY = rng.range(35, 65);
  }

  return { x: baseX, y: baseY };
}

// ─── Player Position Generation (Enhanced Movement) ─────────────────
function generatePlayerPositions(
  team: Team,
  lineup: Lineup,
  ballX: number,
  ballY: number,
  isTeamA: boolean,
  tactics: TacticalSettings
): PlayerPosition[] {
  const formation = FORMATIONS[lineup.formation];
  if (!formation) return [];

  const positions: PlayerPosition[] = [];
  const defLineShift = (tactics.defensiveLine - 50) / 200;
  const widthShift = (tactics.width - 50) / 400;
  const pressShift = (tactics.pressingIntensity - 50) / 300;

  // Team-wide shift based on ball position
  // When ball is in attacking half, the whole team shifts up
  const teamShiftX = isTeamA
    ? (ballX > 50 ? (ballX - 50) * 0.08 : 0)
    : (ballX < 50 ? (50 - ballX) * 0.08 : 0);

  // Team-wide lateral shift when ball is on one side
  const teamShiftY = (ballY - 50) * 0.05;

  for (let i = 0; i < Math.min(11, lineup.starting11.length); i++) {
    const slot = formation[i];
    const playerId = lineup.starting11[i];
    if (!slot || !playerId) continue;

    const player = team.players.find(p => p.id === playerId);

    let baseX = slot.x + defLineShift * 15;
    let baseY = slot.y + widthShift * 10;

    // Position-specific ball attraction
    let ballAttrX: number, ballAttrY: number;

    if (player && ATTACK_POSITIONS.includes(player.position)) {
      // Attackers: strongly attracted to ball, push forward
      ballAttrX = (ballX - baseX) * 0.2 + pressShift * 10;
      ballAttrY = (ballY - baseY) * 0.15;
      // Extra forward push when team has possession on attack side
      if (isTeamA && ballX > 50) {
        ballAttrX += (ballX - 50) * 0.1;
      } else if (!isTeamA && ballX < 50) {
        ballAttrX += (50 - ballX) * 0.1;
      }
    } else if (player && MID_POSITIONS.includes(player.position)) {
      // Midfielders: moderate attraction, balanced
      ballAttrX = (ballX - baseX) * 0.15 + pressShift * 8;
      ballAttrY = (ballY - baseY) * 0.12;
    } else if (player && player.position === 'GK') {
      // Goalkeeper: stays in goal area, slight lateral movement
      ballAttrX = (ballX - baseX) * 0.02;
      ballAttrY = (ballY - baseY) * 0.05;
    } else {
      // Defenders: moderate forward shift but stay behind ball
      ballAttrX = (ballX - baseX) * 0.1 + pressShift * 6;
      ballAttrY = (ballY - baseY) * 0.1;
      // Defenders shouldn't push too far forward
      if (isTeamA && baseX + ballAttrX > 60) {
        ballAttrX = Math.min(ballAttrX, 60 - baseX);
      } else if (!isTeamA && baseX + ballAttrX < 40) {
        ballAttrX = Math.max(ballAttrX, 40 - baseX);
      }
    }

    baseX += ballAttrX + teamShiftX;
    baseY += ballAttrY + teamShiftY;

    // Clamp positions
    baseX = Math.max(2, Math.min(98, baseX));
    baseY = Math.max(3, Math.min(97, baseY));

    if (!isTeamA) {
      const mirrored = mirrorPosition(baseX, baseY);
      baseX = mirrored.x;
      baseY = mirrored.y;
    }

    // Check if this player has the ball
    const hasBall = false; // Will be set during animation

    positions.push({
      playerId,
      baseX,
      baseY,
      currentX: baseX,
      currentY: baseY,
      hasBall,
    });
  }

  return positions;
}

// ─── Monte Carlo Prediction ─────────────────────────────────────────
export function predictMatch(
  teamA: Team,
  teamB: Team,
  lineupA: Lineup,
  lineupB: Lineup,
  simulations: number = 100
): { predictedScore: [number, number]; winProbability: [number, number, number] } {
  let teamAWins = 0;
  let draws = 0;
  let teamBWins = 0;
  let totalGoalsA = 0;
  let totalGoalsB = 0;

  for (let i = 0; i < simulations; i++) {
    const result = simulateMatch(teamA, teamB, lineupA, lineupB, i * 7919 + 42);
    totalGoalsA += result.score[0];
    totalGoalsB += result.score[1];

    if (result.score[0] > result.score[1]) teamAWins++;
    else if (result.score[0] < result.score[1]) teamBWins++;
    else draws++;
  }

  return {
    predictedScore: [
      Math.round((totalGoalsA / simulations) * 10) / 10,
      Math.round((totalGoalsB / simulations) * 10) / 10,
    ],
    winProbability: [
      Math.round((teamAWins / simulations) * 100),
      Math.round((draws / simulations) * 100),
      Math.round((teamBWins / simulations) * 100),
    ],
  };
}

// ─── Animation Frames ───────────────────────────────────────────────
export function generateAnimationFrames(
  teamA: Team,
  teamB: Team,
  lineupA: Lineup,
  lineupB: Lineup,
  seed: number = Date.now()
): MatchState[] {
  const fullMatch = simulateMatch(teamA, teamB, lineupA, lineupB, seed);
  const frames: MatchState[] = [];
  const sortedEvents = [...fullMatch.events].sort((a, b) => a.minute - b.minute);

  // Track cumulative stats per minute
  let cumScore: [number, number] = [0, 0];
  let cumShots: [number, number] = [0, 0];
  let cumShotsOnTarget: [number, number] = [0, 0];
  let cumCorners: [number, number] = [0, 0];
  let cumFouls: [number, number] = [0, 0];
  let cumYellowCards: [number, number] = [0, 0];
  let cumRedCards: [number, number] = [0, 0];
  let cumPasses: [number, number] = [0, 0];
  let cumPossCount: [number, number] = [0, 0];

  const minuteStats: Map<number, {
    score: [number, number];
    shots: [number, number];
    shotsOnTarget: [number, number];
    corners: [number, number];
    fouls: [number, number];
    yellowCards: [number, number];
    redCards: [number, number];
    passes: [number, number];
    possCount: [number, number];
  }> = new Map();

  for (const evt of sortedEvents) {
    const m = Math.floor(evt.minute);
    const isTeamAEvent = evt.teamId === teamA.id;
    const isTeamBEvent = evt.teamId === teamB.id;
    const teamIdx: 0 | 1 | null = isTeamAEvent ? 0 : isTeamBEvent ? 1 : null;

    if (teamIdx !== null) {
      switch (evt.type) {
        case 'goal':
          cumScore[teamIdx]++;
          cumShots[teamIdx]++;
          cumShotsOnTarget[teamIdx]++;
          break;
        case 'shot_on_target':
          cumShots[teamIdx]++;
          cumShotsOnTarget[teamIdx]++;
          break;
        case 'shot_off_target':
          cumShots[teamIdx]++;
          break;
        case 'corner':
          cumCorners[teamIdx]++;
          break;
        case 'foul':
          cumFouls[teamIdx]++;
          break;
        case 'yellow_card':
          cumYellowCards[teamIdx]++;
          break;
        case 'red_card':
          cumRedCards[teamIdx]++;
          break;
        case 'pass_sequence':
          cumPasses[teamIdx]++;
          break;
      }
    }

    minuteStats.set(m, {
      score: [...cumScore] as [number, number],
      shots: [...cumShots] as [number, number],
      shotsOnTarget: [...cumShotsOnTarget] as [number, number],
      corners: [...cumCorners] as [number, number],
      fouls: [...cumFouls] as [number, number],
      yellowCards: [...cumYellowCards] as [number, number],
      redCards: [...cumRedCards] as [number, number],
      passes: [...cumPasses] as [number, number],
      possCount: [...cumPossCount] as [number, number],
    });
  }

  // Track possession per minute
  for (let m = 1; m <= 90; m++) {
    const mEvents = sortedEvents.filter(e => Math.floor(e.minute) === m && e.teamId);
    if (mEvents.length > 0) {
      const lastEvent = mEvents[mEvents.length - 1];
      const idx = lastEvent.teamId === teamA.id ? 0 : 1;
      if (idx >= 0) cumPossCount[idx]++;
    }
  }

  // Fix pass counts: distribute fullMatch.passes proportionally across minutes
  // The event-based counting only captures ~25% of passes (only pass_sequence events).
  // We use possession data to distribute the correct total pass count.
  const totalPossCount = cumPossCount[0] + cumPossCount[1] || 1;
  const totalEventPasses = cumPasses[0] + cumPasses[1] || 1;

  // Recalculate passes per minute based on actual totals from fullMatch
  const targetPassesA = fullMatch.passes[0];
  const targetPassesB = fullMatch.passes[1];
  const passRatioA = targetPassesA / (cumPasses[0] || 1);
  const passRatioB = targetPassesB / (cumPasses[1] || 1);

  // Redistribute passes across minuteStats
  let redistributedPasses: [number, number] = [0, 0];
  for (let m = 0; m <= 90; m++) {
    const mStats = minuteStats.get(m);
    if (mStats) {
      // Calculate incremental passes for this minute
      const prevM = m - 1;
      const prevStats = minuteStats.get(prevM);
      const eventPassesA = mStats.passes[0] - (prevStats?.passes[0] || 0);
      const eventPassesB = mStats.passes[1] - (prevStats?.passes[1] || 0);

      // Scale by ratio but also add proportional passes for minutes with possession
      const possRatioA = cumPossCount[0] / totalPossCount;
      const possRatioB = cumPossCount[1] / totalPossCount;
      const minutesWithEvents = sortedEvents.filter(e => Math.floor(e.minute) === m).length > 0;
      const basePassesPerMinute = Math.round((targetPassesA + targetPassesB) / 90);

      const scaledPassesA = Math.round(eventPassesA * passRatioA) + (minutesWithEvents ? Math.round(basePassesPerMinute * possRatioA * 0.7) : 0);
      const scaledPassesB = Math.round(eventPassesB * passRatioB) + (minutesWithEvents ? Math.round(basePassesPerMinute * possRatioB * 0.7) : 0);

      redistributedPasses[0] += scaledPassesA;
      redistributedPasses[1] += scaledPassesB;

      mStats.passes = [...redistributedPasses] as [number, number];
    }
  }

  // Ensure final pass count matches fullMatch exactly
  const lastMinuteWithStats = Math.max(...Array.from(minuteStats.keys()));
  const finalStats = minuteStats.get(lastMinuteWithStats);
  if (finalStats) {
    finalStats.passes = [targetPassesA, targetPassesB];
  }

  // Build ball position map
  let lastBallX = 50, lastBallY = 50;
  let lastBallTeam = teamA.id;
  const ballPositionMap: Map<number, { x: number; y: number; teamId: string }> = new Map();
  ballPositionMap.set(0, { x: 50, y: 50, teamId: teamA.id });

  for (const evt of sortedEvents) {
    const m = Math.floor(evt.minute);
    if (evt.x !== undefined && evt.y !== undefined) {
      lastBallX = evt.x;
      lastBallY = evt.y;
      if (evt.teamId) lastBallTeam = evt.teamId;
    }
    ballPositionMap.set(m, { x: lastBallX, y: lastBallY, teamId: lastBallTeam });
  }

  // Generate frames with enhanced player positions
  const rng = new SeededRandom(seed);

  for (let minute = 0; minute <= 90; minute++) {
    const ballPos = ballPositionMap.get(minute) || ballPositionMap.get(minute - 1) || { x: 50, y: 50, teamId: teamA.id };
    const stats = minuteStats.get(minute);

    // Fill forward from last known stats
    let frameScore: [number, number] = stats?.score || [0, 0];
    let frameShots: [number, number] = stats?.shots || [0, 0];
    let frameShotsOnTarget: [number, number] = stats?.shotsOnTarget || [0, 0];
    let frameCorners: [number, number] = stats?.corners || [0, 0];
    let frameFouls: [number, number] = stats?.fouls || [0, 0];
    let frameYellowCards: [number, number] = stats?.yellowCards || [0, 0];
    let frameRedCards: [number, number] = stats?.redCards || [0, 0];
    let framePasses: [number, number] = stats?.passes || [0, 0];

    if (!stats && minute > 0) {
      for (let pm = minute - 1; pm >= 0; pm--) {
        const prevStats = minuteStats.get(pm);
        if (prevStats) {
          frameScore = [...prevStats.score];
          frameShots = [...prevStats.shots];
          frameShotsOnTarget = [...prevStats.shotsOnTarget];
          frameCorners = [...prevStats.corners];
          frameFouls = [...prevStats.fouls];
          frameYellowCards = [...prevStats.yellowCards];
          frameRedCards = [...prevStats.redCards];
          framePasses = [...prevStats.passes];
          break;
        }
      }
    }

    const totalPoss = cumPossCount[0] + cumPossCount[1] || 1;
    const possession: [number, number] = [
      Math.round((cumPossCount[0] / totalPoss) * 100),
      Math.round((cumPossCount[1] / totalPoss) * 100),
    ];

    // Generate player positions with enhanced movement
    // Add small random jitter to make movement more natural between frames
    const teamAPositions = generatePlayerPositionsWithJitter(
      teamA, lineupA, ballPos.x, ballPos.y, true, lineupA.tactics, rng
    );
    const teamBPositions = generatePlayerPositionsWithJitter(
      teamB, lineupB, ballPos.x, ballPos.y, false, lineupB.tactics, rng
    );

    const minuteEvents = sortedEvents.filter(e => Math.floor(e.minute) === minute);

    frames.push({
      minute,
      score: frameScore,
      possession,
      shots: frameShots,
      shotsOnTarget: frameShotsOnTarget,
      corners: frameCorners,
      fouls: frameFouls,
      yellowCards: frameYellowCards,
      redCards: frameRedCards,
      passes: framePasses,
      passAccuracy: fullMatch.passAccuracy,
      ballX: ballPos.x,
      ballY: ballPos.y,
      teamAPositions,
      teamBPositions,
      events: minuteEvents,
      isPlaying: true,
      isFinished: minute >= 90,
      currentPhase: minute < 45 ? 'first_half' : minute === 45 ? 'half_time' : minute < 90 ? 'second_half' : 'full_time',
      ballHolderTeamId: ballPos.teamId,
    });
  }

  return frames;
}

// Generate player positions with per-frame jitter for more realistic movement
function generatePlayerPositionsWithJitter(
  team: Team,
  lineup: Lineup,
  ballX: number,
  ballY: number,
  isTeamA: boolean,
  tactics: TacticalSettings,
  rng: SeededRandom
): PlayerPosition[] {
  const formation = FORMATIONS[lineup.formation];
  if (!formation) return [];

  const positions: PlayerPosition[] = [];
  const defLineShift = (tactics.defensiveLine - 50) / 200;
  const widthShift = (tactics.width - 50) / 400;
  const pressShift = (tactics.pressingIntensity - 50) / 300;

  // Team-wide shift based on ball position
  const teamShiftX = isTeamA
    ? (ballX > 50 ? (ballX - 50) * 0.08 : 0)
    : (ballX < 50 ? (50 - ballX) * 0.08 : 0);
  const teamShiftY = (ballY - 50) * 0.05;

  for (let i = 0; i < Math.min(11, lineup.starting11.length); i++) {
    const slot = formation[i];
    const playerId = lineup.starting11[i];
    if (!slot || !playerId) continue;

    const player = team.players.find(p => p.id === playerId);

    let baseX = slot.x + defLineShift * 15;
    let baseY = slot.y + widthShift * 10;

    // Position-specific ball attraction
    let ballAttrX: number, ballAttrY: number;

    if (player && ATTACK_POSITIONS.includes(player.position)) {
      // Attackers: strongly attracted to ball, push forward
      ballAttrX = (ballX - baseX) * 0.22 + pressShift * 10;
      ballAttrY = (ballY - baseY) * 0.15;
      if (isTeamA && ballX > 50) {
        ballAttrX += (ballX - 50) * 0.12;
      } else if (!isTeamA && ballX < 50) {
        ballAttrX += (50 - ballX) * 0.12;
      }
    } else if (player && MID_POSITIONS.includes(player.position)) {
      // Midfielders: moderate attraction
      ballAttrX = (ballX - baseX) * 0.16 + pressShift * 8;
      ballAttrY = (ballY - baseY) * 0.12;
    } else if (player && player.position === 'GK') {
      // Goalkeeper: stays in goal area
      ballAttrX = (ballX - baseX) * 0.02;
      ballAttrY = (ballY - baseY) * 0.06;
    } else {
      // Defenders: moderate shift but stay behind ball
      ballAttrX = (ballX - baseX) * 0.12 + pressShift * 6;
      ballAttrY = (ballY - baseY) * 0.1;
      if (isTeamA && baseX + ballAttrX > 60) {
        ballAttrX = Math.min(ballAttrX, 60 - baseX);
      } else if (!isTeamA && baseX + ballAttrX < 40) {
        ballAttrX = Math.max(ballAttrX, 40 - baseX);
      }
    }

    baseX += ballAttrX + teamShiftX;
    baseY += ballAttrY + teamShiftY;

    // Add per-frame jitter for natural movement
    const jitterX = rng.range(-1.5, 1.5);
    const jitterY = rng.range(-1.5, 1.5);
    baseX += jitterX;
    baseY += jitterY;

    // Clamp
    baseX = Math.max(2, Math.min(98, baseX));
    baseY = Math.max(3, Math.min(97, baseY));

    if (!isTeamA) {
      const mirrored = mirrorPosition(baseX, baseY);
      baseX = mirrored.x;
      baseY = mirrored.y;
    }

    // Determine if player has ball (closest player on possessing team to ball)
    const hasBall = false;

    positions.push({
      playerId,
      baseX,
      baseY,
      currentX: baseX,
      currentY: baseY,
      hasBall,
    });
  }

  return positions;
}

// ─── Live Substitution ──────────────────────────────────────────────
export function applyLiveSubstitution(
  teamA: Team,
  teamB: Team,
  currentLineupA: Lineup,
  currentLineupB: Lineup,
  team: 'A' | 'B',
  playerOutId: string,
  playerInId: string,
  currentMinute: number,
  existingFrames: MatchState[],
  seed: number
): MatchState[] {
  const lineup = team === 'A' ? { ...currentLineupA } : { ...currentLineupB };
  const updatedStarting11 = [...lineup.starting11];
  const idx = updatedStarting11.indexOf(playerOutId);

  if (idx === -1) return existingFrames;

  updatedStarting11[idx] = playerInId;
  const updatedSubs = [...lineup.subs];
  const subIdx = updatedSubs.indexOf(playerInId);
  if (subIdx !== -1) {
    updatedSubs[subIdx] = playerOutId;
  }

  const sub = {
    id: `live_sub_${Date.now()}`,
    playerOutId,
    playerInId,
    minute: currentMinute,
    executed: true,
  };

  const newLineupA = team === 'A'
    ? { ...currentLineupA, starting11: updatedStarting11, subs: updatedSubs, substitutions: [...currentLineupA.substitutions, sub] }
    : currentLineupA;
  const newLineupB = team === 'B'
    ? { ...currentLineupB, starting11: updatedStarting11, subs: updatedSubs, substitutions: [...currentLineupB.substitutions, sub] }
    : currentLineupB;

  const newFrames = generateAnimationFrames(teamA, teamB, newLineupA, newLineupB, seed);
  const combined = [...existingFrames.slice(0, currentMinute), ...newFrames.slice(currentMinute)];

  if (combined[currentMinute]) {
    const subEvent: MatchEvent = {
      minute: currentMinute,
      type: 'substitution',
      teamId: team === 'A' ? teamA.id : teamB.id,
      playerId: playerOutId,
      secondaryPlayerId: playerInId,
      description: `Substitution: ${[...teamA.players, ...teamB.players].find(p => p.id === playerOutId)?.name} ➜ ${[...teamA.players, ...teamB.players].find(p => p.id === playerInId)?.name}`,
      x: 5,
      y: 50,
    };
    combined[currentMinute] = {
      ...combined[currentMinute],
      events: [...combined[currentMinute].events, subEvent],
    };
  }

  return combined;
}
