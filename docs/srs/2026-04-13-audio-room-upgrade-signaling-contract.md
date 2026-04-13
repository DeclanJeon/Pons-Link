# Signaling Contract: 오디오 방 -> 화상 방 승격 / 마이그레이션

작성일: 2026-04-13
관련 문서:
- docs/prd/2026-04-13-audio-only-room-prd.md
- docs/srs/2026-04-13-audio-only-room-srs.md
- docs/sdd/2026-04-13-audio-only-room-sdd.md

목적:
이 문서는 오디오 방에서 참여자 전원 동의 후 화상 방으로 이동하기 위해, signaling 서버와 프론트가 합의해야 하는 이벤트 계약을 정의한다.

현재 상태:
- 프론트는 요청/동의/거절/커밋 UI 및 store 골조를 이미 가짐
- 서버 authoritative 처리(전원 판정, target room 생성, room title suffix 확정, migration 발행)는 아직 필요함

## 1. 설계 원칙
1. 서버가 authoritative 하다.
   - 전원 동의 판정
   - 요청 만료 판정
   - target room title 확정
   - room migration issued 발행
2. 프론트는 서버가 보내는 최종 상태를 따른다.
3. source audio room은 migration 성공 전까지 유지된다.
4. room title suffix(#1, #2 ...)는 서버가 확정한다.

## 2. 용어
- source room: 현재 오디오 방
- target room: 새로 생성될 화상 방
- upgrade request: 화상 승격 요청
- active participant: 서버가 현재 source room에 활성 상태라고 판단한 참가자

## 3. 공통 데이터 구조

### 3.1 RoomUpgradeRequest
```ts
interface RoomUpgradeRequest {
  requestId: string;
  roomId: string;                // source room id
  roomTitle: string;             // source room title
  sourceRoomType: RoomType;      // audio-one-to-one | audio-group
  targetRoomType: RoomType;      // video-one-to-one | video-group
  requesterId: string;
  requesterNickname: string;
  participantIds: string[];      // authoritative active participant set
  approvals: string[];
  rejections: string[];
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'committed';
  createdAt: number;
  expiresAt: number;
  targetRoomTitle?: string;
}
```

### 3.2 RoomMigrationIssued
```ts
interface RoomMigrationIssued {
  requestId: string;
  sourceRoomId: string;
  sourceRoomTitle: string;
  sourceRoomType: RoomType;
  targetRoomId: string;
  targetRoomTitle: string;
  targetRoomType: RoomType;
  participantIds: string[];
  issuedAt: number;
}
```

## 4. 클라이언트 -> 서버 이벤트

### 4.1 video-upgrade-requested
설명:
오디오 방 참여자가 화상 승격을 요청한다.

transport:
- 기존 socket 'message' event의 payload.type = 'video-upgrade-requested'

payload:
```ts
{
  type: 'video-upgrade-requested',
  data: {
    requestId: string,
    roomId: string,
    roomTitle: string,
    sourceRoomType: 'audio-one-to-one' | 'audio-group',
    targetRoomType: 'video-one-to-one' | 'video-group',
    requesterId: string,
    requesterNickname: string,
    createdAt: number,
    expiresAt: number
  }
}
```

server rules:
- sourceRoomType가 audio-* 가 아니면 reject
- 같은 roomId에 이미 pending request가 있으면 reject
- active participant 집합을 authoritative하게 산정
- requester를 approvals에 포함한 pending request 생성
- participantIds는 서버가 다시 채워넣음

server response:
- room 전체에 video-upgrade-requested broadcast

### 4.2 video-upgrade-approved
설명:
참여자가 승격 요청에 동의한다.

payload:
```ts
{
  type: 'video-upgrade-approved',
  data: {
    requestId: string,
    userId: string
  }
}
```

server rules:
- 해당 request가 pending인지 확인
- userId가 participantIds 안에 있는지 확인
- 중복 approval 무시
- approvals 갱신 후 broadcast
- approvals가 participantIds 전체를 덮으면 committed 절차 시작

### 4.3 video-upgrade-rejected
설명:
참여자가 승격 요청을 거절한다.

payload:
```ts
{
  type: 'video-upgrade-rejected',
  data: {
    requestId: string,
    userId: string
  }
}
```

server rules:
- 해당 request가 pending인지 확인
- userId가 participantIds 안에 있는지 확인
- rejections 갱신
- 즉시 request status='rejected' 처리
- room 전체에 rejected broadcast

## 5. 서버 -> 클라이언트 이벤트

### 5.1 video-upgrade-requested
설명:
서버가 authoritative participant 집합으로 pending request를 생성했음을 알린다.

payload:
```ts
{
  type: 'video-upgrade-requested',
  from: string,
  data: RoomUpgradeRequest
}
```

client behavior:
- requester: pending UI 표시
- other participants: 동의/거절 다이얼로그 표시

### 5.2 video-upgrade-approved
설명:
특정 참여자의 동의가 반영되었음을 알린다.

payload:
```ts
{
  type: 'video-upgrade-approved',
  from: string,
  data: {
    requestId: string,
    userId: string
  }
}
```

client behavior:
- activeRequest.approvals 갱신
- requester는 남은 미응답 인원 수를 표시 가능

### 5.3 video-upgrade-rejected
설명:
누군가 거절해 승격이 종료되었음을 알린다.

payload:
```ts
{
  type: 'video-upgrade-rejected',
  from: string,
  data: {
    requestId: string,
    userId: string,
    status: 'rejected'
  }
}
```

client behavior:
- activeRequest.status='rejected'
- 다이얼로그 닫기
- 오디오 방 유지

### 5.4 video-upgrade-expired
설명:
응답 시간 초과로 승격 요청이 만료되었음을 알린다.

payload:
```ts
{
  type: 'video-upgrade-expired',
  from: 'server',
  data: {
    requestId: string,
    status: 'expired'
  }
}
```

client behavior:
- activeRequest.status='expired'
- 다이얼로그 닫기
- 오디오 방 유지

### 5.5 video-upgrade-committed
설명:
전원 동의가 완료되었고 target room 생성이 확정되었음을 알린다.

payload:
```ts
{
  type: 'video-upgrade-committed',
  from: 'server',
  data: RoomUpgradeRequest & {
    status: 'committed',
    targetRoomTitle: string
  }
}
```

client behavior:
- committed 상태 저장
- "화상 방으로 이동합니다" UI 표시
- 이어지는 room-migration-issued를 기다림

### 5.6 room-migration-issued
설명:
실제 이동 대상 room이 생성되었고 해당 참여자들이 이동해야 함을 알린다.

payload:
```ts
{
  type: 'room-migration-issued',
  from: 'server',
  data: RoomMigrationIssued
}
```

client behavior:
- participantIds에 현재 userId가 있으면 새 room route로 navigate
- 예시 route:
  /room/${encodeURIComponent(targetRoomTitle)}?type=${targetRoomType}&migratedFrom=${sourceRoomId}

## 6. 서버 상태 머신

### request lifecycle
1. idle
2. pending
3. rejected | expired | committed
4. migration-issued
5. cleanup

### authoritative rules
- pending 도중 source room active participant 집합이 바뀌면 정책 선택 필요
  - 권장: request 생성 시 participantIds 고정
- requester가 중도 이탈하면 request 즉시 expired 또는 rejected 처리
- 거절 1회면 즉시 종료
- expiresAt 도달 시 expired 처리

## 7. room title 계승 / suffix 규칙

### 목표
source room title을 최대한 유지하되, 기존 화상방 이름과 충돌하면 suffix를 붙인다.

### 규칙
1. 1차 후보: sourceRoomTitle
2. 이미 사용 중이면: `${sourceRoomTitle} #1`
3. 또 충돌이면 #2, #3 ...
4. 최종 확정 title은 server가 targetRoomTitle로 반환

### 예시
- source title = "Daily Sync"
- existing target titles = ["Daily Sync", "Daily Sync #1"]
- new target title = "Daily Sync #2"

## 8. 최소 서버 구현 체크리스트
- [ ] roomId별 pending upgrade request 저장
- [ ] requestId 생성/검증
- [ ] room 참가자 authoritative 조회
- [ ] approve/reject 집계
- [ ] timeout 처리 scheduler
- [ ] target room 생성
- [ ] targetRoomTitle suffix 충돌 해결
- [ ] room-migration-issued broadcast
- [ ] source request cleanup

## 9. 프론트 현재 구현 상태와 서버 필요 항목

프론트 이미 있음:
- requestUpgrade store/UI
- approve/reject UI
- activeRequest 반영
- participant-profile / audio room UI

서버 필요:
- message relay for video-upgrade-*
- pending request authoritative store
- unanimous approval 판정
- target room 생성
- targetRoomTitle suffix 확정
- room-migration-issued 발행

## 10. 권장 다음 작업
1. signaling 서버 코드에 위 이벤트 추가
2. request timeout 및 participant authoritative 집합 처리
3. room-migration-issued 이후 프론트 navigate 처리 보강
4. localhost 2브라우저 E2E로 요청/동의/거절/만료 테스트
