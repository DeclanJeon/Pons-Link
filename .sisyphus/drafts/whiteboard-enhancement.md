# Draft: Whiteboard Enhancement Plan

## User's Goal
Enhance collaborative whiteboard with:
1. Text synchronization (real-time with exact coordinates)
2. Full board sync (all changes to remote users)
3. Keyboard arrow keys for moving objects
4. Laser pointer functionality
5. Image paste from clipboard

## Current Implementation Findings

### Sync Architecture
- **Transport**: WebRTC P2P via SimplePeer (sendToAllPeers)
- **Message Types**:
  - `whiteboard-operation`: Broadcast new operations (pen, shapes, text)
  - `whiteboard-update`: Update existing operations (position, rotation, scale)
  - `whiteboard-clear`: Clear all operations
  - `whiteboard-cursor`: Remote cursor positions (throttled 100ms)
  - `whiteboard-delete`: Delete selected operations
  - `whiteboard-background`: Background settings
- **State Management**: Zustand store with Map-based operations
- **Throttling**: Cursor position broadcast throttled to 100ms (useWhiteboardCollaboration.ts:14)

### Text Sync (Current State)
- **Component**: WhiteboardTextEditor.tsx (HTML textarea overlay)
- **Creation**: useWhiteboardTools.ts (lines 85-107) - creates text on canvas click
- **CRITICAL BUG FOUND**: Text creation only adds to local store, does NOT broadcast immediately
- **Editing**: Uses double-click to prompt with `prompt()` (WhiteboardOperation.tsx:225-231)
- **Current Sync Gap**: 
  1. Initial text creation NOT broadcast (others don't see new text)
  2. No real-time typing sync (only on edit completion)
  3. Position updates sync on drag, but not during keyboard movement
- **Position Sync**: Text position is in `position: {x, y}` field

### Selection & Movement (Current State)
- **Selection**: Works with drag select and individual clicks
- **Drag & Drop**: Objects draggable when `isSelected=true` (WhiteboardOperation.tsx:87, 123, 157, 190, 222)
- **Sync on Drag**: `onDragEnd` broadcasts position updates (WhiteboardOperation.tsx:53-66)
- **Keyboard Arrow Keys**: ❌ NOT IMPLEMENTED in handleKeyDown (useWhiteboardTools.ts:386-441)
  - Currently only handles: Space, Ctrl+C/X/V/Z/Y/A, Delete/Backspace
  - No ArrowUp/Down/Left/Right handlers

### Laser Pointer (Current State)
- **Type Defined**: LaserOperation with `path` and `expiresAt` (whiteboard.types.ts:119-123)
- **Tool Button**: 'laser' in Tool type enum (whiteboard.types.ts:28)
- **Handlers**: ❌ NONE in useWhiteboardTools.ts
- **Rendering**: ❌ NONE in WhiteboardOperation.tsx (no 'laser' case)
- **Expected Behavior**: Should track cursor movement and show temporary pointer

### Image Support (Current State)
- **Type System**: No image type in DrawOperationType enum
- **Clipboard**: Internal clipboard implemented (copy/cut/paste in store)
- **System Clipboard**: ❌ NO implementation for image paste
- **Toolbar**: WhiteboardToolbar.tsx has tool buttons but no image upload/paste button

### Current Sync Gaps (Updated)
1. **Text**: 
   - ❌ Initial text creation NOT broadcast (CRITICAL BUG - others don't see new text)
   - ❌ No real-time typing sync (only on edit completion)
   - ❌ Position updates only on drag, not keyboard movement
2. **Selection**: No sync of selection state (local-only)
3. **Movement**: Arrow key movement not implemented at all
4. **Laser**: Fully missing (types exist, no handlers or rendering)
5. **Image**: No image type, paste handler, or upload button
6. **Clipboard**: Internal clipboard only, no system clipboard integration
7. **Conflict Resolution**: Last-write-wins approach with no user awareness

## User Clarifications Needed

### 1. Text Sync Approach
**Option A - Debounced Updates (Simpler)**
- Broadcast text changes every 200-500ms during typing
- Similar to cursor position throttling
- Pros: Simple to implement, consistent with current architecture
- Cons: Not as smooth as Google Docs

**Option B - Real-time Character-by-Character (Complex)**
- CRDT library (Yjs or Automerge) required
- Character-level conflict resolution
- Pros: Perfect collaboration UX like Google Docs
- Cons: Complex, adds dependencies, significant refactoring needed

### 2. Laser Pointer Behavior
**Option A - Local-only (Presentation Mode)**
- Laser pointer only visible locally
- Good for presentations without distracting others
- Simple to implement

**Option B - Synced to All Users**
- All users see each other's laser pointers
- Good for collaborative pointing/highlighting
- Requires broadcast like cursor positions

**Option C - Both (Toggleable)**
- Mode switch in toolbar (Presentation vs Collaboration)
- Maximum flexibility
- More complex UI

**Auto-Expiry**: Should laser trails disappear after N seconds? (expiresAt field exists but unused)

### 3. Arrow Key Movement
- **Step Size**: How many pixels per keypress?
  - 1px: Precise but slow
  - 5-10px: Balanced (recommended)
  - Shift+Arrow: Faster (10-20px)
- **Sync to Remote**: Should arrow key movement broadcast to remote users?
  - Yes: Collaborative positioning
  - No: Local-only adjustment (simpler)

### 4. Image Sync
- **Source**: Clipboard paste only? Or file upload button too?
- **Sync to Remote**: Should images sync to remote users?
  - Yes: Broadcast image data to all peers
  - No: Local-only (simpler but less collaborative)
- **Storage**: How should images be stored?
  - Base64 in Zustand: Simple, but large strings
  - Blob URLs: More efficient, but need cleanup
  - Server upload: Complex, requires backend

### 5. Conflict Resolution Strategy
**Option A - Keep Last-Write-Wins (Current)**
- Simple, no changes needed
- Can cause lost updates
- May be acceptable for simple use cases

**Option B - User ID Tiebreaker**
- Last write wins, but warn if another user was editing
- Middle ground approach
- Adds awareness without complexity

**Option C - Full CRDT (Yjs)**
- Perfect conflict resolution
- Complex architecture change
- Overkill for simple whiteboard?

## Architecture Patterns Identified

### Broadcast Pattern (Existing)
```typescript
// From useWhiteboardCollaboration.ts
const broadcastUpdate = useCallback((id: string, updates: Partial<DrawOperation>) => {
  const message = {
    type: 'whiteboard-update',
    payload: { id, updates }
  };
  sendToAllPeers(JSON.stringify(message));
}, [sendToAllPeers, userId]);
```

### Update Handler Pattern (Existing)
```typescript
// From useWhiteboardCollaboration.ts
const handleRemoteUpdate = useCallback((payload: { id: string; updates: Partial<DrawOperation> }) => {
  updateOperation(payload.id, payload.updates);
}, [updateOperation]);
```

### Throttling Pattern (Existing)
```typescript
// Cursor position broadcast throttled to 100ms
const broadcastCursorPosition = useCallback(
  throttle((x: number, y: number) => {
    // ... broadcast logic
  }, CURSOR_BROADCAST_INTERVAL),
  [sendToAllPeers, userId, nickname, currentTool]
);
```

## Open Questions (Awaiting User Response)
- [ ] Text sync: Debounced (200-500ms) or CRDT (real-time)?
- [ ] Laser: Local-only, synced, or toggleable?
- [ ] Laser auto-expiry: Yes/No, how many seconds?
- [ ] Arrow keys: Step size? Sync to remote?
- [ ] Image paste: Sync to remote? Storage method?
- [ ] Conflict resolution: Last-write-wins, tiebreaker, or CRDT?
