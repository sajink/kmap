# Karnaugh Map Solver

A small, dependency-free web app for simplifying Boolean functions with Karnaugh maps.

## Features

- Supports 2, 3, and 4 variables.
- Accepts minterms and optional don't-care terms.
- Draws the map and shows each stage of the solution.
- Finds prime implicants and selects a minimal cover.
- Displays essential prime implicants and the final simplified expression.

## Hosted Version

[Live Demo](https://kaymap.netlify.app/)

## Run Locally

No build step or package installation is required.

1. Open `index.html` in a modern web browser.
2. Select the number of variables.
3. Enter the result minterms, separated by commas, spaces, or semicolons.
4. Optionally enter don't-care terms.
5. Select **Solve**.

You can also serve the folder with any local static web server and open the resulting URL.

## Input Example

For a four-variable function, enter:

```text
Minterms: 1,2,5,7,8,15
Don't cares: 3,11
```

The allowed minterm range depends on the variable count:

- 2 variables: `0`-`3`
- 3 variables: `0`-`7`
- 4 variables: `0`-`15`

Duplicate values are ignored. A don't-care value that is also listed as a minterm is treated as a minterm.

## Project Files

- `index.html` - application markup and input form.
- `app.js` - map rendering, input validation, and Boolean minimization logic.
- `app.css` - application styling.

## Algorithm

The solver uses the Quine–McCluskey method to generate prime implicants, then selects essential implicants and searches for a cover of all requested minterms. Karnaugh maps use Gray-code ordering so adjacent cells are displayed correctly.
