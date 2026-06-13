#!/usr/bin/env python3
"""Parse all 48 FIFA World Cup 2026 squads from pre-fetched Wikipedia wikitext."""
import json
import re
import random

# ── Team metadata (48 teams) ────────────────────────────────────────────────
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

# Wikipedia uses accented "Curaçao" - map to our key
WIKI_NAME_MAP = {
    "Curaçao": "Curacao",
}

# ── Team strength tiers for rating adjustments ──────────────────────────────
TEAM_TIERS = {
    "France": 1, "Argentina": 1, "Brazil": 1, "England": 1, "Spain": 1, "Germany": 1,
    "Portugal": 2, "Netherlands": 2, "Belgium": 2, "Croatia": 2, "Colombia": 2, "Uruguay": 2,
    "Switzerland": 3, "Mexico": 3, "United States": 3, "Morocco": 3, "Japan": 3,
    "South Korea": 3, "Ecuador": 3, "Senegal": 3, "Turkey": 3, "Austria": 3,
    "Ivory Coast": 3, "Scotland": 3,
    "Australia": 4, "Canada": 4, "Paraguay": 4, "Ghana": 4, "Algeria": 4,
    "Egypt": 4, "Tunisia": 4, "Sweden": 4, "Norway": 4, "Czech Republic": 4,
    "Iran": 4, "Saudi Arabia": 4, "Qatar": 4, "Panama": 4, "DR Congo": 4,
    "Haiti": 5, "New Zealand": 5, "Bosnia and Herzegovina": 5, "Cape Verde": 5,
    "Curacao": 5, "Uzbekistan": 5, "Iraq": 5, "Jordan": 5, "South Africa": 5,
}
TIER_BOOST = {1: 5, 2: 3, 3: 1, 4: 0, 5: -3}

# ── Position assignment ─────────────────────────────────────────────────────

def assign_specific_position(pos_abbr, player_index):
    """Convert GK/DF/MF/FW to specific FIFA positions."""
    if pos_abbr == "GK":
        return "GK"
    if pos_abbr == "DF":
        # Realistic distribution: LB, CB, CB, RB, CB, CB, LB, RB
        df_pos = ["LB", "CB", "CB", "RB", "CB", "CB", "LB", "RB"]
        return df_pos[player_index % len(df_pos)]
    if pos_abbr == "MF":
        mf_pos = ["CDM", "CM", "CM", "CAM", "LM", "RM", "CDM", "CM", "CAM", "LM"]
        return mf_pos[player_index % len(mf_pos)]
    if pos_abbr == "FW":
        fw_pos = ["ST", "LW", "RW", "CF", "ST", "LW", "RW", "CF"]
        return fw_pos[player_index % len(fw_pos)]
    return "CM"


