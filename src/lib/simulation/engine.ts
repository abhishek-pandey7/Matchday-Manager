import {
  Team,
  Lineup,
  TacticalSettings,
  MatchEvent,
  MatchState,
  PlayerPosition,
  FormationType,
} from './types';
import { FORMATIONS, mirrorPosition } from './formations';

// Seeded random for reproducibility
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

function getFormationDefenseBonus(formation: FormationType): number {
  return -getFormationAttackBonus(formation);
}

function calculateTeamStrength(
  team: Team,
  lineup: Lineup,
  fatigue: Map<string, number>
): { attack: number; midfield: number; defense: number; overall: number } {
  const startingPlayers = lineup.starting11
    .map(id => team.players.find(p => p.id === id))
    .filter(Boolean);

  if (startingPlayers.length === 0) {
    return { attack: 50, midfield: 50, defense: 50, overall: 50 };
  }

  let attackSum = 0, midSum = 0, defSum = 0;
  let attackCount = 0, midCount = 0, defCount = 0;

  for (const player of startingPlayers) {
    if (!player) continue;
    const fatigueFactor = 1 - (fatigue.get(player.id) || 0) * 0.003;
    const effectiveRating = player.rating * fatigueFactor;

    if (['ST', 'CF', 'LW', 'RW'].includes(player.position)) {
      attackSum += effectiveRating;
      attackCount++;
    } else if (['CM', 'CAM', 'CDM', 'LM', 'RM'].includes(player.position)) {
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

function calculateGoalExpectancy(
  attackStrength: number,
  oppositionDefense: number,
  midfieldDiff: number,
  tactics: TacticalSettings,
  formation: FormationType,
  isHome: boolean
): number {
  const baseRate = 1.35; // Average goals per team per match in top leagues

  const attackRatio = attackStrength / 80;
  const defenseRatio = oppositionDefense / 80;
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
    (1 + formationMod + mentalityMod.attackMod + pressingMod + tempoMod + homeMod + midMod);

  return Math.max(0.15, Math.min(3.5, expectancy));
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

function generatePassLocation(rng: SeededRandom, teamId: string, isTeamA: boolean): { x: number; y: number } {
  const baseX = isTeamA ? rng.range(30, 75) : rng.range(25, 70);
  const baseY = rng.range(15, 85);
  return { x: baseX, y: baseY };
}

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

  // Calculate goal expectancies
  const strengthA = calculateTeamStrength(teamA, lineupA, fatigue);
  const strengthB = calculateTeamStrength(teamB, lineupB, fatigue);

  const expA = calculateGoalExpectancy(
    strengthA.attack, strengthB.defense, strengthA.midfield - strengthB.midfield,
    lineupA.tactics, lineupA.formation, true
  );
  const expB = calculateGoalExpectancy(
    strengthB.attack, strengthA.defense, strengthB.midfield - strengthA.midfield,
    lineupB.tactics, lineupB.formation, false
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

  // Pre-calculate which team has possession each minute
  const possessionStrength = strengthA.midfield / (strengthA.midfield + strengthB.midfield);

  // Track match stats
  let score: [number, number] = [0, 0];
  let shots: [number, number] = [0, 0];
  let shotsOnTarget: [number, number] = [0, 0];
  let corners: [number, number] = [0, 0];
  let fouls: [number, number] = [0, 0];
  let yellowCards: [number, number] = [0, 0];
  let redCards: [number, number] = [0, 0];
  let passes: [number, number] = [0, 0];
  let possessionCount: [number, number] = [0, 0];

  let ballX = 50, ballY = 50;
  let ballHolderTeamId = rng.chance(possessionStrength) ? teamA.id : teamB.id;

  // Generate events minute by minute
  events.push({
    minute: 0,
    type: 'kick_off',
    teamId: teamA.id,
    description: 'Kick off! The match begins.',
    x: 50,
    y: 50,
  });

  for (let minute = 1; minute <= 90; minute++) {
    // Fatigue increases each minute
    for (const pid of currentLineupA.starting11) {
      fatigue.set(pid, (fatigue.get(pid) || 0) + rng.range(0.3, 0.6));
    }
    for (const pid of currentLineupB.starting11) {
      fatigue.set(pid, (fatigue.get(pid) || 0) + rng.range(0.3, 0.6));
    }

    // Execute substitutions
    const subResultA = executeSubstitutions(currentLineupA, minute, teamA, fatigue);
    const subResultB = executeSubstitutions(currentLineupB, minute, teamB, fatigue);
    events.push(...subResultA.events, ...subResultB.events);
    currentLineupA = subResultA.updatedLineup;
    currentLineupB = subResultB.updatedLineup;

    // Determine possession
    const isTeamA = rng.chance(possessionStrength + (lineupA.tactics.tempo - 50) / 400);
    const currentTeam = isTeamA ? teamA : teamB;
    const currentLineup = isTeamA ? currentLineupA : currentLineupB;
    const teamIdx = isTeamA ? 0 : 1;

    ballHolderTeamId = currentTeam.id;
    possessionCount[teamIdx]++;

    // Generate events for this minute
    const isGoalMinute = isTeamA ? goalMinutesA.includes(minute) : goalMinutesB.includes(minute);

    if (isGoalMinute) {
      score[teamIdx]++;
      shots[teamIdx]++;
      shotsOnTarget[teamIdx]++;

      const goalX = isTeamA ? rng.range(90, 98) : rng.range(2, 10);
      const goalY = rng.range(38, 62);
      ballX = goalX;
      ballY = goalY;

      // Find a striker/attacker as scorer
      const attackers = currentLineup.starting11
        .map(id => teamA.players.find(p => p.id === id) || teamB.players.find(p => p.id === id))
        .filter(p => p && ['ST', 'CF', 'LW', 'RW', 'CAM'].includes(p.position));

      const scorer = attackers.length > 0
        ? attackers[rng.int(0, attackers.length - 1)]
        : currentLineup.starting11.map(id => [...teamA.players, ...teamB.players].find(p => p.id === id)).filter(Boolean)[0];

      events.push({
        minute,
        type: 'goal',
        teamId: currentTeam.id,
        playerId: scorer?.id,
        description: `⚽ GOAL! ${scorer?.name || 'Unknown'} scores for ${currentTeam.name}! ${score[0]} - ${score[1]}`,
        x: goalX,
        y: goalY,
      });

      // Pass sequences leading to goal
      const passCount = rng.int(2, 6);
      for (let p = 0; p < passCount; p++) {
        const passLoc = generatePassLocation(rng, currentTeam.id, isTeamA);
        events.push({
          minute: minute - 0.01 * (passCount - p),
          type: 'pass_sequence',
          teamId: currentTeam.id,
          description: `Passing move by ${currentTeam.name}`,
          x: passLoc.x,
          y: passLoc.y,
        });
        passes[teamIdx]++;
      }
    } else {
      // Regular play events
      const eventRoll = rng.next();

      if (eventRoll < 0.08) {
        // Shot on target
        shots[teamIdx]++;
        shotsOnTarget[teamIdx]++;
        const shotX = isTeamA ? rng.range(88, 96) : rng.range(4, 12);
        const shotY = rng.range(35, 65);
        ballX = shotX;
        ballY = shotY;

        const shooter = currentLineup.starting11
          .map(id => [...teamA.players, ...teamB.players].find(p => p.id === id))
          .filter(p => p && ['ST', 'CF', 'LW', 'RW', 'CAM', 'CM'].includes(p.position))
          [rng.int(0, 2)];

        events.push({
          minute,
          type: 'shot_on_target',
          teamId: currentTeam.id,
          playerId: shooter?.id,
          description: `Shot on target by ${shooter?.name || 'Unknown'}! Saved.`,
          x: shotX,
          y: shotY,
        });
      } else if (eventRoll < 0.14) {
        // Shot off target
        shots[teamIdx]++;
        const shotX = isTeamA ? rng.range(88, 98) : rng.range(2, 12);
        const shotY = rng.chance(0.5) ? rng.range(5, 30) : rng.range(70, 95);
        ballX = shotX;
        ballY = shotY;

        events.push({
          minute,
          type: 'shot_off_target',
          teamId: currentTeam.id,
          description: `Shot goes wide by ${currentTeam.name}`,
          x: shotX,
          y: shotY,
        });
      } else if (eventRoll < 0.18) {
        // Corner
        corners[teamIdx]++;
        const cornerX = isTeamA ? 95 : 5;
        const cornerY = rng.chance(0.5) ? 5 : 95;
        ballX = cornerX;
        ballY = cornerY;

        events.push({
          minute,
          type: 'corner',
          teamId: currentTeam.id,
          description: `Corner kick for ${currentTeam.name}`,
          x: cornerX,
          y: cornerY,
        });
      } else if (eventRoll < 0.26) {
        // Foul
        fouls[teamIdx]++;
        const foulX = rng.range(20, 80);
        const foulY = rng.range(20, 80);
        ballX = foulX;
        ballY = foulY;

        events.push({
          minute,
          type: 'foul',
          teamId: currentTeam.id,
          description: `Foul by ${currentTeam.name}`,
          x: foulX,
          y: foulY,
        });

        // Chance of yellow card
        if (rng.chance(0.25)) {
          yellowCards[teamIdx]++;
          const fouler = currentLineup.starting11
            .map(id => [...teamA.players, ...teamB.players].find(p => p.id === id))
            .filter(p => p && ['CB', 'LB', 'RB', 'CDM', 'CM'].includes(p.position))
            [rng.int(0, 2)];

          events.push({
            minute: minute + 0.01,
            type: 'yellow_card',
            teamId: currentTeam.id,
            playerId: fouler?.id,
            description: `🟨 Yellow card for ${fouler?.name || 'Unknown'}`,
            x: foulX,
            y: foulY,
          });
        }

        // Very rare red card
        if (rng.chance(0.008)) {
          redCards[teamIdx]++;
          events.push({
            minute: minute + 0.02,
            type: 'red_card',
            teamId: currentTeam.id,
            description: `🟥 Red card! ${currentTeam.name} down to 10 men!`,
            x: foulX,
            y: foulY,
          });
        }
      } else if (eventRoll < 0.3) {
        // Offside
        const offX = isTeamA ? rng.range(80, 92) : rng.range(8, 20);
        const offY = rng.range(25, 75);
        ballX = offX;
        ballY = offY;

        events.push({
          minute,
          type: 'offside',
          teamId: currentTeam.id,
          description: `Offside against ${currentTeam.name}`,
          x: offX,
          y: offY,
        });
      } else {
        // Pass sequence
        const passCount = rng.int(1, 4);
        for (let p = 0; p < passCount; p++) {
          const passLoc = generatePassLocation(rng, currentTeam.id, isTeamA);
          ballX = passLoc.x;
          ballY = passLoc.y;
          passes[teamIdx]++;
        }

        if (rng.chance(0.3)) {
          events.push({
            minute,
            type: 'pass_sequence',
            teamId: currentTeam.id,
            description: `${currentTeam.name} maintain possession with a passing move`,
            x: ballX,
            y: ballY,
          });
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

  // Calculate possession percentages
  const totalPoss = possessionCount[0] + possessionCount[1] || 1;
  const possession: [number, number] = [
    Math.round((possessionCount[0] / totalPoss) * 100),
    Math.round((possessionCount[1] / totalPoss) * 100),
  ];

  // Generate player positions for animation
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
      Math.round(70 + strengthA.overall / 10),
      Math.round(70 + strengthB.overall / 10),
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

  for (let i = 0; i < Math.min(11, lineup.starting11.length); i++) {
    const slot = formation[i];
    const playerId = lineup.starting11[i];
    if (!slot || !playerId) continue;

    let baseX = slot.x + defLineShift * 15;
    let baseY = slot.y + widthShift * 10;

    // Ball attraction: players shift toward ball
    const ballAttrX = (ballX - baseX) * 0.12 + pressShift * 8;
    const ballAttrY = (ballY - baseY) * 0.08;
    baseX += ballAttrX;
    baseY += ballAttrY;

    // Clamp
    baseX = Math.max(2, Math.min(98, baseX));
    baseY = Math.max(3, Math.min(97, baseY));

    if (!isTeamA) {
      const mirrored = mirrorPosition(baseX, baseY);
      baseX = mirrored.x;
      baseY = mirrored.y;
    }

    positions.push({
      playerId,
      baseX,
      baseY,
      currentX: baseX,
      currentY: baseY,
      hasBall: false,
    });
  }

  return positions;
}

// Monte Carlo prediction
export function predictMatch(
  teamA: Team,
  teamB: Team,
  lineupA: Lineup,
  lineupB: Lineup,
  simulations: number = 500
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

// Generate minute-by-minute states for animation
export function generateAnimationFrames(
  teamA: Team,
  teamB: Team,
  lineupA: Lineup,
  lineupB: Lineup,
  seed: number = Date.now()
): MatchState[] {
  const fullMatch = simulateMatch(teamA, teamB, lineupA, lineupB, seed);
  const frames: MatchState[] = [];

  // Create a frame for each event + intermediate frames
  const sortedEvents = [...fullMatch.events].sort((a, b) => a.minute - b.minute);

  for (let minute = 0; minute <= 90; minute++) {
    const minuteEvents = sortedEvents.filter(e => Math.floor(e.minute) === minute);

    let ballX = 50, ballY = 50;
    let ballHolderTeamId = teamA.id;

    // Get last ball position from events up to this minute
    for (const evt of sortedEvents) {
      if (Math.floor(evt.minute) <= minute) {
        ballX = evt.x;
        ballY = evt.y;
        if (evt.teamId) ballHolderTeamId = evt.teamId;
      }
    }

    const teamAPositions = generatePlayerPositions(teamA, lineupA, ballX, ballY, true, lineupA.tactics);
    const teamBPositions = generatePlayerPositions(teamB, lineupB, ballX, ballY, false, lineupB.tactics);

    // Calculate stats up to this minute
    const relevantEvents = sortedEvents.filter(e => Math.floor(e.minute) <= minute);
    const goals = relevantEvents.filter(e => e.type === 'goal');
    const score: [number, number] = [
      goals.filter(e => e.teamId === teamA.id).length,
      goals.filter(e => e.teamId === teamB.id).length,
    ];

    frames.push({
      minute,
      score,
      possession: fullMatch.possession,
      shots: fullMatch.shots,
      shotsOnTarget: fullMatch.shotsOnTarget,
      corners: fullMatch.corners,
      fouls: fullMatch.fouls,
      yellowCards: fullMatch.yellowCards,
      redCards: fullMatch.redCards,
      passes: fullMatch.passes,
      passAccuracy: fullMatch.passAccuracy,
      ballX,
      ballY,
      teamAPositions,
      teamBPositions,
      events: minuteEvents,
      isPlaying: true,
      isFinished: minute >= 90,
      currentPhase: minute < 45 ? 'first_half' : minute === 45 ? 'half_time' : minute < 90 ? 'second_half' : 'full_time',
      ballHolderTeamId,
    });
  }

  return frames;
}
