/**
 * @fileoverview 화이트보드 캔버스 컴포넌트 (v3.9 - 배경 기능 완전 수정)
 * @module components/functions/Whiteboard/WhiteboardCanvas
 * 
 * @description
 * - ✅ Zustand 스토어에서 직접 background 구독
 * - ✅ useEffect로 DOM 직접 업데이트 (React 상태 우회)
 * - ✅ 배경색 변경 즉시 반영 보장
 */

import React, { useEffect } from 'react';
import { Stage, Layer, Rect, Line, Transformer, Ellipse, Arrow } from 'react-konva';
import { toast } from 'sonner';
import useWhiteboard from '@/contexts/WhiteboardContext';
import { WhiteboardOperation } from './WhiteboardOperation';
import { WhiteboardRemoteCursor } from './WhiteboardRemoteCursor';
import { useWhiteboardStore } from '@/stores/useWhiteboardStore';
import { useWhiteboardCollaboration } from '@/hooks/whiteboard/useWhiteboardCollaboration';

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
    handleKeyUp,
    pasteImage
  } = useWhiteboard();

  const { broadcastOperation } = useWhiteboardCollaboration();
  const operationsMap = useWhiteboardStore(state => state.operations);

  // ✅ Zustand 스토어에서 직접 구독 (Context 우회)
  const background = useWhiteboardStore(state => state.background);
  const selectionRect = useWhiteboardStore(state => state.selectionRect);
  const tempShape = useWhiteboardStore(state => state.tempShape);
  const tempPath = useWhiteboardStore(state => state.tempPath);
  const currentTool = useWhiteboardStore(state => state.currentTool);
  const toolOptions = useWhiteboardStore(state => state.toolOptions);
  const remoteViewport = useWhiteboardStore(state => state.remoteViewport);
  const remoteViewportUser = useWhiteboardStore(state => state.remoteViewportUser);
  const followedUserId = useWhiteboardStore(state => state.followedUserId);

  /**
   * ✅ 원격 뷰포트 동기화 (Follow Me 기능)
   */
  useEffect(() => {
    if (!remoteViewport || !stageRef.current) return;
    if (remoteViewportUser?.userId !== followedUserId) return;

    const stage = stageRef.current;
    stage.x(remoteViewport.x * remoteViewport.scale);
    stage.y(remoteViewport.y * remoteViewport.scale);
    stage.scale({ x: remoteViewport.scale, y: remoteViewport.scale });
    stage.batchDraw();

    console.log('[WhiteboardCanvas] Synced to remote viewport:', remoteViewport);
  }, [remoteViewport, remoteViewportUser, followedUserId, stageRef]);

  /**
   * ✅ 배경색 직접 DOM 업데이트 (React 상태 우회)
   */
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.backgroundColor = background.color;
      console.log('[WhiteboardCanvas] Background color updated to:', background.color);
    }
  }, [background.color, containerRef]);

  useEffect(() => {
    if (!stageRef.current || !containerRef.current) return;

    const getCursorStyle = () => {
      if (isPanMode) return 'grab';
      if (editingTextId) return 'text';

      switch (currentTool) {
        case 'select':
          return 'default';
        case 'pen':
          return 'crosshair';
        case 'eraser':
          return 'cell';
        case 'text':
          return 'text';
        case 'pan':
          return 'grab';
        default:
          return 'crosshair';
      }
    };

    containerRef.current.style.cursor = getCursorStyle();
  }, [currentTool, isPanMode, editingTextId, stageRef, containerRef]);

  useEffect(() => {
    if (editingTextId) return;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp, editingTextId]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (editingTextId) return;

      const items = e.clipboardData?.items;
      const files = e.clipboardData?.files;
      
      console.log('[WhiteboardCanvas] Paste event detected', { itemsCount: items?.length, filesCount: files?.length });

      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
              console.log('[WhiteboardCanvas] Found image in clipboard items:', file.name, file.type);
              const reader = new FileReader();
              reader.onload = (event) => {
                const imageSrc = event.target?.result as string;
                if (imageSrc) {
                  pasteImage(imageSrc, (imageId) => {
                    if (imageId) {
                      const latestOperations = useWhiteboardStore.getState().operations;
                      const imageOp = latestOperations.get(imageId);
                      if (imageOp) {
                        broadcastOperation(imageOp);
                        toast.success('Image pasted to whiteboard');
                        console.log('[WhiteboardCanvas] Image pasted and broadcasted:', imageId);
                      }
                    }
                  });
                }
              };
              reader.readAsDataURL(file);
            }
            return;
          }
        }
      }

      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          if (files[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            console.log('[WhiteboardCanvas] Found image in clipboard files:', files[i].name);
            const reader = new FileReader();
            reader.onload = (event) => {
              const imageSrc = event.target?.result as string;
              if (imageSrc) {
                pasteImage(imageSrc, (imageId) => {
                  if (imageId) {
                    const latestOperations = useWhiteboardStore.getState().operations;
                    const imageOp = latestOperations.get(imageId);
                    if (imageOp) {
                      broadcastOperation(imageOp);
                    }
                  }
                });
              }
            };
            reader.readAsDataURL(files[i]);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [pasteImage, broadcastOperation, editingTextId]);

  /**
   * Transformer 업데이트
   */
  useEffect(() => {
    if (!transformerRef.current || !layerRef.current) return;

    const selectedNodes = Array.from(selectedIds)
      .map(id => {
        const node = layerRef.current?.findOne((n) => n.id() === id);
        return node;
      })
      .filter((node): node is any => node !== undefined && node !== null);

    if (selectedNodes.length > 0) {
      transformerRef.current.nodes(selectedNodes);
    } else {
      transformerRef.current.nodes([]);
    }

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
        <Ellipse
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
      const centerX = (startPoint.x + endPoint.x) / 2;
      const centerY = (startPoint.y + endPoint.y) / 2;
      const relativeStartX = startPoint.x - centerX;
      const relativeStartY = startPoint.y - centerY;
      const relativeEndX = endPoint.x - centerX;
      const relativeEndY = endPoint.y - centerY;

      return (
        <Arrow
          points={[relativeStartX, relativeStartY, relativeEndX, relativeEndY]}
          stroke={toolOptions.strokeColor}
          strokeWidth={toolOptions.strokeWidth}
          fill={toolOptions.strokeColor}
          pointerLength={10}
          pointerWidth={10}
          dash={[5, 5]}
          listening={false}
          x={centerX}
          y={centerY}
        />
      );
    }

    return null;
  };

  /**
   * 펜 도구 임시 경로 렌더링
   */
  const renderTempPath = () => {
    if (!tempPath || tempPath.length < 2) return null;

    const points = tempPath.flatMap(p => [p.x, p.y]);

    return (
      <Line
        points={points}
        stroke={toolOptions.strokeColor}
        strokeWidth={toolOptions.strokeWidth}
        tension={0.5}
        lineCap="round"
        lineJoin="round"
        opacity={0.7}
        dash={[5, 5]}
        listening={false}
      />
    );
  };

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0"
      style={{ 
        // ✅ 초기 배경색만 설정 (useEffect에서 업데이트)
        backgroundColor: background.color,
        overflow: 'hidden',
        transition: 'background-color 0.2s ease' // ✅ 부드러운 전환 효과
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
        onTouchStart={(e) => {
          // 브라우저 스크롤 방지
          e.evt.preventDefault();
          handleStageTouchStart(e);
        }}
        onTouchMove={(e) => {
          // 브라우저 스크롤 방지
          e.evt.preventDefault();
          handleStageTouchMove(e);
        }}
        onTouchEnd={(e) => {
          // 브라우저 스크롤 방지
          e.evt.preventDefault();
          handleStageTouchEnd(e);
        }}
        onWheel={handleWheel}
        className={isPanMode ? 'cursor-grab' : 'cursor-crosshair'}
        draggable={false}
      >
        {/* 그리드 레이어 */}
        <Layer listening={false}>
          {renderGrid()}
        </Layer>

        {/* 메인 레이어 */}
        <Layer ref={layerRef}>
          {Array.from(operations.values()).map((operation) => (
            <WhiteboardOperation
              key={operation.id}
              operation={operation}
              isSelected={selectedIds.has(operation.id)}
            />
          ))}

          {renderTempShape()}
          {renderTempPath()}

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

        {/* 오버레이 레이어 */}
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