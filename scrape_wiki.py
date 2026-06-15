#!/usr/bin/env python3
"""Scrape all 48 FIFA World Cup 2026 squads from Wikipedia API with rate limiting"""
import json
import re
import urllib.request
import time
import random

TEAM_SECTIONS = {
    "Czech Republic": 2, "Mexico": 3, "South Africa": 4, "South Korea": 5,
    "Bosnia and Herzegovina": 7, "Canada": 8, "Qatar": 9, "Switzerland": 10,
    "Brazil": 12, "Haiti": 13, "Morocco": 14, "Scotland": 15,
    "Australia": 17, "Paraguay": 18, "Turkey": 19, "United States": 20,
    "Curacao": 22, "Ecuador": 23, "Germany": 24, "Ivory Coast": 25,
    "Japan": 27, "Netherlands": 28, "Sweden": 29, "Tunisia": 30,
    "Belgium": 32, "Egypt": 33, "Iran": 34, "New Zealand": 35,
    "Cape Verde": 37, "Saudi Arabia": 38, "Spain": 39, "Uruguay": 40,
    "France": 42, "Iraq": 43, "Norway": 44, "Senegal": 45,
    "Algeria": 47, "Argentina": 48, "Austria": 49, "Jordan": 50,
    "Colombia": 52, "DR Congo": 53, "Portugal": 54, "Uzbekistan": 55,
    "Croatia": 57, "England": 58, "Ghana": 59, "Panama": 60,
}

