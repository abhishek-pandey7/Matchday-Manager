#!/usr/bin/env python3
"""
Parse the uploaded squad data and generate an updated data.ts
with real player names from the FIFA World Cup 2026 squads.
"""
import re
import json
import os

# Read the uploaded squad data
with open('/home/z/my-project/upload/Pasted Content_1781466233968.txt', 'r', encoding='utf-8') as f:
    squad_text = f.read()

# Read the current data.ts to extract existing team metadata (colors, ratings, etc.)
with open('/home/z/my-project/src/lib/simulation/data.ts', 'r', encoding='utf-8') as f:
    current_data = f.read()

# Parse teams from current data.ts - extract team metadata
team_pattern = re.compile(
    r"id: '([^']+)',\s*"
    r"name: '([^']+)',\s*"
    r"shortName: '([^']+)',\s*"
    r"color: '([^']+)',\s*"
    r"textColor: '([^']+)',\s*"
    r"continent: '([^']+)',\s*"
    r"flag: '([^']+)',\s*"
    r"attackRating: (\d+),\s*"
    r"midfieldRating: (\d+),\s*"
    r"defenseRating: (\d+),\s*"
    r"overallRating: (\d+)",
    re.MULTILINE
)

existing_teams = {}
existing_team_order = []
for m in team_pattern.finditer(current_data):
    team_id = m.group(1)
    existing_teams[team_id] = {
        'id': team_id,
        'name': m.group(2),
        'shortName': m.group(3),
        'color': m.group(4),
        'textColor': m.group(5),
        'continent': m.group(6),
        'flag': m.group(7),
        'attackRating': int(m.group(8)),
        'midfieldRating': int(m.group(9)),
        'defenseRating': int(m.group(10)),
        'overallRating': int(m.group(11)),
    }
    existing_team_order.append(team_id)

print(f"Found {len(existing_teams)} existing teams in data.ts")

# Parse the squad text file
def parse_squads(text):
    """Parse the squad text file into a dict of team_name -> {position: [player_names]}"""
    squads = {}
    
    # Split into lines
    lines = text.strip().split('\n')
    i = 0
    current_team = None
    current_positions = {}
    
    while i < len(lines):
        line = lines[i].strip()
        
        if not line or line.startswith('GROUP'):
            i += 1
            continue
        
        # Check if this is a position line
        pos_match = re.match(r'^(Goalkeepers?|Defenders?|Midfielders?|Forwards?)s?:\s*(.+)', line, re.IGNORECASE)
        if pos_match:
            pos_label = pos_match.group(1)
            players_text = pos_match.group(2)
            
            # Map position labels
            pos_map = {
                'Goalkeeper': 'GK',
                'Goalkeepers': 'GK',
                'Defender': 'DEF',
                'Defenders': 'DEF',
                'Midfielder': 'MID',
                'Midfielders': 'MID',
                'Forward': 'FWD',
                'Forwards': 'FWD',
            }
            pos_key = pos_map.get(pos_label, 'MID')
            
            # Parse player names: "Name (Club), Name (Club), ..."
            # Handle cases where club names contain commas
            player_entries = re.findall(r'([^,()]+)\s*\([^)]*\)', players_text)
            players = [p.strip() for p in player_entries if p.strip()]
            
            # Fallback: if no parenthetical clubs found, try comma split
            if not players:
                parts = players_text.split(',')
                for part in parts:
                    name = re.sub(r'\s*\([^)]*\)', '', part).strip()
                    if name:
                        players.append(name)
            
            if current_team:
                current_positions[pos_key] = players
            
            i += 1
            continue
        
        # Check if this is a Manager line
        if line.startswith('Manager:'):
            if current_team and current_positions:
                squads[current_team] = current_positions
            current_team = None
            current_positions = {}
            i += 1
            continue
        
        # Check if this is an announcement line
        if re.match(r'(Final squad|Final roster|Roster announced)', line, re.IGNORECASE):
            i += 1
            continue
        
        # This might be a team name - typically a capitalized name, no special chars
        if (not re.match(r'^(Goalkeeper|Defender|Midfielder|Forward|Manager|GROUP)', line, re.IGNORECASE)
            and not re.match(r'^(Final|Roster)', line, re.IGNORECASE)
            and len(line) < 60
            and not re.search(r'[(){}[\]0-9]', line)
            and line[0].isupper()):
            
            # Save previous team
            if current_team and current_positions:
                squads[current_team] = current_positions
            
            current_team = line.strip()
            current_positions = {}
            i += 1
            continue
        
        i += 1
    
    # Don't forget the last team
    if current_team and current_positions:
        squads[current_team] = current_positions
    
    return squads

