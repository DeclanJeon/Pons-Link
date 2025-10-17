// 📁 src/components/functions/Whiteboard/WhiteboardCanvas.tsx

import { useWhiteboard } from '@/contexts/WhiteboardContext';

/**
 * @component WhiteboardCanvas
 * @description 실제 그림이 그려지는 캔버스 영역을 담당합니다.
 *              `useWhiteboard` 훅을 통해 캔버스 참조와 포인터 이벤트 핸들러를 가져옵니다.
 *              이 컴포넌트는 Props를 전혀 받지 않습니다.
 */
export const WhiteboardCanvas = () => {
  // Context를 통해 모든 필요한 것을 직접 가져옵니다.
  const {
    canvasRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useWhiteboard();

  return (
    <div className="flex-1 p-4 relative bg-background">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full whiteboard-canvas cursor-crosshair touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp} // 캔버스 밖으로 나가도 그리기가 멈추도록 설정
      />
    </div>
  );
};
