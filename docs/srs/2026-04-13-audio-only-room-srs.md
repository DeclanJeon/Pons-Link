# SRS: 오디오 전용 방(1:1 / 그룹) + 합의 기반 화상방 전환

작성일: 2026-04-13
기준 문서: docs/prd/2026-04-13-audio-only-room-prd.md
작성 기준: 현재 src/ 코드 구조 반영

## 1. 목적
본 문서는 오디오 전용 방 기능을 시스템 요구사항 수준으로 정의한다.
목표는 다음 3가지를 구현 가능한 요구로 고정하는 것이다.
- 오디오 전용 방에서 카메라를 제품적으로 비활성화하고 비노출한다.
- Lobby와 Room을 오디오 퍼스트 UX로 동작시킨다.
- 참여자 전원 동의 시 동일 멤버 구성으로 화상 방으로 승격 이동할 수 있게 한다.

이 문서는 PRD의 제품 요구를 기능 요구, 데이터 요구, 인터페이스 요구, 검증 시나리오로 변환한다.

## 2. 범위
포함 범위
- Landing 방 타입 확장
- Lobby audio-only 프리조인 플로우
- Room audio-only 런타임 플로우
- 아바타 선택/저장/전파
- 카메라 기능 비노출 정책
- 화면공유 유지 및 카메라 overlay 금지 정책
- 합의 기반 오디오→화상 방 전환
- 방 제목 계승 및 충돌 suffix 규칙

비포함 범위
- 대규모 방송형 room
- 사용자 업로드 아바타
- 부분 동의 전환
- 오디오 방 내부 개별 카메라 예외 허용
- 별도 음성 인프라 분리

## 3. 시스템 컨텍스트
현재 시스템은 React + Zustand + socket signaling + WebRTC 기반 방 구조를 가진다.
현재 확인된 주요 연관 요소:
- 방 타입 정의: src/types/room.types.ts
- 프리조인: src/pages/Lobby.tsx, src/stores/useLobbyStore.ts
- 세션: src/stores/useSessionStore.ts
- 미디어 장치: src/services/deviceManager.ts, src/stores/useMediaDeviceStore.ts
- 룸 진입/오케스트레이션: src/pages/Room.tsx, src/hooks/useRoomOrchestrator.ts
- 네비게이션: src/components/navigator/ControlBar.tsx
- 설정: src/components/setting/SettingsPanel.tsx, src/components/setting/DeviceSelector.tsx
- 참여자 표시: src/hooks/useParticipants.ts, src/components/media/VideoPreview.tsx, src/components/media/ContentLayout.tsx
- signaling: src/stores/useSignalingStore.ts

## 4. 정의
- 오디오 방: 카메라 권한 요청 없이 음성 기반으로 동작하는 방. 카메라 UI는 사용자에게 노출되지 않는다.
- 화상 방: 기존 camera-enabled 방.
- 합의 기반 승격: 오디오 방 참여자 전원이 동의했을 때 새 화상 방을 생성하고 이동하는 절차.
- 아바타: DiceBear HTTP API 기반 식별 프로필 이미지.
- capability: 특정 roomType이 허용하는 기능 집합.

## 5. 가정 및 제약
1. 현재 정원 정책은 one-to-one=2명, video-group=4명이다.
2. MVP의 그룹 오디오는 우선 기존 그룹 정원 정책을 계승한다.
3. 현재 deviceManager.initialize()는 audio+video 동시 권한 요청 구조이므로, audio-only 전용 초기화 경로가 필요하다.
4. 현재 signaling payload는 roomType을 join-room 시 전송한다. 승격 합의 및 room migration 관련 이벤트는 신규 확장이 필요하다.
5. 현재 참여자 렌더링은 VideoPreview 중심이다. audio-only는 avatar-first 분기가 필요하다.

## 6. 상위 시스템 요구
### SR-01 방 타입 체계
시스템은 오디오 방과 화상 방을 구분 가능한 roomType 또는 동등한 capability 조합으로 표현해야 한다.

### SR-02 capability 기반 제어
시스템은 문자열 분기 난립이 아니라 room capability 모델을 통해 UI 노출, 권한 요청, 기능 허용 여부를 제어해야 한다.

### SR-03 카메라 비노출 보장
오디오 방에서는 카메라 관련 제어와 설정이 disabled가 아니라 hidden 상태여야 한다.

