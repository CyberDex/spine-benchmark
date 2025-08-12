import { Animation, DeformTimeline, MeshAttachment, Spine } from "@esotericsoftware/spine-pixi-v8";
import { PERFORMANCE_FACTORS } from "../constants/performanceFactors";
import { calculateMeshScore, getScoreColor } from "../utils/scoreCalculator";
import { ActiveComponents } from "../utils/animationUtils";
import i18n from "../../i18n";

/**
 * Analyzes mesh attachments for a specific animation
 * @param spineInstance The Spine instance to analyze
 * @param animation The animation to analyze
 * @param activeComponents Components active in this animation
 * @returns Metrics for mesh analysis
 */
export function analyzeMeshesForAnimation(
  spineInstance: Spine,
  animation: Animation,
  activeComponents: ActiveComponents
): any {
  const skeleton = spineInstance.skeleton;
  
  let activeMeshCount = 0;
  let totalVertices = 0;
  let weightedMeshCount = 0;
  let deformedMeshCount = 0;
  
  const deformedMeshes = new Set<string>();
  
  // Check for deformed meshes in this animation
  animation.timelines.forEach(timeline => {
    if (timeline instanceof DeformTimeline) {
      const slotIndex = (timeline as any).slotIndex;
      const slot = skeleton.slots[slotIndex];
      const attachment = (timeline as any).attachment;
      
      if (slot && attachment && attachment instanceof MeshAttachment) {
        deformedMeshes.add(`${slot.data.name}:${attachment.name}`);
      }
    }
  });
  
  console.log(`Analyzing ${activeComponents.meshes.size} active meshes for animation: ${animation.name}`);
  
  // Analyze only active meshes in this animation
  activeComponents.meshes.forEach(meshId => {
    const [slotName, ...attachmentNameParts] = meshId.split(':');
    const attachmentName = attachmentNameParts.join(':'); // Handle attachment names with colons
    const slot = skeleton.slots.find((s: any) => s.data.name === slotName);
    
    if (slot) {
      // Try to get the attachment directly from the slot first
      const currentAttachment = slot.getAttachment();
      let attachment = null;
      
      if (currentAttachment && currentAttachment.name === attachmentName) {
        attachment = currentAttachment;
      } else {
        // Try to get from skeleton data
        attachment = skeleton.getAttachment(slot.data.index, attachmentName);
      }
      
      if (attachment && attachment instanceof MeshAttachment) {
        activeMeshCount++;
        
        // Count vertices
        const vertexCount = attachment.worldVerticesLength / 2;
        totalVertices += vertexCount;
        
        // Check if mesh has bone weights
        if (attachment.bones?.length) {
          weightedMeshCount++;
        }
        
        // Check if mesh is deformed in this animation
        if (deformedMeshes.has(meshId)) {
          deformedMeshCount++;
        }
      }
    }
  });
  
  // Calculate mesh complexity metrics
  const meshComplexityMetrics = {
    activeMeshCount,
    totalMeshCount: activeMeshCount, // For compatibility with score calculator
    totalVertices,
    weightedMeshCount,
    deformedMeshCount,
    avgVerticesPerMesh: activeMeshCount > 0 ? totalVertices / activeMeshCount : 0,
    highVertexMeshes: 0, // Will be calculated if needed
    complexMeshes: 0,    // Will be calculated if needed
    score: 0
  };
  
  // Calculate mesh score
  const meshScore = calculateMeshScore(meshComplexityMetrics);
  meshComplexityMetrics.score = meshScore;
  
  return meshComplexityMetrics;
}

/**
 * Original function for global mesh analysis (kept for backward compatibility)
 */
