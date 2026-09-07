# vendor/

React and ReactDOM, pinned, committed, and inlined into the artifact by `build.js`.

They are here because of OCCVM-D4 and roadmap 1.6's exit criterion — *"first paint shows the binding, not
a blank frame; no tool installs to a home screen it cannot serve."* Until 1.6 both came from cdnjs at
runtime alongside `babel-standalone`, which meant a cold load with the CDN unreachable rendered nothing.
That was measured, not inferred: the OCCVM golden recorder's first run captured a blank page.

| file | source | retrieved |
|---|---|---|
| `react-18.3.1.umd.min.js` | `https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js` | 2026-09-06 |
| `react-dom-18.3.1.umd.min.js` | `https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js` | 2026-09-06 |

`babel-standalone` is **not** here and is not coming back. It was a 2.98 MB runtime compiler doing at load
time what `build.js` already did at build time — and discarded. 1.6 emits that output instead.

Upgrading is a deliberate act: replace the file, update the version in the table and in `build.js`, rebuild,
re-record the OCCVM golden set. Nothing fetches these; nothing updates them silently.