def generate_ratings(specific_pos, tier_boost=0, is_starter=True):
    """Generate realistic FIFA-style ratings based on specific position."""
    base = {
        "GK":  {"rating": 78, "pace": 45, "shooting": 20, "passing": 55, "dribbling": 30, "defending": 78, "physical": 78, "stamina": 55},
        "CB":  {"rating": 78, "pace": 62, "shooting": 35, "passing": 58, "dribbling": 50, "defending": 82, "physical": 82, "stamina": 70},
        "LB":  {"rating": 77, "pace": 82, "shooting": 48, "passing": 72, "dribbling": 74, "defending": 74, "physical": 72, "stamina": 84},
        "RB":  {"rating": 77, "pace": 82, "shooting": 48, "passing": 72, "dribbling": 74, "defending": 74, "physical": 72, "stamina": 84},
        "CDM": {"rating": 79, "pace": 66, "shooting": 58, "passing": 76, "dribbling": 72, "defending": 80, "physical": 80, "stamina": 86},
        "CM":  {"rating": 79, "pace": 70, "shooting": 64, "passing": 78, "dribbling": 76, "defending": 66, "physical": 74, "stamina": 82},
        "CAM": {"rating": 80, "pace": 74, "shooting": 72, "passing": 82, "dribbling": 84, "defending": 42, "physical": 62, "stamina": 76},
        "LM":  {"rating": 78, "pace": 84, "shooting": 64, "passing": 74, "dribbling": 80, "defending": 48, "physical": 66, "stamina": 82},
        "RM":  {"rating": 78, "pace": 84, "shooting": 64, "passing": 74, "dribbling": 80, "defending": 48, "physical": 66, "stamina": 82},
        "LW":  {"rating": 81, "pace": 90, "shooting": 74, "passing": 74, "dribbling": 88, "defending": 32, "physical": 58, "stamina": 78},
        "RW":  {"rating": 81, "pace": 90, "shooting": 74, "passing": 74, "dribbling": 88, "defending": 32, "physical": 58, "stamina": 78},
        "CF":  {"rating": 80, "pace": 76, "shooting": 80, "passing": 72, "dribbling": 82, "defending": 36, "physical": 72, "stamina": 76},
        "ST":  {"rating": 81, "pace": 82, "shooting": 84, "passing": 60, "dribbling": 78, "defending": 28, "physical": 78, "stamina": 76},
    }

    b = base.get(specific_pos, base["CM"])
    variation = lambda v: max(25, min(99, v + random.randint(-4, 4) + tier_boost))
    sub_penalty = 0 if is_starter else random.randint(2, 6)
    rating_val = max(55, min(95, b["rating"] + tier_boost + random.randint(-4, 4) - sub_penalty))

    return {
        "rating": rating_val,
        "pace": variation(b["pace"]),
        "shooting": variation(b["shooting"]),
        "passing": variation(b["passing"]),
        "dribbling": variation(b["dribbling"]),
        "defending": variation(b["defending"]),
        "physical": variation(b["physical"]),
        "stamina": variation(b["stamina"]),
    }


# ── Player line parser ──────────────────────────────────────────────────────

def parse_player_line(line):
    """Parse a {{nat fs g player|no=X|pos=XX|name=[[Name]]|...}} line."""
    # Pattern 1: name with wikilink [[Player Name]] or [[Name|Display]]
    match = re.search(
        r'\|no=(\d+)\s*\|pos=(GK|DF|MF|FW)\s*\|name=\[\[([^\]|]+)(?:\|[^\]]*)?\]\]',
        line
    )
    if match:
        number = int(match.group(1))
        pos = match.group(2)
        name = match.group(3).strip()
    else:
        # Pattern 2: name without wikilink
        match = re.search(
            r'\|no=(\d+)\s*\|pos=(GK|DF|MF|FW)\s*\|name=([^|}]+)',
            line
        )
        if not match:
            return None
        number = int(match.group(1))
        pos = match.group(2)
        name = match.group(3).strip()

    # Extract age from birth date and age2 template
    age_match = re.search(r'\|age=\{\{birth date and age2\|\d+\|\d+\|\d+\|(\d+)\|(\d+)\|(\d+)\}\}', line)
    age = None
    if age_match:
        # Calculate age at tournament start (June 11, 2026)
        birth_year = int(age_match.group(1))
        birth_month = int(age_match.group(2))
        birth_day = int(age_match.group(3))
        age = 2026 - birth_year
        if (6, 11) < (birth_month, birth_day):
            age -= 1

    # Clean name - remove disambiguation like "(footballer)"
    name = re.sub(r'\s*\(.*?\)\s*$', '', name)

    # Get last name for display
    parts = name.split()
    last_name = parts[-1] if len(parts) > 1 else name

    return {
        "number": number,
        "pos": pos,
        "name": name,
        "lastName": last_name,
        "age": age,
    }


# ── Main parsing logic ──────────────────────────────────────────────────────

