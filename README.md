# Usage Desk for Cowork

A side panel for Claude Cowork that shows where each task's usage goes, while you work.

![The Usage Desk owl in each of its outfits](docs/mascots.svg)

Cowork tells you when you hit a limit. Usage Desk shows you how full the current task is, how close you are to your 5-hour and weekly limits, and why, in plain language. It is the Cowork version of [Usage Desk for Claude Code](https://github.com/dcngalves/usage-desk).

## What it shows

- **Your agent**: a little owl that walks while Claude works. Press it to pick one of eight outfits, from astronaut to scientist, or press the name to rename it. Each subagent gets its own card.
- **Three bars**: the current task's context, your 5-hour limit and your weekly limit. Press a bar to open its details.
- **Current task**: what fills the context window, by category. Press a category to read why it's high and what you can do about it.
- **5 hours and weekly**: Claude's own percentage, then the Cowork tasks that used the most, with cached tokens kept separate.
- **Compact**: a big task offers a Compact button.
- **Cache clock**: a countdown until the task's cache goes cold, and a Keep warm button. Each Keep warm sends a tiny request, which uses a little of your limit.
- **What Claude did**: each reply and job with its tokens. Press one to see why it took that many.

Each panel follows the task it was opened from, so two tasks show two sets of figures.

## How it works

Cowork tasks run in the cloud, so Usage Desk comes in three parts:

- **The plugin** runs inside each Cowork task. It collects the figures as the task works, without asking Claude.
- **The extension** runs in the Claude desktop app on your computer and keeps the latest figures there.
- **The panel** is a private page that opens beside the task and reads the extension every 5 seconds.

## Install

You need:

- **The Claude desktop app on macOS**, with Cowork
- **Python 3**, which macOS offers to install if it's missing

1. Download both files from [`dist`](dist):
   - `usage-desk-0.9.8.mcpb`, the extension
   - `usage-desk-cowork-0.9.8.zip`, the plugin
2. Open the `.mcpb` file. The Claude desktop app asks to install the Usage Desk extension.
3. In Cowork, open **Customize**, then upload the `.zip` file as a plugin.
4. Start a task, send a message, then type `/cowork-usage`.

The first time, the app asks a few questions. Choose **Always allow** for the Usage Desk tool, allow Claude to copy and publish the panel, and allow the panel to use the Usage Desk extension. The panel then opens beside the task. Later tasks skip the publishing.

In each new task, type `/cowork-usage` to open its panel.

### Update or remove

To update, install the newer `.mcpb` and replace the plugin with the newer `.zip`. To remove, delete the plugin in Cowork's Customize page and the extension in the desktop app's Extensions settings. Your saved figures are in `~/.claude/usage-desk-cowork`, which you can delete.

## What it costs in tokens

Cowork re-reads its own setup, about 170,000 tokens, on every request Claude makes, even for "hi". That is Cowork's cost, not Usage Desk's, but it means every step Claude takes for Usage Desk is expensive in raw token counts. Nearly all of those tokens are cache re-reads, which are billed at a small fraction of the normal price and count far less towards your limits.

- **Installing the extension and the plugin: none.** Neither calls Claude.
- **The very first `/cowork-usage` after installing or updating: about 460,000 to 640,000 tokens**, nearly all cache re-reads, which was about $0.04 to $0.06 on Haiku 5.5 at list prices in tests. Claude publishes your private panel page in that run. This happens once per version.
- **`/cowork-usage` in later tasks: about 4 requests**, so roughly 600,000 tokens and $0.04 on Haiku 5.5. This figure is an estimate from the steps involved, not yet a measurement. A larger model costs more for the same steps.
- **Live updates after that: none.** The plugin sends figures without asking Claude.
- **Keep warm and Compact** use your limit only when you press them.

Yours will vary with the model and with how much is already in the task. The panel's "What Claude did" list shows what each step actually took.

## Your data stays on your computer

- The plugin handles token counts, tool names, file paths and short labels. It never reads out or sends message text.
- The figures travel over the Claude app's own connection to the extension, which keeps the last 30 tasks in `~/.claude/usage-desk-cowork` and sends them nowhere else.
- The panel page holds no figures. It reads them from the extension each time, only inside the Claude desktop app on the same computer, and only for you.

## What the figures mean

- The 5-hour and weekly percentages come from Claude's last reply in the task. Before that, they come from the desktop app's last saved reading, marked with its age.
- Costs use Anthropic's list prices. They're estimates, not what you pay on a plan.
- Shares per task cover Cowork tasks only. Usage in claude.ai and Claude Code counts towards your limits but isn't listed here.

## Works on

| System | Status |
| --- | --- |
| macOS | Tested |
| Windows | Not supported yet |

If something doesn't work, please [open an issue](https://github.com/dcngalves/usage-desk-cowork/issues).

## Build it yourself

`./build.sh` builds the panel page and packs both files into `dist`. The plugin's source is in [`plugin`](plugin), the extension's in [`extension`](extension), and the panel is assembled by [`panel/build.py`](panel/build.py).

## Credits and license

- Usage Desk is © 2026 dcngalves, released under the [MIT license](LICENSE).
- The owl is original art made for this project.
- The idea of an agent icon that walks and dresses for the kind of work, and its outfit animations, was adapted from savvy-progress in [johnnyvizz/claude-kit](https://github.com/johnnyvizz/claude-kit) (MIT). Its notice is in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
- Prices come from [Anthropic's pricing page](https://platform.claude.com/docs/en/about-claude/pricing).

Claude and Claude Cowork are trademarks of Anthropic, PBC. Usage Desk is an independent project and isn't affiliated with or endorsed by Anthropic.
