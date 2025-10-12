/**
 * @fileoverview 이미지 뷰어 - 스트리밍 지원 완전 구현
 * @module components/FileStreaming/ImageViewer
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCw, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { toast } from 'sonner';

interface ImageViewerProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isStreaming: boolean;
  onStreamUpdate?: () => void;
}

export const ImageViewer = ({ canvasRef, isStreaming, onStreamUpdate }: ImageViewerProps) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const rotateImage = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx?.drawImage(canvas, 0, 0);
    
    const temp = canvas.width;
    canvas.width = canvas.height;
    canvas.height = temp;
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2);
    ctx.restore();
    
    setRotation((prevRotation) => (prevRotation + 90) % 360);
    toast.info(`Image rotated to ${(rotation + 90) % 360}°`);
    
    if (isStreaming && onStreamUpdate) {
      onStreamUpdate();
    }
  };
  
  const changeZoom = (delta: number) => {
    if (!canvasRef.current) return;
    
    const newScale = Math.max(0.25, Math.min(4, scale + delta));
    setScale(newScale);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const newWidth = canvas.width * (newScale / scale);
    const newHeight = canvas.height * (newScale / scale);
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx?.putImageData(imageData, 0, 0);
    
    canvas.width = newWidth;
    canvas.height = newHeight;
    ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
    
    toast.info(`Zoom: ${Math.round(newScale * 100)}%`);
    
    if (isStreaming && onStreamUpdate) {
      onStreamUpdate();
    }
  };
  
  const resetView = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    toast.info('View reset');
    
    if (isStreaming && onStreamUpdate) {
      onStreamUpdate();
    }
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isStreaming) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isStreaming) return;
    
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4 p-4 bg-secondary/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => changeZoom(-0.25)}
            size="sm"
            variant="outline"
            disabled={scale <= 0.25}
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <span className="text-sm font-medium w-16 text-center">
            {Math.round(scale * 100)}%
          </span>
          
          <Button
            onClick={() => changeZoom(0.25)}
            size="sm"
            variant="outline"
            disabled={scale >= 4}
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="w-px h-6 bg-border" />
        
        <Button
          onClick={rotateImage}
          size="sm"
          variant="outline"
          className="flex items-center gap-2"
          title="Rotate 90°"
        >
          <RotateCw className="w-4 h-4" />
          Rotate
        </Button>
        
        <Button
          onClick={resetView}
          size="sm"
          variant="outline"
          className="flex items-center gap-2"
          title="Reset view"
        >
          <Move className="w-4 h-4" />
          Reset
        </Button>
      </div>
      
      {!isStreaming && (
        <div 
          className="overflow-hidden cursor-move select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          {/* Canvas is rendered by parent component */}
        </div>
      )}
      
      {isStreaming && (
        <div className="text-center text-sm text-muted-foreground">
          Image streaming active. Controls affect all viewers.
        </div>
      )}
    </div>
  );
};
