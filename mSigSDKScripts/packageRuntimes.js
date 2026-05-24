const PACKAGE_RUNTIME_SCHEMA_VERSION = "msig.package-runtimes.v0.3";

const PACKAGE_RUNTIME_MANIFEST = {
  schemaVersion: PACKAGE_RUNTIME_SCHEMA_VERSION,
  generatedFor: "mSigSDK 0.3.0",
  note:
    "External-tool adapters execute only the pinned upstream package through Pyodide or WebR. SDK-native JavaScript methods are not exposed as substitutes for package adapters.",
  tools: {
    deconstructSigs: {
      tool: "deconstructSigs",
      packageName: "deconstructSigs",
      packageVersion: "1.8.0",
      runtime: "webr",
      language: "R",
      artifactKind: "webr-binary-repository",
      packageRepository: "docs/package-repos/webr",
      packageIndex: "docs/package-repos/webr/bin/emscripten/contrib/4.6/PACKAGES",
      adapter: "adapters.deconstructSigs.run",
      exactPackageExecutionRequired: true,
    },
    sigminer: {
      tool: "sigminer",
      packageName: "sigminer",
      packageVersion: "2.3.1",
      runtime: "webr",
      language: "R",
      artifactKind: "webr-binary-repository",
      packageRepository: "docs/package-repos/webr",
      packageIndex: "docs/package-repos/webr/bin/emscripten/contrib/4.6/PACKAGES",
      adapter: "adapters.sigminer.run",
      exactPackageExecutionRequired: true,
      solverPackages: {
        NNLS: "nnls",
        QP: "quadprog",
        SA: "GenSA",
      },
    },
    sigProfilerAssignment: {
      tool: "SigProfilerAssignment",
      packageName: "SigProfilerAssignment",
      packageVersion: "1.1.3",
      runtime: "pyodide",
      language: "Python",
      artifactKind: "pyodide-wheel",
      packageRepository: "docs/package-repos/pyodide",
      packageSpec: "SigProfilerAssignment==1.1.3",
      adapter: "adapters.sigProfilerAssignment.run",
      exactPackageExecutionRequired: true,
    },
    musical: {
      tool: "MuSiCal",
      packageName: "musical",
      packageVersion: "1.0.0",
      upstreamRepository: "https://github.com/parklab/MuSiCal",
      upstreamTag: "v1.0.0",
      runtime: "pyodide",
      language: "Python",
      artifactKind: "pyodide-wheel",
      packageRepository: "docs/package-repos/pyodide",
      packageSpec: "docs/package-repos/pyodide/musical-1.0.0-py3-none-any.whl",
      adapter: "adapters.musical.runRefit",
      exactPackageExecutionRequired: true,
    },
  },
};

function getPackageRuntime(toolName) {
  return PACKAGE_RUNTIME_MANIFEST.tools[toolName] || null;
}

function listPackageRuntimes() {
  return Object.values(PACKAGE_RUNTIME_MANIFEST.tools);
}

export {
  PACKAGE_RUNTIME_MANIFEST,
  PACKAGE_RUNTIME_SCHEMA_VERSION,
  getPackageRuntime,
  listPackageRuntimes,
};
