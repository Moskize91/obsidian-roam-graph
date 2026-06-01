# Roam Graph

Roam Graph is an Obsidian plugin that keeps a generated Canvas graph in the right sidebar. The graph follows the active Markdown note: the active note is placed at the center, and nearby linked notes are arranged around it.

## Status

This repository is an early prototype. The plugin uses Obsidian's native Canvas renderer instead of a custom graph view.

## How It Works

Roam Graph listens for active file changes in Obsidian. When the active file is a Markdown note, it:

1. Reads outgoing links and backlinks from Obsidian's metadata cache.
2. Builds a small `.canvas` file with the active note in the center.
3. Opens that generated Canvas in the right sidebar.

The generated Canvas file is rewritten whenever the active note changes.

## Development

Install dependencies:

```sh
npm install
```

Build the Obsidian plugin bundle:

```sh
npm run build
```

Run typecheck and build:

```sh
npm run check
```

The Obsidian plugin release files are staged in `plugin-dist/`:

- `main.js`
- `manifest.json`
- `styles.css`

## Limitations

- The generated Canvas is not force-read-only. Manual edits may be overwritten on the next focus change.
- Native Canvas opening behavior is used as-is. If Obsidian changes Canvas internals, some interaction details may need adjustment.
- The graph layout is intentionally simple in the first prototype.
