# SDD: 오디오 전용 방(1:1 / 그룹) + 합의 기반 화상방 전환

작성일: 2026-04-13
기준 문서:
- docs/prd/2026-04-13-audio-only-room-prd.md
- docs/srs/2026-04-13-audio-only-room-srs.md

## 1. 목적
이 문서는 오디오 전용 방 기능을 현재 코드베이스에 어떻게 녹여 넣을지 설계한다.
핵심 목표는 세 가지다.
- capability 기반으로 오디오 방과 화상 방을 안전하게 분리한다.
- 현재 video-first 구조를 최소 파괴로 audio-first 구조까지 확장한다.
- 추후 구현 시 문자열 분기 난립, 권한 요청 회귀, UI 누락을 막는다.

## 2. 현재 구조 요약
현재 확인한 구조는 아래와 같다.

### 2.1 방 타입과 진입
- src/types/room.types.ts
  - RoomType = 'one-to-one' | 'video-group'
  - ROOM_CAPACITY와 connectionModes가 여기서 결정됨
- src/pages/Landing.tsx
  - URL query(type) <-> useLandingStore.roomType 동기화
- src/components/landing/SelectionMode.tsx
  - connectionModes를 순회해 방 타입 선택 UI 렌더링
- src/components/landing/RoomInfo.tsx
  - roomTitle + nickname + roomType을 기반으로 /lobby/:roomTitle?type=... 로 이동

### 2.2 Lobby
- src/pages/Lobby.tsx
  - roomType query를 읽고 initialize(roomTitle, nick, roomType) 호출
  - localStream, isVideoEnabled, toggleVideo, video device selector 등을 직접 사용
  - 모바일/데스크톱 모두 VideoPreview를 전제로 구성
- src/stores/useLobbyStore.ts
  - connectionDetails(roomTitle, nickname, roomType) 저장
  - initialize() 내부에서 useMediaDeviceStore.initialize() 호출

### 2.3 미디어 초기화
- src/services/deviceManager.ts
  - initialize()에서 먼저 getUserMedia({ audio: true, video: true }) 시도
  - createInitialStream()도 audio/video 동시 구조를 전제
- src/stores/useMediaDeviceStore.ts
  - localStream, selectedAudioDeviceId, selectedVideoDeviceId, isAudioEnabled, isVideoEnabled, isSharingScreen 관리
  - toggleVideo, changeVideoDevice, switchCamera, includeCameraInScreenShare, startScreenShare()가 전부 camera-aware

### 2.4 Room 및 참여자 렌더링
- src/pages/Room.tsx
  - roomType query 기반으로 session 생성
  - localStream 없으면 initMedia() 호출
  - ContentLayout / ControlBar / SettingsPanel을 사용
- src/hooks/useParticipants.ts
  - local participant + remote peers를 합쳐 Participant[] 반환
  - participant는 stream, audioEnabled, videoEnabled 등 video-centric 필드를 가짐
- src/components/media/ContentLayout.tsx
  - main participant, gallery participant 모두 VideoPreview 사용
- src/components/media/VideoLayout.tsx
  - speaker/grid/viewer 모드 모두 비디오 타일 중심
- src/components/media/VideoPreview.tsx
  - video stream이 없거나 isVideoEnabled=false일 때 닉네임 첫 글자 fallback 표시

### 2.5 네비게이션 / 설정
- src/components/navigator/ControlBar.tsx
  - toggleAudio, toggleVideo, MobileCameraToggle, Settings 진입 등 카메라 UI 기본 포함
- src/components/media/MobileCameraToggle.tsx
  - 모바일 카메라 전환 UI
- src/components/setting/SettingsPanel.tsx
  - Audio Settings + Video Settings + Screen Share Settings(include camera)
- src/components/setting/DeviceSelector.tsx
  - microphone + camera selector 모두 렌더링

### 2.6 peer 메타데이터 확장 지점
- src/stores/usePeerConnectionStore.ts
  - device-metadata 류 message 처리 경로가 이미 존재
  - sendToAllPeers / sendToPeer 사용 가능
