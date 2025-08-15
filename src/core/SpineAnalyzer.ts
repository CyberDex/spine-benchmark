import { Spine } from "@esotericsoftware/spine-pixi-v8";
import { 
  analyzeMeshesForAnimation, 
  analyzeGlobalMeshes,
  MeshMetrics,
  GlobalMeshAnalysis 
} from "./analyzers/meshAnalyzer";
import { 
  analyzeClippingForAnimation,
  analyzeGlobalClipping,
  ClippingMetrics,
  GlobalClippingAnalysis
} from "./analyzers/clippingAnalyzer";
import { 
  analyzeBlendModesForAnimation,
  analyzeGlobalBlendModes,
  BlendModeMetrics,
  GlobalBlendModeAnalysis
} from "./analyzers/blendModeAnalyzer";
import { 
  analyzeSkeletonStructure,
  SkeletonAnalysis,
  SkeletonMetrics
} from "./analyzers/skeletonAnalyzer";
import { 
  analyzePhysicsForAnimation,
  analyzeGlobalPhysics,
  ConstraintMetrics,
  GlobalPhysicsAnalysis
} from "./analyzers/physicsAnalyzer";
import { calculateOverallScore } from "./utils/scoreCalculator";
import { getActiveComponentsForAnimation, ActiveComponents } from "./utils/animationUtils";

export interface AnimationAnalysis {
  name: string;
  duration: number;
  overallScore: number;
  meshMetrics: MeshMetrics;
  clippingMetrics: ClippingMetrics;
  blendModeMetrics: BlendModeMetrics;
  constraintMetrics: ConstraintMetrics;
  activeComponents: ActiveComponents;
}

export interface SpineAnalysisResult {
  // Basic info
  skeletonName: string;
  totalAnimations: number;
  totalSkins: number;
  
  // Skeleton analysis
  skeleton: SkeletonAnalysis;
  
  // Per-animation analyses
  animations: AnimationAnalysis[];
  
  // Global analyses
  globalMesh: GlobalMeshAnalysis;
  globalClipping: GlobalClippingAnalysis;
  globalBlendMode: GlobalBlendModeAnalysis;
  globalPhysics: GlobalPhysicsAnalysis;
  
  // Aggregate scores
  medianScore: number;
  bestAnimation: AnimationAnalysis | null;
  worstAnimation: AnimationAnalysis | null;
  
  // Statistics
  stats: {
    animationsWithPhysics: number;
    animationsWithClipping: number;
    animationsWithBlendModes: number;
    animationsWithIK: number;
    animationsWithTransform: number;
    animationsWithPath: number;
    highVertexAnimations: number; // >500 vertices
    poorPerformingAnimations: number; // score < 55
  };
}

/**
 * Main SpineAnalyzer class that analyzes Spine instances and returns comprehensive data
 */
