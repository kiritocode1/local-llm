---
name: blank-utils-llm
description: Guide for developing, building, debugging, and extending the @blank-utils/llm browser LLM library
---

# @blank-utils/llm — Development Skill

This skill covers everything needed to work on the `@blank-utils/llm` package — a browser-based LLM inference library with WebGPU acceleration and React integration.

---

## 1. Project Overview

**What it is:** A client-side TypeScript library that runs LLMs entirely in the browser. No server, no API keys.

**Two backends:**

- **WebLLM** — MLC/TVM compiled models via WebGPU (best performance)
- **Transformers.js** — HuggingFace ONNX models via WASM or WebGPU (broader fallback)

**Two entry points:**

- `@blank-utils/llm` — core API (`createLLM`, types, helpers, detection)
- `@blank-utils/llm/react` — React context, provider, hooks (`useChat`, `useStream`, `useCompletion`)

**Package manager:** Uses `bun` (lockfile: `bun.lock`).

---

## 2. Project Structure

```
/Users/blank/Desktop/CREATE/local-llm/
├── src/
│   ├── index.ts              # Main entry — re-exports from core + react
│   ├── core.ts               # createLLM() factory, LocalLLM interface
│   ├── models.ts             # ⭐ Centralized model registry (SINGLE SOURCE OF TRUTH)
│   ├── types.ts              # All TypeScript types & interfaces
│   ├── detect.ts             # WebGPU / WASM capability detection
│   ├── helpers.ts            # DOM utilities (attachToElements, createChatUI, etc.)
│   ├── backends/
│   │   ├── webllm.ts         # WebLLM backend implementation
│   │   └── transformers.ts   # Transformers.js backend implementation
│   └── react/
│       └── index.tsx         # React provider, hooks, components
├── dist/                     # Build output (ESM bundles + .d.ts + WASM assets)
├── llm-test-app/             # Next.js test application
│   └── src/app/page.tsx      # Stress test dashboard
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── README.md
```

### Key Architectural Decisions

1. **`models.ts` is the single source of truth for model definitions.**
   - `WEBLLM_MODELS`, `TRANSFORMERS_MODELS`, defaults, and type aliases all live here.
   - `backends/webllm.ts` and `backends/transformers.ts` import AND re-export from `models.ts`.
   - This avoids circular dependencies (`types.ts` → `models.ts`, not `types.ts` → `backends/`).

2. **Separate builds for main and React entry points.**
   - `src/index.ts` → `dist/index.js`
   - `src/react/index.tsx` → `dist/react/index.js`
   - Built separately to prevent duplicate export errors from `bun build`.

3. **React exports use a single consolidated `export { ... }` statement at the end of `react/index.tsx`.**
   - Individual functions/components are defined WITHOUT the `export` keyword.
   - Only the final `export { LLMProvider, useLLM, useChat, ... }` is used.
   - This prevents `bun build` from generating duplicate exports.

4. **WASM/ONNX assets are copied via `postbuild` script.**
   - `dist/` and `dist/react/` both need `.wasm` and `.mjs` files from `onnxruntime-web` and `@huggingface/transformers`.
   - Without this, consumers get "Module not found" errors for WASM assets.

5. **`SupportedModel` type uses `(string & {})` pattern.**
   - Provides autocomplete for known aliases while still accepting arbitrary strings.
   - `type SupportedModel = WebLLMModelID | TransformersModelID | (string & {})`

---

## 3. Build Process

```bash
# Full build (clean → js → assets → types)
bun run build
```

### Build Steps

| Step          | Command                                                                                                                            | Purpose                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `clean`       | `rm -rf dist`                                                                                                                      | Remove old build                                   |
| `build:js`    | `bun build ./src/index.ts --outfile ./dist/index.js ...` AND `bun build ./src/react/index.tsx --outfile ./dist/react/index.js ...` | Two separate ESM bundles                           |
| `postbuild`   | `cp` commands                                                                                                                      | Copy WASM/ONNX assets to `dist/` and `dist/react/` |
| `build:types` | `tsc -p tsconfig.build.json`                                                                                                       | Generate `.d.ts` files                             |

### Build Externals

Both builds use `--external react --external react-dom` to avoid bundling React.

### Common Build Issues

| Issue                                 | Cause                                 | Fix                                                        |
| ------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| `"exported multiple times"`           | Building both entry points together   | Ensure `build:js` builds them SEPARATELY with `&&`         |
| `Module not found: *.wasm`            | Missing WASM assets                   | Run `postbuild` or add missing `cp` commands               |
| Circular dependency error             | `types.ts` importing from `backends/` | Always import models from `models.ts`, never from backends |
| Duplicate exports in `react/index.js` | Using `export function` syntax        | Use plain `function` + single `export { ... }` at end      |

---

## 4. Publishing

```bash
# Build first
bun run build

# Publish to npm
npm publish --access public

# For local testing (creates tarball without registry)
npm pack
# Then in consumer app:
bun add ../blank-utils-llm-0.2.3.tgz
```

### Versioning

Bump version in `package.json` before publishing. The `prepublishOnly` script automatically runs `bun run build`.

---

## 5. Testing with llm-test-app

The `llm-test-app/` directory contains a Next.js app for stress-testing the library.