### SR-04 카메라 권한 차단
오디오 방 흐름에서는 애플리케이션이 신규 카메라 권한을 요청하지 않아야 한다.

### SR-05 아바타 기반 참여자 식별
오디오 방에서는 각 참여자가 영상 대신 아바타와 닉네임으로 인식되어야 한다.

### SR-06 합의 기반 승격
오디오 방의 화상 전환은 참여자 전원 동의가 있을 때만 허용되어야 한다.

## 7. 외부 인터페이스 요구

### 7.1 사용자 인터페이스
#### UI-01 Landing
- 시스템은 사용자가 오디오 1:1, 오디오 그룹, 화상 1:1, 화상 그룹을 구분하여 선택할 수 있게 해야 한다.
- 시스템은 선택된 roomType을 URL query와 동기화해야 한다.
- 시스템은 오디오 타입 설명에 카메라 비사용 특성을 표시해야 한다.

#### UI-02 Audio Lobby
- 시스템은 오디오 방 Lobby에서 로컬 카메라 프리뷰를 렌더링하지 않아야 한다.
- 시스템은 오디오 방 Lobby에서 microphone mute/unmute를 지원해야 한다.
- 시스템은 오디오 방 Lobby에서 microphone device 선택을 지원해야 한다.
- 시스템은 오디오 방 Lobby에서 아바타 선택 UI를 제공해야 한다.
- 시스템은 오디오 방 Lobby에서 비디오 장치 선택 UI를 표시하지 않아야 한다.
- 시스템은 오디오 방 Lobby에서 비디오 토글 UI를 표시하지 않아야 한다.

#### UI-03 Audio Room
- 시스템은 오디오 방 Room에서 participant를 avatar card 또는 동등한 비영상 카드로 렌더링해야 한다.
- 시스템은 각 participant에 대해 nickname, speaking state, mute state를 식별 가능하게 표시해야 한다.
- 시스템은 카메라 토글 버튼을 표시하지 않아야 한다.
- 시스템은 모바일 카메라 전환 UI를 표시하지 않아야 한다.
- 시스템은 비디오 object-fit 설정을 표시하지 않아야 한다.

#### UI-04 Settings
- 시스템은 오디오 방에서 Video Settings 섹션을 렌더링하지 않아야 한다.
- 시스템은 오디오 방에서 camera selector를 렌더링하지 않아야 한다.
- 시스템은 오디오 방에서 include-camera-in-screen-share 스위치를 렌더링하지 않아야 한다.
- 시스템은 오디오 방에서 audio 관련 설정만 표시해야 한다.

#### UI-05 Upgrade Consent
- 시스템은 화상 승격 요청 시 requester에게 pending 상태를 표시해야 한다.
- 시스템은 나머지 참여자에게 approve/reject UI를 표시해야 한다.
- 시스템은 승인 만료 시간 또는 응답 제한 시간을 표시해야 한다.
- 시스템은 성공/실패 사유를 사용자에게 피드백해야 한다.

### 7.2 미디어/브라우저 인터페이스
#### MB-01 Audio-only initialization
- 시스템은 오디오 방 Lobby/Room 진입 경로에서 navigator.mediaDevices.getUserMedia 호출 시 video constraint를 포함하지 않아야 한다.
- 시스템은 audio-only 초기화 실패 시 사용자에게 마이크 접근 실패 메시지를 표시해야 한다.

#### MB-02 Screen share
- 시스템은 오디오 방에서도 navigator.mediaDevices.getDisplayMedia 기반 화면공유를 허용해야 한다.
- 시스템은 오디오 방에서는 화면공유 합성 과정에 로컬 카메라 영상을 추가하지 않아야 한다.

### 7.3 네트워크 / signaling 인터페이스
#### SIG-01 Room join
- 시스템은 room join payload에 roomType 또는 capability를 전송해야 한다.
- 시스템은 remote participant가 avatar metadata를 받을 수 있어야 한다.

#### SIG-02 Upgrade proposal
- 시스템은 최소 아래 이벤트 또는 동등 정보 교환을 지원해야 한다.
  - video-upgrade-requested
  - video-upgrade-approved
  - video-upgrade-rejected
  - video-upgrade-expired
  - video-upgrade-committed
  - room-migration-issued

#### SIG-03 Room migration
- 시스템은 승격 성공 시 새 room title, 새 room type, migration source 정보, 대상 participant 목록을 전달해야 한다.

