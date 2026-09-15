
function mainRegistrySection() as object
  return CreateObject("roRegistrySection", "MyScoreboard")
end function

function mainRandomNumberText(maxValue as integer) as string
  n = Rnd(maxValue)
  if n < 0 then n = n * -1
  return n.ToStr()
end function

function mainDeviceId() as string
  section = mainRegistrySection()
  if section.Exists("deviceId") then
    existing = section.Read("deviceId")
    if existing <> invalid and existing <> "" then return existing
  end if

  dt = CreateObject("roDateTime")
  dt.ToLocalTime()
  id = "roku_" + dt.AsSeconds().ToStr() + "_" + mainRandomNumberText(999999)
  section.Write("deviceId", id)
  section.Flush()
  return id
end function

function mainPairCode() as string
  section = mainRegistrySection()
  if section.Exists("pairCode") then
    existing = section.Read("pairCode")
    if existing <> invalid and existing <> "" then return existing
  end if

  dt = CreateObject("roDateTime")
  dt.ToLocalTime()
  codeNum = (dt.AsSeconds() * 37) MOD 900000
  if codeNum < 0 then codeNum = codeNum * -1
  codeNum = codeNum + 100000
  code = codeNum.ToStr()
  section.Write("pairCode", code)
  section.Flush()
  return code
end function

' --- Crash diagnostics -------------------------------------------------------
' The Channel Store-installed version of this app cannot be watched live over
' telnet (packaged/signed channels don't expose the debug console at all, only
' dev-installed ones do), and testing has shown the crash only happens once
' it's actually installed through the Store - not sideloaded, even from the
' identical .pkg. So this is a "black box flight recorder": every meaningful
' step writes its name, a running count, and the current memory percentage to
' the registry (flushed immediately, so it survives an abrupt kill), and the
' Info page displays whatever was last recorded. After a crash, reopening the
' app and checking Info tells us exactly how far it got and how much memory
' pressure it was under at that point, with no live connection required.
function currentMemPercent() as integer
  monitor = CreateObject("roAppMemoryMonitor")
  if monitor = invalid then return -1
  percent = monitor.GetMemoryLimitPercent()
  if percent = invalid then return -1
  return percent
end function

function readPreviousDiag() as object
  section = mainRegistrySection()
  out = { checkpoint: "", time: "", memPercent: "", count: "" }
  if not section.Exists("diag_lastCheckpoint") then return out

  out.checkpoint = section.Read("diag_lastCheckpoint")
  if section.Exists("diag_lastCheckpointTime") then out.time = section.Read("diag_lastCheckpointTime")
  if section.Exists("diag_lastMemPercent") then out.memPercent = section.Read("diag_lastMemPercent")
  if section.Exists("diag_checkpointCount") then out.count = section.Read("diag_checkpointCount")
  return out
end function

sub logCheckpoint(name as string)
  section = mainRegistrySection()

  count = 0
  if section.Exists("diag_checkpointCount") then
    existing = section.Read("diag_checkpointCount")
    if existing <> invalid and existing <> "" then count = existing.ToInt()
  end if
  count = count + 1

  section.Write("diag_lastCheckpoint", name)
  section.Write("diag_lastCheckpointTime", timeLabel())
  section.Write("diag_lastMemPercent", currentMemPercent().ToStr())
  section.Write("diag_checkpointCount", count.ToStr())
  section.Flush()

  print "DIAG CHECKPOINT #"; count; ": "; name; " mem="; currentMemPercent(); "% at "; timeLabel()
end sub

function appVersionString() as string
  return "v0.11.14"
end function

' Sends last run's leftover checkpoint (if any) straight to the backend
' (RokuDiagnostics sheet via Code.gs) instead of relying on Craig reading it
' off the "Last session" line on the pairing screen before the app maybe
' crashes again - that race turned out to be unreadable when the crash-loop
' is fast. Called as early as possible in init() so it has the best chance of
' completing before anything else in this run goes wrong. Fire-and-forget:
' the task node is stashed on m so it isn't garbage collected mid-flight, but
' nothing here waits on or reacts to its result.
sub reportPreviousDiagIfAny()
  if m.previousDiag = invalid or m.previousDiag.checkpoint = "" then return

  task = CreateObject("roSGNode", "DiagReportTask")
  task.apiUrl = m.apiUrl
  task.checkpoint = m.previousDiag.checkpoint
  task.memPercent = m.previousDiag.memPercent
  task.stepCount = m.previousDiag.count
  task.checkpointTime = m.previousDiag.time
  task.deviceId = m.deviceId
  task.appVersion = appVersionString()
  task.control = "run"

  m.diagReportTask = task
end sub

sub init()
  ' Capture whatever was last written by logCheckpoint() BEFORE this run's own
  ' checkpoints start overwriting it - this is the only chance to see last
  ' session's final state (i.e. right before a crash), since the Info page
  ' can only be viewed after init() has already run and logged its own steps.
  m.previousDiag = readPreviousDiag()
  logCheckpoint("init_start")

  m.apiUrl = "https://script.google.com/macros/s/AKfycbzTXFm5uwcHepPdz64mNR6bqfajk3R7YR-nVuog4mxAW30wkASEvxdAsn-PKWonSwGy/exec"
  m.tabs = ["Scoreboard", "Golf", "World Cup", "Info"]
  m.currentTab = 0
  m.wcOffset = 0
  m.gamesOffset = 0
  m.golfOffset = 0
  m.infoOffset = 0
  m.density = ["expanded", "expanded", "expanded", "expanded"]
  m.data = invalid
  m.ambientTracks = []
  m.ambientIndex = 0
  m.ambientSignature = ""
  m.ambientPaused = false
  m.deviceId = mainDeviceId()
  m.pairCode = mainPairCode()
  m.isRefreshing = false

  ' Phone last run's leftover checkpoint home as early as possible - see the
  ' comment on reportPreviousDiagIfAny() above for why this replaced trying to
  ' read it off the pairing screen.
  reportPreviousDiagIfAny()
  logCheckpoint("device_id_ready")

  m.content = m.top.findNode("content")
  ' Keep scrollable content from drawing over the fixed header/footer areas.
  m.content.clippingRect = [0, 0, 1168, 492]
  m.status = m.top.findNode("status")
  m.ambientAudio = m.top.findNode("ambientAudio")
  m.musicStatus = m.top.findNode("musicStatus")
  m.musicHint = m.top.findNode("musicHint")
  m.musicToast = m.top.findNode("musicToast")
  m.musicToastBg = m.top.findNode("musicToastBg")
  m.musicToastTimer = m.top.findNode("musicToastTimer")
  if m.musicToastTimer <> invalid then
    m.musicToastTimer.observeField("fire", "hideMusicToast")
  end if
  updateMusicUi()
  if m.ambientAudio <> invalid then
    m.ambientAudio.observeField("state", "onAmbientAudioStateChanged")
  end if
  logCheckpoint("audio_setup_done")
  m.tabsLabel = m.top.findNode("tabs")
  m.tabGroup = m.top.findNode("tabGroup")
  m.accentBar = m.top.findNode("accentBar")
  m.refreshTimer = m.top.findNode("refreshTimer")
  m.refreshTimer.observeField("fire", "refreshData")
  m.refreshTimer.control = "start"

  m.keepAliveTimer = m.top.findNode("keepAliveTimer")
  m.keepAliveLabel = m.top.findNode("keepAliveLabel")
  m.keepAliveCount = 0
  if m.keepAliveTimer <> invalid then
    m.keepAliveTimer.observeField("fire", "keepAliveTick")
    m.keepAliveTimer.control = "start"
  end if

  m.pairingTimer = m.top.findNode("pairingTimer")
  if m.pairingTimer <> invalid then
    m.pairingTimer.observeField("fire", "refreshData")
    m.pairingTimer.control = "start"
  end if

  m.top.setFocus(true)

  m.refreshCount = 0
  logCheckpoint("init_done")

  renderTabs()
  refreshData()
end sub


sub onLowMemoryWarning(percent as integer)
  ' Fired from source/main.brs via roAppMemoryMonitor. This is our one chance to
  ' shed memory before Roku's OS force-kills the channel with no error and no
  ' backtrace, which is what "opens then silently closes" looks like on some
  ' devices. Print first (in case the kill happens mid-cleanup) then trim.
  print "MEMORY WARNING received in MainScene: "; percent; "% of app limit"
  logCheckpoint("mem_warning_" + percent.ToStr())

  ' Ambient audio holds a decoder/buffer open; drop it first, it's the easiest
  ' win and the user can live without music during a memory crunch.
  if m.ambientAudio <> invalid then
    m.ambientAudio.control = "stop"
    m.ambientAudio.content = invalid
  end if

  ' Re-render the current tab. renderCurrentTab() always clears m.content first,
  ' so this drops every Rectangle/Label node currently on screen and rebuilds
  ' only what's visible right now, instead of leaving stale nodes accumulated
  ' from prior renders/scrolls sitting in memory.
  if percent >= 90 then
    renderCurrentTab()
  end if