- src/stores/useDeviceMetadataStore.ts
  - 현재는 object-fit/device type 전파 용도
  - avatar 등 room presentation metadata를 넣기엔 의미가 과도하게 device 쪽으로 편향됨

결론:
현재 구조는 “카메라가 있는 통화”를 기본값으로 삼고 있다. 따라서 이번 작업은 UI patch 수준이 아니라 room capability 중심으로 미디어/화면/메타데이터 흐름을 재배치해야 한다.

## 3. 설계 원칙
1. roomType 문자열 if-else를 페이지 곳곳에 직접 박지 않는다.
2. capability 계산 유틸을 단일 진실 원천으로 둔다.
3. 오디오 방은 video-disabled가 아니라 camera-forbidden 상태다.
4. camera 관련 UI는 disabled가 아니라 렌더 자체를 막는다.
5. audio-only 미디어 초기화는 deviceManager 레벨에서 분기한다.
6. avatar는 device metadata와 분리된 participant presentation metadata로 관리한다.
7. 화상 승격은 기존 room leave/join을 감싼 migration workflow로 구현한다.

## 4. 제안 아키텍처

### 4.1 RoomType 확장 + capability 유틸 도입
신규 핵심 파일 권장:
- src/types/roomCapabilities.ts

책임:
- RoomType 정의/확장 보조
- roomType -> capability 파생
- roomType -> maxParticipants 파생
- roomType -> display label 파생
- audio room / video room 판별 유틸 제공
- audio room -> target video room 매핑 유틸 제공

권장 API 예시:
- isAudioRoom(type: RoomType): boolean
- isVideoRoom(type: RoomType): boolean
- isOneToOneRoom(type: RoomType): boolean
- getRoomCapabilities(type: RoomType): RoomCapabilities
- getRoomCapacity(type: RoomType): number
- getUpgradeTargetRoomType(type: RoomType): RoomType
- shouldShowCameraUi(type: RoomType): boolean

권장 타입 예시:
- type RoomType = 'audio-one-to-one' | 'audio-group' | 'video-one-to-one' | 'video-group'
- interface RoomCapabilities {
    audio: true;
    camera: boolean;
    avatarRequired: boolean;
    screenShare: boolean;
    cameraOverlayInScreenShare: boolean;
    micTestInLobby: boolean;
    cameraTestInLobby: boolean;
  }

이 유틸을 모든 페이지/스토어/컴포넌트가 공통 사용하게 한다.

### 4.2 미디어 초기화 전략 분리
현재 문제:
- deviceManager.initialize()가 무조건 audio+video 권한 요청

해결 전략:
- initialize()에 정책 인자를 넣어 media profile을 명시한다.

권장 타입 예시:
- type MediaInitProfile = 'audio-only' | 'audio-video'

변경 방향:
- DeviceManager.initialize(profile)
- DeviceManager.createInitialStream(profile)
- useMediaDeviceStore.initialize(profile)
- useLobbyStore.initialize(..., roomType) -> capability 계산 후 initialize(profile) 호출
- Room.tsx 의 initMedia()도 roomType 기반 profile 사용

구체 규칙:
- audio room => profile='audio-only'
  - getUserMedia({ audio: true, video: false }) 또는 video constraint omit
  - selectedVideoDeviceId는 빈 값 유지 가능
  - isVideoEnabled 기본값은 false
- video room => profile='audio-video'
  - 기존 동작 유지

### 4.3 MediaDeviceStore의 capability-aware 구조화
현재 store는 비디오 기능이 언제나 존재한다고 가정한다.
이를 다음처럼 재구성한다.

신규 상태 권장:
- mediaProfile: 'audio-only' | 'audio-video'
- cameraAllowed: boolean
- roomType: RoomType | null

신규/변경 메서드 권장:
- initialize(options: { roomType: RoomType; profile: MediaInitProfile })
- toggleVideo(): cameraAllowed=false면 no-op
- changeVideoDevice(): cameraAllowed=false면 reject/no-op
- switchCamera(): cameraAllowed=false면 no-op
- setIncludeCameraInScreenShare(): cameraAllowed=false면 false 고정
- startScreenShare(): cameraOverlayInScreenShare capability 검사 후 overlay 분기

