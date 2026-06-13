import { FormationType, Position } from './types';

// Formation positions as percentages of pitch (0-100)
// Team A plays left-to-right, Team B is mirrored
export interface FormationPosition {
  position: Position;
  x: number; // 0 = own goal line, 100 = opponent goal line
  y: number; // 0 = top, 100 = bottom
}

export const FORMATIONS: Record<FormationType, FormationPosition[]> = {
  '4-4-2': [
    { position: 'GK', x: 5, y: 50 },
    { position: 'LB', x: 22, y: 15 },
    { position: 'CB', x: 20, y: 37 },
    { position: 'CB', x: 20, y: 63 },
    { position: 'RB', x: 22, y: 85 },
    { position: 'LM', x: 45, y: 12 },
    { position: 'CM', x: 42, y: 37 },
    { position: 'CM', x: 42, y: 63 },
    { position: 'RM', x: 45, y: 88 },
    { position: 'ST', x: 72, y: 38 },
    { position: 'ST', x: 72, y: 62 },
  ],
  '4-3-3': [
    { position: 'GK', x: 5, y: 50 },
    { position: 'LB', x: 22, y: 15 },
    { position: 'CB', x: 20, y: 37 },
    { position: 'CB', x: 20, y: 63 },
    { position: 'RB', x: 22, y: 85 },
    { position: 'CM', x: 42, y: 30 },
    { position: 'CM', x: 40, y: 50 },
    { position: 'CM', x: 42, y: 70 },
    { position: 'LW', x: 65, y: 15 },
    { position: 'ST', x: 70, y: 50 },
    { position: 'RW', x: 65, y: 85 },
  ],
  '4-2-3-1': [
    { position: 'GK', x: 5, y: 50 },
    { position: 'LB', x: 22, y: 15 },
    { position: 'CB', x: 20, y: 37 },
    { position: 'CB', x: 20, y: 63 },
    { position: 'RB', x: 22, y: 85 },
    { position: 'CDM', x: 35, y: 38 },
    { position: 'CDM', x: 35, y: 62 },
    { position: 'LW', x: 55, y: 15 },
    { position: 'CAM', x: 52, y: 50 },
    { position: 'RW', x: 55, y: 85 },
    { position: 'ST', x: 72, y: 50 },
  ],
  '3-5-2': [
    { position: 'GK', x: 5, y: 50 },
    { position: 'CB', x: 20, y: 25 },
    { position: 'CB', x: 18, y: 50 },
    { position: 'CB', x: 20, y: 75 },
    { position: 'LWB', x: 40, y: 8 },
    { position: 'CM', x: 40, y: 32 },
    { position: 'CDM', x: 35, y: 50 },
    { position: 'CM', x: 40, y: 68 },
    { position: 'RWB', x: 40, y: 92 },
    { position: 'ST', x: 68, y: 38 },
    { position: 'ST', x: 68, y: 62 },
  ],
  '3-4-3': [
    { position: 'GK', x: 5, y: 50 },
    { position: 'CB', x: 20, y: 25 },
    { position: 'CB', x: 18, y: 50 },
    { position: 'CB', x: 20, y: 75 },
    { position: 'LM', x: 42, y: 12 },
    { position: 'CM', x: 38, y: 38 },
    { position: 'CM', x: 38, y: 62 },
    { position: 'RM', x: 42, y: 88 },
    { position: 'LW', x: 65, y: 18 },
    { position: 'ST', x: 70, y: 50 },
    { position: 'RW', x: 65, y: 82 },
  ],
  '5-3-2': [
    { position: 'GK', x: 5, y: 50 },
    { position: 'LWB', x: 28, y: 8 },
    { position: 'CB', x: 18, y: 28 },
    { position: 'CB', x: 16, y: 50 },
    { position: 'CB', x: 18, y: 72 },
    { position: 'RWB', x: 28, y: 92 },
    { position: 'CM', x: 42, y: 30 },
    { position: 'CM', x: 40, y: 50 },
    { position: 'CM', x: 42, y: 70 },
    { position: 'ST', x: 68, y: 38 },
    { position: 'ST', x: 68, y: 62 },
  ],
  '5-4-1': [
    { position: 'GK', x: 5, y: 50 },
    { position: 'LWB', x: 28, y: 8 },
    { position: 'CB', x: 18, y: 28 },
    { position: 'CB', x: 16, y: 50 },
    { position: 'CB', x: 18, y: 72 },
    { position: 'RWB', x: 28, y: 92 },
    { position: 'LM', x: 45, y: 15 },
    { position: 'CM', x: 42, y: 38 },
    { position: 'CM', x: 42, y: 62 },
    { position: 'RM', x: 45, y: 85 },
    { position: 'ST', x: 72, y: 50 },
  ],
  '4-1-4-1': [
    { position: 'GK', x: 5, y: 50 },
    { position: 'LB', x: 22, y: 15 },
    { position: 'CB', x: 20, y: 37 },
    { position: 'CB', x: 20, y: 63 },
    { position: 'RB', x: 22, y: 85 },
    { position: 'CDM', x: 35, y: 50 },
    { position: 'LM', x: 50, y: 12 },
    { position: 'CM', x: 48, y: 37 },
    { position: 'CM', x: 48, y: 63 },
    { position: 'RM', x: 50, y: 88 },
    { position: 'ST', x: 72, y: 50 },
  ],
};

// Position compatibility for auto-assigning players to formation slots
const POSITION_COMPATIBILITY: Record<Position, Position[]> = {
  'GK': ['GK'],
  'CB': ['CB'],
  'LB': ['LB', 'LWB'],
  'RB': ['RB', 'RWB'],
  'LWB': ['LWB', 'LB'],
  'RWB': ['RWB', 'RB'],
  'CDM': ['CDM', 'CM', 'CB'],
  'CM': ['CM', 'CDM', 'CAM'],
  'CAM': ['CAM', 'CM', 'CF'],
  'LM': ['LM', 'LW', 'LB'],
  'RM': ['RM', 'RW', 'RB'],
  'LW': ['LW', 'LM', 'CF', 'ST'],
  'RW': ['RW', 'RM', 'CF', 'ST'],
  'CF': ['CF', 'ST', 'CAM'],
  'ST': ['ST', 'CF', 'LW', 'RW'],
};

export function assignPlayersToFormation(
  playerIds: string[],
  players: { id: string; position: Position; rating: number }[],
  formation: FormationType
): string[] {
  const formationSlots = FORMATIONS[formation];
  const availablePlayers = [...players.filter(p => playerIds.includes(p.id))];
  const assigned: string[] = [];
  const used = new Set<string>();

  for (const slot of formationSlots) {
    const compatible = POSITION_COMPATIBILITY[slot.position];
    let bestPlayer = availablePlayers.find(p => !used.has(p.id) && compatible.includes(p.position));
    
    if (!bestPlayer) {
      // Fallback: pick best available by rating
      bestPlayer = availablePlayers
        .filter(p => !used.has(p.id))
        .sort((a, b) => b.rating - a.rating)[0];
    }

    if (bestPlayer) {
      assigned.push(bestPlayer.id);
      used.add(bestPlayer.id);
    }
  }

  return assigned;
}

export function getAutoLineup(
  players: { id: string; position: Position; rating: number }[],
  formation: FormationType
): string[] {
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const ids = sorted.map(p => p.id);
  return assignPlayersToFormation(ids, sorted, formation);
}

export function mirrorPosition(x: number, y: number): { x: number; y: number } {
  return { x: 100 - x, y: 100 - y };
}
