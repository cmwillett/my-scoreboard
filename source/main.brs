sub Main()
  screen = CreateObject("roSGScreen")
  port = CreateObject("roMessagePort")
  screen.SetMessagePort(port)

  scene = screen.CreateScene("MainScene")
  screen.Show()

  ' Roku's own memory limit can kill this channel with zero warning and zero
  ' BrightScript error - no backtrace, nothing printed, it just vanishes. This
  ' is the only hook that lets us see it coming and print something before
  ' that happens. It shares the screen's own message port, which is a
  ' supported pattern for multiple event-generating components.
  memMonitor = CreateObject("roAppMemoryMonitor")
  memMonitor.SetMessagePort(port)
  memMonitor.EnableMemoryWarningEvent(true)

  printMemoryLimits(memMonitor)

  while true
    msg = wait(0, port)
    msgType = type(msg)

    if msgType = "roSGScreenEvent" then
      if msg.isScreenClosed() then return
    else if msgType = "roAppMemoryNotificationEvent" then
      info = msg.GetInfo()
      percent = 0
      if info <> invalid and info.DoesExist("memoryUsagePercent") then percent = info.memoryUsagePercent
      print "MEMORY WARNING: app using "; percent; "% of allowed limit"
      printMemoryLimits(memMonitor)
      if scene <> invalid then scene.callFunc("onLowMemoryWarning", percent)
    end if
  end while
end sub

' Logs the app's current memory standing via the read-only ifAppMemoryMonitor
' getters. Called once at startup (baseline) and again on every warning, so
' telnet shows the full picture right as memory gets tight, not just the
' bare warning percent.
sub printMemoryLimits(memMonitor as object)
  if memMonitor = invalid then return

  limitPercent = memMonitor.GetMemoryLimitPercent()
  availableKb = memMonitor.GetChannelAvailableMemory()
  limits = memMonitor.GetChannelMemoryLimit()

  print "MEMORY STATUS: at "; limitPercent; "% of limit, ~"; availableKb; "Kb available"

  if limits <> invalid then
    fg = ""
    bg = ""
    heap = ""
    if limits.DoesExist("maxForegroundMemory") then fg = limits.maxForegroundMemory.ToStr()
    if limits.DoesExist("maxBackgroundMemory") then bg = limits.maxBackgroundMemory.ToStr()
    if limits.DoesExist("maxRokuManagedHeapMemory") then heap = limits.maxRokuManagedHeapMemory.ToStr()
    print "MEMORY LIMITS: foreground="; fg; " background="; bg; " rokuManagedHeap="; heap
  end if
end sub