TEAM_META = {
    "Germany": {"id": "germany", "shortName": "GER", "color": "#FFFFFF", "textColor": "#000000", "continent": "UEFA", "flag": "🇩🇪"},
    "France": {"id": "france", "shortName": "FRA", "color": "#002395", "textColor": "#FFFFFF", "continent": "UEFA", "flag": "🇫🇷"},
    "Spain": {"id": "spain", "shortName": "ESP", "color": "#C60B1E", "textColor": "#FFFFFF", "continent": "UEFA", "flag": "🇪🇸"},
    "England": {"id": "england", "shortName": "ENG", "color": "#FFFFFF", "textColor": "#CF081F", "continent": "UEFA", "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿"},
    "Netherlands": {"id": "netherlands", "shortName": "NED", "color": "#FF6600", "textColor": "#FFFFFF", "continent": "UEFA", "flag": "🇳🇱"},
    "Portugal": {"id": "portugal", "shortName": "POR", "color": "#006600", "textColor": "#FFFFFF", "continent": "UEFA", "flag": "🇵🇹"},
    "Belgium": {"id": "belgium", "shortName": "BEL", "color": "#ED2939", "textColor": "#FFFFFF", "continent": "UEFA", "flag": "🇧🇪"},
    "Croatia": {"id": "croatia", "shortName": "CRO", "color": "#FF0000", "textColor": "#FFFFFF", "continent": "UEFA", "flag": "🇭🇷"},
    "Switzerland": {"id": "switzerland", "shortName": "SUI", "color": "#FF0000", "textColor": "#FFFFFF", "continent": "UEFA", "flag": "🇨🇭"},
    "Austria": {"id": "austria", "shortName": "AUT", "color": "#FFFFFF", "textColor": "#000000", "continent": "UEFA", "flag": "🇦🇹"},
    "Scotland": {"id": "scotland", "shortName": "SCO", "color": "#003087", "textColor": "#FFFFFF", "continent": "UEFA", "flag": "🏴󠁧󠁢󠁳󠁣󠁴󠁿"},
    "Turkey": {"id": "turkey", "shortName": "TUR", "color": "#E30A17", "textColor": "#FFFFFF", "continent": "UEFA", "flag": "🇹🇷"},
    "Czech Republic": {"id": "czech_republic", "shortName": "CZE", "color": "#FFFFFF", "textColor": "#11457E", "continent": "UEFA", "flag": "🇨🇿"},
    "Norway": {"id": "norway", "shortName": "NOR", "color": "#BA0C2F", "textColor": "#FFFFFF", "continent": "UEFA", "flag": "🇳🇴"},
    "Sweden": {"id": "sweden", "shortName": "SWE", "color": "#006AA7", "textColor": "#FECC02", "continent": "UEFA", "flag": "🇸🇪"},
    "Bosnia and Herzegovina": {"id": "bosnia", "shortName": "BIH", "color": "#00209F", "textColor": "#F7D618", "continent": "UEFA", "flag": "🇧🇦"},
    "Argentina": {"id": "argentina", "shortName": "ARG", "color": "#75AADB", "textColor": "#000000", "continent": "CONMEBOL", "flag": "🇦🇷"},
    "Brazil": {"id": "brazil", "shortName": "BRA", "color": "#FFDF00", "textColor": "#009739", "continent": "CONMEBOL", "flag": "🇧🇷"},
    "Colombia": {"id": "colombia", "shortName": "COL", "color": "#FCD116", "textColor": "#003893", "continent": "CONMEBOL", "flag": "🇨🇴"},
    "Uruguay": {"id": "uruguay", "shortName": "URU", "color": "#5DADE2", "textColor": "#000000", "continent": "CONMEBOL", "flag": "🇺🇾"},
    "Ecuador": {"id": "ecuador", "shortName": "ECU", "color": "#FFD100", "textColor": "#0033A0", "continent": "CONMEBOL", "flag": "🇪🇨"},
    "Paraguay": {"id": "paraguay", "shortName": "PAR", "color": "#D52B1E", "textColor": "#FFFFFF", "continent": "CONMEBOL", "flag": "🇵🇾"},
    "United States": {"id": "united_states", "shortName": "USA", "color": "#002868", "textColor": "#FFFFFF", "continent": "CONCACAF", "flag": "🇺🇸"},
    "Mexico": {"id": "mexico", "shortName": "MEX", "color": "#006341", "textColor": "#FFFFFF", "continent": "CONCACAF", "flag": "🇲🇽"},
    "Canada": {"id": "canada", "shortName": "CAN", "color": "#FF0000", "textColor": "#FFFFFF", "continent": "CONCACAF", "flag": "🇨🇦"},
    "Panama": {"id": "panama", "shortName": "PAN", "color": "#00529B", "textColor": "#FFFFFF", "continent": "CONCACAF", "flag": "🇵🇦"},
    "Haiti": {"id": "haiti", "shortName": "HAI", "color": "#00209F", "textColor": "#D21034", "continent": "CONCACAF", "flag": "🇭🇹"},
    "Curacao": {"id": "curacao", "shortName": "CUW", "color": "#002B7F", "textColor": "#FFFFFF", "continent": "CONCACAF", "flag": "🇨🇼"},
    "Japan": {"id": "japan", "shortName": "JPN", "color": "#000080", "textColor": "#FFFFFF", "continent": "AFC", "flag": "🇯🇵"},
    "South Korea": {"id": "south_korea", "shortName": "KOR", "color": "#CD2E3A", "textColor": "#FFFFFF", "continent": "AFC", "flag": "🇰🇷"},
    "Iran": {"id": "iran", "shortName": "IRN", "color": "#FFFFFF", "textColor": "#239F40", "continent": "AFC", "flag": "🇮🇷"},
    "Saudi Arabia": {"id": "saudi_arabia", "shortName": "KSA", "color": "#006C35", "textColor": "#FFFFFF", "continent": "AFC", "flag": "🇸🇦"},
    "Australia": {"id": "australia", "shortName": "AUS", "color": "#FFD700", "textColor": "#00843D", "continent": "AFC", "flag": "🇦🇺"},
    "Uzbekistan": {"id": "uzbekistan", "shortName": "UZB", "color": "#1EB53A", "textColor": "#FFFFFF", "continent": "AFC", "flag": "🇺🇿"},
    "Iraq": {"id": "iraq", "shortName": "IRQ", "color": "#FFFFFF", "textColor": "#000000", "continent": "AFC", "flag": "🇮🇶"},
    "Jordan": {"id": "jordan", "shortName": "JOR", "color": "#000000", "textColor": "#FFFFFF", "continent": "AFC", "flag": "🇯🇴"},
    "Qatar": {"id": "qatar", "shortName": "QAT", "color": "#8D1B3D", "textColor": "#FFFFFF", "continent": "AFC", "flag": "🇶🇦"},
    "Morocco": {"id": "morocco", "shortName": "MAR", "color": "#C1272D", "textColor": "#FFFFFF", "continent": "CAF", "flag": "🇲🇦"},
    "Senegal": {"id": "senegal", "shortName": "SEN", "color": "#00853F", "textColor": "#FFFFFF", "continent": "CAF", "flag": "🇸🇳"},
    "Ivory Coast": {"id": "ivory_coast", "shortName": "CIV", "color": "#F77F00", "textColor": "#009E60", "continent": "CAF", "flag": "🇨🇮"},
    "Algeria": {"id": "algeria", "shortName": "ALG", "color": "#006233", "textColor": "#FFFFFF", "continent": "CAF", "flag": "🇩🇿"},
    "Tunisia": {"id": "tunisia", "shortName": "TUN", "color": "#FF0000", "textColor": "#FFFFFF", "continent": "CAF", "flag": "🇹🇳"},
    "Egypt": {"id": "egypt", "shortName": "EGY", "color": "#C8102E", "textColor": "#FFFFFF", "continent": "CAF", "flag": "🇪🇬"},
    "Ghana": {"id": "ghana", "shortName": "GHA", "color": "#FFCE00", "textColor": "#000000", "continent": "CAF", "flag": "🇬🇭"},
    "South Africa": {"id": "south_africa", "shortName": "RSA", "color": "#FFB81C", "textColor": "#007749", "continent": "CAF", "flag": "🇿🇦"},
    "Cape Verde": {"id": "cape_verde", "shortName": "CPV", "color": "#003893", "textColor": "#FFFFFF", "continent": "CAF", "flag": "🇨🇻"},
    "DR Congo": {"id": "dr_congo", "shortName": "COD", "color": "#007FFF", "textColor": "#F10200", "continent": "CAF", "flag": "🇨🇩"},
    "New Zealand": {"id": "new_zealand", "shortName": "NZL", "color": "#000000", "textColor": "#FFFFFF", "continent": "OFC", "flag": "🇳🇿"},
}

