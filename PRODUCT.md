# Product

## Register

**Product.** This is a tool students operate, not a page they read for persuasion. Design serves
the task: enter what you measured, read what it means. There is no marketing surface.

## Users & purpose

Undergraduates in the Chemical & Biological Engineering process laboratory, standing at the rig
with measured values in hand, plus the teaching assistants who prepare and grade the experiment.

Students run two experiments they cannot see inside:

- **Experiment A** — combined natural convection and radiation from a heated cylinder in a duct
- **Experiment B** — how radiation from a hot wall makes a thermocouple read above the true air temperature

They record voltage, current and a handful of temperatures, then have to explain what those
numbers mean. The apparatus is a black box: the flow, the temperature field and the split between
convection and radiation are all invisible. This tool opens that box — it takes the values they
measured and shows where the supplied power went, why a sensor reads high, and how each term
would change under different conditions.

The job on any screen: **connect one measured number to the physics behind it.** Not to produce
the answer for the report — the interpretation stays the student's work.

## Personality

**A textbook that computes.** Closest in spirit to a well-set course handout: the explanation
leads, the numbers sit inside it, and every screen answers "why is it like that" before it shows
a chart. Reading order is top to bottom — conditions, then the answer, then the evidence, then
what was assumed.

Three words: **explanatory, exact, honest.**

Honest is load-bearing here. Several inputs are placeholder values until the rig is measured, the
transient model is not calibrated, and no CFD has been computed yet. The interface says so where
the number appears, not in a footnote. A screen that is not built shows what will go there rather
than fabricated output.

## Anti-references

- **SaaS dashboard.** Rounded cards floating in a grid with big KPI numbers and a soft shadow.
  This was the original prototype's shape and it has been deliberately removed.
- **Toy educational app.** Big icons, bright primaries, rounded everything. It stops reading as an
  instrument and students stop trusting the numbers.
- **Over-drafted engineering drawing.** CAD-dense line work and dimension callouts. Undergraduates
  need a way in, not a technical drawing to decode.
- **Academic paper.** Serif body, wide margins, black on white, statically typeset. It looks like
  something to read rather than something to operate, and hides that the values are live.

## Design principles

1. **A number is a claim; a shape can be an illustration.** Never show a computed-looking value
   that is not computed. Synthetic fields may be drawn if labelled, but they report no units.
2. **Physical quantities own their colours.** Convection, radiation, surface temperature and the
   residual keep the same colour everywhere. UI accent colours are drawn from a different family
   so chrome is never mistaken for data.
3. **Colour is never the only signal.** Series are also separated by line style; states are also
   named in text. Required by the course plan, and it survives colour-blind readers and printing.
4. **Units and assumptions travel with the value.** Every figure carries its unit; every screen
   ends with what it assumed. Students must not adopt a placeholder as a settled value.
5. **Show the relationship, not four separate numbers.** Where terms sum to a whole, draw the whole
   split into parts rather than separate bars.
6. **Runs anywhere, for years.** No build step, no runtime CDN, no framework. It must still open on
   a slow laboratory laptop after the people who wrote it have graduated.

## Accessibility

WCAG AA is the floor and is enforced by tests, not by inspection: contrast ratios for UI, data and
state colours are asserted in `tests/design-tokens.test.mjs`. Chart series carry a line style in
addition to colour. Targets: modern desktop and laptop browsers first, tablets readable.