중요 설계:
- UI에서 숨기는 것만으로 끝내지 않고 store/action 자체도 cameraAllowed를 강제해야 한다.
- 이렇게 해야 UI 누락이나 향후 회귀가 나와도 오디오 방에서 카메라가 켜지지 않는다.

### 4.4 Lobby를 AudioLobby / VideoLobby view-model로 분리
현재 Lobby.tsx는 한 파일 안에서 비디오 프리뷰, 비디오 토글, 카메라 selector를 직접 품고 있다.
이 상태에서 조건문만 추가하면 쉽게 더러워진다.

권장 구조:
- src/pages/Lobby.tsx
  - roomType/capability 결정과 공통 wiring만 담당
- src/components/lobby/AudioLobbyPanel.tsx 신규
- src/components/lobby/VideoLobbyPanel.tsx 신규
- src/components/lobby/AvatarPicker.tsx 신규
- src/components/lobby/MicTestPanel.tsx 신규

공통 정보:
- room title
- nickname editing
- join button

AudioLobbyPanel 책임:
- 마이크 토글
- 마이크 장치 선택
- 입력 레벨 시각화
- 아바타 선택
- 카메라 프리뷰 없음

VideoLobbyPanel 책임:
- 현재 Lobby UI 대부분 재사용

이 분리를 통해 FR-02/03/04/07을 UI 계층에서 명확하게 보장한다.

### 4.5 Avatar metadata 전용 store 도입
현재 useDeviceMetadataStore는 object-fit/device info 용도다.
avatar를 여기에 억지로 넣으면 관심사가 섞인다.

신규 파일 권장:
- src/stores/useParticipantProfileStore.ts
- src/lib/avatar/dicebear.ts
- src/data/avatar-presets.ts 또는 src/lib/avatar/avatarPresets.ts

책임:
- 로컬 사용자 avatar selection 저장
- remote participant avatar metadata 저장
- DiceBear preset generation
- localStorage/sessionStorage 복원
- peer/datachannel/signaling payload 전파 보조

권장 타입:
- interface AvatarPreset {
    id: string;
    style: string;
    seed: string;
    url: string;
  }
- interface ParticipantProfile {
    userId: string;
    nickname?: string;
    avatarId: string;
    avatarStyle: string;
    avatarSeed: string;
    avatarUrl: string;
  }

권장 API:
- getPresetAvatars(): AvatarPreset[]
- setLocalAvatar(preset)
- getLocalAvatar()
- updateRemoteProfile(userId, profile)
- getRemoteProfile(userId)
- broadcastLocalProfile()
- cleanupRemoteProfiles()

### 4.6 Avatar 전파 경로
후보는 두 가지다.
1. signaling join-room payload에 avatar를 포함
2. peer connection 후 datachannel로 profile metadata 전송

권장 방향:
- join-room payload에는 최소한 nickname + roomType만 유지
- peer connect 이후 datachannel로 participant-profile message 전송
- 필요 시 signaling에도 보조적으로 포함

이유:
- 현재 구조상 datachannel로 device-metadata 전파가 이미 존재해 확장 패턴이 자연스럽다.
- avatar는 peer별 표현 메타데이터라 실시간 동기화와도 잘 맞는다.

권장 message 예시:
- { type: 'participant-profile', payload: { avatarId, avatarStyle, avatarSeed, avatarUrl } }
- { type: 'video-upgrade-requested', payload: ... }

usePeerConnectionStore 확장 포인트:
- onConnect 이후 useParticipantProfileStore.getState().broadcastLocalProfile()
- onData parsing에 participant-profile 처리 추가

### 4.7 참여자 모델 확장
현재 Participant는 PeerState + isLocal + stream 중심이다.
오디오 방에서는 stream보다 profile이 먼저다.

권장 변경:
- src/hooks/useParticipants.ts
  - Participant에 avatar/profile 필드 추가
  - capability 또는 roomType도 같이 주입 가능