def main():
    random.seed(42)  # Reproducible ratings

    # Read the pre-fetched full page wikitext
    with open("/home/z/my-project/wiki_full_page.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    wikitext = list(data["query"]["pages"].values())[0]["revisions"][0]["*"]

    print(f"Loaded wikitext: {len(wikitext)} characters")

    # Split into team sections
    # The format is: ===Team Name=== followed by content until next ===
    sections = re.split(r'===([^=]+)===\n', wikitext)

    all_teams = []
    total_players = 0
    failed_teams = []

    # sections[0] = preamble, sections[1] = first team name, sections[2] = first team content, ...
    team_sections = {}
    for i in range(1, len(sections) - 1, 2):
        team_name = sections[i].strip()
        team_content = sections[i + 1]
        # Only include actual team sections (skip summary sections)
        if team_name in ("Age", "Players", "Outfield players", "Goalkeepers", "Captains",
                         "Coaches", "Player representation by club", "Player representation by league system",
                         "Player representation by club confederation", "Average age of squads",
                         "Coach representation by country"):
            continue
        team_sections[team_name] = team_content

    print(f"Found {len(team_sections)} team sections")

    for team_name, content in team_sections.items():
        # Map Wikipedia name to our canonical name
        canonical_name = WIKI_NAME_MAP.get(team_name, team_name)
        meta = TEAM_META.get(canonical_name)
        if not meta:
            print(f"  WARNING: No metadata for '{team_name}' (canonical: '{canonical_name}'), skipping")
            failed_teams.append(team_name)
            continue

        # Parse player lines
        raw_players = []
        for line in content.split("\n"):
            if "{{nat fs g player" in line or "{{Nat fs g player" in line:
                p = parse_player_line(line)
                if p:
                    raw_players.append(p)

        if not raw_players:
            print(f"  WARNING: No players found for {team_name}")
            failed_teams.append(team_name)
            continue

        # Sort by squad number
        raw_players.sort(key=lambda p: p["number"])

        # Group by position to assign specific positions
        pos_indices = {"GK": 0, "DF": 0, "MF": 0, "FW": 0}

        tier = TEAM_TIERS.get(canonical_name, 4)
        tier_boost = TIER_BOOST.get(tier, 0)

        player_data = []
        for i, p in enumerate(raw_players):
            pos_idx = pos_indices[p["pos"]]
            pos_indices[p["pos"]] += 1
            specific_pos = assign_specific_position(p["pos"], pos_idx)
            is_starter = i < 11
            ratings = generate_ratings(specific_pos, tier_boost, is_starter)

            player_age = p.get("age") or random.randint(20, 34)

            player_data.append({
                "id": f"{meta['id']}{p['number']}",
                "name": p["lastName"],
                "position": specific_pos,
                "rating": ratings["rating"],
                "pace": ratings["pace"],
                "shooting": ratings["shooting"],
                "passing": ratings["passing"],
                "dribbling": ratings["dribbling"],
                "defending": ratings["defending"],
                "physical": ratings["physical"],
                "stamina": ratings["stamina"],
                "age": player_age,
            })

        # Calculate team ratings from starting XI
        starters = player_data[:11]
        atk = [p for p in starters if p["position"] in ("ST", "CF", "LW", "RW")]
        mid = [p for p in starters if p["position"] in ("CM", "CAM", "CDM", "LM", "RM")]
        dfn = [p for p in starters if p["position"] in ("CB", "LB", "RB", "GK")]

        atk_r = int(sum(p["rating"] for p in atk) / max(1, len(atk))) if atk else 72
        mid_r = int(sum(p["rating"] for p in mid) / max(1, len(mid))) if mid else 72
        def_r = int(sum(p["rating"] for p in dfn) / max(1, len(dfn))) if dfn else 72
        ovr_r = (atk_r + mid_r + def_r) // 3

        all_teams.append({
            "id": meta["id"],
            "name": canonical_name,
            "shortName": meta["shortName"],
            "color": meta["color"],
            "textColor": meta["textColor"],
            "continent": meta["continent"],
            "flag": meta["flag"],
            "attackRating": atk_r,
            "midfieldRating": mid_r,
            "defenseRating": def_r,
            "overallRating": ovr_r,
            "players": player_data,
        })

        total_players += len(player_data)
        print(f"  {canonical_name}: {len(player_data)} players (OVR: {ovr_r}, ATK: {atk_r}, MID: {mid_r}, DEF: {def_r})")

    # Save output
    output_path = "/home/z/my-project/scraped_squads.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_teams, f, indent=2, ensure_ascii=False)

    print("=" * 60)
    print(f"SCRAPE COMPLETE")
    print(f"  Teams successfully scraped: {len(all_teams)}/48")
    print(f"  Failed teams: {len(failed_teams)} ({', '.join(failed_teams) if failed_teams else 'none'})")
    print(f"  Total players: {total_players}")
    print(f"  Output: {output_path}")

    return all_teams


if __name__ == "__main__":
    main()