end sub

sub keepAliveTick()
  if m.keepAliveCount = invalid then m.keepAliveCount = 0
  m.keepAliveCount = m.keepAliveCount + 1

  dt = CreateObject("roDateTime")
  dt.ToLocalTime()
  stamp = dt.AsSeconds().ToStr()

  ' Update a tiny hidden label so SceneGraph sees periodic activity, and log it
  ' so we can tell whether the app was still alive before any future exit.
  if m.keepAliveLabel <> invalid then
    m.keepAliveLabel.text = "keepalive " + m.keepAliveCount.ToStr() + " " + stamp
  end if

  print "KEEPALIVE tick "; m.keepAliveCount; " at "; timeLabel()
end sub

sub refreshData()
  if m.isRefreshing = true then return
  m.isRefreshing = true

  if m.refreshCount = invalid then m.refreshCount = 0
  m.refreshCount = m.refreshCount + 1
  logCheckpoint("refresh_start_" + m.refreshCount.ToStr())

  if isPairedData(m.data) then
    m.status.text = "Refreshing..."
  else
    m.status.text = "Checking pairing..."
    renderCurrentTab()
  end if

  task = CreateObject("roSGNode", "ApiTask")
  task.apiUrl = m.apiUrl
  task.observeField("result", "onDataLoaded")
  task.control = "run"
  m.task = task
  logCheckpoint("task_started_" + m.refreshCount.ToStr())
end sub

sub onDataLoaded()
  m.isRefreshing = false
  m.data = m.task.result
  m.status.text = "Updated " + timeLabel()
  logCheckpoint("data_loaded_" + m.refreshCount.ToStr())

  if isPairedData(m.data) then
    if m.pairingTimer <> invalid then m.pairingTimer.control = "stop"
  else
    if m.pairingTimer <> invalid then m.pairingTimer.control = "start"
  end if

  configureAmbientAudio()
  renderCurrentTab()
  m.top.setFocus(true)
end sub

function isPairedData(data as dynamic) as boolean
  if data = invalid then return false
  if data.DoesExist("rokuPairing") and data.rokuPairing <> invalid then
    rp = data.rokuPairing
    if rp.DoesExist("paired") and rp.paired = true then return true
  end if
  return false
end function

function timeLabel() as string
  dt = CreateObject("roDateTime")
  dt.ToLocalTime()
  hours = dt.GetHours()
  minutes = dt.GetMinutes()
  ampm = "AM"
  if hours >= 12 then
    ampm = "PM"
  end if
  displayHour = hours
  if displayHour = 0 then
    displayHour = 12
  end if
  if displayHour > 12 then
    displayHour = displayHour - 12
  end if
  minText = minutes.ToStr()
  if minutes < 10 then
    minText = "0" + minText
  end if
  return displayHour.ToStr() + ":" + minText + " " + ampm
end function

function pageAccent() as string
  if m.currentTab = 1 then return "0x33CC66FF"
  if m.currentTab = 2 then return "0x13C7B9FF"
  if m.currentTab = 3 then return "0xE6D98AFF"
  return "0x3C8DFFFF"
end function

function currentDensity() as string
  if m.density = invalid then return "expanded"
  d = m.density[m.currentTab]
  if d = invalid or d = "" then return "expanded"
  return d
end function

function isCondensed() as boolean
  return currentDensity() = "condensed"
end function

function densityDisplayName() as string
  d = currentDensity()
  if d = "condensed" then return "Compact"
  return "Expanded"
end function

sub toggleDensity()
  if m.density[m.currentTab] = "condensed" then
    m.density[m.currentTab] = "expanded"
  else
    m.density[m.currentTab] = "condensed"
  end if
  renderCurrentTab()
end sub


function ambientUrl(track as object) as string
  if track = invalid then return ""
  if track.DoesExist("url") and track.url <> invalid then return track.url.ToStr()
  return ""
end function

function ambientLabel(track as object) as string
  if track = invalid then return "Ambient"
  if track.DoesExist("label") and track.label <> invalid then return track.label.ToStr()
  return "Ambient"
end function

function enabledAmbientTracks() as object
  tracks = []
  if m.data = invalid or not m.data.DoesExist("ambientMusic") or m.data.ambientMusic = invalid then return tracks

  for each track in m.data.ambientMusic
    if track <> invalid then
      enabled = false
      if track.DoesExist("enabled") and track.enabled = true then enabled = true
      url = ambientUrl(track)
      if enabled and url <> "" then tracks.push(track)
    end if
  end for

  return tracks
end function

function ambientSignature(tracks as object) as string
  sig = ""
  for each track in tracks
    sig = sig + ambientLabel(track) + "|" + ambientUrl(track) + ";"
  end for
  return sig
end function

sub configureAmbientAudio()
  if m.ambientAudio = invalid then return

  tracks = enabledAmbientTracks()
  sig = ambientSignature(tracks)

  if sig = m.ambientSignature then return

  m.ambientSignature = sig
  if tracks.count() > 1 then
    m.ambientTracks = shuffleAmbientTracks(tracks)
  else
    m.ambientTracks = tracks
  end if
  m.ambientIndex = 0
  m.ambientPaused = false

  if tracks.count() = 0 then
    print "AMBIENT no tracks selected"
    m.ambientAudio.control = "stop"
    updateMusicUi()
    return
  end if

  print "AMBIENT configured "; tracks.count(); " track(s)"
  playAmbientTrack()
end sub

function shuffleAmbientTracks(tracks as object) as object
  shuffled = []
  if tracks = invalid then return shuffled

  ' Copy tracks first so we never mutate backend data.
  for each track in tracks
    shuffled.push(track)
  end for

  if shuffled.count() <= 1 then return shuffled

  dt = CreateObject("roDateTime")
  dt.ToLocalTime()
  seed = dt.AsSeconds()

  ' Fisher-Yates style shuffle using a lightweight deterministic clock seed.
  ' This gives a different order across launches/cycles without requiring
  ' any external randomness support.
  for i = shuffled.count() - 1 to 1 step -1
    seed = (seed * 1103515245 + 12345) MOD 2147483647
    j = seed MOD (i + 1)
    tmp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = tmp
  end for

  orderText = ""
  for each t in shuffled
    orderText = orderText + ambientLabel(t) + " | "
  end for
  print "AMBIENT shuffle "; orderText

  return shuffled
end function

function currentAmbientLabel() as string
  if m.ambientTracks = invalid or m.ambientTracks.count() = 0 then return ""
  idx = m.ambientIndex
  if idx = invalid or idx < 0 or idx >= m.ambientTracks.count() then idx = 0
  return ambientLabel(m.ambientTracks[idx])
end function

sub updateMusicUi()
  label = currentAmbientLabel()

  ' Keep the footer clean. Music details live in the top-right corner
  ' and on the Info page.
  if m.musicStatus <> invalid then
    m.musicStatus.text = ""
  end if

  if m.musicHint <> invalid then
    if label = "" then
      m.musicHint.text = "Ambient Music Off"
    else if m.ambientPaused = true then
      m.musicHint.text = "Music Paused: " + label
    else
      m.musicHint.text = "Now Playing: " + label
    end if
  end if
end sub

sub showMusicToast(message as string)
  if m.musicToast <> invalid then
    m.musicToast.text = message
    m.musicToast.visible = true
  end if
  if m.musicToastBg <> invalid then
    m.musicToastBg.visible = true
  end if
  if m.musicToastTimer <> invalid then
    m.musicToastTimer.control = "stop"
    m.musicToastTimer.control = "start"
  end if
end sub

sub hideMusicToast()
  if m.musicToast <> invalid then m.musicToast.visible = false
  if m.musicToastBg <> invalid then m.musicToastBg.visible = false
end sub

sub playAmbientTrack()
  if m.ambientAudio = invalid then return
  if m.ambientTracks = invalid or m.ambientTracks.count() = 0 then return

  if m.ambientIndex >= m.ambientTracks.count() then
    if m.ambientTracks.count() > 1 then
      m.ambientTracks = shuffleAmbientTracks(m.ambientTracks)
    end if
    m.ambientIndex = 0
  end if

  track = m.ambientTracks[m.ambientIndex]
  url = ambientUrl(track)
  if url = "" then return

  content = CreateObject("roSGNode", "ContentNode")
  content.url = url
  content.streamformat = "mp3"
  content.title = ambientLabel(track)

  m.ambientAudio.content = content
  m.ambientAudio.control = "play"
  m.ambientPaused = false
  print "AMBIENT play "; ambientLabel(track); " index "; m.ambientIndex
  updateMusicUi()
end sub

sub advanceAmbientTrack(delta as integer)
  if m.ambientAudio = invalid then return
  if m.ambientTracks = invalid or m.ambientTracks.count() = 0 then return

  if m.ambientTracks.count() = 1 then
    m.ambientIndex = 0
    playAmbientTrack()
    return
  end if

  m.ambientIndex = m.ambientIndex + delta
  if m.ambientIndex >= m.ambientTracks.count() then
    m.ambientTracks = shuffleAmbientTracks(m.ambientTracks)
    m.ambientIndex = 0
  else if m.ambientIndex < 0 then
    m.ambientIndex = m.ambientTracks.count() - 1
  end if

  playAmbientTrack()
