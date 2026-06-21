# My Scoreboard - Project Status

## Architecture Rules

* Upload GitHub repo ZIP and Apps Script ZIP when starting a new ChatGPT session.
* Never use alert() or confirm().
* All modals must use src/components/modal.js.
* Never create duplicate sheets or functions.
* Prefer existing components over creating new ones.
* Give full-file replacements for architectural changes.

---

## CSS Ownership

* main.css = app shell, forms, reusable modals
* cards.css = reusable card components
* scoreboard.css = scoreboard page only
* golfers.css = golfers page only
* worldcup.css = World Cup page only
* mobile.css = media queries only

---

## Google Sheets (Source of Truth)

### Active Sheets

* GamesToFollow
* FollowedGolfers
* FavoriteTeams
* WorldCupData
* WorldCupTeamsToFollow
* WorldCupFavoriteTeams
* SportsSettings
* AppSettings
* NFLData
* NBAData
* MLBData
* CFBData
* CBKData
* BowlData
* NCAATData
* GolfData

### Deprecated / Remove if Found

* GolfToFollow
* FollowedTeams
* Duplicate updateFollowedGame() implementations
* Duplicate modal implementations

---

## Features Completed

### Scoreboard

✓ Follow games
✓ Edit game modal
✓ Remove game modal
✓ Remove All modal
✓ Drag and drop ordering
✓ Spread and Notes redesign
✓ Grouping by sport
✓ Favorites (teams)

### Golf

✓ Follow golfers
✓ Remove golfer modal
✓ Remove All modal
✓ Drag and drop ordering
✓ Score Sort (default)
✓ Manual Sort toggle
✓ Notes support

### World Cup

✓ Follow teams
✓ Favorite teams
✓ Notes support
✓ Live/upcoming game detection

### Admin

✓ PIN protection
✓ Sports toggles
✓ Smart refresh triggers

### Infrastructure

✓ PWA shell
✓ Manifest
✓ Service Worker
✓ GitHub ZIP workflow
✓ Apps Script ZIP workflow
✓ Cleanup branch workflow

---

## Next Features

1. Favorite golfers
2. Persist golf sort mode setting
3. PWA install prompt/banner
4. Offline support improvements
5. UI polish and responsive improvements
6. Codebase cleanup and dead-code removal
7. Documentation updates
