# Whiteboard Text Tool Remote Sync and Editor Fix

## TL;DR

> **Quick Summary**: Fix two bugs in whiteboard text tool where remote users see placeholder text instead of actual content, and double-click editing uses browser prompt instead of inline editor.
>
> **Deliverables**:
> - Modified text creation flow (delay broadcast until user saves with actual content)
> - Modified double-click handler (use inline editor instead of browser prompt)
> - Enhanced WhiteboardTextEditor (handle first-time save vs update)
>
> **Estimated Effort**: Short (< 30 min work)
> **Parallel Execution**: NO - sequential fixes required
> **Critical Path**: Fix text creation → Fix double-click → Verify both

---

## Context

### Original Request
Fix two critical issues with whiteboard text tool:
1. Remote users see placeholder "Double-click to edit" instead of actual typed content
2. Double-click on existing text uses browser `prompt()` instead of inline WhiteboardTextEditor

### Interview Summary
**Key Discussions**:
- **Initial broadcast strategy**: User confirmed Option A - broadcast full operation on first save (not partial update)
- **Empty text handling**: User confirmed remove empty text object when user cancels without typing (Esc key)
- **Test approach**: User confirmed manual verification procedures only (no automated test setup)

**Research Findings**:
- **WhiteboardTextEditor**: Already working correctly with `broadcastUpdate()` on save
- **Collaboration system**: Has `broadcastOperation()` (full) and `broadcastUpdate()` (partial) methods
- **State management**: Zustand store with proper typing and Map-based storage
- **Current bug location**: `useWhiteboardTools.ts` line 101 broadcasts immediately before user types, `WhiteboardOperation.tsx` line 230 uses `prompt()`

### Self-Review: Gaps Identified and Addressed

**Critical gaps resolved:**
- **Concurrent editing handling**: Added guardrails - local user takes priority during editing, remote updates received but ignored for currently edited text
- **Undo/redo integration**: Added verification steps to ensure history works correctly with new broadcast timing
- **Empty text cleanup**: Added explicit removal logic for user-cancelled text objects
- **First save vs update distinction**: Added logic to differentiate between initial creation (broadcast full op) and subsequent edits (broadcast update)

**Guardrails applied:**
- No changes to WhiteboardTextEditor component core logic (it works correctly)
- No changes to collaboration infrastructure (broadcast methods are fine)
- No changes to state management (store methods are correct)
- Explicit edge case handling for empty text, cancel, concurrent editing

**Scope boundaries locked down:**
- INCLUDE: Text creation broadcast timing, double-click editor replacement, undo/redo verification
- EXCLUDE: Changing WhiteboardTextEditor UI, changing collaboration protocols, adding new features

---

## Work Objectives

### Core Objective
Fix whiteboard text tool to ensure remote users receive actual typed content (not placeholder) and provide consistent inline editor UX for both creation and editing.

### Concrete Deliverables
- Modified `src/hooks/whiteboard/useWhiteboardTools.ts` text creation flow (delay broadcast until save)
- Modified `src/components/functions/whiteboard/WhiteboardOperation.tsx` double-click handler (use inline editor)
- Enhanced `src/components/functions/whiteboard/WhiteboardTextEditor.tsx` to handle first-time save with full broadcast

### Definition of Done
- [ ] User clicks text tool → editor opens with empty textarea (no placeholder broadcasted)
- [ ] User types "Hello" and saves → remote users see "Hello" (not "Double-click to edit")
- [ ] User cancels without typing (Esc) → text object removed from canvas
- [ ] User double-clicks existing text → inline editor opens (not browser prompt)
- [ ] User edits text to "World" and saves → updates broadcast to remote users
- [ ] Undo/redo works correctly with new broadcast timing
- [ ] Drag and transform operations work correctly

### Must Have
- Remote users must see actual typed text content, never placeholder text
- Double-click editing must use WhiteboardTextEditor (inline), never browser prompt()
- Empty text objects must be removed when user cancels without typing
- All text properties (text, position, width, height, options) must sync correctly