def parse_player_line(line):
    match = re.search(r'\|no=(\d+)\|pos=(GK|DF|MF|FW)\|name=\[\[([^\]]+)\]\]', line)
    if not match:
        match = re.search(r'\|no=(\d+)\|pos=(GK|DF|MF|FW)\|name=([^|}]+)', line)
    if not match:
        return None
    number = int(match.group(1))
    pos = match.group(2)
    name = match.group(3).strip()
    name = re.sub(r'\s*\(.*?\)\s*$', '', name)
    parts = name.split()
    last_name = parts[-1] if parts else name
    return {"number": number, "pos": pos, "name": name, "lastName": last_name}

def get_specific_pos(pos, squad_number):
    if pos == "GK": return "GK"
    elif pos == "DF": return ["CB", "LB", "CB", "RB", "CB", "CB", "LB", "RB", "CB", "CB"][squad_number % 10]
    elif pos == "MF": return ["CDM", "CM", "CAM", "CM", "LM", "RM", "CDM", "CM", "CAM", "CM"][squad_number % 10]
    elif pos == "FW": return ["ST", "LW", "RW", "CF", "ST", "LW", "RW", "ST", "CF", "ST"][squad_number % 10]
    return "CM"

def fetch_section(section_idx):
    url = f"https://en.wikipedia.org/w/api.php?action=parse&page=2026_FIFA_World_Cup_squads&prop=wikitext&format=json&section={section_idx}"
    req = urllib.request.Request(url, headers={
        'User-Agent': 'FIFA2026SquadScraper/2.0 (research; contact@example.com)',
        'Accept': 'application/json',
    })
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
            return data.get('parse', {}).get('wikitext', {}).get('*', '')
        except Exception as e:
            if attempt < 2:
                time.sleep(3 * (attempt + 1))
            else:
                raise