### 7.4 외부 아바타 서비스 인터페이스
#### AV-01 DiceBear
- 시스템은 DiceBear HTTP API로 생성된 약 50개 아바타 URL 세트를 준비해야 한다.
- 시스템은 네트워크 문제 시 fallback avatar URL 또는 local seed set을 사용해야 한다.

## 8. 데이터 요구사항

### DR-01 RoomType
시스템은 최소 다음 논리 타입을 구분해야 한다.
- video-one-to-one
- video-group
- audio-one-to-one
- audio-group

동등한 capability 모델을 채택하는 경우에도 아래 값은 파생 가능해야 한다.
- maxParticipants
- cameraEnabled
- avatarRequired
- screenShareEnabled
- cameraOverlayInScreenShareEnabled

정원 정책:
- audio-one-to-one = 2
- audio-group = 8
- video-one-to-one = 2
- video-group = 4

운영 안내 정책:
- mobile client의 audio-group은 최대 8명까지 허용하되, 보다 안정적인 통화를 위해 6명 이하를 권장해야 한다.

### DR-02 Avatar data
시스템은 각 사용자 세션에 대해 아래 중 최소 집합을 저장해야 한다.
- avatarId
- avatarSeed
- avatarStyle
- avatarUrl

### DR-03 Upgrade request data
시스템은 승격 요청에 대해 아래 필드를 추적해야 한다.
- requestId
- roomId
- requesterId
- requesterNickname
- requestedAt
- expiresAt
- approvals[]
- rejections[]
- pendingUserIds[]
- status(pending|approved|rejected|expired|committed)

### DR-04 Migration data
시스템은 승격 성공 시 아래 정보를 생성 또는 전달해야 한다.
- sourceRoomId
- sourceRoomTitle
- targetRoomTitle
- targetRoomType
- targetParticipantIds
- migrationIssuedAt

### DR-05 Client persistence
시스템은 최소 다음 값을 클라이언트 저장소에 유지해야 한다.
- nickname
- avatar selection
- 마지막 선택 roomType(선택 사항)

## 9. 기능 요구사항

### FR-01 Landing room type selection
시스템은 사용자가 오디오 방/화상 방 타입을 선택할 수 있게 해야 한다.
검증 가능 조건:
- 선택 즉시 store 상태가 갱신된다.
- 선택 즉시 URL query가 갱신된다.
- 새로고침 시 동일 query로 같은 타입이 복원된다.

### FR-02 Audio Lobby initialization
시스템은 오디오 방 Lobby 진입 시 audio-only 미디어 초기화를 수행해야 한다.
검증 가능 조건:
- camera track가 생성되지 않는다.
- local preview video 컴포넌트가 렌더링되지 않는다.
- microphone 장치 목록은 로드된다.

### FR-03 Audio test controls
시스템은 오디오 방 Lobby에서 microphone mute/unmute를 지원해야 한다.
시스템은 microphone 테스트 피드백을 제공해야 한다.
검증 가능 조건:
- mute 상태가 UI에 반영된다.
- 음성 입력 상태 또는 레벨이 시각적으로 표시된다.

### FR-04 Avatar selection
시스템은 오디오 방 Lobby에서 사용자가 50개 내외 아바타 중 하나를 선택할 수 있게 해야 한다.
검증 가능 조건:
- 선택 즉시 preview 상태가 바뀐다.
- 입장 후 Room에 동일 아바타가 표시된다.
- 새로고침/재입장 시 저장된 선택값이 복원된다.

### FR-05 Avatar propagation
시스템은 사용자의 avatar metadata를 원격 참여자에게 전달해야 한다.
검증 가능 조건:
- 서로 다른 두 브라우저에서 같은 사용자의 아바타가 일치한다.

### FR-06 Audio Room participant rendering
시스템은 오디오 방에서 participant를 아바타 카드로 렌더링해야 한다.
검증 가능 조건:
- 영상 대신 아바타가 기본 표현 수단이다.
- speaking state가 강조된다.
- mute 상태가 표시된다.
- 닉네임이 표시된다.

### FR-07 Camera UI suppression
시스템은 오디오 방에서 아래 UI를 렌더링하지 않아야 한다.
- camera preview
- camera toggle
- camera switch
- camera selector
- video settings
- camera object-fit settings
- include-camera-in-screen-share switch
검증 가능 조건:
- DOM 상 존재하지 않음 또는 사용자 접근 불가 hidden 상태

