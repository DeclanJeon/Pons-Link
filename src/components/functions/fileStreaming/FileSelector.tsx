import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, FileVideo, FileImage, FileText, File, X, Sparkles } from 'lucide-react';
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
  const { setStreamQuality, setSelectedFile, addToPlaylist, addAndSelectFile } = useFileStreamingStore();
  
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
    addAndSelectFile(file);
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
          ponscast-dropzone relative rounded-2xl p-6 text-center transition-colors
          ${isDraggingFile ? 'ponscast-dropzone-active' : ''}
          ${isStreaming ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
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
        
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-300/20">
          {isDraggingFile ? <Sparkles className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
        </div>
        <p className="text-sm font-semibold text-white/90">
          {isDraggingFile ? 'Drop media into PonsCast' : 'Drop media into PonsCast'}
        </p>
        <p className="mt-1 text-xs text-white/70">
          Video, PDF, images, and text files become a room-ready playlist.
        </p>
      </div>
      
      {selectedFile && (
        <div className="flex items-center gap-3 p-3 ponscast-empty-state rounded-xl">
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
      
      <div className="space-y-2 rounded-2xl p-3 ponscast-soft-card">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm text-white/75">Stream Quality:</Label>
          <select
            value={streamQuality}
            onChange={(e) => setStreamQuality(e.target.value as 'low' | 'medium' | 'high')}
            className="rounded-xl border-0 bg-black/25 px-3 py-1.5 text-sm text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset] outline-none focus:ring-2 focus:ring-indigo-300/20"
            disabled={isStreaming}
          >
            <option value="low">Low (15fps, 480p)</option>
            <option value="medium">Medium (24fps, 720p)</option>
            <option value="high">High (30fps, 1080p)</option>
          </select>
        </div>
        <div className="text-xs leading-5 text-white/75">
          {streamQuality === 'low' && 'Best for slow connections'}
          {streamQuality === 'medium' && 'Balanced quality and performance'}
          {streamQuality === 'high' && 'Best quality, requires good connection'}
        </div>
      </div>
    </div>
  );
};
