/**
 * @fileoverview 화이트보드 작업 렌더링 컴포넌트 (v3.1 - 원형 도구 수정)
 * @module components/functions/Whiteboard/WhiteboardOperation
 */

import React, { useRef } from 'react';
import { Line, Rect, Ellipse, Arrow, Text as KonvaText } from 'react-konva';
import type { DrawOperation } from '@/types/whiteboard.types';
import useWhiteboard from '@/contexts/WhiteboardContext';
import { useWhiteboardCollaboration } from '@/hooks/whiteboard/useWhiteboardCollaboration';

interface WhiteboardOperationProps {
  operation: DrawOperation;
  isSelected: boolean;
}

export const WhiteboardOperation: React.FC<WhiteboardOperationProps> = ({
  operation,
  isSelected
}) => {
  const { selectOperation, updateOperation } = useWhiteboard();
  const { broadcastUpdate } = useWhiteboardCollaboration();
  const shapeRef = useRef<any>(null);

  /**
   * 변형 이벤트 핸들러
   */
  const handleTransformEnd = () => {
    if (!shapeRef.current) return;

    const node = shapeRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    const updates: Partial<DrawOperation> = {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      scaleX,
      scaleY
    };

    updateOperation(operation.id, updates);
    broadcastUpdate(operation.id, updates);
  };

  /**
   * 드래그 종료 핸들러
   */
  const handleDragEnd = (e: any) => {
    const updates: Partial<DrawOperation> = {
      x: e.target.x(),
      y: e.target.y()
    };

    updateOperation(operation.id, updates);
    broadcastUpdate(operation.id, updates);
    
    const layer = e.target.getLayer();
    if (layer) {
      layer.batchDraw();
    }
  };

  /**
   * 경로 작업 렌더링
   */
  if (operation.type === 'path' || operation.type === 'eraser') {
    const points = operation.smoothedPath || operation.path.flatMap(p => [p.x, p.y]);

    return (
      <Line
        ref={shapeRef}
        id={operation.id}
        name="whiteboard-object"
        points={points}
        stroke={operation.options.strokeColor}
        strokeWidth={operation.options.strokeWidth}
        tension={0.5}
        lineCap="round"
        lineJoin="round"
        globalCompositeOperation={operation.type === 'eraser' ? 'destination-out' : 'source-over'}
        opacity={operation.options.opacity}
        draggable={isSelected}
        onClick={() => selectOperation(operation.id)}
        onTap={() => selectOperation(operation.id)}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        x={operation.x || 0}
        y={operation.y || 0}
        rotation={operation.rotation || 0}
        scaleX={operation.scaleX || 1}
        scaleY={operation.scaleY || 1}
      />
    );
  }

  /**
   * 사각형 렌더링
   */
  if (operation.type === 'rectangle') {
    const x = Math.min(operation.startPoint.x, operation.endPoint.x);
    const y = Math.min(operation.startPoint.y, operation.endPoint.y);
    const width = Math.abs(operation.endPoint.x - operation.startPoint.x);
    const height = Math.abs(operation.endPoint.y - operation.startPoint.y);

    return (
      <Rect
        ref={shapeRef}
        id={operation.id}
        name="whiteboard-object"
        x={x}
        y={y}
        width={width}
        height={height}
        stroke={operation.options.strokeColor}
        strokeWidth={operation.options.strokeWidth}
        fill={operation.options.fillColor}
        opacity={operation.options.opacity}
        draggable={isSelected}
        onClick={() => selectOperation(operation.id)}
        onTap={() => selectOperation(operation.id)}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        rotation={operation.rotation || 0}
        scaleX={operation.scaleX || 1}
        scaleY={operation.scaleY || 1}
      />
    );
  }

  /**
   * ✅ 원 렌더링 (Ellipse로 변경)
   */
  if (operation.type === 'circle') {
    const centerX = (operation.startPoint.x + operation.endPoint.x) / 2;
    const centerY = (operation.startPoint.y + operation.endPoint.y) / 2;
    const radiusX = Math.abs(operation.endPoint.x - operation.startPoint.x) / 2;
    const radiusY = Math.abs(operation.endPoint.y - operation.startPoint.y) / 2;

    return (
      <Ellipse
        ref={shapeRef}
        id={operation.id}
        name="whiteboard-object"
        x={centerX}
        y={centerY}
        radiusX={radiusX}
        radiusY={radiusY}
        stroke={operation.options.strokeColor}
        strokeWidth={operation.options.strokeWidth}
        fill={operation.options.fillColor}
        opacity={operation.options.opacity}
        draggable={isSelected}
        onClick={() => selectOperation(operation.id)}
        onTap={() => selectOperation(operation.id)}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        rotation={operation.rotation || 0}
        scaleX={operation.scaleX || 1}
        scaleY={operation.scaleY || 1}
      />
    );
  }

  /**
   * 화살표 렌더링
   */
  if (operation.type === 'arrow') {
    return (
      <Arrow
        ref={shapeRef}
        id={operation.id}
        name="whiteboard-object"
        points={[
          operation.startPoint.x,
          operation.startPoint.y,
          operation.endPoint.x,
          operation.endPoint.y
        ]}
        stroke={operation.options.strokeColor}
        strokeWidth={operation.options.strokeWidth}
        fill={operation.options.strokeColor}
        pointerLength={10}
        pointerWidth={10}
        opacity={operation.options.opacity}
        draggable={isSelected}
        onClick={() => selectOperation(operation.id)}
        onTap={() => selectOperation(operation.id)}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        x={operation.x || 0}
        y={operation.y || 0}
        rotation={operation.rotation || 0}
        scaleX={operation.scaleX || 1}
        scaleY={operation.scaleY || 1}
      />
    );
  }

  /**
   * 텍스트 렌더링
   */
  if (operation.type === 'text') {
    return (
      <KonvaText
        ref={shapeRef}
        id={operation.id}
        name="whiteboard-object"
        x={operation.position.x}
        y={operation.position.y}
        text={operation.text}
        fontSize={operation.options.fontSize}
        fontFamily={operation.options.fontFamily}
        fill={operation.options.strokeColor}
        width={operation.width}
        align={operation.options.textAlign}
        opacity={operation.options.opacity}
        draggable={isSelected}
        onClick={() => selectOperation(operation.id)}
        onTap={() => selectOperation(operation.id)}
        onDblClick={() => {
          const newText = prompt('Enter text:', operation.text);
          if (newText !== null) {
            updateOperation(operation.id, { text: newText });
            broadcastUpdate(operation.id, { text: newText });
          }
        }}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        rotation={operation.rotation || 0}
        scaleX={operation.scaleX || 1}
        scaleY={operation.scaleY || 1}
      />
    );
  }

  return null;
};
