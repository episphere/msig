# macOS browser checks

These artifacts record browser compatibility smoke tests and a small repeated runtime benchmark on an Apple-silicon Mac running macOS 26.5.2 with 16 GB memory.

The compatibility suite passed SDK import, public mSigPortal fetch, native JavaScript fitting and report generation, local D3 rendering, and Pyodide/WebR capability detection in Chrome 150.0.7871.187, Firefox 150.0.2, and Playwright WebKit 26.4.

The runtime suite ran the five E4 native-JavaScript scenarios in cold and warm phases with three isolated repeats per browser engine. All 90 measured observations completed. These runs are compatibility and limited performance evidence on this host; they are not a substitute for the 20-repeat Windows benchmark and do not establish compatibility with the shipping Safari application or with Linux.

Rerun commands:

```sh
npm run experiment:e6-compatibility -- --output-dir docs/manuscript/experiments/cross_platform_runs/macos/data
npm run experiment:e4-browser-benchmarks -- --browsers chrome,firefox,webkit --repeats 3 --output-dir docs/manuscript/experiments/cross_platform_runs/macos/benchmark-data
```