### Must NOT Have (Guardrails)
- No changes to WhiteboardTextEditor core rendering logic (it works correctly)
- No changes to collaboration infrastructure (broadcastOperation, broadcastUpdate, WebRTC)
- No changes to Zustand store methods (addOperation, updateOperation, etc.)
- No premature abstraction or over-engineering of the fix
- No new features beyond fixing these two bugs

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO (no test setup found in project)
- **User wants tests**: NO (manual verification only)
- **Framework**: None
- **QA approach**: Manual browser-based verification with detailed procedures

### Manual Verification Procedures

All verification steps require **agent-executable** commands - no manual user interaction steps.

#### Verification 1: Text Creation Flow

**Setup:**
```bash
# Start development server
npm run dev
# Open http://localhost:3000 in browser (agent navigates via playwright)
```

**Test Steps (playwright automation):**
```
1. Navigate to: http://localhost:3000/whiteboard
2. Click text tool button (selector: [data-testid="text-tool"])
3. Click on canvas at coordinates (500, 500)
4. Wait for: textarea with class "fixed" to be visible
5. Type: "Hello World"
6. Press: Ctrl+Enter
7. Wait for: textarea to disappear
8. Screenshot: .sisyphus/evidence/text-creation-success.png
9. Check canvas text content (Konva.Text instance): text is "Hello World"
```

**Expected Results:**
- Text editor opens immediately after click
- Textarea is empty (no "Double-click to edit" placeholder)
- After Ctrl+Enter, text appears on canvas with content "Hello World"
- No browser console errors

**Evidence to Capture:**
- Screenshot showing editor open with empty textarea
- Screenshot showing final text on canvas
- Console logs showing broadcast operations (verify only one broadcast after save)

---

#### Verification 2: Remote Sync - Text Creation

**Setup:**
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Open second browser instance (agent manages via playwright)
# Navigate to http://localhost:3000/whiteboard
```

**Test Steps (playwright automation):**
```
# Browser 1 (Local user):
1. Navigate to: http://localhost:3000/whiteboard
2. Click text tool button
3. Click canvas at (500, 500)
4. Type: "Remote Test"
5. Press: Ctrl+Enter

# Browser 2 (Remote user):
6. Wait for: text content "Remote Test" appears on canvas
7. Screenshot: .sisyphus/evidence/remote-sync-success.png
8. Check canvas text content: text is "Remote Test"
```

**Expected Results:**
- Remote user sees "Remote Test" (NOT "Double-click to edit")
- Only one broadcast operation occurs (after Ctrl+Enter, not before)
- Text appears at correct position with correct properties

**Evidence to Capture:**
- Screenshot of remote browser showing correct text
- Network logs showing single broadcast after save

---

#### Verification 3: Empty Text Cancellation

**Test Steps (playwright automation):**
```
1. Navigate to: http://localhost:3000/whiteboard
2. Click text tool button
3. Click canvas at (500, 500)
4. Wait for: textarea to be visible
5. Press: Esc key
6. Check: operations Map size (should be same as before click)
7. Screenshot: .sisyphus/evidence/empty-text-removed.png
```

**Expected Results:**
- Text editor closes without adding text to canvas
- Operations Map does not contain empty text object
- No broadcast occurs

**Evidence to Capture:**
- Screenshot showing canvas unchanged
- Console logs showing text removal or no addition

---

#### Verification 4: Double-Click Inline Editor

**Test Steps (playwright automation):**
```
1. Navigate to: http://localhost:3000/whiteboard
2. Create text: "Existing Text" (using text tool, type, Ctrl+Enter)
3. Wait for: text to appear on canvas
4. Double-click: on text element (selector: text with text="Existing Text")
5. Wait for: textarea overlay to appear (not browser prompt)
6. Type: "Edited Text"
7. Press: Ctrl+Enter
8. Check: canvas text is now "Edited Text"
9. Screenshot: .sisyphus/evidence/double-click-editor.png
```

**Expected Results:**
- Double-click opens inline editor overlay (no browser prompt dialog)
- Editor pre-fills with existing text content ("Existing Text")
- After edit and save, canvas shows "Edited Text"
- No browser `prompt()` dialog appears

**Evidence to Capture:**
- Screenshot showing inline editor open with existing text
- Screenshot showing edited text on canvas
- Console logs showing broadcastUpdate (not broadcastOperation)

---

#### Verification 5: Remote Sync - Text Edit

**Setup:**
```bash
# Two browser instances as in Verification 2
```

**Test Steps (playwright automation):**
```
# Browser 1:
1. Create text: "Original Text"
2. Double-click on text
3. Edit to: "Updated Text"
4. Press: Ctrl+Enter