### FR-08 Screen share continuity
시스템은 오디오 방에서도 화면공유를 지원해야 한다.
검증 가능 조건:
- screen share start/stop 가능
- remote peer가 공유 화면을 볼 수 있음
- 카메라 overlay가 포함되지 않음

### FR-09 Audio room navigation behavior
시스템은 오디오 방에서는 카메라 관련 라벨/툴팁/shortcut 문구를 노출하지 않아야 한다.
검증 가능 조건:
- ControlBar tooltip/title 검사 시 video 문구 없음
- Mobile drawer 옵션에 camera 항목 없음

### FR-10 Upgrade request initiation
시스템은 오디오 방 참여자가 화상 전환 요청을 시작할 수 있게 해야 한다.
검증 가능 조건:
- 요청 생성 시 모든 활성 peer에 proposal이 전달된다.
- requester UI가 pending 상태로 전환된다.

### FR-11 Upgrade unanimous approval
시스템은 활성 참여자 전원 동의가 모여야만 승격을 승인해야 한다.
검증 가능 조건:
- 1명이라도 reject하면 실패
- 1명이라도 timeout이면 실패
- 전원 approve 시에만 commit

### FR-12 Upgrade rejection/timeout handling
시스템은 거절/만료 시 request를 종료 상태로 전환해야 한다.
검증 가능 조건:
- 참여자들에게 실패 상태가 전달된다.
- 기존 오디오 방 통화는 유지된다.

### FR-13 Room title inheritance
시스템은 승격 성공 시 source room title을 우선 target room title로 사용해야 한다.
검증 가능 조건:
- 중복이 없으면 동일 이름 사용
- 중복이 있으면 '원래이름 #1', '#2' 순으로 충돌 해소

### FR-14 Room migration
시스템은 승격 성공 시 현재 참여자들을 새 화상 방으로 이동시켜야 한다.
검증 가능 조건:
- 같은 멤버만 이동
- room type은 화상 타입으로 변경
- 이동 후 camera-enabled UI가 다시 노출 가능

### FR-15 Existing non-camera features continuity
시스템은 오디오 방에서도 채팅, 화이트보드, CoWatch, 파일 스트리밍, 릴레이 등 비카메라 기능을 유지해야 한다.
검증 가능 조건:
- 기존 기능 패널이 오디오 방에서도 동작
- 카메라 정책과 충돌 없음

## 10. 상태 전이 요구

### ST-01 Lobby media state
오디오 방 Lobby 초기화 상태 전이는 다음을 만족해야 한다.
- idle -> initializing-audio -> ready
- initializing-audio -> failed
- ready -> joining-room

### ST-02 Upgrade request state
승격 요청 상태 전이는 다음을 만족해야 한다.
- idle -> pending
- pending -> approved
- pending -> rejected
- pending -> expired
- approved -> committed
- rejected/expired -> idle

### ST-03 Room migration state
승격 커밋 후 상태 전이는 다음을 만족해야 한다.
- audio-room-active -> migration-issued -> target-video-room-joining -> target-video-room-active

## 11. 정책 요구사항

### PR-01 카메라 금지 정책
오디오 방에서는 사용자 의도와 무관하게 로컬 카메라를 시작할 수 없어야 한다.
예외는 "화상 방으로의 승격 완료 후"뿐이다.

### PR-02 UI 비노출 정책
오디오 방의 카메라 관련 기능은 disabled로 회색 표시하지 않고 hidden 처리해야 한다.

### PR-03 승격 합의 정책
전원 동의 없는 승격은 허용되지 않는다.

### PR-04 방 이름 계승 정책
승격 후 새 방은 source room title 계보를 유지해야 한다.

## 12. 품질 속성 요구사항

### QA-01 일관성
같은 roomType에서는 Landing, Lobby, Room, Settings, Navigation 전반에서 capability 정책이 일관되게 적용되어야 한다.

### QA-02 복원력
아바타 선택 정보는 새로고침 또는 동일 브라우저 재입장 시 복원 가능해야 한다.

### QA-03 안전성
오디오 방에서 잘못된 camera initialization 또는 camera UI 노출이 발생하지 않아야 한다.

### QA-04 후방 호환성
기존 화상 방 동작은 오디오 방 도입 후에도 유지되어야 한다.

### QA-05 관찰 가능성
디버깅을 위해 roomType, capability, upgrade request 상태를 로그 또는 개발자 도구 수준에서 식별 가능해야 한다.

## 13. 오류 처리 요구사항

