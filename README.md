# mSigSDK: In-Browser Mutational Signature Analysis

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
