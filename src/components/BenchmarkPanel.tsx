import React, { useEffect, useState } from 'react';
import { useBenchmarkPanel } from '../hooks/useBenchmarkPanel';
import { SpineAnalysisResult } from '../core/SpineAnalyzer';
import './BenchmarkPanel.css';

interface BenchmarkPanelProps {
  benchmarkData: SpineAnalysisResult | null;
  showBenchmark: boolean;
  setShowBenchmark: (show: boolean) => void;
}

export const BenchmarkPanel: React.FC<BenchmarkPanelProps> = ({
  benchmarkData,
  showBenchmark,
  setShowBenchmark
}) => {
  const {
    isVisible,
    shouldPulsate,
    score,
    scoreClass,
    handleClick
  } = useBenchmarkPanel(benchmarkData, showBenchmark, setShowBenchmark);

  const [isAnimating, setIsAnimating] = useState(false);

  // Handle pulsation animation trigger
  useEffect(() => {
    if (shouldPulsate) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 500); // Match animation duration
      
      return () => clearTimeout(timer);
    }
  }, [shouldPulsate]);

  if (!isVisible || score === null) {
    return null;
  }

  return (
    <div 
      className={`benchmark-panel ${isAnimating ? 'pulsate' : ''}`}
      onClick={handleClick}
      role="button"
      aria-label="Open benchmark information"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className={`benchmark-score ${scoreClass}`}>
        {Math.round(score)}
      </div>
    </div>
  );
};