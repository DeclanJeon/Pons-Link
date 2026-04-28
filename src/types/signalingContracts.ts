export type JoinErrorCode =
  | 'SESSION_TOKEN_REQUIRED'
  | 'SESSION_ROOM_MISMATCH'
  | 'SESSION_USER_REQUIRED'
  | 'SESSION_JOIN_DENIED';

export type TurnCredentialErrorCode =
  | 'AUTH_REQUIRED'
  | 'TURN_AUTH_REQUIRED'
  | 'NO_USER_ID'
  | 'ROOM_BINDING_REQUIRED'
  | 'TURN_ROOM_BINDING_REQUIRED'
  | 'ROOM_MISMATCH'
  | 'TURN_ROOM_MISMATCH'
  | 'RATE_LIMIT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'TURN_RATE_LIMIT_EXCEEDED'
  | 'TURN_IP_RATE_LIMIT_EXCEEDED'
  | 'QUOTA_EXCEEDED'
  | 'LIMIT_EXCEEDED'
  | 'CONNECTION_LIMIT_EXCEEDED';

export type JoinErrorPayload = {
  code?: JoinErrorCode | string;
  message?: string;
};

export type TurnCredentialsResponse = {
  iceServers?: RTCIceServer[];
  ttl?: number;
  timestamp?: number;
  error?: string;
  code?: TurnCredentialErrorCode | string;
  retryAfter?: number;
  quota?: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  stats?: {
    connectionCount: number;
    connectionLimit: number;
  };
};