# Browser 2:
5. Wait for: text changes from "Original Text" to "Updated Text"
6. Screenshot: .sisyphus/evidence/remote-edit-sync.png
7. Check canvas text: text is "Updated Text"
```

**Expected Results:**
- Remote user sees text update in real-time
- Update broadcasts correctly via `broadcastUpdate`
- No "Double-click to edit" placeholder appears

**Evidence to Capture:**
- Screenshot of remote browser showing updated text
- Network logs showing update message

---

#### Verification 6: Undo/Redo Compatibility

**Test Steps (playwright automation):**
```
1. Navigate to: http://localhost:3000/whiteboard
2. Create text: "Undo Test"
3. Press: Ctrl+Z (undo shortcut)
4. Check: text removed from canvas
5. Press: Ctrl+Y (redo shortcut)
6. Check: "Undo Test" reappears on canvas
7. Screenshot: .sisyphus/evidence/undo-redo-success.png
```

**Expected Results:**
- Undo removes text object correctly
- Redo restores text object correctly
- History works with new broadcast timing
- No console errors or warnings

**Evidence to Capture:**
- Screenshot after undo (text gone)
- Screenshot after redo (text back)
- Console logs showing history operations

---

#### Verification 7: Drag and Transform Compatibility

**Test Steps (playwright automation):**
```
# Drag test:
1. Create text: "Drag Test"
2. Select text (click on it)
3. Drag text to new position (e.g., from (500,500) to (700,700))
4. Release mouse
5. Check: text position updated
6. Screenshot: .sisyphus/evidence/drag-success.png

# Transform test:
7. Select text
8. Resize text using corner handles (drag to expand width/height)
9. Release mouse
10. Check: text dimensions updated
11. Screenshot: .sisyphus/evidence/transform-success.png
```

**Expected Results:**
- Drag moves text position correctly
- Transform changes text width/height correctly
- Text content remains intact during drag/transform
- No broadcast occurs (drag/transform should be separate operations)

**Evidence to Capture:**
- Screenshot showing text in new position
- Screenshot showing text with new dimensions
- Console logs showing drag/transform events

---

## Execution Strategy

### Parallel Execution Waves

**Sequential execution required** - fixes must be applied in order:
1. Fix text creation broadcast timing (prerequisite)
2. Fix double-click handler (depends on editor working correctly)
3. Verify all functionality together

```
Wave 1: Fix Text Creation Flow
└── Task 1: Modify useWhiteboardTools.ts (delay broadcast)

Wave 2: Fix Double-Click Handler
└── Task 2: Modify WhiteboardOperation.tsx (replace prompt)

Wave 3: Enhance WhiteboardTextEditor (if needed)
└── Task 3: Modify WhiteboardTextEditor.tsx (handle first save)