end sub

sub toggleAmbientPause()
  if m.ambientAudio = invalid then return
  if m.ambientTracks = invalid or m.ambientTracks.count() = 0 then return

  if m.ambientPaused = true then
    m.ambientAudio.control = "resume"
    m.ambientPaused = false
    print "AMBIENT resume"
    updateMusicUi()
  else
    m.ambientAudio.control = "pause"
    m.ambientPaused = true
    print "AMBIENT pause"
    updateMusicUi()
  end if
end sub

sub onAmbientAudioStateChanged()
  if m.ambientAudio = invalid then return
  state = m.ambientAudio.state
  print "AMBIENT state "; state

  if state = "finished" then
    m.ambientIndex = m.ambientIndex + 1
    if m.ambientTracks <> invalid and m.ambientTracks.count() > 0 and m.ambientIndex >= m.ambientTracks.count() then
      if m.ambientTracks.count() > 1 then
        m.ambientTracks = shuffleAmbientTracks(m.ambientTracks)
      end if
      m.ambientIndex = 0
    end if
    playAmbientTrack()
    if currentAmbientLabel() <> "" then showMusicToast("Now Playing: " + currentAmbientLabel())
  else if state = "error" then
    print "AMBIENT error; skipping track"
    advanceAmbientTrack(1)
  end if
end sub

sub renderTabs()
  m.tabsLabel.text = ""
  while m.tabGroup.getChildCount() > 0
    m.tabGroup.removeChildIndex(0)
  end while

  tabX = [0, 150, 230, 382]
  tabW = [130, 62, 132, 70]
  for i = 0 to m.tabs.count() - 1
    label = CreateObject("roSGNode", "Label")
    label.translation = [tabX[i], 0]
    label.width = tabW[i]
    label.height = 32
    label.text = m.tabs[i]
    if i = m.currentTab then
      label.color = "0xFFFFFFFF"
      label.font = "font:MediumBoldSystemFont"
    else
      label.color = "0xB7C8DCFF"
      label.font = "font:MediumSystemFont"
    end if
    m.tabGroup.appendChild(label)

    if i = m.currentTab then
      underline = CreateObject("roSGNode", "Rectangle")
      underline.translation = [tabX[i], 34]
      underline.width = tabW[i]
      underline.height = 4
      underline.color = pageAccent()
      m.tabGroup.appendChild(underline)
    end if
  end for

  densityLabel = CreateObject("roSGNode", "Label")
  densityLabel.translation = [485, 0]
  densityLabel.width = 210
  densityLabel.height = 32
  densityLabel.text = UCase(densityDisplayName())
  densityLabel.color = "0xFFFFFFFF"
  densityLabel.font = "font:MediumBoldSystemFont"
  m.tabGroup.appendChild(densityLabel)

  m.accentBar.color = pageAccent()
end sub

sub renderCurrentTab()
  clearContent()
  renderTabs()

  if m.data = invalid then
    renderPairingRequired()
    return
  end if

  if m.data.DoesExist("rokuPairing") and m.data.rokuPairing <> invalid then
    rp = m.data.rokuPairing
    if rp.DoesExist("paired") and rp.paired <> true then
      if rp.DoesExist("pairCode") and rp.pairCode <> invalid and rp.pairCode.ToStr() <> "" then m.pairCode = rp.pairCode.ToStr()
      renderPairingRequired()
      return
    end if
  end if

  if m.currentTab = 0 then
    renderGames()
  else if m.currentTab = 1 then
    renderGolfers()
  else if m.currentTab = 2 then
    renderWorldCup()
  else
    renderInfo()
  end if
end sub

sub clearContent()
  while m.content.getChildCount() > 0
    m.content.removeChildIndex(0)
  end while
end sub

function addText(t as string, y as integer, size as string, color as string, x as integer, w as integer) as object
  label = CreateObject("roSGNode", "Label")
  label.translation = [x, y]
  label.width = w
  label.height = 46
  label.text = t
  label.color = color
  if size = "xlarge" then
    label.font = "font:ExtraLargeBoldSystemFont"
  else if size = "large" then
    label.font = "font:LargeBoldSystemFont"
  else if size = "mediumBold" then
    label.font = "font:MediumBoldSystemFont"
  else if size = "smallBold" then
    label.font = "font:SmallBoldSystemFont"
  else if size = "small" then
    label.font = "font:SmallSystemFont"
  else
    label.font = "font:MediumSystemFont"
  end if
  m.content.appendChild(label)
  return label
end function

function approxTextWidth(t as string, size as string) as integer
  if t = invalid then return 0
  chars = Len(t)
  if size = "small" then return chars * 9
  if size = "smallBold" then return chars * 10
  if size = "medium" then return chars * 12
  return chars * 12
end function

sub addCompactWinnerText(awayLabel as string, awayScore as string, homeLabel as string, homeScore as string, winner as string, x as integer, y as integer, w as integer)
  winColor = "0x6EE7B7FF"
  loseColor = "0xCBD5E1FF"
  if winner = "away" then
    winText = awayLabel + " " + awayScore
    restText = " @ " + homeLabel + " " + homeScore
    addText(winText, y, "smallBold", winColor, x, w)
    offset = approxTextWidth(winText, "smallBold")
    addText(restText, y, "smallBold", loseColor, x + offset, w - offset)
  else if winner = "home" then
    firstText = awayLabel + " " + awayScore + " @ "
    winText = homeLabel + " " + homeScore
    addText(firstText, y, "smallBold", loseColor, x, w)
    offset = approxTextWidth(firstText, "smallBold")
    addText(winText, y, "smallBold", winColor, x + offset, w - offset)
  end if
end sub

sub addRect(x as integer, y as integer, w as integer, h as integer, color as string)
  r = CreateObject("roSGNode", "Rectangle")
  r.translation = [x, y]
  r.width = w
  r.height = h
  r.color = color
  m.content.appendChild(r)
end sub

function safe(value as dynamic) as string
  if value = invalid then return ""
  return value.ToStr()
end function

function appendPart(base as string, part as string) as string
  if part = "" then return base
  if base = "" then return part
  return base + "  •  " + part
end function

function gameField(game as object, name as string) as string
  if game = invalid then return ""
  if game.DoesExist("live") and game.live <> invalid then
    live = game.live
    if live.DoesExist(name) and live[name] <> invalid then return live[name].ToStr()
  end if
  if game.DoesExist(name) and game[name] <> invalid then return game[name].ToStr()
  return ""
end function

function teamLine(game as object) as string
  away = gameField(game, "awayTeam")
  home = gameField(game, "homeTeam")
  if away = "" and home = "" then return gameField(game, "name")
  return away + " @ " + home
end function

function scoreLine(game as object) as string
  awayScore = gameField(game, "awayScore")
  homeScore = gameField(game, "homeScore")
  if awayScore = "" and homeScore = "" then return ""
  return awayScore + " - " + homeScore
end function


function scoreValue(value as string) as integer
  if value = "" then return -999999
  return Val(value)
end function

function isFinalGame(game as object) as boolean
  status = gameField(game, "status")
  rawStatus = gameField(game, "rawStatus")
  lowStatus = LCase(status)
  lowRaw = LCase(rawStatus)

  if status = "Final" or status = "FINAL" or status = "Complete" or status = "Completed" or rawStatus = "STATUS_FINAL" or rawStatus = "STATUS_FULL_TIME" or rawStatus = "STATUS_COMPLETE" then
    return true
  end if
  if Instr(1, lowStatus, "final") > 0 or Instr(1, lowStatus, "complete") > 0 or Instr(1, lowRaw, "final") > 0 or Instr(1, lowRaw, "complete") > 0 then
    return true
  end if
  return false
end function

function winnerSide(game as object) as string
  if not isFinalGame(game) then return ""
  awayScore = gameField(game, "awayScore")
  homeScore = gameField(game, "homeScore")
  if awayScore = "" or homeScore = "" then return ""
  a = scoreValue(awayScore)
  h = scoreValue(homeScore)
  if a > h then return "away"
  if h > a then return "home"
  return ""
end function

function selectedTeamName(game as object) as string
  if game = invalid then return ""
  fields = ["selectedTeam", "favoriteTeam", "followedTeam", "team", "teamName"]
  for each f in fields
    if game.DoesExist(f) and game[f] <> invalid and game[f].ToStr() <> "" then return game[f].ToStr()
  end for
  return ""
end function

function teamMatchesName(a as string, b as string) as boolean
  aa = LCase(a.Trim())
  bb = LCase(b.Trim())
  if aa = "" or bb = "" then return false
  return aa = bb
end function