```bash
cd llm-test-app

# Install (using tarball for local dev)
bun add ../blank-utils-llm-X.Y.Z.tgz

# Run dev server
bun run dev
```

### Local Integration Workflow

1. Make changes in `src/`
2. Run `bun run build` in the root
3. Run `npm pack` to create a tarball
4. In `llm-test-app/`: update `package.json` to point to new tarball
5. Run `bun install` then `bun run dev`

> **Important:** Use tarball installs (`../blank-utils-llm-X.Y.Z.tgz`) instead of `file:../` to avoid symlink resolution issues with Next.js/Turbopack.

---

## 6. Adding New Models

### Step-by-step

1. **Open `src/models.ts`** — this is the ONLY file to edit.

2. **Add to the appropriate constant:**
   - For WebLLM models: add to `WEBLLM_MODELS`
   - For Transformers.js models: add to `TRANSFORMERS_MODELS`

3. **Use the format:**

   ```typescript
   'alias-name': 'Full-Model-ID-Here',
   ```

4. **Types update automatically.**
   - `WebLLMModelID` and `TransformersModelID` are derived from `keyof typeof`.
   - `SupportedModel` is the union. No manual type updates needed.

5. **Rebuild:** `bun run build`

### Verifying a WebLLM model exists

Check if the MLC model ID exists in [web-llm's config](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts). The ID must match exactly.

### Verifying a Transformers.js model exists

Check if the HuggingFace model has ONNX weights on the Hub. Look for models under `onnx-community/`, `Xenova/`, or `HuggingFaceTB/`.

---

## 7. Modifying the React Integration

All React code lives in `src/react/index.tsx`.

### Structure

```
LLMContext (createContext)
└── LLMProvider (component) — manages lifecycle, calls createLLM()
    ├── useLLM() — raw context access
    ├── useChat() — full chat with message history + eager loading
    ├── useStream() — simple streaming
    ├── useCompletion() — non-streaming completion
    ├── <LLMLoading> — conditional render while loading
    └── <LLMReady> — conditional render when ready
```

### Critical Rules

1. **Never use `export function` on individual components/hooks.**
   - Define them as plain `function` declarations.
   - Export everything via a SINGLE `export { ... }` at the end of the file.

2. **`LLMProvider` does NOT auto-reload on prop changes.**
   - It uses `configRef` + `useEffect` that only runs on mount.
   - To switch models dynamically, use `key={modelId}` on `<LLMProvider>` to force re-mount.

3. **Eager loading pattern (useChat):**
   - `queueWhileLoading: true` (default) lets users send messages while model loads.
   - Messages are stored in `pendingMessage` state.
   - A `useEffect` watches for `isReady && pendingMessage` to process queued messages.

---

## 8. Common Development Tasks

### Task: Fix "exported multiple times" error

1. Check `dist/react/index.js` for duplicate export statements.
2. Open `src/react/index.tsx` and ensure individual functions DON'T have `export` keyword.
3. Ensure the file has ONE `export { ... }` block at the bottom.
4. Ensure `build:js` runs TWO SEPARATE `bun build` commands (not one with multiple entry points).
5. Rebuild: `bun run build`.

### Task: Model not loading / wrong model

1. Check model ID against `WEBLLM_MODELS` or `TRANSFORMERS_MODELS` in `src/models.ts`.
2. Check `resolveModelId()` in the relevant backend file — it maps aliases to full IDs.
3. Verify the model exists on the remote source (MLC cache / HuggingFace Hub).
4. Check browser console for `[LocalLLM]` prefixed logs.

### Task: WASM module not found errors

1. Check if `dist/` contains `.wasm` and `.mjs` files.
2. If not, run `bun run postbuild`.
3. Check if `dist/react/` also has the copies.
4. May need to add new `cp` commands to `postbuild` if new ONNX dependencies are added.

### Task: TypeScript type errors in backends

1. Complex union types from `@huggingface/transformers` can cause "too complex to represent" errors.
2. Use explicit type assertions or `as any` as a pragmatic escape hatch.
3. The `dtype` mapping in `transformers.ts` is a known pain point — keep it simple.

---

## 9. Key Dependencies

| Package                     | Role                           | Version    |
| --------------------------- | ------------------------------ | ---------- |
| `@mlc-ai/web-llm`           | WebLLM backend engine          | `^0.2.80`  |
| `@huggingface/transformers` | Transformers.js backend engine | `^3.8.1`   |
| `react`                     | Peer dependency (optional)     | `>=18.0.0` |
| `typescript`                | Type generation                | `^5.0.0`   |

---

## 10. Export Chain

Understanding how exports flow is critical for avoiding "not found" or "duplicate" errors:

```
src/models.ts
  ├── exports: WEBLLM_MODELS, TRANSFORMERS_MODELS, defaults, types
  │
  ├── → src/backends/webllm.ts (imports + re-exports)
  ├── → src/backends/transformers.ts (imports + re-exports)
  ├── → src/types.ts (imports SupportedModel type, re-exports it)
  │
  └── → src/core.ts (re-exports from types + backends)
        └── → src/index.ts (re-exports from core + react)
```

Every layer must both **import** (for local use) AND **export** (for consumers downstream).

Using `export { X } from './foo'` does NOT make `X` available locally — you need a separate `import`.
