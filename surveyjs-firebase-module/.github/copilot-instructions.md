# Copilot repository guidance

Use the shared contracts in `packages/contracts` at every client/server boundary. Keep privileged writes in second-generation Cloud Functions. Public survey documents are projections and must never contain private operational fields. Every rule change requires an emulator test. Prefer small vertical slices with loading, empty, error, denied, offline, retry, success, and disabled states.
