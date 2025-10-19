/**
 * @fileoverview 원격 커서 렌더링 컴포넌트 (v3.0)
 * @module components/functions/Whiteboard/WhiteboardRemoteCursor
 */

import React from 'react';
import { Circle, Text, Group, Arrow } from 'react-konva';
import type { RemoteCursor } from '@/types/whiteboard.types';
import { getUserColor } from '@/lib/whiteboard/utils';

interface WhiteboardRemoteCursorProps {
  cursor: RemoteCursor;
}

export const WhiteboardRemoteCursor: React.FC<WhiteboardRemoteCursorProps> = ({ cursor }) => {
  const color = getUserColor(cursor.userId);

  return (
    <Group x={cursor.position.x} y={cursor.position.y}>
      {/* 커서 화살표 */}
      <Arrow
        points={[0, 0, 10, 15]}
        fill={color}
        stroke={color}
        strokeWidth={1}
        pointerLength={3}
        pointerWidth={3}
      />

      {/* 사용자 이름 배경 */}
      <Circle
        x={15}
        y={0}
        radius={20}
        fill={color}
        opacity={0.8}
      />

      {/* 사용자 이름 */}
      <Text
        x={5}
        y={-5}
        text={cursor.nickname}
        fontSize={10}
        fill="#ffffff"
        fontStyle="bold"
        shadowColor="rgba(0,0,0,0.5)"
        shadowBlur={2}
        shadowOffsetX={1}
        shadowOffsetY={1}
      />

      {/* 도구 아이콘 (선택사항) */}
      {cursor.tool && (
        <Text
          x={15}
          y={10}
          text={`[${cursor.tool}]`}
          fontSize={8}
          fill={color}
          opacity={0.7}
        />
      )}
    </Group>
  );
};
