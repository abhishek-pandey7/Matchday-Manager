#!/usr/bin/env python3
"""Convert scraped_squads.json to data.ts TypeScript file"""
import json

with open('/home/z/my-project/scraped_squads.json') as f:
    teams = json.load(f)

lines = []
lines.append("import { Team } from './types';")
lines.append("")
lines.append("export const TEAMS: Team[] = [")

for team in teams:
    lines.append("  {")
    lines.append(f"    id: '{team['id']}',")
    lines.append(f"    name: '{team['name']}',")
    lines.append(f"    shortName: '{team['shortName']}',")
    lines.append(f"    color: '{team['color']}',")
    lines.append(f"    textColor: '{team['textColor']}',")
    lines.append(f"    continent: '{team['continent']}',")
    lines.append(f"    flag: '{team['flag']}',")
    lines.append(f"    attackRating: {team['attackRating']},")
    lines.append(f"    midfieldRating: {team['midfieldRating']},")
    lines.append(f"    defenseRating: {team['defenseRating']},")
    lines.append(f"    overallRating: {team['overallRating']},")
    lines.append("    players: [")
    
    for p in team['players']:
        # Escape any single quotes in names
        name = p['name'].replace("'", "\\'")
        lines.append("      {")
        lines.append(f"        id: '{p['id']}',")
        lines.append(f"        name: '{name}',")
        lines.append(f"        position: '{p['position']}',")
        lines.append(f"        rating: {p['rating']},")
        lines.append(f"        pace: {p['pace']},")
        lines.append(f"        shooting: {p['shooting']},")
        lines.append(f"        passing: {p['passing']},")
        lines.append(f"        dribbling: {p['dribbling']},")
        lines.append(f"        defending: {p['defending']},")
        lines.append(f"        physical: {p['physical']},")
        lines.append(f"        stamina: {p['stamina']},")
        lines.append(f"        age: {p['age']},")
        lines.append("      },")
    
    lines.append("    ],")
    lines.append("  },")

lines.append("];")

output = "\n".join(lines)

with open('/home/z/my-project/src/lib/simulation/data.ts', 'w') as f:
    f.write(output)

print(f"Generated data.ts with {len(teams)} teams")
print(f"Total players: {sum(len(t['players']) for t in teams)}")
print(f"File size: {len(output)} bytes")
