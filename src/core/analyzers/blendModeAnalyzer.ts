import { Animation, BlendMode, Spine } from "@esotericsoftware/spine-pixi-v8";
import { PERFORMANCE_FACTORS } from "../constants/performanceFactors";
import { calculateBlendModeScore, getScoreColor } from "../utils/scoreCalculator";
import { ActiveComponents } from "../utils/animationUtils";
import i18n from "../../i18n";

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
): any {
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
 * Original function for global blend mode analysis (kept for backward compatibility)
 */
export function analyzeBlendModes(spineInstance: Spine): { html: string, metrics: any } {
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
  
  const metrics = {
    nonNormalBlendModeCount: slotsWithNonNormalBlendMode.size,
    additiveCount,
    multiplyCount,
    score: blendModeScore
  };
  let html = `
    <div class="blend-mode-analysis">
      <h3>${i18n.t('analysis.blendMode.title')}</h3>
      <p>${i18n.t('analysis.blendMode.statistics.nonNormalBlendModes', { count: slotsWithNonNormalBlendMode.size })}</p>
      <p>${i18n.t('analysis.blendMode.statistics.additiveBlendModes', { count: additiveCount })}</p>
      <p>${i18n.t('analysis.blendMode.statistics.multiplyBlendModes', { count: multiplyCount })}</p>
      
      <div class="performance-score">
        <h4>${i18n.t('analysis.blendMode.performanceScore.title', { score: blendModeScore.toFixed(1) })}</h4>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${blendModeScore}%; background-color: ${getScoreColor(blendModeScore)};"></div>
        </div>
      </div>
      
      <div class="analysis-metrics">
        <p><strong>${i18n.t('analysis.blendMode.formula.title')}</strong></p>
        <code>${i18n.t('analysis.blendMode.formula.description', { idealBlendModeCount: PERFORMANCE_FACTORS.IDEAL_BLEND_MODE_COUNT })}</code>
      </div>
      
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>${i18n.t('analysis.blendMode.tableHeaders.blendMode')}</th>
            <th>${i18n.t('analysis.blendMode.tableHeaders.count')}</th>
          </tr>
        </thead>
        <tbody>
        <tbody>
  `;
  
  // Sort by frequency
  const sortedCounts = Array.from(blendModeCount.entries())
    .sort((a, b) => b[1] - a[1]);
  
  sortedCounts.forEach(([mode, count]) => {
    if (count > 0) {
      const modeName = BlendMode[mode];
      const rowClass = mode !== BlendMode.Normal && count > 0 
        ? 'row-warning' 
        : '';
      
      html += `
        <tr class="${rowClass}">
          <td>${modeName}</td>
          <td>${count}</td>
        </tr>
      `;
    }
  });
  
  html += `
        </tbody>
      </table>
  `;
  
  if (slotsWithNonNormalBlendMode.size > 0) {
    html += `
      <h4>${i18n.t('analysis.blendMode.slotsWithNonNormalTitle')}</h4>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>${i18n.t('analysis.blendMode.tableHeaders.slotName')}</th>
            <th>${i18n.t('analysis.blendMode.tableHeaders.blendMode')}</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    slotsWithNonNormalBlendMode.forEach((mode, slotName) => {
      html += `
        <tr>
          <td>${slotName}</td>
          <td>${BlendMode[mode]}</td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
      
      <div class="analysis-notes">
        <h4>${i18n.t('analysis.blendMode.notes.title')}</h4>
        <ul>
          <li><strong>${i18n.t('analysis.blendMode.notes.normalBlendMode')}</strong></li>
          <li><strong>${i18n.t('analysis.blendMode.notes.nonNormalBlendModes')}</strong></li>
          <li><strong>${i18n.t('analysis.blendMode.notes.renderingCost')}</strong></li>
          <li><strong>${i18n.t('analysis.blendMode.notes.additiveBlend')}</strong></li>
          <li><strong>${i18n.t('analysis.blendMode.notes.multiplyBlend')}</strong></li>
          <li><strong>${i18n.t('analysis.blendMode.notes.recommendation')}</strong></li>
        </ul>
      </div>
    `;
  }
  
  html += `</div>`;
  
  return {html, metrics};
}