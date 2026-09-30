# 使用本机 Windows 中文语音离线生成交通广播，无网络服务或运行时依赖。
Add-Type -AssemblyName System.Speech
$trafficOutput = Join-Path $PSScriptRoot '../assets/audio'
New-Item -ItemType Directory -Path $trafficOutput -Force | Out-Null
$trafficSpeaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$trafficSpeaker.SelectVoice('Microsoft Huihui Desktop')
$trafficSpeaker.Rate = 1
$trafficFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$trafficAnnouncements = @{
  'construction' = '前方施工，请绕行。'
  'tunnel' = '隧道封闭，请改道。'
  'tidal' = '潮汐车道，即将切换。'
  'bridge' = '吊桥开启，请绕行。'
  'bus' = '公交出站，请护送。'
  'emergency' = '急救车辆，请让行。'
}
foreach ($trafficKind in $trafficAnnouncements.Keys) {
  $trafficFile = [System.IO.Path]::GetFullPath((Join-Path $trafficOutput "radio-$trafficKind.wav"))
  $trafficSpeaker.SetOutputToWaveFile($trafficFile, $trafficFormat)
  $trafficSpeaker.Speak($trafficAnnouncements[$trafficKind])
  $trafficSpeaker.SetOutputToNull()
}
$trafficSpeaker.Dispose()
Write-Output '已生成6段本地中文交通广播。'
