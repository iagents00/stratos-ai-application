#!/usr/bin/env node
// Compatibility entrypoint. One health implementation, with explicit scope and release identity.
await import('./ops/doctor.mjs');