squads = parse_squads(squad_text)
print(f"Parsed {len(squads)} squads from the uploaded file:")
for name, positions in squads.items():
    total = sum(len(p) for p in positions.values())
    pos_summary = {k: len(v) for k, v in positions.items()}
    print(f"  {name}: {total} players - {pos_summary}")

# Map squad names to existing team IDs
name_to_id = {}
for team_id, team_data in existing_teams.items():
    name_to_id[team_data['name']] = team_id

# Manual mappings for names that don't exactly match
manual_mappings = {
    'South Korea': 'south_korea',
    'Czech Republic': 'czech_republic',
    'United States': 'united_states',
    'Ivory Coast': 'ivory_coast',
    'Cape Verde': 'cape_verde',
    'Congo DR': 'dr_congo',
    'DR Congo': 'dr_congo',
    'New Zealand': 'new_zealand',
    'Bosnia and Herzegovina': 'bosnia',
    'Bosnia': 'bosnia',
}

# Match squads to teams
matched = {}
unmatched_squads = []
for squad_name, positions in squads.items():
    team_id = None
    
    if squad_name in name_to_id:
        team_id = name_to_id[squad_name]
    elif squad_name in manual_mappings:
        team_id = manual_mappings[squad_name]
    else:
        for existing_name, existing_id in name_to_id.items():
            if existing_name.lower() == squad_name.lower():
                team_id = existing_id
                break
        if not team_id:
            for existing_name, existing_id in name_to_id.items():
                if squad_name.lower() in existing_name.lower() or existing_name.lower() in squad_name.lower():
                    team_id = existing_id
                    break
    
    if team_id:
        matched[team_id] = positions
    else:
        unmatched_squads.append(squad_name)

print(f"\nMatched {len(matched)} squads to existing teams")
print(f"Unmatched squads: {unmatched_squads}")

# Generate position-specific player data
def position_for_role(pos_group, index, total):
    """Assign specific positions within a position group"""
    if pos_group == 'GK':
        return 'GK'
    elif pos_group == 'DEF':
        def_positions = ['CB', 'CB', 'LB', 'RB', 'CB', 'LWB', 'RWB', 'CB', 'LB', 'RB', 'CB']
        return def_positions[index % len(def_positions)]
    elif pos_group == 'MID':
        mid_positions = ['CDM', 'CM', 'CM', 'CAM', 'LM', 'RM', 'CDM', 'CM', 'CAM', 'LM', 'RM']
        return mid_positions[index % len(mid_positions)]
    elif pos_group == 'FWD':
        fwd_positions = ['ST', 'LW', 'RW', 'CF', 'ST', 'LW', 'RW']
        return fwd_positions[index % len(fwd_positions)]
    return 'CM'

