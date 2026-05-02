# Meeting Minutes Feature Context

Task statement:
- Add a meeting minutes system to Pons-Link.
- It works together with live captions.
- Users can turn meeting minutes on/off in Settings.
- Meeting minutes are recorded into Chat as if a user posted them.
- Users can download all meeting records from the chat panel.

Desired outcome:
- A practical product/UX/technical plan before implementation.
- Branch created for the feature.
- Team perspectives: planning, development, marketing, viral, UX, design, QA.

Known facts/evidence:
- Branch: feature/meeting-minutes.
- Live caption final-only UX currently exists through useSpeechRecognition -> Room -> useTranscriptionStore -> SubtitleOverlay.
- Chat flow exists through useChatMessages/useChatStore and peer data channel chat payloads.
- SettingsPanel already has STT controls and transcription store persisted settings.

Constraints:
- Meeting minutes should not expose unstable interim STT text.
- Chat record should feel familiar, not introduce a separate heavy UI unless needed.
- Download should collect meeting-record messages in one file.
- Keep diff small and use existing stores/components where possible.

Unknowns/open questions:
- Exact download format preference. Assumption: Markdown first, possibly TXT fallback.
- Whether meeting notes should be broadcast to all peers or local-only. Assumption: room-visible chat record.
- Whether summary/AI condensation is needed. Assumption: no new AI dependency; record final STT lines as chronological minutes.

Likely codebase touchpoints:
- src/stores/useTranscriptionStore.ts
- src/stores/useChatStore.ts
- src/hooks/useChatMessages.ts
- src/pages/Room.tsx
- src/components/setting/SettingsPanel.tsx
- src/components/functions/chat/ChatPanel.tsx
