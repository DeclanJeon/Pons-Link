# Realtime Transport Redesign Context

## Task

Refactor Pons-Link realtime WebRTC data transport so feature traffic does not overload one shared data channel path and cause peer disconnects while users operate PonsCast, file transfer, subtitles, whiteboard, screen share, ClickCap, STT, chat, and meeting minutes.

## Desired outcome

- High-priority room control and final text messages stay responsive under media/file load.
- Disposable PonsCast/media frames are dropped or downgraded under congestion.
- Reliable file chunks pause under backpressure instead of blocking other features.
- Whiteboard cursor/viewport/interim STT use latest-wins behavior.
- Screen share, ClickCap, and PonsCast lifecycle transitions are single-flight guarded.
- Diagnostics can identify active feature and channel pressure when peer state degrades.

## Known facts

- Current `WebRTCManager.sendToAllPeers` sends through simple-peer's default data path.
- PonsCast uses `createBroadcaster` but does not pass a `shouldSend` gate tied to `getMaxBufferedAmount`.
- File transfer already checks `getMaxBufferedAmount` and delays chunks above roughly 512KB.
- Subtitle track sending loops over chunks without channel backpressure.
- Whiteboard cursor is throttled, but viewport/drag/full sync still need stronger queue policy.
- Screen share and ClickCap perform sender track replacement and can be exposed to double start/stop races.
- A previous patch added signaling rejoin and peer reconnect attempts after transient drops.

## Constraints

- Keep current signaling/backend contracts intact for the first implementation phase.
- Avoid new runtime dependencies.
- Keep changes incremental and reviewable.
- Preserve current feature behavior while adding safety gates.
- Multi data channel migration should be compatible with existing default channel messages during rollout.

## Likely touchpoints

- `src/services/webrtc.ts`
- `src/services/dataBroadcaster.ts`
- `src/stores/usePeerConnectionStore.ts`
- `src/hooks/useFileStreaming.ts`
- `src/services/subtitleTransport.ts`
- `src/hooks/whiteboard/useWhiteboardCollaboration.ts`
- `src/stores/useMediaDeviceStore.ts`
- `src/hooks/useRoomOrchestrator.ts`

## Initial team split

- Architecture lane: define transport/router boundaries and migration-safe API.
- Media/data lane: PonsCast broadcaster backpressure, frame drop, diagnostics.
- Lifecycle lane: screen share, ClickCap, PonsCast transition locks.
- Bulk/realtime lane: subtitle chunk pacing, whiteboard latest-wins/backpressure.
- QA lane: targeted tests for gates, lock behavior, and existing reconnect tests.

## Open risks

- Full multi-channel data path requires careful simple-peer/RTCPeerConnection integration and may be too broad for a first patch.
- Real browser verification with two peers is still required for confidence.
