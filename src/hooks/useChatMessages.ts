/**
 * 채팅 메시지 관리 훅 (개선 버전)
 * @module useChatMessages
 */

import { useMemo, useCallback, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { useChatStore, ChatMessage } from '@/stores/useChatStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { filterMessages, groupMessagesBySender, extractUrls, fetchLinkPreview } from '@/utils/chat.utils';
import { toast } from 'sonner';

export const useChatMessages = (searchQuery: string) => {
  const { chatMessages, addMessage, updateMessage } = useChatStore();
  const sendToAllPeers = usePeerConnectionStore(state => state.sendToAllPeers);
  const sendFile = usePeerConnectionStore(state => state.sendFile);
  const { userId: storeUserId, nickname: storeNickname, getSessionInfo } = useSessionStore();

  const sessionInfo = getSessionInfo();
  const userId = sessionInfo?.userId || storeUserId || 'unknown-user';
  const nickname = sessionInfo?.nickname || storeNickname || 'Unknown';

  /**
   * 텍스트 메시지 전송 (낙관적 UI 업데이트)
   */
  const sendMessage = useCallback((text: string, timestamp?: number) => {
    if (!sessionInfo) {
      console.warn('[useChatMessages] No session info available');
      toast.error('세션 정보를 찾을 수 없습니다.');
      return;
    }

    const messageTimestamp = timestamp || Date.now();
    const messageId = nanoid();

    // URL 추출
    const urls = extractUrls(text);

    const message: ChatMessage = {
      id: messageId,
      type: 'text',
      text,
      senderId: userId,
      senderNickname: nickname,
      timestamp: messageTimestamp,
      status: 'sending', // 전송 중 상태
      linkPreviews: urls.length > 0 ? [] : undefined // 링크가 있으면 미리보기 준비
    };

    // 낙관적 UI 업데이트
    addMessage(message);

    // 피어에게 전송
    const messageData = JSON.stringify({
      ...message,
      status: 'sent' // 전송 시 상태 변경
    });

    const result = sendToAllPeers(messageData);

    if (result.successful.length > 0) {
      // 전송 성공 - 상태 업데이트
      setTimeout(() => {
        updateMessage(messageId, { status: 'sent' });
      }, 100);

      console.log('[useChatMessages] Message sent successfully:', {
        id: messageId,
        text: message.text,
        timestamp: messageTimestamp,
        recipients: result.successful.length
      });
    } else if (result.failed.length > 0) {
      // 전송 실패 - 상태 업데이트
      updateMessage(messageId, { status: 'failed' });
      toast.error('메시지 전송에 실패했습니다.');

      console.error('[useChatMessages] Message send failed:', {
        id: messageId,
        failed: result.failed
      });
    }

    // 링크 미리보기 가져오기 (비동기)
    if (urls.length > 0) {
      Promise.all(urls.map(url => fetchLinkPreview(url)))
        .then(previews => {
          const validPreviews = previews.filter(p => p !== null);
          if (validPreviews.length > 0) {
            updateMessage(messageId, { linkPreviews: validPreviews });
          }
        })
        .catch(error => {
          console.error('[useChatMessages] Failed to fetch link previews:', error);
        });
    }
  }, [sessionInfo, userId, nickname, addMessage, updateMessage, sendToAllPeers]);

  /**
   * 파일 전송 (다중 파일 지원)
   */
  const sendFileMessage = useCallback((files: File[] | FileList) => {
    const fileArray = Array.isArray(files) ? files : Array.from(files);

    if (fileArray.length === 1) {
      // 단일 파일인 경우 기존 방식으로 전송
      sendFile(fileArray[0]);
    } else {
      // 다중 파일인 경우 각 파일을 개별적으로 전송
      fileArray.forEach((file, index) => {
        // 약간의 지연을 주어 동시 전송으로 인한 부하 방지
        setTimeout(() => {
          sendFile(file);
        }, index * 100); // 100ms 간격으로 전송
      });

      toast.success(`Sending ${fileArray.length} files.`);
    }
  }, [sendFile]);
  
  /**
   * GIF 메시지 전송
   */
  const sendGifMessage = useCallback((gifUrl: string) => {
    if (!sessionInfo) {
      console.warn('[useChatMessages] No session info available');
      return;
    }

    const message: ChatMessage = {
      id: nanoid(),
      type: 'gif',
      text: '',
      fileMeta: {
        transferId: nanoid(),
        name: 'gif',
        size: 0,
        type: 'image/gif',
        url: gifUrl,
        totalChunks: 0,
        chunkSize: 0
      },
      senderId: userId,
      senderNickname: nickname,
      timestamp: Date.now(),
      status: 'sent'
    };

    addMessage(message);
    const messageData = JSON.stringify(message);
    sendToAllPeers(messageData);
  }, [sessionInfo, userId, nickname, addMessage, sendToAllPeers]);

  /**
   * 메시지 삭제
   */
  const deleteMessage = useCallback((messageId: string) => {
    const message = chatMessages.find(m => m.id === messageId);
    if (!message || message.senderId !== userId) {
      toast.error('메시지를 삭제할 수 없습니다.');
      return;
    }

    useChatStore.getState().deleteMessage(messageId);

    // 피어에게 삭제 알림
    sendToAllPeers(JSON.stringify({
      type: 'message-delete',
      payload: { messageId }
    }));

    toast.success('메시지가 삭제되었습니다.');
  }, [chatMessages, userId, sendToAllPeers]);

  /**
   * 메시지 수정
   */
  const editMessage = useCallback((messageId: string, newText: string) => {
    const message = chatMessages.find(m => m.id === messageId);
    if (!message || message.senderId !== userId) {
      toast.error('메시지를 수정할 수 없습니다.');
      return;
    }

    updateMessage(messageId, {
      text: newText,
      isEdited: true,
      editedAt: Date.now()
    });

    // 피어에게 수정 알림
    sendToAllPeers(JSON.stringify({
      type: 'message-edit',
      payload: { messageId, text: newText, editedAt: Date.now() }
    }));

    toast.success('메시지가 수정되었습니다.');
  }, [chatMessages, userId, updateMessage, sendToAllPeers]);

  /**
   * 메시지 반응 추가
   */
  const addReaction = useCallback((messageId: string, emoji: string) => {
    const message = chatMessages.find(m => m.id === messageId);
    if (!message) return;

    const reactions = message.reactions || [];
    const existingReaction = reactions.find(r => r.emoji === emoji);

    let newReactions;
    if (existingReaction) {
      if (existingReaction.userIds.includes(userId)) {
        // 이미 반응했으면 제거
        newReactions = reactions.map(r =>
          r.emoji === emoji
            ? { ...r, userIds: r.userIds.filter(id => id !== userId), count: r.count - 1 }
            : r
        ).filter(r => r.count > 0);
      } else {
        // 반응 추가
        newReactions = reactions.map(r =>
          r.emoji === emoji
            ? { ...r, userIds: [...r.userIds, userId], count: r.count + 1 }
            : r
        );
      }
    } else {
      // 새 반응 생성
      newReactions = [...reactions, { emoji, userIds: [userId], count: 1 }];
    }

    updateMessage(messageId, { reactions: newReactions });

    // 피어에게 반응 알림
    sendToAllPeers(JSON.stringify({
      type: 'message-reaction',
      payload: { messageId, emoji, userId }
    }));
  }, [chatMessages, userId, updateMessage, sendToAllPeers]);

  /**
   * 답장 메시지 전송
   */
  const replyToMessage = useCallback((parentMessageId: string, text: string, timestamp?: number) => {
    if (!sessionInfo || !text.trim()) {
      console.warn('[useChatMessages] No session info available or empty text');
      toast.error('메시지를 입력해주세요.');
      return;
    }

    const messageTimestamp = timestamp || Date.now();
    const messageId = nanoid();

    // 부모 메시지 찾기
    const parentMessage = chatMessages.find(m => m.id === parentMessageId);
    if (!parentMessage) {
      console.error('[useChatMessages] Parent message not found:', parentMessageId);
      toast.error('답장할 메시지를 찾을 수 없습니다.');
      return;
    }

    // URL 추출
    const urls = extractUrls(text);

    const replyMessage: ChatMessage = {
      id: messageId,
      type: 'text',
      text,
      senderId: userId,
      senderNickname: nickname,
      timestamp: messageTimestamp,
      status: 'sending',
      parentId: parentMessageId,
      replyTo: parentMessage,
      linkPreviews: urls.length > 0 ? [] : undefined
    };

    // 낙관적 UI 업데이트
    addMessage(replyMessage);

    // 부모 메시지에 답장 ID 추가
    const updatedReplies = [...(parentMessage.replies || []), messageId];
    updateMessage(parentMessageId, { replies: updatedReplies });

    // 피어에게 전송
    const messageData = JSON.stringify({
      ...replyMessage,
      status: 'sent'
    });

    const result = sendToAllPeers(messageData);

    if (result.successful.length > 0) {
      setTimeout(() => {
        updateMessage(messageId, { status: 'sent' });
      }, 100);

      console.log('[useChatMessages] Reply message sent successfully:', {
        id: messageId,
        parentId: parentMessageId,
        text: replyMessage.text,
        timestamp: messageTimestamp,
        recipients: result.successful.length
      });
    } else if (result.failed.length > 0) {
      updateMessage(messageId, { status: 'failed' });
      toast.error('답장 메시지 전송에 실패했습니다.');

      console.error('[useChatMessages] Reply message send failed:', {
        id: messageId,
        failed: result.failed
      });
    }

    // 링크 미리보기 가져오기 (비동기)
    if (urls.length > 0) {
      Promise.all(urls.map(url => fetchLinkPreview(url)))
        .then(previews => {
          const validPreviews = previews.filter(p => p !== null);
          if (validPreviews.length > 0) {
            updateMessage(messageId, { linkPreviews: validPreviews });
          }
        })
        .catch(error => {
          console.error('[useChatMessages] Failed to fetch link previews for reply:', error);
        });
    }
  }, [sessionInfo, userId, nickname, chatMessages, addMessage, updateMessage, sendToAllPeers]);

  /**
   * 특정 메시지의 답장들 가져오기
   */
  const getReplies = useCallback((messageId: string): ChatMessage[] => {
    return chatMessages.filter(message => message.parentId === messageId);
  }, [chatMessages]);

  /**
   * 필터링된 메시지
   */
  const filteredMessages = useMemo(() => 
    filterMessages(chatMessages, searchQuery),
    [chatMessages, searchQuery]
  );

  /**
   * 그룹화된 메시지
   * 타임스탬프 기준으로 정렬 후 그룹화
   */
  const groupedMessages = useMemo(() => {
    // 타임스탬프 기준 오름차순 정렬
    const sortedMessages = [...filteredMessages].sort((a, b) => 
      a.timestamp - b.timestamp
    );
    
    return groupMessagesBySender(sortedMessages);
  }, [filteredMessages]);

  return {
    messages: chatMessages,
    filteredMessages,
    groupedMessages,
    sendMessage,
    sendFileMessage,
    sendGifMessage,
    deleteMessage,
    editMessage,
    addReaction,
    replyToMessage,
    getReplies,
    userId,
    nickname
  };
};
