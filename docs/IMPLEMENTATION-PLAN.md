# Refactor Gemini QoL Automation & Deletion Engine (Clean Event-Driven Architecture)

## Overview
This plan refactors the core DOM detection, automation, and bulk deletion mechanisms in `gemini-qol` from brute-force/hacky polling and forced DOM manipulations (`triggerClick` shotgun events, `el.remove()` on CDK overlays, global `document.body` MutationObserver) into a clean, event-driven, promise-based architecture.

## Key Goals
1. **Clean Deletion Workflow**: Replace `triggerClick` event shotgunning and forced `el.remove()` on Angular CDK overlays across all modules with targeted event triggers and Promise-based element lifecycle hooks (`waitForElement` / `waitForElementToDisappear`).
2. **Lazy-Safe Multi-Scoped Observers & Immediate Promise Waiters**: Eliminate global `document.body` polling and hardcoded `sleep` delays across all modules (`loadAllChats`, `processNextImport`, `scheduleReopenDialog`). Replace with tracked multi-scoped observers bound safely to target viewports (`mat-sidenav-container` for sidebar chats, main view container for `model-response`, `.cdk-overlay-container` for dialogs/menus), a shallow `document.body` shell container bootstrapping observer (`childList: true`, `subtree: false`), and immediate-evaluating Promise waiters.
3. **CDK Overlay & Scroll-Lock Recovery**: Eliminate direct `remove()` DOM node deletion in both `automator.js` (`waitForDialogClose`) and `index.js` (`handleBulkDelete`). Replace with standard `KeyboardEvent` payloads (`key: 'Escape'`, `keyCode: 27`), backdrop fade-out waiters, explicit dialog dismissal, and an `async cleanupOverlaysAndScrollLocks()` helper running unconditionally in `finally` blocks to release Angular CDK backdrop states, remove `cdk-global-scrollblock` classes, and clear inline `top`, `position`, `paddingRight`, and `overflow` styles from `document.body` and `document.documentElement`.
4. **State Transitions, Failure Revert & Event-Driven Scanning**: Track injection and deletion progress using unified `data-qol-status` attributes (`unprocessed` -> `injected` / `no-copy` -> `deleting` -> `deleted`), eliminate background `setInterval` polling in favor of event-driven scanning (handling both `addedNodes` and `removedNodes`), enforce strict module boundary isolation, and handle complete inline style reverts in catch blocks and selection cleanup on failure.

---

## Proposed Changes

### Automation Core (`src/automator.js`)

#### [MODIFY] [src/automator.js](../src/automator.js)

- **Immediate-Evaluating Flexible Promise Waiters (`waitForElement` & `waitForElementToDisappear`)**:
  - `waitForElement(matcherOrSelector, timeoutMs = 1500, targetContainer = null)`:
    - Contract: `Promise<HTMLElement|null>`.
    - Accepts CSS selector string, predicate `(el) => boolean`, or parameterless finder function `() => HTMLElement|null` (such as `() => GeminiAutomator.findDeleteMenuButton()` or `() => GeminiAutomator.findConfirmButton()`).
    - **Scope Binding & Static Selectors**: All finder methods (`findDeleteMenuButton`, `findConfirmButton`) use explicit `GeminiAutomator.SELECTORS` references to prevent `this` binding loss when passed as callbacks.
    - **Immediate Check**: Evaluates `matcherOrSelector` immediately upon call. If target element exists, resolves synchronously without creating a `MutationObserver`.
    - **Type & Fallback Safety**: If `targetContainer` is `null` or unmounted, automatically falls back to `document.body` (`observer.observe(targetContainer || document.body, ...)`).
    - **Leak & Timer Teardown**: Executes both `observer.disconnect()` and `clearTimeout(timeoutId)` in a unified cleanup function on all resolution/timeout paths.
  - `waitForElementToDisappear(matcherOrSelector, timeoutMs = 1500, targetContainer = null)`:
    - Contract: `Promise<boolean>`.
    - **Immediate Check**: Evaluates immediately; if already absent, resolves `true` without creating a `MutationObserver`.
    - **Type & Fallback Safety**: Falls back to `document.body` if `targetContainer` is `null` or unmounted.
    - **Leak & Timer Teardown**: Executes `observer.disconnect()` and `clearTimeout(timeoutId)` in a unified cleanup function on all paths.