export function analyzeMeshes(spineInstance: Spine): { html: string, metrics: any } {
  const skeleton = spineInstance.skeleton;
  const animations = spineInstance.skeleton.data.animations;

  let totalMeshCount = 0;
  let totalVertices = 0;
  let weightedMeshCount = 0;
  let deformedMeshCount = 0;
  
  const meshesWithChangesInTimelines = new Map();
  const meshWorldVerticesLengths = new Map<string, number>();
  const meshesWithBoneWeights = new Map<string, number>();
  const meshesWithParents = new Map<string, boolean>();
  
  // Count total meshes and analyze properties
  skeleton.slots.forEach((slot) => {
    const attachment = slot.getAttachment();
    if (attachment && attachment instanceof MeshAttachment) {
      totalMeshCount++;
      
      // Count vertices
      const vertexCount = attachment.worldVerticesLength / 2;
      totalVertices += vertexCount;
      meshWorldVerticesLengths.set(slot.data.name, vertexCount);
      
      // Track meshes with bone weights
      if (attachment.bones?.length) {
        weightedMeshCount++;
        meshesWithBoneWeights.set(slot.data.name, attachment.bones.length);
      }
      
      meshesWithChangesInTimelines.set(slot.data.name, false);
      meshesWithParents.set(slot.data.name, attachment.getParentMesh() != null);
    }
  });
  
  // Analyze animations for mesh changes
  animations.forEach((animation) => {
    const timelines = animation.timelines;
    timelines.forEach((timeline) => {
      if (timeline instanceof DeformTimeline) {
        const slotIndex = timeline.slotIndex;
        const slot = skeleton.slots[slotIndex];
        const attachment = slot.getAttachment();
        
        if (attachment && attachment instanceof MeshAttachment) {
          if (!meshesWithChangesInTimelines.get(slot.data.name)) {
            deformedMeshCount++;
            meshesWithChangesInTimelines.set(slot.data.name, true);
          }
        }
      }
    });
  });
  
  // Convert to array for easier rendering in table
  const meshData = Array.from(meshWorldVerticesLengths.keys()).map(key => ({
    slotName: key,
    vertices: meshWorldVerticesLengths.get(key) || 0,
    isDeformed: meshesWithChangesInTimelines.get(key) || false,
    boneWeights: meshesWithBoneWeights.get(key) || 0,
    hasParentMesh: meshesWithParents.get(key) || false
  }));
  
  // Sort by vertex count descending
  meshData.sort((a, b) => b.vertices - a.vertices);
  
  // Calculate mesh complexity metrics for performance score
  const meshComplexityMetrics = {
    totalMeshCount,
    totalVertices,
    weightedMeshCount,
    deformedMeshCount,
    avgVerticesPerMesh: totalMeshCount > 0 ? totalVertices / totalMeshCount : 0,
    highVertexMeshes: meshData.filter(mesh => mesh.vertices > 50).length,
    complexMeshes: meshData.filter(mesh => mesh.vertices > 20 && (mesh.isDeformed || mesh.boneWeights > 0)).length,
    score: 0
  };
  
  // Calculate mesh score using logarithmic scale
  const meshScore = calculateMeshScore(meshComplexityMetrics);
  meshComplexityMetrics.score = meshScore;
  
  // Generate HTML for table
  let html = `
    <div class="mesh-analysis">
      <h3>${i18n.t('analysis.mesh.title')}</h3>
      <p>${i18n.t('analysis.mesh.statistics.totalMeshes', { count: totalMeshCount })}</p>
      <p>${i18n.t('analysis.mesh.statistics.totalVertices', { count: totalVertices })}</p>
      <p>${i18n.t('analysis.mesh.statistics.meshesWithDeformation', { count: deformedMeshCount })}</p>
      <p>${i18n.t('analysis.mesh.statistics.meshesWithBoneWeights', { count: weightedMeshCount })}</p>
      <p>${i18n.t('analysis.mesh.statistics.meshesWithParentMesh', { count: Array.from(meshesWithParents.values()).filter(Boolean).length })}</p>
      
      <div class="performance-score">
        <h4>${i18n.t('analysis.mesh.performanceScore.title', { score: meshScore.toFixed(1) })}</h4>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${meshScore}%; background-color: ${getScoreColor(meshScore)};"></div>
        </div>
      </div>
      
      <div class="analysis-metrics">
        <p><strong>${i18n.t('analysis.mesh.formula.title')}</strong></p>
        <code>${i18n.t('analysis.mesh.formula.description', { 
          idealMeshCount: PERFORMANCE_FACTORS.IDEAL_MESH_COUNT,
          idealVertexCount: PERFORMANCE_FACTORS.IDEAL_VERTEX_COUNT,
          deformedFactor: PERFORMANCE_FACTORS.MESH_DEFORMED_FACTOR,
          weightedFactor: PERFORMANCE_FACTORS.MESH_WEIGHTED_FACTOR
        })}</code>
      </div>
      
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>${i18n.t('analysis.mesh.tableHeaders.slot')}</th>
            <th>${i18n.t('analysis.mesh.tableHeaders.vertices')}</th>
            <th>${i18n.t('analysis.mesh.tableHeaders.deformed')}</th>
            <th>${i18n.t('analysis.mesh.tableHeaders.boneWeights')}</th>
            <th>${i18n.t('analysis.mesh.tableHeaders.hasParentMesh')}</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  meshData.forEach(item => {
    // Determine row color based on vertex count and deformation
    let rowClass = '';
    if (item.vertices > 100 || (item.vertices > 50 && item.isDeformed)) {
      rowClass = 'row-danger';
    } else if (item.vertices > 50 || (item.vertices > 20 && item.isDeformed)) {
      rowClass = 'row-warning';
    }
    
    html += `
      <tr class="${rowClass}">
        <td>${item.slotName}</td>
        <td>${item.vertices}</td>
        <td>${item.isDeformed ? i18n.t('analysis.mesh.values.yes') : i18n.t('analysis.mesh.values.no')}</td>
        <td>${item.boneWeights}</td>
        <td>${item.hasParentMesh ? i18n.t('analysis.mesh.values.yes') : i18n.t('analysis.mesh.values.no')}</td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
      
      <div class="analysis-notes">
        <h4>${i18n.t('analysis.mesh.notes.title')}</h4>
        <ul>
          <li><strong>${i18n.t('analysis.mesh.notes.vertexCount')}</strong></li>
          <li><strong>${i18n.t('analysis.mesh.notes.deformation', { factor: PERFORMANCE_FACTORS.MESH_DEFORMED_FACTOR })}</strong></li>
          <li><strong>${i18n.t('analysis.mesh.notes.boneWeights', { factor: PERFORMANCE_FACTORS.MESH_WEIGHTED_FACTOR })}</strong></li>
          <li><strong>${i18n.t('analysis.mesh.notes.optimizationTip')}</strong></li>
        </ul>
      </div>
    </div>
  `;
  
  return {html, metrics: meshComplexityMetrics};
}