# Realtime Transport Redesign

## Purpose

Pons-Link realtime features currently share a narrow WebRTC data path. Chat, STT, meeting minutes, whiteboard, file transfer, subtitles, and PonsCast have very different delivery requirements, but many call sites send directly through the same peer data channel path.

This design separates realtime traffic by policy so heavy or disposable traffic cannot block control events, final text, or recovery messages.

## Root problem

The unstable-disconnect pattern is most likely caused by mixed traffic on one logical realtime path:

```text
PonsCast frames / file chunks / subtitle chunks / whiteboard bursts
  -> shared data channel queue
  -> bufferedAmount growth
  -> control and final text delayed
  -> peer close/error/disconnected
  -> user sees degraded/disconnected room
```

Multiple RTCDataChannels do not create separate physical bandwidth. They still share the same ICE/DTLS/SCTP transport. The value is policy separation:

- reliable vs disposable delivery
- ordered vs unordered delivery
- retry vs drop behavior
- per-feature backpressure
- priority scheduling

## Target architecture

```text
Room feature
  -> RealtimeTransport API
  -> DataChannelRouter
  -> PriorityScheduler
  -> ChannelPolicy
  -> RTCDataChannel group
  -> WebRTC peer
```

Each peer keeps one RTCPeerConnection for media RTP and a group of data channels for feature traffic.

```text
Peer connection
  - RTP media tracks: camera, mic, screen share, ClickCap stream
  - control channel
  - text channel
  - whiteboard channel
  - file channel
  - media-data channel
  - diagnostics channel
```

## Channel plan

| Channel | Traffic | Reliability | Ordering | Drop policy |
| --- | --- | --- | --- | --- |
| `control` | peer state, lifecycle, recovery, screen/clickcap/ponscast start-stop, meeting minutes on-off | reliable | ordered | never drop |
| `text` | chat, final STT, meeting minutes captions, typing, interim STT | mixed | mixed | interim/typing latest-wins |
| `whiteboard` | draw ops, cursor, viewport, drag, undo/redo sync | mixed | mixed | cursor/viewport/drag latest-wins |
| `file` | file meta, chunks, ack, cancel, resume, subtitle bulk chunks | reliable | ordered | pause, never drop chunks |
| `media` | PonsCast binary frames, canvas/video recorder chunks | unreliable | unordered | drop old frames |
| `diagnostics` | ping/pong, bufferedAmount reports, channel health | low reliability | unordered | drop stale |

## Envelope

Every JSON message should pass through a common envelope before routing.

```ts
type ChannelName = 'control' | 'text' | 'whiteboard' | 'file' | 'media' | 'diagnostics';

type RealtimeEnvelope<T = unknown> = {
  v: 1;
  id: string;
  channel: ChannelName;
  kind: string;
  priority: 0 | 1 | 2 | 3 | 4;
  reliability: 'reliable' | 'unreliable' | 'latest';
  dedupeKey?: string;
  ttlMs?: number;
  createdAt: number;
  payload: T;
};
```

Binary media frames should use a compact binary header with at least:

- protocol version
- channel id
- stream id
- sequence
- timestamp
- payload length

## Priority model

```text
P0 emergency:
  peer recovery, stop stream, leave cleanup, channel health

P1 user-visible reliable:
  chat, final STT, meeting minutes, whiteboard operation

P2 interactive realtime:
  cursor, drag update, viewport, interim STT

P3 bulk reliable:
  file chunks, subtitle chunks

P4 disposable media:
  PonsCast frames, preview frames
```

Rules:

- P0 and P1 must never wait behind P3 or P4.
- P4 must drop when congested.
- P3 must pause/resume, not drop.
- P2 should collapse queued messages by key.

## Backpressure policy

Each channel has independent thresholds.

```ts
const CHANNEL_LIMITS = {
  control: { high: 256 * 1024, hard: 512 * 1024 },
  text: { high: 256 * 1024, hard: 512 * 1024 },
  whiteboard: { high: 512 * 1024, hard: 1024 * 1024 },
  file: { high: 512 * 1024, hard: 2 * 1024 * 1024 },
  media: { high: 256 * 1024, hard: 512 * 1024 },
  diagnostics: { high: 128 * 1024, hard: 256 * 1024 },
};
```

Actions:

- `control`: retry until sent or peer is terminal.
- `text`: retry reliable text; replace interim STT/typing by dedupe key.
- `whiteboard`: retry operations; replace cursor/viewport/drag updates.
- `file`: pause worker until buffered amount drops below low threshold.
- `media`: drop frame immediately when high threshold is exceeded.
- `diagnostics`: send opportunistically.

