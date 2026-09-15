sub init()
  m.top.functionName = "reportDiag"
end sub

' Minimal URL-encoder for query params. The values we send (checkpoint names,
' the numeric fields, the device ID) are our own identifiers and never
' contain anything exotic, but checkpointTime is a human-readable "H:MM:SS"
' string, so this stays defensive rather than assuming plain alnum.
function diagUrlEncode(value as string) as string
  out = ""
  for i = 0 to Len(value) - 1
    c = Mid(value, i + 1, 1)
    code = Asc(c)
    isAlnum = (code >= 48 and code <= 57) or (code >= 65 and code <= 90) or (code >= 97 and code <= 122)
    if isAlnum or c = "-" or c = "_" or c = "." or c = "~" then
      out = out + c
    else
      hex = UCase(Hex(code))
      if Len(hex) < 2 then hex = "0" + hex
      out = out + "%" + hex
    end if
  end for
  return out
end function

sub reportDiag()
  ' Fire-and-forget: this exists purely to get last run's crash checkpoint off
  ' the device and into a sheet we can actually read, since trying to read it
  ' off the TV screen before the app crashes again turned out to be
  ' impractical. If this request fails (no network yet at launch, backend
  ' hiccup), we just lose this one diagnostic report - not worth building
  ' retry logic for a debugging aid that gets a fresh chance every crash.
  params = "checkpoint=" + diagUrlEncode(m.top.checkpoint)
  params = params + "&memPercent=" + diagUrlEncode(m.top.memPercent)
  params = params + "&stepCount=" + diagUrlEncode(m.top.stepCount)
  params = params + "&checkpointTime=" + diagUrlEncode(m.top.checkpointTime)
  params = params + "&deviceId=" + diagUrlEncode(m.top.deviceId)
  params = params + "&appVersion=" + diagUrlEncode(m.top.appVersion)

  url = m.top.apiUrl + "?action=reportRokuDiagnostic&" + params

  transfer = CreateObject("roUrlTransfer")
  transfer.SetUrl(url)
  transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
  transfer.InitClientCertificates()
  transfer.AddHeader("Accept", "application/json")
  transfer.GetToString()

  m.top.done = true
end sub
