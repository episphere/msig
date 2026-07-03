# Serena Setup

- Codex MCP config is user-level: `C:\Users\Aaron Ge\.codex\config.toml`.
- Serena command is direct: `C:\Users\Aaron Ge\.local\bin\serena.exe` with args `start-mcp-server --project-from-cwd --context=codex`.
- `uv.exe`, `uvx.exe`, and `serena.exe` are installed in `C:\Users\Aaron Ge\.local\bin`.
- This machine previously had stale Codex process PATH and a bad PATH entry pointing at `C:\Users\Aaron Ge\.local\bin\claude.exe`; the user PATH was cleaned so `.local\bin` is first, but a machine-wide bad entry could not be removed without admin registry access.
- To make future Codex-launched Serena robust, `mcp_servers.serena.env.PATH` in Codex config explicitly starts with `C:\Users\Aaron Ge\.local\bin` and `C:\Program Files\nodejs`, then includes the cleaned effective machine/user PATH so Serena can resolve `uvx` and Node-based language servers.
- CurrentUser PowerShell execution policy was set to `RemoteSigned` so local user profile scripts can load.
- If the dashboard is needed manually from the repo root: `& "$env:USERPROFILE\.local\bin\serena.exe" start-mcp-server --project-from-cwd --context=codex --enable-web-dashboard true --open-web-dashboard true`.
- Dashboard default starts at `http://localhost:24282/dashboard/`; if occupied, try subsequent ports (`24283`, `24284`, ...).