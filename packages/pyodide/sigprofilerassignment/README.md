# SigProfilerAssignment Pyodide Artifact

Target: `SigProfilerAssignment==1.1.3`.

Expected output:

```text
docs/package-repos/pyodide/SigProfilerAssignment-1.1.3-py3-none-any.whl
```

Build notes:

- The upstream package is pure Python, but its dependency graph includes
  scientific Python packages that must be available in the target Pyodide
  runtime.
- The browser adapter runs in matrix mode and disables plotting and mutation
  probability export for browser execution.
- If a dependency cannot be satisfied in Pyodide, the adapter must report an
  availability error rather than substituting SDK-native code.
