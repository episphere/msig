# Legacy mSigPortal Client

This folder contains the legacy React client for the mSigPortal application. It is kept for portal-maintenance context and is separate from the browser SDK package exposed through `main.js`.

## Common Commands

```bash
npm install
npm start
npm run build
```

`npm start` serves the legacy client at `http://localhost:3000` when its dependencies and matching backend configuration are available. SDK notebooks and manuscript figure pages use the repository-level `npm run serve:observable` workflow instead.