예시:
- interface Participant extends PeerState {
    isLocal: boolean;
    stream: MediaStream | null;
    avatarUrl?: string;
    avatarSeed?: string;
    avatarStyle?: string;
    presentationMode?: 'video' | 'avatar';
  }

로컬 participant는 useParticipantProfileStore.localAvatar 기준으로, remote participant는 remote profile 기준으로 채운다.

### 4.8 Audio Room 전용 렌더 경로 도입
현재 ContentLayout / VideoLayout / VideoPreview는 video-first다.
조건문 누더기를 피하려면 오디오 룸 전용 렌더 계층을 추가해야 한다.

권장 신규 컴포넌트:
- src/components/media/AudioParticipantCard.tsx
- src/components/media/AudioRoomLayout.tsx

AudioParticipantCard 책임:
- DiceBear avatar 표시
- nickname 표시
- speaking ring/active border
- mute indicator
- screen share badge
- local/remote 표시

AudioRoomLayout 책임:
- 1:1 / 그룹에 맞는 avatar grid
- 화면공유가 있으면 main content + avatar strip 조합
- participant focus/active speaker 강조

Room.tsx / ContentLayout.tsx 변경 방향:
- room capability를 읽어
  - audio room => AudioRoomLayout
  - video room => 기존 ContentLayout / VideoLayout

이렇게 하면 비디오 렌더 트리와 오디오 렌더 트리를 분리해 회귀를 줄일 수 있다.

### 4.9 ControlBar capability gating
현재 ControlBar는 toggleVideo, MobileCameraToggle을 기본 탑재한다.

권장 변경:
- ControlBar에서 roomType 또는 capability를 읽는다.
- shouldShowCameraUi=false이면 아래를 렌더하지 않는다.
  - 비디오 버튼
  - MobileCameraToggle
  - 관련 tooltip/title/video text
- More/Drawer 내에도 카메라 관련 항목이 없도록 한다.

추가 권장:
- 비디오 버튼이 있던 자리의 레이아웃 붕괴를 막기 위해 action slot 조합을 capability 기반 배열로 만들 것

예시:
- const primaryActions = buildControlActions(capabilities)

이 방식이 버튼 자리 삭제에 따른 UI 찌그러짐을 줄인다.

### 4.10 SettingsPanel / DeviceSelector 분리
현재 SettingsPanel은 Audio Settings + Video Settings + Screen Share Settings를 같이 갖는다.

권장 변경:
- DeviceSelector에 showVideoControls?: boolean 추가
- SettingsPanel에 capabilities 입력
- 오디오 방에서
  - Video Settings 섹션 미렌더
  - includeCameraInScreenShare 스위치 미렌더
  - selectedVideoDeviceId 참조 최소화

권장 신규 보조 컴포넌트:
- AudioSettingsSection
- VideoSettingsSection
- ScreenShareSettingsSection

하지만 작업량을 줄이려면 우선 SettingsPanel 내부 섹션만 capability 기반으로 나눠도 충분하다.

### 4.11 Landing 확장 방식
src/types/room.types.ts의 connectionModes 배열 확장으로 SelectionMode는 비교적 쉽게 확장 가능하다.
다만 제목/설명 체계는 다음처럼 재정렬하는 것이 좋다.
- Audio 1:1
- Audio Group
- Video 1:1
- Video Group

권장:
- 현재 아이콘 2개만 쓰지 말고 오디오/비디오를 더 명확히 구분
- 다만 첫 구현은 기존 카드 패턴 유지 후 문구만 확장해도 됨

### 4.12 화상 승격(Upgrade) 상태관리
이 기능은 기존 코드에 없다. 전용 store가 필요하다.

신규 파일 권장:
- src/stores/useRoomUpgradeStore.ts
- 필요 시 src/lib/room/roomMigration.ts

책임:
- 현재 활성 승격 요청 저장
- 요청 생성/응답/만료/커밋 상태 관리
- requester UI / approver UI 상태 제공
- room migration payload 저장

권장 상태:
- activeRequest: UpgradeRequest | null
- lastResolvedRequest: UpgradeRequest | null
- isMigrating: boolean

