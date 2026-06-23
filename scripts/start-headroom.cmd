@echo off
REM Auto-start headroom proxy on user login (no admin needed)
start "" /B "E:\AUDIT_CODE\.conda\Scripts\headroom.exe" proxy --port 8787