function valueContainsTeam(value as dynamic, teamName as string) as boolean
  if value = invalid or teamName = "" then return false
  vt = Type(value)
  if vt = "roArray" or vt = "Array" then
    for each item in value
      if item <> invalid and teamMatchesName(item.ToStr(), teamName) then return true
    end for
  else
    text = value.ToStr()
    if teamMatchesName(text, teamName) then return true
    parts = text.Tokenize(",")
    for each part in parts
      if teamMatchesName(part.Trim(), teamName) then return true
    end for
  end if
  return false
end function

function isFollowedTeam(game as object, teamName as string) as boolean
  if game = invalid or teamName = "" then return false
  fields = ["followedTeams", "selectedTeams", "teamNames", "followedTeamNames", "followedTeam", "selectedTeam", "team", "teamName"]
  for each f in fields
    if game.DoesExist(f) and valueContainsTeam(game[f], teamName) then return true
  end for

  ' Older API rows sometimes identify the followed side through selectedType.
  if game.DoesExist("selectedType") and LCase(safe(game.selectedType)) = "followed" then
    picked = selectedTeamName(game)
    if teamMatchesName(picked, teamName) then return true
  end if
  return false
end function

function followedIconLabel(game as object, teamName as string) as string
  if isFollowedTeam(game, teamName) then return "● " + teamName
  return teamName
end function

function monthNumberFromName(mon as string) as integer
  m = LCase(mon)
  if Left(m, 3) = "jan" then return 1
  if Left(m, 3) = "feb" then return 2
  if Left(m, 3) = "mar" then return 3
  if Left(m, 3) = "apr" then return 4
  if Left(m, 3) = "may" then return 5
  if Left(m, 3) = "jun" then return 6
  if Left(m, 3) = "jul" then return 7
  if Left(m, 3) = "aug" then return 8
  if Left(m, 3) = "sep" then return 9
  if Left(m, 3) = "oct" then return 10
  if Left(m, 3) = "nov" then return 11
  if Left(m, 3) = "dec" then return 12
  return 0
end function

function todayDatePrefix() as object
  dt = CreateObject("roDateTime")
  dt.ToLocalTime()
  return { month: dt.GetMonth(), day: dt.GetDayOfMonth() }
end function

function todayWeekdayShort() as string
  dt = CreateObject("roDateTime")
  dt.ToLocalTime()
  days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  dow = dt.GetDayOfWeek()
  if dow >= 0 and dow <= 6 then return days[dow]
  if dow >= 1 and dow <= 7 then return days[dow - 1]
  return ""
end function

function todayifyDetail(detail as string) as string
  d = safe(detail)
  if d = "" then return d
  if Left(LCase(d), 5) = "today" then return d

  ' Handles details like "Wed, Jun 24 6:00 PM", "Jun 24 6:00 PM", or "FOX | Wed, Jun 24 6:00 PM".
  today = todayDatePrefix()

  ' MLB rows can arrive as "Wed 7:10 PM" without month/day. If that weekday is today, simplify it.
  todayDay = todayWeekdayShort()
  if todayDay <> "" then
    todayPrefix = todayDay + " "
    if Left(d, Len(todayPrefix)) = todayPrefix then
      return "Today " + Mid(d, Len(todayPrefix) + 1)
    end if
    pipePrefix = "| " + todayPrefix
    pipeAt = Instr(1, d, pipePrefix)
    if pipeAt > 0 then
      return Left(d, pipeAt + 1) + "Today " + Mid(d, pipeAt + Len(pipePrefix))
    end if
  end if
  months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  for each mon in months
    idx = Instr(1, d, mon + " ")
    if idx > 0 then
      rest = Mid(d, idx + Len(mon) + 1)
      dayText = ""
      for i = 1 to Len(rest)
        ch = Mid(rest, i, 1)
        if ch >= "0" and ch <= "9" then
          dayText = dayText + ch
        else
          exit for
        end if
      end for
      if dayText <> "" then
        mo = monthNumberFromName(mon)
        dy = Val(dayText)
        if ((mo = today.month) or (mo = today.month + 1)) and dy = today.day then
          afterDay = Mid(rest, Len(dayText) + 1).Trim()
          if afterDay <> "" then
            beforeDate = Left(d, idx - 1)
            ' Drop weekday text immediately before the month, but preserve channel prefixes.
            commaPos = Instr(1, beforeDate, ",")
            pipePos = Instr(1, beforeDate, "|")
            prefix = ""
            if pipePos > 0 then prefix = Left(beforeDate, pipePos + 1)
            replacement = "Today " + afterDay
            return prefix + replacement
          end if
        end if
      end if
    end if
  end for
  ' Handle numeric date details like "Wed, 6/24 6:00 PM" or "FOX | Wed, 6/24 6:00 PM".
  slashIdx = Instr(1, d, "/")
  if slashIdx > 1 then
    leftPart = Left(d, slashIdx - 1)
    mText = ""
    for j = Len(leftPart) to 1 step -1
      ch2 = Mid(leftPart, j, 1)
      if ch2 >= "0" and ch2 <= "9" then
        mText = ch2 + mText
      else if mText <> "" then
        exit for
      end if
    end for
    rightPart = Mid(d, slashIdx + 1)
    dText = ""
    for k = 1 to Len(rightPart)
      ch3 = Mid(rightPart, k, 1)
      if ch3 >= "0" and ch3 <= "9" then
        dText = dText + ch3
      else
        exit for
      end if
    end for
    if mText <> "" and dText <> "" then
      mo2 = Val(mText)
      dy2 = Val(dText)
      if ((mo2 = today.month) or (mo2 = today.month + 1)) and dy2 = today.day then
        afterDate = Mid(rightPart, Len(dText) + 1).Trim()
        if afterDate <> "" then
          prefix2 = ""
          beforeSlash = Left(d, slashIdx - Len(mText) - 1)
          pipePos2 = Instr(1, beforeSlash, "|")
          if pipePos2 > 0 then prefix2 = Left(beforeSlash, pipePos2 + 1)
          return prefix2 + "Today " + afterDate
        end if
      end if
    end if
  end if

  return d
end function

function favoriteTeamSide(game as object) as string
  if game = invalid then return ""
  isFav = false
  if game.DoesExist("isFavorite") and game.isFavorite = true then isFav = true
  if game.DoesExist("selectedType") and safe(game.selectedType) = "favorite" then isFav = true
  if not isFav then return ""

  picked = LCase(selectedTeamName(game))
  if picked = "" then return ""
  away = LCase(gameField(game, "awayTeam"))
  home = LCase(gameField(game, "homeTeam"))
  if away = picked then return "away"
  if home = picked then return "home"
  return ""
end function


function displayGameStatus(game as object) as string
  status = gameField(game, "status")
  rawStatus = gameField(game, "rawStatus")
  lowStatus = LCase(status)
  lowRaw = LCase(rawStatus)
  if Instr(1, lowStatus, "halftime") > 0 or Instr(1, lowStatus, "half time") > 0 or Instr(1, lowRaw, "halftime") > 0 or Instr(1, lowRaw, "intermission") > 0 or Instr(1, lowRaw, "end_period") > 0 then
    return "Halftime"
  end if
  if status = "Final" or status = "FINAL" or status = "Complete" or status = "Completed" or rawStatus = "STATUS_FINAL" or rawStatus = "STATUS_FULL_TIME" then
    return "Final"
  end if
  if status = "Scheduled" or rawStatus = "STATUS_SCHEDULED" then
    return ""
  end if
  return status
end function

function gameExtraDetail(game as object) as string
  if game = invalid then return ""

  spread = gameField(game, "spread")
  notes = gameField(game, "notes")
  if notes = "" then notes = gameField(game, "note")

  extra = ""
  if spread <> "" then extra = "Spread: " + spread
  if notes <> "" then
    if extra <> "" then extra = extra + " • "
    extra = extra + "Note: " + notes
  end if

  return extra
end function

function gameDetail(game as object) as string
  status = gameField(game, "status")
  clock = gameField(game, "clock")
  dateText = gameField(game, "date")
  startTime = gameField(game, "startTime")
  channel = gameField(game, "channel")
  kind = statusKind(game)
  detail = ""

  if kind = "LIVE" then
    displayStatus = displayGameStatus(game)
    if displayStatus <> "" then
      detail = appendPart(detail, displayStatus)
    end if
    if displayStatus <> "Halftime" then
      if clock <> "" and clock <> "0:00" and clock <> displayStatus then
        detail = appendPart(detail, clock)
      end if
    end if
  else if kind = "FINAL" then
    detail = appendPart(detail, "Final")
  else
    if startTime <> "" then
      detail = appendPart(detail, startTime)
    else if dateText <> "" then
      detail = appendPart(detail, dateText)
    end if
  end if

  if channel <> "" then
    detail = appendPart(detail, channel)
  end if
  return detail
