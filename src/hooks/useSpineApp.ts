import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { Application } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CameraContainer } from '../core/CameraContainer';
import { SpineAnalyzer, SpineAnalysisResult } from '../core/SpineAnalyzer';
import { useToast } from './ToastContext';
import { useSpineLoader } from './useSpineLoader';
import { useDebugVisualizer } from './useDebugVisualizer';
import { useBackgroundManager } from './useBackgroundManager';

export interface DebugFlags {
  showBones: boolean;
  showRegionAttachments: boolean;
  showMeshTriangles: boolean;
  showMeshHull: boolean;
  showVertices: boolean;
  showBoundingBoxes: boolean;
  showPaths: boolean;
  showClipping: boolean;
  showPhysics: boolean;
  showIkConstraints: boolean;
  showTransformConstraints: boolean;
  showPathConstraints: boolean;
}

export function useSpineApp(app: Application | null) {
  const { i18n } = useTranslation();
  const [benchmarkData, setBenchmarkData] = useState<SpineAnalysisResult | null>(null);
  
  const cameraContainerRef = useRef<CameraContainer | null>(null);
  const { addToast } = useToast();
  
  // Use specialized hooks for different concerns
  const { 
    spineInstance, 
    isLoading, 
    loadSpineFiles, 
    loadSpineFromUrls,
    clearSpineInstance
  } = useSpineLoader(app);
  
  const { 
    meshesVisible, 
    physicsVisible, 
    ikVisible, 
    toggleMeshes, 
    togglePhysics, 
    toggleIk
  } = useDebugVisualizer();
  
  const { 
    hasBackground, 
    setBackgroundImage, 
    clearBackgroundImage
  } = useBackgroundManager(app);

  // This effect runs when the app instance changes
  useEffect(() => {
    if (!app) return;

    // Create and add camera container
    const cameraContainer = new CameraContainer({
      width: app.screen.width,
      height: app.screen.height,
      app,
    });
    
    app.stage.addChild(cameraContainer);
    cameraContainerRef.current = cameraContainer;

    return () => {
      if (cameraContainer) {
        cameraContainer.destroy();
      }
      cameraContainerRef.current = null;
    };
  }, [app]);

  // Effect to regenerate benchmark data when language changes
  useEffect(() => {
    if (spineInstance) {
      const analysisResult = SpineAnalyzer.analyze(spineInstance);
      setBenchmarkData(analysisResult);
    }
  }, [i18n.language, spineInstance]);

  // Effect to handle spine instance changes and update camera
  useEffect(() => {
    if (!spineInstance || !cameraContainerRef.current) return;
    
    // Add to camera container and look at it
    cameraContainerRef.current.addChild(spineInstance);
    cameraContainerRef.current.lookAtChild(spineInstance);
    
    // Analyze spine data with new analyzer
    const analysisResult = SpineAnalyzer.analyze(spineInstance);
    setBenchmarkData(analysisResult);
    
    // Reset all debug flags
    // Ensure debug visualization is turned off by default
    cameraContainerRef.current.setDebugFlags({
      showBones: false,
      showMeshTriangles: false,
      showMeshHull: false,
      showVertices: false,
      showRegionAttachments: false,
      showBoundingBoxes: false,
      showPaths: false,
      showClipping: false,
      showPhysics: false,
      showIkConstraints: false,
      showTransformConstraints: false,
      showPathConstraints: false
    });
    
  }, [spineInstance]);
  
  // Effect to update debug visualization when flags change
  useEffect(() => {
    if (!cameraContainerRef.current) return;
    
    cameraContainerRef.current.setDebugFlags({
      showMeshTriangles: meshesVisible,
      showMeshHull: meshesVisible,
      showRegionAttachments: meshesVisible,
      showPhysics: physicsVisible,
      showIkConstraints: ikVisible
    });
    
    // Force update debug graphics
    cameraContainerRef.current.forceResetDebugGraphics();
  }, [meshesVisible, physicsVisible, ikVisible]);
  


  return {
    spineInstance,
    loadSpineFiles,
    loadSpineFromUrls,
    isLoading,
    benchmarkData,
    setBackgroundImage,
    clearBackgroundImage,
    toggleMeshes,
    togglePhysics,
    toggleIk,
    meshesVisible,
    physicsVisible,
    ikVisible
  };
}