권장 API:
- requestVideoUpgrade(roomId, sourceRoomType, sourceRoomTitle, participants)
- approveVideoUpgrade(requestId)
- rejectVideoUpgrade(requestId)
- expireVideoUpgrade(requestId)
- commitVideoUpgrade(result)
- clearUpgradeState()

### 4.13 승격 이벤트 전달 방식
권장 전달 경로는 signaling 우선이다.
이유:
- 전원 동의/충돌 없는 단일 truth 관리가 필요
- datachannel만 쓰면 peer 연결 상태 편차에 취약
- room 생성/이름 suffix 결정은 결국 서버 쪽 authoritative 처리 필요

권장 signaling 이벤트:
- request-video-upgrade
- approve-video-upgrade
- reject-video-upgrade
- video-upgrade-state
- commit-video-upgrade
- issue-room-migration

프론트 동작:
1. requester -> signaling으로 request-video-upgrade
2. server가 대상 participant 집합 확정
3. 각 클라이언트는 video-upgrade-state 수신 후 UI 업데이트
4. unanimous approval 시 server가 target room title 결정
5. issue-room-migration 수신 시 각 클라이언트가 새 room route로 navigate

### 4.14 방 제목 계승 및 suffix 규칙
이름 중복 해결은 서버 authoritative가 맞다.
프론트는 규칙만 문서화하고, 실제 확정은 서버 응답을 따른다.

권장 규칙:
- 1순위: sourceRoomTitle
- 충돌 시: `${sourceRoomTitle} #1`
- 추가 충돌 시 증가

프론트에서 필요한 것:
- migration-issued payload에 targetRoomTitle 포함
- 프론트는 계산하지 말고 수신값을 신뢰

### 4.15 Room migration 절차
권장 순서:
1. upgrade committed 이벤트 수신
2. useRoomUpgradeStore.isMigrating=true
3. 현재 room 상태 보존
   - nickname
   - avatar
   - 필요 시 audio enabled 상태
4. current room cleanup는 너무 빨리 하지 말고, navigate 직전 또는 target room mount에서 안전하게 수행
5. navigate(`/room/${targetRoomTitle}?type=${targetRoomType}&migratedFrom=${sourceRoomId}`)
6. target room 입장 후 video profile로 재초기화

주의점:
- source room cleanup가 먼저 실행되면 migration 도중 오디오/마이크 상태가 튈 수 있다.
- session/avatar는 유지해야 하므로 clearSession 조건을 migration-aware로 수정할 필요가 있다.

## 5. 파일별 변경 계획

### 5.1 생성 권장 파일
- src/types/roomCapabilities.ts
- src/stores/useParticipantProfileStore.ts
- src/stores/useRoomUpgradeStore.ts
- src/components/lobby/AudioLobbyPanel.tsx
- src/components/lobby/VideoLobbyPanel.tsx
- src/components/lobby/AvatarPicker.tsx
- src/components/lobby/MicTestPanel.tsx
- src/components/media/AudioParticipantCard.tsx
- src/components/media/AudioRoomLayout.tsx
- src/lib/avatar/dicebear.ts
- src/lib/avatar/avatarPresets.ts

### 5.2 수정 대상 파일
- src/types/room.types.ts
- src/pages/Landing.tsx
- src/components/landing/SelectionMode.tsx
- src/components/landing/RoomInfo.tsx
- src/stores/useLandingStore.ts
- src/pages/Lobby.tsx
- src/stores/useLobbyStore.ts
- src/services/deviceManager.ts
- src/stores/useMediaDeviceStore.ts
- src/pages/Room.tsx
- src/hooks/useParticipants.ts
- src/components/media/ContentLayout.tsx
- src/components/media/VideoLayout.tsx
- src/components/media/VideoPreview.tsx
- src/components/navigator/ControlBar.tsx
- src/components/media/MobileCameraToggle.tsx
- src/components/setting/SettingsPanel.tsx
- src/components/setting/DeviceSelector.tsx
- src/stores/usePeerConnectionStore.ts
- src/stores/useSignalingStore.ts
- src/stores/useSessionStore.ts

## 6. 상세 설계: 핵심 모듈