- **Refactored Event Dispatcher (`triggerClick`)**:
  - **Custom Target & Disabled Element Guards**: Resolves target element to interactive ancestor before dispatching, and early-exits if disabled:
    `const targetEl = el.closest('button, [role="menuitem"], a, input, gem-button, gmp-menu-item, gem-menu-item, .mat-mdc-menu-item') || el;`
    `if (targetEl.disabled || targetEl.getAttribute('aria-disabled') === 'true') return;`
  - Replaces 8 shotgun events with a precise, W3C UI Events compliant event cycle (`buttons: 1` on press, `buttons: 0` on release):
    1. `if (typeof targetEl.focus === 'function') targetEl.focus();`
    2. `targetEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true }));`
    3. `targetEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));`
    4. `targetEl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true }));`
    5. `targetEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 0 }));`
    6. `targetEl.click();`

- **Unified Async Overlay & Scroll-Lock Cleanup Helper (`cleanupOverlaysAndScrollLocks`)**:
  - `async` static helper method on `GeminiAutomator`:
    1. Invoke `dismissDialog()`.
    2. Dispatch full KeyboardEvent payload:
       `const escapeEvt = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true, view: window });`
       `(document.activeElement || document.body).dispatchEvent(escapeEvt);`
    3. `await waitForElementToDisappear('.cdk-overlay-backdrop', 200)` to allow Angular CDK CSS fade-out animation to finish naturally.
    4. **Active Overlay Protection Guard**: Verify if any active dialog or overlay pane (`mat-dialog-container`, `code-import-dialog`, or `.cdk-overlay-pane:not(:empty)`) remains in `.cdk-overlay-container`. If no active dialogs remain, unconditionally remove `cdk-global-scrollblock` class from BOTH `document.body` AND `document.documentElement` (`<html>`), and reset inline styles on both nodes:
       - `body.style.top = ''; body.style.position = ''; body.style.paddingRight = ''; body.style.overflow = '';`
       - `html.style.top = ''; html.style.position = ''; html.style.paddingRight = ''; html.style.overflow = '';`
    5. **Sibling Overlay Backdrop Validation**: Check if `.cdk-overlay-backdrop` exists when no active `.cdk-overlay-pane` or `mat-dialog-container` sibling elements are present in `.cdk-overlay-container`. If an orphaned backdrop remains after the 200ms animation timeout, perform targeted removal of the orphaned backdrop element.

- **Refactored `waitForDialogClose()`**:
  - Replace `setInterval` polling with direct delegation to `await waitForElementToDisappear('mat-dialog-container, [role="dialog"]', maxWait)` followed by `await GeminiAutomator.cleanupOverlaysAndScrollLocks()`.

- **Event-Driven Deletion (`deleteConversationClean` / In-place `deleteConversation`) & Sidebar Loading (`loadAllChats`)**:
  - `deleteConversation(chatId)`: Updated in-place (aliased from `deleteConversationClean` to preserve public API contract):
    - Contract: Returns `Promise<number>` (elapsed execution time in milliseconds for adaptive cooldown calculation).
    - Execution flow:
      1. Record `const startTime = Date.now();`.
      2. Locate `gem-nav-list-item` for target `chatId` using `CSS.escape(chatId)`.
      3. Add `.qol-deleting` class (`pointer-events: none; opacity: 0.6; transition: opacity 0.2s ease, max-height 0.2s ease;`) for optimistic UI response.
      4. Wrap deletion sequence in `try...catch...finally`:
         - Trigger menu click using `triggerClick`.
         - Wait for delete menu item using `await waitForElement(() => GeminiAutomator.findDeleteMenuButton(), 1500, document.querySelector('.cdk-overlay-container') || document.body)`. **Null-guard**: if `!deleteMenuItem`, throw timeout error.
         - Trigger delete menu item click.
         - Wait for confirmation dialog button using `await waitForElement(() => GeminiAutomator.findConfirmButton(), 1500, document.querySelector('.cdk-overlay-container') || document.body)`. **Null-guard**: if `!confirmBtn`, throw timeout error.
         - Click confirmation button.
         - Await unmount of BOTH `mat-dialog-container` AND `.cdk-overlay-backdrop` using `await waitForElementToDisappear('.cdk-overlay-container mat-dialog-container, .cdk-overlay-backdrop', 1500)`.
         - **Success State**: Set `style.display = 'none'`, remove `.qol-deleting`, and mark `data-qol-status="deleted"` immediately. (Note: `selectedChats` state Map management remains strictly in `ContentCoordinator.handleBulkDelete()` to prevent circular module dependencies).
      5. **Failure Revert in `catch` Block**:
         - On failure or timeout: revert `data-qol-status` back to `"injected"`, remove `.qol-deleting` class, and restore inline styles (`item.style.pointerEvents = ''; item.style.opacity = ''; item.style.display = '';`).
      6. **Unconditional `finally` Teardown**:
         - Execute `await GeminiAutomator.cleanupOverlaysAndScrollLocks()` unconditionally in `finally` for both success and failure paths.
         - Return `Date.now() - startTime`.
  - `loadAllChats()`: Add early-exit guard if `SIDEBAR_LIST` or `getScrollContainer()` returns `null`. Replace fixed `wait(800)` loops with a combined contract: scroll container, invoke `onScrollStepCallback(currentCount)`, wait for item count mutation or max 1500ms step timeout (accommodating network API latency), and stop when either hard iteration limit (`maxTotalSteps = 100`) is reached OR consecutive zero-mutation cycles (`noChangeAttempts >= 3`) AND subpixel scroll boundary tolerance (`scrollHeight - scrollTop - clientHeight <= 25`) are both satisfied.