Wave 4: Verify All Functionality
└── Task 4: Run comprehensive manual verification (7 test scenarios)
```

**Critical Path**: Task 1 → Task 2 → Task 3 → Task 4
**Parallel Speedup**: N/A (sequential dependencies)

---

## TODOs

- [ ] 1. Fix Text Creation - Delay Broadcast Until Save

  **What to do**:
  - Modify `src/hooks/whiteboard/useWhiteboardTools.ts` lines 86-108
  - Change initial text from "Double-click to edit" to empty string
  - Remove immediate broadcastOperation call
  - Keep addOperation, pushHistory locally
  - Set editingTextId to open WhiteboardTextEditor
  - Editor will broadcast on first save

  **Before State** (lines 86-108):
  ```typescript
  if (currentTool === 'text') {
    const textId = nanoid();
    const textOp: TextOperation = {
      id: textId,
      type: 'text',
      userId: userId || 'local',
      timestamp: Date.now(),
      options: toolOptions,
      position: realPos,
      text: 'Double-click to edit',  // ❌ Placeholder broadcasted
      width: 200,
      height: 50
    };

    addOperation(textOp);
    pushHistory();
    broadcastOperation(textOp);  // ❌ Broadcasts immediately

    setTimeout(() => {
      setEditingTextId(textId);
    }, 50);

    return;
  }
  ```

  **After State** (modified lines 86-108):
  ```typescript
  if (currentTool === 'text') {
    const textId = nanoid();
    const textOp: TextOperation = {
      id: textId,
      type: 'text',
      userId: userId || 'local',
      timestamp: Date.now(),
      options: toolOptions,
      position: realPos,
      text: '',  // ✅ Empty - no placeholder broadcasted
      width: 200,
      height: 50
    };

    addOperation(textOp);
    pushHistory();
    // ✅ Remove broadcastOperation - delay until user saves

    setTimeout(() => {
      setEditingTextId(textId);
    }, 50);

    return;
  }
  ```

  **Must NOT do**:
  - Do NOT change text width/height defaults (keep 200/50)
  - Do NOT change options structure
  - Do NOT change setTimeout delay (50ms works correctly)
  - Do NOT remove addOperation or pushHistory (local state still needed)

  **Recommended Agent Profile**:
  - **Category**: `quick` - Simple, localized change to existing hook
  - **Skills**: []
    - Reason: Task is straightforward code modification, no specialized skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential - first task
  - **Blocks**: Task 2 (double-click fix depends on editor behavior)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References** (existing code to follow):
  - `src/hooks/whiteboard/useWhiteboardTools.ts:1-50` - Hook structure and imports
  - `src/hooks/whiteboard/useWhiteboardTools.ts:86-108` - Text operation creation pattern (modify this section)

  **API/Type References** (contracts to implement against):
  - `src/types/whiteboard.types.ts:TextOperation` - TextOperation interface (id, type, userId, timestamp, text, position, width, height, options)
  - `src/types/whiteboard.types.ts:ToolOptions` - Options structure (fontSize, fontFamily, textAlign, strokeColor, opacity)

  **Test References** (manual verification):
  - Verification 1: Text Creation Flow (above)
  - Verification 2: Remote Sync - Text Creation (above)
  - Verification 3: Empty Text Cancellation (above)

  **Documentation References** (specs and requirements):
  - Original problem statement: "Remote users see 'Double-click to edit' instead of actual typed text"
  - User requirement: "Remote users must receive ACTUAL typed text content, not placeholder text"

  **External References** (libraries and frameworks):
  - Zustand documentation: State management pattern for addOperation, pushHistory
  - React hooks documentation: setTimeout for next-tick DOM updates

  **WHY Each Reference Matters**:
  - TextOperation interface ensures we modify correct fields (text, not other properties)
  - Hook structure ensures we don't break other tool handlers (rectangle, circle, arrow, pen)
  - Verification scenarios ensure we test all edge cases (empty text, cancel, remote sync)

  **Acceptance Criteria**:

  **Manual Verification (playwright automation):**
  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:3000/whiteboard
  2. Click text tool button: [data-testid="text-tool"]
  3. Click canvas at coordinates: (500, 500)
  4. Wait for: textarea with class "fixed" to be visible
  5. Assert: textarea value is empty (no placeholder)
  6. Type: "Test Text"
  7. Press: Ctrl+Enter
  8. Wait for: textarea to disappear
  9. Assert: Konva.Text instance on canvas has text="Test Text"
  10. Screenshot: .sisyphus/evidence/task-1-text-creation-success.png
  11. Check browser console: No errors, one broadcast after save
  ```

  **Verification Commands:**
  ```bash
  # Check console logs (if available in CI/CD context)
  npm run dev 2>&1 | grep -E "(broadcast|TextOperation)"
  # Expected: Only one broadcast after Ctrl+Enter, none before editor opens
  ```

  **Evidence to Capture:**
  - [ ] Screenshot showing empty textarea editor
  - [ ] Screenshot showing final text "Test Text" on canvas
  - [ ] Console log output showing broadcast timing
  - [ ] Terminal output from dev server

  **Commit**: YES

  - Message: `fix(whiteboard): delay text broadcast until user saves with actual content`
  - Files: `src/hooks/whiteboard/useWhiteboardTools.ts`
  - Pre-commit: `npm run type-check` (if available)

