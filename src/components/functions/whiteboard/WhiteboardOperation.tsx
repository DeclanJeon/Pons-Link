/**
 * @fileoverview 화이트보드 작업 렌더링 컴포넌트 (v3.3 - Text Tool 위치 동기화 수정)
 * @module components/functions/Whiteboard/WhiteboardOperation
 */

import React, { useRef, useState, useEffect } from 'react';
import { Line, Rect, Ellipse, Arrow, Text as KonvaText, Image as KonvaImage } from 'react-konva';
import type { DrawOperation } from '@/types/whiteboard.types';
import useWhiteboard from '@/contexts/WhiteboardContext';
import { useWhiteboardCollaboration } from '@/hooks/whiteboard/useWhiteboardCollaboration';
import Konva from 'konva';

interface WhiteboardOperationProps {
  operation: DrawOperation;
  isSelected: boolean;
}

export const WhiteboardOperation: React.FC<WhiteboardOperationProps> = ({
  operation,
  isSelected
}) => {
  const { selectOperation, updateOperation, pushHistory, startTextEdit } = useWhiteboard();
  const { broadcastUpdate, broadcastDragUpdate } = useWhiteboardCollaboration();
  const shapeRef = useRef<any>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleClick = (e: any) => {
    const isMultiSelect = e.evt.ctrlKey || e.evt.metaKey;
    selectOperation(operation.id, isMultiSelect);
  };

  const handleTransformEnd = () => {
    if (!shapeRef.current) return;

    const node = shapeRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    if (operation.type === 'text') {
      const updates = {
        position: { x: node.x(), y: node.y() },
        rotation: node.rotation(),
        scaleX,
        scaleY
      };
      updateOperation(operation.id, updates);
      broadcastUpdate(operation.id, updates);
      pushHistory();
    } else {
      const updates = {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX,
        scaleY
      };
      updateOperation(operation.id, updates);
      broadcastUpdate(operation.id, updates);
      pushHistory();
    }
  };

  const handleTransform = (e: any) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    if (operation.type === 'text') {
      const updates = {
        position: { x: node.x(), y: node.y() },
        rotation: node.rotation(),
        scaleX,
        scaleY
      };
      updateOperation(operation.id, updates);
      broadcastDragUpdate(operation.id, updates);
    } else {
      const updates = {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX,
        scaleY
      };
      updateOperation(operation.id, updates);
      broadcastDragUpdate(operation.id, updates);
    }
  };

  const handleDragMove = (e: any) => {
    if (!isSelected) return;

    if (operation.type === 'text') {
      const updates = { position: { x: e.target.x(), y: e.target.y() } };
      updateOperation(operation.id, updates);
      broadcastDragUpdate(operation.id, updates);
    } else {
      const updates = { x: e.target.x(), y: e.target.y() };
      updateOperation(operation.id, updates);
      broadcastDragUpdate(operation.id, updates);
    }
  };

  const handleDragEnd = (e: any) => {
    if (operation.type === 'text') {
      const updates = { position: { x: e.target.x(), y: e.target.y() } };
      updateOperation(operation.id, updates);
      broadcastUpdate(operation.id, updates);
      broadcastDragUpdate(operation.id, updates);
      pushHistory();
    } else {
      const updates = { x: e.target.x(), y: e.target.y() };
      updateOperation(operation.id, updates);
      broadcastUpdate(operation.id, updates);
      broadcastDragUpdate(operation.id, updates);
      pushHistory();
    }

    const layer = e.target.getLayer();
    if (layer) {
      layer.batchDraw();
    }
  };

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
        onClick={handleClick}
        onTap={handleClick}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransform={handleTransform}
        onTransformEnd={handleTransformEnd}
        x={operation.x || 0}
        y={operation.y || 0}
        rotation={operation.rotation || 0}
        scaleX={operation.scaleX || 1}
        scaleY={operation.scaleY || 1}
      />
    );
  }

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
        onClick={handleClick}
        onTap={handleClick}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransform={handleTransform}
        onTransformEnd={handleTransformEnd}
        rotation={operation.rotation || 0}
        scaleX={operation.scaleX || 1}
        scaleY={operation.scaleY || 1}
      />
    );
  }

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
        onClick={handleClick}
        onTap={handleClick}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransform={handleTransform}
        onTransformEnd={handleTransformEnd}
        rotation={operation.rotation || 0}
        scaleX={operation.scaleX || 1}
        scaleY={operation.scaleY || 1}
      />
    );
  }

  if (operation.type === 'arrow') {
    const centerX = (operation.startPoint.x + operation.endPoint.x) / 2;
    const centerY = (operation.startPoint.y + operation.endPoint.y) / 2;
    const relativeStartX = operation.startPoint.x - centerX;
    const relativeStartY = operation.startPoint.y - centerY;
    const relativeEndX = operation.endPoint.x - centerX;
    const relativeEndY = operation.endPoint.y - centerY;

    return (
      <Arrow
        ref={shapeRef}
        id={operation.id}
        name="whiteboard-object"
        points={[relativeStartX, relativeStartY, relativeEndX, relativeEndY]}
        stroke={operation.options.strokeColor}
        strokeWidth={operation.options.strokeWidth}
        fill={operation.options.strokeColor}
        pointerLength={10}
        pointerWidth={10}
        opacity={operation.options.opacity}
        draggable={isSelected}
        onClick={handleClick}
        onTap={handleClick}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransform={handleTransform}
        onTransformEnd={handleTransformEnd}
        rotation={operation.rotation || 0}
        scaleX={operation.scaleX || 1}
        scaleY={operation.scaleY || 1}
      />
    );
  }

  if (operation.type === 'text') {
    const posX = operation.x !== undefined ? operation.x : operation.position.x;
    const posY = operation.y !== undefined ? operation.y : operation.position.y;
    const rotation = operation.rotation !== undefined ? operation.rotation : 0;
    const scaleX = operation.scaleX !== undefined ? operation.scaleX : 1;
    const scaleY = operation.scaleY !== undefined ? operation.scaleY : 1;

    return (
      <KonvaText
        ref={shapeRef}
        id={operation.id}
        name="whiteboard-object"
        x={posX}
        y={posY}
        text={operation.text}
        fontSize={operation.options.fontSize}
        fontFamily={operation.options.fontFamily}
        fill={operation.options.strokeColor}
        width={operation.width}
        align={operation.options.textAlign}
        opacity={operation.options.opacity}
        draggable={isSelected}
        onClick={handleClick}
        onTap={handleClick}
        onDblClick={() => {
          startTextEdit(operation.id);
        }}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransform={handleTransform}
        onTransformEnd={handleTransformEnd}
        rotation={rotation}
        scaleX={scaleX}
        scaleY={scaleY}
      />
    );
  }

  if (operation.type === 'image') {
    const posX = operation.x !== undefined ? operation.x : operation.position.x;
    const posY = operation.y !== undefined ? operation.y : operation.position.y;
    const rotation = operation.rotation !== undefined ? operation.rotation : 0;
    const scaleX = operation.scaleX !== undefined ? operation.scaleX : 1;
    const scaleY = operation.scaleY !== undefined ? operation.scaleY : 1;

    const [imageNode, setImageNode] = useState<HTMLImageElement | null>(null);

    useEffect(() => {
      const img = new window.Image();
      img.src = operation.src;
      img.onload = () => {
        setImageNode(img);
        setImageLoaded(true);
        if (shapeRef.current) {
          shapeRef.current.getLayer()?.batchDraw();
        }
      };
    }, [operation.src]);

    return (
      <KonvaImage
        ref={shapeRef}
        id={operation.id}
        name="whiteboard-object"
        x={posX}
        y={posY}
        image={imageNode || undefined}
        width={operation.width}
        height={operation.height}
        opacity={operation.options.opacity || 1}
        draggable={isSelected}
        onClick={handleClick}
        onTap={handleClick}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransform={handleTransform}
        onTransformEnd={handleTransformEnd}
        rotation={rotation}
        scaleX={scaleX}
        scaleY={scaleY}
      />
    );
  }

  return null;
};