### ER-01 Mic permission denied
마이크 권한 거부 시 시스템은 오디오 Lobby에서 명확한 오류 메시지를 보여야 한다.
입장 차단 여부는 제품 정책에 따르되, 최소한 원인을 사용자에게 알려야 한다.

### ER-02 Avatar fetch failure
DiceBear URL 생성 또는 로드 실패 시 시스템은 fallback avatar를 표시해야 한다.

### ER-03 Upgrade request collision
동시에 두 개 이상의 승격 요청이 생성되면 시스템은 하나만 활성 request로 유지하거나 명시적으로 충돌을 해소해야 한다.

### ER-04 Room migration failure
승격 승인 후 target room 생성 또는 이동에 실패하면 시스템은 사용자에게 실패를 알리고 source audio room에 남아 있어야 한다.

## 14. 검증 시나리오

### VS-01 Landing type persistence
1. /home 접속
2. 오디오 1:1 선택
3. URL query 확인
4. 새로고침
기대 결과:
- 오디오 1:1 선택 상태 유지

### VS-02 Audio Lobby no-camera
1. 오디오 방으로 Lobby 진입
2. DOM 및 UI 관찰
기대 결과:
- 카메라 프리뷰 없음
- 카메라 버튼 없음
- 카메라 선택 없음
- 마이크 설정만 존재

### VS-03 No camera permission request
1. 브라우저 권한 초기화
2. 오디오 방 Lobby 진입
기대 결과:
- 앱이 카메라 permission prompt를 발생시키지 않음
- 마이크 권한만 필요 시 요청

### VS-04 Avatar selection persistence
1. Lobby에서 아바타 선택
2. Room 입장
3. 페이지 새로고침 후 재입장
기대 결과:
- 동일 아바타 유지

### VS-05 Audio room rendering
1. 오디오 방에 2인 이상 참여
2. 말하기/음소거 테스트
기대 결과:
- participant별 아바타 표시
- speaking state 시각화
- mute 상태 시각화

### VS-06 Screen share in audio room
1. 오디오 방에서 화면공유 시작
2. 원격 브라우저 확인
기대 결과:
- 화면공유 전송 성공
- 카메라 overlay 없음

### VS-07 Upgrade unanimous approval
1. 2명 이상 오디오 방 입장
2. A가 화상 전환 요청
3. 전원 approve
기대 결과:
- 새 화상 방 생성
- 모두 이동
- 기존 방 이름 계승

### VS-08 Upgrade rejection
1. 오디오 방에서 전환 요청
2. 1명 reject
기대 결과:
- 이동 없음
- 오디오 방 유지
- 실패 메시지 표시

### VS-09 Upgrade timeout
1. 오디오 방에서 전환 요청
2. 일부 참여자 무응답
기대 결과:
- timeout 후 취소
- 오디오 방 유지

### VS-10 Duplicate room title suffix
1. 같은 이름의 화상 target room이 이미 존재하는 조건에서 승격
기대 결과:
- 새 room title이 '#1' 또는 다음 suffix로 생성

## 15. 수용 기준 매핑
- AC-01 -> FR-01, VS-01
- AC-02 -> FR-02, FR-07, VS-02
- AC-03 -> FR-03, VS-02
- AC-04 -> MB-01, VS-03
- AC-05 -> FR-07, UI-03, UI-04
- AC-06 -> FR-08, MB-02, VS-06
- AC-07 -> FR-05, FR-06, VS-05
- AC-08 -> FR-04, VS-04
- AC-09 -> FR-10, FR-11, FR-12, VS-07~09
- AC-10 -> FR-13, VS-10

## 16. 구현 전 확인 필요 항목
1. 그룹 오디오의 최종 정원(기존 4인 유지 여부)
2. 승격 timeout 기준값
3. "활성 참여자" 판정 규칙
4. room title uniqueness를 서버/클라이언트 중 누가 확정하는지
5. DiceBear 스타일 고정 여부

## 17. 완료 정의
본 기능은 아래를 모두 만족할 때 완료로 본다.
- 오디오 방 진입 시 camera request가 발생하지 않는다.
- 오디오 방 전 구간에서 camera UI가 비노출이다.
- 아바타 선택/표시/전파가 정상 동작한다.
- 화면공유 등 비카메라 기능이 유지된다.
- 전원 동의 기반 화상 승격과 방 이름 계승이 검증된다.
- 기존 화상 방 회귀가 없다.
