import { Spine } from "@esotericsoftware/spine-pixi-v8";
import { BenchmarkData } from "../hooks/useSpineApp";
import { analyzeMeshesForAnimation } from "./analyzers/meshAnalyzer";
import { analyzeClippingForAnimation } from "./analyzers/clippingAnalyzer";
import { analyzeBlendModesForAnimation } from "./analyzers/blendModeAnalyzer";
import { createSkeletonTree } from "./analyzers/skeletonAnalyzer";
import { analyzePhysicsForAnimation } from "./analyzers/physicsAnalyzer";
import { PERFORMANCE_FACTORS } from "./constants/performanceFactors";
import { calculateOverallScore } from "./utils/scoreCalculator";
import { generateAnimationSummary } from "./generators/summaryGenerator";
import { getActiveComponentsForAnimation } from "./utils/animationUtils";

export interface AnimationAnalysis {
  name: string;
  duration: number;
  overallScore: number;
  meshMetrics: any;
  clippingMetrics: any;
  blendModeMetrics: any;
  constraintMetrics: any;
  activeComponents: {
    slots: Set<string>;
    meshes: Set<string>;
    hasClipping: boolean;
    hasBlendModes: boolean;
    hasPhysics: boolean;
    hasIK: boolean;
    hasTransform: boolean;
    hasPath: boolean;
  };
}

export interface PerAnimationBenchmarkData extends BenchmarkData {
  animationAnalyses: AnimationAnalysis[];
  medianScore: number;
}

/**
 * Main SpineAnalyzer class that coordinates analysis of Spine instances
 */
export class SpineAnalyzer {
  /**
   * Analyzes a Spine instance with per-animation breakdown
   * @param spineInstance The Spine instance to analyze
   * @returns Benchmark data with per-animation analysis
   */
  static analyze(spineInstance: Spine): PerAnimationBenchmarkData {
    const animations = spineInstance.skeleton.data.animations;
    const animationAnalyses: AnimationAnalysis[] = [];

    console.log(`Analyzing ${animations.length} animations...`);

    // Analyze skeleton structure (common for all animations)
    const skeletonAnalysisResults = createSkeletonTree(spineInstance);
    const { html: skeletonTree, metrics: boneMetrics } = skeletonAnalysisResults;

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
        boneScore: boneMetrics.score, // Bone score is same for all animations
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

    // Generate summary with per-animation data
    const summary = generateAnimationSummary(
      spineInstance,
      boneMetrics,
      animationAnalyses,
      medianScore
    );

    // Generate detailed HTML for each component type
    const meshAnalysis = generateMeshAnalysisHTML(animationAnalyses);
    const clippingAnalysis = generateClippingAnalysisHTML(animationAnalyses);
    const blendModeAnalysis = generateBlendModeAnalysisHTML(animationAnalyses);
    const physicsAnalysis = generatePhysicsAnalysisHTML(animationAnalyses);

    // Return all analysis data
    return {
      meshAnalysis,
      clippingAnalysis,
      blendModeAnalysis,
      skeletonTree,
      physicsAnalysis,
      summary,
      animationAnalyses,
      medianScore
    };
  }
}

/**
 * Generate HTML for mesh analysis with per-animation breakdown
 */