end function
function statusKind(game as object) as string
  status = gameField(game, "status")
  rawStatus = gameField(game, "rawStatus")
  clock = gameField(game, "clock")
  lowStatus = LCase(status)
  lowRaw = LCase(rawStatus)

  if status = "Final" or status = "FINAL" or status = "Complete" or status = "Completed" or rawStatus = "STATUS_FINAL" or rawStatus = "STATUS_FULL_TIME" or rawStatus = "STATUS_COMPLETE" then
    return "FINAL"
  end if
  if Instr(1, lowStatus, "final") > 0 or Instr(1, lowStatus, "complete") > 0 or Instr(1, lowRaw, "final") > 0 or Instr(1, lowRaw, "complete") > 0 then
    return "FINAL"
  end if

  if status = "Scheduled" or rawStatus = "STATUS_SCHEDULED" or status = "" or Instr(1, lowStatus, "no live data") > 0 then
    return "UPCOMING"
  end if
  if Instr(1, lowRaw, "scheduled") > 0 or Instr(1, lowRaw, "pre") > 0 or Instr(1, lowStatus, "scheduled") > 0 then
    return "UPCOMING"
  end if
  if Instr(1, lowStatus, " pm") > 0 or Instr(1, lowStatus, " am") > 0 or Instr(1, lowStatus, "pm") > 0 or Instr(1, lowStatus, "am") > 0 then
    return "UPCOMING"
  end if

  if Instr(1, lowRaw, "in_progress") > 0 or Instr(1, lowRaw, "first_half") > 0 or Instr(1, lowRaw, "second_half") > 0 or Instr(1, lowRaw, "halftime") > 0 or Instr(1, lowRaw, "intermission") > 0 then
    return "LIVE"
  end if
  if Instr(1, lowStatus, "live") > 0 or Instr(1, lowStatus, "top") > 0 or Instr(1, lowStatus, "bot") > 0 or Instr(1, lowStatus, "half") > 0 or Instr(1, lowStatus, "quarter") > 0 then
    return "LIVE"
  end if
  if clock <> "" and clock <> "0:00" and clock <> "0'" then
    return "LIVE"
  end if

  return "UPCOMING"
end function

function statusColor(kind as string) as string
  if kind = "LIVE" then return "0x1FBF75FF"
  if kind = "FINAL" then return "0xE14D4DFF"
  return "0x3C8DFFFF"
end function

function gameAccent(game as object) as string
  sport = gameField(game, "sportKey")
  if sport = "MLB" then return "0x3C8DFFFF"
  if sport = "NFL" then return "0xFF5757FF"
  if sport = "NBA" then return "0xF39C12FF"
  if sport = "CBB" then return "0xF39C12FF"
  if sport = "CBK" then return "0xF39C12FF"
  if sport = "CFB" then return "0x8E6CFFFF"
  return pageAccent()
end function


function normalizeGameDetail(detail as string, channel as string, fallbackStatus as string) as string
  d = safe(detail)
  ch = safe(channel)
  fs = safe(fallbackStatus)

  if d = "" then
    ' Some backend rows use Status as the scheduled time (ex: MLB rows).
    lowFs = LCase(fs)
    if Instr(1, lowFs, " am") > 0 or Instr(1, lowFs, " pm") > 0 or Instr(1, lowFs, "/") > 0 then
      d = fs
    end if
  end if

  if ch <> "" then
    prefix1 = ch + " | "
    prefix2 = ch + " • "
    ' Avoid FOX | Fri... FOX / FOX | Final FOX style duplication.
    if Left(d, Len(prefix1)) = prefix1 and Instr(Len(prefix1) + 1, d, ch) > 0 then
      d = Mid(d, Len(prefix1) + 1)
    else if Left(d, Len(prefix2)) = prefix2 and Instr(Len(prefix2) + 1, d, ch) > 0 then
      d = Mid(d, Len(prefix2) + 1)
    end if

    if d <> "" then
      if Instr(1, d, ch) = 0 then
        d = appendPart(d, ch)
      end if
    else
      d = ch
    end if
  end if

  return todayifyDetail(d)
end function

sub addPill(kind as string, x as integer, y as integer)
  pillW = 132
  pillH = 30
  addRect(x, y, pillW, pillH, statusColor(kind))
  pill = CreateObject("roSGNode", "Label")
  pill.translation = [x, y + 2]
  pill.width = pillW
  pill.height = pillH - 4
  pill.text = kind
  pill.color = "0xFFFFFFFF"
  pill.font = "font:SmallBoldSystemFont"
  pill.horizAlign = "center"
  pill.vertAlign = "center"
  m.content.appendChild(pill)
end sub

sub renderGameCardCompact(game as object, x as integer, y as integer, w as integer, h as integer, accent as string)
  if accent = "" then
    accent = gameAccent(game)
  end if
  addRect(x + 4, y + 4, w, h, "0x00000066")
  addRect(x, y, w, h, "0x102844FF")
  addRect(x, y, 7, h, accent)

  favSide = favoriteTeamSide(game)
  prefix = ""
  if favSide = "" then
    if game.DoesExist("isFavorite") and game.isFavorite = true then prefix = "★ "
    if game.DoesExist("selectedType") and safe(game.selectedType) = "favorite" then prefix = "★ "
  end if

  kind = statusKind(game)
  rawDetail = gameDetail(game)
  channel = gameField(game, "channel")
  statusText = gameField(game, "status")
  detail = normalizeGameDetail(rawDetail, channel, statusText)
  score = scoreLine(game)

  awayTeam = gameField(game, "awayTeam")
  homeTeam = gameField(game, "homeTeam")
  awayScore = gameField(game, "awayScore")
  homeScore = gameField(game, "homeScore")
  winner = winnerSide(game)

  awayLabel = followedIconLabel(game, awayTeam)
  homeLabel = followedIconLabel(game, homeTeam)
  if favSide = "away" then awayLabel = "★ " + awayLabel
  if favSide = "home" then homeLabel = "★ " + homeLabel

  matchup = prefix + teamLine(game)
  if awayTeam <> "" and homeTeam <> "" then
    matchup = awayLabel + " @ " + homeLabel
  end if
  if winner <> "" and awayTeam <> "" and homeTeam <> "" then
    if awayScore <> "" or homeScore <> "" then
      matchup = awayLabel + " " + awayScore + " @ " + homeLabel + " " + homeScore
      score = ""
    end if
  end if

  textY = y + Int((h - 22) / 2)
  if winner <> "" and awayTeam <> "" and homeTeam <> "" and (awayScore <> "" or homeScore <> "") then
    addCompactWinnerText(awayLabel, awayScore, homeLabel, homeScore, winner, x + 22, textY, w - 580)
  else
    addText(matchup, textY, "smallBold", "0xFFFFFFFF", x + 22, w - 580)
  end if

  meta = detail
  if score <> "" then
    if meta <> "" then meta = meta + " | "
    meta = meta + score
  end if

  if meta <> "" then
    metaLabel = addText(meta, textY, "small", "0xBFD3EAFF", x + w - 560, 390)
    metaLabel.horizAlign = "right"
  end if

  addPill(kind, x + w - 152, y + Int((h - 30) / 2))
end sub

sub renderGameCard(game as object, x as integer, y as integer, w as integer, h as integer, accent as string)
  if h < 90 then
    renderGameCardCompact(game, x, y, w, h, accent)
    return
  end if
  if accent = "" then
    accent = gameAccent(game)
  end if
  addRect(x + 5, y + 6, w, h, "0x00000066")
  addRect(x, y, w, h, "0x102844FF")
  addRect(x, y, 8, h, accent)

  favSide = favoriteTeamSide(game)
  prefix = ""
  if favSide = "" then
    if game.DoesExist("isFavorite") and game.isFavorite = true then prefix = "★ "
    if game.DoesExist("selectedType") and safe(game.selectedType) = "favorite" then prefix = "★ "
  end if

  kind = statusKind(game)
  pillX = x + 28
  pillY = y + Int((h - 30) / 2)
  addPill(kind, pillX, pillY)

  textX = x + 180
  teamW = 330
  detailX = x + 520
  detailW = w - 700
  scoreX = x + w - 126

  awayTeam = gameField(game, "awayTeam")
  homeTeam = gameField(game, "homeTeam")
  awayScore = gameField(game, "awayScore")
  homeScore = gameField(game, "homeScore")
  winner = winnerSide(game)

  row1Y = y + Int((h - 56) / 2)
  row2Y = row1Y + 30

  if awayTeam = "" and homeTeam = "" then
    addText(prefix + teamLine(game), row1Y + 10, "mediumBold", "0xFFFFFFFF", textX, teamW + 220)
    score = scoreLine(game)
    if score <> "" then
      s = addText(score, row1Y + 10, "mediumBold", "0xFFFFFFFF", scoreX, 90)
      s.horizAlign = "right"
    end if
  else
    awayColor = "0xFFFFFFFF"
    homeColor = "0xFFFFFFFF"
    if winner = "away" then
      awayColor = "0x6EE7B7FF"
      homeColor = "0xCBD5E1FF"
    else if winner = "home" then
      homeColor = "0x6EE7B7FF"
      awayColor = "0xCBD5E1FF"
    end if

    awayLabel = followedIconLabel(game, awayTeam)
    homeLabel = followedIconLabel(game, homeTeam)
    if favSide = "away" then awayLabel = "★ " + awayLabel
    if favSide = "home" then homeLabel = "★ " + homeLabel

    addText(prefix + awayLabel, row1Y, "mediumBold", awayColor, textX, teamW)
    if awayScore <> "" then
      aScore = addText(awayScore, row1Y, "mediumBold", awayColor, scoreX, 90)
      aScore.horizAlign = "right"
    end if
    addText(homeLabel, row2Y, "mediumBold", homeColor, textX, teamW)
    if homeScore <> "" then
      hScore = addText(homeScore, row2Y, "mediumBold", homeColor, scoreX, 90)
      hScore.horizAlign = "right"
    end if
  end if

  rawDetail = gameDetail(game)
  channel = gameField(game, "channel")
  statusText = gameField(game, "status")
  detail = normalizeGameDetail(rawDetail, channel, statusText)
  if detail = "" and kind = "LIVE" then
    detail = "Live • Updating..."
  end if
  extraDetail = gameExtraDetail(game)

  if extraDetail <> "" then
    if detail <> "" then
      d = addText(detail, row1Y, "medium", "0xBFD3EAFF", detailX, detailW)
      d.horizAlign = "left"
    end if
    e = addText(extraDetail, row2Y, "small", "0xFFFFFFFF", detailX, detailW)
    e.horizAlign = "left"
  else if detail <> "" then
    d = addText(detail, y + Int((h - 24) / 2), "medium", "0xBFD3EAFF", detailX, detailW)
    d.horizAlign = "left"
  end if
