import { Animation, BlendMode, Spine } from "@esotericsoftware/spine-pixi-v8";
import { PERFORMANCE_FACTORS } from "../constants/performanceFactors";
import { calculateBlendModeScore } from "../utils/scoreCalculator";
import { ActiveComponents } from "../utils/animationUtils";

export interface BlendModeMetrics {
  activeNonNormalCount: number;
  activeAdditiveCount: number;
  activeMultiplyCount: number;
  nonNormalBlendModeCount: number; // For compatibility
  additiveCount: number; // For compatibility
  multiplyCount: number; // For compatibility
  score: number;
}

export interface GlobalBlendModeAnalysis {
  blendModeCounts: Map<BlendMode, number>;
  slotsWithNonNormalBlendMode: Map<string, BlendMode>;
  metrics: BlendModeMetrics;
}

/**
 * Analyzes blend modes for a specific animation
 * @param spineInstance The Spine instance to analyze
 * @param animation The animation to analyze
 * @param activeComponents Components active in this animation
 * @returns Metrics for blend mode analysis
 */
export function analyzeBlendModesForAnimation(
  spineInstance: Spine,
  animation: Animation,
  activeComponents: ActiveComponents
): BlendModeMetrics {
  const skeleton = spineInstance.skeleton;
  
  let activeNonNormalCount = 0;
  let activeAdditiveCount = 0;
  let activeMultiplyCount = 0;
  
  console.log(`Analyzing blend modes for ${animation.name}, active slots: ${activeComponents.slots.size}`);
  
  // Only analyze blend modes in active slots
  activeComponents.slots.forEach(slotName => {
    const slot = skeleton.slots.find((s: any) => s.data.name === slotName);
    
    if (slot) {
      const blendMode = slot.data.blendMode;
      
      if (blendMode !== BlendMode.Normal) {
        activeNonNormalCount++;
        
        if (blendMode === BlendMode.Additive) {
          activeAdditiveCount++;
        } else if (blendMode === BlendMode.Multiply) {
          activeMultiplyCount++;
        }
        
        console.log(`Found non-normal blend mode in slot ${slotName}: ${BlendMode[blendMode]}`);
      }
    }
  });
  
  // Calculate blend mode score
  const blendModeScore = calculateBlendModeScore(activeNonNormalCount, activeAdditiveCount);
  
  return {
    activeNonNormalCount,
    nonNormalBlendModeCount: activeNonNormalCount, // For compatibility
    activeAdditiveCount,
    additiveCount: activeAdditiveCount, // For compatibility
    activeMultiplyCount,
    multiplyCount: activeMultiplyCount, // For compatibility
    score: blendModeScore
  };
}

/**
 * Analyzes global blend modes across the entire skeleton
 * @param spineInstance The Spine instance to analyze
 * @returns Global blend mode analysis data
 */
export function analyzeGlobalBlendModes(spineInstance: Spine): GlobalBlendModeAnalysis {
  const blendModeCount = new Map<BlendMode, number>();
  const slotsWithNonNormalBlendMode = new Map<string, BlendMode>();
  
  // Initialize blend mode counts
  Object.values(BlendMode).forEach(mode => {
    if (typeof mode === 'number') {
      blendModeCount.set(mode as BlendMode, 0);
    }
  });
  
  // Count blend modes
  spineInstance.skeleton.slots.forEach(slot => {
    const blendMode = slot.data.blendMode;
    blendModeCount.set(blendMode, (blendModeCount.get(blendMode) || 0) + 1);
    
    if (blendMode !== BlendMode.Normal) {
      slotsWithNonNormalBlendMode.set(slot.data.name, blendMode);
    }
  });
  
  // Count specific blend mode types
  const additiveCount = Array.from(slotsWithNonNormalBlendMode.values())
    .filter(mode => mode === BlendMode.Additive).length;
  
  const multiplyCount = Array.from(slotsWithNonNormalBlendMode.values())
    .filter(mode => mode === BlendMode.Multiply).length;
  
  // Calculate blend mode score
  const blendModeScore = calculateBlendModeScore(slotsWithNonNormalBlendMode.size, additiveCount);
  
  const metrics: BlendModeMetrics = {
    activeNonNormalCount: slotsWithNonNormalBlendMode.size,
    nonNormalBlendModeCount: slotsWithNonNormalBlendMode.size,
    activeAdditiveCount: additiveCount,
    additiveCount,
    activeMultiplyCount: multiplyCount,
    multiplyCount,
    score: blendModeScore
  };
  
  return {
    blendModeCounts: blendModeCount,
    slotsWithNonNormalBlendMode,
    metrics
  };
}