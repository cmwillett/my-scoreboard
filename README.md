My Scoreboard Roku v0.10.4

## v0.10.4
- Fixes Info page About section rendering inside the scroll area.
- Tightens Info page spacing.
- Keeps Info rows aligned in clean columns.


## v0.11.7
- Fixed Roku runtime issue in exact team matching that could leave the app stuck on Checking pairing.


## v0.11.8
- Expanded scoreboard cards now display followed-team spread and notes.
- Compact scoreboard cards remain unchanged to preserve the tighter layout.


## v0.11.13
- Added "black box flight recorder" crash diagnostics: every meaningful step
  writes its name, a running count, and the current memory percentage to the
  registry (flushed immediately). Shown as a "Last session: ..." line on the
  pairing-required screen (or in Info page system rows once paired) on the
  next launch after a crash. Built because Store-installed/packaged channels
  can't be watched live over telnet, and the crash we're chasing only
  reproduces once installed through the Store - not sideloaded.

## v0.11.14
- The "Last session" diagnostic line turned out to be impractical to read in
  practice: the crash is happening consistently right around the pairing
  screen, fast enough that the message flashes and is gone before it can be
  read off the TV.
- Replaced screen-reading with automatic reporting: on every launch, if a
  leftover checkpoint from a run that didn't exit cleanly is found in the
  registry, it's now sent straight to the backend (`reportRokuDiagnostic`
  action in `Code.gs`, logged to a new `RokuDiagnostics` sheet) via a new
  fire-and-forget `DiagReportTask`. No more racing a crash-loop to read text
  off the screen - just check the sheet.
- Added several finer-grained checkpoints to narrow down exactly where the
  crash is happening: `init_start`/`device_id_ready`/`audio_setup_done`/
  `init_done` bracket `MainScene`'s setup steps, `render_pairing_done_N` is a
  new exit checkpoint pairing with the existing `render_pairing_N` entry one
  (tells us if the crash is during vs. right after that screen renders),
  `task_started_N` confirms the background data task actually launched, and
  `ApiTask.brs` now logs its own checkpoints around each network call
  (`apitask_start`, `apitask_firestore_device_done`,
  `apitask_pairing_check_done`, `apitask_ambient_music_done`,
  `apitask_settings_done`, `apitask_available_games_done`,
  `apitask_available_golfers_done`, `apitask_world_cup_done`,
  `apitask_done`) since that runs on its own thread in parallel with the
  screen render and was previously a blind spot.
