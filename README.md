# [mSigSDK: In-Browser Mutational Signature Analysis](https://episphere.github.io/msig/)

## Overview

**mSigSDK** is a JavaScript Software Development Kit (SDK) designed to facilitate mutational signature analysis entirely within a web browser. Built to support research workflows involving mutational data, it interacts with APIs from [mSigPortal](https://analysistools.cancer.gov/mutational-signatures/) and adheres to modern web standards, ensuring compatibility, scalability, and privacy.

This SDK allows researchers to analyze patient-specific genomic data without downloading sensitive information, providing a secure and private computational environment. With **mSigSDK**, researchers can:
- Visualize and compare mutational signatures.
- Perform dimensionality reduction, hierarchical clustering, and more.
- Extend functionality to other mutation signature ecosystems such as SIGNAL or COSMIC.

---

## Features

- **In-Browser Computation**: All analyses are performed client-side using the user's computational resources.
- **Modular Design**: Adheres to ECMAScript ES6 standards, enabling easy integration and extension.
- **Visualizations**: Supports multiple interactive visualizations via Plotly and AMCharts.
- **APIs**: Seamlessly integrates with mSigPortal's REST APIs to fetch mutational signature data and metadata.
- **Data Privacy**: No data is sent to external servers; all operations are secure and local.
- **Extensibility**: Designed for interoperability with future APIs and datasets.

---

## Quick Start

This is all you need to do to run mSigSDK. You don't need to install anything:

1. Navigate to any website that has not blocked module loading (e.g., [https://dceg.cancer.gov/](https://dceg.cancer.gov/)).
2. Use `Fn + F12` to open your browser's developer console.
3. Fetch the SDK by typing the following code into the console:
   ```javascript
   mSigSDK = (await import("https://episphere.github.io/msig/main.js")).mSigSDK
   ```
4. Fetch some data from mSigPortal by typing the following code into the console:
   ```javascript
   data = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSpectrumData()
   ```

---

## Package Usage

mSigSDK is described as a versioned ES module package. Browser projects can import the SDK entry point after installing the package from this repository or from a future npm release:

```javascript
import { mSigSDK } from "msig";

console.log(mSigSDK.version);
```

The published package entry is `main.js`, and the current SDK version is exposed at runtime as:

```javascript
mSigSDK.version
```

---

## Interactive Examples

The canonical interactive recipes live in the Observable notebook: [mSigSDK / Aaron Ge](https://observablehq.com/@aaronge-2020/signatures). Use that notebook for live workflows, plots, and browser-first examples. The repo README keeps the stable SDK entry points and reproducibility helpers so example code does not drift in two places.

---

## Provenance

```javascript
const resultWithProvenance = mSigSDK.provenance.withProvenance(exposures, {
  analysis: "PCAWG Lung-AdenoCA SBS96 signature fitting",
  parameters: {
    study,
    genomeDataType,
    cancerType,
    mutationType,
    matrixSize,
    signatureSetName,
    exposureThreshold: 0.05,
    exposureType: "relative",
  },
  sourceUrls: [
    "https://analysistools.cancer.gov/mutational-signatures/api/mutational_spectrum",
    "https://analysistools.cancer.gov/mutational-signatures/api/mutational_signature",
  ],
  notes: "Generated in browser with mSigSDK.",
});

console.log(resultWithProvenance.provenance);
```

The provenance object includes the SDK name, SDK version, import URL, generation timestamp, browser runtime details, analysis parameters, and source URLs. This makes exported results easier to audit, rerun, and cite.

---

## Development and Contributions

### Source Code
The source code is hosted on GitHub: [mSigSDK Repository](https://github.com/episphere/msig).

### Observable Notebooks
Explore interactive examples: [Observable Notebooks](https://observablehq.com/@aaronge-2020/signatures).

### Contact
**Aaron Ge**  
Division of Cancer Epidemiology and Genetics, National Cancer Institute.  
Email: [age1@som.umaryland.edu](mailto:age1@som.umaryland.edu).

---

## License
This project is open-source and available under the MIT license.
