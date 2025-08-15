import React from 'react';
import { useTranslation } from 'react-i18next';
import { SpineAnalysisResult } from '../../core/SpineAnalyzer';
import { getScoreColor } from '../../core/utils/scoreCalculator';
import { PERFORMANCE_FACTORS } from '../../core/constants/performanceFactors';

interface PhysicsAnalysisProps {
  data: SpineAnalysisResult;
}

export const PhysicsAnalysis: React.FC<PhysicsAnalysisProps> = ({ data }) => {
  const { t } = useTranslation();
  
  // Calculate median score for constraints
  const scores = data.animations.map(a => a.constraintMetrics.score);
  const medianScore = scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)] || 100;

  return (
    <div className="physics-analysis">
      <h3>{t('analysis.physics.title')}</h3>
      
      <div className="median-score">
        <h4>Median Performance Score: {medianScore.toFixed(1)}%</h4>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ 
              width: `${medianScore}%`, 
              backgroundColor: getScoreColor(medianScore) 
            }}
          />
        </div>
      </div>

      <h4>Per-Animation Breakdown</h4>
      <table className="benchmark-table">
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
          {data.animations.map((animation) => {
            const c = animation.constraintMetrics;
            const hasPhysics = animation.activeComponents.hasPhysics;
            const hasIK = animation.activeComponents.hasIK;
            const hasTransform = animation.activeComponents.hasTransform;
            const hasPath = animation.activeComponents.hasPath;
            
            const rowClass = c.score < 70 ? 'row-warning' : c.score < 50 ? 'row-danger' : '';
            
            return (
              <tr key={animation.name} className={rowClass}>
                <td>{animation.name}</td>
                <td>{hasPhysics ? `✓ (${c.activePhysicsCount})` : '-'}</td>
                <td>{hasIK ? `✓ (${c.activeIkCount})` : '-'}</td>
                <td>{hasTransform ? `✓ (${c.activeTransformCount})` : '-'}</td>
                <td>{hasPath ? `✓ (${c.activePathCount})` : '-'}</td>
                <td>{c.totalActiveConstraints}</td>
                <td>
                  <div className="inline-score">
                    <span>{c.score.toFixed(1)}%</span>
                    <div className="mini-progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${c.score}%`, 
                          backgroundColor: getScoreColor(c.score) 
                        }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      <ConstraintImpactBreakdown data={data} />
      <ConstraintDetails data={data} />
      
      <div className="analysis-notes">
        <h4>{t('analysis.physics.notes.title')}</h4>
        <ul>
          <li><strong>{t('analysis.physics.constraintTypes.ik')}:</strong> {t('analysis.physics.notes.ikConstraints')}</li>
          <li><strong>{t('analysis.physics.constraintTypes.physics')}:</strong> {t('analysis.physics.notes.physicsConstraints')}</li>
          <li><strong>{t('analysis.physics.constraintTypes.path')}:</strong> {t('analysis.physics.notes.pathConstraints')}</li>
          <li><strong>{t('analysis.physics.constraintTypes.transform')}:</strong> {t('analysis.physics.notes.transformConstraints')}</li>
          <li><strong>{t('analysis.physics.notes.recommendation').split(':')[0]}:</strong> {t('analysis.physics.notes.recommendation').split(':')[1]}</li>
        </ul>
      </div>
    </div>
  );
};

const ConstraintImpactBreakdown: React.FC<{ data: SpineAnalysisResult }> = ({ data }) => {
  const { t } = useTranslation();
  const { metrics } = data.globalPhysics;
  
  return (
    <div className="constraint-summary">
      <h4>{t('analysis.physics.impactBreakdown.title')}</h4>
      <table className="benchmark-table">
        <thead>
          <tr>
            <th>{t('analysis.physics.impactBreakdown.tableHeaders.constraintType')}</th>
            <th>{t('analysis.physics.impactBreakdown.tableHeaders.count')}</th>
            <th>{t('analysis.physics.impactBreakdown.tableHeaders.impactLevel')}</th>
            <th>{t('analysis.physics.impactBreakdown.tableHeaders.weightedImpact')}</th>
          </tr>
        </thead>
        <tbody>
          <tr className={metrics.ikImpact > 50 ? 'row-warning' : ''}>
            <td>{t('analysis.physics.constraintTypes.ik')}</td>
            <td>{metrics.ikCount}</td>
            <td>{metrics.ikImpact.toFixed(1)}%</td>
            <td>{(metrics.ikImpact * PERFORMANCE_FACTORS.IK_WEIGHT).toFixed(1)}%</td>
          </tr>
          <tr className={metrics.transformImpact > 50 ? 'row-warning' : ''}>
            <td>{t('analysis.physics.constraintTypes.transform')}</td>
            <td>{metrics.transformCount}</td>
            <td>{metrics.transformImpact.toFixed(1)}%</td>
            <td>{(metrics.transformImpact * PERFORMANCE_FACTORS.TRANSFORM_WEIGHT).toFixed(1)}%</td>
          </tr>
          <tr className={metrics.pathImpact > 50 ? 'row-warning' : ''}>
            <td>{t('analysis.physics.constraintTypes.path')}</td>
            <td>{metrics.pathCount}</td>
            <td>{metrics.pathImpact.toFixed(1)}%</td>
            <td>{(metrics.pathImpact * PERFORMANCE_FACTORS.PATH_WEIGHT).toFixed(1)}%</td>
          </tr>
          <tr className={metrics.physicsImpact > 50 ? 'row-warning' : ''}>
            <td>{t('analysis.physics.constraintTypes.physics')}</td>
            <td>{metrics.physicsCount}</td>
            <td>{metrics.physicsImpact.toFixed(1)}%</td>
            <td>{(metrics.physicsImpact * PERFORMANCE_FACTORS.PHYSICS_WEIGHT).toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const ConstraintDetails: React.FC<{ data: SpineAnalysisResult }> = ({ data }) => {
  const { t } = useTranslation();
  const { ikConstraints, transformConstraints, pathConstraints, physicsConstraints } = data.globalPhysics;
  
  if (data.globalPhysics.metrics.totalConstraints === 0) {
    return <p>{t('analysis.physics.noConstraints')}</p>;
  }
  
  return (
    <>
      {ikConstraints.length > 0 && <IkConstraintsTable constraints={ikConstraints} />}
      {transformConstraints.length > 0 && <TransformConstraintsTable constraints={transformConstraints} />}
      {pathConstraints.length > 0 && <PathConstraintsTable constraints={pathConstraints} />}
      {physicsConstraints.length > 0 && <PhysicsConstraintsTable constraints={physicsConstraints} />}
    </>
  );
};

const IkConstraintsTable: React.FC<{ constraints: any[] }> = ({ constraints }) => {
  const { t } = useTranslation();
  
  return (
    <div className="constraint-details">
      <h4>{t('analysis.physics.constraintDetails.ikConstraints.title')}</h4>
      <table className="benchmark-table">
        <thead>
          <tr>
            <th>{t('analysis.physics.constraintDetails.ikConstraints.tableHeaders.name')}</th>
            <th>{t('analysis.physics.constraintDetails.ikConstraints.tableHeaders.target')}</th>
            <th>{t('analysis.physics.constraintDetails.ikConstraints.tableHeaders.bones')}</th>
            <th>{t('analysis.physics.constraintDetails.ikConstraints.tableHeaders.mix')}</th>
            <th>{t('analysis.physics.constraintDetails.ikConstraints.tableHeaders.status')}</th>
          </tr>
        </thead>
        <tbody>
          {constraints.map((ik) => {
            const complexityClass = ik.bones.length > 2 ? 'row-warning' : '';
            
            return (
              <tr key={ik.name} className={complexityClass}>
                <td>{ik.name}</td>
                <td>{ik.target}</td>
                <td>{ik.bones.join(', ')}</td>
                <td>{ik.mix.toFixed(2)}</td>
                <td>{ik.isActive ? t('analysis.physics.status.active') : t('analysis.physics.status.inactive')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const TransformConstraintsTable: React.FC<{ constraints: any[] }> = ({ constraints }) => {
  const { t } = useTranslation();
  
  return (
    <div className="constraint-details">
      <h4>{t('analysis.physics.constraintDetails.transformConstraints.title')}</h4>
      <table className="benchmark-table">
        <thead>
          <tr>
            <th>{t('analysis.physics.constraintDetails.transformConstraints.tableHeaders.name')}</th>
            <th>{t('analysis.physics.constraintDetails.transformConstraints.tableHeaders.target')}</th>
            <th>{t('analysis.physics.constraintDetails.transformConstraints.tableHeaders.bones')}</th>
            <th>{t('analysis.physics.constraintDetails.transformConstraints.tableHeaders.properties')}</th>
            <th>{t('analysis.physics.constraintDetails.transformConstraints.tableHeaders.status')}</th>
          </tr>
        </thead>
        <tbody>
          {constraints.map((tc) => {
            const props = [];
            if (tc.mixRotate > 0) props.push(`${t('analysis.physics.properties.rotate')}: ${tc.mixRotate.toFixed(2)}`);
            if (tc.mixX > 0) props.push(`${t('analysis.physics.properties.x')}: ${tc.mixX.toFixed(2)}`);
            if (tc.mixY > 0) props.push(`${t('analysis.physics.properties.y')}: ${tc.mixY.toFixed(2)}`);
            if (tc.mixScaleX > 0) props.push(`${t('analysis.physics.properties.scaleX')}: ${tc.mixScaleX.toFixed(2)}`);
            if (tc.mixScaleY > 0) props.push(`${t('analysis.physics.properties.scaleY')}: ${tc.mixScaleY.toFixed(2)}`);
            if (tc.mixShearY > 0) props.push(`${t('analysis.physics.properties.shearY')}: ${tc.mixShearY.toFixed(2)}`);
            
            const complexityClass = props.length > 3 ? 'row-warning' : '';
            
            return (
              <tr key={tc.name} className={complexityClass}>
                <td>{tc.name}</td>
                <td>{tc.target}</td>
                <td>{tc.bones.join(', ')}</td>
                <td>{props.join(', ')}</td>
                <td>{tc.isActive ? t('analysis.physics.status.active') : t('analysis.physics.status.inactive')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const PathConstraintsTable: React.FC<{ constraints: any[] }> = ({ constraints }) => {
  const { t } = useTranslation();
  
  const getRotateModeName = (mode: number): string => {
    switch(mode) {
      case 0: return t('analysis.physics.modes.rotate.tangent');
      case 1: return t('analysis.physics.modes.rotate.chain');
      case 2: return t('analysis.physics.modes.rotate.chainScale');
      default: return `Unknown (${mode})`;
    }
  };
  
  const getSpacingModeName = (mode: number): string => {
    switch(mode) {
      case 0: return t('analysis.physics.modes.spacing.length');
      case 1: return t('analysis.physics.modes.spacing.fixed');
      case 2: return t('analysis.physics.modes.spacing.percent');
      case 3: return t('analysis.physics.modes.spacing.proportional');
      default: return `Unknown (${mode})`;
    }
  };
  
  return (
    <div className="constraint-details">
      <h4>{t('analysis.physics.constraintDetails.pathConstraints.title')}</h4>
      <table className="benchmark-table">
        <thead>
          <tr>
            <th>{t('analysis.physics.constraintDetails.pathConstraints.tableHeaders.name')}</th>
            <th>{t('analysis.physics.constraintDetails.pathConstraints.tableHeaders.target')}</th>
            <th>{t('analysis.physics.constraintDetails.pathConstraints.tableHeaders.bones')}</th>
            <th>{t('analysis.physics.constraintDetails.pathConstraints.tableHeaders.modes')}</th>
            <th>{t('analysis.physics.constraintDetails.pathConstraints.tableHeaders.status')}</th>
          </tr>
        </thead>
        <tbody>
          {constraints.map((p) => {
            const complexityClass = (p.rotateMode === 2 || p.bones.length > 3) ? 'row-warning' : '';
            
            return (
              <tr key={p.name} className={complexityClass}>
                <td>{p.name}</td>
                <td>{p.target}</td>
                <td>{p.bones.join(', ')}</td>
                <td>
                  {t('analysis.physics.properties.rotate')}: {getRotateModeName(p.rotateMode)}, 
                  Spacing: {getSpacingModeName(p.spacingMode)}
                </td>
                <td>{p.isActive ? t('analysis.physics.status.active') : t('analysis.physics.status.inactive')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const PhysicsConstraintsTable: React.FC<{ constraints: any[] }> = ({ constraints }) => {
  const { t } = useTranslation();
  
  return (
    <div className="constraint-details">
      <h4>{t('analysis.physics.constraintDetails.physicsConstraints.title')}</h4>
      <table className="benchmark-table">
        <thead>
          <tr>
            <th>{t('analysis.physics.constraintDetails.physicsConstraints.tableHeaders.name')}</th>
            <th>{t('analysis.physics.constraintDetails.physicsConstraints.tableHeaders.bone')}</th>
            <th>{t('analysis.physics.constraintDetails.physicsConstraints.tableHeaders.properties')}</th>
            <th>{t('analysis.physics.constraintDetails.physicsConstraints.tableHeaders.parameters')}</th>
            <th>{t('analysis.physics.constraintDetails.physicsConstraints.tableHeaders.status')}</th>
          </tr>
        </thead>
        <tbody>
          {constraints.map((p) => {
            const props = [];
            if (p.affectsX) props.push(t('analysis.physics.properties.x'));
            if (p.affectsY) props.push(t('analysis.physics.properties.y'));
            if (p.affectsRotation) props.push(t('analysis.physics.properties.rotation'));
            if (p.affectsScale) props.push(t('analysis.physics.properties.scale'));
            if (p.affectsShear) props.push(t('analysis.physics.properties.shear'));
            
            const params = [
              `${t('analysis.physics.parameters.inertia')}: ${p.inertia.toFixed(2)}`,
              `${t('analysis.physics.parameters.strength')}: ${p.strength.toFixed(2)}`,
              `${t('analysis.physics.parameters.damping')}: ${p.damping.toFixed(2)}`
            ];
            
            if (p.wind !== 0) params.push(`${t('analysis.physics.parameters.wind')}: ${p.wind.toFixed(2)}`);
            if (p.gravity !== 0) params.push(`${t('analysis.physics.parameters.gravity')}: ${p.gravity.toFixed(2)}`);
            
            const complexityClass = props.length > 2 ? 'row-warning' : '';
            
            return (
              <tr key={p.name} className={complexityClass}>
                <td>{p.name}</td>
                <td>{p.bone}</td>
                <td>{props.join(', ')}</td>
                <td>{params.join(', ')}</td>
                <td>{p.isActive ? t('analysis.physics.status.active') : t('analysis.physics.status.inactive')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};