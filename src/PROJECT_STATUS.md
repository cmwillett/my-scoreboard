# My Scoreboard - Project Status

## Current Frontend
- Repo: https://github.com/cmwillett/my-scoreboard/
- Hosting: GitHub Pages
- Backend: Google Apps Script + Google Sheets
- Frontend uses ES modules under `src/`

## Main Navigation
- Scores
- Golfers
- World Cup
- Admin

`Add Game/Golfer` is still available as code, but the long-term direction is to move add/manage tools into Admin.

## Architecture Rules
- Upload latest GitHub repo ZIP and Apps Script ZIP when starting a new ChatGPT session.
- Never use `alert()` or `confirm()`.
- All modals must use `src/components/modal.js`.
- Never create duplicate sheets or duplicate source-of-truth functions.
- Prefer existing components over creating new ones.
- Give full-file replacements for architecture changes.
- CSS ownership matters:
  - `main.css` = app shell, forms, reusable modals, generic admin/list utilities
  - `cards.css` = reusable score/game card components
  - `scoreboard.css` = scoreboard page layout and game picker styles
  - `golfers.css` = golfers page layout/table/sort/drag styles
  - `worldcup.css` = World Cup page only
  - `mobile.css` = responsive overrides only

## Active Sheets / Source of Truth
- `GamesToFollow` = manually followed specific games
- `FavoriteTeams` = teams that auto-display on Scoreboard
- `FollowedGolfers` = followed golfers, notes, favorite flag, created date, manual sort order
- `WorldCupData`
- `WorldCupTeamsToFollow`
- `WorldCupFavoriteTeams`
- `SportsSettings`
- `AppSettings`
- Sports data sheets: `NFLData`, `NBAData`, `MLBData`, `CFBData`, `CBKData`, `BowlData`, `NCAATData`, `GolfData`
- Team sheets: `NFLTeams`, `NBATeams`, `MLBTeams`, `CFBTeams`, `CBBTeams`

## Deprecated / Do Not Use
- `FollowedTeams`
- `GolfToFollow`
- duplicate modal implementations inside page files
- duplicate `updateFollowedGame()` implementations

## Completed Features

### Scoreboard
- Shows followed games from `GamesToFollow`
- Shows favorite-team games from `FavoriteTeams`
- Favorite teams should display live game first, otherwise next upcoming game, otherwise most recent final game
- Manual followed game cards support spread/notes, edit modal, remove modal, remove all modal
- Favorite-team cards show a Favorite Team indicator and do not show edit/remove buttons
- Games grouped into Live / Upcoming / Final sections by sport

### Golfers
- Shows followed golfers from `FollowedGolfers`
- Score Sort is default
- Manual Sort toggle exists
- Manual Sort supports drag/drop ordering saved to `FollowedGolfers.SortOrder`
- Notes support with modal editing
- Remove and Remove All use modals

### Admin
- PIN protected using `AppSettings.pin` through `checkAdminPin` API
- Admin unlock is remembered per device in `localStorage`
- Favorite Teams management added
- Add/manage tools will continue moving here over time

### Infrastructure
- PWA shell exists
- Manifest exists
- Service worker exists
- GitHub ZIP workflow established
- Apps Script ZIP workflow established
- Cleanup branch workflow established

## Next Features
1. Move Add Game/Golfer into Admin fully
2. Page visibility toggles so pages like World Cup can be hidden without deleting code
3. Build/finish World Cup page in GitHub frontend
4. Build/finish Admin page tools
5. Improve refresh behavior so backend refreshes scores and frontend updates content without full-page reloads
6. PWA install prompt/banner
7. Ongoing cleanup/dead-code removal


## Latest Update
- Favorite-team games can be edited from the Scores page to add game-specific spread and notes. Editing a favorite-team game saves an override in GamesToFollow while keeping the Favorite Team label.
