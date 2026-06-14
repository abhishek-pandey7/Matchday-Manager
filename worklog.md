---
Task ID: 1
Agent: Main Agent
Task: Fix team selection bug and update squad data for FIFA World Cup 2026 app

Work Log:
- Read uploaded squad data file (48 teams with real player names from FIFA World Cup 2026)
- Read current SetupPage.tsx, matchStore.ts, data.ts, and types.ts
- Diagnosed team selection bug: store had hardcoded default team IDs ('argentina', 'france'), same-team selection was possible, no deselect option
- Fixed matchStore.ts: changed default teamAId/teamBId to empty strings, added deselect support in setTeamA/setTeamB, added empty lineup defaults
- Rewrote SetupPage.tsx: added disabledTeamId prop to prevent same-team selection, added X button to deselect teams, added empty state placeholder, improved visual feedback with "other side" label, added "Selected" badge, used useCallback for handlers
- Created Python script (scripts/update_squads.py) to parse the uploaded squad text and generate updated data.ts
- Ran the script successfully: parsed all 48 squads, matched all to existing team IDs, generated data.ts with real player names
- Verified app compiles and runs correctly
- Used browser agent to test: team selection works, deselect works, same-team prevention works, VS display works, Configure Tactics button enables correctly

Stage Summary:
- Team selection bug fixed - users can now select and update teams properly
- All 48 World Cup 2026 squads updated with real player names
- Added same-team prevention (disabled buttons with "other side" label)
- Added deselect functionality (X button on selected team card)
- App compiles and all functionality verified via browser testing
