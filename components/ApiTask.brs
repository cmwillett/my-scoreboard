sub init()
  m.top.functionName = "fetchData"
end sub

function fetchJson(action as string) as object
  return fetchJsonWithParams(action, "")
end function

function fetchJsonWithParams(action as string, params as string) as object
  url = m.top.apiUrl + "?action=" + action
  if params <> invalid and params <> "" then url = url + "&" + params

  transfer = CreateObject("roUrlTransfer")
  transfer.SetUrl(url)
  transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
  transfer.InitClientCertificates()
  transfer.AddHeader("Accept", "application/json")

  body = transfer.GetToString()
  if body = invalid or body = "" then return invalid

  parsed = ParseJson(body)
  if parsed = invalid then return invalid
  if parsed.success = false then return invalid

  return parsed.data
end function

function firebaseApiKey() as string
  return "AIzaSyBNtPX9hy5571gDKoXvxV8QN8uXCdsLVng"
end function

function firebaseProjectId() as string
  return "my-scoreboard-pwa"
end function

function firestoreDocUrl(collectionName as string, docId as string) as string
  return "https://firestore.googleapis.com/v1/projects/" + firebaseProjectId() + "/databases/(default)/documents/" + collectionName + "/" + docId + "?key=" + firebaseApiKey()
end function

function registrySection() as object
  return CreateObject("roRegistrySection", "MyScoreboard")
end function