---

### Coordinator & Observer Engine (`src/index.js`)

#### [MODIFY] [src/index.js](../src/index.js)

- **Elimination of Background `setInterval` Polling & Sleep Loops**:
  - Remove background interval scanner (`setInterval(() => this.scanAndInject(), 1500)`).
  - Remove 500ms background interval polling for bulk import dialog reopening. Replace with event-driven detection via `MutationObserver` examining `removedNodes` for `code-import-dialog` when `isImportingMultiple` is true.
  - Refactor `processNextImport()` and `scheduleReopenDialog()`: replace ALL hardcoded `wait()` sleep delays with `waitForElementToDisappear('.cdk-overlay-backdrop, code-import-dialog')` and `waitForElement(toolsBtnSelector)` matchers.
  - Remove direct DOM node deletion in `handleBulkDelete` (`leftoverOverlays.forEach(el => el.remove())`). Replace with `await GeminiAutomator.cleanupOverlaysAndScrollLocks()`.
  - **Guarded `selectedChats` State Teardown**: In `handleBulkDelete()`, call `this.selectedChats.delete(chatId)` ONLY upon successful resolution of `deleteConversation(chatId)`. Omit unconditional `this.selectedChats.clear()` at the end of bulk delete so any failed item IDs remain selected and visible in the UI for easy user retry.

- **State Transitions (`data-qol-status`)**:
  - `injectCheckbox`: Set `data-qol-status="injected"` on `gem-nav-list-item`.
  - `injectMarkdownCopyButton`: Set `data-qol-status="injected"` on `model-response` **ONLY AFTER** `.qol-copy-markdown-btn` is successfully created and appended to the toolbar. If streaming completes (`!responseEl.querySelector('.streaming')` and `responseEl.getAttribute('aria-busy') !== 'true'`) without a native copy button present, set `data-qol-status="no-copy"` to prevent perpetual re-scanning.
  - Skip scanning nodes marked with `data-qol-status="injected"`, `"no-copy"`, `"deleting"`, or `"deleted"`.

- **Observer Instance Tracking & Shallow `document.body` Shell Bootstrapping**:
  - Maintain reference handles (`this.sidebarObserver`, `this.responseObserver`, `this.overlayObserver`, `this.shellObserver`) on `ContentCoordinator`. Disconnect previous handles before re-binding upon container re-mounting.
  - Attach `shellObserver` to `document.body` with `{ childList: true, subtree: false }` (zero performance overhead) to catch top-level shell container mounts (`mat-sidenav-container`, `.cdk-overlay-container`).
  - Dynamically bind scoped target observers inside `scanAndInject()` / `scheduleScan()` as containers mount:
    1. Sidebar Observer: Bound to `mat-sidenav-container` / `SIDEBAR_LIST` when present for `gem-nav-list-item` mutations.
    2. Response Viewport Observer: Bound to main chat view container when present for `model-response` mutations.
    3. CDK Overlay Observer: Bound to `.cdk-overlay-container` once appended to `document.body` for `mat-dialog-container` and `.mat-mdc-menu-panel` mutations.

- **Monkey-Patched History API & Scroll Event Hooks**:
  - Monkey-patch `history.pushState` and `history.replaceState` to invoke `scheduleScan()` upon SPA route changes.
  - Retain viewport scroll listener on the conversation list container to trigger `scheduleScan()` during infinite scroll pagination.

---

## Verification Plan

### Automated Verification
- Run local syntax/linter checks on modified files: `node --check src/automator.js`, `node --check src/index.js`.

### Manual / Browser Verification
- Execute browser automation via `chrome-devtools-mcp` to test single and bulk chat deletions.
- Verify zero residual `.cdk-overlay-backdrop` elements and confirm `<body>` & `<html>` scrollability (`cdk-global-scrollblock` is removed).
- Test rapid deletion error recovery by simulating timeouts and confirming phantoms are dismissed cleanly with state restored to `"injected"`.