export class SpineAnalyzer {
  /**
   * Analyzes a Spine instance and returns a comprehensive data object
   * @param spineInstance The Spine instance to analyze
   * @returns Complete analysis data
   */
  static analyze(spineInstance: Spine): SpineAnalysisResult {
    const animations = spineInstance.skeleton.data.animations;
    const animationAnalyses: AnimationAnalysis[] = [];

    console.log(`Analyzing ${animations.length} animations...`);

    // Analyze skeleton structure (common for all animations)
    const skeletonAnalysis = analyzeSkeletonStructure(spineInstance);

    // Analyze global data
    const globalMeshAnalysis = analyzeGlobalMeshes(spineInstance);
    const globalClippingAnalysis = analyzeGlobalClipping(spineInstance);
    const globalBlendModeAnalysis = analyzeGlobalBlendModes(spineInstance);
    const globalPhysicsAnalysis = analyzeGlobalPhysics(spineInstance);

    // Analyze each animation individually
    animations.forEach((animation, index) => {
      console.log(`Analyzing animation ${index + 1}/${animations.length}: ${animation.name}`);
      
      // Get active components for this animation (frame-by-frame analysis)
      const activeComponents = getActiveComponentsForAnimation(spineInstance, animation);
      
      console.log(`Active components in ${animation.name}:`, {
        slots: activeComponents.slots.size,
        meshes: activeComponents.meshes.size,
        hasPhysics: activeComponents.hasPhysics,
        hasClipping: activeComponents.hasClipping,
        hasBlendModes: activeComponents.hasBlendModes
      });

      // Analyze meshes for this animation
      const meshMetrics = analyzeMeshesForAnimation(spineInstance, animation, activeComponents);

      // Analyze clipping for this animation
      const clippingMetrics = analyzeClippingForAnimation(spineInstance, animation, activeComponents);

      // Analyze blend modes for this animation
      const blendModeMetrics = analyzeBlendModesForAnimation(spineInstance, animation, activeComponents);

      // Analyze constraints for this animation
      const constraintMetrics = analyzePhysicsForAnimation(spineInstance, animation, activeComponents);

      // Calculate overall performance score for this animation
      const componentScores = {
        boneScore: skeletonAnalysis.metrics.score, // Bone score is same for all animations
        meshScore: meshMetrics.score,
        clippingScore: clippingMetrics.score,
        blendModeScore: blendModeMetrics.score,
        constraintScore: constraintMetrics.score
      };

      const overallScore = calculateOverallScore(componentScores);

      animationAnalyses.push({
        name: animation.name,
        duration: animation.duration,
        overallScore,
        meshMetrics,
        clippingMetrics,
        blendModeMetrics,
        constraintMetrics,
        activeComponents
      });
    });

    // Calculate median score
    const scores = animationAnalyses.map(a => a.overallScore);
    scores.sort((a, b) => a - b);
    const medianScore = scores.length > 0 
      ? scores[Math.floor(scores.length / 2)]
      : 100;

    // Find best and worst performing animations
    const sortedAnalyses = [...animationAnalyses].sort((a, b) => b.overallScore - a.overallScore);
    const bestAnimation = sortedAnalyses.length > 0 ? sortedAnalyses[0] : null;
    const worstAnimation = sortedAnalyses.length > 0 ? sortedAnalyses[sortedAnalyses.length - 1] : null;

    // Calculate statistics
    const stats = {
      animationsWithPhysics: animationAnalyses.filter(a => a.activeComponents.hasPhysics).length,
      animationsWithClipping: animationAnalyses.filter(a => a.activeComponents.hasClipping).length,
      animationsWithBlendModes: animationAnalyses.filter(a => a.activeComponents.hasBlendModes).length,
      animationsWithIK: animationAnalyses.filter(a => a.activeComponents.hasIK).length,
      animationsWithTransform: animationAnalyses.filter(a => a.activeComponents.hasTransform).length,
      animationsWithPath: animationAnalyses.filter(a => a.activeComponents.hasPath).length,
      highVertexAnimations: animationAnalyses.filter(a => a.meshMetrics.totalVertices > 500).length,
      poorPerformingAnimations: animationAnalyses.filter(a => a.overallScore < 55).length
    };

    // Return comprehensive analysis result
    return {
      skeletonName: spineInstance.skeleton.data.name || 'Unnamed',
      totalAnimations: animations.length,
      totalSkins: spineInstance.skeleton.data.skins.length,
      skeleton: skeletonAnalysis,
      animations: animationAnalyses,
      globalMesh: globalMeshAnalysis,
      globalClipping: globalClippingAnalysis,
      globalBlendMode: globalBlendModeAnalysis,
      globalPhysics: globalPhysicsAnalysis,
      medianScore,
      bestAnimation,
      worstAnimation,
      stats
    };
  }

  /**
   * Exports analysis data as JSON
   * @param analysisResult The analysis result to export
   * @returns JSON-serializable analysis data
   */
  static exportJSON(analysisResult: SpineAnalysisResult): object {
    return {
      skeleton: {
        name: analysisResult.skeletonName,
        bones: analysisResult.skeleton.metrics.totalBones,
        maxDepth: analysisResult.skeleton.metrics.maxDepth,
        score: analysisResult.skeleton.metrics.score,
        totalAnimations: analysisResult.totalAnimations,
        totalSkins: analysisResult.totalSkins
      },
      performance: {
        medianScore: analysisResult.medianScore,
        bestAnimation: analysisResult.bestAnimation ? {
          name: analysisResult.bestAnimation.name,
          score: analysisResult.bestAnimation.overallScore
        } : null,
        worstAnimation: analysisResult.worstAnimation ? {
          name: analysisResult.worstAnimation.name,
          score: analysisResult.worstAnimation.overallScore
        } : null
      },
      statistics: analysisResult.stats,
      animations: analysisResult.animations.map(a => ({
        name: a.name,
        duration: a.duration,
        score: a.overallScore,
        metrics: {
          mesh: {
            count: a.meshMetrics.activeMeshCount,
            vertices: a.meshMetrics.totalVertices,
            deformed: a.meshMetrics.deformedMeshCount,
            weighted: a.meshMetrics.weightedMeshCount,
            score: a.meshMetrics.score
          },
          clipping: {
            masks: a.clippingMetrics.activeMaskCount,
            vertices: a.clippingMetrics.totalVertices,
            complex: a.clippingMetrics.complexMasks,
            score: a.clippingMetrics.score
          },
          blendMode: {
            nonNormal: a.blendModeMetrics.activeNonNormalCount,
            additive: a.blendModeMetrics.activeAdditiveCount,
            multiply: a.blendModeMetrics.activeMultiplyCount,
            score: a.blendModeMetrics.score
          },
          constraints: {
            physics: a.constraintMetrics.activePhysicsCount,
            ik: a.constraintMetrics.activeIkCount,
            transform: a.constraintMetrics.activeTransformCount,
            path: a.constraintMetrics.activePathCount,
            total: a.constraintMetrics.totalActiveConstraints,
            score: a.constraintMetrics.score
          }
        }
      }))
    };
  }
}