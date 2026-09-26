# Repository Guidelines

## Project Structure & Module Organization

This repository contains a Spanish-language static website, “¿Qué veo hoy?”. All source files live at the repository root:

- `index.html`: page structure, navigation, four selection groups, and a temporary result panel.
- `style.css`: color variables, section styles, interaction states, animation, and responsive rules.
- `app.js`: selection state, button event handlers, and result rendering.

There are no dedicated asset or test directories, external dependencies, or backend. The current result summarizes user choices; it does not recommend actual titles.

## Build, Test, and Development Commands

No build step or package manager is configured. Open `index.html` directly in a browser, or serve the repository with Python 3:

```sh
python3 -m http.server 8000
```

Visit `http://localhost:8000` to preview the site. There are no configured test, lint, or formatting commands.

## Coding Style & Naming Conventions

Use two-space indentation in HTML, CSS, and JavaScript. Follow the existing vanilla JavaScript style: `const` where possible, double-quoted strings, semicolons, and camelCase identifiers. Use kebab-case CSS classes and descriptive section comments.

Keep visible copy in Spanish. Keep HTML `data-group` values aligned with the `selections` keys (`platform`, `type`, `mood`, `time`); `data-value` supplies each selected value. Preserve matching selectors across all three files. Reuse CSS custom properties for colors and group responsive changes with the existing media queries.

## Testing Guidelines

No automated testing framework, test naming convention, or coverage threshold is configured. Manually verify changes in a browser:

- Each group allows exactly one selected option and updates its visual state.
- “Dime qué ver” displays the current selections and scrolls to the result.
- Navigation anchors work and the console shows no errors.
- Layout remains usable above and below the 850px and 520px breakpoints.

## Commit & Pull Request Guidelines

The repository has no commits yet, so no established message convention exists. Use short, imperative commit subjects, such as `Fix mobile option spacing`, and keep changes focused.

Pull requests should explain the change, list manual checks performed, and link related issues when applicable. Include desktop and mobile screenshots for visual changes. Identify any newly introduced dependencies or setup steps.
## ¿Qué veo hoy? repository rules

- For changes to recommendation logic, TMDB integration, mood/platform/time filters, result rendering, localStorage recommendation history, or `/api/*`, invoke `$que-veo-hoy-maintainer` before editing.
- Never expose `TMDB_BEARER_TOKEN` to client code or Vite-prefixed environment variables.
- Preserve the existing cream/black/electric-yellow retro-tech brutalist visual language unless the user explicitly asks for a redesign.
- A successful HTTP response is not sufficient: recommendation changes must be semantically tested against the selected mood/type filters.
- After relevant changes, run `npm test` and `npm run build`.