end sub

sub sectionHeader(t as string, y as integer, color as string)
  addRect(0, y + 8, 10, 34, color)
  addText(t, y, "large", "0xFFFFFFFF", 24, 760)
end sub

sub wcDividerHeader(t as string, y as integer, color as string, w as integer)
  addRect(0, y, w, 2, color)
  addRect(0, y + 8, w, 34, "0xE6D98AFF")
  addRect(0, y + 41, w, 2, "0x9B873AFF")
  addRect(0, y + 8, 8, 34, color)
  h = addText(t, y + 8, "mediumBold", "0x06111EFF", 18, w - 36)
  h.height = 34
  h.vertAlign = "center"
end sub

function shouldRenderY(y as integer, h as integer, top as integer, bottom as integer) as boolean
  if y + h < top then return false
  if y > bottom then return false
  return true
end function

function gamesOfKind(games as object, desiredKind as string) as object
  result = []
  if games = invalid then return result
  for each g in games
    if statusKind(g) = desiredKind then
      result.Push(g)
    end if
  end for
  return result
end function

sub renderGameSection(title as string, games as object, yRef as object, cardH as integer, stepY as integer, headerH as integer, emptyH as integer, viewTop as integer, viewBottom as integer)
  cardW = 1168
  y = yRef.y
  wcDividerHeader(title, y, "0x3C8DFFFF", cardW)
  y = y + headerH

  if games = invalid or games.count() = 0 then
    if shouldRenderY(y, emptyH, viewTop, viewBottom) then
      addText("No " + LCase(title) + " games.", y + 8, "medium", "0xBFD3EAFF", 18, cardW - 36)
    end if
    y = y + emptyH
  else
    for each g in games
      if shouldRenderY(y, cardH, viewTop, viewBottom) then
        renderGameCard(g, 0, y, cardW, cardH, "")
      end if
      y = y + stepY
    end for
  end if
  yRef.y = y
end sub

sub renderGames()
  games = m.data.games
  if games = invalid or games.count() = 0 then
    wcDividerHeader("MY GAMES", 0, "0x3C8DFFFF", 1168)
    addText("No followed games yet. Follow teams from the PWA/admin app.", 58, "medium", "0xFFFFFFFF", 0, 1160)
    return
  end if

  liveGames = gamesOfKind(games, "LIVE")
  finalGames = gamesOfKind(games, "FINAL")
  upcomingGames = gamesOfKind(games, "UPCOMING")

  viewTop = 0
  viewBottom = 486
  cardH = 92
  stepY = 106
  headerH = 50
  emptyH = 54
  gapH = 10
  if isCondensed() then
    cardH = 40
    stepY = 48
    headerH = 46
    emptyH = 44
    gapH = 8
  end if

  scrollPx = m.gamesOffset * stepY
  yBox = { y: viewTop - scrollPx }

  renderGameSection("LIVE", liveGames, yBox, cardH, stepY, headerH, emptyH, viewTop, viewBottom)
  yBox.y = yBox.y + gapH
  renderGameSection("RECENT FINALS", finalGames, yBox, cardH, stepY, headerH, emptyH, viewTop, viewBottom)
  yBox.y = yBox.y + gapH
  renderGameSection("UPCOMING", upcomingGames, yBox, cardH, stepY, headerH, emptyH, viewTop, viewBottom)

  addText("Scoreboard view  •  Live, recent finals, upcoming", 490, "small", "0x8FA4BCFF", 0, 1160)
end sub

function golfScoreValue(g as object) as integer
  overall = safe(g.overall)
  if overall = "" or overall = "-" then return 999
  if overall = "E" or overall = "EVEN" or overall = "Even" then return 0
  clean = overall
  clean = clean.Replace("+", "")
  numVal = Val(clean)
  return numVal
end function

function golfPositionValue(g as object) as integer
  ptxt = safe(g.position)
  if ptxt = "" or ptxt = "-" then return 999
  ptxt = ptxt.Replace("T", "")
  ptxt = ptxt.Replace("#", "")
  numVal = Val(ptxt)
  if numVal = 0 then return 999
  return numVal
end function

function sortedGolfers(golfers as object) as object
  result = []
  if golfers = invalid then return result
  for each g in golfers
    result.Push(g)
  end for

  n = result.count()
  if n <= 1 then return result

  for i = 0 to n - 2
    for j = i + 1 to n - 1
      a = result[i]
      b = result[j]
      swapNeeded = false
      scoreA = golfScoreValue(a)
      scoreB = golfScoreValue(b)
      if scoreB < scoreA then
        swapNeeded = true
      else if scoreB = scoreA then
        posA = golfPositionValue(a)
        posB = golfPositionValue(b)
        if posB < posA then
          swapNeeded = true
        end if
      end if
      if swapNeeded then
        temp = result[i]
        result[i] = result[j]
        result[j] = temp
      end if
    end for
  end for
  return result
end function

function golfProgressText(g as object) as string
  thru = safe(g.thru)
  tee = safe(g.teeTime)
  if thru <> "" and thru <> "0" and thru <> "-" then
    return "Thru " + thru
  end if
  if tee <> "" then
    return "Tee " + tee
  end if
  return ""
end function

function golfNoteText(g as object) as string
  if g = invalid then return ""
  if g.DoesExist("notes") and safe(g.notes) <> "" then return safe(g.notes)
  if g.DoesExist("note") and safe(g.note) <> "" then return safe(g.note)
  return ""
end function

sub renderGolfRowCompact(g as object, x as integer, y as integer, w as integer, h as integer)
  addRect(x + 5, y + 6, w, h, "0x00000066")
  addRect(x, y, w, h, "0x10341FFF")
  addRect(x, y, 8, h, "0x33CC66FF")
  star = ""
  if g.DoesExist("favorite") and g.favorite = true then
    star = "★ "
  end if
  golferPos = safe(g.position)
  if golferPos = "" then golferPos = "--"
  overall = safe(g.overall)
  if overall = "" then overall = "--"
  today = safe(g.today)
  if today = "" then today = "--"
  progress = golfProgressText(g)
  addText(golferPos, y + 10, "mediumBold", "0xFFFFFFFF", x + 28, 80)
  addText(star + safe(g.golfer), y + 10, "mediumBold", "0xFFFFFFFF", x + 120, 430)
  addText(overall, y + 10, "mediumBold", "0xFFFFFFFF", x + 570, 90)
  addText(today, y + 10, "mediumBold", "0xFFFFFFFF", x + 705, 90)
  if progress <> "" then
    addText(progress, y + 10, "small", "0xBFD3EAFF", x + 845, 260)
  end if
end sub

sub renderGolfRow(g as object, x as integer, y as integer, w as integer, h as integer)
  if h < 70 then
    renderGolfRowCompact(g, x, y, w, h)
    return
  end if
  addRect(x + 5, y + 6, w, h, "0x00000066")
  addRect(x, y, w, h, "0x10341FFF")
  addRect(x, y, 8, h, "0x33CC66FF")

  star = ""
  if g.DoesExist("favorite") and g.favorite = true then
    star = "★ "
  end if

  golferPos = safe(g.position)
  if golferPos = "" then
    golferPos = "--"
  end if
  overall = safe(g.overall)
  if overall = "" then
    overall = "--"
  end if
  today = safe(g.today)
  if today = "" then
    today = "--"
  end if
  progress = golfProgressText(g)

  addText(golferPos, y + 19, "large", "0xFFFFFFFF", x + 28, 88)
  addText(star + safe(g.golfer), y + 14, "large", "0xFFFFFFFF", x + 120, 410)
  addText("TOTAL", y + 8, "small", "0x8FA4BCFF", x + 555, 105)
  totalLabel = addText(overall, y + 36, "large", "0xFFFFFFFF", x + 555, 105)
  addText("TODAY", y + 8, "small", "0x8FA4BCFF", x + 690, 105)
  addText(today, y + 36, "large", "0xFFFFFFFF", x + 690, 105)
  if progress <> "" then
    addText(progress, y + 26, "medium", "0xBFD3EAFF", x + 830, 260)
  end if

  note = golfNoteText(g)
  if note <> "" then
    addText("Note: " + note, y + 57, "small", "0xBFD3EAFF", x + 120, 430)
  end if
