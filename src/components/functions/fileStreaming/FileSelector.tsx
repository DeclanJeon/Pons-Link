import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, FileVideo, FileImage, FileText, File, X } from 'lucide-react';
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';
import { VideoLoader } from '@/services/videoLoader';
import { toast } from 'sonner';

interface FileSelectorProps {
  selectedFile: File | null;
  isStreaming: boolean;
  streamQuality: 'low' | 'medium' | 'high';
  onFileSelect: (file: File) => void;
}

export const FileSelector = ({ 
  selectedFile, 
  isStreaming, 
  streamQuality,
  onFileSelect 
}: FileSelectorProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const { setStreamQuality, setSelectedFile, addToPlaylist } = useFileStreamingStore();
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 1) {
      addToPlaylist(files);
      toast.success(`${files.length} files added to playlist`);
    } else if (files.length === 1) {
      validateAndSelectFile(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const validateAndSelectFile = (file: File) => {
    const warnSize = 1024 * 1024 * 1024;
    if (file.size > warnSize) {
      toast.warning(`Large file detected (${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB). Streaming may take time.`);
    }
    if (file.type.startsWith('video/')) {
      const validation = VideoLoader.validateFile(file);
      if (!validation.valid) {
        toast.warning(validation.error || 'This video format may not be fully supported');
      }
    }
    const supportedTypes = [
      'video/', 'application/pdf', 'image/', 'text/'
    ];
    const isSupported = supportedTypes.some(type => 
      file.type.startsWith(type) || file.type === type
    );
    if (!isSupported) {
      toast.warning('This file type may not be fully supported');
    }
    onFileSelect(file);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 1) {
      if (!isStreaming) {
        addToPlaylist(files);
        toast.success(`${files.length} files added to playlist`);
      }
    } else if (files.length === 1) {
      if (!isStreaming) validateAndSelectFile(files[0]);
    }
  };
  
  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('video/')) return <FileVideo className="w-4 h-4" />;
    if (file.type.startsWith('image/')) return <FileImage className="w-4 h-4" />;
    if (file.type === 'application/pdf') return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };
  
  const getFileTypeLabel = (file: File) => {
    if (file.type.startsWith('video/')) return 'Video';
    if (file.type.startsWith('image/')) return 'Image';
    if (file.type === 'application/pdf') return 'PDF';
    if (file.type.startsWith('text/')) return 'Text';
    return 'File';
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isDraggingFile ? 'border-primary bg-primary/5' : 'border-border'}
          ${isStreaming ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}
        `}
        onClick={() => !isStreaming && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          accept="video/*,application/pdf,image/*,text/*"
          disabled={isStreaming}
        />
        
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">
          {isDraggingFile ? 'Drop files here' : 'Click to select or drag and drop'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports video, PDF, images, and text files
        </p>
      </div>
      
      {selectedFile && (
        <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
          <div className="flex items-center gap-2 flex-1">
            {getFileIcon(selectedFile)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {getFileTypeLabel(selectedFile)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </span>
              </div>
            </div>
          </div>
          
          {!isStreaming && (
            <Button
              onClick={clearFile}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Label className="text-sm">Stream Quality:</Label>
          <select
            value={streamQuality}
            onChange={(e) => setStreamQuality(e.target.value as any)}
            className="px-3 py-1 text-sm border rounded-md bg-background"
            disabled={isStreaming}
          >
            <option value="low">Low (15fps, 480p)</option>
            <option value="medium">Medium (24fps, 720p)</option>
            <option value="high">High (30fps, 1080p)</option>
          </select>
        </div>
        <div className="text-xs text-muted-foreground">
          {streamQuality === 'low' && 'Best for slow connections'}
          {streamQuality === 'medium' && 'Balanced quality and performance'}
          {streamQuality === 'high' && 'Best quality, requires good connection'}
        </div>
      </div>
    </div>
  );
};
