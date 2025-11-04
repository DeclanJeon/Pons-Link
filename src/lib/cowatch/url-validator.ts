export class CoWatchURLError extends Error {
  constructor(
    message: string,
    public userMessage: string
  ) {
    super(message);
    this.name = 'CoWatchURLError';
  }
}

export const extractYouTubeVideoId = (url: string): string => {
  try {
    const parsed = new URL(url);
    
    const allowedDomains = [
      'youtube.com',
      'www.youtube.com',
      'youtu.be',
      'm.youtube.com'
    ];
    
    if (!allowedDomains.includes(parsed.hostname)) {
      throw new CoWatchURLError(
        `Invalid domain: ${parsed.hostname}`,
        'Please provide a valid YouTube URL'
      );
    }
    
    let videoId: string | null = null;
    
    if (parsed.hostname === 'youtu.be') {
      videoId = parsed.pathname.slice(1);
    } else {
      videoId = parsed.searchParams.get('v');
    }
    
    if (!videoId || videoId.length !== 11) {
      throw new CoWatchURLError(
        'Invalid video ID',
        'Could not extract video ID from URL'
      );
    }
    
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      throw new CoWatchURLError(
        'Invalid video ID format',
        'Video ID contains invalid characters'
      );
    }
    
    return videoId;
  } catch (error) {
    if (error instanceof CoWatchURLError) {
      throw error;
    }
    throw new CoWatchURLError(
      'Invalid URL format',
      'Please provide a valid YouTube URL'
    );
  }
};

export const normalizeYouTubeURL = (url: string): string => {
  const videoId = extractYouTubeVideoId(url);
  return `https://www.youtube.com/watch?v=${videoId}`;
};

export const validateYouTubeURL = (url: string): { valid: boolean; videoId?: string; error?: string } => {
  try {
    const videoId = extractYouTubeVideoId(url);
    return { valid: true, videoId };
  } catch (error) {
    if (error instanceof CoWatchURLError) {
      return { valid: false, error: error.userMessage };
    }
    return { valid: false, error: 'Invalid URL' };
  }
};