# vega-library

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

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

The build first validates and compiles a generated catalog from `specs/`, then builds the static site into `dist/`.
