# My Scoreboard Cleanup Handoff

## Current source of truth

- Team/game follows: `GamesToFollow`
- Golfer follows: `FollowedGolfers`
- Legacy sheets/functions to ignore/remove later: `FollowedTeams`, `GolfToFollow`
- Reusable modals: `src/components/modal.js`

## Cleanup completed in this ZIP

- Filled previously-empty `src/components/modal.js` with reusable modal helpers:
  - `openMessageModal`
  - `openConfirmModal`
  - `openGameEditModal`
  - `openGolferNoteModal`
- Removed page-level duplicated modal helper functions from `src/pages/scoreboard.js`.
- Updated `src/pages/scoreboard.js` to import modal helpers.
- Updated `src/pages/golfers.js` to import modal helpers.
- Added `Remove All` support on Golfers page using the existing backend API.
- Replaced browser `alert()` / `confirm()` usage in:
  - `src/pages/scoreboard.js`
  - `src/pages/golfers.js`
  - `src/pages/addgame.js`
- Cleaned `src/api.js` to remove unused legacy frontend exports:
  - `getFollowedTeams`
  - `addFollowedTeam`
  - `removeFollowedTeam`
  - `getGolfers`
  - `getWorldCupGames`
- Removed debug `window.testApi` with browser alerts from `src/app.js`.
- Ran `node --check` against all frontend JS files successfully.

## Important backend cleanup still needed in Apps Script

The frontend cleanup assumes these Apps Script API actions exist and work:

- `getFollowedGames`
- `addFollowedGame`
- `updateFollowedGame`
- `removeFollowedGame`
- `removeAllFollowedGames`
- `getAvailableGolfers`
- `getFollowedGolfers`
- `addFollowedGolfer`
- `removeFollowedGolfer`
- `updateFollowedGolferOrder`
- `removeAllFollowedGolfers`
- `getAvailableSports`
- `getTeamsForSport`
- `getAvailableGames`

The Apps Script backend should use `FollowedGolfers` only for golfers:

`Golfer | Note | Favorite | Created | SortOrder`

And `GamesToFollow` only for followed games.

## Next suggested cleanup steps

1. Clean Apps Script `Code.gs`:
   - remove or stop using `GolfToFollow`
   - remove duplicate `updateFollowedGame`
   - remove legacy `FollowedTeams` functions after confirming no frontend uses them
2. Test GitHub frontend pages:
   - Scoreboard edit/remove/remove all
   - Add game/golfer
   - Golfers edit/remove/remove all/manual sort
3. Then continue with favorites/PWA work.
