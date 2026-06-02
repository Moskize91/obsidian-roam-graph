# Roam Graph

Roam Graph is an [Obsidian](https://obsidian.md/) plugin that keeps a small, focus-following graph in the right sidebar.

The graph follows the note you are editing. Your active note stays in the center, backlinks appear on the left, outgoing links appear on the right, and nearby daily notes appear above and below when the active note is a daily note.

Roam Graph uses Obsidian's native Canvas renderer. The graph you see is a real Obsidian Canvas file, not a custom UI. This keeps the experience close to Obsidian's own editing model and Canvas quality.

## Usage

After enabling the plugin, Roam Graph opens a generated Obsidian Canvas in the right sidebar.

Open a Markdown note and the graph will follow it automatically. You can also open or refresh the graph from the command palette:

- `Roam Graph: Open graph for active note`
- `Roam Graph: Refresh graph`

You can also use the ribbon icon to open the graph for the active note.

Click a note in the graph to navigate to it. Roam Graph keeps the generated Canvas in the sidebar and opens the selected note in the main workspace.

## Features

- Follow the active Markdown note automatically.
- Show backlinks and outgoing links around the active note.
- Show nearby daily notes when the active note matches your Daily Notes settings.
- Expand additional link layers from the Canvas.
- Use native Obsidian Canvas nodes and links instead of a custom graph UI.
- Keep the graph in the right sidebar while you write.

## Settings

- **Graph folder [default: vault root]**: Choose where the generated `Roam Graph.canvas` file is stored.
- **Layer limit [default: 4]**: Set how many linked notes appear in each visible layer.
- **Daily context limit [default: 2]**: Set how many nearby daily notes appear on each side of the active daily note. Set this to `0` to hide daily note context.

## Installation

Install Roam Graph from Obsidian's Community Plugins browser when it is available there:

1. Open **Settings**.
2. Go to **Community plugins**.
3. Search for `Roam Graph`.
4. Install and enable the plugin.

For manual installation, copy the release files into:

```text
<vault>/.obsidian/plugins/roam-graph/
```

The plugin folder should contain:

- `main.js`
- `manifest.json`
- `styles.css`

Then reload Obsidian and enable Roam Graph from **Community plugins**.

## FAQ

### Why does Roam Graph create a Canvas file?

Roam Graph uses Obsidian's built-in Canvas as its renderer. The generated Canvas is the sidebar graph.

This is intentional: Roam Graph does not maintain a separate visual system. The graph uses Obsidian's native Canvas behavior, styling, file nodes, and interactions.

### Can I edit the generated Canvas?

You can, but manual edits may be overwritten the next time Roam Graph refreshes. Treat `Roam Graph.canvas` as a generated file.

### Does Roam Graph modify my Markdown notes?

No. Roam Graph reads Obsidian's link metadata and writes only the generated Canvas file.

### How does daily note context work?

Roam Graph reads your Obsidian Daily Notes settings. When the active note matches your configured daily note folder and date format, nearby daily notes are shown above and below the center note.

### Is this a replacement for Obsidian's Graph view?

No. Roam Graph is a local, focus-following Canvas graph. It is meant to stay close to your current note while you work.

## For contributors

Developer notes live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Run the project checks with:

```sh
npm run check
```

## Releasing

Releases are created from GitHub Actions.

1. Update `manifest.json` and `package.json` to the same `x.y.z` version.
2. Merge the version change into `main`.
3. Run the **Release** workflow from the GitHub Actions tab.

The workflow builds the plugin, creates a GitHub release whose tag matches `manifest.json.version`, and uploads the files Obsidian needs:

- `main.js`
- `manifest.json`
- `styles.css`
