import { useEffect, useState, useCallback } from 'react';
import { SpineAnalysisResult } from '../core/SpineAnalyzer';

export interface UseBenchmarkPanelResult {
  isVisible: boolean;
  shouldPulsate: boolean;
  score: number | null;
  scoreClass: string;
  handleClick: () => void;
}

export const useBenchmarkPanel = (
  benchmarkData: SpineAnalysisResult | null,
  showBenchmark: boolean,
  setShowBenchmark: (show: boolean) => void
): UseBenchmarkPanelResult => {
  const [isVisible, setIsVisible] = useState(false);
  const [pulsateCount, setPulsateCount] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [scoreClass, setScoreClass] = useState('');

  // Determine if panel should be visible
  useEffect(() => {
    const shouldShowPanel = benchmarkData !== null && !showBenchmark;
    setIsVisible(shouldShowPanel);
    
    // Reset pulsation when visibility changes
    if (shouldShowPanel) {
      setPulsateCount(0);
    }
  }, [benchmarkData, showBenchmark]);

  // Handle pulsation animation - exactly twice
  useEffect(() => {
    if (!isVisible || pulsateCount >= 2) {
      return;
    }

    const timer = setTimeout(() => {
      setPulsateCount(prev => prev + 1);
    }, 500); // Match animation duration

    return () => clearTimeout(timer);
  }, [isVisible, pulsateCount]);

  // Calculate score and class when benchmarkData changes
  useEffect(() => {
    if (benchmarkData) {
      const calculatedScore = benchmarkData.medianScore;
      setScore(calculatedScore);
      
      // Determine score class based on performance
      if (calculatedScore !== null) {
        if (calculatedScore <= 30) {
          setScoreClass('poor');
        } else if (calculatedScore <= 70) {
          setScoreClass('fair');
        } else {
          setScoreClass('good');
        }
      } else {
        setScoreClass('');
      }
    } else {
      setScore(null);
      setScoreClass('');
    }
  }, [benchmarkData]);

  const handleClick = useCallback(() => {
    setShowBenchmark(true);
  }, [setShowBenchmark]);

  return {
    isVisible,
    shouldPulsate: isVisible && pulsateCount < 2,
    score,
    scoreClass,
    handleClick
  };
};