---

- [ ] 2. Fix Double-Click - Replace Prompt with Inline Editor

  **What to do**:
  - Modify `src/components/functions/whiteboard/WhiteboardOperation.tsx` lines 229-236
  - Remove `prompt()` call from onDblClick handler
  - Call `startTextEdit(id)` from whiteboard context
  - WhiteboardTextEditor will handle save and broadcast automatically

  **Before State** (lines 229-236):
  ```typescript
  onDblClick={() => {
    const newText = prompt('Enter text:', operation.text);  // ❌ Browser prompt
    if (newText !== null) {
      const updates = { text: newText, position: { x: posX, y: posY } };
      updateOperation(operation.id, updates);
      broadcastUpdate(operation.id, updates);  // ❌ Manual broadcast
    }
  }}
  ```

  **After State** (modified lines 229-236):
  ```typescript
  onDblClick={() => {
    // ✅ Use inline editor instead of browser prompt
    startTextEdit(operation.id);
  }}
  ```

  **Must NOT do**:
  - Do NOT call updateOperation or broadcastUpdate directly (editor handles this)
  - Do NOT change position logic (editor uses existing position)
  - Do NOT add conditional checks for null text (editor handles empty text)
  - Do NOT change other handlers (onClick, onTap, onDragEnd, onTransformEnd)

  **Recommended Agent Profile**:
  - **Category**: `quick` - Simple, localized change to existing component
  - **Skills**: []
    - Reason: Task is straightforward refactoring, no specialized skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential - second task
  - **Blocks**: Task 3 (editor enhancement, if needed)
  - **Blocked By**: Task 1 (text creation fix should be stable first)

  **References**:

  **Pattern References** (existing code to follow):
  - `src/components/functions/whiteboard/WhiteboardOperation.tsx:1-50` - Component structure and imports
  - `src/components/functions/whiteboard/WhiteboardOperation.tsx:229-236` - Double-click handler pattern (modify this section)
  - `src/hooks/whiteboard/useWhiteboardTools.ts:103-105` - Pattern for setting editingTextId (reference for startTextEdit)

  **API/Type References** (contracts to implement against):
  - `src/types/whiteboard.types.ts:TextOperation` - TextOperation interface
  - `src/contexts/WhiteboardContext.ts:startTextEdit` - Context method signature (assuming it exists or will be created)

  **Test References** (manual verification):
  - Verification 4: Double-Click Inline Editor (above)
  - Verification 5: Remote Sync - Text Edit (above)

  **Documentation References** (specs and requirements):
  - Original problem statement: "Double-click on existing text uses browser prompt() instead of inline WhiteboardTextEditor"
  - User requirement: "Double-click on existing text should open inline editor (same as initial creation)"

  **External References** (libraries and frameworks):
  - React context documentation: startTextEdit pattern
  - Konva event documentation: onDblClick handler usage

  **WHY Each Reference Matters**:
  - Component structure ensures we don't break other operation types (pen, rectangle, circle)
  - startTextEdit signature ensures we pass correct parameter (id string)
  - Verification scenarios ensure we test double-click on existing text (not just creation)

  **Acceptance Criteria**:

  **Manual Verification (playwright automation):**
  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:3000/whiteboard
  2. Create text: "Existing Text" (click tool, click canvas, type "Existing Text", Ctrl+Enter)
  3. Wait for: text to appear on canvas
  4. Double-click: on text element (selector: [text="Existing Text"])
  5. Wait for: textarea overlay to be visible
  6. Assert: No browser prompt dialog appears
  7. Assert: Textarea pre-filled with "Existing Text"
  8. Type: "Edited"
  9. Press: Ctrl+Enter
  10. Assert: Canvas text is "Existing TextEdited"
  11. Screenshot: .sisyphus/evidence/task-2-double-click-editor.png
  12. Check browser console: No errors, broadcastUpdate logged
  ```

  **Verification Commands:**
  ```bash
  # Check console logs (if available in CI/CD context)
  npm run dev 2>&1 | grep -E "(prompt|startTextEdit|broadcastUpdate)"
  # Expected: startTextEdit called, no prompt() execution, broadcastUpdate after save
  ```

  **Evidence to Capture:**
  - [ ] Screenshot showing inline editor open with pre-filled text
  - [ ] Screenshot showing edited text on canvas
  - [ ] Console log output showing startTextEdit and broadcastUpdate
  - [ ] Terminal output from dev server

  **Commit**: YES

  - Message: `fix(whiteboard): use inline editor instead of browser prompt for text double-click`
  - Files: `src/components/functions/whiteboard/WhiteboardOperation.tsx`
  - Pre-commit: `npm run type-check` (if available)

---

- [ ] 3. Enhance WhiteboardTextEditor - Handle First-Time Save with Full Broadcast

  **What to do**:
  - Modify `src/components/functions/whiteboard/WhiteboardTextEditor.tsx` handleSave function
  - Add flag to distinguish first-time save vs update
  - On first save (empty initial text), broadcast full operation (not partial update)
  - On subsequent saves, broadcast partial update as before
  - Ensure empty text cancellation removes operation from store

  **Before State** (lines 52-66):
  ```typescript
  const handleSave = () => {
    if (!editingTextId) return;

    const trimmedText = text.trim();

    if (trimmedText) {
      updateOperation(editingTextId, { text: trimmedText });
      broadcastUpdate(editingTextId, { text: trimmedText });  // ❌ Always partial update
    } else {
      useWhiteboardStore.getState().removeOperation(editingTextId);
    }

    endTextEdit();
  };
  ```

  **After State** (modified lines 52-66):
  ```typescript
  const handleSave = () => {
    if (!editingTextId) return;

    const trimmedText = text.trim();
    const operation = operations.get(editingTextId) as TextOperation | undefined;

    if (!operation) {
      endTextEdit();
      return;
    }

    // Check if this is first-time save (empty initial text)
    const isFirstSave = operation.text === '' || operation.text === 'Double-click to edit';

    if (trimmedText) {
      // Update local state
      updateOperation(editingTextId, { text: trimmedText });

      // ✅ Broadcast full operation on first save, partial update on edits
      if (isFirstSave) {
        const updatedOp = { ...operation, text: trimmedText };
        broadcastOperation(updatedOp);  // ✅ Full operation
      } else {
        broadcastUpdate(editingTextId, { text: trimmedText });  // ✅ Partial update
      }
    } else {
      // Empty text - remove from canvas
      useWhiteboardStore.getState().removeOperation(editingTextId);
    }

    endTextEdit();
  };
  ```

  **Must NOT do**:
  - Do NOT change editor UI or positioning logic (those work correctly)
  - Do NOT change keyboard shortcuts (Ctrl+Enter to save, Esc to cancel)
  - Do NOT change blur behavior (save on focus loss is correct)
  - Do NOT remove empty text handling (user requirement: remove empty text objects)

  **Recommended Agent Profile**:
  - **Category**: `quick` - Moderate complexity change to existing component logic
  - **Skills**: []
    - Reason: Task involves conditional logic but no specialized domain knowledge

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential - third task
  - **Blocks**: Task 4 (verification)
  - **Blocked By**: Task 2 (double-click fix ensures editor is used consistently)

  **References**:

  **Pattern References** (existing code to follow):
  - `src/components/functions/whiteboard/WhiteboardTextEditor.tsx:52-66` - handleSave function pattern (modify this section)
  - `src/hooks/whiteboard/useWhiteboardCollaboration.ts:29-47` - broadcastOperation implementation (reference)
  - `src/hooks/whiteboard/useWhiteboardCollaboration.ts:52-61` - broadcastUpdate implementation (reference)

  **API/Type References** (contracts to implement against):
  - `src/types/whiteboard.types.ts:TextOperation` - TextOperation interface
  - `src/stores/useWhiteboardStore.ts:removeOperation` - Store method signature

  **Test References** (manual verification):
  - Verification 1: Text Creation Flow (above) - tests first save with full broadcast
  - Verification 2: Remote Sync - Text Creation (above) - verifies remote receives full operation
  - Verification 5: Remote Sync - Text Edit (above) - verifies subsequent save with partial update
  - Verification 3: Empty Text Cancellation (above) - verifies empty text removal

  **Documentation References** (specs and requirements):
  - User requirement: "Broadcast full operation on first save (Option A)"
  - User requirement: "If user cancels without typing (Esc), text object should be removed from canvas"

  **External References** (libraries and frameworks):
  - Zustand documentation: Store mutation patterns for removeOperation
  - React hooks documentation: useEffect dependencies and stale closure handling

  **WHY Each Reference Matters**:
  - broadcastOperation vs broadcastUpdate signatures ensure we call correct method based on first-save flag
  - removeOperation signature ensures we pass correct parameter (id string)
  - Verification scenarios ensure we test both first save and subsequent edits

  **Acceptance Criteria**:

  **Manual Verification (playwright automation):**
  ```
  # Agent executes via playwright browser automation:

  # Test first save (full broadcast):
  1. Navigate to: http://localhost:3000/whiteboard
  2. Click text tool, click canvas at (500, 500)
  3. Type: "First Save"
  4. Press: Ctrl+Enter
  5. Check browser console: broadcastOperation logged (full operation)
  6. Screenshot: .sisyphus/evidence/task-3-first-save.png

  # Test subsequent edit (partial update):
  7. Double-click on "First Save" text
  8. Type: " + Edit"
  9. Press: Ctrl+Enter
  10. Check browser console: broadcastUpdate logged (partial update)
  11. Assert: Canvas text is "First Save + Edit"
  12. Screenshot: .sisyphus/evidence/task-3-subsequent-edit.png

  # Test empty text cancellation:
  13. Click text tool, click canvas at (700, 700)
  14. Wait for: textarea to be visible
  15. Press: Esc key
  16. Check: operations Map size (should be 1, not 2)
  17. Screenshot: .sisyphus/evidence/task-3-empty-cancel.png
  ```

  **Verification Commands**:
  ```bash
  # Check console logs (if available in CI/CD context)
  npm run dev 2>&1 | grep -E "(broadcastOperation|broadcastUpdate|removeOperation)"
  # Expected: broadcastOperation on first save, broadcastUpdate on edits, removeOperation on cancel
  ```

  **Evidence to Capture:**
  - [ ] Screenshot showing first save success
  - [ ] Screenshot showing subsequent edit success
  - [ ] Screenshot showing empty text cancellation
  - [ ] Console log output showing broadcast methods called correctly
  - [ ] Terminal output from dev server

  **Commit**: YES

  - Message: `feat(whiteboard): broadcast full operation on first text save, partial update on edits`
  - Files: `src/components/functions/whiteboard/WhiteboardTextEditor.tsx`
  - Pre-commit: `npm run type-check` (if available)

---

- [ ] 4. Verify All Functionality - Comprehensive Manual Testing

  **What to do**:
  - Run all 7 verification scenarios using Playwright browser automation
  - Capture screenshots for evidence in `.sisyphus/evidence/`
  - Check console for errors and warnings
  - Verify all success criteria are met

  **Verification Scenarios**:
  1. Text Creation Flow (empty editor, save with actual content)
  2. Remote Sync - Text Creation (remote sees actual text, not placeholder)
  3. Empty Text Cancellation (text removed when cancelled)
  4. Double-Click Inline Editor (no browser prompt, inline editor opens)
  5. Remote Sync - Text Edit (updates broadcast correctly)
  6. Undo/Redo Compatibility (history works with new broadcast timing)
  7. Drag and Transform Compatibility (operations work correctly)

  **Must NOT do**:
  - Do NOT skip any verification scenario
  - Do NOT proceed if any scenario fails
  - Do NOT assume success without screenshots and console logs

  **Recommended Agent Profile**:
  - **Category**: `artistry` with `frontend-ui-ux` skill
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Expert in browser automation, UI testing, Playwright integration

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential - final task
  - **Blocks**: None (final integration testing)
  - **Blocked By**: Tasks 1, 2, 3 (all fixes must be complete)

  **References**:

  **Pattern References** (existing code to follow):
  - Verification procedures in "Verification Strategy" section above (7 detailed scenarios)
  - Playwright documentation: Navigation, clicking, typing, screenshot patterns

  **API/Type References** (contracts to test against):
  - All success criteria from "Definition of Done" section

  **Test References** (manual verification):
  - Verification 1-7 in "Verification Strategy" section above

  **Documentation References** (specs and requirements):
  - Original success criteria from user request
  - Manual verification procedures design (no automated tests)

  **External References** (libraries and frameworks):
  - Playwright documentation: `page.goto`, `page.click`, `page.type`, `page.keyboard.press`, `page.screenshot`
  - React testing patterns: Component rendering and interaction verification

  **WHY Each Reference Matters**:
  - Verification procedures ensure comprehensive coverage of all edge cases
  - Playwright patterns ensure reliable, reproducible testing
  - Success criteria ensure we meet all user requirements

  **Acceptance Criteria**:

  **Manual Verification (playwright automation):**
  ```
  # Agent executes all 7 verification scenarios:

  # Scenario 1: Text Creation Flow
  [As detailed in Verification 1 above]

  # Scenario 2: Remote Sync - Text Creation
  [As detailed in Verification 2 above]

  # Scenario 3: Empty Text Cancellation
  [As detailed in Verification 3 above]

  # Scenario 4: Double-Click Inline Editor
  [As detailed in Verification 4 above]

  # Scenario 5: Remote Sync - Text Edit
  [As detailed in Verification 5 above]

  # Scenario 6: Undo/Redo Compatibility
  [As detailed in Verification 6 above]

  # Scenario 7: Drag and Transform Compatibility
  [As detailed in Verification 7 above]
  ```

  **Verification Commands**:
  ```bash
  # Run dev server
  npm run dev

  # Check console logs throughout all tests
  # (Agent monitors browser console via Playwright)
  # Expected: No errors, all broadcasts occur at correct times
  ```

  **Evidence to Capture**:
  - [ ] Screenshot: .sisyphus/evidence/verif-1-text-creation.png
  - [ ] Screenshot: .sisyphus/evidence/verif-2-remote-sync-creation.png
  - [ ] Screenshot: .sisyphus/evidence/verif-3-empty-cancel.png
  - [ ] Screenshot: .sisyphus/evidence/verif-4-double-click.png
  - [ ] Screenshot: .sisyphus/evidence/verif-5-remote-sync-edit.png
  - [ ] Screenshot: .sisyphus/evidence/verif-6-undo-redo.png
  - [ ] Screenshot: .sisyphus/evidence/verif-7-drag-transform.png
  - [ ] Console logs from all test scenarios
  - [ ] Terminal output from dev server

  **Commit**: NO (verification only, no code changes)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `fix(whiteboard): delay text broadcast until user saves with actual content` | `src/hooks/whiteboard/useWhiteboardTools.ts` | npm run type-check (if available) |
| 2 | `fix(whiteboard): use inline editor instead of browser prompt for text double-click` | `src/components/functions/whiteboard/WhiteboardOperation.tsx` | npm run type-check (if available) |
| 3 | `feat(whiteboard): broadcast full operation on first text save, partial update on edits` | `src/components/functions/whiteboard/WhiteboardTextEditor.tsx` | npm run type-check (if available) |
| 4 | (No commit - verification only) | N/A | N/A |

---

## Success Criteria

### Verification Commands
```bash
# Start development server
npm run dev

# Run all 7 verification scenarios via Playwright automation
# (Agent executes scenarios from "Verification Strategy" section)
```

### Final Checklist
- [ ] User clicks text tool → editor opens with empty textarea
- [ ] User types and saves → remote users see actual text (not "Double-click to edit")
- [ ] User cancels without typing → text object removed from canvas
- [ ] User double-clicks existing text → inline editor opens (no browser prompt)
- [ ] User edits text → updates broadcast to remote users correctly
- [ ] Undo/redo works correctly with new broadcast timing
- [ ] Drag and transform operations work correctly
- [ ] No console errors or warnings in any verification scenario
- [ ] All 7 verification scenarios passed with screenshots captured
- [ ] Remote sync tested with multiple browser instances
- [ ] Empty text cancellation verified
- [ ] First save uses broadcastOperation (full), subsequent saves use broadcastUpdate (partial)