def generate_player_stats(rating, position, seed=0):
    """Generate realistic attribute values based on overall rating and position"""
    import hashlib
    h = seed % 7
    
    if position == 'GK':
        return {
            'pace': max(30, min(60, rating - 28 + h)),
            'shooting': max(15, min(40, rating - 42 + h)),
            'passing': max(40, min(70, rating - 18 + h)),
            'dribbling': max(20, min(45, rating - 32 + h)),
            'defending': max(62, min(92, rating + 4 + h)),
            'physical': max(62, min(88, rating - 6 + h)),
            'stamina': max(40, min(72, rating - 22 + h)),
        }
    elif position in ['CB']:
        return {
            'pace': max(55, min(78, rating - 12 + h)),
            'shooting': max(30, min(55, rating - 28 + h)),
            'passing': max(48, min(75, rating - 12 + h)),
            'dribbling': max(42, min(68, rating - 16 + h)),
            'defending': max(64, min(95, rating + 6 + h)),
            'physical': max(65, min(90, rating - 4 + h)),
            'stamina': max(65, min(85, rating - 8 + h)),
        }
    elif position in ['LB', 'RB', 'LWB', 'RWB']:
        return {
            'pace': max(68, min(92, rating - 4 + h)),
            'shooting': max(35, min(60, rating - 22 + h)),
            'passing': max(55, min(82, rating - 6 + h)),
            'dribbling': max(55, min(80, rating - 8 + h)),
            'defending': max(60, min(88, rating + 2 + h)),
            'physical': max(62, min(85, rating - 6 + h)),
            'stamina': max(72, min(92, rating - 2 + h)),
        }
    elif position == 'CDM':
        return {
            'pace': max(55, min(82, rating - 8 + h)),
            'shooting': max(50, min(72, rating - 12 + h)),
            'passing': max(62, min(88, rating + 2 + h)),
            'dribbling': max(58, min(80, rating - 6 + h)),
            'defending': max(68, min(92, rating + 8 + h)),
            'physical': max(70, min(90, rating - 2 + h)),
            'stamina': max(75, min(95, rating + 2 + h)),
        }
    elif position in ['CM', 'CAM']:
        is_cam = position == 'CAM'
        return {
            'pace': max(58, min(85, rating - 6 + h + (3 if is_cam else 0))),
            'shooting': max(55, min(85, rating - 4 + h + (5 if is_cam else 0))),
            'passing': max(65, min(92, rating + 5 + h)),
            'dribbling': max(62, min(90, rating + 2 + h + (3 if is_cam else 0))),
            'defending': max(40, min(72, rating - 18 + h - (8 if is_cam else 0))),
            'physical': max(58, min(82, rating - 10 + h)),
            'stamina': max(68, min(90, rating - 4 + h)),
        }
    elif position in ['LM', 'RM']:
        return {
            'pace': max(68, min(90, rating + h)),
            'shooting': max(55, min(80, rating - 6 + h)),
            'passing': max(62, min(88, rating + 2 + h)),
            'dribbling': max(65, min(90, rating + 3 + h)),
            'defending': max(35, min(62, rating - 22 + h)),
            'physical': max(55, min(78, rating - 12 + h)),
            'stamina': max(70, min(90, rating - 4 + h)),
        }
    elif position == 'ST':
        return {
            'pace': max(65, min(92, rating - 2 + h)),
            'shooting': max(68, min(95, rating + 6 + h)),
            'passing': max(50, min(78, rating - 14 + h)),
            'dribbling': max(62, min(88, rating + h)),
            'defending': max(20, min(45, rating - 38 + h)),
            'physical': max(62, min(88, rating - 6 + h)),
            'stamina': max(62, min(85, rating - 8 + h)),
        }
    elif position in ['LW', 'RW']:
        return {
            'pace': max(75, min(96, rating + 4 + h)),
            'shooting': max(60, min(88, rating + 2 + h)),
            'passing': max(55, min(82, rating - 8 + h)),
            'dribbling': max(72, min(95, rating + 5 + h)),
            'defending': max(22, min(48, rating - 36 + h)),
            'physical': max(52, min(78, rating - 14 + h)),
            'stamina': max(65, min(88, rating - 6 + h)),
        }
    elif position == 'CF':
        return {
            'pace': max(62, min(88, rating - 2 + h)),
            'shooting': max(65, min(92, rating + 4 + h)),
            'passing': max(58, min(82, rating - 8 + h)),
            'dribbling': max(68, min(92, rating + 3 + h)),
            'defending': max(22, min(48, rating - 34 + h)),
            'physical': max(58, min(82, rating - 10 + h)),
            'stamina': max(62, min(85, rating - 8 + h)),
        }
    
    # Default
    return {
        'pace': max(55, min(85, rating - 5 + h)),
        'shooting': max(50, min(80, rating - 8 + h)),
        'passing': max(55, min(85, rating - 3 + h)),
        'dribbling': max(55, min(85, rating - 2 + h)),
        'defending': max(40, min(80, rating - 10 + h)),
        'physical': max(55, min(82, rating - 6 + h)),
        'stamina': max(65, min(88, rating - 4 + h)),
    }

def clamp(val, min_val, max_val):
    return max(min_val, min(max_val, val))

# Generate the updated data.ts content
output_lines = []
output_lines.append("import { Team } from './types';")
output_lines.append("")
output_lines.append("export const TEAMS: Team[] = [")

