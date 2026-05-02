# Pons-Link Release Map

이 문서는 Pons-Link의 과거 커밋 히스토리를 제품 버전 체계로 재정렬하기 위한 기준표다.

## 기준

- 2026-03-01 이전 마지막 커밋을 `v1.0.0` 제품 기준점으로 본다.
- 2026-03-01 이후 커밋은 시간순으로 읽되, GitHub Release는 기능 단위로 묶어 사람이 읽을 수 있게 남긴다.
- 자동 버전은 이후 `main`/`main2` push마다 patch 버전을 올리고 tag/release를 생성한다.
- 기존 원격 tag `v1.0.0`은 현재 2025-10-06 커밋(`8b921ac`)을 가리킨다. 목표 기준점은 2026-02-18 커밋(`a2d4408`)이므로, 원격 tag 재지정은 별도 승인 후 수행한다.

## Baseline

### v1.0.0 — Realtime communication foundation

- Target commit: `a2d4408`
- Date: 2026-02-18
- Subject: `Merge branch 'feature' into develop`
- Scope: 2026년 3월 이전까지 누적된 Pons-Link 실시간 방, WebRTC, 채팅, 파일 공유, 코워치, 모바일 UX, 기본 랜딩/마케팅 기반.

## Retroactive release sequence after baseline

### v1.1.0 — Audio-only room rollout

- Range: `5c1a7cf` → `91b785b`
- Date: 2026-04-13
- Highlights:
  - 오디오 전용 방 제약과 화상 전환 UX 통합
  - 오디오 방 요구사항/승격 계약 문서화
  - 채팅 unread 배지와 직접 URL 진입 기본 아바타 안정화
  - 오디오 로비/참여자 카드의 라운지 톤 개선

### v1.2.0 — Self-understanding product separation

- Range: `92d97b6` → `bc5355e`
- Date: 2026-04-20
- Highlights:
  - 자기이해 흐름을 실시간 통화 진입과 분리
  - 자기이해 최소 테스트 세트 고정

### v1.3.0 — Personal link frontend foundation

- Range: `9785693`
- Date: 2026-04-21
- Highlights:
  - 세션 지속성, GDPR 동의, wizard, back navigation
  - 링크 QR/copy, email trigger, calendar connect 기초 구현

### v1.4.0 — Lounge and public request integration

- Range: `3360db1` → `13c825f`
- Date: 2026-04-23..2026-04-24
- Highlights:
  - 원격 라운지 저장/공개 조회 흐름을 백엔드 표면과 통합
  - 로컬 email-api 실행 및 템플릿 검증 기반 추가
  - 개인 링크 제품 톤의 브랜드/마케팅/룸/라운지 UI 정리
  - 구글 아바타/프로필 이미지 URL 정규화

### v1.5.0 — PonsCast and Azure captions

- Range: `5961533` → `ffc3280`
- Date: 2026-04-24
- Highlights:
  - PonsCast 전송 안정성 강화
  - Azure STT 실시간 자막 연결

### v1.6.0 — Backend SSOT caption, translation, playlist, ClickCap flow

- Range: `fc7c1ed` → `9c839dc`
- Date: 2026-04-26..2026-04-27
- Highlights:
  - 개인 링크 백엔드 표면과 요청 액션 흐름 정리
  - 실시간 자막/번역 토큰 흐름을 백엔드 SSOT로 재배선
  - PonsCast 재생목록, 코워치 패널, 모바일 자막 오버레이 안정화
  - ClickCap extension-backed capture fallback과 streamId 연결

### v1.7.0 — Versioning CI bootstrap

- Range: `9b70301` → `250a883`
- Date: 2026-04-27
- Highlights:
  - Pons-Link 버전 히스토리 파일 생성
  - 자동 버전 bump workflow 도입
  - main push 버전 bump 설정

### v1.8.0 — Brand, personal link, self-understanding, room stabilization

- Range: `6923ae6` → `6744b14`
- Date: 2026-04-29
- Highlights:
  - 브랜드 자산과 마케팅 화면 정비
  - 라운지 요청 흐름을 백엔드 계약에 맞춤
  - 자기이해 화면 언어와 저장 흐름 정리
  - 실시간 룸 협업 UI와 전송 안정성 강화

### v1.9.0 — Session entry, landing, and open room consistency

- Range: `de389c2` → `d14ae71`
- Date: 2026-04-29..2026-04-30
- Highlights:
  - 미팅 요청 시간 기준과 즉시 수락 이동 보정
  - 세션 링크와 오픈룸 방 타입 정합성 유지
  - 랜딩 코스믹 배경/입장 UX 개선
  - 숫자형 룸 식별자 오픈방 진입 보정

### v1.10.0 — STT fallback, translation fallback, and realtime initialization

- Range: `f1cff71` → `9e61333`
- Date: 2026-04-30
- Highlights:
  - Deepgram STT 실패 시 fallback 인식기 전환
  - Deepgram WebSocket Bearer 인증과 백엔드 프록시 전환
  - 번역 엔진 fallback 확장
  - 유저 연결 지연을 줄이기 위한 room-joined 이후 초기화 정렬

### v1.11.0 — Realtime congestion reduction and meeting minutes UX

- Range: `7329d2c` → `04c380d`
- Date: 2026-05-02
- Highlights:
  - 안정적인 speech captions 우선화
  - transient peer drop 복구와 realtime congestion 완화
  - feature data channel 분리
  - 회의록 제어를 채팅으로 이동하고 동의 흐름/채팅 사용성 정리

### v1.11.1 — STT default backend proxy hotfix

- Range: `a783672`
- Date: 2026-05-02
- Highlights:
  - STT 기본 경로를 Azure browser direct에서 Deepgram backend proxy 우선으로 전환
  - Azure Speech는 direct browser fallback으로 유지

## Tag backfill policy

원격 tag를 재작성하지 않는 안전한 순서는 다음과 같다.

1. 현재 원격 `v1.0.0` 위치를 확인한다.
2. `v1.0.0`을 2026-02-18 기준 커밋(`a2d4408`)으로 재지정할지 승인받는다.
3. 승인 후에만 원격 tag를 삭제/재생성한다.
4. `v1.1.0`부터 `v1.11.1`까지 annotated tag를 생성한다.
5. GitHub Release는 이 문서의 highlights를 기준으로 생성한다.

원격 tag 재지정은 기존 배포/참조를 깨뜨릴 수 있으므로 자동 workflow에서는 수행하지 않는다.
