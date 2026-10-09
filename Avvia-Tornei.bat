@echo off
set "P=%~dp0"
set "P=%P:\=/%"
where msedge >nul 2>nul && (start "" msedge --app="file:///%P%index.html") || (start "" chrome --app="file:///%P%index.html")