### 6.1 room capability 모듈
목적:
- 모든 화면/스토어가 같은 규칙으로 행동하도록 한다.

핵심 책임:
- 라우트 query 파싱 후 유효 roomType 정규화
- Lobby/Room/ControlBar/Settings가 동일 capability 사용
- migration target roomType 변환 제공

왜 필요한가:
- 지금처럼 roomType === 'video-group' 같은 비교가 퍼지면 오디오 방 추가 시 곳곳이 깨진다.

### 6.2 participant profile 모듈
목적:
- avatar selection과 remote avatar rendering을 책임진다.

핵심 책임:
- preset avatar 공급
- local avatar 선택 저장
- remote avatar 캐시
- broadcast / receive 처리

왜 필요한가:
- device metadata store는 avatar 책임을 가지기 부적절하다.
- session store는 세션 식별자 중심이라 profile 표현 정보까지 넣으면 비대해진다.

### 6.3 room upgrade 모듈
목적:
- 요청 생성부터 커밋/실패까지 승격 상태머신을 관리한다.

핵심 책임:
- pending/approved/rejected/expired/committed 상태
- requester/approver UI 상태 파생
- room migration payload 보관

왜 필요한가:
- 이 로직을 Room.tsx나 ControlBar에 직접 넣으면 상태 전이가 흩어진다.

## 7. 데이터 흐름 설계

### 7.1 오디오 Lobby 진입
1. Landing에서 audio roomType 선택
2. /lobby/:roomTitle?type=audio-... 이동
3. Lobby.tsx가 roomType 파싱
4. getRoomCapabilities(roomType) 호출
5. useLobbyStore.initialize(..., roomType)
6. useMediaDeviceStore.initialize({ roomType, profile: 'audio-only' })
7. local avatar 로드
8. AudioLobbyPanel 렌더

### 7.2 오디오 Room 진입
1. Lobby join
2. useSessionStore.setSession(..., roomType)
3. Room.tsx에서 roomType 파싱
4. capability 계산
5. 필요 시 media profile 재검증
6. useParticipants()가 avatar profile 결합
7. AudioRoomLayout 렌더
8. usePeerConnectionStore onConnect 후 local profile broadcast

### 7.3 remote avatar 반영
1. peer connect
2. local client가 participant-profile 전송
3. remote client가 usePeerConnectionStore onData에서 participant-profile 수신
4. useParticipantProfileStore.updateRemoteProfile(peerId, profile)
5. useParticipants()가 remote participant에 avatarUrl 주입
6. AudioParticipantCard 리렌더

### 7.4 오디오 방 화면공유
1. user starts screen share
2. useMediaDeviceStore.startScreenShare()
3. capability.cameraOverlayInScreenShare 검사
4. audio room이면 screen only 합성
5. remote에 screen-share-state 전파
6. AudioRoomLayout은 main content를 화면공유로 전환하고 avatar strip 유지

### 7.5 화상 승격
1. requester clicks upgrade
2. useRoomUpgradeStore.requestVideoUpgrade()
3. signaling request 전송
4. server가 활성 participant 목록 확정
5. 각 peer가 approve/reject
6. unanimous approval 시 server가 target room title 결정
7. issue-room-migration broadcast
8. 각 client가 target route로 navigate
9. target room은 video capability로 재초기화
10. camera UI 재노출 허용

## 8. 단계별 구현 순서

### Phase 1: capability 기반 골조
- RoomType 확장
- roomCapabilities 유틸 추가
- Landing/Lobby/Room이 capability 사용하도록 정리

### Phase 2: audio-only media init
- deviceManager.initialize(profile) 도입
- useMediaDeviceStore capability-aware화
- Lobby/Room에서 audio-only 권한 요청 검증

### Phase 3: Lobby audio UX
- AudioLobbyPanel / AvatarPicker / MicTestPanel 도입
- 오디오 방의 카메라 프리뷰/selector 제거

### Phase 4: Room audio UX
- ParticipantProfileStore 도입
- AudioParticipantCard / AudioRoomLayout 도입
- ControlBar/Settings에서 camera UI 비노출

