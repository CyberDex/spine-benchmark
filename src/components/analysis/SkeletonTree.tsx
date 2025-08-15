import React from 'react';
import { useTranslation } from 'react-i18next';
import { SpineAnalysisResult } from '../../core/SpineAnalyzer';
import { BoneNode } from '../../core/analyzers/skeletonAnalyzer';
import { getScoreColor } from '../../core/utils/scoreCalculator';
import { PERFORMANCE_FACTORS } from '../../core/constants/performanceFactors';

interface SkeletonTreeProps {
  data: SpineAnalysisResult;
}

export const SkeletonTree: React.FC<SkeletonTreeProps> = ({ data }) => {
  const { t } = useTranslation();
  const { skeleton } = data;
  const { boneTree, metrics } = skeleton;
  
  return (
    <div className="skeleton-tree-container">
      <h3>{t('analysis.skeleton.title')}</h3>
      <p>{t('analysis.skeleton.statistics.totalBones', { count: metrics.totalBones })}</p>
      <p>{t('analysis.skeleton.statistics.rootBones', { count: metrics.rootBones })}</p>
      <p>{t('analysis.skeleton.statistics.maxDepth', { depth: metrics.maxDepth })}</p>
      
      <div className="performance-score">
        <h4>{t('analysis.skeleton.performanceScore.title', { score: metrics.score.toFixed(1) })}</h4>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ 
              width: `${metrics.score}%`, 
              backgroundColor: getScoreColor(metrics.score) 
            }}
          />
        </div>
      </div>
      
      <div className="analysis-metrics">
        <p><strong>{t('analysis.skeleton.formula.title')}</strong></p>
        <code>
          {t('analysis.skeleton.formula.description', { 
            idealBoneCount: PERFORMANCE_FACTORS.IDEAL_BONE_COUNT,
            depthFactor: PERFORMANCE_FACTORS.BONE_DEPTH_FACTOR
          })}
        </code>
      </div>
      
      <div className="tree-view">
        <BoneTreeView nodes={boneTree} />
      </div>
      
      <div className="analysis-notes">
        <h4>{t('analysis.skeleton.notes.title')}</h4>
        <ul>
          <li><strong>{t('analysis.skeleton.notes.boneCount')}</strong></li>
          <li><strong>{t('analysis.skeleton.notes.hierarchyDepth')}</strong></li>
          <li><strong>{t('analysis.skeleton.notes.recommendation')}</strong></li>
          <li><strong>{t('analysis.skeleton.notes.optimalStructure')}</strong></li>
        </ul>
      </div>
    </div>
  );
};

const BoneTreeView: React.FC<{ nodes: BoneNode[] }> = ({ nodes }) => {
  const { t } = useTranslation();
  
  if (nodes.length === 0) {
    return null;
  }
  
  return (
    <ul className="skeleton-tree">
      {nodes.map((node) => (
        <li key={node.name} className="tree-node">
          <span className="node-label">
            {t('analysis.skeleton.nodeLabel', { 
              name: node.name, 
              x: node.x, 
              y: node.y 
            })}
          </span>
          {node.children && node.children.length > 0 && (
            <BoneTreeView nodes={node.children} />
          )}
        </li>
      ))}
    </ul>
  );
};