## Latest-wins queues

These messages should not accumulate:

- STT interim by speaker id
- typing-state by user id
- cursor by user id
- viewport by user id
- drag update by operation id
- PonsCast frame by stream id

```ts
queue.replaceByKey(`stt-interim:${speakerId}`, envelope);
queue.replaceByKey(`cursor:${userId}`, envelope);
queue.replaceByKey(`drag:${operationId}`, envelope);
queue.replaceByKey(`ponscast:${streamId}`, envelope);
```

## Adaptive media QoS

Media-data traffic must degrade instead of disconnecting.

```text
media bufferedAmount > high for 3s:
  fps 30 -> 15

still high:
  fps 15 -> 8

still high:
  bitrate down

still high:
  pause/drop media frames, keep control/text alive
```

## Feature mapping

### Chat

- channel: `text`
- reliable ordered
- no drop

### STT and meeting minutes

- interim STT: `text`, latest/unreliable
- final STT: `text`, reliable
- meeting minutes caption: `text`, reliable
- meeting minutes state: `control`, reliable

### Whiteboard

- draw/update/delete/undo/redo: `whiteboard`, reliable
- cursor/viewport/drag preview: `whiteboard`, latest
- full sync: `whiteboard`, reliable, chunk if large

### PonsCast

- metadata/start/stop: `control`, reliable
- frame chunks: `media`, unreliable/latest/drop
- quality reports: `diagnostics`

### File transfer

- meta/chunk/ack/resume: `file`, reliable
- cancel/stop: `control`, reliable
- transfer progress: local or `diagnostics`

### Subtitles

- display sync: `text`, latest or reliable depending on finality
- track chunks: `file`, reliable chunked
- style/state: `control` or `text`, reliable

### Screen share and ClickCap

- actual media: RTP sender tracks
- lifecycle: `control`, reliable
- start/stop guarded by transition locks
- replaceTrack failure emits `control` recovery event

## Lifecycle locks

These operations need single-flight guards:

- screen share start/stop
- ClickCap start/stop
- PonsCast start/stop
- camera/mic device replacement
- relay takeover

```ts
if (transitionLocks.screenShare) return;
transitionLocks.screenShare = true;
try {
  await performTransition();
} finally {
  transitionLocks.screenShare = false;
}
```

## Recovery state machine

Peer state should be explicit:

```text
connected
  -> degraded
  -> reconnecting
  -> reconnected
  -> failed
```

Recovery tracks:

- signaling socket status
- peer connection status
- data channel open/close by label
- bufferedAmount by channel
- last ping/pong
- active high-risk features
- ongoing offer/answer exchange

## Observability

Record structured diagnostic events:

- channel open/close/error
- bufferedAmount high/hard threshold
- queue bytes
- dropped frame count
- replaceTrack start/success/failure
- active feature during disconnect
- ICE connection state
- RTCPeerConnection state
- simple-peer close/error

Example:

```ts
connectionDiagnostics.record({
  peerId,
  channel: 'media',
  event: 'drop-frame',
  bufferedAmount,
  queueBytes,
  activeFeature: 'ponscast',
});
```

## Implementation phases

### Phase 1: safety patch

- Add PonsCast bufferedAmount gate.
- Drop stale media frames.
- Add subtitle chunk backpressure.
- Add screen/ClickCap/PonsCast transition locks.
- Add structured disconnect diagnostics.

### Phase 2: router abstraction

- Introduce `RealtimeTransport` and `DataChannelRouter`.
- Move direct `sendToAllPeers` calls behind router adapters.
- Keep existing single channel as fallback during migration.

### Phase 3: multi-channel transport

- Create feature-specific RTCDataChannels.
- Register receiver-side `ondatachannel` handlers.
- Queue messages until each channel opens.
- Keep legacy data event fallback for compatibility.

### Phase 4: adaptive QoS and recovery

- Add media fps/bitrate downgrade.
- Pause/resume file workers on channel backpressure.
- Surface channel health in diagnostics.
- Complete peer recovery state machine.

## Acceptance criteria

- Control and final text messages are not blocked by PonsCast/file traffic.
- PonsCast frame congestion causes frame drop or quality downgrade, not peer disconnect.
- File transfer pauses under pressure and resumes without corrupting chunks.
- Whiteboard cursor/viewport/interim STT do not queue unbounded messages.
- Screen share, ClickCap, and PonsCast cannot double-start or double-stop.
- Diagnostics can identify which feature was active when a peer degraded.