### Phase 5: signaling 확장
- participant-profile message 추가
- room upgrade signaling/store 추가
- migration route 처리

### Phase 6: polish + 회귀검증
- screen share camera overlay 금지 검증
- video room 회귀 확인
- mobile camera toggle 완전 비노출 확인

## 9. 테스트 설계

### 9.1 단위 테스트 후보
- roomCapabilities.ts
  - roomType -> capability 매핑
  - upgrade target mapping
  - suffix helper(클라이언트 보조가 있을 경우)
- avatar preset generator
  - preset 개수
  - url 생성 규칙

### 9.2 컴포넌트 테스트 후보
- AudioLobbyPanel
  - camera preview 없음
  - mic controls 있음
  - avatar picker 있음
- SettingsPanel
  - audio room에서 video section 미렌더
- ControlBar
  - audio room에서 video button 미렌더

### 9.3 통합 테스트 후보
- audio room join does not request camera
- avatar persistence across reload
- audio room screen share without camera overlay
- unanimous upgrade migration success
- rejection/timeout leaves source room intact

### 9.4 수동 E2E 체크리스트
1. Landing에서 audio/video 타입 모두 선택 가능
2. audio lobby 진입 시 camera prompt 없음
3. audio lobby에 avatar picker 존재
4. room 입장 후 avatar 기반 participant 표시
5. control/settings 어디에도 camera 항목 없음
6. screen share는 작동, camera overlay는 없음
7. 승격 요청/동의/거절/타임아웃 시나리오 검증
8. video room 기존 기능 회귀 없음

## 10. 리스크 및 대응

### 리스크 1: media init 회귀
원인:
- deviceManager 공통 경로 변경 영향
대응:
- profile 인자 추가 후 기본값을 기존 audio-video로 유지
- video room 회귀 테스트 우선 수행

### 리스크 2: UI 조건문 난립
원인:
- 각 컴포넌트가 roomType 직접 비교
대응:
- capability 유틸 강제
- buildControlActions / renderByCapability 패턴 사용

### 리스크 3: avatar와 device metadata 혼선
원인:
- 기존 metadata store 재사용 유혹
대응:
- participant profile store 별도 분리

### 리스크 4: migration 중 세션 손실
원인:
- cleanup/clearSession 타이밍 부정합
대응:
- migration-aware cleanup 플래그 도입
- navigate 후 target room mount에서 안전 정리

### 리스크 5: 서버 의존 기능 미완성
원인:
- room title suffix, unanimous approval authoritative 처리 필요
대응:
- 프론트는 store/state/UI만 먼저 설계
- 서버 계약 문서를 별도로 맞춘 뒤 구현

## 11. 최소 구현 스코프(MVP)
MVP에서 꼭 필요한 것:
1. roomType 4종
2. capability 유틸
3. audio-only media init
4. Lobby audio view + avatar picker
5. Room audio layout + avatar cards
6. ControlBar/Settings camera UI 비노출
7. participant-profile 전파
8. screen share overlay 금지

MVP에서 보류 가능:
- 승격 요청 히스토리
- 복수 avatar style 선택
- 고급 speaker animation polish

## 12. 완료 기준
구현이 아래를 만족하면 설계 의도 달성으로 본다.
- audio room 경로에서 camera getUserMedia 요청이 발생하지 않는다.
- audio room UI 어디에도 camera 관련 요소가 노출되지 않는다.
- avatar selection -> room rendering -> remote propagation이 일관되게 동작한다.
- screen share는 가능하지만 camera overlay는 불가능하다.
- capability 기반 구조 덕분에 video room 기존 동작이 유지된다.
- unanimous approval 기반 migration을 붙일 수 있는 store/signaling 확장 지점이 준비된다.

## 13. 권장 다음 작업
다음 구현 단계에서는 이 문서를 기반으로 다음 순서로 실제 작업을 진행하는 것이 가장 안전하다.
1. roomCapabilities + RoomType 확장
2. deviceManager / media store profile 분리
3. AudioLobbyPanel + AvatarPicker
4. AudioRoomLayout + participant profile store
5. ControlBar / Settings capability gating
6. signaling + room upgrade store
