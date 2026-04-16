# nhs-vega-library

Shared Vega specs for BI teams, with a GitHub Pages gallery dynamically generated from the repository's `specs/` folders.

## Contributing

Each visual has its own folder under `specs/`, containing the spec json itself, some sample data (which LLMs are really good at generating), and some meta info for gallery navigation:

```text
specs/
  resource-slot-gantt/
    meta.json
    spec.json
    sample-data.json
```

Note that the sample data here is used to populate the example gallery.

Everybody is welcome to create a PR with their own folder, copying the structure of an existing one!

## Local development

Before you start, install Node.js, which includes `npm`. Verify your install:
```bash
node -v
npm -v
```

Make changes to the codebase and preview them:

```bash
# install dependencies
npm install

# preview site locally with hot reloading
npm run dev
```

Note that whilst changes to site layout will be hot-reloaded using `npm run dev`, changes to vega specs won't. To preview spec changes, end the current preview with `ctrl-c`, then run `npm run dev` again.