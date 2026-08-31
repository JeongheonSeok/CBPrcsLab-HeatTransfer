# CBPrcsLab-HeatTransfer

Educational web tool for the heat transfer laboratory (Chemical Engineering Process Lab).

Students enter the values they measured on the apparatus and compare them against a
steady-state energy balance, a lumped-parameter transient model, and pre-computed CFD
results — all on the same axes.

- **Experiment A** — combined natural convection and radiation from a heated cylinder
- **Experiment B** — radiation error in thermocouple temperature measurement

Every calculation runs in the browser. No input is sent to a server.

> **Prototype.** CFD fields and several material properties are still placeholder
> values. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for what is real and what is not.

## Requirements

What you need depends on what you are doing.

| You want to… | You need |
| --- | --- |
| **Use the tool** | A browser. Open the published URL — nothing to install. |
| **Serve or edit it locally** | Any static file server, e.g. `python3 -m http.server 8000`. |
| **Change `assets/js/physics/`** | Node 20+ and [uv](https://docs.astral.sh/uv/), to run the checks below. |

The site is 180 KB of plain HTML, CSS and ES modules. It loads no libraries, no fonts
and no scripts from anywhere else, so it works offline and deployment is a `git push`.

```bash
# only if you will run the checks
curl -LsSf https://astral.sh/uv/install.sh | sh
```

`npm install` is never needed. `package.json` declares no dependencies at all — only
the shortcuts below — so there is nothing to download and no `node_modules`. npm is
used here purely as a command runner; the commands themselves call Node's and
Python's built-in tooling.

## Scripts

```bash
npm start              # serve on http://localhost:8000
npm test               # property tests for the physics models
npm run verify         # cross-check the models against an independent SciPy implementation
npm run verify:python  # same check using python3 instead of uv
```

`npm start` is only a shortcut for `python3 -m http.server 8000` — run that directly
if you would rather not install Node.

The app uses ES modules, so it has to be served over HTTP either way. Opening
`index.html` straight from the file system will show a blank page.

## Verification

The heat transfer models live in `assets/js/physics/` as pure functions with no DOM
access, so they can be checked outside the browser.

`npm test` asserts the properties the models must satisfy: a thermocouple reading
always sits between the gas and wall temperature, radiation error falls as flow speed
rises, a larger bead lags a smaller one, and the steady state closes the energy
balance. These hold regardless of the specific constants, so they keep working when
measured dimensions replace today's placeholders.

`npm run verify` is the stronger check. It exports the browser results to
`tools/reference.json`, then recomputes every case in `tools/verify_physics.py` using
Brent root finding and adaptive Runge–Kutta — deliberately *different* algorithms from
the bisection and fixed-step RK4 the browser uses, so a mistake in one implementation
cannot hide in the other. The first run takes about 15 seconds while uv fetches NumPy
and SciPy; later runs are under a second.

Run both before committing anything under `assets/js/physics/`.

## Layout

```text
index.html            markup and apparatus SVG diagrams
assets/css/           base · layout · components · views/ · responsive
assets/js/
  core/               DOM helpers, router, canvas plotting, numerical routines
  physics/            heat transfer models — no DOM access, unit-testable
  data/               component copy, CFD case metadata, table schemas
  views/              per-screen input handling and rendering
tests/                property tests for the physics models
tools/                reference export and the SciPy cross-check
docs/ROADMAP.md       development roadmap and hosting review
```

## Conventions

See [`CLAUDE.md`](CLAUDE.md) for commit message and code comment conventions.

## Documents

- [Development plan](260727_공실_열전달_학습툴_계획.md) — full plan (Korean)
- [Summary](260727_공실_열전달_학습툴_계획_요약.md) — condensed version (Korean)
- [Roadmap](docs/ROADMAP.md) — next steps and deployment review (Korean)