def generate_ratings(pos, is_sub=False):
    import random
    random.seed(hash(pos + str(is_sub)) % 10000)
    base = {
        "GK": {"rating": 78, "pace": 45, "shooting": 20, "passing": 55, "dribbling": 35, "defending": 75, "physical": 78, "stamina": 55},
        "CB": {"rating": 79, "pace": 65, "shooting": 38, "passing": 62, "dribbling": 55, "defending": 82, "physical": 80, "stamina": 72},
        "LB": {"rating": 78, "pace": 80, "shooting": 50, "passing": 72, "dribbling": 72, "defending": 76, "physical": 74, "stamina": 82},
        "RB": {"rating": 78, "pace": 80, "shooting": 50, "passing": 72, "dribbling": 72, "defending": 76, "physical": 74, "stamina": 82},
        "CDM": {"rating": 80, "pace": 68, "shooting": 58, "passing": 78, "dribbling": 72, "defending": 80, "physical": 80, "stamina": 84},
        "CM": {"rating": 80, "pace": 70, "shooting": 65, "passing": 80, "dribbling": 78, "defending": 68, "physical": 74, "stamina": 82},
        "CAM": {"rating": 81, "pace": 72, "shooting": 72, "passing": 82, "dribbling": 82, "defending": 45, "physical": 65, "stamina": 76},
        "LM": {"rating": 79, "pace": 82, "shooting": 65, "passing": 76, "dribbling": 80, "defending": 50, "physical": 68, "stamina": 80},
        "RM": {"rating": 79, "pace": 82, "shooting": 65, "passing": 76, "dribbling": 80, "defending": 50, "physical": 68, "stamina": 80},
        "LW": {"rating": 82, "pace": 88, "shooting": 74, "passing": 75, "dribbling": 86, "defending": 35, "physical": 62, "stamina": 78},
        "RW": {"rating": 82, "pace": 88, "shooting": 74, "passing": 75, "dribbling": 86, "defending": 35, "physical": 62, "stamina": 78},
        "CF": {"rating": 81, "pace": 76, "shooting": 80, "passing": 72, "dribbling": 82, "defending": 38, "physical": 72, "stamina": 76},
        "ST": {"rating": 82, "pace": 82, "shooting": 84, "passing": 62, "dribbling": 78, "defending": 30, "physical": 78, "stamina": 76},
    }
    b = base.get(pos, base["CM"])
    v = lambda x: max(30, min(99, x + random.randint(-5, 5)))
    r = max(60, min(92, b["rating"] + random.randint(-6, 4) - (3 if is_sub else 0)))
    return {"rating": r, "pace": v(b["pace"]), "shooting": v(b["shooting"]), "passing": v(b["passing"]),
            "dribbling": v(b["dribbling"]), "defending": v(b["defending"]), "physical": v(b["physical"]), "stamina": v(b["stamina"])}

all_teams = []
items = list(TEAM_SECTIONS.items())

for i, (team_name, section_idx) in enumerate(items):
    meta = TEAM_META.get(team_name)
    if not meta:
        print(f"SKIP: No meta for {team_name}")
        continue
    
    print(f"[{i+1}/48] {team_name}...", end=" ", flush=True)
    
    try:
        wikitext = fetch_section(section_idx)
    except Exception as e:
        print(f"ERROR: {e}")
        continue
    
    players = []
    for line in wikitext.split('\n'):
        if '{{nat fs g player' in line:
            p = parse_player_line(line)
            if p:
                players.append(p)
    
    if not players:
        print(f"NO PLAYERS")
        continue
    
    print(f"{len(players)} players", flush=True)
    
    player_data = []
    for j, p in enumerate(players):
        sp = get_specific_pos(p["pos"], p["number"])
        ratings = generate_ratings(sp, is_sub=(j >= 11))
        player_data.append({
            "id": f"{meta['id']}{j+1}",
            "name": p["lastName"],
            "position": sp,
            **ratings,
            "age": 20 + (j * 3 % 15),
        })
    
    starting = player_data[:11]
    atk_ps = [p for p in starting if p["position"] in ["ST", "CF", "LW", "RW"]]
    mid_ps = [p for p in starting if p["position"] in ["CM", "CAM", "CDM", "LM", "RM"]]
    def_ps = [p for p in starting if p["position"] in ["CB", "LB", "RB", "GK"]]
    atk = sum(p["rating"] for p in atk_ps) // max(1, len(atk_ps))
    mid = sum(p["rating"] for p in mid_ps) // max(1, len(mid_ps))
    dfn = sum(p["rating"] for p in def_ps) // max(1, len(def_ps))
    ovr = (atk + mid + dfn) // 3
    
    all_teams.append({**meta, "attackRating": atk, "midfieldRating": mid, "defenseRating": dfn, "overallRating": ovr, "players": player_data})
    
    time.sleep(2)  # 2 second delay between requests

with open('/home/z/my-project/scraped_squads.json', 'w') as f:
    json.dump(all_teams, f, indent=2)

print(f"\nDone! {len(all_teams)} teams, {sum(len(t['players']) for t in all_teams)} players")