' Mirrors MainScene.brs's logCheckpoint() - duplicated rather than shared
' because BrightScript components don't share scope across .brs files (this
' file already duplicates mainRegistrySection()/mainDeviceId()/mainPairCode()
' as registrySection()/getDeviceId()/getPairCode() for the same reason).
' Writes to the same registry keys, so MainScene's readPreviousDiag() picks
' up whichever of the two files wrote most recently on the next launch.
sub logApiCheckpoint(name as string)
  section = registrySection()

  count = 0
  if section.Exists("diag_checkpointCount") then
    existing = section.Read("diag_checkpointCount")
    if existing <> invalid and existing <> "" then count = existing.ToInt()
  end if
  count = count + 1

  dt = CreateObject("roDateTime")
  dt.ToLocalTime()
  hours = dt.GetHours().ToStr()
  minutes = dt.GetMinutes().ToStr()
  seconds = dt.GetSeconds().ToStr()
  if Len(minutes) < 2 then minutes = "0" + minutes
  if Len(seconds) < 2 then seconds = "0" + seconds
  timeLabelText = hours + ":" + minutes + ":" + seconds

  memPercent = -1
  monitor = CreateObject("roAppMemoryMonitor")
  if monitor <> invalid then
    p = monitor.GetMemoryLimitPercent()
    if p <> invalid then memPercent = p
  end if

  section.Write("diag_lastCheckpoint", name)
  section.Write("diag_lastCheckpointTime", timeLabelText)
  section.Write("diag_lastMemPercent", memPercent.ToStr())
  section.Write("diag_checkpointCount", count.ToStr())
  section.Flush()

  print "DIAG CHECKPOINT #"; count; ": "; name; " mem="; memPercent; "% at "; timeLabelText
end sub

function randomNumberText(maxValue as integer) as string
  n = Rnd(maxValue)
  if n < 0 then n = n * -1
  return n.ToStr()
end function

function getDeviceId() as string
  section = registrySection()
  if section.Exists("deviceId") then
    existing = section.Read("deviceId")
    if existing <> invalid and existing <> "" then return existing
  end if

  dt = CreateObject("roDateTime")
  dt.ToLocalTime()
  id = "roku_" + dt.AsSeconds().ToStr() + "_" + randomNumberText(999999)
  section.Write("deviceId", id)
  section.Flush()
  return id
end function

function getPairCode() as string
  section = registrySection()
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

sub clearPairCode()
  section = registrySection()
  if section.Exists("pairCode") then
    section.Delete("pairCode")
    section.Flush()
  end if
end sub

function fetchFirestoreDoc(collectionName as string, docId as string) as object
  transfer = CreateObject("roUrlTransfer")
  transfer.SetUrl(firestoreDocUrl(collectionName, docId))
  transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
  transfer.InitClientCertificates()
  transfer.AddHeader("Accept", "application/json")
  body = transfer.GetToString()
  if body = invalid or body = "" then return invalid
  parsed = ParseJson(body)
  if parsed = invalid then return invalid
  if parsed.DoesExist("error") then return invalid
  return parseFirestoreDocument(parsed)
end function

function escapeJsonString(value as string) as string
  text = value
  text = text.Replace("\\", "\\\\")
  text = text.Replace(Chr(34), "\\" + Chr(34))
  return text
end function

sub writePairRequest(code as string, deviceId as string)
  now = CreateObject("roDateTime")
  now.ToLocalTime()
  q = Chr(34)
  body = "{" + q + "fields" + q + ":{"
  body = body + q + "code" + q + ":{" + q + "stringValue" + q + ":" + q + escapeJsonString(code) + q + "},"
  body = body + q + "deviceId" + q + ":{" + q + "stringValue" + q + ":" + q + escapeJsonString(deviceId) + q + "},"
  body = body + q + "createdAtSeconds" + q + ":{" + q + "integerValue" + q + ":" + q + now.AsSeconds().ToStr() + q + "}"
  body = body + "}}"

  transfer = CreateObject("roUrlTransfer")
  transfer.SetUrl(firestoreDocUrl("rokuPairCodes", code))
  transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
  transfer.InitClientCertificates()
  transfer.AddHeader("Content-Type", "application/json")
  transfer.SetRequest("PATCH")
  result = transfer.PostFromString(body)
  resultLen = 0
  if result <> invalid then resultLen = Len(result)
  print "ROKU PAIR write code "; code; " result length "; resultLen
end sub

function firestoreValue(field as object) as dynamic
  if field = invalid then return invalid
  if field.DoesExist("stringValue") then return field.stringValue
  if field.DoesExist("integerValue") then return Val(field.integerValue)
  if field.DoesExist("doubleValue") then return Val(field.doubleValue)
  if field.DoesExist("booleanValue") then return field.booleanValue
  if field.DoesExist("timestampValue") then return field.timestampValue
  if field.DoesExist("arrayValue") then
    arr = []
    av = field.arrayValue
    if av <> invalid and av.DoesExist("values") and av.values <> invalid then
      for each item in av.values
        arr.Push(firestoreValue(item))
      end for
    end if
    return arr
  end if
  if field.DoesExist("mapValue") then
    out = {}
    mv = field.mapValue
    if mv <> invalid and mv.DoesExist("fields") and mv.fields <> invalid then
      for each key in mv.fields
        out[key] = firestoreValue(mv.fields[key])
      end for
    end if
    return out
  end if
  return invalid
end function

function parseFirestoreDocument(doc as object) as object
  out = {}
  if doc = invalid or not doc.DoesExist("fields") or doc.fields = invalid then return out
  for each key in doc.fields
    out[key] = firestoreValue(doc.fields[key])
  end for
  return out
end function

function safeLower(value as dynamic) as string
  if value = invalid then return ""
  return LCase(value.ToStr().Trim())
end function

function teamMatches(a as dynamic, b as dynamic) as boolean
  aa = safeLower(a)
  bb = safeLower(b)
  if aa = "" or bb = "" then return false
  return aa = bb
end function

function isFinalGameTask(game as object) as boolean
  if game = invalid then return false
  status = safeLower(game.status)
  raw = safeLower(game.rawStatus)
  return Instr(1, status, "final") > 0 or Instr(1, status, "complete") > 0 or Instr(1, raw, "final") > 0 or Instr(1, raw, "complete") > 0
end function

function isLiveGameTask(game as object) as boolean
  if game = invalid or isFinalGameTask(game) then return false
  status = safeLower(game.status)
  raw = safeLower(game.rawStatus)
  if Instr(1, raw, "scheduled") > 0 or Instr(1, raw, "pre") > 0 or Instr(1, status, "scheduled") > 0 or Instr(1, status, "pm") > 0 or Instr(1, status, "am") > 0 then return false
  return Instr(1, raw, "in_progress") > 0 or Instr(1, raw, "half") > 0 or Instr(1, status, "live") > 0 or Instr(1, status, "top") > 0 or Instr(1, status, "bot") > 0 or Instr(1, status, "half") > 0 or Instr(1, status, "quarter") > 0
end function

function findBestGameForTeam(availableGames as object, follow as object) as object
  if availableGames = invalid or follow = invalid then return invalid
  matches = []
  sportKey = ""
  team = ""
  if follow.DoesExist("sportKey") then sportKey = follow.sportKey.ToStr()
  if follow.DoesExist("team") then team = follow.team.ToStr()

  for each game in availableGames
    if game <> invalid and game.DoesExist("sportKey") and game.sportKey.ToStr() = sportKey then
      away = ""
      home = ""
      if game.DoesExist("awayTeam") then away = game.awayTeam
      if game.DoesExist("homeTeam") then home = game.homeTeam
      if teamMatches(away, team) or teamMatches(home, team) then matches.Push(game)
    end if
  end for

  if matches.count() = 0 then return invalid

  ' Prefer the current game, then the next scheduled game, then a recent final.
  ' This prevents an older completed matchup from hiding this week's upcoming game.
  for each g in matches
    if isLiveGameTask(g) then return g
  end for

  for each g in matches
    if not isFinalGameTask(g) then return g
  end for

  finalGame = invalid
  for each g in matches
    if isFinalGameTask(g) then finalGame = g
  end for
  if finalGame <> invalid then return finalGame

  return matches[0]
end function


function buildEnabledSportsMapTask(settingsData as object) as object
  enabled = {}
  if settingsData = invalid then return enabled
  if settingsData.DoesExist("sports") and settingsData.sports <> invalid then
    for each sport in settingsData.sports
      if sport <> invalid and sport.DoesExist("sportKey") then
        key = sport.sportKey.ToStr()
        if sport.DoesExist("enabled") and sport.enabled = true then enabled[key] = true
      end if
    end for
  end if
  if settingsData.DoesExist("worldCupRefresh") and settingsData.worldCupRefresh <> invalid then
    wc = settingsData.worldCupRefresh
    if wc.DoesExist("autoRefresh") and wc.autoRefresh = true then enabled["WorldCup"] = true
  end if
  return enabled
end function

function isSportEnabledTask(enabledSports as object, sportKey as dynamic) as boolean
  if enabledSports = invalid then return true
  key = ""
  if sportKey <> invalid then key = sportKey.ToStr()
  if key = "" then return true
  if enabledSports.DoesExist(key) and enabledSports[key] = true then return true
  return false
end function

function filterFollowedTeamsByEnabledSportsTask(followedTeams as object, enabledSports as object) as object
  result = []
  if followedTeams = invalid then return result
  for each follow in followedTeams
    if follow <> invalid then
      sportKey = ""
      if follow.DoesExist("sportKey") then sportKey = follow.sportKey
      if isSportEnabledTask(enabledSports, sportKey) then result.Push(follow)
    end if
  end for
  return result
end function

function filterFollowedGolfersByEnabledSportsTask(followedGolfers as object, enabledSports as object) as object
  if isSportEnabledTask(enabledSports, "GOLF") then return followedGolfers
  return []
end function

function isWorldCupEnabledTask(enabledSports as object) as boolean
  return isSportEnabledTask(enabledSports, "WorldCup")
end function

function buildFollowedGamesFromTeamsTask(followedTeams as object, availableGames as object) as object
  result = []
  if followedTeams = invalid then return result
  for each follow in followedTeams
    if follow <> invalid then
      live = findBestGameForTeam(availableGames, follow)

      ' Firestore follows are persistent preferences. The Roku scoreboard should
      ' only display followed teams when the Apps Script/ESPN cache has a real
      ' live/upcoming/recent-final game. Do not create blank placeholder cards.
      if live <> invalid then
        team = ""
        if follow.DoesExist("team") then team = follow.team.ToStr()
        row = {}
        for each key in follow
          row[key] = follow[key]
        end for
        row.selectedTeam = team
        live.selectedTeam = team
        row.eventId = live.eventId
        row.live = live
        result.Push(row)
      end if
    end if
  end for
  return result
end function


function mergeFollowedGolfersTask(followedGolfers as object, availableGolfers as object) as object
  result = []
  if followedGolfers = invalid then return result
  for each follow in followedGolfers
    row = {}
    for each key in follow
      row[key] = follow[key]
    end for
    target = safeLower(follow.golfer)
    live = invalid
    if availableGolfers <> invalid then
      for each g in availableGolfers
        if g <> invalid and teamMatches(g.golfer, target) then
          live = g
          exit for
        end if
      end for
    end if
    if live <> invalid then
      for each key in live
        row[key] = live[key]
      end for
    end if
    if follow.DoesExist("notes") then
      row.notes = follow.notes
      row.note = follow.notes
    end if
    result.Push(row)
  end for
  return result
end function

function safeArrayTask(value as dynamic) as object
  if value = invalid then return []
  return value
end function

function safeObjectTask(value as dynamic) as object
  if value = invalid then return {}
  return value
end function

function buildWorldCupFromTeamsTask(userTeams as object, backendWorldCup as object) as object
  if backendWorldCup = invalid then backendWorldCup = {}
  selectedGames = []
  candidateGames = []
  if backendWorldCup.DoesExist("upcomingGames") and backendWorldCup.upcomingGames <> invalid then candidateGames = backendWorldCup.upcomingGames

  if userTeams <> invalid then
    for each teamObj in userTeams
      if teamObj <> invalid and teamObj.DoesExist("team") then
        teamName = teamObj.team.ToStr()
        for each game in candidateGames
          if game <> invalid and (teamMatches(game.awayTeam, teamName) or teamMatches(game.homeTeam, teamName)) then
            already = false
            for each existing in selectedGames
              if existing.DoesExist("eventId") and game.DoesExist("eventId") and existing.eventId = game.eventId then already = true
            end for
            if not already then
              row = {}
              for each key in game
                row[key] = game[key]
              end for
              row.selectedTeam = teamName
              row.selectedType = "followed"
              if teamObj.DoesExist("notes") then row.notes = teamObj.notes
              selectedGames.Push(row)
            end if
          end if
        end for
      end if
    end for
  end if

  backendWorldCup.followedTeams = userTeams
  backendWorldCup.favorites = []
  backendWorldCup.selectedGames = selectedGames
  return backendWorldCup
end function

sub fetchData()
  logApiCheckpoint("apitask_start")
  deviceId = getDeviceId()
  pairCode = getPairCode()
  device = fetchFirestoreDoc("rokuDevices", deviceId)
  logApiCheckpoint("apitask_firestore_device_done")
  paired = false

  if device <> invalid and device.DoesExist("pairedUserId") and device.pairedUserId <> invalid and device.pairedUserId.ToStr() <> "" then
    paired = true
    clearPairCode()
  else
    writePairRequest(pairCode, deviceId)
  end if
  logApiCheckpoint("apitask_pairing_check_done")

  ambientMusic = fetchJson("getAmbientMusicSettings")
  logApiCheckpoint("apitask_ambient_music_done")
  dt = CreateObject("roDateTime")
  payload = {
    ambientMusic: ambientMusic,
    loadedAt: dt.ToISOString(),
    rokuPairing: {
      deviceId: deviceId,
      paired: paired,
      pairCode: pairCode
    }
  }

  if paired then
    settingsData = fetchJson("getSettingsData")
    logApiCheckpoint("apitask_settings_done")
    enabledSports = buildEnabledSportsMapTask(settingsData)
    availableGames = fetchJsonWithParams("getAvailableGames", "sportKey=ALL")
    logApiCheckpoint("apitask_available_games_done")
    availableGolfers = fetchJson("getAvailableGolfers")
    logApiCheckpoint("apitask_available_golfers_done")
    worldCupBackend = fetchJson("getWorldCupPageData")
    logApiCheckpoint("apitask_world_cup_done")

    deviceTeams = []
    if device.DoesExist("followedTeams") then deviceTeams = safeArrayTask(device.followedTeams)
    deviceGolfers = []
    if device.DoesExist("followedGolfers") then deviceGolfers = safeArrayTask(device.followedGolfers)
    deviceWorldCup = []
    if device.DoesExist("worldCupTeams") then deviceWorldCup = safeArrayTask(device.worldCupTeams)

    activeTeams = filterFollowedTeamsByEnabledSportsTask(deviceTeams, enabledSports)
    activeGolfers = filterFollowedGolfersByEnabledSportsTask(deviceGolfers, enabledSports)

    payload.games = buildFollowedGamesFromTeamsTask(activeTeams, safeArrayTask(availableGames))
    payload.golfers = mergeFollowedGolfersTask(activeGolfers, safeArrayTask(availableGolfers))
    if isWorldCupEnabledTask(enabledSports) then
      payload.worldCup = buildWorldCupFromTeamsTask(deviceWorldCup, safeObjectTask(worldCupBackend))
    else
      payload.worldCup = { followedTeams: [], selectedGames: [], recentFinalGames: [], upcomingGames: [], favorites: [] }
    end if
    if device.DoesExist("deviceName") then payload.rokuPairing.deviceName = device.deviceName
    if device.DoesExist("pairedUserName") then payload.rokuPairing.userName = device.pairedUserName
  else
    payload.games = []
    payload.golfers = []
    payload.worldCup = {}
  end if

  m.top.result = payload
  logApiCheckpoint("apitask_done")
end sub
