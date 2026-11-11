---
name: cowork-usage
description: Turn on Usage Desk for this task and open its panel beside the chat. Use when asked to open Usage Desk or to see this task's token usage.
---

Every step here costs the person tokens, so use the fewest calls you can, with no commentary. Never read, list, rewrite or summarize anything not named below.

1. Run this one command: `cat .usage-desk-cowork/status.json 2>/dev/null || echo none`. The `task` value under `start` is this task's id. Then call `report_usage` with `session` set to that id, or with no arguments if there was none. Use ToolSearch first only if the tool is not loaded. Its answer holds `task` and `panel` (the link of the person's Usage Desk panel, or nothing).
2. If you are told the panel is already open, skip to step 4.
3. Open the panel beside this task: Artifact `action: "open"` with the `panel` link followed by `#` and the `task` id. If `task` is empty, or opening with the `#` part is refused, open the link alone.
4. Reply only: `Usage Desk is open beside this task.`

Only when `panel` is empty, or opening it fails because it no longer exists, set the panel up once:

a. Run `cp /mnt/skills/plugin-files/usage-desk-cowork/panel/usage-desk.html ./usage-desk-cowork.html`. If that path is missing, copy `panel/usage-desk.html` from this plugin's folder (two levels above this skill's folder).
b. Publish `./usage-desk-cowork.html` as a new Artifact, unchanged and unread, with no `url`: `icon: "gauge"`, `description: "Reads this computer's Usage Desk extension."`, `capabilities: {"mcp": {"servers": [{"server": "host:Usage_Desk", "tools": ["read_usage", "usage_action"]}]}}`. Keep it private. Never update or delete an older panel.
c. Call `report_usage` with `panel` set to the new link, so later tasks skip this setup. Then go to step 3.

If there is no Artifact tool here, call `open_usage_desk` with no arguments instead and reply: `Usage Desk is open in your browser.`

If `report_usage` is missing, reply: `Usage Desk can't reach your computer. Check that the Usage Desk extension is installed and turned on in the Claude desktop app.`
