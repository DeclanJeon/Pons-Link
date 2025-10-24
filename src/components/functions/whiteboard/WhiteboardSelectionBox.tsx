/**
 * @fileoverview 선택 박스 렌더링 컴포넌트 (v3.0 - 개선)
 * @module components/functions/Whiteboard/WhiteboardSelectionBox
 */

import React, { useMemo } from 'react';
import { Rect } from 'react-konva';
import { useWhiteboardStore } from '@/stores/useWhiteboardStore';
import { getBoundingBox } from '@/lib/whiteboard/utils';

export const WhiteboardSelectionBox: React.FC = () => {
  const operations = useWhiteboardStore(state => state.operations);
  const selectedIds = useWhiteboardStore(state => state.selectedIds);

  const boundingBox = useMemo(() => {
    const selectedOps = Array.from(selectedIds)
      .map(id => operations.get(id))
      .filter(op => op !== undefined);

    if (selectedOps.length === 0) return null;

    return getBoundingBox(selectedOps);
  }, [operations, selectedIds]);

  if (!boundingBox) return null;

  return (
    <Rect
      x={boundingBox.x - 5}
      y={boundingBox.y - 5}
      width={boundingBox.width + 10}
      height={boundingBox.height + 10}
      stroke="#3b82f6"
      strokeWidth={2}
      dash={[5, 5]}
      listening={false}
    />
  );
};
