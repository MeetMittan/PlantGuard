import { useSyncExternalStore } from 'react';
import { modelManager, type ModelManagerState } from './model-manager';

export function useModelState(): ModelManagerState {
  return useSyncExternalStore(modelManager.subscribe, modelManager.getSnapshot, modelManager.getSnapshot);
}

export { modelManager };
