export type AckFn = (peerId: string, transferId: string, chunkIndex: number) => void;

let ackSender: AckFn | null = null;

export const registerAckSender = (fn: AckFn): void => {
  ackSender = fn;
};

export const sendChunkAck = (peerId: string, transferId: string, chunkIndex: number): void => {
  if (ackSender) ackSender(peerId, transferId, chunkIndex);
};