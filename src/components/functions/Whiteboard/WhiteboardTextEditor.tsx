/**
 * @fileoverview 화이트보드 텍스트 편집기 (HTML Overlay)
 * @module components/functions/Whiteboard/WhiteboardTextEditor
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWhiteboard } from '@/contexts/WhiteboardContext';
import { useWhiteboardCollaboration } from '@/hooks/whiteboard/useWhiteboardCollaboration';
import type { TextOperation } from '@/types/whiteboard.types';

export const WhiteboardTextEditor: React.FC = () => {
  const { 
    editingTextId, 
    endTextEdit, 
    updateOperation, 
    operations,
    stageRef,
    viewport
  } = useWhiteboard();
  
  const { broadcastUpdate } = useWhiteboardCollaboration();
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [text, setText] = useState('');

  useEffect(() => {
    if (!editingTextId || !stageRef.current) return;

    const operation = operations.get(editingTextId) as TextOperation | undefined;
    if (!operation || operation.type !== 'text') return;

    // 스테이지 좌표를 화면 좌표로 변환
    const stage = stageRef.current;
    const stageBox = stage.container().getBoundingClientRect();

    const screenX = (operation.position.x - viewport.x) * viewport.scale + stageBox.left;
    const screenY = (operation.position.y - viewport.y) * viewport.scale + stageBox.top;

    setPosition({ x: screenX, y: screenY });
    setText(operation.text);

    // 포커스
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 0);
  }, [editingTextId, operations, stageRef, viewport]);

  const handleSave = () => {
    if (!editingTextId) return;

    const trimmedText = text.trim();
    
    if (trimmedText) {
      updateOperation(editingTextId, { text: trimmedText });
      broadcastUpdate(editingTextId, { text: trimmedText });
    } else {
      // 빈 텍스트면 삭제
      useWhiteboardStore.getState().removeOperation(editingTextId);
    }

    endTextEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      endTextEdit();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  };

  if (!editingTextId) return null;

  const operation = operations.get(editingTextId) as TextOperation | undefined;
  if (!operation || operation.type !== 'text') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        style={{
          fontSize: `${operation.options.fontSize! * viewport.scale}px`,
          fontFamily: operation.options.fontFamily,
          color: operation.options.strokeColor,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          border: '2px solid #3b82f6',
          borderRadius: '4px',
          padding: '8px',
          minWidth: `${(operation.width || 200) * viewport.scale}px`,
          minHeight: '40px',
          resize: 'both',
          outline: 'none',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}
        placeholder="Enter text... (Ctrl+Enter to save, Esc to cancel)"
      />
    </div>,
    document.body
  );
};
