// 📁 src/contexts/WhiteboardContext.tsx (import만 추가)

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { WhiteboardContextValue, ToolOptions } from '@/types/whiteboard.types';

import { useWhiteboardState } from '@/hooks/whiteboard/useWhiteboardState';
import { useWhiteboardTools } from '@/hooks/whiteboard/useWhiteboardTools';
import { useWhiteboardHistory } from '@/hooks/whiteboard/useWhiteboardHistory';

const WhiteboardContext = createContext<WhiteboardContextValue | null>(null);

export const WhiteboardProvider = ({ children }: { children: ReactNode }) => {
  const stateManager = useWhiteboardState();
  const historyManager = useWhiteboardHistory(stateManager);
  const toolManager = useWhiteboardTools(stateManager, historyManager);

  const contextValue = useMemo<WhiteboardContextValue>(() => {
    const wrappedSetToolOptions = (options: Partial<ToolOptions>) => {
      toolManager.setToolOptions(prev => ({
        ...prev,
        ...options
      }));
    };

    return {
      ...stateManager,
      ...toolManager,
      ...historyManager,
      setToolOptions: wrappedSetToolOptions,
    };
  }, [stateManager, toolManager, historyManager]);

  return (
    <WhiteboardContext.Provider value={contextValue}>
      {children}
    </WhiteboardContext.Provider>
  );
};

export const useWhiteboard = (): WhiteboardContextValue => {
  const context = useContext(WhiteboardContext);

  if (!context) {
    throw new Error(
      'FATAL ERROR: useWhiteboard() must be used within a <WhiteboardProvider>.' +
      'This is a structural issue. Ensure your component tree is correctly wrapped.'
    );
  }

  return context;
};