end sub

sub renderGolfers()
  rawGolfers = m.data.golfers
  golfers = sortedGolfers(rawGolfers)
  title = "Golf Leaderboard"
  if golfers <> invalid and golfers.count() > 0 and safe(golfers[0].tournament) <> "" then
    title = safe(golfers[0].tournament) + " Leaderboard"
  end if
  sectionHeader(title, 0, "0x33CC66FF")
  if golfers = invalid or golfers.count() = 0 then
    addText("No followed golfers yet. Add golfers from the PWA/admin app.", 58, "medium", "0xFFFFFFFF", 0, 1160)
    return
  end if

  addText("POS", 54, "small", "0x8FA4BCFF", 28, 80)
  addText("PLAYER", 54, "small", "0x8FA4BCFF", 120, 360)
  addText("SCORE", 54, "small", "0x8FA4BCFF", 555, 120)
  addText("ROUND", 54, "small", "0x8FA4BCFF", 690, 120)
  addText("STATUS", 54, "small", "0x8FA4BCFF", 830, 220)

  rowH = 88
  stepY = 98
  maxVisible = 4
  if isCondensed() then
    rowH = 54
    stepY = 64
    maxVisible = 7
  end if
  startIndex = m.golfOffset
  endIndex = startIndex + maxVisible - 1
  if endIndex > golfers.count() - 1 then
    endIndex = golfers.count() - 1
  end if
  y = 86
  for i = startIndex to endIndex
    renderGolfRow(golfers[i], 0, y, 1168, rowH)
    y = y + stepY
  end for
  addText("Showing " + (startIndex + 1).ToStr() + "-" + (endIndex + 1).ToStr() + " of " + golfers.count().ToStr(), 490, "small", "0x8FA4BCFF", 0, 1160)
end sub
sub renderWorldCup()
  wc = m.data.worldCup
  if wc = invalid then
    sectionHeader("World Cup", 0, "0x13C7B9FF")
    addText("World Cup data is not available.", 58, "medium", "0xFFFFFFFF", 0, 1160)
    return
  end if

  selected = wc.selectedGames
  finals = wc.recentFinalGames
  games = wc.upcomingGames
  cardW = 1168
  viewTop = 0
  viewBottom = 486

  cardH = 92
  stepY = 106
  finalsCardH = 92
  finalsStepY = 106
  headerH = 50
  emptyH = 54
  gapH = 10
  if isCondensed() then
    cardH = 40
    stepY = 48
    finalsCardH = 40
    finalsStepY = 48
    headerH = 46
    emptyH = 44
    gapH = 8
  end if

  scrollPx = m.wcOffset * stepY
  y = viewTop - scrollPx

  wcDividerHeader("MY GAMES", y, "0x13C7B9FF", cardW)
  y = y + headerH

  if selected = invalid or selected.count() = 0 then
    if shouldRenderY(y, emptyH, viewTop, viewBottom) then
      addText("No followed World Cup games.", y + 8, "medium", "0xBFD3EAFF", 18, cardW - 36)
    end if
    y = y + emptyH
  else
    for each g in selected
      if shouldRenderY(y, cardH, viewTop, viewBottom) then
        renderGameCard(g, 0, y, cardW, cardH, "0x13C7B9FF")
      end if
      y = y + stepY
    end for
  end if

  y = y + gapH
  wcDividerHeader("RECENT FINALS", y, "0x13C7B9FF", cardW)
  y = y + headerH

  if finals = invalid or finals.count() = 0 then
    if shouldRenderY(y, emptyH, viewTop, viewBottom) then
      addText("No recent followed World Cup finals.", y + 8, "medium", "0xBFD3EAFF", 18, cardW - 36)
    end if
    y = y + emptyH
  else
    for each g in finals
      if shouldRenderY(y, finalsCardH, viewTop, viewBottom) then
        renderGameCard(g, 0, y, cardW, finalsCardH, "0x13C7B9FF")
      end if
      y = y + finalsStepY
    end for
  end if

  y = y + gapH
  wcDividerHeader("UPCOMING SCHEDULE", y, "0x13C7B9FF", cardW)
  y = y + headerH

  if games = invalid or games.count() = 0 then
    if shouldRenderY(y, emptyH, viewTop, viewBottom) then
      addText("No upcoming World Cup games found.", y + 8, "medium", "0xBFD3EAFF", 18, cardW - 36)
    end if
  else
    for each g in games
      if shouldRenderY(y, cardH, viewTop, viewBottom) then
        renderGameCard(g, 0, y, cardW, cardH, "0x13C7B9FF")
      end if
      y = y + stepY
    end for
  end if

  addText("World Cup view  •  My Games, recent finals, upcoming schedule", 490, "small", "0x8FA4BCFF", 0, 1160)
end sub

sub addInfoSection(title as string, lines as object, y as integer, accent as string)
  addRect(0, y + 4, 1168, 2, "0x274768FF")
  addRect(0, y + 16, 8, 34, accent)
  addText(title, y + 10, "mediumBold", "0xFFFFFFFF", 24, 1120)
  lineY = y + 56
  for each line in lines
    addText(line, lineY, "small", "0xBFD3EAFF", 36, 1080)
    lineY = lineY + 28
  end for
end sub

sub addInfoRows(title as string, rows as object, y as integer, accent as string)
  addRect(0, y + 4, 1168, 2, "0x274768FF")
  addRect(0, y + 16, 8, 34, accent)
  addText(title, y + 10, "mediumBold", "0xFFFFFFFF", 24, 1120)
  lineY = y + 52
  for each row in rows
    keyText = row[0]
    valueText = row[1]
    key = addText(keyText, lineY, "smallBold", "0xFFFFFFFF", 36, 170)
    key.horizAlign = "center"
    addText(valueText, lineY, "small", "0xBFD3EAFF", 230, 900)
    lineY = lineY + 26
  end for
end sub

sub renderPairingRequired()
  logCheckpoint("render_pairing_" + m.refreshCount.ToStr())

  accent = "0xE6D98AFF"
  code = ""
  if m.pairCode <> invalid then code = m.pairCode.ToStr()
  if code = "" then code = mainPairCode()

  wcDividerHeader("PAIR THIS ROKU", 0, accent, 1168)
  addText("This Roku needs to be paired with the My Scoreboard PWA.", 64, "large", "0xFFFFFFFF", 0, 1160)
  addText("Pairing Code", 130, "mediumBold", "0xBFD3EAFF", 0, 1160)
  codeLabel = addText(code, 174, "xlarge", "0xFFFFFFFF", 0, 1160)
  codeLabel.height = 72
  addText("Open the PWA, sign in, then go to Admin > Roku Sync and enter this code.", 266, "medium", "0xBFD3EAFF", 0, 1160)
  addText("After pairing, this Roku will automatically show your followed teams and golfers.", 310, "medium", "0xBFD3EAFF", 0, 1160)
  addText("This screen checks automatically. Press OK to check now.", 382, "mediumBold", "0xFFFFFFFF", 0, 1160)
  addText("Device ID: " + m.deviceId, 434, "small", "0x5F748CFF", 0, 1160)

  ' Crash diagnostics right on this screen, not buried in a tab - this is the
  ' screen we've seen reliably render right before the app dies, so if it
  ' crashes again, the NEXT launch will show last time's result here
  ' immediately, with no remote button presses required at all.
  if m.previousDiag <> invalid and m.previousDiag.checkpoint <> "" then
    diagText = "Last session: " + m.previousDiag.checkpoint + " @ " + m.previousDiag.memPercent + "% mem (step #" + m.previousDiag.count + ", " + m.previousDiag.time + ")"
    addText(diagText, 460, "small", "0xE6D98AFF", 0, 1160)
  end if
  m.top.setFocus(true)

  ' Exit checkpoint - if a crash happens WHILE this screen is rendering, the
  ' next launch's previousDiag will show "render_pairing_N" with no matching
  ' "render_pairing_done_N" after it (still true if reading it from the
  ' RokuDiagnostics sheet, since it's the same checkpoint under the hood).
  logCheckpoint("render_pairing_done_" + m.refreshCount.ToStr())
end sub

