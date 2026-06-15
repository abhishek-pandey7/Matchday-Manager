# Task: Enhance Match Engine Realism

## Agent: Main Developer
## Status: Completed

## Summary of Changes Made to `/home/z/my-project/src/lib/simulation/engine.ts`

### 1. Rating-Based Dominance

#### a) Enhanced Possession Dominance
- **Old formula**: `0.5 + midDiff / 200` (~50/50 with small adjustments)
- **New formula**: `0.5 + (midDiff + overallDiff * 0.3) / 150`, capped at 0.75/0.25
- A team with 10+ overall advantage now gets ~60% possession
- A team with 15+ advantage gets ~65-70%
- Applied both for initial possession strength and per-minute recalculation

#### b) Shot Dominance
- Added `ratingShotBonus`: +0.003 per overall rating point advantage to shot probability
- Stronger teams generate significantly more shots
- **Matchup-weighted shot accuracy**: +15% accuracy per 0.1 matchup advantage on the attack side
- `shotOnTargetChance` is now calculated based on: base 60% + matchup accuracy bonus + attack strength bonus
- When shot isn't on target due to good defending, it generates a "blocked" event with matchup description

#### c) Pass Dominance
- Base pass accuracy now ranges from 65% (weak, mid=60) to 90% (elite, mid=90)
- Formula: `0.65 + (midRating - 60) / 100 * 0.25`
- Passes per minute scale with team attack strength: `basePasses + (attackStrength - 70) / 30 * 3`
- `passAccuracy` stat now reflects **actual simulated completion rate** (tracked `passesCompleted` alongside `passes`)

#### d) Event Distribution
- Stronger teams generate pass events more often (0.25 + ratingDiff * 0.005 base chance)
- **Turnover events**: Weaker teams lose possession more often
  - Turnover chance: `0.12 - (possessionTeamStrength - 70) * 0.002` (capped 0.03-0.20)
  - Turnover events describe who won the ball from whom
  - **Counter-attack opportunities**: 30% + max(0, -sideAdvantage) * 0.5 chance of quick counter after turnover

### 2. More Realistic 2D Player Movement

#### a) Ball-Following Movement
- **teamShiftX increased from 0.08 to 0.15** when ball is in attacking third
- Added **backward shift** of 0.05 when ball is in defending half (team drops back)
- **teamShiftY increased from 0.05 to 0.08** for more lateral team movement
- When ball is on one wing, opposite wing players tuck in, same-side players spread out

#### b) Position-Specific Movement (NEW)
- **GK**: Positions between ball and center of goal. Shifts laterally toward ball side (0.25 factor). Comes out to narrow angle when ball is close
- **CB**: Maintains a line as unit. First CB steps up to press, second covers. In defending third, tracks more aggressively. Shape coherence applied post-processing
- **FB/LB/RB**: Push up when team attacks on their side (overlap runs, +8 units). Tuck inside when defending. Width awareness based on ball position
- **CDM**: Always between ball and goal. Strong lateral tracking (0.18). Drops back when defending (attrX * 0.5). Limited forward position (stays behind 50)
- **CM**: Strong lateral movement (0.18). Pushes forward when team attacks
- **CAM**: Drifts into spaces between lines. Pushes into final third. Drifts away from ball Y to find pockets
- **Wingers**: Stay wide when attacking (hug touchline). Tuck in when defending. Ball on opposite wing → tuck in; same side → spread out
- **ST/CF**: Push into box when team attacks (+10). Come short when building. Make runs based on ball position

#### c) Team Shape Coherence
- CB line averaged post-processing: all CBs adjusted 30% toward average X to maintain defensive line
- Applied in both `generatePlayerPositions` and `generatePlayerPositionsWithJitter`

#### d) Increased Jitter and Smoothing
- Jitter increased from ±1.5 to ±2.5 for more visible movement
- **Frame-to-frame smoothing**: 40% blend from previous frame positions for organic movement
- Previous frame positions tracked via `prevTeamAPositions`/`prevTeamBPositions` in `generateAnimationFrames`

### 3. Individual Matchup Influence Enhancement

#### a) Matchup-Weighted Shot Success
- Shot accuracy bonus: `matchupAccuracyBonus = max(0, sideAdvantage) * 1.5` (0.1 advantage → +15%)
- Combined with attack strength for shot on target chance
- Defenders with advantage cause blocked shots with explicit descriptions

#### b) Matchup-Driven Event Descriptions
- New `buildMatchupDescription()` function generates context-aware descriptions
- "Vini Jr gets the better of [RB name] on the left!" when attacker dominates
- "[RB name] struggles to contain Vini Jr" for moderate advantages  
- "[Defender] contains [Attacker] well on the side" when defender dominates
- Foul descriptions now mention when a player was getting past their marker
- Applied to goals, shots, passes, and fouls

#### c) Side Dominance Accumulation
- `chooseAttackSide` weight increased from ±150 to ±250
- Teams with strong matchup advantages on one side attack there much more frequently

#### d) Individual Player Attributes in Matchups
- New `getMatchupAttributeRating()` function with position-specific attribute calculations:
  - **Winger vs Fullback**: `pace*0.5 + dribbling*0.5` vs `pace*0.4 + defending*0.6`
  - **Striker vs CB**: `shooting*0.5 + physical*0.5` vs `defending*0.6 + physical*0.4`
  - **CAM vs CDM**: `passing*0.4 + dribbling*0.6` vs `defending*0.6 + passing*0.4`
  - **CM vs CM/CDM**: `passing*0.5 + dribbling*0.3 + pace*0.2` vs `defending*0.5 + passing*0.3 + physical*0.2`
- Matchup advantage is **60% attribute-based + 40% overall** for nuanced calculations
- PlayerMatchup interface extended with `attackerName`, `defenderName`, `attackerAttributeRating`, `defenderAttributeRating`
- `selectPlayerForAction` now accepts optional `matchupAnalysis` and `isTeamA` to boost players with matchup advantages

### Additional Changes
- `calculateGoalExpectancy` enhanced: exponent increased from 1.02 to 1.035, midfield influence increased, max raised from 4.0 to 4.5
- Yellow card chance increased when defender is outmatched: 0.25 + max(0, -sideAdvantage) * 0.3
- Goal descriptions now include specific attacker-defender names when matchup advantage > 0.2

## Compilation Results
- TypeScript: ✅ No errors in engine.ts (4 pre-existing errors in other files)
- ESLint: ✅ Clean
