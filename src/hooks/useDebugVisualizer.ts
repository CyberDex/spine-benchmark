import { useState, useCallback } from 'react';

/**
 * useDebugVisualizer - Custom hook for handling debug visualization operations
 * 
 * This hook encapsulates all debug visualization logic to reduce complexity in useSpineApp
 * and improve separation of concerns.
 */
export function useDebugVisualizer() {
  // Separate flags for each debug visualization type
  const [meshesVisible, setMeshesVisible] = useState(false);
  const [ikVisible, setIkVisible] = useState(false);

  /**
   * Toggle meshes visualization
   * @param visible - Optional boolean to set visibility state
   */
  const toggleMeshes = useCallback((visible?: boolean) => {
    setMeshesVisible(prev => visible ?? !prev);
  }, []);

  /**
   * Toggle IK constraints visualization
   * @param visible - Optional boolean to set visibility state
   */
  const toggleIk = useCallback((visible?: boolean) => {
    setIkVisible(prev => visible ?? !prev);
  }, []);

  return {
    meshesVisible,
    ikVisible,
    toggleMeshes,
    toggleIk
  };
}