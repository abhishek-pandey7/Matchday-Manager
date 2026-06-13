---
Task ID: 1
Agent: Main Agent
Task: Add all 48 FIFA WC 2026 teams with accurate squads, flags, continent data; continent filter; smooth ball; accurate timeline; live substitutions

Work Log:
- Created Python script to generate data.ts with all 48 teams (768 players)
- Teams: 17 UEFA, 7 CONMEBOL, 6 CONCACAF, 8 AFC, 9 CAF, 1 OFC = 48 total
- Each team has 16 players with position-specific attributes auto-generated from overall rating
- All teams have continent and flag emoji fields
- Rewrote SetupPage.tsx with continent filter buttons and search bar
- Rewrote engine.ts with accurate cumulative stats per minute in animation frames
- Added smooth ball/player interpolation using requestAnimationFrame and easing in PitchCanvas.tsx
- Added live substitution support via applyLiveSubstitution() in engine.ts
- Added liveSub() action in matchStore.ts
- Added live substitution UI panel in SimulationPage.tsx
- Updated TacticsPage.tsx to show team flags
- Fixed TypeScript errors (tuple indexing with negative values)
- All tests pass: simulation, animation frames, timeline accuracy, live sub

Stage Summary:
- All 48 FIFA WC 2026 teams with accurate squads added to data.ts
- Continent filter (7 buttons: All, Europe, S. America, N. America, Asia, Africa, Oceania)
- Search bar for filtering teams by name
- Country flags displayed for all teams
- Smooth ball transitions with easeInOut interpolation using requestAnimationFrame
- Timeline now shows accurate cumulative stats matching animation events
- Live substitution UI: click "Sub" button during match to pause and make subs
- Build compiles successfully, all integration tests pass