function generateMeshAnalysisHTML(analyses: AnimationAnalysis[]): string {
  const scores = analyses.map(a => a.meshMetrics.score);
  const medianScore = scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)] || 100;

  let html = `
    <div class="mesh-analysis">
      <h3>Mesh Analysis</h3>
      <div class="median-score">
        <h4>Median Performance Score: ${medianScore.toFixed(1)}%</h4>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${medianScore}%; background-color: ${getScoreColor(medianScore)};"></div>
        </div>
      </div>

      <h4>Per-Animation Breakdown</h4>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>Animation</th>
            <th>Active Meshes</th>
            <th>Total Vertices</th>
            <th>Deformed</th>
            <th>Weighted</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
  `;

  analyses.forEach(analysis => {
    const m = analysis.meshMetrics;
    const rowClass = m.score < 70 ? 'row-warning' : m.score < 50 ? 'row-danger' : '';
    
    html += `
      <tr class="${rowClass}">
        <td>${analysis.name}</td>
        <td>${m.activeMeshCount}</td>
        <td>${m.totalVertices}</td>
        <td>${m.deformedMeshCount}</td>
        <td>${m.weightedMeshCount}</td>
        <td>
          <div class="inline-score">
            <span>${m.score.toFixed(1)}%</span>
            <div class="mini-progress-bar">
              <div class="progress-fill" style="width: ${m.score}%; background-color: ${getScoreColor(m.score)};"></div>
            </div>
          </div>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      
      <div class="analysis-notes">
        <h4>Notes</h4>
        <ul>
          <li><strong>Active Meshes:</strong> Only meshes that are actually rendered or transformed in each animation are counted.</li>
          <li><strong>Vertex Count:</strong> Higher vertex counts require more GPU processing.</li>
          <li><strong>Deformation:</strong> Meshes that change shape during animation have additional CPU cost.</li>
          <li><strong>Weighted Meshes:</strong> Meshes influenced by multiple bones are more expensive to compute.</li>
        </ul>
      </div>
    </div>
  `;

  return html;
}

/**
 * Generate HTML for clipping analysis with per-animation breakdown
 */
function generateClippingAnalysisHTML(analyses: AnimationAnalysis[]): string {
  const scores = analyses.map(a => a.clippingMetrics.score);
  const medianScore = scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)] || 100;

  let html = `
    <div class="clipping-analysis">
      <h3>Clipping Analysis</h3>
      <div class="median-score">
        <h4>Median Performance Score: ${medianScore.toFixed(1)}%</h4>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${medianScore}%; background-color: ${getScoreColor(medianScore)};"></div>
        </div>
      </div>

      <h4>Per-Animation Breakdown</h4>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>Animation</th>
            <th>Has Clipping</th>
            <th>Active Masks</th>
            <th>Total Vertices</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
  `;

  analyses.forEach(analysis => {
    const c = analysis.clippingMetrics;
    const rowClass = c.score < 70 ? 'row-warning' : c.score < 50 ? 'row-danger' : '';
    
    html += `
      <tr class="${rowClass}">
        <td>${analysis.name}</td>
        <td>${analysis.activeComponents.hasClipping ? 'Yes' : 'No'}</td>
        <td>${c.activeMaskCount}</td>
        <td>${c.totalVertices}</td>
        <td>
          <div class="inline-score">
            <span>${c.score.toFixed(1)}%</span>
            <div class="mini-progress-bar">
              <div class="progress-fill" style="width: ${c.score}%; background-color: ${getScoreColor(c.score)};"></div>
            </div>
          </div>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      
      <div class="analysis-notes">
        <h4>Notes</h4>
        <ul>
          <li><strong>Clipping Impact:</strong> Clipping masks are expensive GPU operations that should be minimized.</li>
          <li><strong>Active Masks:</strong> Only masks used by visible slots in each animation are counted.</li>
          <li><strong>Optimization:</strong> Consider using alpha blending or pre-rendered masks instead of runtime clipping.</li>
        </ul>
      </div>
    </div>
  `;

  return html;
}

/**
 * Generate HTML for blend mode analysis with per-animation breakdown
 */
function generateBlendModeAnalysisHTML(analyses: AnimationAnalysis[]): string {
  const scores = analyses.map(a => a.blendModeMetrics.score);
  const medianScore = scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)] || 100;

  let html = `
    <div class="blend-mode-analysis">
      <h3>Blend Mode Analysis</h3>
      <div class="median-score">
        <h4>Median Performance Score: ${medianScore.toFixed(1)}%</h4>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${medianScore}%; background-color: ${getScoreColor(medianScore)};"></div>
        </div>
      </div>

      <h4>Per-Animation Breakdown</h4>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>Animation</th>
            <th>Has Blend Modes</th>
            <th>Non-Normal</th>
            <th>Additive</th>
            <th>Multiply</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
  `;

  analyses.forEach(analysis => {
    const b = analysis.blendModeMetrics;
    const rowClass = b.score < 70 ? 'row-warning' : b.score < 50 ? 'row-danger' : '';
    
    html += `
      <tr class="${rowClass}">
        <td>${analysis.name}</td>
        <td>${analysis.activeComponents.hasBlendModes ? 'Yes' : 'No'}</td>
        <td>${b.activeNonNormalCount}</td>
        <td>${b.activeAdditiveCount}</td>
        <td>${b.activeMultiplyCount}</td>
        <td>
          <div class="inline-score">
            <span>${b.score.toFixed(1)}%</span>
            <div class="mini-progress-bar">
              <div class="progress-fill" style="width: ${b.score}%; background-color: ${getScoreColor(b.score)};"></div>
            </div>
          </div>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      
      <div class="analysis-notes">
        <h4>Notes</h4>
        <ul>
          <li><strong>Blend Mode Impact:</strong> Non-normal blend modes require additional GPU render passes.</li>
          <li><strong>Active Blend Modes:</strong> Only blend modes on visible slots in each animation are counted.</li>
          <li><strong>Optimization:</strong> Use normal blend mode when possible, pre-composite effects for static elements.</li>
        </ul>
      </div>
    </div>
  `;

  return html;
}

/**
 * Generate HTML for physics/constraints analysis with per-animation breakdown
 */
function generatePhysicsAnalysisHTML(analyses: AnimationAnalysis[]): string {
  const scores = analyses.map(a => a.constraintMetrics.score);
  const medianScore = scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)] || 100;

  let html = `
    <div class="physics-analysis">
      <h3>Physics & Constraints Analysis</h3>
      <div class="median-score">
        <h4>Median Performance Score: ${medianScore.toFixed(1)}%</h4>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${medianScore}%; background-color: ${getScoreColor(medianScore)};"></div>
        </div>
      </div>

      <h4>Per-Animation Breakdown</h4>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>Animation</th>
            <th>Physics</th>
            <th>IK</th>
            <th>Transform</th>
            <th>Path</th>
            <th>Total Active</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
  `;

  analyses.forEach(analysis => {
    const c = analysis.constraintMetrics;
    const hasPhysics = analysis.activeComponents.hasPhysics;
    const hasIK = analysis.activeComponents.hasIK;
    const hasTransform = analysis.activeComponents.hasTransform;
    const hasPath = analysis.activeComponents.hasPath;
    
    const rowClass = c.score < 70 ? 'row-warning' : c.score < 50 ? 'row-danger' : '';
    
    html += `
      <tr class="${rowClass}">
        <td>${analysis.name}</td>
        <td>${hasPhysics ? `✓ (${c.activePhysicsCount})` : '-'}</td>
        <td>${hasIK ? `✓ (${c.activeIkCount})` : '-'}</td>
        <td>${hasTransform ? `✓ (${c.activeTransformCount})` : '-'}</td>
        <td>${hasPath ? `✓ (${c.activePathCount})` : '-'}</td>
        <td>${c.totalActiveConstraints}</td>
        <td>
          <div class="inline-score">
            <span>${c.score.toFixed(1)}%</span>
            <div class="mini-progress-bar">
              <div class="progress-fill" style="width: ${c.score}%; background-color: ${getScoreColor(c.score)};"></div>
            </div>
          </div>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      
      <div class="analysis-notes">
        <h4>Notes</h4>
        <ul>
          <li><strong>Physics Constraints:</strong> Most expensive - real-time physics simulation every frame.</li>
          <li><strong>IK Constraints:</strong> Moderate cost - inverse kinematics calculations for bone chains.</li>
          <li><strong>Transform Constraints:</strong> Low cost - simple transform copying between bones.</li>
          <li><strong>Path Constraints:</strong> Variable cost - depends on path complexity and bone count.</li>
          <li><strong>Active Only:</strong> Only constraints that affect visible bones in each animation are counted.</li>
        </ul>
      </div>
    </div>
  `;

  return html;
}

function getScoreColor(score: number): string {
  if (score >= 85) return '#4caf50';
  if (score >= 70) return '#8bc34a';
  if (score >= 55) return '#ffb300';
  if (score >= 40) return '#f57c00';
  return '#e53935';
}