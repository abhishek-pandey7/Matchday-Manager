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
  attackerName: string;
  defenderName: string;
  attackerAttributeRating: number; // attribute-based rating for the matchup
  defenderAttributeRating: number; // attribute-based rating for the matchup
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

// ─── Attribute-Based Matchup Calculation ────────────────────────────
// Different position matchups use different attribute combinations
function getMatchupAttributeRating(
  attacker: Player,
  defender: Player,
  fatigue: Map<string, number>
): { attackerAttr: number; defenderAttr: number } {
  const fatigueFactorA = 1 - (fatigue.get(attacker.id) || 0) * 0.003;
  const fatigueFactorD = 1 - (fatigue.get(defender.id) || 0) * 0.003;

  let attackerAttr: number;
  let defenderAttr: number;

  const aPos = attacker.position;
  const dPos = defender.position;

  // Winger vs Fullback: pace + dribbling vs pace + defending
  if (['LW', 'RW', 'LM', 'RM'].includes(aPos) && ['LB', 'RB', 'LWB', 'RWB'].includes(dPos)) {
    attackerAttr = (attacker.pace * 0.5 + attacker.dribbling * 0.5) * fatigueFactorA;
    defenderAttr = (defender.pace * 0.4 + defender.defending * 0.6) * fatigueFactorD;
  }
  // Striker vs CB: shooting + physical vs defending + physical
  else if (['ST', 'CF'].includes(aPos) && dPos === 'CB') {
    attackerAttr = (attacker.shooting * 0.5 + attacker.physical * 0.5) * fatigueFactorA;
    defenderAttr = (defender.defending * 0.6 + defender.physical * 0.4) * fatigueFactorD;
  }
  // CAM vs CDM: passing + dribbling vs defending + passing
  else if (aPos === 'CAM' && dPos === 'CDM') {
    attackerAttr = (attacker.passing * 0.4 + attacker.dribbling * 0.6) * fatigueFactorA;
    defenderAttr = (defender.defending * 0.6 + defender.passing * 0.4) * fatigueFactorD;
  }
  // CM vs CM/CDM: passing + dribbling vs defending + passing
  else if (aPos === 'CM' && ['CM', 'CDM'].includes(dPos)) {
    attackerAttr = (attacker.passing * 0.5 + attacker.dribbling * 0.3 + attacker.pace * 0.2) * fatigueFactorA;
    defenderAttr = (defender.defending * 0.5 + defender.passing * 0.3 + defender.physical * 0.2) * fatigueFactorD;
  }
  // Default: use overall rating
  else {
    attackerAttr = attacker.rating * fatigueFactorA;
    defenderAttr = defender.rating * fatigueFactorD;
  }

  return { attackerAttr, defenderAttr };
}

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

  // Helper to create a matchup with both overall and attribute-based ratings
  const createMatchup = (
    attacker: Player,
    defender: Player,
    side: 'left' | 'right' | 'center',
    invertAdvantage: boolean = false
  ): PlayerMatchup => {
    const aRating = getEffectiveRating(attacker);
    const dRating = getEffectiveRating(defender);
    const { attackerAttr, defenderAttr } = getMatchupAttributeRating(attacker, defender, fatigue);

    // Blend overall and attribute-based advantage (60% attribute, 40% overall for more nuanced matchups)
    const overallAdv = (aRating - dRating) / 100;
    const attrAdv = (attackerAttr - defenderAttr) / 100;
    const blendedAdv = overallAdv * 0.4 + attrAdv * 0.6;
    const advantage = invertAdvantage ? -blendedAdv : blendedAdv;

    return {
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerRating: aRating,
      defenderRating: dRating,
      advantage,
      side,
      attackerPosition: attacker.position,
      defenderPosition: defender.position,
      attackerName: attacker.name,
      defenderName: defender.name,
      attackerAttributeRating: attackerAttr,
      defenderAttributeRating: defenderAttr,
    };
  };

  // Calculate wing matchups
  // Left wing: Team A's LW/LM vs Team B's RB/RWB
  const leftWingAttackersA = playersA.filter(p => ['LW', 'LM'].includes(p.position));
  const rightWingDefendersB = playersB.filter(p => ['RB', 'RWB'].includes(p.position));

  for (const attacker of leftWingAttackersA) {
    const defender = findDefender([attacker], rightWingDefendersB, attacker.position);
    if (defender) {
      matchups.push(createMatchup(attacker, defender, 'left'));
    }
  }

  // Right wing: Team A's RW/RM vs Team B's LB/LWB
  const rightWingAttackersA = playersA.filter(p => ['RW', 'RM'].includes(p.position));
  const leftWingDefendersB = playersB.filter(p => ['LB', 'LWB'].includes(p.position));

  for (const attacker of rightWingAttackersA) {
    const defender = findDefender([attacker], leftWingDefendersB, attacker.position);
    if (defender) {
      matchups.push(createMatchup(attacker, defender, 'right'));
    }
  }

  // Center: Team A's ST/CF vs Team B's CBs
  const centerAttackersA = playersA.filter(p => ['ST', 'CF'].includes(p.position));
  const centerDefendersB = playersB.filter(p => p.position === 'CB');

  for (const attacker of centerAttackersA) {
    // Match against best CB
    const bestCB = centerDefendersB.sort((a, b) => getEffectiveRating(b) - getEffectiveRating(a))[0];
    if (bestCB) {
      matchups.push(createMatchup(attacker, bestCB, 'center'));
    }
  }

  // Midfield battle: CAM vs CDM, CM vs CM
  const midAttackersA = playersA.filter(p => ['CAM', 'CM'].includes(p.position));
  const midDefendersB = playersB.filter(p => ['CDM', 'CM'].includes(p.position));

  for (const attacker of midAttackersA) {
    const targetPositions = WING_MATCHUPS[attacker.position] || ['CM', 'CDM'];
    const defender = midDefendersB.find(d => targetPositions.includes(d.position)) || midDefendersB[0];
    if (defender) {
      matchups.push(createMatchup(attacker, defender, 'center'));
    }
  }

  // Also do reverse matchups (Team B attacking vs Team A defending)
  // Left wing: Team B's LW/LM vs Team A's RB/RWB
  const leftWingAttackersB = playersB.filter(p => ['LW', 'LM'].includes(p.position));
  const rightWingDefendersA = playersA.filter(p => ['RB', 'RWB'].includes(p.position));

  for (const attacker of leftWingAttackersB) {
    const defender = findDefender([attacker], rightWingDefendersA, attacker.position);
    if (defender) {
      matchups.push(createMatchup(attacker, defender, 'right', true)); // B's left = A's right, inverted
    }
  }

  // Right wing: Team B's RW/RM vs Team A's LB/LWB
  const rightWingAttackersB = playersB.filter(p => ['RW', 'RM'].includes(p.position));
  const leftWingDefendersA = playersA.filter(p => ['LB', 'LWB'].includes(p.position));

  for (const attacker of rightWingAttackersB) {
    const defender = findDefender([attacker], leftWingDefendersA, attacker.position);
    if (defender) {
      matchups.push(createMatchup(attacker, defender, 'left', true)); // B's right = A's left, inverted
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

// ─── Goal Expectancy with Enhanced Rating-Based Dominance ───────────
function calculateGoalExpectancy(
  attackStrength: number,
  oppositionDefense: number,
  midfieldDiff: number,
  tactics: TacticalSettings,
  formation: FormationType,
  isHome: boolean,
  overallRatingDiff: number
): number {
  const baseRate = 1.35;

  // Enhanced rating-based scaling: bigger gaps = more dominant
  const attackRatio = attackStrength / 80;
  const defenseRatio = oppositionDefense / 80;

  // Rating dominance multiplier: exponential effect makes gaps more decisive
  // Increased exponent from 1.02 to 1.035 for stronger dominance
  const ratingDominance = Math.pow(1.035, overallRatingDiff);

  const formationMod = getFormationAttackBonus(formation);
  const mentalityMod = getMentalityModifier(tactics.mentality);
  const pressingMod = (tactics.pressingIntensity - 50) / 500;
  const tempoMod = (tactics.tempo - 50) / 800;
  const homeMod = isHome ? 0.12 : -0.05;
  const midMod = midfieldDiff / 400; // Increased midfield influence (was /500)

  const expectancy =
    baseRate *
    attackRatio *
    (2 - defenseRatio) *
    ratingDominance *
    (1 + formationMod + mentalityMod.attackMod + pressingMod + tempoMod + homeMod + midMod);

  return Math.max(0.15, Math.min(4.5, expectancy)); // Increased max from 4.0 to 4.5
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

// ─── Side-Based Attack Weighting (Enhanced Matchup Weight) ──────────
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

  // Increased from ±150 to ±250 for more decisive side selection
  if (isTeamA) {
    leftWeight += matchupAnalysis.leftAdvantage * 250;
    rightWeight += matchupAnalysis.rightAdvantage * 250;
    centerWeight += matchupAnalysis.centerAdvantage * 250;
  } else {
    leftWeight -= matchupAnalysis.leftAdvantage * 250;
    rightWeight -= matchupAnalysis.rightAdvantage * 250;
    centerWeight -= matchupAnalysis.centerAdvantage * 250;
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

// Get the best individual matchup for a given side (for event descriptions)
function getBestMatchupForSide(
  isTeamA: boolean,
  side: 'left' | 'right' | 'center',
  matchupAnalysis: TeamMatchupAnalysis,
  teamA: Team,
  teamB: Team
): PlayerMatchup | null {
  const sideMatchups = matchupAnalysis.matchups.filter(m => m.side === side);
  if (sideMatchups.length === 0) return null;

  // Find the matchup with the biggest advantage for the attacking team
  let best: PlayerMatchup | null = null;
  let bestAdv = -Infinity;

  for (const m of sideMatchups) {
    const adv = isTeamA ? m.advantage : -m.advantage;
    if (adv > bestAdv) {
      bestAdv = adv;
      best = m;
    }
  }

  return best;
}

// ─── Player Selection Based on Position and Side (Attribute-Aware) ──
function selectPlayerForAction(
  lineup: Lineup,
  team: Team,
  side: 'left' | 'right' | 'center',
  actionType: 'attack' | 'defend' | 'midfield',
  rng: SeededRandom,
  fatigue: Map<string, number>,
  matchupAnalysis?: TeamMatchupAnalysis,
  isTeamA?: boolean
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

      // Attribute-based bonus for attacking actions
      if (['LW', 'RW', 'LM', 'RM'].includes(player.position)) {
        score += (player.pace + player.dribbling - 120) * 0.3; // Pace+Dribbling matter for wingers
      }
      if (['ST', 'CF'].includes(player.position)) {
        score += (player.shooting + player.physical - 120) * 0.3; // Shooting+Physical for strikers
      }
    } else if (actionType === 'defend') {
      if (DEF_POSITIONS.includes(player.position)) score += 20;
      if (player.position === 'GK') score += 15;
      if (['CDM'].includes(player.position)) score += 15;

      // Attribute-based bonus for defending actions
      if (['CB', 'LB', 'RB'].includes(player.position)) {
        score += (player.defending + player.physical - 120) * 0.3;
      }
    } else {
      if (MID_POSITIONS.includes(player.position)) score += 25;
      if (['CDM'].includes(player.position)) score += 15;

      // Attribute-based bonus for midfield actions
      if (['CM', 'CAM'].includes(player.position)) {
        score += (player.passing + player.dribbling - 120) * 0.3;
      }
    }

    // Rating bonus (slightly increased)
    score += (effectiveRating - 60) * 0.6;

    // Matchup-aware bonus: if this player has a big matchup advantage, boost their selection
    if (matchupAnalysis && isTeamA !== undefined) {
      const relevantMatchup = matchupAnalysis.matchups.find(m => {
        const teamAdvantage = isTeamA ? m.advantage : -m.advantage;
        return m.side === side && teamAdvantage > 0.05 &&
          (m.attackerId === player.id || m.defenderId === player.id);
      });
      if (relevantMatchup) {
        const adv = isTeamA ? relevantMatchup.advantage : -relevantMatchup.advantage;
        if (relevantMatchup.attackerId === player.id && actionType === 'attack') {
          score += adv * 30; // Big boost for players with matchup advantage
        }
      }
    }

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

// ─── Matchup-Aware Event Description Builder ────────────────────────
function buildMatchupDescription(
  baseAction: string,
  side: 'left' | 'right' | 'center',
  isTeamA: boolean,
  matchupAnalysis: TeamMatchupAnalysis,
  teamA: Team,
  teamB: Team,
  currentTeam: Team
): string {
  const bestMatchup = getBestMatchupForSide(isTeamA, side, matchupAnalysis, teamA, teamB);
  if (!bestMatchup) return baseAction;

  const adv = isTeamA ? bestMatchup.advantage : -bestMatchup.advantage;
  const absAdv = Math.abs(adv);

  if (absAdv > 0.15 && currentTeam.id === (isTeamA ? teamA.id : teamB.id)) {
    // Attacking team has big advantage — mention it
    if (bestMatchup.attackerId) {
      const attacker = isTeamA
        ? teamA.players.find(p => p.id === bestMatchup.attackerId)
        : teamB.players.find(p => p.id === bestMatchup.attackerId);
      const defender = isTeamA
        ? teamB.players.find(p => p.id === bestMatchup.defenderId)
        : teamA.players.find(p => p.id === bestMatchup.defenderId);

      if (attacker && defender && absAdv > 0.2) {
        return `${baseAction} ${attacker.name} gets the better of ${defender.name} on the ${side}!`;
      } else if (attacker && defender) {
        return `${baseAction} ${attacker.name} beats ${defender.name} down the ${side} wing!`;
      }
    }
  } else if (absAdv > 0.15 && currentTeam.id !== (isTeamA ? teamA.id : teamB.id)) {
    // Defending team has advantage
    const defender = isTeamA
      ? teamA.players.find(p => p.id === bestMatchup.defenderId)
      : teamB.players.find(p => p.id === bestMatchup.defenderId);
    const attacker = isTeamA
      ? teamB.players.find(p => p.id === bestMatchup.attackerId)
      : teamA.players.find(p => p.id === bestMatchup.attackerId);

    if (defender && attacker && absAdv > 0.2) {
      return `${baseAction} ${defender.name} contains ${attacker.name} well on the ${side}.`;
    }
  }

  return baseAction;
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

  // ─── Enhanced Possession Strength ──────────────────────────────
  // More aggressive formula: stronger team dominates possession significantly
  // 10+ overall advantage → ~60% possession, 15+ → ~65-70%, capped at 75%
  const midDiff = strengthA.midfield - strengthB.midfield;
  const possessionStrength = Math.min(0.75, Math.max(0.25,
    0.5 + (midDiff + overallRatingDiff * 0.3) / 150
  ));

  // Track stats
  let score: [number, number] = [0, 0];
  let shots: [number, number] = [0, 0];
  let shotsOnTarget: [number, number] = [0, 0];
  let corners: [number, number] = [0, 0];
  let fouls: [number, number] = [0, 0];
  let yellowCards: [number, number] = [0, 0];
  let redCards: [number, number] = [0, 0];
  let passes: [number, number] = [0, 0];
  let passesCompleted: [number, number] = [0, 0]; // Track completed passes for accuracy
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

    // Recalculate team strengths for current fatigue/subs
    const currentStrengthA = calculateTeamStrength(teamA, currentLineupA, fatigue);
    const currentStrengthB = calculateTeamStrength(teamB, currentLineupB, fatigue);
    const currentOverallDiff = currentStrengthA.overall - currentStrengthB.overall;

    // ─── Enhanced Possession Determination ────────────────────────
    // Stronger team gets significantly more possession
    const currentPossStrength = Math.min(0.75, Math.max(0.25,
      0.5 + ((currentStrengthA.midfield - currentStrengthB.midfield) + currentOverallDiff * 0.3) / 150
    ));
    const tempoInfluence = (lineupA.tactics.tempo - 50) / 400;
    const isTeamA = rng.chance(currentPossStrength + tempoInfluence);
    const currentTeam = isTeamA ? teamA : teamB;
    const currentLineup = isTeamA ? currentLineupA : currentLineupB;
    const opponentLineup = isTeamA ? currentLineupB : currentLineupA;
    const opponentTeam = isTeamA ? teamB : teamA;
    const teamIdx = isTeamA ? 0 : 1;

    ballHolderTeamId = currentTeam.id;
    possessionCount[teamIdx]++;

    // Choose attack side based on matchups (with enhanced weight)
    const attackSide = chooseAttackSide(isTeamA, currentMatchupAnalysis, rng);
    const sideAdvantage = getSideAdvantage(isTeamA, attackSide, currentMatchupAnalysis);

    // ─── Enhanced Pass Distribution ───────────────────────────────
    // Pass accuracy: 65% (weak, mid ~60) to 90% (elite, mid ~90) based on midfield rating
    const currentMidRating = isTeamA ? currentStrengthA.midfield : currentStrengthB.midfield;
    const basePassAccuracy = 0.65 + (currentMidRating - 60) / 100 * 0.25; // 65% at mid=60, 90% at mid=90
    const passAcc = Math.min(0.92, Math.max(0.60, basePassAccuracy));

    // Passes per minute scale with team strength
    const currentAttackStrength = isTeamA ? currentStrengthA.attack : currentStrengthB.attack;
    const basePassesThisMinute = rng.int(3, 7);
    const strengthPassBonus = (currentAttackStrength - 70) / 30; // Stronger attack = more passes
    const passesThisMinute = Math.max(2, Math.round(basePassesThisMinute + strengthPassBonus * 3));

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
        currentLineup, currentTeam, attackSide, 'attack', rng, fatigue,
        currentMatchupAnalysis, isTeamA
      );

      // Pick assist provider
      const assister = selectPlayerForAction(
        currentLineup, currentTeam, attackSide, 'midfield', rng, fatigue,
        currentMatchupAnalysis, isTeamA
      );

      // Build-up passes leading to goal
      const passCount = rng.int(4, 10);
      for (let p = 0; p < passCount; p++) {
        const passLoc = generatePassLocation(rng, isTeamA, attackSide);
        const completed = rng.chance(passAcc);
        events.push({
          minute: minute - 0.01 * (passCount - p),
          type: 'pass_sequence',
          teamId: currentTeam.id,
          description: `Passing move by ${currentTeam.name} down the ${attackSide}`,
          x: passLoc.x,
          y: passLoc.y,
        });
        passes[teamIdx]++;
        if (completed) passesCompleted[teamIdx]++;
      }

      // Goal event with matchup context - enhanced descriptions
      const bestMatchup = getBestMatchupForSide(isTeamA, attackSide, currentMatchupAnalysis, teamA, teamB);
      let matchupDesc = '';
      if (bestMatchup && Math.abs(isTeamA ? bestMatchup.advantage : -bestMatchup.advantage) > 0.1) {
        const adv = isTeamA ? bestMatchup.advantage : -bestMatchup.advantage;
        if (adv > 0.1 && bestMatchup.attackerId) {
          const attacker = currentTeam.players.find(p => p.id === bestMatchup.attackerId);
          const defender = opponentTeam.players.find(p => p.id === bestMatchup.defenderId);
          if (attacker && defender) {
            matchupDesc = ` ${attacker.name} exploited the ${attackSide} side against ${defender.name}!`;
          }
        } else {
          matchupDesc = ` (${scorer?.name || 'Unknown'} exploited the ${attackSide} side advantage!)`;
        }
      }

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
      // ─── Regular play events ──────────────────────────────────────

      // Generate passes with team-strength-based accuracy
      for (let pIdx = 0; pIdx < passesThisMinute; pIdx++) {
        passes[teamIdx]++;
        if (rng.chance(passAcc)) {
          passesCompleted[teamIdx]++;
        }
        // Move ball slightly with each pass
        const passLoc = generatePassLocation(rng, isTeamA, attackSide);
        ballX = ballX * 0.7 + passLoc.x * 0.3;
        ballY = ballY * 0.7 + passLoc.y * 0.3;
      }

      // Show a pass event in timeline occasionally (more often for dominant teams)
      const passEventChance = 0.25 + Math.max(0, (isTeamA ? currentOverallDiff : -currentOverallDiff)) * 0.005;
      if (rng.chance(passEventChance)) {
        const passer = selectPlayerForAction(
          currentLineup, currentTeam, attackSide, 'midfield', rng, fatigue,
          currentMatchupAnalysis, isTeamA
        );
        const baseDesc = `${passer?.name || currentTeam.name} controls midfield on the ${attackSide} side`;
        const desc = buildMatchupDescription(baseDesc, attackSide, isTeamA, currentMatchupAnalysis, teamA, teamB, currentTeam);
        events.push({
          minute,
          type: 'pass_sequence',
          teamId: currentTeam.id,
          playerId: passer?.id,
          description: desc,
          x: ballX,
          y: ballY,
        });
      }

      // ─── Enhanced Shot Distribution ────────────────────────────────
      // Stronger team gets more shot probability: +0.03 per overall rating point advantage
      const ratingShotBonus = (isTeamA ? currentOverallDiff : -currentOverallDiff) * 0.003;
      // Side advantage affects event probabilities
      const advantageBoost = sideAdvantage * 0.12;
      const eventRoll = rng.next();

      if (eventRoll < 0.10 + advantageBoost + ratingShotBonus) {
        // ─── Shot on target ─────────────────────────────────────────
        // Matchup-weighted accuracy: +15% per 0.1 matchup advantage
        const matchupAccuracyBonus = Math.max(0, sideAdvantage) * 1.5; // 0.1 advantage → +15%
        const shotOnTargetChance = Math.min(0.95, 0.6 + matchupAccuracyBonus + (currentAttackStrength - 70) / 100);

        // Decide if it's actually on target or becomes a save/blocked
        const isActuallyOnTarget = rng.chance(shotOnTargetChance);

        shots[teamIdx]++;
        if (isActuallyOnTarget) shotsOnTarget[teamIdx]++;

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
          currentLineup, currentTeam, attackSide, 'attack', rng, fatigue,
          currentMatchupAnalysis, isTeamA
        );

        // Defender who made the save
        const saver = selectPlayerForAction(
          opponentLineup, opponentTeam, attackSide, 'defend', rng, fatigue,
          currentMatchupAnalysis, !isTeamA
        );

        if (isActuallyOnTarget) {
          const saveDesc = saver?.position === 'GK'
            ? `Saved by ${saver.name}.`
            : saver ? `Blocked by ${saver.name}.` : 'Saved.';

          // Matchup-aware description
          let desc = `Shot on target by ${shooter?.name || 'Unknown'}! ${saveDesc}`;
          desc = buildMatchupDescription(desc, attackSide, isTeamA, currentMatchupAnalysis, teamA, teamB, currentTeam);

          events.push({
            minute,
            type: 'shot_on_target',
            teamId: currentTeam.id,
            playerId: shooter?.id,
            description: desc,
            x: shotX,
            y: shotY,
          });
        } else {
          // Matchup advantage led to a blocked shot
          let desc = `Shot blocked!`;
          if (saver && shooter) {
            desc = `Shot by ${shooter.name} blocked by ${saver.name}!`;
          }
          desc = buildMatchupDescription(desc, attackSide, isTeamA, currentMatchupAnalysis, teamA, teamB, currentTeam);

          events.push({
            minute,
            type: 'shot_off_target',
            teamId: currentTeam.id,
            playerId: shooter?.id,
            description: desc,
            x: shotX,
            y: shotY,
          });
        }
      } else if (eventRoll < 0.20 + advantageBoost * 0.5 + ratingShotBonus * 0.5) {
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
          currentLineup, currentTeam, attackSide, 'attack', rng, fatigue,
          currentMatchupAnalysis, isTeamA
        );

        let desc = `Shot goes wide by ${shooter?.name || 'Unknown'}`;
        desc = buildMatchupDescription(desc, attackSide, isTeamA, currentMatchupAnalysis, teamA, teamB, currentTeam);

        events.push({
          minute,
          type: 'shot_off_target',
          teamId: currentTeam.id,
          playerId: shooter?.id,
          description: desc,
          x: shotX,
          y: shotY,
        });
      } else if (eventRoll < 0.24 + ratingShotBonus * 0.3) {
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
        const opponentTeamIdx: 0 | 1 = isTeamA ? 1 : 0;
        fouls[opponentTeamIdx]++;
        const foulX = rng.range(20, 80);
        const foulY = attackSide === 'left' ? rng.range(15, 45)
          : attackSide === 'right' ? rng.range(55, 85)
          : rng.range(35, 65);
        ballX = foulX;
        ballY = foulY;

        const fouler = selectPlayerForAction(
          opponentLineup, opponentTeam, attackSide, 'defend', rng, fatigue,
          currentMatchupAnalysis, !isTeamA
        );

        const fouled = selectPlayerForAction(
          currentLineup, currentTeam, attackSide, 'attack', rng, fatigue,
          currentMatchupAnalysis, isTeamA
        );

        const opponentTeamId = isTeamA ? teamB.id : teamA.id;

        // Enhanced foul description with matchup context
        let foulDesc = `Foul by ${fouler?.name || 'Unknown'} on ${fouled?.name || 'Unknown'}`;
        if (fouler && fouled && Math.abs(sideAdvantage) > 0.1) {
          if (sideAdvantage > 0) {
            foulDesc = `Foul by ${fouler.name} on ${fouled.name} — ${fouled.name} was getting past him!`;
          } else {
            foulDesc = `Foul by ${fouler.name} on ${fouled.name} — ${fouler.name} struggling to contain ${fouled.name}`;
          }
        }

        events.push({
          minute,
          type: 'foul',
          teamId: opponentTeamId,
          playerId: fouler?.id,
          secondaryPlayerId: fouled?.id,
          description: foulDesc,
          x: foulX,
          y: foulY,
        });

        // Yellow card - more likely if defender is outmatched (desperate fouls)
        const yellowChance = 0.25 + Math.max(0, -sideAdvantage) * 0.3;
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
          currentLineup, currentTeam, attackSide, 'attack', rng, fatigue,
          currentMatchupAnalysis, isTeamA
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

      // ─── Turnover Events ─────────────────────────────────────────
      // Weaker team is more likely to lose possession quickly
      const possessionTeamStrength = isTeamA ? currentStrengthA.overall : currentStrengthB.overall;
      const turnoverChance = 0.12 - (possessionTeamStrength - 70) * 0.002; // Weaker = more turnovers
      if (rng.chance(Math.max(0.03, Math.min(0.20, turnoverChance)))) {
        const otherTeamIdx: 0 | 1 = isTeamA ? 1 : 0;
        possessionCount[otherTeamIdx]++;

        const loser = selectPlayerForAction(
          currentLineup, currentTeam, attackSide, 'midfield', rng, fatigue
        );
        const winner = selectPlayerForAction(
          opponentLineup, opponentTeam, attackSide, 'defend', rng, fatigue
        );

        const turnoverX = rng.range(25, 75);
        const turnoverY = attackSide === 'left' ? rng.range(15, 45)
          : attackSide === 'right' ? rng.range(55, 85)
          : rng.range(35, 65);
        ballX = turnoverX;
        ballY = turnoverY;

        events.push({
          minute: minute + 0.005,
          type: 'pass_sequence',
          teamId: opponentTeam.id,
          playerId: winner?.id,
          description: `${winner?.name || opponentTeam.name} wins the ball from ${loser?.name || currentTeam.name}!`,
          x: turnoverX,
          y: turnoverY,
        });

        // Counter-attack opportunity for the team that won the ball
        if (rng.chance(0.3 + Math.max(0, -sideAdvantage) * 0.5)) {
          // Quick counter - weaker team gets a dangerous chance
          const counterSide = chooseAttackSide(!isTeamA, currentMatchupAnalysis, rng);
          const counterX = isTeamA ? rng.range(70, 90) : rng.range(10, 30);
          const counterY = counterSide === 'left' ? rng.range(15, 40)
            : counterSide === 'right' ? rng.range(60, 85)
            : rng.range(35, 65);

          const counterAttacker = selectPlayerForAction(
            opponentLineup, opponentTeam, counterSide, 'attack', rng, fatigue,
            currentMatchupAnalysis, !isTeamA
          );

          events.push({
            minute: minute + 0.01,
            type: 'pass_sequence',
            teamId: opponentTeam.id,
            playerId: counterAttacker?.id,
            description: `Quick counter-attack by ${opponentTeam.name}! ${counterAttacker?.name || 'Unknown'} leads the break!`,
            x: counterX,
            y: counterY,
          });
          ballX = counterX;
          ballY = counterY;
        }
      }
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

  // ─── Enhanced Pass Accuracy Calculation ─────────────────────────
  // Based on actual simulated completion rates, not just a formula
  const passAccA = passes[0] > 0 ? Math.round((passesCompleted[0] / passes[0]) * 100) : Math.round(65 + strengthA.midfield / 10);
  const passAccB = passes[1] > 0 ? Math.round((passesCompleted[1] / passes[1]) * 100) : Math.round(65 + strengthB.midfield / 10);

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
    passAccuracy: [passAccA, passAccB],
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

// ─── Player Position Generation (Enhanced Dynamic Movement) ─────────
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

  // ─── Enhanced Team-Wide Shifts Based on Ball Position ──────────
  // Increased from 0.08 to 0.15: when ball is in attacking third, whole team pushes up more
  const teamShiftX = isTeamA
    ? (ballX > 50 ? (ballX - 50) * 0.15 : (ballX - 50) * 0.05)
    : (ballX < 50 ? (50 - ballX) * 0.15 : (50 - ballX) * 0.05);

  // Enhanced lateral shift: when ball is on one wing, team shifts that way
  const teamShiftY = (ballY - 50) * 0.08;

  // Determine if ball is in attacking third for more aggressive positioning
  const isBallInAttackingThird = isTeamA ? ballX > 65 : ballX < 35;
  const isBallInDefendingThird = isTeamA ? ballX < 35 : ballX > 65;

  // Track defensive line for shape coherence
  const cbPositions: { index: number; x: number; y: number }[] = [];

  for (let i = 0; i < Math.min(11, lineup.starting11.length); i++) {
    const slot = formation[i];
    const playerId = lineup.starting11[i];
    if (!slot || !playerId) continue;

    const player = team.players.find(p => p.id === playerId);

    let baseX = slot.x + defLineShift * 15;
    let baseY = slot.y + widthShift * 10;

    // ─── Position-Specific Movement ──────────────────────────────
    let ballAttrX: number, ballAttrY: number;

    if (player && player.position === 'GK') {
      // ─── GK: Position between ball and center of goal ──────────
      // GK shifts laterally along goal line toward ball side
      const gkBaseX = isTeamA ? 5 : 95;
      ballAttrX = 0; // GK stays on goal line
      // GK tracks ball laterally: moves toward ball's Y position
      ballAttrY = (ballY - 50) * 0.25; // Significant lateral tracking
      // When ball is close, GK comes out slightly
      const ballDistFromGoal = isTeamA ? ballX : (100 - ballX);
      if (ballDistFromGoal < 30) {
        ballAttrX = (isTeamA ? 1 : -1) * (30 - ballDistFromGoal) * 0.1; // Comes out to narrow angle
      }
    } else if (player && player.position === 'CB') {
      // ─── CB: Maintain a line, shift as unit ────────────────────
      // One CB steps up to press when ball is nearby, the other covers
      const cbIndex = cbPositions.length;
      cbPositions.push({ index: i, x: baseX, y: baseY });

      // Base defensive shift: track ball moderately
      ballAttrX = (ballX - baseX) * 0.08 + pressShift * 4;
      ballAttrY = (ballY - baseY) * 0.12;

      // When ball is in defending third, CBs track more aggressively
      if (isBallInDefendingThird) {
        ballAttrX += (ballX - baseX) * 0.05;
        ballAttrY += (ballY - baseY) * 0.05;
      }

      // One CB steps up to press (first CB), the other covers (second CB)
      if (cbIndex === 0) {
        // First CB: more aggressive, steps toward ball
        ballAttrX += (ballX - baseX) * 0.05;
      } else {
        // Cover CB: stays slightly deeper, shifts toward center
        ballAttrY += (50 - baseY) * 0.1; // Tuck toward center
      }

      // Defenders shouldn't push too far forward
      if (isTeamA && baseX + ballAttrX + teamShiftX > 55) {
        ballAttrX = Math.min(ballAttrX, 55 - baseX - teamShiftX);
      } else if (!isTeamA && baseX + ballAttrX + teamShiftX < 45) {
        ballAttrX = Math.max(ballAttrX, 45 - baseX - teamShiftX);
      }
    } else if (player && ['LB', 'RB', 'LWB', 'RWB'].includes(player.position)) {
      // ─── FB/LB/RB: Push up when team attacks on their side, tuck in when defending
      const isLeftSide = ['LB', 'LWB'].includes(player.position);
      const ballOnTheirSide = isLeftSide ? ballY < 45 : ballY > 55;

      // Push up when team attacks on their side (overlap runs)
      if (isBallInAttackingThird && ballOnTheirSide) {
        ballAttrX = (ballX - baseX) * 0.25 + pressShift * 8;
        ballAttrY = (ballY - baseY) * 0.15;
        // Extra forward push for overlap
        if (isTeamA) {
          ballAttrX += 8;
        } else {
          ballAttrX -= 8;
        }
      } else if (isBallInDefendingThird) {
        // Tuck inside when defending
        ballAttrX = (ballX - baseX) * 0.12 + pressShift * 6;
        ballAttrY = (50 - baseY) * 0.15; // Tuck toward center
      } else {
        // Normal positioning
        ballAttrX = (ballX - baseX) * 0.12 + pressShift * 6;
        ballAttrY = (ballY - baseY) * 0.1;
      }

      // Defenders shouldn't push too far forward
      if (isTeamA && baseX + ballAttrX > 65) {
        ballAttrX = Math.min(ballAttrX, 65 - baseX);
      } else if (!isTeamA && baseX + ballAttrX < 35) {
        ballAttrX = Math.max(ballAttrX, 35 - baseX);
      }
    } else if (player && player.position === 'CDM') {
      // ─── CDM: Always between ball and goal, shield the defense ─
      ballAttrX = (ballX - baseX) * 0.1;
      ballAttrY = (ballY - baseY) * 0.18; // Strong lateral tracking

      // When ball is in defending third, CDM drops back to shield
      if (isBallInDefendingThird) {
        ballAttrX *= 0.5; // Less forward, more shielding
        ballAttrY += (ballY - baseY) * 0.05; // More lateral tracking
      }

      // Stay in front of defensive line
      if (isTeamA && baseX + ballAttrX > 50) {
        ballAttrX = Math.min(ballAttrX, 50 - baseX);
      } else if (!isTeamA && baseX + ballAttrX < 50) {
        ballAttrX = Math.max(ballAttrX, 50 - baseX);
      }
    } else if (player && player.position === 'CM') {
      // ─── CM: Move laterally with ball, offer passing options ───
      ballAttrX = (ballX - baseX) * 0.15 + pressShift * 8;
      ballAttrY = (ballY - baseY) * 0.18; // Strong lateral tracking

      // When team attacks, push forward to offer options
      if (isBallInAttackingThird) {
        ballAttrX += (isTeamA ? 5 : -5);
      }
    } else if (player && player.position === 'CAM') {
      // ─── CAM: Drift into spaces between opponent lines ─────────
      ballAttrX = (ballX - baseX) * 0.2 + pressShift * 10;
      ballAttrY = (ballY - baseY) * 0.12;

      // Find space: drift away from where the ball is (find pockets)
      if (isBallInAttackingThird) {
        ballAttrX += (isTeamA ? 6 : -6); // Push into final third
        // Drift away from ball Y to find space
        ballAttrY += (baseY - ballY) * 0.05;
      }
    } else if (player && ['LW', 'RW', 'LM', 'RM'].includes(player.position)) {
      // ─── Wingers: Stay wide when attacking, tuck in when defending
      const isLeftWing = ['LW', 'LM'].includes(player.position);

      if (isBallInAttackingThird) {
        // Stay wide when team has possession - hug the touchline
        ballAttrX = (ballX - baseX) * 0.2 + pressShift * 10;
        ballAttrY = isLeftWing
          ? (Math.min(baseY, 20) - baseY) * 0.3 // Push toward touchline
          : (Math.max(baseY, 80) - baseY) * 0.3;
        // Extra forward push
        ballAttrX += (isTeamA ? 8 : -8);
      } else if (isBallInDefendingThird) {
        // Tuck in when defending
        ballAttrX = (ballX - baseX) * 0.1 + pressShift * 6;
        ballAttrY = (50 - baseY) * 0.15; // Tuck toward center
      } else {
        // Normal
        ballAttrX = (ballX - baseX) * 0.18 + pressShift * 8;
        ballAttrY = (ballY - baseY) * 0.1;
      }

      // When ball is on opposite wing, tuck in; same side, spread out
      if (isLeftWing && ballY > 55) {
        // Ball on right side, left winger tucks in
        ballAttrY += (45 - baseY) * 0.1;
      } else if (!isLeftWing && ballY < 45) {
        // Ball on left side, right winger tucks in
        ballAttrY += (55 - baseY) * 0.1;
      } else if (isLeftWing && ballY < 40) {
        // Ball on same side, spread out
        ballAttrY += (15 - baseY) * 0.1;
      } else if (!isLeftWing && ballY > 60) {
        // Ball on same side, spread out
        ballAttrY += (85 - baseY) * 0.1;
      }
    } else if (player && ['ST', 'CF'].includes(player.position)) {
      // ─── ST/CF: Move towards box when team attacks, come short to receive
      ballAttrX = (ballX - baseX) * 0.2 + pressShift * 10;
      ballAttrY = (ballY - baseY) * 0.15;

      // When team attacks, push into the box
      if (isBallInAttackingThird) {
        ballAttrX += (isTeamA ? 10 : -10);
        // Make runs into space - alternate near/far post based on ball position
        if ((ballY > 50) !== (baseY > 50)) {
          ballAttrY += (50 - baseY) * 0.2; // Run toward center
        }
      } else {
        // When team is building, come short to receive
        ballAttrX *= 0.7;
        ballAttrY += (ballY - baseY) * 0.1;
      }
    } else {
      // Fallback for any unhandled positions
      ballAttrX = (ballX - baseX) * 0.12 + pressShift * 6;
      ballAttrY = (ballY - baseY) * 0.1;
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

  // ─── Team Shape Coherence: Adjust CB line to maintain unit ──────
  // Find all CB positions and average their X to keep the line coherent
  if (cbPositions.length >= 2) {
    const cbIndices = cbPositions.map(cb => cb.index);
    const cbEntries = positions.filter((_, idx) => cbIndices.includes(idx));
    // Note: positions array may be smaller than 11 due to skipping, need to re-find CBs
    const cbFinalPositions = positions.filter(p => {
      const player = team.players.find(pl => pl.id === p.playerId);
      return player && player.position === 'CB';
    });

    if (cbFinalPositions.length >= 2) {
      // Calculate average X position for CBs (they should form a line)
      const avgCBX = cbFinalPositions.reduce((s, p) => s + (p.baseX + p.currentX) / 2, 0) / cbFinalPositions.length;
      // Adjust all CBs toward the average line, keeping some spread
      for (const cbPos of cbFinalPositions) {
        const currentAvg = (cbPos.baseX + cbPos.currentX) / 2;
        const diff = avgCBX - currentAvg;
        // Move 30% toward the average to maintain shape
        cbPos.baseX += diff * 0.3;
        cbPos.currentX = cbPos.baseX;
      }
    }
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
      const prevM = m - 1;
      const prevStats = minuteStats.get(prevM);
      const eventPassesA = mStats.passes[0] - (prevStats?.passes[0] || 0);
      const eventPassesB = mStats.passes[1] - (prevStats?.passes[1] || 0);

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

  // Track previous frame positions for smoothing
  let prevTeamAPositions: PlayerPosition[] | null = null;
  let prevTeamBPositions: PlayerPosition[] | null = null;

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

    // Generate player positions with enhanced movement and jitter
    const teamAPositions = generatePlayerPositionsWithJitter(
      teamA, lineupA, ballPos.x, ballPos.y, true, lineupA.tactics, rng,
      prevTeamAPositions
    );
    const teamBPositions = generatePlayerPositionsWithJitter(
      teamB, lineupB, ballPos.x, ballPos.y, false, lineupB.tactics, rng,
      prevTeamBPositions
    );

    // Store for next frame smoothing
    prevTeamAPositions = teamAPositions;
    prevTeamBPositions = teamBPositions;

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

// ─── Generate Player Positions with Enhanced Jitter + Smoothing ──────
function generatePlayerPositionsWithJitter(
  team: Team,
  lineup: Lineup,
  ballX: number,
  ballY: number,
  isTeamA: boolean,
  tactics: TacticalSettings,
  rng: SeededRandom,
  prevPositions: PlayerPosition[] | null
): PlayerPosition[] {
  const formation = FORMATIONS[lineup.formation];
  if (!formation) return [];

  const positions: PlayerPosition[] = [];
  const defLineShift = (tactics.defensiveLine - 50) / 200;
  const widthShift = (tactics.width - 50) / 400;
  const pressShift = (tactics.pressingIntensity - 50) / 300;

  // ─── Enhanced Team-Wide Shifts ────────────────────────────────
  // Increased from 0.08 to 0.15 for more dramatic team shifts
  const teamShiftX = isTeamA
    ? (ballX > 50 ? (ballX - 50) * 0.15 : (ballX - 50) * 0.05)
    : (ballX < 50 ? (50 - ballX) * 0.15 : (50 - ballX) * 0.05);
  const teamShiftY = (ballY - 50) * 0.08;

  // Determine pitch zones
  const isBallInAttackingThird = isTeamA ? ballX > 65 : ballX < 35;
  const isBallInDefendingThird = isTeamA ? ballX < 35 : ballX > 65;

  // Track CB positions for shape coherence
  const cbPositions: { index: number; x: number; y: number }[] = [];

  for (let i = 0; i < Math.min(11, lineup.starting11.length); i++) {
    const slot = formation[i];
    const playerId = lineup.starting11[i];
    if (!slot || !playerId) continue;

    const player = team.players.find(p => p.id === playerId);

    let baseX = slot.x + defLineShift * 15;
    let baseY = slot.y + widthShift * 10;

    // ─── Position-Specific Ball Attraction ──────────────────────
    let ballAttrX: number, ballAttrY: number;

    if (player && player.position === 'GK') {
      // GK: Position between ball and center of goal, lateral movement
      ballAttrX = 0;
      ballAttrY = (ballY - 50) * 0.25;
      const ballDistFromGoal = isTeamA ? ballX : (100 - ballX);
      if (ballDistFromGoal < 30) {
        ballAttrX = (isTeamA ? 1 : -1) * (30 - ballDistFromGoal) * 0.1;
      }
    } else if (player && player.position === 'CB') {
      const cbIndex = cbPositions.length;
      cbPositions.push({ index: i, x: baseX, y: baseY });

      ballAttrX = (ballX - baseX) * 0.08 + pressShift * 4;
      ballAttrY = (ballY - baseY) * 0.12;

      if (isBallInDefendingThird) {
        ballAttrX += (ballX - baseX) * 0.05;
        ballAttrY += (ballY - baseY) * 0.05;
      }

      if (cbIndex === 0) {
        ballAttrX += (ballX - baseX) * 0.05;
      } else {
        ballAttrY += (50 - baseY) * 0.1;
      }

      if (isTeamA && baseX + ballAttrX + teamShiftX > 55) {
        ballAttrX = Math.min(ballAttrX, 55 - baseX - teamShiftX);
      } else if (!isTeamA && baseX + ballAttrX + teamShiftX < 45) {
        ballAttrX = Math.max(ballAttrX, 45 - baseX - teamShiftX);
      }
    } else if (player && ['LB', 'RB', 'LWB', 'RWB'].includes(player.position)) {
      const isLeftSide = ['LB', 'LWB'].includes(player.position);
      const ballOnTheirSide = isLeftSide ? ballY < 45 : ballY > 55;

      if (isBallInAttackingThird && ballOnTheirSide) {
        ballAttrX = (ballX - baseX) * 0.25 + pressShift * 8;
        ballAttrY = (ballY - baseY) * 0.15;
        if (isTeamA) ballAttrX += 8; else ballAttrX -= 8;
      } else if (isBallInDefendingThird) {
        ballAttrX = (ballX - baseX) * 0.12 + pressShift * 6;
        ballAttrY = (50 - baseY) * 0.15;
      } else {
        ballAttrX = (ballX - baseX) * 0.12 + pressShift * 6;
        ballAttrY = (ballY - baseY) * 0.1;
      }

      if (isTeamA && baseX + ballAttrX > 65) {
        ballAttrX = Math.min(ballAttrX, 65 - baseX);
      } else if (!isTeamA && baseX + ballAttrX < 35) {
        ballAttrX = Math.max(ballAttrX, 35 - baseX);
      }
    } else if (player && player.position === 'CDM') {
      ballAttrX = (ballX - baseX) * 0.1;
      ballAttrY = (ballY - baseY) * 0.18;

      if (isBallInDefendingThird) {
        ballAttrX *= 0.5;
        ballAttrY += (ballY - baseY) * 0.05;
      }

      if (isTeamA && baseX + ballAttrX > 50) {
        ballAttrX = Math.min(ballAttrX, 50 - baseX);
      } else if (!isTeamA && baseX + ballAttrX < 50) {
        ballAttrX = Math.max(ballAttrX, 50 - baseX);
      }
    } else if (player && player.position === 'CM') {
      ballAttrX = (ballX - baseX) * 0.15 + pressShift * 8;
      ballAttrY = (ballY - baseY) * 0.18;

      if (isBallInAttackingThird) {
        ballAttrX += (isTeamA ? 5 : -5);
      }
    } else if (player && player.position === 'CAM') {
      ballAttrX = (ballX - baseX) * 0.2 + pressShift * 10;
      ballAttrY = (ballY - baseY) * 0.12;

      if (isBallInAttackingThird) {
        ballAttrX += (isTeamA ? 6 : -6);
        ballAttrY += (baseY - ballY) * 0.05;
      }
    } else if (player && ['LW', 'RW', 'LM', 'RM'].includes(player.position)) {
      const isLeftWing = ['LW', 'LM'].includes(player.position);

      if (isBallInAttackingThird) {
        ballAttrX = (ballX - baseX) * 0.2 + pressShift * 10;
        ballAttrY = isLeftWing
          ? (Math.min(baseY, 20) - baseY) * 0.3
          : (Math.max(baseY, 80) - baseY) * 0.3;
        ballAttrX += (isTeamA ? 8 : -8);
      } else if (isBallInDefendingThird) {
        ballAttrX = (ballX - baseX) * 0.1 + pressShift * 6;
        ballAttrY = (50 - baseY) * 0.15;
      } else {
        ballAttrX = (ballX - baseX) * 0.18 + pressShift * 8;
        ballAttrY = (ballY - baseY) * 0.1;
      }

      // Ball on opposite wing → tuck in; same side → spread out
      if (isLeftWing && ballY > 55) {
        ballAttrY += (45 - baseY) * 0.1;
      } else if (!isLeftWing && ballY < 45) {
        ballAttrY += (55 - baseY) * 0.1;
      } else if (isLeftWing && ballY < 40) {
        ballAttrY += (15 - baseY) * 0.1;
      } else if (!isLeftWing && ballY > 60) {
        ballAttrY += (85 - baseY) * 0.1;
      }
    } else if (player && ['ST', 'CF'].includes(player.position)) {
      ballAttrX = (ballX - baseX) * 0.2 + pressShift * 10;
      ballAttrY = (ballY - baseY) * 0.15;

      if (isBallInAttackingThird) {
        ballAttrX += (isTeamA ? 10 : -10);
        if (rng.chance(0.5)) {
          ballAttrY += (50 - baseY) * 0.2;
        }
      } else {
        ballAttrX *= 0.7;
        ballAttrY += (ballY - baseY) * 0.1;
      }
    } else {
      ballAttrX = (ballX - baseX) * 0.12 + pressShift * 6;
      ballAttrY = (ballY - baseY) * 0.1;
    }

    baseX += ballAttrX + teamShiftX;
    baseY += ballAttrY + teamShiftY;

    // ─── Increased Jitter (±2.5 instead of ±1.5) ────────────────
    const jitterX = rng.range(-2.5, 2.5);
    const jitterY = rng.range(-2.5, 2.5);
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

    // ─── Smoothing with Previous Frame ──────────────────────────
    // Blend 40% toward previous frame for organic movement
    if (prevPositions) {
      const prevPos = prevPositions.find(p => p.playerId === playerId);
      if (prevPos) {
        baseX = prevPos.currentX * 0.4 + baseX * 0.6;
        baseY = prevPos.currentY * 0.4 + baseY * 0.6;
      }
    }

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

  // ─── Team Shape Coherence: CB Line Adjustment ─────────────────
  const cbFinalPositions = positions.filter(p => {
    const player = team.players.find(pl => pl.id === p.playerId);
    return player && player.position === 'CB';
  });

  if (cbFinalPositions.length >= 2) {
    const avgCBX = cbFinalPositions.reduce((s, p) => s + p.currentX, 0) / cbFinalPositions.length;
    for (const cbPos of cbFinalPositions) {
      const diff = avgCBX - cbPos.currentX;
      cbPos.baseX += diff * 0.3;
      cbPos.currentX = cbPos.baseX;
    }
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