sub renderInfo()
  accent = "0xE6D98AFF"
  offsetPx = 0
  if m.infoOffset <> invalid then offsetPx = m.infoOffset * 52
  y = -offsetPx

  wcDividerHeader("INFO", y, accent, 1168)
  y = y + 56

  musicState = "OFF"
  trackLabel = currentAmbientLabel()
  if trackLabel <> "" then
    if m.ambientPaused = true then
      musicState = "PAUSED"
    else
      musicState = "ON"
    end if
  end if
  if trackLabel = "" then trackLabel = "None"

  systemRows = [
    ["Version", appVersionString()],
    ["Last Updated", m.status.text],
    ["Auto Refresh", "Every 2 minutes"],
    ["Ambient Music", musicState],
    ["Current Track", trackLabel],
    ["Keep Alive", "Running"],
    ["Display Density", densityDisplayName()]
  ]

  if m.data <> invalid and m.data.DoesExist("rokuPairing") and m.data.rokuPairing <> invalid then
    rp = m.data.rokuPairing
    if rp.DoesExist("paired") and rp.paired = true then
      pairText = "Paired"
      if rp.DoesExist("userName") and rp.userName <> invalid and rp.userName.ToStr() <> "" then pairText = "Paired to " + rp.userName.ToStr()
      systemRows.Push(["Account Sync", pairText])
    else if rp.DoesExist("pairCode") and rp.pairCode <> invalid and rp.pairCode.ToStr() <> "" then
      systemRows.Push(["Pairing Code", rp.pairCode.ToStr()])
    else
      systemRows.Push(["Account Sync", "Not paired"])
    end if
  end if

  ' Crash diagnostics: m.previousDiag was captured at the very start of init(),
  ' before this run's own checkpoints overwrote the registry - so this reflects
  ' whatever the PREVIOUS run last recorded, i.e. right before a crash. If
  ' "Prev Last Step" says anything other than "init_done", that run almost
  ' certainly died right after reaching that step. This same info is also
  ' phoned to the RokuDiagnostics sheet on launch (reportPreviousDiagIfAny())
  ' since reading it here requires the app to have survived long enough to
  ' reach the Info tab, which a fast crash loop won't allow.
  if m.previousDiag <> invalid and m.previousDiag.checkpoint <> "" then
    systemRows.Push(["Prev Last Step", m.previousDiag.checkpoint + " (" + m.previousDiag.time + ")"])
    systemRows.Push(["Prev Mem %", m.previousDiag.memPercent + "%"])
    systemRows.Push(["Prev Step Count", m.previousDiag.count])
  end if

  addInfoRows("My Scoreboard", systemRows, y, "0xE6D98AFF")
  y = y + 290

  nav = [
    ["Left / Right", "Change pages"],
    ["Up / Down", "Scroll within the current page"],
    ["OK", "Manually refresh scores now"],
    ["Replay", "Change display density"],
    ["Back", "Return to Roku Home"]
  ]
  addInfoRows("Remote Controls", nav, y, "0x3C8DFFFF")
  y = y + 211

  musicControls = [
    ["Play / Pause", "Pause or resume ambient music"],
    ["Fast Forward", "Next ambient track"],
    ["Rewind", "Previous ambient track"],
    ["Shuffle", "Automatic when multiple tracks are selected"]
  ]
  addInfoRows("Ambient Music Controls", musicControls, y, "0x9B7CFFFF")
  y = y + 162


  symbols = [
    ["Star", "Favorite team"],
    ["Dot", "Followed team"],
    ["LIVE", "Game in progress"],
    ["FINAL", "Completed game"],
    ["Today", "Game starts today"]
  ]
  addInfoRows("Symbols", symbols, y, "0x13C7B9FF")
  y = y + 186

  tip = ["Use PWA My Setup > Roku Account Sync to pair this Roku.", "The pairing screen checks automatically after you pair."]
  addInfoSection("Tip", tip, y, "0xFBBF24FF")
end sub

function maxOffsetForCurrentTab() as integer
  if m.data = invalid then return 0
  if m.currentTab = 0 then
    games = m.data.games
    if games = invalid then return 0
    totalItems = 3
    liveGames = gamesOfKind(games, "LIVE")
    finalGames = gamesOfKind(games, "FINAL")
    upcomingGames = gamesOfKind(games, "UPCOMING")
    if liveGames <> invalid and liveGames.count() > 0 then
      totalItems = totalItems + liveGames.count()
    else
      totalItems = totalItems + 1
    end if
    if finalGames <> invalid and finalGames.count() > 0 then
      totalItems = totalItems + finalGames.count()
    else
      totalItems = totalItems + 1
    end if
    if upcomingGames <> invalid and upcomingGames.count() > 0 then
      totalItems = totalItems + upcomingGames.count()
    else
      totalItems = totalItems + 1
    end if
    visibleCount = 4
    if isCondensed() then visibleCount = 9
    max = totalItems - visibleCount
  else if m.currentTab = 1 then
    golfers = m.data.golfers
    if golfers = invalid then return 0
    visibleCount = 5
    if isCondensed() then visibleCount = 7
    max = golfers.count() - visibleCount
  else if m.currentTab = 2 then
    wc = m.data.worldCup
    if wc = invalid then return 0
    totalItems = 3
    if wc.selectedGames <> invalid then
      totalItems = totalItems + wc.selectedGames.count()
    else
      totalItems = totalItems + 1
    end if
    if wc.recentFinalGames <> invalid then
      totalItems = totalItems + wc.recentFinalGames.count()
    else
      totalItems = totalItems + 1
    end if
    if wc.upcomingGames <> invalid then
      totalItems = totalItems + wc.upcomingGames.count()
    else
      totalItems = totalItems + 1
    end if
    visibleCount = 4
    if isCondensed() then visibleCount = 9
    max = totalItems - visibleCount
  else
    max = 10
  end if
  if max < 0 then
    max = 0
  end if
  return max
end function

sub changeOffset(delta as integer)
  max = maxOffsetForCurrentTab()
  if m.currentTab = 0 then
    m.gamesOffset = m.gamesOffset + delta
    if m.gamesOffset < 0 then
      m.gamesOffset = 0
    end if
    if m.gamesOffset > max then
      m.gamesOffset = max
    end if
  else if m.currentTab = 1 then
    m.golfOffset = m.golfOffset + delta
    if m.golfOffset < 0 then
      m.golfOffset = 0
    end if
    if m.golfOffset > max then
      m.golfOffset = max
    end if
  else if m.currentTab = 2 then
    m.wcOffset = m.wcOffset + delta
    if m.wcOffset < 0 then
      m.wcOffset = 0
    end if
    if m.wcOffset > max then
      m.wcOffset = max
    end if
  else
    m.infoOffset = m.infoOffset + delta
    if m.infoOffset < 0 then
      m.infoOffset = 0
    end if
    if m.infoOffset > max then
      m.infoOffset = max
    end if
  end if
  renderCurrentTab()
end sub

function onKeyEvent(key as string, press as boolean) as boolean
  keyLower = LCase(key)

  ' Back should still exit the app normally.
  if keyLower = "back" then return false

  ' Let Roku handle the Options (*) button. Density is no longer mapped to *
  ' because Roku's system Options menu can take priority on some devices.
  if keyLower = "options" or keyLower = "option" or keyLower = "star" or keyLower = "asterisk" then return false

  ' Consume release events for all channel-handled keys.
  if press = false then return true

  if keyLower = "right" then
    m.currentTab = m.currentTab + 1
    if m.currentTab >= m.tabs.count() then
      m.currentTab = 0
    end if
    renderCurrentTab()
    return true
  else if keyLower = "left" then
    m.currentTab = m.currentTab - 1
    if m.currentTab < 0 then
      m.currentTab = m.tabs.count() - 1
    end if
    renderCurrentTab()
    return true
  else if keyLower = "down" then
    changeOffset(1)
    return true
  else if keyLower = "up" then
    changeOffset(-1)
    return true
  else if keyLower = "ok" then
    refreshData()
    return true
  else if keyLower = "replay" or keyLower = "instantreplay" then
    toggleDensity()
    showMusicToast("Display Density: " + densityDisplayName())
    return true
  else if keyLower = "play" or keyLower = "playpause" then
    wasPaused = m.ambientPaused
    toggleAmbientPause()
    if currentAmbientLabel() <> "" then
      if wasPaused = true then
        showMusicToast("Music Resumed: " + currentAmbientLabel())
      else
        showMusicToast("Music Paused: " + currentAmbientLabel())
      end if
    end if
    return true
  else if keyLower = "fastforward" or keyLower = "forward" then
    advanceAmbientTrack(1)
    if currentAmbientLabel() <> "" then showMusicToast("Next Track: " + currentAmbientLabel())
    return true
  else if keyLower = "rewind" or keyLower = "reverse" then
    advanceAmbientTrack(-1)
    if currentAmbientLabel() <> "" then showMusicToast("Previous Track: " + currentAmbientLabel())
    return true
  end if

  ' Important: consume other keys too, otherwise Roku may handle * itself.
  return true
end function