for team_id in existing_team_order:
    team_data = existing_teams[team_id]
    output_lines.append("  {")
    output_lines.append(f"    id: '{team_id}',")
    output_lines.append(f"    name: '{team_data['name']}',")
    output_lines.append(f"    shortName: '{team_data['shortName']}',")
    output_lines.append(f"    color: '{team_data['color']}',")
    output_lines.append(f"    textColor: '{team_data['textColor']}',")
    output_lines.append(f"    continent: '{team_data['continent']}',")
    output_lines.append(f"    flag: '{team_data['flag']}',")
    output_lines.append(f"    attackRating: {team_data['attackRating']},")
    output_lines.append(f"    midfieldRating: {team_data['midfieldRating']},")
    output_lines.append(f"    defenseRating: {team_data['defenseRating']},")
    output_lines.append(f"    overallRating: {team_data['overallRating']},")
    output_lines.append("    players: [")
    
    players = []
    player_idx = 0
    
    if team_id in matched:
        squad_positions = matched[team_id]
        overall = team_data['overallRating']
        
        for pos_group in ['GK', 'DEF', 'MID', 'FWD']:
            if pos_group not in squad_positions:
                continue
            
            for j, player_name in enumerate(squad_positions[pos_group]):
                position = position_for_role(pos_group, j, len(squad_positions[pos_group]))
                player_idx += 1
                player_id = f"{team_id}{player_idx}"
                
                # Calculate rating based on position group and team overall
                if pos_group == 'GK':
                    rating = clamp(overall - 3 + (3 if j == 0 else -2), 64, 90)
                elif pos_group == 'DEF':
                    rating = clamp(overall - 2 + (3 if j < 4 else -2), 64, 90)
                elif pos_group == 'MID':
                    rating = clamp(overall + (3 if j < 3 else -1), 64, 92)
                else:
                    rating = clamp(overall + 2 + (3 if j == 0 else -1), 64, 94)
                
                rating = clamp(rating + (j % 3 - 1), 62, 95)
                
                stats = generate_player_stats(rating, position, seed=player_idx)
                age = 22 + (player_idx % 13)
                
                safe_name = player_name.replace("'", "\\'")
                
                players.append({
                    'id': player_id,
                    'name': safe_name,
                    'position': position,
                    'rating': rating,
                    **stats,
                    'age': age,
                })
    else:
        # Generate generic players for unmatched teams
        overall = team_data['overallRating']
        for pos_group in ['GK', 'DEF', 'MID', 'FWD']:
            pos_counts = {'GK': 3, 'DEF': 7, 'MID': 7, 'FWD': 5}
            for j in range(pos_counts.get(pos_group, 5)):
                position = position_for_role(pos_group, j, pos_counts.get(pos_group, 5))
                player_idx += 1
                player_id = f"{team_id}{player_idx}"
                rating = clamp(overall - 5 + (j % 5), 60, 88)
                stats = generate_player_stats(rating, position, seed=player_idx)
                age = 22 + (player_idx % 13)
                safe_name = f"{team_data['shortName']} Player {player_idx}"
                players.append({
                    'id': player_id,
                    'name': safe_name,
                    'position': position,
                    'rating': rating,
                    **stats,
                    'age': age,
                })
    
    for p in players:
        output_lines.append("      {")
        output_lines.append(f"        id: '{p['id']}',")
        output_lines.append(f"        name: '{p['name']}',")
        output_lines.append(f"        position: '{p['position']}',")
        output_lines.append(f"        rating: {p['rating']},")
        output_lines.append(f"        pace: {p['pace']},")
        output_lines.append(f"        shooting: {p['shooting']},")
        output_lines.append(f"        passing: {p['passing']},")
        output_lines.append(f"        dribbling: {p['dribbling']},")
        output_lines.append(f"        defending: {p['defending']},")
        output_lines.append(f"        physical: {p['physical']},")
        output_lines.append(f"        stamina: {p['stamina']},")
        output_lines.append(f"        age: {p['age']},")
        output_lines.append("      },")
    
    output_lines.append("    ],")
    output_lines.append("  },")

output_lines.append("];")

output_content = '\n'.join(output_lines)
with open('/home/z/my-project/src/lib/simulation/data.ts', 'w', encoding='utf-8') as f:
    f.write(output_content)

print(f"\nGenerated data.ts with {len(existing_team_order)} teams")
print(f"Total lines: {len(output_lines)}")
