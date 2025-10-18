/**
 * @fileoverview 화이트보드 캔버스 컴포넌트 (v3.7 - 동적 크기 조절)
 * @module components/functions/Whiteboard/WhiteboardCanvas
 */

import React, { useEffect } from 'react';
import { Stage, Layer, Rect, Line, Transformer, Circle as KonvaCircle, Arrow } from 'react-konva';
import { useWhiteboard } from '@/contexts/WhiteboardContext';
import { WhiteboardOperation } from './WhiteboardOperation';
import { WhiteboardRemoteCursor } from './WhiteboardRemoteCursor';
import { useWhiteboardStore } from '@/stores/useWhiteboardStore';

export const WhiteboardCanvas: React.FC = () => {
  const {
    stageRef,
    containerRef,
    layerRef,
    transformerRef,
    viewport,
    operations,
    remoteCursors,
    selectedIds,
    background,
    isPanMode,
    editingTextId,
    handleStageMouseDown,
    handleStageMouseMove,
    handleStageMouseUp,
    handleStageTouchStart,
    handleStageTouchMove,
    handleStageTouchEnd,
    handleWheel,
    handleKeyDown,
    handleKeyUp
  } = useWhiteboard();

  const selectionRect = useWhiteboardStore(state => state.selectionRect);
  const tempShape = useWhiteboardStore(state => state.tempShape);
  const currentTool = useWhiteboardStore(state => state.currentTool);
  const toolOptions = useWhiteboardStore(state => state.toolOptions);

  /**
   * 키보드 이벤트 리스너
   */
  useEffect(() => {
    if (editingTextId) return;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp, editingTextId]);

  /**
   * Transformer 업데이트
   */
  useEffect(() => {
    if (!transformerRef.current || !layerRef.current) return;

    const selectedNodes = Array.from(selectedIds)
      .map(id => {
        const node = layerRef.current?.findOne(`#${id}`);
        return node;
      })
      .filter((node): node is any => node !== undefined && node !== null);

    transformerRef.current.nodes(selectedNodes);
    
    if (layerRef.current) {
      layerRef.current.batchDraw();
    }
  }, [selectedIds, operations, transformerRef, layerRef]);

  /**
   * 그리드 렌더링
   */
  const renderGrid = () => {
    if (background.gridType === 'none') return null;

    const { gridSize, gridColor } = background;
    const lines: JSX.Element[] = [];

    const startX = Math.floor((-viewport.x - 5000) / gridSize) * gridSize;
    const endX = Math.ceil((-viewport.x + viewport.width / viewport.scale + 5000) / gridSize) * gridSize;
    const startY = Math.floor((-viewport.y - 5000) / gridSize) * gridSize;
    const endY = Math.ceil((-viewport.y + viewport.height / viewport.scale + 5000) / gridSize) * gridSize;

    if (background.gridType === 'lines') {
      for (let x = startX; x < endX; x += gridSize) {
        lines.push(
          <Line
            key={`v-${x}`}
            points={[x, startY, x, endY]}
            stroke={gridColor}
            strokeWidth={1 / viewport.scale}
            listening={false}
          />
        );
      }

      for (let y = startY; y < endY; y += gridSize) {
        lines.push(
          <Line
            key={`h-${y}`}
            points={[startX, y, endX, y]}
            stroke={gridColor}
            strokeWidth={1 / viewport.scale}
            listening={false}
          />
        );
      }
    } else if (background.gridType === 'dots') {
      const dotSize = 2 / viewport.scale;
      for (let x = startX; x < endX; x += gridSize) {
        for (let y = startY; y < endY; y += gridSize) {
          lines.push(
            <Rect
              key={`dot-${x}-${y}`}
              x={x - dotSize / 2}
              y={y - dotSize / 2}
              width={dotSize}
              height={dotSize}
              fill={gridColor}
              listening={false}
            />
          );
        }
      }
    }

    return lines;
  };

  /**
   * 임시 도형 렌더링
   */
  const renderTempShape = () => {
    if (!tempShape) return null;

    const { startPoint, endPoint } = tempShape;

    if (currentTool === 'rectangle') {
      const x = Math.min(startPoint.x, endPoint.x);
      const y = Math.min(startPoint.y, endPoint.y);
      const width = Math.abs(endPoint.x - startPoint.x);
      const height = Math.abs(endPoint.y - startPoint.y);

      return (
        <Rect
          x={x}
          y={y}
          width={width}
          height={height}
          stroke={toolOptions.strokeColor}
          strokeWidth={toolOptions.strokeWidth}
          dash={[5, 5]}
          listening={false}
        />
      );
    }

    if (currentTool === 'circle') {
      const centerX = (startPoint.x + endPoint.x) / 2;
      const centerY = (startPoint.y + endPoint.y) / 2;
      const radiusX = Math.abs(endPoint.x - startPoint.x) / 2;
      const radiusY = Math.abs(endPoint.y - startPoint.y) / 2;

      return (
        <KonvaCircle
          x={centerX}
          y={centerY}
          radiusX={radiusX}
          radiusY={radiusY}
          stroke={toolOptions.strokeColor}
          strokeWidth={toolOptions.strokeWidth}
          dash={[5, 5]}
          listening={false}
        />
      );
    }

    if (currentTool === 'arrow') {
      return (
        <Arrow
          points={[startPoint.x, startPoint.y, endPoint.x, endPoint.y]}
          stroke={toolOptions.strokeColor}
          strokeWidth={toolOptions.strokeWidth}
          fill={toolOptions.strokeColor}
          pointerLength={10}
          pointerWidth={10}
          dash={[5, 5]}
          listening={false}
        />
      );
    }

    return null;
  };

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0"
      style={{ 
        backgroundColor: background.color,
        overflow: 'hidden'
      }}
    >
      <Stage
        ref={stageRef}
        width={viewport.width}
        height={viewport.height}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        x={viewport.x * viewport.scale}
        y={viewport.y * viewport.scale}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onTouchStart={handleStageTouchStart}
        onTouchMove={handleStageTouchMove}
        onTouchEnd={handleStageTouchEnd}
        onWheel={handleWheel}
        className={isPanMode ? 'cursor-grab' : 'cursor-crosshair'}
        draggable={false}
      >
        <Layer listening={false}>
          {renderGrid()}
        </Layer>

        <Layer ref={layerRef}>
          {Array.from(operations.values()).map((operation) => (
            <WhiteboardOperation
              key={operation.id}
              operation={operation}
              isSelected={selectedIds.has(operation.id)}
            />
          ))}

          {renderTempShape()}

          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
            keepRatio={false}
            enabledAnchors={[
              'top-left',
              'top-right',
              'bottom-left',
              'bottom-right',
              'middle-left',
              'middle-right',
              'top-center',
              'bottom-center'
            ]}
          />
        </Layer>

        <Layer listening={false}>
          {selectionRect && (
            <Rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3b82f6"
              strokeWidth={2 / viewport.scale}
              dash={[5 / viewport.scale, 5 / viewport.scale]}
            />
          )}

          {Array.from(remoteCursors.values()).map((cursor) => (
            <WhiteboardRemoteCursor key={cursor.userId} cursor={cursor} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
};