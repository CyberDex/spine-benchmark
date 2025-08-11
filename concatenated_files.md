

## src\App.tsx

```
import { Application } from 'pixi.js';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useTranslation } from 'react-i18next';
import { AnimationControls } from './components/AnimationControls';
import { InfoPanel } from './components/InfoPanel';
import { CommandPalette } from './components/CommandPalette';
import { VersionDisplay } from './components/VersionDisplay';
import { LanguageModal } from './components/LanguageModal';
import { useToast } from './hooks/ToastContext';
import { useSafeLocalStorage } from './hooks/useSafeLocalStorage';
import { useSpineApp } from './hooks/useSpineApp';
import { useCommandRegistration } from './hooks/useCommandRegistration';
import { useUrlHash } from './hooks/useUrlHash';
    const App: React.FC = () => {
      const { t } = useTranslation();
      const [app, setApp] = useState<Application | null>(null);
      const canvasRef = useRef<HTMLCanvasElement>(null);
      const [showBenchmark, setShowBenchmark] = useState(false);
      const [showLanguageModal, setShowLanguageModal] = useState(false);
    
      // Debug log for language modal state changes
      useEffect(() => {
        console.log('🏠 App: Language modal state changed:', showLanguageModal);
      }, [showLanguageModal]);
    
      // Enhanced setShowLanguageModal with additional logging
      const setShowLanguageModalWithLogging = (show: boolean) => {
        console.log('🏠 App: setShowLanguageModal called with:', show);
        console.log('🏠 App: Current modal state before change:', showLanguageModal);
        setShowLanguageModal(show);
        console.log('🏠 App: setShowLanguageModal completed');
      };
      const [backgroundColor, setBackgroundColor] = useSafeLocalStorage('spine-benchmark-bg-color', '#282b30');
      const [isLoading, setIsLoading] = useState(false);
      const [currentAnimation, setCurrentAnimation] = useState('');
      const { addToast } = useToast();
      const { updateHash, getStateFromHash, onHashChange } = useUrlHash();
  const {
    spineInstance,
    loadSpineFiles,
    isLoading: spineLoading,
    benchmarkData,
    meshesVisible,
    physicsVisible,
    ikVisible,
    toggleMeshes,
    togglePhysics,
    toggleIk
  } = useSpineApp(app);


  // Check initial hash state for benchmark panel
  useEffect(() => {
    const hashState = getStateFromHash();
    if (hashState.benchmarkInfo) {
      setShowBenchmark(true);
    }
  }, [getStateFromHash]);

  // Listen for browser navigation changes
  useEffect(() => {
    const cleanup = onHashChange((hashState) => {
      setShowBenchmark(hashState.benchmarkInfo);
    });
    
    return cleanup;
  }, [onHashChange]);

  // Update hash when showBenchmark changes (but avoid infinite loops)
  useEffect(() => {
    const currentHashState = getStateFromHash();
    if (currentHashState.benchmarkInfo !== showBenchmark) {
      updateHash({ benchmarkInfo: showBenchmark });
    }
  }, [showBenchmark, updateHash, getStateFromHash]);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    let cleanupFunction: (() => void) | undefined;
    
    // Initialize PIXI Application (async)
    const initApp = async () => {
      try {
        const pixiApp = new Application();
        await pixiApp.init({
          backgroundColor: parseInt(backgroundColor.replace('#', '0x')),
          canvas: canvasRef.current!,
          resizeTo: canvasRef.current!.parentElement || undefined,
          antialias: true,
          resolution: 2,
          autoDensity: true,
        });
        
        // Store app in state for other components to use
        app?.destroy(); // Clean up old app if exists
        setApp(pixiApp);
        
        // Setup cleanup function
        cleanupFunction = () => {
          pixiApp.destroy();
        };
      } catch (error) {
        console.error("Failed to initialize Pixi application:", error);
        addToast(t('error.failedToInitialize', error instanceof Error ? error.message : 'Unknown error'), 'error');
      }
    };
    
    initApp();
    
    // Return a cleanup function
    return () => {
      if (cleanupFunction) cleanupFunction();
    };
  }, []);

  // Function to traverse file/directory structure
  function traverseFileTree(item: any, path: string, fileList: File[]): Promise<void> {
    path = path || "";
    
    return new Promise((resolve, reject) => {
        if (item.isFile) {
            // Get file
            item.file((file: File) => {
                console.log("File found:", path + file.name);
                // Store the path in a custom property
                Object.defineProperty(file, 'fullPath', {
                    value: path + file.name,
                    writable: false
                });
                fileList.push(file);
                resolve();
            }, reject);
        } else if (item.isDirectory) {
            // Get folder contents
            const dirReader = item.createReader();
            
            // Function to read all entries in the directory
            const readAllEntries = (entries: any[] = []): Promise<any[]> => {
                return new Promise((resolveEntries, rejectEntries) => {
                    dirReader.readEntries((results: any[]) => {
                        if (results.length) {
                            // More entries to process
                            entries = entries.concat(Array.from(results));
                            readAllEntries(entries).then(resolveEntries).catch(rejectEntries);
                        } else {
                            // No more entries, we have all of them
                            resolveEntries(entries);
                        }
                    }, rejectEntries);
                });
            };
            
            readAllEntries().then((entries) => {
                console.log(`Directory found: ${path + item.name}/ (${entries.length} entries)`);
                
                // Process all entries in the directory
                const promises = entries.map(entry => 
                    traverseFileTree(entry, path + item.name + "/", fileList)
                );
                
                Promise.all(promises)
                    .then(() => resolve())
                    .catch(reject);
            }).catch(reject);
        } else {
            resolve(); // Not a file or directory, just resolve
        }
    });
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear highlighting
    e.currentTarget.classList.remove('highlight');
    
    try {
      setIsLoading(true);
      
      // Process dropped items using the working approach from your other project
      const items = e.dataTransfer?.items;
      if (!items || items.length === 0) {
        if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) {
          addToast(t('error.noFilesDropped'), 'error');
          return;
        }
        // If we only have files (not items), use the simple approach
        handleSpineFiles(e.dataTransfer.files);
        return;
      }
      
      // Convert DataTransferItemList to array
      const itemsArray = Array.from(items);
      const fileList: File[] = [];
      
      // Process all dropped items (files and directories)
      const promises = itemsArray.map(item => {
        // webkitGetAsEntry is where the magic happens
        const entry = item.webkitGetAsEntry();
        if (entry) {
            return traverseFileTree(entry, "", fileList);
        } else {
            return Promise.resolve();
        }
      });
      
      // When all traversal is complete
      await Promise.all(promises);
      console.log(`Traversal complete, found ${fileList.length} files`);
      
      if (fileList.length === 0) {
        addToast(t('error.noValidFiles'), 'error');
        return;
      }
      
      console.log('Files collected:', fileList.map(f => (f as any).fullPath || f.name));
      
      // Convert to FileList-like object
      const dataTransfer = new DataTransfer();
      fileList.forEach(file => dataTransfer.items.add(file));
      const files = dataTransfer.files;
      
      // Load files into SpineBenchmark
      await handleSpineFiles(files);
      
    } catch (error) {
      console.error('Error processing dropped items:', error);
      addToast(t('error.processingError', error instanceof Error ? error.message : 'Unknown error'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('highlight');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('highlight');
  };

  const handleSpineFiles = async (files: FileList) => {
    try {
      // Check for JSON skeleton file
      const jsonFile = Array.from(files).find(file => file.name.endsWith('.json'));
      if (jsonFile) {
        const content = await jsonFile.text();
        if (content.includes('"spine":"4.1')) {
          addToast(t('warnings.spineVersion'), 'warning');
          
          // Create a modified file with version replaced
          const modifiedContent = content.replace(/"spine":"4.1[^"]*"/, '"spine":"4.2.0"');
          const modifiedFile = new File([modifiedContent], jsonFile.name, { type: 'application/json' });
          
          // Replace the original file in the list
          const newFileList = Array.from(files);
          const index = newFileList.findIndex(f => f.name === jsonFile.name);
          if (index !== -1) {
            newFileList[index] = modifiedFile;
            
            // Convert back to FileList-like object
            const dataTransfer = new DataTransfer();
            newFileList.forEach(file => dataTransfer.items.add(file));
            
            await loadSpineFiles(dataTransfer.files);
            return;
          }
        }
      }
      
      await loadSpineFiles(files);
    } catch (error) {
      console.error("Error handling Spine files:", error);
      addToast(t('error.loadingError', error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  };

  const openGitHubReadme = () => {
    window.open('https://github.com/schmooky/spine-benchmark/blob/main/README.md', '_blank');
  };


  useEffect(() => {
    if (app) {
      app.renderer.background.color = parseInt(backgroundColor.replace('#', '0x'));
    }
  }, [backgroundColor, app]);
  
  // Enhanced setShowBenchmark function that updates hash
  const setShowBenchmarkWithHash = useCallback((show: boolean) => {
    setShowBenchmark(show);
    updateHash({ benchmarkInfo: show });
  }, [updateHash]);
  // Register commands for the command palette
  useCommandRegistration({
    spineInstance,
    showBenchmark,
    setShowBenchmark: setShowBenchmarkWithHash,
    openGitHubReadme,
    setShowLanguageModal: setShowLanguageModalWithLogging,
    meshesVisible,
    physicsVisible,
    ikVisible,
    toggleMeshes,
    togglePhysics,
    toggleIk
  });

  return (
    <div className="app-container">
      <div 
        className="canvas-container"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <canvas ref={canvasRef} id="pixiCanvas" />
        
        {!spineInstance && (
          <div className="drop-area">
            <p>{t('ui.dropArea')}</p>
          </div>
        )}
        
        {(isLoading || spineLoading) && (
          <div className="loading-indicator">
            <p>{t('ui.loading')}</p>
          </div>
        )}
      </div>
      
      {/* Help text when no Spine file is loaded */}
      {!spineInstance && (
        <div className="help-text">
          <p>{t('ui.helpText')}</p>
        </div>
      )}
      
      {/* Controls container - only visible when Spine file is loaded */}
      <div className={`controls-container ${spineInstance ? 'visible' : 'hidden'}`}>
        <div className="left-controls">
          {/* Left controls are now empty - removed benchmark toggle */}
        </div>
        
        <div className="center-controls">
          {spineInstance && (() => {
            console.log('App center-controls render:', {
              hasSpineInstance: !!spineInstance,
              spineInstanceType: spineInstance?.constructor?.name
            });
            return <AnimationControls
              spineInstance={spineInstance}
              onAnimationChange={setCurrentAnimation}
            />;
          })()}
        </div>
        
        <div className="right-controls">
          {/* Right controls are now empty - removed color picker */}
        </div>
      </div>
      
      {showBenchmark && benchmarkData && (
        <InfoPanel
          data={benchmarkData}
          onClose={() => setShowBenchmarkWithHash(false)}
        />
      )}
      
      {/* React Toastify Container with dark theme */}
      <ToastContainer
        position="top-center"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
      
      {/* Command Palette */}
      <CommandPalette />
      
      {/* Version Display */}
      <VersionDisplay
        appVersion="1.1.0"
        spineVersion="4.2.*"
      />
      
      {/* Language Modal */}
      <LanguageModal
        isOpen={showLanguageModal}
        onClose={() => {
          console.log('🏠 App: Closing language modal');
          setShowLanguageModalWithLogging(false);
        }}
      />
    </div>
  );
};

export default App;
```


## src\components\AnimationControls.tsx

```
import React, { useState, useEffect } from 'react';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  RewindIcon,
  ForwardIcon,
  ArrowPathIcon
} from './Icons';
import { IconButton } from './IconButton';
import { ToggleSwitch } from './ToggleSwitch';
import { ModernSelect } from './ModernSelect';

interface AnimationControlsProps {
  spineInstance: Spine;
  onAnimationChange?: (animationName: string) => void;
}

export const AnimationControls: React.FC<AnimationControlsProps> = ({ 
  spineInstance, 
  onAnimationChange 
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(false);
  const [currentAnimation, setCurrentAnimation] = useState<string>('');
  const [animations, setAnimations] = useState<string[]>([]);
  const [currentTrack, setCurrentTrack] = useState(0);
  
  // Initialize animations list and set default animation
  useEffect(() => {
    if (!spineInstance) return;
    
    const animationNames = spineInstance.skeleton.data.animations.map(anim => anim.name);
    setAnimations(animationNames);
    
    if (animationNames.length > 0) {
      setCurrentAnimation(animationNames[0]);
      playAnimation(animationNames[0], false);
    }
    
    return () => {
      // Cleanup if needed
    };
  }, [spineInstance]);
  
  // Handle play/pause
  useEffect(() => {
    if (!spineInstance) return;
    
    if (isPlaying) {
      spineInstance.state.timeScale = 1;
    } else {
      spineInstance.state.timeScale = 0;
    }
  }, [isPlaying, spineInstance]);
  
  const playAnimation = (name: string, loop: boolean = isLooping) => {
    if (!spineInstance) return;
    
    spineInstance.state.setAnimation(currentTrack, name, loop);
    setCurrentAnimation(name);
    setIsPlaying(true);
    
    // Notify parent component about animation change
    if (onAnimationChange) {
      onAnimationChange(name);
    }
  };
  
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };
  
  const toggleLoop = () => {
    setIsLooping(!isLooping);
    
    // Reapply the current animation with new loop setting
    if (currentAnimation) {
      playAnimation(currentAnimation, !isLooping);
    }
  };
  
  const stopAnimation = () => {
    if (!spineInstance) return;
    
    spineInstance.state.clearTrack(currentTrack);
    setIsPlaying(false);
  };
  
  const rewindAnimation = () => {
    if (!spineInstance || !currentAnimation) return;
    
    // Restart the current animation
    playAnimation(currentAnimation);
  };
  
  const previousAnimation = () => {
    if (!spineInstance || animations.length === 0) return;
    
    const currentIndex = animations.indexOf(currentAnimation);
    const newIndex = currentIndex > 0 ? currentIndex - 1 : animations.length - 1;
    playAnimation(animations[newIndex]);
  };
  
  const nextAnimation = () => {
    if (!spineInstance || animations.length === 0) return;
    
    const currentIndex = animations.indexOf(currentAnimation);
    const newIndex = currentIndex < animations.length - 1 ? currentIndex + 1 : 0;
    playAnimation(animations[newIndex]);
  };
  
  // Debug logging to validate assumptions
  console.log('AnimationControls rendering:', {
    spineInstance: !!spineInstance,
    currentAnimation,
    animations: animations.length,
    isPlaying,
    isLooping
  });
  console.log('Rendering playback controls with buttons');

  return (
    <div className="animation-controls">
      <div className="animation-name">
        {currentAnimation}
      </div>
      
      <div className="playback-controls">
        <IconButton
          icon={<RewindIcon />}
          onClick={previousAnimation}
          tooltip="Previous Animation"
        />
        
        <IconButton
          icon={<StopIcon />}
          onClick={stopAnimation}
          tooltip="Stop"
        />
        
        <IconButton
          icon={isPlaying ? <PauseIcon /> : <PlayIcon />}
          onClick={togglePlay}
          tooltip={isPlaying ? "Pause" : "Play"}
        />
        
        <IconButton
          icon={<ArrowPathIcon />}
          onClick={rewindAnimation}
          tooltip="Restart Animation"
        />
        
        <IconButton
          icon={<ForwardIcon />}
          onClick={nextAnimation}
          tooltip="Next Animation"
        />
      </div>
      
      <div className="animation-settings">
        <ToggleSwitch
          checked={isLooping}
          onChange={toggleLoop}
          label="Loop"
          tooltip="Toggle animation looping"
        />
        
        <ModernSelect
          value={currentAnimation}
          onChange={(value) => playAnimation(value)}
          options={animations.map(name => ({
            value: name,
            label: name
          }))}
          placeholder="Select Animation"
        />
      </div>
    </div>
  );
};
```


## src\components\CommandPalette.tsx

```
import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { Command, CommandCategory } from '../utils/commandRegistry';
import './CommandPalette.css';

interface CommandItemProps {
  command: Command;
  isSelected: boolean;
  onClick: () => void;
}

const CommandItem: React.FC<CommandItemProps> = ({ command, isSelected, onClick }) => {
  return (
    <div
      className={`command-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      role="option"
      aria-selected={isSelected}
    >
      <div className="command-content">
        <div className="command-title">{command.title}</div>
        {command.description && (
          <div className="command-description">{command.description}</div>
        )}
      </div>
      {command.category && (
        <div className="command-category">{command.category}</div>
      )}
    </div>
  );
};

interface CommandCategoryProps {
  category: CommandCategory;
  selectedIndex: number;
  flatCommandsBeforeCategory: number;
  onCommandClick: (commandId: string) => void;
}

const CommandCategorySection: React.FC<CommandCategoryProps> = ({
  category,
  selectedIndex,
  flatCommandsBeforeCategory,
  onCommandClick
}) => {
  return (
    <div className="command-category-section">
      <div className="command-category-header">{category.title}</div>
      <div className="command-category-items">
        {category.commands.map((command, index) => {
          const globalIndex = flatCommandsBeforeCategory + index;
          return (
            <CommandItem
              key={command.id}
              command={command}
              isSelected={selectedIndex === globalIndex}
              onClick={() => onCommandClick(command.id)}
            />
          );
        })}
      </div>
    </div>
  );
};

export const CommandPalette: React.FC = () => {
  const { t } = useTranslation();
  const {
    isOpen,
    query,
    selectedIndex,
    groupedCommands,
    totalCommands,
    closePalette,
    setQuery,
    executeCommand
  } = useCommandPalette();

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = document.querySelector('.command-item.selected');
    if (selectedElement) {
      selectedElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [selectedIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleCommandClick = (commandId: string) => {
    executeCommand(commandId);
  };

  // Calculate flat command indices for proper selection highlighting
  let flatCommandsCount = 0;
  const categoriesWithIndices = groupedCommands.map(category => {
    const startIndex = flatCommandsCount;
    flatCommandsCount += category.commands.length;
    return { category, startIndex };
  });

  if (!isOpen) {
    return null;
  }

  return (
      <div className="command-palette-backdrop" onClick={closePalette}>
          <div className="command-palette-content" onClick={(e) => e.stopPropagation()}>
            <div className="command-palette-header">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                placeholder={t('commandPalette.placeholder')}
                className="command-palette-input"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            
            <div className="command-palette-body">
              {totalCommands === 0 ? (
                <div className="command-palette-empty">
                  <div className="empty-message">{t('commandPalette.noCommands')}</div>
                  <div className="empty-hint">{t('commandPalette.tryDifferent')}</div>
                </div>
              ) : (
                <div className="command-palette-results" role="listbox">
                  {categoriesWithIndices.map(({ category, startIndex }) => (
                    <CommandCategorySection
                      key={category.id}
                      category={category}
                      selectedIndex={selectedIndex}
                      flatCommandsBeforeCategory={startIndex}
                      onCommandClick={handleCommandClick}
                    />
                  ))}
                </div>
              )}
            </div>
            
            <div className="command-palette-footer">
              <div className="command-palette-shortcuts">
                <span className="shortcut">
                  <kbd>↑</kbd><kbd>↓</kbd> {t('commandPalette.shortcuts.navigate')}
                </span>
                <span className="shortcut">
                  <kbd>Enter</kbd> {t('commandPalette.shortcuts.select')}
                </span>
                <span className="shortcut">
                  <kbd>Esc</kbd> {t('commandPalette.shortcuts.close')}
                </span>
              </div>
            </div>
          </div>
      </div>
    );
};
```


## src\components\IconButton.tsx

```
import React from 'react';

interface IconButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  tooltip?: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  tooltip,
  active = false,
  disabled = false,
  className = '',
}) => {
  return (
    <button
      className={`icon-button ${active ? 'active' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      aria-label={tooltip}
    >
      {icon}
    </button>
  );
};
```


## src\components\Icons.tsx

```
import React from 'react';

// Common SVG props that all icons share
interface IconProps {
  className?: string;
  size?: number;
}

const defaultProps = {
  className: '',
  size: 24,
};

// Helper function to create icon components
const createIcon = (path: React.ReactNode, viewBox = '0 0 24 24') => {
  return ({ className = '', size = 24 }: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
};

// Document Icon
export const DocumentTextIcon = createIcon(
  <>
    <path d="M8 14H16M8 10H16M13 18H8C6.89543 18 6 17.1046 6 16V8C6 6.89543 6.89543 6 8 6H16C17.1046 6 18 6.89543 18 8V13" />
    <path d="M15 18L18 21M18 21L21 18M18 21V15" />
  </>
);

// Question Mark Circle Icon
export const QuestionMarkCircleIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16V16.01M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12V12.5C11 12.7761 11.2239 13 11.5 13H12Z" />
  </>
);

// Play Icon
export const PlayIcon = createIcon(
  <path d="M5 3L19 12L5 21V3Z" />
);

// Pause Icon
export const PauseIcon = createIcon(
  <>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </>
);

// Stop Icon
export const StopIcon = createIcon(
  <rect x="5" y="5" width="14" height="14" />
);

// Rewind Icon
export const RewindIcon = createIcon(
  <>
    <path d="M4 16V8L10 12L4 16Z" />
    <path d="M12 16V8L18 12L12 16Z" />
  </>
);

// Forward Icon
export const ForwardIcon = createIcon(
  <>
    <path d="M6 16V8L12 12L6 16Z" />
    <path d="M14 16V8L20 12L14 16Z" />
  </>
);

// Arrow Path (Refresh) Icon
export const ArrowPathIcon = createIcon(
  <path d="M16.023 9h4.977v-4M7.977 15h-4.977v4M16.5 7.5c-1.333-1.333-3.5-3-6.5-3-4.142 0-7.5 3.358-7.5 7.5 0 1.487.433 2.873 1.179 4.038M7.5 16.5c1.333 1.333 3.5 3 6.5 3 4.142 0 7.5-3.358 7.5-7.5 0-1.487-.433-2.873-1.179-4.038" />
);

// X Mark (Close) Icon
export const XMarkIcon = createIcon(
  <path d="M6 18L18 6M6 6L18 18" />
);

// Swatch (Color Palette) Icon
export const SwatchIcon = createIcon(
  <>
    <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    <path d="M15 10l5 5" />
  </>
);

// Image Icon
export const ImageIcon = createIcon(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </>
);

// Cog (Settings) Icon 
export const CogIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </>
);

export const TimelineIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
    <circle cx="9" cy="9" r="1.5" fill="currentColor" />
    <circle cx="15" cy="15.75" r="1.5" fill="currentColor" />
    <rect x="6" y="7.5" width="1" height="9" rx="0.5" fill="currentColor" />
    <rect x="12" y="7.5" width="1" height="9" rx="0.5" fill="currentColor" />
    <rect x="18" y="7.5" width="1" height="9" rx="0.5" fill="currentColor" />
  </svg>
);
```


## src\components\InfoPanel.tsx

```
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from './Icons';
import { IconButton } from './IconButton';
import { BenchmarkData } from '../hooks/useSpineApp';
import { useUrlHash } from '../hooks/useUrlHash';

interface InfoPanelProps {
  data: BenchmarkData;
  onClose: () => void;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ data, onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('summary');
  const { updateHash, getStateFromHash } = useUrlHash();
  
  // Check initial hash state for active tab
  useEffect(() => {
    const hashState = getStateFromHash();
    if (hashState.benchmarkTab) {
      setActiveTab(hashState.benchmarkTab);
    }
  }, [getStateFromHash]);

  // Update hash when active tab changes
  useEffect(() => {
    updateHash({ benchmarkInfo: true, benchmarkTab: activeTab });
  }, [activeTab, updateHash]);

  // Create a container for the portal if it doesn't exist
  const container = document.getElementById('info-panel-container') || (() => {
    const div = document.createElement('div');
    div.id = 'info-panel-container';
    document.body.appendChild(div);
    return div;
  })();
  const tabs = [
    { id: 'summary', label: t('infoPanel.tabs.summary') },
    { id: 'meshAnalysis', label: t('infoPanel.tabs.meshAnalysis') },
    { id: 'clippingAnalysis', label: t('infoPanel.tabs.clipping') },
    { id: 'blendModeAnalysis', label: t('infoPanel.tabs.blendModes') },
    { id: 'physicsAnalysis', label: t('infoPanel.tabs.physicsAnalysis') },
    { id: 'skeletonTree', label: t('infoPanel.tabs.skeletonTree') },
  ];
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return (
          <div className="tab-content">
            <div dangerouslySetInnerHTML={{ __html: data.summary || `<p>${t('infoPanel.content.noData', { 0: 'summary' })}</p>` }} />
          </div>
        );
      case 'meshAnalysis':
        return (
          <div className="tab-content">
            <div dangerouslySetInnerHTML={{ __html: data.meshAnalysis || `<p>${t('infoPanel.content.noData', { 0: 'mesh analysis' })}</p>` }} />
          </div>
        );
      case 'clippingAnalysis':
        return (
          <div className="tab-content">
            <div dangerouslySetInnerHTML={{ __html: data.clippingAnalysis || `<p>${t('infoPanel.content.noData', { 0: 'clipping analysis' })}</p>` }} />
          </div>
        );
      case 'blendModeAnalysis':
        return (
          <div className="tab-content">
            <div dangerouslySetInnerHTML={{ __html: data.blendModeAnalysis || `<p>${t('infoPanel.content.noData', { 0: 'blend mode analysis' })}</p>` }} />
          </div>
        );
      case 'physicsAnalysis':
        return (
          <div className="tab-content">
            <div dangerouslySetInnerHTML={{ __html: data.physicsAnalysis || `<p>${t('infoPanel.content.noData', { 0: 'physics analysis' })}</p>` }} />
          </div>
        );
      case 'skeletonTree':
        return (
          <div className="tab-content">
            <div dangerouslySetInnerHTML={{ __html: data.skeletonTree || `<p>${t('infoPanel.content.noData', { 0: 'skeleton tree' })}</p>` }} />
          </div>
        );
      default:
        return <div>{t('infoPanel.content.selectTab')}</div>;
    }
  };
  
  return createPortal(
    <div className="info-panel-backdrop">
      <div className="info-panel">
        <div className="info-panel-header">
          <h2>{t('infoPanel.title')}</h2>
          <IconButton
            icon={<XMarkIcon />}
            onClick={onClose}
            tooltip={t('infoPanel.close')}
          />
        </div>
        
        <div className="info-panel-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                updateHash({ benchmarkInfo: true, benchmarkTab: tab.id });
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="info-panel-content">
          {renderTabContent()}
        </div>
      </div>
    </div>,
    container
  );
};
```


## src\components\LanguageModal.tsx

```
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageModal.css';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh', name: '繁體中文' },
  { code: 'uk', name: 'Українська' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português (Brasil)' },
  { code: 'es', name: 'Español' },
];

interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LanguageModal: React.FC<LanguageModalProps> = ({ isOpen, onClose }) => {
  const { i18n, t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const firstLanguageRef = useRef<HTMLButtonElement>(null);

  console.log('🌐 LanguageModal render:', { isOpen, currentLanguage: i18n.language });

  useEffect(() => {
    if (isOpen && firstLanguageRef.current) {
      console.log('🎯 Focusing first language option');
      firstLanguageRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const languageButtons = modalRef.current?.querySelectorAll('.language-option') as NodeListOf<HTMLButtonElement>;
        if (!languageButtons.length) return;

        const currentIndex = Array.from(languageButtons).findIndex(button => button === document.activeElement);
        let nextIndex: number;

        if (event.key === 'ArrowDown') {
          nextIndex = currentIndex < languageButtons.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : languageButtons.length - 1;
        }

        languageButtons[nextIndex].focus();
      }

      if (event.key === 'Enter' || event.key === ' ') {
        const activeElement = document.activeElement as HTMLButtonElement;
        if (activeElement?.classList.contains('language-option')) {
          event.preventDefault();
          activeElement.click();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleLanguageChange = (languageCode: string) => {
    console.log('🔄 Language change requested:', { from: i18n.language, to: languageCode });
    i18n.changeLanguage(languageCode);
    console.log('✅ Language changed, closing modal');
    onClose();
  };

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      console.log('🖱️ Modal backdrop clicked - closing modal');
      onClose();
    }
  };

  if (!isOpen) {
    console.log('🚫 Modal not open - returning null');
    return null;
  }

  console.log('🎨 Rendering language modal with languages:', languages.map(l => l.code));

  return (
    <div className="language-modal-backdrop" onClick={handleBackdropClick}>
      <div className="language-modal-content" ref={modalRef}>
        <div className="language-modal-header">
          <h2 className="language-modal-title">{t('language.modal.title', 'Select Language')}</h2>
          <button 
            className="language-modal-close" 
            onClick={onClose}
            aria-label={t('ui.close')}
          >
            ×
          </button>
        </div>
        <div className="language-modal-body">
          <div className="language-options">
            {languages.map((language, index) => (
              <button
                key={language.code}
                ref={index === 0 ? firstLanguageRef : undefined}
                className={`language-option ${i18n.language === language.code ? 'current' : ''}`}
                onClick={() => handleLanguageChange(language.code)}
                aria-label={t('commands.language.switchTo', { 0: language.name })}
              >
                <span className="language-name">{language.name}</span>
                {i18n.language === language.code && (
                  <span className="language-current-indicator">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="language-modal-footer">
          <div className="language-modal-shortcuts">
            <span className="shortcut">
              <kbd>↑</kbd><kbd>↓</kbd> {t('commandPalette.shortcuts.navigate')}
            </span>
            <span className="shortcut">
              <kbd>Enter</kbd> {t('commandPalette.shortcuts.select')}
            </span>
            <span className="shortcut">
              <kbd>Esc</kbd> {t('commandPalette.shortcuts.close')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
```


## src\components\ModernSelect.tsx

```
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';

interface ModernSelectOption {
  value: string;
  label: string;
}

interface ModernSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ModernSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const ModernSelect: React.FC<ModernSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState<'down' | 'up'>('down');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(option => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calculate dropdown position when opened
  useLayoutEffect(() => {
    if (isOpen && containerRef.current) {
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Estimate dropdown height (max-height is 200px from CSS)
      const estimatedDropdownHeight = Math.min(options.length * 36 + 16, 200);
      
      // Check if there's enough space below
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // If not enough space below but enough space above, position upwards
      if (spaceBelow < estimatedDropdownHeight + 8 && spaceAbove > estimatedDropdownHeight + 8) {
        setDropdownPosition('up');
      } else {
        setDropdownPosition('down');
      }
    }
  }, [isOpen, options.length]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      setFocusedIndex(-1);
    }
  };

  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && focusedIndex >= 0) {
          handleOptionClick(options[focusedIndex].value);
        } else {
          setIsOpen(!isOpen);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(0);
        } else {
          setFocusedIndex(prev => 
            prev < options.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(options.length - 1);
        } else {
          setFocusedIndex(prev => 
            prev > 0 ? prev - 1 : options.length - 1
          );
        }
        break;
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`modern-select-container ${className}`}
    >
      <div
        className={`modern-select ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled}
      >
        <span className="modern-select-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="modern-select-arrow">
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
      
      {isOpen && (
        <div
          ref={dropdownRef}
          className={`modern-select-dropdown ${dropdownPosition === 'up' ? 'dropdown-up' : 'dropdown-down'}`}
          role="listbox"
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              className={`modern-select-option ${
                option.value === value ? 'selected' : ''
              } ${
                index === focusedIndex ? 'focused' : ''
              }`}
              onClick={() => handleOptionClick(option.value)}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```


## src\components\ToggleSwitch.tsx

```
import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  variant?: 'default' | 'yellow' | 'magenta' | 'cyan';
  disabled?: boolean;
  tooltip?: string;
  className?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  variant = 'default',
  disabled = false,
  tooltip,
  className = '',
}) => {
  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div 
      className={`toggle-switch-container ${className}`}
      title={tooltip}
    >
      <div
        className={`toggle-switch ${variant} ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="switch"
        aria-checked={checked}
        aria-label={label || tooltip}
        aria-disabled={disabled}
      >
        <div className="toggle-track">
          <div className="toggle-thumb" />
        </div>
      </div>
      {label && (
        <label 
          className="toggle-label"
          onClick={handleToggle}
        >
          {label}
        </label>
      )}
    </div>
  );
};
```


## src\components\VersionDisplay.tsx

```
import React from 'react';

interface VersionDisplayProps {
  appVersion: string;
  spineVersion: string;
}

export const VersionDisplay: React.FC<VersionDisplayProps> = ({ 
  appVersion, 
  spineVersion 
}) => {
  return (
    <div className="version-display">
      <div className="version-line">v{appVersion}</div>
      <div className="version-line">Spine {spineVersion}</div>
    </div>
  );
};
```


## src\core\BackgroundManager.ts

```
import { Application, Sprite, Texture, Container, Assets } from 'pixi.js';

export class BackgroundManager {
  private app: Application;
  private bgSprite: Sprite | null = null;
  private container: Container;
  private textureId: string | null = null;

  constructor(app: Application) {
    this.app = app;
    
    // Create a container that will be positioned at the bottom of the render stack
    this.container = new Container();
    
    // Add the container to the stage
    // Insert at index 0 to ensure it's behind everything else
    if (this.app.stage.children.length > 0) {
      this.app.stage.addChildAt(this.container, 0);
    } else {
      this.app.stage.addChild(this.container);
    }
    
    // Listen for resize events to update the background size
    window.addEventListener('resize', this.resizeBackground.bind(this));
  }

  /**
   * Sets a background image from a base64 string
   * @param base64Data The base64 encoded image data
   */
  public async setBackgroundImage(base64Data: string): Promise<void> {
    try {
      // Clean up old image if exists
      this.clearBackground();
      
      // Generate a unique ID for this texture
      this.textureId = `bg_${Date.now()}`;
      
      // Add the base64 image to the Assets cache
      await Assets.add({alias: this.textureId, src: base64Data});
      
      // Load the texture
      const texture = await Assets.load(this.textureId);
      
      // Create a sprite with the texture
      this.bgSprite = new Sprite(texture);
      
      // Add the sprite to the container
      this.container.addChild(this.bgSprite);
      
      // Adjust the size
      this.resizeBackground();
    } catch (error) {
      console.error('Error loading background image:', error);
      throw error;
    }
  }

  /**
   * Resizes the background to fit within the canvas
   */
  private resizeBackground(): void {
    if (!this.bgSprite) return;
    
    const renderer = this.app.renderer;
    const stageWidth = renderer.width;
    const stageHeight = renderer.height;
    
    // Calculate scale to fit the image inside the screen (contain)
    const imageRatio = this.bgSprite.texture.width / this.bgSprite.texture.height;
    const screenRatio = stageWidth / stageHeight;
    
    if (imageRatio > screenRatio) {
      // Image is wider than screen ratio - fit width
      this.bgSprite.width = stageWidth;
      this.bgSprite.height = stageWidth / imageRatio;
    } else {
      // Image is taller than screen ratio - fit height
      this.bgSprite.height = stageHeight;
      this.bgSprite.width = stageHeight * imageRatio;
    }
    
    // Center the background
    this.bgSprite.x = (stageWidth - this.bgSprite.width) / 2;
    this.bgSprite.y = (stageHeight - this.bgSprite.height) / 2;
  }

  /**
   * Clears the current background image
   */
  public clearBackground(): void {
    if (this.bgSprite) {
      this.container.removeChild(this.bgSprite);
      this.bgSprite.destroy({ texture: true });
      this.bgSprite = null;
    }
    
    // Unload the texture from Assets cache if it exists
    if (this.textureId) {
      Assets.unload(this.textureId);
      this.textureId = null;
    }
  }

  /**
   * Cleans up resources
   */
  public destroy(): void {
    this.clearBackground();
    window.removeEventListener('resize', this.resizeBackground.bind(this));
    this.app.stage.removeChild(this.container);
    this.container.destroy();
  }
}
```


## src\core\CameraContainer.ts

```
// CameraContainer.ts
import { ISpineDebugRenderer, Spine, Physics } from "@esotericsoftware/spine-pixi-v8";
import gsap from "gsap";
import { Application, Container, Graphics } from "pixi.js";
import { PhysicsConstraint } from "@esotericsoftware/spine-core/dist/PhysicsConstraint.js"

// =========================
// Debug flags
// =========================
interface DebugFlags {
  showBones: boolean;
  showRegionAttachments: boolean;
  showMeshTriangles: boolean;
  showMeshHull: boolean;
  showBoundingBoxes: boolean;
  showPaths: boolean;
  showClipping: boolean;
  showPhysics: boolean;
  showIkConstraints: boolean;
  showTransformConstraints: boolean;
  showPathConstraints: boolean;
  // Optional: turn culling on/off
  cullToViewport?: boolean;
}

// Additional display objects per Spine
interface DebugDisplayObjects {
  parentContainer: Container;
  bones: Graphics;
  regions: Graphics;
  meshTriangles: Graphics;
  meshHull: Graphics;
  boundingBoxes: Graphics;
  paths: Graphics;
  clipping: Graphics;

  physicsConstraints: Graphics;
  ikConstraints: Graphics;
  transformConstraints: Graphics;
  pathConstraints: Graphics;
}

// =========================
// Custom Debug Renderer
// (No SpineDebugRenderer from the runtime)
// Pixi v8 chaining + viewport culling + pixelLine hairlines
// =========================
class CustomSpineDebugRenderer implements ISpineDebugRenderer {
  private readonly app: Application;
  private readonly registeredSpines = new Map<Spine, DebugDisplayObjects>();

  private flags: DebugFlags = {
    showBones: true,
    showRegionAttachments: true,
    showMeshTriangles: true,
    showMeshHull: true,
    showBoundingBoxes: true,
    showPaths: true,
    showClipping: true,
    showPhysics: true,
    showIkConstraints: true,
    showTransformConstraints: true,
    showPathConstraints: true,
    cullToViewport: true,
  };

  constructor(app: Application) {
    this.app = app;
  }

  public setDebugFlags(flags: Partial<DebugFlags>): void {
    this.flags = { ...this.flags, ...flags };
  }

  public getDebugFlags(): DebugFlags {
    return { ...this.flags };
  }

  public registerSpine(spine: Spine): void {
    if (this.registeredSpines.has(spine)) return;

    const parentContainer = new Container();
    spine.addChild(parentContainer);

    const bones = new Graphics();
    const regions = new Graphics();
    const meshTriangles = new Graphics();
    const meshHull = new Graphics();
    const boundingBoxes = new Graphics();
    const paths = new Graphics();
    const clipping = new Graphics();

    const physicsConstraints = new Graphics();
    const ikConstraints = new Graphics();
    const transformConstraints = new Graphics();
    const pathConstraints = new Graphics();

    parentContainer.addChild(
      bones,
      regions,
      meshHull,
      meshTriangles,
      boundingBoxes,
      paths,
      clipping,
      physicsConstraints,
      ikConstraints,
      transformConstraints,
      pathConstraints
    );

    this.registeredSpines.set(spine, {
      parentContainer,
      bones,
      regions,
      meshTriangles,
      meshHull,
      boundingBoxes,
      paths,
      clipping,
      physicsConstraints,
      ikConstraints,
      transformConstraints,
      pathConstraints,
    });
  }

  public unregisterSpine(spine: Spine): void {
    const dbg = this.registeredSpines.get(spine);
    if (!dbg) return;
    spine.removeChild(dbg.parentContainer);
    dbg.parentContainer.destroy({ children: true });
    this.registeredSpines.delete(spine);
  }

  public renderDebug(spine: Spine): void {
    const dbg = this.registeredSpines.get(spine);
    if (!dbg) return;

    // Clear everything first
    dbg.bones.clear();
    dbg.regions.clear();
    dbg.meshTriangles.clear();
    dbg.meshHull.clear();
    dbg.boundingBoxes.clear();
    dbg.paths.clear();
    dbg.clipping.clear();
    dbg.physicsConstraints.clear();
    dbg.ikConstraints.clear();
    dbg.transformConstraints.clear();
    dbg.pathConstraints.clear();

    // Nothing to draw?
    if (!this.isAnyDebugActive()) return;

    const skel = spine.skeleton as any; // tolerate runtime typing differences

    if (this.flags.showBones) this.drawBones(skel, dbg);
    if (this.flags.showRegionAttachments) this.drawRegionAttachments(skel, dbg);
    if (this.flags.showMeshTriangles || this.flags.showMeshHull) this.drawMeshes(skel, dbg);
    if (this.flags.showBoundingBoxes) this.drawBoundingBoxes(skel, dbg);
    if (this.flags.showPaths) this.drawPaths(skel, dbg);
    if (this.flags.showClipping) this.drawClipping(skel, dbg);

    if (this.flags.showPhysics) this.drawPhysicsConstraints(skel, dbg);
    if (this.flags.showIkConstraints) this.drawIkConstraints(skel, dbg);
    if (this.flags.showTransformConstraints) this.drawTransformConstraints(skel, dbg);
    if (this.flags.showPathConstraints) this.drawPathConstraints(skel, dbg);
  }

  // --------------------
  // State helpers
  // --------------------
  private isAnyDebugActive(): boolean {
    const f = this.flags;
    return (
      f.showBones ||
      f.showRegionAttachments ||
      f.showMeshTriangles ||
      f.showMeshHull ||
      f.showBoundingBoxes ||
      f.showPaths ||
      f.showClipping ||
      f.showPhysics ||
      f.showIkConstraints ||
      f.showTransformConstraints ||
      f.showPathConstraints
    );
  }

  // --------------------
  // Viewport helpers (culling)
  // --------------------
  private get screenRect() {
    return this.app.renderer.screen; // {x, y, width, height}
  }

  private isPointVisible(x: number, y: number, pad = 0): boolean {
    if (!this.flags.cullToViewport) return true;
    const r = this.screenRect;
    return x >= r.x - pad && y >= r.y - pad && x <= r.x + r.width + pad && y <= r.y + r.height + pad;
  }

  private isCircleVisible(x: number, y: number, radius: number): boolean {
    if (!this.flags.cullToViewport) return true;
    return this.isPointVisible(x, y, radius);
  }

  private isSegmentVisible(x1: number, y1: number, x2: number, y2: number): boolean {
    if (!this.flags.cullToViewport) return true;
    if (this.isPointVisible(x1, y1) || this.isPointVisible(x2, y2)) return true;

    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const r = this.screenRect;
    const intersects =
      maxX >= r.x && minX <= r.x + r.width && maxY >= r.y && minY <= r.y + r.height;
    return intersects;
  }

  private isPolylineVisible(world: ArrayLike<number>, stride = 2, xOff = 0, yOff = 1): boolean {
    if (!this.flags.cullToViewport) return true;
    const r = this.screenRect;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < world.length; i += stride) {
      const x = world[i + xOff];
      const y = world[i + yOff];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (this.isPointVisible(x, y)) return true; // early-out
    }
    return maxX >= r.x && minX <= r.x + r.width && maxY >= r.y && minY <= r.y + r.height;
  }

  // --------------------
  // Bones
  // --------------------
  private drawBones(skel: any, dbg: DebugDisplayObjects): void {
    const g = dbg.bones;
    g.stroke({ color: 0xffa500, width: 1, pixelLine: true });

    const bones: any[] = skel.bones || [];
    for (const bone of bones) {
      const x = bone.worldX;
      const y = bone.worldY;
      const parent = bone.parent;
      if (parent) {
        const px = parent.worldX;
        const py = parent.worldY;
        if (this.isSegmentVisible(px, py, x, y)) {
          g.moveTo(px, py).lineTo(x, y);
        }
      }
      // joint
      if (this.isCircleVisible(x, y, 2)) {
        g.fill({ color: 0xffa500 }).circle(x, y, 2).fill();
      }
    }
  }

  // --------------------
  // Region attachments (quads)
  // --------------------
  private drawRegionAttachments(skel: any, dbg: DebugDisplayObjects): void {
    const g = dbg.regions;
    g.stroke({ color: 0x00a2ff, width: 1, pixelLine: true });

    const drawOrder: any[] = skel.drawOrder || skel.slots || [];
    const verts = new Float32Array(8);

    for (const slot of drawOrder) {
      const att = slot.getAttachment?.();
      if (!att) continue;

      // Heuristic: region attachments usually have 4 vertices and computeWorldVertices
      if (typeof att.computeWorldVertices === "function" && (att.region || att.uvs?.length === 8)) {
        // Try signatures: (slot, verts, 0, 2) or (bone, verts, 0, 2)
        try {
          att.computeWorldVertices(slot, verts, 0, 2);
        } catch {
          try {
            att.computeWorldVertices(slot.bone, verts, 0, 2);
          } catch {
            continue;
          }
        }

        // verts: [x0,y0, x1,y1, x2,y2, x3,y3]
        const x0 = verts[0], y0 = verts[1];
        const x1 = verts[2], y1 = verts[3];
        const x2 = verts[4], y2 = verts[5];
        const x3 = verts[6], y3 = verts[7];

        // cull by quad bbox
        if (!this.isPolylineVisible(verts, 2, 0, 1)) continue;

        g.moveTo(x0, y0).lineTo(x1, y1).lineTo(x2, y2).lineTo(x3, y3).lineTo(x0, y0);
      }
    }
  }

  // --------------------
  // Mesh attachments (triangles + hull)
  // --------------------
private drawMeshes(skel: any, dbg: DebugDisplayObjects): void {
  const gTri = dbg.meshTriangles.clear();
  const gHull = dbg.meshHull.clear();

  // Force hairline strokes, full opacity for triangle edges and hull edges.
  if (this.flags.showMeshTriangles) {
    gTri.stroke({ color: 0xffffff, width: 1, pixelLine: true, alpha: 1 });
  }
  if (this.flags.showMeshHull) {
    gHull.stroke({ color: 0xff00ff, width: 1, pixelLine: true, alpha: 1 });
  }

  const drawOrder: any[] = skel.drawOrder || skel.slots || [];
  let verts: Float32Array | null = null;

  for (const slot of drawOrder) {
    const att = slot.getAttachment?.();
    if (!att) continue;

    const triangles: number[] | undefined = att.triangles;
    const worldVerticesLength: number | undefined = att.worldVerticesLength;

    if (triangles && worldVerticesLength && typeof att.computeWorldVertices === "function") {
      if (!verts || verts.length < worldVerticesLength) verts = new Float32Array(worldVerticesLength);

      // Try common signatures to get world verts:
      let ok = true;
      try {
        // spine 4.2+ signature
        att.computeWorldVertices(slot, 0, worldVerticesLength, verts, 0, 2);
      } catch {
        try {
          // alt signature used by some builds
          att.computeWorldVertices(slot, verts, 0, 2);
        } catch {
          ok = false;
        }
      }
      if (!ok) continue;

      // --- TRIANGLES ---
      if (this.flags.showMeshTriangles) {
        // Quick visibility check by verts AABB; if completely off-screen, skip all edges
        if (!this.isPolylineVisible(verts, 2, 0, 1)) {
          // still draw hull below if requested (since it has its own cull) — just skip triangles
        } else {
          for (let i = 0; i < triangles.length; i += 3) {
            const i0 = triangles[i] * 2;
            const i1 = triangles[i + 1] * 2;
            const i2 = triangles[i + 2] * 2;

            const x0 = verts[i0], y0 = verts[i0 + 1];
            const x1 = verts[i1], y1 = verts[i1 + 1];
            const x2 = verts[i2], y2 = verts[i2 + 1];

            // Per-edge cull keeps it extra cheap
            if (this.isSegmentVisible(x0, y0, x1, y1)) gTri.moveTo(x0, y0).lineTo(x1, y1);
            if (this.isSegmentVisible(x1, y1, x2, y2)) gTri.moveTo(x1, y1).lineTo(x2, y2);
            if (this.isSegmentVisible(x2, y2, x0, y0)) gTri.moveTo(x2, y2).lineTo(x0, y0);
          }
        }
      }

      // --- HULL ---
      if (this.flags.showMeshHull && att.hullLength && att.hullLength > 0) {
        const count = att.hullLength;
        if (count >= 4) {
          // If entire hull off-screen, skip
          if (!this.isPolylineVisible(verts, 2, 0, 1)) continue;

          let x0 = verts[0], y0 = verts[1];
          gHull.moveTo(x0, y0);
          for (let i = 2; i < count; i += 2) {
            const x = verts[i], y = verts[i + 1];
            gHull.lineTo(x, y);
          }
          gHull.lineTo(x0, y0);
        }
      }
    }
  }
}

  // --------------------
  // Bounding boxes (attachments)
  // --------------------
  private drawBoundingBoxes(skel: any, dbg: DebugDisplayObjects): void {
    const g = dbg.boundingBoxes;
    g.stroke({ color: 0x32cd32, width: 1, pixelLine: true });

    const drawOrder: any[] = skel.drawOrder || skel.slots || [];

    for (const slot of drawOrder) {
      const att = slot.getAttachment?.();
      if (!att) continue;

      // BoundingBoxAttachment heuristic: worldVerticesLength and no triangles
      const wvl: number | undefined = att.worldVerticesLength;
      if (wvl && typeof att.computeWorldVertices === "function" && !att.triangles) {
        const verts = new Float32Array(wvl);
        try {
          att.computeWorldVertices(slot, 0, wvl, verts, 0, 2);
        } catch {
          try {
            att.computeWorldVertices(slot, verts, 0, 2);
          } catch {
            continue;
          }
        }

        if (!this.isPolylineVisible(verts, 2, 0, 1)) continue;

        // Draw polygon
        g.moveTo(verts[0], verts[1]);
        for (let i = 2; i < wvl; i += 2) g.lineTo(verts[i], verts[i + 1]);
        g.lineTo(verts[0], verts[1]);
      }
    }
  }

  // --------------------
  // Paths (PathAttachment)
  // --------------------
  private drawPaths(skel: any, dbg: DebugDisplayObjects): void {
    const g = dbg.paths;
    g.stroke({ color: 0x00ff00, width: 1, pixelLine: true });

    const drawOrder: any[] = skel.drawOrder || skel.slots || [];
    for (const slot of drawOrder) {
      const att = slot.getAttachment?.();
      if (!att) continue;

      // Heuristic: path-like has worldVerticesLength & computeWorldVertices & att.closed
      const wvl: number | undefined = att.worldVerticesLength;
      if (wvl && typeof att.computeWorldVertices === "function" && (att.closed !== undefined || att.constantSpeed !== undefined)) {
        const verts = new Float32Array(wvl);
        try {
          att.computeWorldVertices(slot, 0, wvl, verts, 0, 2);
        } catch {
          try {
            att.computeWorldVertices(slot, verts, 0, 2);
          } catch {
            continue;
          }
        }

        if (!this.isPolylineVisible(verts, 2, 0, 1)) continue;

        g.moveTo(verts[0], verts[1]);
        for (let i = 2; i < wvl; i += 2) g.lineTo(verts[i], verts[i + 1]);
        if (att.closed) g.lineTo(verts[0], verts[1]);

        // Point markers (light fill)
        for (let i = 0; i < wvl; i += 2) {
          const x = verts[i], y = verts[i + 1];
          if (this.isCircleVisible(x, y, 3)) {
            g.fill({ color: 0x00ff00, alpha: 0.4 }).circle(x, y, 3).fill();
          }
        }
      }
    }
  }

  // --------------------
  // Clipping (ClippingAttachment)
  // --------------------
  private drawClipping(skel: any, dbg: DebugDisplayObjects): void {
    const g = dbg.clipping;
    g.stroke({ color: 0xff1493, width: 1, pixelLine: true });

    const drawOrder: any[] = skel.drawOrder || skel.slots || [];
    for (const slot of drawOrder) {
      const att = slot.getAttachment?.();
      if (!att) continue;

      // Heuristic: clipping attachments look like polygons with worldVerticesLength but special type
      const wvl: number | undefined = att.worldVerticesLength;
      if (wvl && typeof att.computeWorldVertices === "function" && att.endSlot !== undefined) {
        const verts = new Float32Array(wvl);
        try {
          att.computeWorldVertices(slot, 0, wvl, verts, 0, 2);
        } catch {
          try {
            att.computeWorldVertices(slot, verts, 0, 2);
          } catch {
            continue;
          }
        }

        if (!this.isPolylineVisible(verts, 2, 0, 1)) continue;

        g.moveTo(verts[0], verts[1]);
        for (let i = 2; i < wvl; i += 2) g.lineTo(verts[i], verts[i + 1]);
        g.lineTo(verts[0], verts[1]);
      }
    }
  }

  // --------------------
  // Constraints (Physics / IK / Transform / Path)
  // --------------------
  private drawPhysicsConstraints(skel: any, dbg: DebugDisplayObjects): void {
    const g = dbg.physicsConstraints;
    g.stroke({ color: 0xff00ff, width: 1, pixelLine: true });

    const list = (skel.physicsConstraints as PhysicsConstraint[]) || [];
    for (const c of list) {
      if (!c?.isActive?.()) continue;
      const bone = c.bone;
      const x = bone.worldX, y = bone.worldY;
      if (!this.isCircleVisible(x, y, 15)) continue;

      // Marker: circle + cross
      g.fill({ color: 0xff00ff, alpha: 0.25 })
        .circle(x, y, 15)
        .fill()
        .stroke({ color: 0xff00ff, width: 1, pixelLine: true })
        .moveTo(x - 10, y - 10).lineTo(x + 10, y + 10)
        .moveTo(x + 10, y - 10).lineTo(x - 10, y + 10);

      // Spring visual
      this.drawSpring(g, x, y, bone.data.length, bone.rotation);
    }
  }

  private drawIkConstraints(skel: any, dbg: DebugDisplayObjects): void {
    const g = dbg.ikConstraints;
    g.stroke({ color: 0x00ffff, width: 1, pixelLine: true });

    for (const c of skel.ikConstraints as any[] || []) {
      if (!c?.isActive?.()) continue;
      const bones: any[] = c.bones;
      for (let i = 0; i < bones.length - 1; i++) {
        const b1 = bones[i], b2 = bones[i + 1];
        if (this.isSegmentVisible(b1.worldX, b1.worldY, b2.worldX, b2.worldY)) {
          g.moveTo(b1.worldX, b1.worldY).lineTo(b2.worldX, b2.worldY);
        }
      }

      const last = bones[bones.length - 1];
      const tx = c.target.worldX, ty = c.target.worldY;
      if (this.isSegmentVisible(last.worldX, last.worldY, tx, ty)) {
        g.moveTo(last.worldX, last.worldY).lineTo(tx, ty);
      }

      if (this.isCircleVisible(tx, ty, 10)) {
        g.fill({ color: 0x00ffff, alpha: 0.3 })
          .circle(tx, ty, 10)
          .fill()
          .stroke({ color: 0x00ffff, width: 1, pixelLine: true })
          .moveTo(tx - 5, ty).lineTo(tx + 5, ty)
          .moveTo(tx, ty - 5).lineTo(tx, ty + 5);
      }
    }
  }

  private drawTransformConstraints(skel: any, dbg: DebugDisplayObjects): void {
    const g = dbg.transformConstraints;
    g.stroke({ color: 0xffff00, width: 1, pixelLine: true });

    for (const c of skel.transformConstraints as any[] || []) {
      if (!c?.isActive?.()) continue;
      const target = c.target;
      const tx = target.worldX, ty = target.worldY;

      for (const bone of c.bones as any[]) {
        if (this.isSegmentVisible(bone.worldX, bone.worldY, tx, ty)) {
          g.moveTo(bone.worldX, bone.worldY).lineTo(tx, ty);
        }
      }

      if (this.isCircleVisible(tx, ty, 10)) {
        g.fill({ color: 0xffff00, alpha: 0.3 })
          .circle(tx, ty, 10)
          .fill()
          .stroke({ color: 0xffff00, width: 1, pixelLine: true })
          .rect(tx - 5, ty - 5, 10, 10);
      }
    }
  }

  private drawPathConstraints(skel: any, dbg: DebugDisplayObjects): void {
    const g = dbg.pathConstraints;

    for (const c of skel.pathConstraints as any[] || []) {
      if (!c?.isActive?.()) continue;

      const world = c.world as number[] | undefined;
      if (world && world.length > 0 && this.isPolylineVisible(world, 3, 0, 1)) {
        g.stroke({ color: 0x00ff00, width: 1, pixelLine: true }).moveTo(world[0], world[1]);
        for (let i = 3; i < world.length; i += 3) {
          const px = world[i], py = world[i + 1];
          g.lineTo(px, py);
          if (this.isCircleVisible(px, py, 3)) {
            g.fill({ color: 0x00ff00, alpha: 0.4 }).circle(px, py, 3).fill();
          }
        }
      }

      // Connect bones to nearest path point (simple nearest)
      const bones = c.bones as any[];
      if (world && world.length > 0) {
        for (const bone of bones) {
          let closestIdx = 0;
          let best = Number.POSITIVE_INFINITY;
          for (let i = 0; i < world.length; i += 3) {
            const dx = world[i] - bone.worldX;
            const dy = world[i + 1] - bone.worldY;
            const d2 = dx * dx + dy * dy;
            if (d2 < best) {
              best = d2;
              closestIdx = i;
            }
          }
          const px = world[closestIdx], py = world[closestIdx + 1];
          if (this.isSegmentVisible(bone.worldX, bone.worldY, px, py)) {
            g.stroke({ color: 0x00ff00, width: 1, pixelLine: true, alpha: 0.5 })
              .moveTo(bone.worldX, bone.worldY)
              .lineTo(px, py);
          }
        }
      }

      const tx = c.target.bone.worldX, ty = c.target.bone.worldY;
      if (this.isCircleVisible(tx, ty, 15)) {
        g.stroke({ color: 0x00ff00, width: 1, pixelLine: true })
          .fill({ color: 0x00ff00, alpha: 0.2 })
          .circle(tx, ty, 15)
          .fill();
      }
    }
  }

  // --------------------
  // Misc helpers
  // --------------------
  private drawSpring(g: Graphics, x: number, y: number, length: number, angleDeg: number): void {
    const rad = (angleDeg * Math.PI) / 180;
    const dx = length * Math.cos(rad);
    const dy = length * Math.sin(rad);

    const springLength = 30;
    const springX = x + dx * 0.3;
    const springY = y + dy * 0.3;

    if (!this.isCircleVisible(springX, springY, springLength + 12)) return;

    g.stroke({ color: 0xff00ff, width: 1, pixelLine: true }).moveTo(springX, springY);

    const coils = 5;
    const coilWidth = 10;
    const coilSpacing = springLength / coils;

    for (let i = 0; i <= coils; i++) {
      const cx = springX + i * coilSpacing;
      const cy = springY + (i % 2 === 0 ? -coilWidth : coilWidth);
      g.lineTo(cx, cy);
    }
  }
}

// =========================
// CameraContainer
// =========================
export class CameraContainer extends Container {
  originalWidth: number;
  originalHeight: number;
  app: Application;
  isDragging = false;
  lastPosition: { x: number; y: number } | null = null;

  debugFlags: DebugFlags = {
    showBones: false,
    showRegionAttachments: false,
    showMeshTriangles: false,
    showMeshHull: false,
    showBoundingBoxes: false,
    showPaths: false,
    showClipping: false,
    showPhysics: false,
    showIkConstraints: false,
    showTransformConstraints: false,
    showPathConstraints: false,
    cullToViewport: true,
  };

  debugRenderer: CustomSpineDebugRenderer | null = null;
  currentSpine: Spine | null = null;

  constructor(options: { width: number; height: number; app: Application }) {
    super();
    this.originalWidth = options.width;
    this.originalHeight = options.height;
    this.app = options.app;

    // Use our custom renderer (no SpineDebugRenderer)
    this.debugRenderer = new CustomSpineDebugRenderer(this.app);

    this.setupEventListeners();

    // Center initially
    this.x = this.app.renderer.width / 2;
    this.y = this.app.renderer.height / 2;

    // Resize
    this.onResize = this.onResize.bind(this);
    window.addEventListener("resize", this.onResize);
  }

  private setupEventListeners(): void {
    const view = this.app.canvas as HTMLCanvasElement | undefined;
    if (!view) return;

    view.addEventListener("mousedown", (e: MouseEvent) => {
      if (e.button !== 0) return;
      this.isDragging = true;
      this.lastPosition = { x: e.clientX, y: e.clientY };
      view.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e: MouseEvent) => {
      if (!this.isDragging || !this.lastPosition) return;
      const dx = e.clientX - this.lastPosition.x;
      const dy = e.clientY - this.lastPosition.y;
      this.x += dx;
      this.y += dy;
      this.lastPosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("mouseup", (e: MouseEvent) => {
      if (e.button !== 0) return;
      this.isDragging = false;
      this.lastPosition = null;
      view.style.cursor = "default";
    });

    view.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        e.preventDefault();
        const scrollDirection = Math.sign(e.deltaY);
        const minScale = 0.2;
        const maxScale = 10;
        const scaleStep = 0.1;

        let newScale = this.scale.x - scrollDirection * scaleStep;
        newScale = Math.max(minScale, Math.min(maxScale, newScale));
        newScale = Number((Math.ceil(newScale * 20) / 20).toFixed(2));

        this.scale.set(newScale);
        this.setCanvasScaleDebugInfo(newScale);
      },
      { passive: false }
    );
  }

  public onResize(): void {
    this.x = this.app.renderer.width / 2;
    this.y = this.app.renderer.height / 2;
  }

  public lookAtChild(spine: Spine): void {
    this.currentSpine = spine;

    if (this.debugRenderer) {
      this.debugRenderer.registerSpine(spine);

      // Ticker callback (ensure single reference)
      const tick = () => {
        if (!this.currentSpine || !this.debugRenderer) return;
        this.debugRenderer.setDebugFlags(this.debugFlags);
        const any = Object.values(this.debugFlags).some(Boolean);
        if (any) this.debugRenderer.renderDebug(this.currentSpine);
      };

      this.app.ticker.add(tick);
    }

    // Fit & center view around the spine
    const padding = 20;
    let bounds = spine.getBounds();
    if (bounds.width === 0 || bounds.height === 0) {
      // fallback to data size halves if bounds unavailable
      bounds.width = spine.skeleton.data.width / 2;
      bounds.height = spine.skeleton.data.height / 2;
    }

    const scaleX = (this.app.screen.width - padding * 2) / bounds.width;
    const scaleY = (this.app.screen.height - padding * 2) / bounds.height;
    let scale = Math.min(scaleX, scaleY);

    spine.scale.set(1);

    const x = this.app.screen.width / 2;
    const y = this.app.screen.height / 2;

    gsap.to(this, { x, y, duration: 1, ease: "power2.out" });

    scale = Number((Math.ceil(scale * 20) / 20).toFixed(2));
    this.scale.set(scale);
    this.setCanvasScaleDebugInfo(scale);
  }

  private setCanvasScaleDebugInfo(scale: number): void {
    const el = document.getElementById("scale-info");
    if (el) el.innerText = `Scale: x${scale.toFixed(2)}`;
  }

  private clearAllDebugGraphics(spine: Spine): void {
    // Since it's all ours, just clear all layers
    const dbg = this.debugRenderer && (this.debugRenderer as any)["registeredSpines"]?.get(spine);
    if (!dbg) return;
    dbg.bones?.clear?.();
    dbg.regions?.clear?.();
    dbg.meshTriangles?.clear?.();
    dbg.meshHull?.clear?.();
    dbg.boundingBoxes?.clear?.();
    dbg.paths?.clear?.();
    dbg.clipping?.clear?.();
    dbg.physicsConstraints?.clear?.();
    dbg.ikConstraints?.clear?.();
    dbg.transformConstraints?.clear?.();
    dbg.pathConstraints?.clear?.();

    this.app.renderer.render(this.app.stage);
  }

  public setDebugFlags(flags: Partial<DebugFlags>): void {
    this.debugFlags = { ...this.debugFlags, ...flags };
    this.debugRenderer?.setDebugFlags(this.debugFlags);
  }

  public getDebugFlags(): DebugFlags {
    return { ...this.debugFlags };
  }

  public toggleMeshes(visible?: boolean): void {
    const v = visible ?? !this.debugFlags.showMeshTriangles;
    this.debugFlags.showMeshTriangles = v;
    this.debugFlags.showMeshHull = v;
    this.debugFlags.showRegionAttachments = v; // keep together for quick look
    this.debugFlags.showBoundingBoxes = v;     // usually handy together
    this.debugFlags.showPaths = v;
    this.debugFlags.showClipping = v;
    this.debugFlags.showBones = v;
    this.debugRenderer?.setDebugFlags(this.debugFlags);
    if (!v && this.currentSpine) this.clearAllDebugGraphics(this.currentSpine);
  }

  public togglePhysics(visible?: boolean): void {
    const v = visible ?? !this.debugFlags.showPhysics;
    this.debugFlags.showPhysics = v;
    this.debugFlags.showTransformConstraints = v;
    this.debugFlags.showPathConstraints = v;
    this.debugRenderer?.setDebugFlags(this.debugFlags);
    if (!v && this.currentSpine) this.clearAllDebugGraphics(this.currentSpine);
  }

  public toggleIkConstraints(visible?: boolean): void {
    const v = visible ?? !this.debugFlags.showIkConstraints;
    this.debugFlags.showIkConstraints = v;
    this.debugRenderer?.setDebugFlags(this.debugFlags);
    if (!v && this.currentSpine) this.clearAllDebugGraphics(this.currentSpine);
  }

  public forceResetDebugGraphics(): void {
    if (!this.currentSpine || !this.debugRenderer) return;
    this.debugRenderer.unregisterSpine(this.currentSpine);
    this.debugRenderer = new CustomSpineDebugRenderer(this.app);
    this.debugRenderer.registerSpine(this.currentSpine);
    this.debugRenderer.setDebugFlags(this.debugFlags);
    this.app.renderer.render(this.app.stage);
  }

  public centerViewport(): void {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    gsap.to(this, { x: w / 2, y: h / 2, duration: 0.5, ease: "power2.out" });
  }

  public override destroy(): void {
    window.removeEventListener("resize", this.onResize);
    if (this.currentSpine && this.debugRenderer) {
      this.debugRenderer.unregisterSpine(this.currentSpine);
    }
    super.destroy();
  }
}

```


## src\core\SpineAnalyzer.ts

```
import { Spine } from "@esotericsoftware/spine-pixi-v8";
import { BenchmarkData } from "../hooks/useSpineApp";
import { analyzeMeshes } from "./analyzers/meshAnalyzer";
import { analyzeClipping } from "./analyzers/clippingAnalyzer";
import { analyzeBlendModes } from "./analyzers/blendModeAnalyzer";
import { createSkeletonTree } from "./analyzers/skeletonAnalyzer";
import { analyzePhysics } from "./analyzers/physicsAnalyzer";
import { PERFORMANCE_FACTORS } from "./constants/performanceFactors";
import { calculateOverallScore } from "./utils/scoreCalculator";
import { generateSummary } from "./generators/summaryGenerator";

/**
 * Main SpineAnalyzer class that coordinates analysis of Spine instances
 */
export class SpineAnalyzer {
  /**
   * Analyzes a Spine instance and returns comprehensive benchmark data
   * @param spineInstance The Spine instance to analyze
   * @returns Benchmark data with HTML and metrics for each component
   */
  static analyze(spineInstance: Spine): BenchmarkData {
    // Analyze all components
    const meshAnalysisResults = analyzeMeshes(spineInstance);
    const clippingAnalysisResults = analyzeClipping(spineInstance);
    const blendModeAnalysisResults = analyzeBlendModes(spineInstance);
    const skeletonAnalysisResults = createSkeletonTree(spineInstance);
    const physicsAnalysisResults = analyzePhysics(spineInstance);
    
    // Extract HTML output and metrics
    const { html: meshAnalysis, metrics: meshMetrics } = meshAnalysisResults;
    const { html: clippingAnalysis, metrics: clippingMetrics } = clippingAnalysisResults;
    const { html: blendModeAnalysis, metrics: blendModeMetrics } = blendModeAnalysisResults;
    const { html: skeletonTree, metrics: boneMetrics } = skeletonAnalysisResults;
    const { html: physicsAnalysis, metrics: constraintMetrics } = physicsAnalysisResults;
    
    // Calculate overall performance score
    const componentScores = {
      boneScore: boneMetrics.score,
      meshScore: meshMetrics.score,
      clippingScore: clippingMetrics.score,
      blendModeScore: blendModeMetrics.score,
      constraintScore: constraintMetrics.score
    };
    
    const overallScore = calculateOverallScore(componentScores);
    
    // Generate summary with overall score
    const summary = generateSummary(
      spineInstance,
      boneMetrics,
      meshMetrics,
      clippingMetrics,
      blendModeMetrics,
      constraintMetrics,
      overallScore
    );
    
    // Return all analysis data
    return {
      meshAnalysis,
      clippingAnalysis,
      blendModeAnalysis,
      skeletonTree,
      physicsAnalysis,
      summary
    };
  }
}
```


## src\core\SpineLoader.ts

```
import {
  AtlasAttachmentLoader,
  SkeletonBinary,
  SkeletonData,
  SkeletonJson,
  Spine,
  SpineTexture,
  TextureAtlas,
} from '@esotericsoftware/spine-pixi-v8';
import { Application, Assets, Texture } from 'pixi.js';

export class SpineLoader {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  public async loadSpineFiles(files: FileList): Promise<Spine | null> {
    try {
      const acceptedFiles = Array.from(files);
      console.log('Processing files:', acceptedFiles.map(f => (f as any).fullPath || f.name).join(', '));
      
      // Initialize tracking variables
      let atlasFile: File | undefined;
      let jsonFile: File | undefined;
      let skelFile: File | undefined;
      let imageFiles: File[] = [];
      
      // First pass - categorize files
      acceptedFiles.forEach((file) => {
        const fileName = file.name;
        const fullPath = (file as any).fullPath || file.name;
        
        if (fileName.endsWith('.atlas')) {
          atlasFile = file;
          console.log("Atlas file found:", fullPath);
        } else if (fileName.endsWith('.json')) {
          jsonFile = file;
          console.log("JSON file found:", fullPath);
        } else if (fileName.endsWith('.skel')) {
          skelFile = file;
          console.log("Skel file found:", fullPath);
        } else if (file.type.startsWith('image/') || 
                  fileName.endsWith('.png') || 
                  fileName.endsWith('.jpg') ||
                  fileName.endsWith('.jpeg') || 
                  fileName.endsWith('.webp')) {
          imageFiles.push(file);
          console.log("Image file found:", fullPath);
        } else {
          console.log("Unrecognized file type:", fullPath);
        }
      });
      
      // Validate required files
      if (!atlasFile) {
        throw new Error('Missing atlas file (.atlas). Please include an atlas file with your Spine data.');
      }
      
      if (!jsonFile && !skelFile) {
        throw new Error('Missing skeleton file (.json or .skel). Please include a skeleton file with your Spine data.');
      }
      
      if (imageFiles.length === 0) {
        throw new Error('Missing image files. Please include image files referenced by your atlas.');
      }
      
      // Read atlas content
      const atlasText = await this.readFileAsText(atlasFile);
      
      // Load skeleton data
      let skeletonData;
      const isBinary = !!skelFile;
      
      if (skelFile) {
        console.log('Binary Format')
        // Binary format
        skeletonData = await this.readFileAsArrayBuffer(skelFile);
      } else if (jsonFile) {
        console.log('JSON Format')
        // JSON format
        const jsonText = await this.readFileAsText(jsonFile);
        try {
          skeletonData = JSON.parse(jsonText);
          
          // Check for Spine 4.1 vs 4.2 version
          if (skeletonData && skeletonData.spine && skeletonData.spine.startsWith('4.1')) {
            console.log('Updating Spine version from 4.1 to 4.2.0');
            skeletonData.spine = '4.2.0';
          }
        } catch (error) {
          console.error("Error parsing JSON:", error);
          throw new Error("Invalid JSON format in skeleton file");
        }
      }
      
      // Extract image names from atlas
      const imageNames = this.extractImageNamesFromAtlas(atlasText);
      console.log("Image names referenced in atlas:", imageNames);
      
      // Create asset bundle
      const assetBundle: Record<string, any> = {};
      
      // Process each image file
      for (const imageFile of imageFiles) {
        const base64 = await this.fileToBase64(imageFile);
        const fileName = this.getFileName(imageFile.name);
        
        // Store with filename as key
        assetBundle[fileName] = {
          src: base64,
          data: { type: imageFile.type || 'image/png' }
        };
        
        // Also store without extension for better matching
        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        if (fileNameWithoutExt) {
          assetBundle[fileNameWithoutExt] = {
            src: base64,
            data: { type: imageFile.type || 'image/png' }
          };
        }
      }
      
      // Load textures
      Assets.addBundle('spineAssets', assetBundle);
      const textures = await Assets.loadBundle('spineAssets');
      
      // Create spine asset
      return await this.createSpineAsset(skeletonData, atlasText, textures, isBinary);
      
    } catch (error) {
      console.error('Error loading Spine files:', error);
      throw error;
    }
  }

  private getFileName(path: string): string {
    // Extract just the filename without path
    return path.split('/').pop() || path;
  }
  
  private extractImageNamesFromAtlas(atlasText: string): string[] {
    const lines = atlasText.split('\n');
    const imageNames: string[] = [];
    
    // In spine atlas format, the image names are the first non-empty lines 
    // before each "size:" line
    let currentName = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === '') continue;
      
      if (line.startsWith('size:')) {
        if (currentName && !imageNames.includes(currentName)) {
          imageNames.push(currentName);
        }
        currentName = '';
      } else if (currentName === '') {
        // If we don't have a current name and this line is not a property,
        // it must be an image name
        if (!line.includes(':')) {
          currentName = line;
        }
      }
    }
    
    // Add the last image name if we have one
    if (currentName && !imageNames.includes(currentName)) {
      imageNames.push(currentName);
    }
    
    return imageNames;
  }
  
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  private async createSpineAsset(
    data: any, 
    atlasText: string, 
    textures: Record<string, Texture>,
    isBinary: boolean
  ): Promise<Spine> {
    console.log(`Creating ${isBinary ? 'Binary' : 'JSON'} Spine Asset`);

    // Create atlas
    const spineAtlas = new TextureAtlas(atlasText);
    
    // Process each page in the atlas
    for (const page of spineAtlas.pages) {
      const pageName = page.name;
      
      // Try different ways to match the texture
      let texture = textures[pageName];
      
      if (!texture) {
        // Try without path
        const baseFileName = this.getFileName(pageName);
        texture = textures[baseFileName];
        
        if (!texture) {
          // Try without extension
          const baseNameWithoutExt = baseFileName.substring(0, baseFileName.lastIndexOf('.'));
          if (baseNameWithoutExt) {
            texture = textures[baseNameWithoutExt];
          }
        }
      }

      if (!texture) {
        console.error(`Missing texture for page: ${pageName}`);
        console.log("Available textures:", Object.keys(textures).join(", "));
        throw new Error(`Missing texture for page: ${pageName}`);
      }

      // Create SpineTexture from the PIXI Texture
      const spineTexture = SpineTexture.from(texture.source);
      
      // Set the texture for the page
      page.setTexture(spineTexture);
    }

    // Create attachment loader
    const atlasLoader = new AtlasAttachmentLoader(spineAtlas);

    // Create skeleton data
    let skeletonData: SkeletonData | undefined = undefined;

    if(isBinary) {
      const skeletonBinary = new SkeletonBinary(atlasLoader);
      console.log(skeletonBinary)
     skeletonData = skeletonBinary.readSkeletonData(data);
    } else {
      const skeletonJson = new SkeletonJson(atlasLoader);
      console.log(skeletonJson)
     skeletonData = skeletonJson.readSkeletonData(data);
    }
    
    // Create spine instance
    return new Spine(skeletonData);
  }
}
```


## src\core\analyzers\blendModeAnalyzer.ts

```
import { BlendMode, Spine } from "@esotericsoftware/spine-pixi-v8";
import { PERFORMANCE_FACTORS } from "../constants/performanceFactors";
import { calculateBlendModeScore, getScoreColor } from "../utils/scoreCalculator";
import i18n from "../../i18n";

/**
 * Analyzes blend modes in a Spine instance
 * @param spineInstance The Spine instance to analyze
 * @returns HTML output and metrics for blend mode analysis
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
```


## src\core\analyzers\clippingAnalyzer.ts

```
import { ClippingAttachment, Spine } from '@esotericsoftware/spine-pixi-v8';
import { PERFORMANCE_FACTORS } from '../constants/performanceFactors';
import { calculateClippingScore, getScoreColor } from '../utils/scoreCalculator';
import i18n from '../../i18n';

/**
 * Analyzes clipping masks in a Spine instance
 * @param spineInstance The Spine instance to analyze
 * @returns HTML output and metrics for clipping mask analysis
 */
export function analyzeClipping(spineInstance: Spine): { html: string, metrics: any } {
  const masks: [string, number][] = [];
  let totalVertices = 0;
  
  spineInstance.skeleton.slots.forEach((slot) => {
    if (slot.attachment && slot.attachment instanceof ClippingAttachment) {
      const clipping = slot.attachment as ClippingAttachment;
      const verticesCount = clipping.worldVerticesLength / 2; // Divide by 2 because each vertex has x and y
      masks.push([slot.data.name, verticesCount]);
      totalVertices += verticesCount;
    }
  });
  
  // Calculate complexity metrics
  const complexMasks = masks.filter(([_, vertexCount]) => vertexCount > 4).length;
  
  // Calculate clipping score
  const clippingScore = calculateClippingScore(masks.length, totalVertices, complexMasks);
  
  const metrics = {
    maskCount: masks.length,
    totalVertices,
    complexMasks,
    score: clippingScore
  };
  
  let html = `
    <div class="clipping-analysis">
      <h3>${i18n.t('analysis.clipping.title')}</h3>
      <p>${i18n.t('analysis.clipping.statistics.totalMasks', { count: masks.length })}</p>
      <p>${i18n.t('analysis.clipping.statistics.totalVerticesInMasks', { count: totalVertices })}</p>
      <p>${i18n.t('analysis.clipping.statistics.complexMasks', { count: complexMasks })}</p>
      
      <div class="performance-score">
        <h4>${i18n.t('analysis.clipping.performanceScore.title', { score: clippingScore.toFixed(1) })}</h4>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${clippingScore}%; background-color: ${getScoreColor(clippingScore)};"></div>
        </div>
      </div>
      
      <div class="analysis-metrics">
        <p><strong>${i18n.t('analysis.clipping.formula.title')}</strong></p>
        <code>${i18n.t('analysis.clipping.formula.description', { idealClippingCount: PERFORMANCE_FACTORS.IDEAL_CLIPPING_COUNT })}</code>
      </div>
  `;
  
  if (masks.length > 0) {
    html += `
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>${i18n.t('analysis.clipping.tableHeaders.slotName')}</th>
            <th>${i18n.t('analysis.clipping.tableHeaders.vertexCount')}</th>
            <th>${i18n.t('analysis.clipping.tableHeaders.status')}</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    masks.forEach(([slotName, vertexCount]) => {
      const status = vertexCount <= 4 
        ? i18n.t('analysis.clipping.status.optimal')
        : vertexCount <= 8 
          ? i18n.t('analysis.clipping.status.acceptable')
          : i18n.t('analysis.clipping.status.highVertexCount');
      
      const rowClass = vertexCount <= 4 
        ? '' 
        : vertexCount <= 8 
          ? 'row-warning' 
          : 'row-danger';
      
      html += `
        <tr class="${rowClass}">
          <td>${slotName}</td>
          <td>${vertexCount}</td>
          <td>${status}</td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
      
      <div class="analysis-notes">
        <h4>${i18n.t('analysis.clipping.notes.title')}</h4>
        <ul>
          <li><strong>${i18n.t('analysis.clipping.notes.highImpact')}</strong></li>
          <li><strong>${i18n.t('analysis.clipping.notes.vertexCount')}</strong></li>
          <li><strong>${i18n.t('analysis.clipping.notes.optimalConfiguration')}</strong></li>
          <li><strong>${i18n.t('analysis.clipping.notes.gpuCost')}</strong></li>
          <li><strong>${i18n.t('analysis.clipping.notes.recommendation')}</strong></li>
        </ul>
      </div>
    `;
  } else {
    html += `<p>${i18n.t('analysis.clipping.noMasks')}</p>`;
  }
  
  html += `</div>`;
  
  return {html, metrics};
}
```


## src\core\analyzers\meshAnalyzer.ts

```
import { DeformTimeline, MeshAttachment, Spine } from "@esotericsoftware/spine-pixi-v8";
import { PERFORMANCE_FACTORS } from "../constants/performanceFactors";
import { calculateMeshScore, getScoreColor } from "../utils/scoreCalculator";
import i18n from "../../i18n";

/**
 * Analyzes mesh attachments in a Spine instance
 * @param spineInstance The Spine instance to analyze
 * @returns HTML output and metrics for mesh analysis
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
```


## src\core\analyzers\physicsAnalyzer.ts

```
import { Spine } from "@esotericsoftware/spine-pixi-v8";
import { PERFORMANCE_FACTORS } from "../constants/performanceFactors";
import { getScoreColor } from "../utils/scoreCalculator";
import i18n from "../../i18n";

/**
 * Analyzes physics and other constraints in a Spine instance
 * @param spineInstance The Spine instance to analyze
 * @returns HTML output and metrics for constraints analysis
 */
export function analyzePhysics(spineInstance: Spine): { html: string, metrics: any } {
  const skeleton = spineInstance.skeleton;
  
  // Get all constraints
  const ikConstraints = skeleton.ikConstraints;
  const transformConstraints = skeleton.transformConstraints;
  const pathConstraints = skeleton.pathConstraints;
  const physicsConstraints = skeleton.physicsConstraints || [];  // May be undefined in older versions
  
  // Analyze IK Constraints
  const ikData = ikConstraints.map(constraint => ({
    name: constraint.data.name,
    target: constraint.target.data.name,
    bones: constraint.bones.map(bone => bone.data.name),
    mix: constraint.mix,
    softness: constraint.softness,
    bendDirection: constraint.bendDirection,
    compress: constraint.compress,
    stretch: constraint.stretch,
    isActive: constraint.isActive()
  }));
  
  // Analyze Transform Constraints
  const transformData = transformConstraints.map(constraint => ({
    name: constraint.data.name,
    target: constraint.target.data.name,
    bones: constraint.bones.map(bone => bone.data.name),
    mixRotate: constraint.mixRotate,
    mixX: constraint.mixX,
    mixY: constraint.mixY,
    mixScaleX: constraint.mixScaleX,
    mixScaleY: constraint.mixScaleY,
    mixShearY: constraint.mixShearY,
    isActive: constraint.isActive(),
    isLocal: constraint.data.local,
    isRelative: constraint.data.relative
  }));
  
  // Analyze Path Constraints
  const pathData = pathConstraints.map(constraint => {
    const positionMode = constraint.data.positionMode; // Fixed or Percent
    const spacingMode = constraint.data.spacingMode; // Length, Fixed, Percent, or Proportional
    const rotateMode = constraint.data.rotateMode; // Tangent, Chain, or ChainScale
    
    return {
      name: constraint.data.name,
      target: constraint.target.data.name,
      bones: constraint.bones.map(bone => bone.data.name),
      mixRotate: constraint.mixRotate,
      mixX: constraint.mixX,
      mixY: constraint.mixY,
      position: constraint.position,
      spacing: constraint.spacing,
      positionMode: positionMode,
      spacingMode: spacingMode,
      rotateMode: rotateMode,
      offsetRotation: constraint.data.offsetRotation,
      isActive: constraint.isActive(),
      // Track complexity: world positions, curves, segments arrays
      worldPositionsCount: constraint.world ? constraint.world.length / 3 : 0,
      hasSegments: constraint.segments && constraint.segments.length > 0,
      hasLengths: constraint.lengths && constraint.lengths.length > 0
    };
  });
  
  // Analyze Physics Constraints
  const physicsData = physicsConstraints.map(constraint => ({
    name: constraint.data.name,
    bone: constraint.bone.data.name,
    inertia: constraint.inertia,
    strength: constraint.strength,
    damping: constraint.damping,
    massInverse: constraint.massInverse,
    wind: constraint.wind,
    gravity: constraint.gravity,
    mix: constraint.mix,
    affectsX: constraint.data.x > 0,
    affectsY: constraint.data.y > 0,
    affectsRotation: constraint.data.rotate > 0,
    affectsScale: constraint.data.scaleX > 0,
    affectsShear: constraint.data.shearX > 0,
    isActive: constraint.isActive()
  }));
  
  // Calculate constraint performance impact scores
  const ikImpact = calculateIkImpact(ikData);
  const transformImpact = calculateTransformImpact(transformData);
  const pathImpact = calculatePathImpact(pathData);
  const physicsImpact = calculatePhysicsImpact(physicsData);
  
  // Total constraints
  const totalConstraints = ikConstraints.length + transformConstraints.length + 
                           pathConstraints.length + physicsConstraints.length;
  
  // Calculate constraint score based on weighted impacts
  let constraintScore = 100;
  
  if (totalConstraints > 0) {
    const totalWeightedImpact = 
      (ikImpact * PERFORMANCE_FACTORS.IK_WEIGHT) +
      (transformImpact * PERFORMANCE_FACTORS.TRANSFORM_WEIGHT) +
      (pathImpact * PERFORMANCE_FACTORS.PATH_WEIGHT) +
      (physicsImpact * PERFORMANCE_FACTORS.PHYSICS_WEIGHT);
    
    constraintScore = Math.max(0, 100 - (totalWeightedImpact * 0.5));
  }
  
  // Generate HTML output
  let html = `
    <div class="physics-analysis">
      <h3>${i18n.t('analysis.physics.title')}</h3>
      <p>${i18n.t('analysis.physics.statistics.totalConstraints', { count: totalConstraints })}</p>
      
      <div class="performance-score">
        <h4>${i18n.t('analysis.physics.performanceScore.title', { score: constraintScore.toFixed(1) })}</h4>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${constraintScore}%; background-color: ${getScoreColor(constraintScore)};"></div>
        </div>
      </div>
      
      <div class="analysis-metrics">
        <p><strong>${i18n.t('analysis.physics.formula.title')}</strong></p>
        <code>${i18n.t('analysis.physics.formula.description')}</code>
        <p>${i18n.t('analysis.physics.formula.explanation')}</p>
      </div>
      
      <div class="constraint-summary">
        <h4>${i18n.t('analysis.physics.impactBreakdown.title')}</h4>
        <table class="benchmark-table">
          <thead>
            <tr>
              <th>${i18n.t('analysis.physics.impactBreakdown.tableHeaders.constraintType')}</th>
              <th>${i18n.t('analysis.physics.impactBreakdown.tableHeaders.count')}</th>
              <th>${i18n.t('analysis.physics.impactBreakdown.tableHeaders.impactLevel')}</th>
              <th>${i18n.t('analysis.physics.impactBreakdown.tableHeaders.weightedImpact')}</th>
            </tr>
          </thead>
          <tbody>
            <tr class="${ikImpact > 50 ? 'row-warning' : ''}">
              <td>${i18n.t('analysis.physics.constraintTypes.ik')}</td>
              <td>${ikConstraints.length}</td>
              <td>${ikImpact.toFixed(1)}%</td>
              <td>${(ikImpact * PERFORMANCE_FACTORS.IK_WEIGHT).toFixed(1)}%</td>
            </tr>
            <tr class="${transformImpact > 50 ? 'row-warning' : ''}">
              <td>${i18n.t('analysis.physics.constraintTypes.transform')}</td>
              <td>${transformConstraints.length}</td>
              <td>${transformImpact.toFixed(1)}%</td>
              <td>${(transformImpact * PERFORMANCE_FACTORS.TRANSFORM_WEIGHT).toFixed(1)}%</td>
            </tr>
            <tr class="${pathImpact > 50 ? 'row-warning' : ''}">
              <td>${i18n.t('analysis.physics.constraintTypes.path')}</td>
              <td>${pathConstraints.length}</td>
              <td>${pathImpact.toFixed(1)}%</td>
              <td>${(pathImpact * PERFORMANCE_FACTORS.PATH_WEIGHT).toFixed(1)}%</td>
            </tr>
            <tr class="${physicsImpact > 50 ? 'row-warning' : ''}">
              <td>${i18n.t('analysis.physics.constraintTypes.physics')}</td>
              <td>${physicsConstraints.length}</td>
              <td>${physicsImpact.toFixed(1)}%</td>
              <td>${(physicsImpact * PERFORMANCE_FACTORS.PHYSICS_WEIGHT).toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>
  `;
  
  // Add constraint details if any exist
  if (totalConstraints > 0) {
    // IK Constraints Table
    if (ikData.length > 0) {
      html += createIkTable(ikData);
    }
    
    // Transform Constraints Table
    if (transformData.length > 0) {
      html += createTransformTable(transformData);
    }
    
    // Path Constraints Table
    if (pathData.length > 0) {
      html += createPathTable(pathData);
    }
    
    // Physics Constraints Table
    if (physicsData.length > 0) {
      html += createPhysicsTable(physicsData);
    }
    
    // Add general notes about constraints
    html += `
      <div class="analysis-notes">
        <h4>${i18n.t('analysis.physics.notes.title')}</h4>
        <ul>
          <li><strong>${i18n.t('analysis.physics.constraintTypes.ik')}:</strong> ${i18n.t('analysis.physics.notes.ikConstraints')}</li>
          <li><strong>${i18n.t('analysis.physics.constraintTypes.physics')}:</strong> ${i18n.t('analysis.physics.notes.physicsConstraints')}</li>
          <li><strong>${i18n.t('analysis.physics.constraintTypes.path')}:</strong> ${i18n.t('analysis.physics.notes.pathConstraints')}</li>
          <li><strong>${i18n.t('analysis.physics.constraintTypes.transform')}:</strong> ${i18n.t('analysis.physics.notes.transformConstraints')}</li>
          <li><strong>${i18n.t('analysis.physics.notes.recommendation').split(':')[0]}:</strong> ${i18n.t('analysis.physics.notes.recommendation').split(':')[1]}</li>
        </ul>
      </div>
    `;
  } else {
    html += `<p>${i18n.t('analysis.physics.noConstraints')}</p>`;
  }
  
  html += `</div>`;
  
  return {
    html, 
    metrics: {
      ikCount: ikConstraints.length,
      transformCount: transformConstraints.length,
      pathCount: pathConstraints.length,
      physicsCount: physicsConstraints.length,
      totalConstraints,
      ikImpact,
      transformImpact,
      pathImpact,
      physicsImpact,
      score: constraintScore
    }
  };
}

/**
 * Calculate the performance impact of IK constraints
 * @param ikData Array of IK constraint data
 * @returns Impact score from 0-100
 */
function calculateIkImpact(ikData: any[]): number {
  if (ikData.length === 0) return 0;
  
  // Base impact from constraint count (logarithmic scaling)
  let impact = Math.log2(ikData.length + 1) * 20;
  
  // Add impact from bone chain complexity
  let totalBones = 0;
  let maxChainLength = 0;
  
  ikData.forEach(ik => {
    totalBones += ik.bones.length;
    maxChainLength = Math.max(maxChainLength, ik.bones.length);
  });
  
  // Add impact based on total bones in constraints
  impact += Math.log2(totalBones + 1) * 10;
  
  // Add penalty for very long chains (exponential cost)
  if (maxChainLength > 2) {
    impact += Math.pow(maxChainLength, PERFORMANCE_FACTORS.IK_CHAIN_LENGTH_FACTOR) * 2;
  }
  
  return Math.min(100, impact);
}

/**
 * Calculate the performance impact of transform constraints
 * @param transformData Array of transform constraint data
 * @returns Impact score from 0-100
 */
function calculateTransformImpact(transformData: any[]): number {
  if (transformData.length === 0) return 0;
  
  // Base impact from constraint count (logarithmic scaling)
  let impact = Math.log2(transformData.length + 1) * 15;
  
  // Add impact from bone count
  let totalBones = 0;
  transformData.forEach(t => {
    totalBones += t.bones.length;
  });
  
  // Add impact based on total bones
  impact += Math.log2(totalBones + 1) * 8;
  
  // Add impact based on property complexity
  let propertyComplexity = 0;
  transformData.forEach(t => {
    // Count how many properties are affected (mixRotate, mixX, etc.)
    let affectedProps = 0;
    if (t.mixRotate > 0) affectedProps++;
    if (t.mixX > 0) affectedProps++;
    if (t.mixY > 0) affectedProps++;
    if (t.mixScaleX > 0) affectedProps++;
    if (t.mixScaleY > 0) affectedProps++;
    if (t.mixShearY > 0) affectedProps++;
    
    propertyComplexity += affectedProps;
  });
  
  // Add property complexity impact
  impact += propertyComplexity * 5;
  
  return Math.min(100, impact);
}

/**
 * Calculate the performance impact of path constraints
 * @param pathData Array of path constraint data
 * @returns Impact score from 0-100
 */
function calculatePathImpact(pathData: any[]): number {
  if (pathData.length === 0) return 0;
  
  // Base impact from constraint count (logarithmic scaling)
  let impact = Math.log2(pathData.length + 1) * 20;
  
  // Add impact from bone count
  let totalBones = 0;
  pathData.forEach(p => {
    totalBones += p.bones.length;
  });
  
  // Add impact based on total bones
  impact += Math.log2(totalBones + 1) * 10;
  
  // Add impact based on mode complexity
  let modeComplexity = 0;
  pathData.forEach(p => {
    // ChainScale is more expensive than Chain, which is more expensive than Tangent
    if (p.rotateMode === 2) modeComplexity += 3; // ChainScale
    else if (p.rotateMode === 1) modeComplexity += 2; // Chain
    else modeComplexity += 1; // Tangent
    
    // Proportional spacing is more complex
    if (p.spacingMode === 3) modeComplexity += 2; // Proportional
    else modeComplexity += 1; // Other modes
    
    // Complex paths with many world positions
    if (p.worldPositionsCount > 20) modeComplexity += 2;
  });
  
  // Add mode complexity impact
  impact += modeComplexity * 7;
  
  return Math.min(100, impact);
}

/**
 * Calculate the performance impact of physics constraints
 * @param physicsData Array of physics constraint data
 * @returns Impact score from 0-100
 */
function calculatePhysicsImpact(physicsData: any[]): number {
  if (physicsData.length === 0) return 0;
  
  // Base impact from constraint count (logarithmic scaling)
  let impact = Math.log2(physicsData.length + 1) * 30;
  
  // Add impact based on property complexity
  let propertiesComplexity = 0;
  physicsData.forEach(p => {
    // Count affected properties
    let affectedProps = 0;
    if (p.affectsX) affectedProps++;
    if (p.affectsY) affectedProps++;
    if (p.affectsRotation) affectedProps++;
    if (p.affectsScale) affectedProps++;
    if (p.affectsShear) affectedProps++;
    
    // Higher damping/strength values can increase iteration count
    const iterationFactor = Math.max(1, 3 - p.damping) * p.strength / 50;
    
    // Wind and gravity add complexity
    const forceComplexity = (Math.abs(p.wind) > 0 ? 1 : 0) + (Math.abs(p.gravity) > 0 ? 1 : 0);
    
    propertiesComplexity += affectedProps * (1 + iterationFactor + forceComplexity);
  });
  
  // Add properties complexity impact
  impact += propertiesComplexity * 5;
  
  return Math.min(100, impact);
}

/**
 * Creates an HTML table for IK constraints
 */
function createIkTable(ikData: any[]): string {
  return `
    <div class="constraint-details">
      <h4>${i18n.t('analysis.physics.constraintDetails.ikConstraints.title')}</h4>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>${i18n.t('analysis.physics.constraintDetails.ikConstraints.tableHeaders.name')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.ikConstraints.tableHeaders.target')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.ikConstraints.tableHeaders.bones')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.ikConstraints.tableHeaders.mix')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.ikConstraints.tableHeaders.status')}</th>
          </tr>
        </thead>
        <tbody>
          ${ikData.map(ik => {
            const complexityClass = ik.bones.length > 2 ? 'row-warning' : '';
            
            return `
              <tr class="${complexityClass}">
                <td>${ik.name}</td>
                <td>${ik.target}</td>
                <td>${ik.bones.join(', ')}</td>
                <td>${ik.mix.toFixed(2)}</td>
                <td>${ik.isActive ? i18n.t('analysis.physics.status.active') : i18n.t('analysis.physics.status.inactive')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Creates an HTML table for transform constraints
 */
function createTransformTable(transformData: any[]): string {
  return `
    <div class="constraint-details">
      <h4>${i18n.t('analysis.physics.constraintDetails.transformConstraints.title')}</h4>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>${i18n.t('analysis.physics.constraintDetails.transformConstraints.tableHeaders.name')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.transformConstraints.tableHeaders.target')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.transformConstraints.tableHeaders.bones')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.transformConstraints.tableHeaders.properties')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.transformConstraints.tableHeaders.status')}</th>
          </tr>
        </thead>
        <tbody>
          ${transformData.map(t => {
            // List affected properties
            const props = [];
            if (t.mixRotate > 0) props.push(`${i18n.t('analysis.physics.properties.rotate')}: ${t.mixRotate.toFixed(2)}`);
            if (t.mixX > 0) props.push(`${i18n.t('analysis.physics.properties.x')}: ${t.mixX.toFixed(2)}`);
            if (t.mixY > 0) props.push(`${i18n.t('analysis.physics.properties.y')}: ${t.mixY.toFixed(2)}`);
            if (t.mixScaleX > 0) props.push(`${i18n.t('analysis.physics.properties.scaleX')}: ${t.mixScaleX.toFixed(2)}`);
            if (t.mixScaleY > 0) props.push(`${i18n.t('analysis.physics.properties.scaleY')}: ${t.mixScaleY.toFixed(2)}`);
            if (t.mixShearY > 0) props.push(`${i18n.t('analysis.physics.properties.shearY')}: ${t.mixShearY.toFixed(2)}`);
            
            const complexityClass = props.length > 3 ? 'row-warning' : '';
            
            return `
              <tr class="${complexityClass}">
                <td>${t.name}</td>
                <td>${t.target}</td>
                <td>${t.bones.join(', ')}</td>
                <td>${props.join(', ')}</td>
                <td>${t.isActive ? i18n.t('analysis.physics.status.active') : i18n.t('analysis.physics.status.inactive')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Creates an HTML table for path constraints
 */
function createPathTable(pathData: any[]): string {
  // Helper function to get readable mode names
  const getRotateModeName = (mode: number): string => {
    switch(mode) {
      case 0: return i18n.t('analysis.physics.modes.rotate.tangent');
      case 1: return i18n.t('analysis.physics.modes.rotate.chain');
      case 2: return i18n.t('analysis.physics.modes.rotate.chainScale');
      default: return `Unknown (${mode})`;
    }
  };
  
  const getSpacingModeName = (mode: number): string => {
    switch(mode) {
      case 0: return i18n.t('analysis.physics.modes.spacing.length');
      case 1: return i18n.t('analysis.physics.modes.spacing.fixed');
      case 2: return i18n.t('analysis.physics.modes.spacing.percent');
      case 3: return i18n.t('analysis.physics.modes.spacing.proportional');
      default: return `Unknown (${mode})`;
    }
  };
  
  return `
    <div class="constraint-details">
      <h4>${i18n.t('analysis.physics.constraintDetails.pathConstraints.title')}</h4>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>${i18n.t('analysis.physics.constraintDetails.pathConstraints.tableHeaders.name')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.pathConstraints.tableHeaders.target')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.pathConstraints.tableHeaders.bones')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.pathConstraints.tableHeaders.modes')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.pathConstraints.tableHeaders.status')}</th>
          </tr>
        </thead>
        <tbody>
          ${pathData.map(p => {
            const complexityClass = (p.rotateMode === 2 || p.bones.length > 3) ? 'row-warning' : '';
            
            return `
              <tr class="${complexityClass}">
                <td>${p.name}</td>
                <td>${p.target}</td>
                <td>${p.bones.join(', ')}</td>
                <td>${i18n.t('analysis.physics.properties.rotate')}: ${getRotateModeName(p.rotateMode)}, Spacing: ${getSpacingModeName(p.spacingMode)}</td>
                <td>${p.isActive ? i18n.t('analysis.physics.status.active') : i18n.t('analysis.physics.status.inactive')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Creates an HTML table for physics constraints
 */
function createPhysicsTable(physicsData: any[]): string {
  return `
    <div class="constraint-details">
      <h4>${i18n.t('analysis.physics.constraintDetails.physicsConstraints.title')}</h4>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>${i18n.t('analysis.physics.constraintDetails.physicsConstraints.tableHeaders.name')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.physicsConstraints.tableHeaders.bone')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.physicsConstraints.tableHeaders.properties')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.physicsConstraints.tableHeaders.parameters')}</th>
            <th>${i18n.t('analysis.physics.constraintDetails.physicsConstraints.tableHeaders.status')}</th>
          </tr>
        </thead>
        <tbody>
          ${physicsData.map(p => {
            // List affected properties
            const props = [];
            if (p.affectsX) props.push(i18n.t('analysis.physics.properties.x'));
            if (p.affectsY) props.push(i18n.t('analysis.physics.properties.y'));
            if (p.affectsRotation) props.push(i18n.t('analysis.physics.properties.rotation'));
            if (p.affectsScale) props.push(i18n.t('analysis.physics.properties.scale'));
            if (p.affectsShear) props.push(i18n.t('analysis.physics.properties.shear'));
            
            // Properties that affect simulation
            const params = [
              `${i18n.t('analysis.physics.parameters.inertia')}: ${p.inertia.toFixed(2)}`,
              `${i18n.t('analysis.physics.parameters.strength')}: ${p.strength.toFixed(2)}`,
              `${i18n.t('analysis.physics.parameters.damping')}: ${p.damping.toFixed(2)}`
            ];
            
            if (p.wind !== 0) params.push(`${i18n.t('analysis.physics.parameters.wind')}: ${p.wind.toFixed(2)}`);
            if (p.gravity !== 0) params.push(`${i18n.t('analysis.physics.parameters.gravity')}: ${p.gravity.toFixed(2)}`);
            
            const complexityClass = props.length > 2 ? 'row-warning' : '';
            
            return `
              <tr class="${complexityClass}">
                <td>${p.name}</td>
                <td>${p.bone}</td>
                <td>${props.join(', ')}</td>
                <td>${params.join(', ')}</td>
                <td>${p.isActive ? i18n.t('analysis.physics.status.active') : i18n.t('analysis.physics.status.inactive')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
```


## src\core\analyzers\skeletonAnalyzer.ts

```
import { Spine } from "@esotericsoftware/spine-pixi-v8";
import { PERFORMANCE_FACTORS } from "../constants/performanceFactors";
import { calculateBoneScore, calculateMaxDepth, getScoreColor } from "../utils/scoreCalculator";
import i18n from "../../i18n";

/**
 * Analyzes the skeleton structure of a Spine instance
 * @param spineInstance The Spine instance to analyze
 * @returns HTML output and metrics for skeleton structure analysis
 */
export function createSkeletonTree(spineInstance: Spine): { html: string, metrics: any } {
  const skeleton = spineInstance.skeleton;
  
  // Generate tree structure
  function buildBoneNode(bone: any): any {
    const children = bone.children || [];
    return {
      name: bone.data.name,
      type: 'bone',
      x: bone.x.toFixed(2),
      y: bone.y.toFixed(2),
      children: children.map(buildBoneNode)
    };
  }
  
  const rootBones = skeleton.bones.filter(bone => !bone.parent);
  const boneTree = rootBones.map(buildBoneNode);
  
  const maxDepth = calculateMaxDepth(boneTree);
  const totalBones = skeleton.bones.length;
  
  // Calculate bone score
  const boneScore = calculateBoneScore(totalBones, maxDepth);
  
  const metrics = {
    totalBones,
    rootBones: rootBones.length,
    maxDepth,
    score: boneScore
  };
  
  // Generate HTML for the tree
  function generateTreeHTML(nodes: any[]): string {
    if (nodes.length === 0) return '';
    
    let html = '<ul class="skeleton-tree">';
    
    nodes.forEach(node => {
      html += `<li class="tree-node">
        <span class="node-label">${i18n.t('analysis.skeleton.nodeLabel', { name: node.name, x: node.x, y: node.y })}</span>`;
      
      if (node.children && node.children.length > 0) {
        html += generateTreeHTML(node.children);
      }
      
      html += '</li>';
    });
    
    html += '</ul>';
    return html;
  }
  
  let html = `
    <div class="skeleton-tree-container">
      <h3>${i18n.t('analysis.skeleton.title')}</h3>
      <p>${i18n.t('analysis.skeleton.statistics.totalBones', { count: totalBones })}</p>
      <p>${i18n.t('analysis.skeleton.statistics.rootBones', { count: rootBones.length })}</p>
      <p>${i18n.t('analysis.skeleton.statistics.maxDepth', { depth: maxDepth })}</p>
      
      <div class="performance-score">
        <h4>${i18n.t('analysis.skeleton.performanceScore.title', { score: boneScore.toFixed(1) })}</h4>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${boneScore}%; background-color: ${getScoreColor(boneScore)};"></div>
        </div>
      </div>
      
      <div class="analysis-metrics">
        <p><strong>${i18n.t('analysis.skeleton.formula.title')}</strong></p>
        <code>${i18n.t('analysis.skeleton.formula.description', { 
          idealBoneCount: PERFORMANCE_FACTORS.IDEAL_BONE_COUNT,
          depthFactor: PERFORMANCE_FACTORS.BONE_DEPTH_FACTOR
        })}</code>
      </div>
      
      <div class="tree-view">
        ${generateTreeHTML(boneTree)}
      </div>
      
      <div class="analysis-notes">
        <h4>${i18n.t('analysis.skeleton.notes.title')}</h4>
        <ul>
          <li><strong>${i18n.t('analysis.skeleton.notes.boneCount')}</strong></li>
          <li><strong>${i18n.t('analysis.skeleton.notes.hierarchyDepth')}</strong></li>
          <li><strong>${i18n.t('analysis.skeleton.notes.recommendation')}</strong></li>
          <li><strong>${i18n.t('analysis.skeleton.notes.optimalStructure')}</strong></li>
        </ul>
      </div>
    </div>
  `;
  
  return {html, metrics};
}
```


## src\core\constants\performanceFactors.ts

```
/**
 * Performance factors and constants used for Spine benchmark scoring
 */
export const PERFORMANCE_FACTORS = {
    // Base weights
    BONE_WEIGHT: 0.15,             // Impact of bone count
    MESH_WEIGHT: 0.25,             // Impact of mesh count and complexity
    CLIPPING_WEIGHT: 0.20,         // Impact of clipping masks
    BLEND_MODE_WEIGHT: 0.15,       // Impact of blend modes
    CONSTRAINT_WEIGHT: 0.25,       // Impact of constraints (combined)
    
    // Constraint breakdown weights (these sum to 1.0)
    IK_WEIGHT: 0.20,               // IK constraints weight
    TRANSFORM_WEIGHT: 0.15,        // Transform constraints weight
    PATH_WEIGHT: 0.25,             // Path constraints weight
    PHYSICS_WEIGHT: 0.40,          // Physics constraints weight (highest impact)
    
    // Complexity scale factors
    BONE_DEPTH_FACTOR: 1.5,        // Multiplier for bone depth impact
    MESH_VERTEX_FACTOR: 0.03,      // Per-vertex impact
    MESH_WEIGHTED_FACTOR: 2.0,     // Multiplier for weighted meshes
    MESH_DEFORMED_FACTOR: 1.5,     // Multiplier for meshes with deformation
    CLIPPING_VERTEX_FACTOR: 1.5,   // Per-vertex impact for clipping masks
    
    // Reference values (ideal thresholds)
    IDEAL_BONE_COUNT: 30,          // Reference value for bones
    IDEAL_MESH_COUNT: 15,          // Reference value for meshes
    IDEAL_VERTEX_COUNT: 300,       // Reference value for total vertices
    IDEAL_CLIPPING_COUNT: 2,       // Reference value for clipping masks
    IDEAL_BLEND_MODE_COUNT: 2,     // Reference value for non-normal blend modes
    
    // Physics simulation complexity factors
    PHYSICS_ITERATION_COST: 3.0,   // Cost multiplier for physics iterations
    IK_CHAIN_LENGTH_FACTOR: 1.3,   // Exponential factor for IK chain length
    
    // Animation complexity
    ANIMATION_COUNT_FACTOR: 0.05,  // Impact of number of animations
    TIMELINE_DENSITY_FACTOR: 0.1,  // Impact of timeline density
  };
```


## src\core\generators\summaryGenerator.ts

```
import { Spine } from "@esotericsoftware/spine-pixi-v8";
import { getScoreColor, getScoreRating, getScoreInterpretation } from "../utils/scoreCalculator";
import i18n from "../../i18n";

/**
 * Generates a comprehensive HTML summary of the skeleton analysis
 * @param spineInstance The analyzed Spine instance
 * @param boneMetrics Bone analysis metrics
 * @param meshMetrics Mesh analysis metrics
 * @param clippingMetrics Clipping mask analysis metrics
 * @param blendModeMetrics Blend mode analysis metrics
 * @param constraintMetrics Constraint analysis metrics
 * @param overallScore The calculated overall performance score
 * @returns HTML string containing the summary
 */
export function generateSummary(
  spineInstance: Spine,
  boneMetrics: any,
  meshMetrics: any,
  clippingMetrics: any,
  blendModeMetrics: any,
  constraintMetrics: any,
  overallScore: number
): string {
  // Get the skeleton data
  const skeleton = spineInstance.skeleton;
  const skeletonData = skeleton.data;
  
  // Get performance rating and interpretation
  const performanceRating = getScoreRating(overallScore);
  const interpretation = getScoreInterpretation(overallScore);
  // Generate component score table
  const componentScores = [
    { name: i18n.t('analysis.summary.components.boneStructure'), score: boneMetrics.score, weight: '15%' },
    { name: i18n.t('analysis.summary.components.meshComplexity'), score: meshMetrics.score, weight: '25%' },
    { name: i18n.t('analysis.summary.components.clippingMasks'), score: clippingMetrics.score, weight: '20%' },
    { name: i18n.t('analysis.summary.components.blendModes'), score: blendModeMetrics.score, weight: '15%' },
    { name: i18n.t('analysis.summary.components.constraints'), score: constraintMetrics.score, weight: '25%' },
  ];
  
  // Generate skeleton statistics
  const stats = [
    { name: i18n.t('analysis.summary.statistics.totalBones'), value: boneMetrics.totalBones },
    { name: i18n.t('analysis.summary.statistics.maxBoneDepth'), value: boneMetrics.maxDepth },
    { name: i18n.t('analysis.summary.statistics.totalMeshes'), value: meshMetrics.totalMeshCount },
    { name: i18n.t('analysis.summary.statistics.totalVertices'), value: meshMetrics.totalVertices },
    { name: i18n.t('analysis.summary.statistics.clippingMasks'), value: clippingMetrics.maskCount },
    { name: i18n.t('analysis.summary.statistics.nonNormalBlendModes'), value: blendModeMetrics.nonNormalBlendModeCount },
    { name: i18n.t('analysis.summary.statistics.totalConstraints'), value: constraintMetrics.totalConstraints },
    { name: i18n.t('analysis.summary.statistics.animations'), value: skeletonData.animations.length },
    { name: i18n.t('analysis.summary.statistics.skins'), value: skeletonData.skins.length },
  ];
  
  // Generate optimization recommendations
  const recommendations: string[] = [];
  
  // Bone recommendations
  if (boneMetrics.maxDepth > 5) {
    recommendations.push(i18n.t('analysis.summary.recommendations.reduceBoneDepth'));
  }
  if (boneMetrics.totalBones > 50) {
    recommendations.push(i18n.t('analysis.summary.recommendations.reduceTotalBones'));
  }
  
  // Mesh recommendations
  if (meshMetrics.totalVertices > 500) {
    recommendations.push(i18n.t('analysis.summary.recommendations.reduceVertices'));
  }
  if (meshMetrics.deformedMeshCount > 5) {
    recommendations.push(i18n.t('analysis.summary.recommendations.minimizeDeformedMeshes'));
  }
  if (meshMetrics.weightedMeshCount > 5) {
    recommendations.push(i18n.t('analysis.summary.recommendations.reduceWeightedMeshes'));
  }
  
  // Clipping recommendations
  if (clippingMetrics.maskCount > 2) {
    recommendations.push(i18n.t('analysis.summary.recommendations.limitClippingMasks'));
  }
  if (clippingMetrics.complexMasks > 0) {
    recommendations.push(i18n.t('analysis.summary.recommendations.simplifyComplexMasks'));
  }
  
  // Blend mode recommendations
  if (blendModeMetrics.nonNormalBlendModeCount > 2) {
    recommendations.push(i18n.t('analysis.summary.recommendations.reduceNonNormalBlendModes'));
  }
  if (blendModeMetrics.additiveCount > 5) {
    recommendations.push(i18n.t('analysis.summary.recommendations.minimizeAdditiveBlendModes'));
  }
  
  // Constraint recommendations
  if (constraintMetrics.physicsCount > 1) {
    recommendations.push(i18n.t('analysis.summary.recommendations.reducePhysicsConstraints'));
  }
  if (constraintMetrics.ikImpact > 50) {
    recommendations.push(i18n.t('analysis.summary.recommendations.simplifyIkConstraints'));
  }
  if (constraintMetrics.pathImpact > 50) {
    recommendations.push(i18n.t('analysis.summary.recommendations.optimizePathConstraints'));
  }
  
  // Generate HTML summary
  const scoreColor = getScoreColor(overallScore);
  
  return `
    <div class="benchmark-summary">
      <h2>${i18n.t('analysis.summary.title')}</h2>
      <p>${i18n.t('analysis.summary.skeletonLabel', { name: skeletonData.name || 'Unnamed' })}</p>
      
      <div class="score-container">
        <div class="performance-score" style="color: ${scoreColor}">${Math.round(overallScore)}</div>
        <div class="score-label">${i18n.t('analysis.summary.performanceLabel', { rating: performanceRating })}</div>
        <p class="score-interpretation">${interpretation}</p>
      </div>
      
      <h3>${i18n.t('analysis.summary.componentScoresTitle')}</h3>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>${i18n.t('analysis.summary.tableHeaders.component')}</th>
            <th>${i18n.t('analysis.summary.tableHeaders.score')}</th>
            <th>${i18n.t('analysis.summary.tableHeaders.weight')}</th>
            <th>${i18n.t('analysis.summary.tableHeaders.meter')}</th>
          </tr>
        </thead>
        <tbody>
          ${componentScores.map(component => `
            <tr>
              <td>${component.name}</td>
              <td>${component.score.toFixed(1)}</td>
              <td>${component.weight}</td>
              <td>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${component.score}%; background-color: ${getScoreColor(component.score)};"></div>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <h3>${i18n.t('analysis.summary.skeletonStatsTitle')}</h3>
      <div class="stats-container">
        <table class="stats-table">
          <tbody>
            ${stats.map(stat => `
              <tr>
                <td>${stat.name}</td>
                <td>${stat.value}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      ${recommendations.length > 0 ? `
        <div class="optimization-tips">
          <h3>${i18n.t('analysis.summary.optimizationTitle')}</h3>
          <ul>
            ${recommendations.map(tip => `<li>${tip}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      <div class="performance-explanation">
        <h3>${i18n.t('analysis.summary.performanceExplanationTitle')}</h3>
        <table class="benchmark-table">
          <thead>
            <tr>
              <th>${i18n.t('analysis.summary.tableHeaders.scoreRange')}</th>
              <th>${i18n.t('analysis.summary.tableHeaders.rating')}</th>
              <th>${i18n.t('analysis.summary.tableHeaders.interpretation')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${i18n.t('analysis.summary.performanceRanges.excellent.range')}</td>
              <td>${i18n.t('analysis.summary.performanceRanges.excellent.rating')}</td>
              <td>${i18n.t('analysis.summary.performanceRanges.excellent.description')}</td>
            </tr>
            <tr>
              <td>${i18n.t('analysis.summary.performanceRanges.good.range')}</td>
              <td>${i18n.t('analysis.summary.performanceRanges.good.rating')}</td>
              <td>${i18n.t('analysis.summary.performanceRanges.good.description')}</td>
            </tr>
            <tr>
              <td>${i18n.t('analysis.summary.performanceRanges.moderate.range')}</td>
              <td>${i18n.t('analysis.summary.performanceRanges.moderate.rating')}</td>
              <td>${i18n.t('analysis.summary.performanceRanges.moderate.description')}</td>
            </tr>
            <tr>
              <td>${i18n.t('analysis.summary.performanceRanges.poor.range')}</td>
              <td>${i18n.t('analysis.summary.performanceRanges.poor.rating')}</td>
              <td>${i18n.t('analysis.summary.performanceRanges.poor.description')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}
```


## src\core\utils\scoreCalculator.ts

```
import { PERFORMANCE_FACTORS } from "../constants/performanceFactors";
import i18n from "../../i18n";

/**
 * Calculates the mesh performance score
 * @param metrics Mesh metrics
 * @returns Score from 0-100
 */
export function calculateMeshScore(metrics: any): number {
  // Formula from documentation:
  // meshScore = 100 - log₂(totalMeshes/idealMeshes + 1) * 15
  //             - log₂(totalVertices/idealVertices + 1) * 10
  //             - (deformedMeshes * deformationFactor)
  //             - (weightedMeshes * weightFactor)
  
  const { totalMeshCount, totalVertices, deformedMeshCount, weightedMeshCount } = metrics;
  const { IDEAL_MESH_COUNT, IDEAL_VERTEX_COUNT, MESH_DEFORMED_FACTOR, MESH_WEIGHTED_FACTOR } = PERFORMANCE_FACTORS;
  
  let score = 100;
  
  // Mesh count penalty (logarithmic)
  if (totalMeshCount > 0) {
    score -= Math.log2(totalMeshCount / IDEAL_MESH_COUNT + 1) * 15;
  }
  
  // Vertex count penalty (logarithmic)
  if (totalVertices > 0) {
    score -= Math.log2(totalVertices / IDEAL_VERTEX_COUNT + 1) * 10;
  }
  
  // Deformation penalty (linear)
  score -= deformedMeshCount * MESH_DEFORMED_FACTOR;
  
  // Weighted mesh penalty (linear)
  score -= weightedMeshCount * MESH_WEIGHTED_FACTOR;
  
  // Floor the score at 0
  return Math.max(0, score);
}

/**
 * Calculates the clipping mask performance score
 * @param maskCount Number of clipping masks
 * @param vertexCount Total vertices in all masks
 * @param complexMasks Number of masks with more than 4 vertices
 * @returns Score from 0-100
 */
export function calculateClippingScore(maskCount: number, vertexCount: number, complexMasks: number): number {
  // Formula from documentation:
  // clippingScore = 100 - log₂(maskCount/idealMasks + 1) * 20
  //                 - log₂(vertexCount + 1) * 5
  //                 - (complexMasks * 10)
  
  const { IDEAL_CLIPPING_COUNT } = PERFORMANCE_FACTORS;
  
  let score = 100;
  
  // Mask count penalty (logarithmic)
  if (maskCount > 0) {
    score -= Math.log2(maskCount / IDEAL_CLIPPING_COUNT + 1) * 20;
  }
  
  // Vertex count penalty (logarithmic)
  if (vertexCount > 0) {
    score -= Math.log2(vertexCount + 1) * 5;
  }
  
  // Complex mask penalty (linear)
  score -= complexMasks * 10;
  
  // Floor the score at 0
  return Math.max(0, score);
}

/**
 * Calculates the blend mode performance score
 * @param nonNormalCount Number of non-normal blend modes
 * @param additiveCount Number of additive blend modes
 * @returns Score from 0-100
 */
export function calculateBlendModeScore(nonNormalCount: number, additiveCount: number): number {
  // Formula from documentation:
  // blendModeScore = 100 - log₂(nonNormalCount/idealBlendModes + 1) * 20
  //                 - (additiveCount * 2)
  
  const { IDEAL_BLEND_MODE_COUNT } = PERFORMANCE_FACTORS;
  
  let score = 100;
  
  // Non-normal blend mode count penalty (logarithmic)
  if (nonNormalCount > 0) {
    score -= Math.log2(nonNormalCount / IDEAL_BLEND_MODE_COUNT + 1) * 20;
  }
  
  // Additive blend mode penalty (linear)
  score -= additiveCount * 2;
  
  // Floor the score at 0
  return Math.max(0, score);
}

/**
 * Calculates the bone structure performance score
 * @param totalBones Total number of bones
 * @param maxDepth Maximum depth of bone hierarchy
 * @returns Score from 0-100
 */
export function calculateBoneScore(totalBones: number, maxDepth: number): number {
  // Formula from documentation:
  // boneScore = 100 - log₂(totalBones/idealBones + 1) * 15 - (maxDepth * depthFactor)
  
  const { IDEAL_BONE_COUNT, BONE_DEPTH_FACTOR } = PERFORMANCE_FACTORS;
  
  let score = 100;
  
  // Bone count penalty (logarithmic)
  if (totalBones > 0) {
    score -= Math.log2(totalBones / IDEAL_BONE_COUNT + 1) * 15;
  }
  
  // Depth penalty (linear)
  score -= maxDepth * BONE_DEPTH_FACTOR;
  
  // Floor the score at 0
  return Math.max(0, score);
}

/**
 * Calculates the constraint performance score
 * @param ikImpact IK constraints impact
 * @param transformImpact Transform constraints impact
 * @param pathImpact Path constraints impact
 * @param physicsImpact Physics constraints impact
 * @returns Score from 0-100
 */
export function calculateConstraintScore(
  ikImpact: number, 
  transformImpact: number, 
  pathImpact: number, 
  physicsImpact: number
): number {
  // Calculate weighted impacts using constraint weights
  const { 
    IK_WEIGHT, 
    TRANSFORM_WEIGHT, 
    PATH_WEIGHT, 
    PHYSICS_WEIGHT 
  } = PERFORMANCE_FACTORS;
  
  // Calculate total weighted impact
  const totalImpact = 
    (ikImpact * IK_WEIGHT) + 
    (transformImpact * TRANSFORM_WEIGHT) + 
    (pathImpact * PATH_WEIGHT) + 
    (physicsImpact * PHYSICS_WEIGHT);
  
  // Formula from documentation:
  // constraintScore = 100 - (constraintImpact * 0.5)
  const score = 100 - (totalImpact * 0.5);
  
  // Floor the score at 0
  return Math.max(0, score);
}

/**
 * Helper function to calculate maximum depth of a tree structure
 * @param nodes Tree nodes
 * @returns Maximum depth of the tree
 */
export function calculateMaxDepth(nodes: any[]): number {
  if (!nodes || nodes.length === 0) return 0;
  
  return 1 + Math.max(...nodes.map(node => 
    node.children ? calculateMaxDepth(node.children) : 0
  ));
}

/**
 * Calculate overall performance score from component scores
 * @param componentScores Scores for each component
 * @returns Overall performance score (40-100)
 */
export function calculateOverallScore(componentScores: { [key: string]: number }): number {
  const { 
    BONE_WEIGHT, 
    MESH_WEIGHT, 
    CLIPPING_WEIGHT, 
    BLEND_MODE_WEIGHT, 
    CONSTRAINT_WEIGHT 
  } = PERFORMANCE_FACTORS;
  
  // Apply weights to each component score
  const weightedScore = 
    (componentScores.boneScore * BONE_WEIGHT) +
    (componentScores.meshScore * MESH_WEIGHT) +
    (componentScores.clippingScore * CLIPPING_WEIGHT) +
    (componentScores.blendModeScore * BLEND_MODE_WEIGHT) +
    (componentScores.constraintScore * CONSTRAINT_WEIGHT);
  
  // Ensure score has a floor of 40 (as per documentation)
  return Math.max(40, Math.round(weightedScore));
}

/**
 * Helper method to get a color for a score
 * @param score Performance score
 * @returns CSS color string
 */
export function getScoreColor(score: number): string {
  if (score >= 85) return '#4caf50'; // Green for excellent
  if (score >= 70) return '#8bc34a'; // Light green for good
  if (score >= 55) return '#ffb300'; // Amber for moderate
  if (score >= 40) return '#f57c00'; // Orange for poor
  return '#e53935'; // Red for very poor
}

/**
 * Helper method to get a rating label for a score
 * @param score Performance score
 * @returns Text rating
 */
export function getScoreRating(score: number): string {
  if (score >= 85) return i18n.t('analysis.scores.ratings.excellent');
  if (score >= 70) return i18n.t('analysis.scores.ratings.good');
  if (score >= 55) return i18n.t('analysis.scores.ratings.moderate');
  if (score >= 40) return i18n.t('analysis.scores.ratings.poor');
  return i18n.t('analysis.scores.ratings.veryPoor');
}

/**
 * Helper method to get interpretation for a score
 * @param score Performance score
 * @returns Score interpretation text
 */
export function getScoreInterpretation(score: number): string {
  if (score >= 85) return i18n.t('analysis.scores.interpretations.excellent');
  if (score >= 70) return i18n.t('analysis.scores.interpretations.good');
  if (score >= 55) return i18n.t('analysis.scores.interpretations.moderate');
  if (score >= 40) return i18n.t('analysis.scores.interpretations.poor');
  return i18n.t('analysis.scores.interpretations.veryPoor');
}
```


## src\hooks\ToastContext.tsx

```
import React, { createContext, useContext } from 'react';
import { toast, ToastContainer as ToastifyContainer, ToastOptions } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Configure default toast options
const toastOptions: ToastOptions = {
  position: "top-center",
  autoClose: 1000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: "dark",
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const addToast = (message: string, type: ToastType = 'info') => {
    switch (type) {
      case 'success':
        toast.success(message, toastOptions);
        break;
      case 'warning':
        toast.warning(message, toastOptions);
        break;
      case 'error':
        toast.error(message, toastOptions);
        break;
      case 'info':
      default:
        toast.info(message, toastOptions);
    }
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Custom ToastContainer component with dark theme
export const ToastContainer: React.FC = () => {
  return (
    <ToastifyContainer
      position="top-center"
      autoClose={1000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="dark"
    />
  );
};
```


## src\hooks\useCommandPalette.ts

```
import { useState, useCallback, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { commandRegistry, Command, CommandCategory } from '../utils/commandRegistry';
import { useUrlHash } from './useUrlHash';

export interface UseCommandPaletteReturn {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  groupedCommands: CommandCategory[];
  totalCommands: number;
  openPalette: () => void;
  closePalette: () => void;
  setQuery: (query: string) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  executeSelected: () => void;
  executeCommand: (commandId: string) => void;
}

export function useCommandPalette(): UseCommandPaletteReturn {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { updateHash, getStateFromHash, onHashChange } = useUrlHash();

  // Load recent commands on mount and check initial hash state
  useEffect(() => {
    commandRegistry.loadRecentCommands();
    
    // Check if command palette should be open based on URL hash
    const hashState = getStateFromHash();
    if (hashState.commandPalette) {
      setIsOpen(true);
    }
  }, [getStateFromHash]);

  // Listen for browser navigation changes
  useEffect(() => {
    const cleanup = onHashChange((hashState) => {
      setIsOpen(hashState.commandPalette);
      if (!hashState.commandPalette) {
        setQuery('');
        setSelectedIndex(0);
      }
    });
    
    return cleanup;
  }, [onHashChange]);

  const openPalette = useCallback(() => {
    console.log('🎯 Opening command palette');
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
    updateHash({ commandPalette: true });
  }, [updateHash]);

  const closePalette = useCallback(() => {
    console.log('🚪 Closing command palette');
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
    updateHash({ commandPalette: false });
  }, [updateHash]);

  // Get grouped commands based on current query
  const groupedCommands = commandRegistry.getGroupedCommands(query, t);
  
  // Flatten commands for navigation
  const flatCommands: Command[] = groupedCommands.reduce((acc, category) => {
    return [...acc, ...category.commands];
  }, [] as Command[]);

  const totalCommands = flatCommands.length;

  const selectNext = useCallback(() => {
    setSelectedIndex(prev => (prev + 1) % Math.max(1, totalCommands));
  }, [totalCommands]);

  const selectPrevious = useCallback(() => {
    setSelectedIndex(prev => prev === 0 ? Math.max(0, totalCommands - 1) : prev - 1);
  }, [totalCommands]);

  const executeSelected = useCallback(() => {
    if (flatCommands[selectedIndex]) {
      commandRegistry.executeCommand(flatCommands[selectedIndex].id);
      closePalette();
    }
  }, [flatCommands, selectedIndex, closePalette]);

  const executeCommand = useCallback((commandId: string) => {
    console.log('🎮 Command palette executing command:', commandId);
    commandRegistry.executeCommand(commandId);
    closePalette();
  }, [closePalette]);

  // Update selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard shortcuts
  useHotkeys('ctrl+k,cmd+k', (e) => {
    e.preventDefault();
    console.log('⌨️ Ctrl+K pressed, palette open:', isOpen);
    if (isOpen) {
      closePalette();
    } else {
      openPalette();
    }
  }, { enableOnFormTags: true });

  useHotkeys('escape', () => {
    if (isOpen) {
      closePalette();
    }
  }, { enableOnFormTags: true, enabled: isOpen });

  useHotkeys('enter', () => {
    if (isOpen) {
      executeSelected();
    }
  }, { enableOnFormTags: true, enabled: isOpen });

  useHotkeys('arrowdown', (e) => {
    if (isOpen) {
      e.preventDefault();
      selectNext();
    }
  }, { enableOnFormTags: true, enabled: isOpen });

  useHotkeys('arrowup', (e) => {
    if (isOpen) {
      e.preventDefault();
      selectPrevious();
    }
  }, { enableOnFormTags: true, enabled: isOpen });

  return {
    isOpen,
    query,
    selectedIndex,
    groupedCommands,
    totalCommands,
    openPalette,
    closePalette,
    setQuery,
    selectNext,
    selectPrevious,
    executeSelected,
    executeCommand
  };
}
```


## src\hooks\useCommandRegistration.ts

```
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { commandRegistry } from '../utils/commandRegistry';
import i18n from '../i18n';

interface UseCommandRegistrationProps {
  spineInstance: any;
  showBenchmark: boolean;
  setShowBenchmark: (show: boolean) => void;
  openGitHubReadme: () => void;
  setShowLanguageModal: (show: boolean) => void;
  meshesVisible: boolean;
  physicsVisible: boolean;
  ikVisible: boolean;
  toggleMeshes: () => void;
  togglePhysics: () => void;
  toggleIk: () => void;
}

export function useCommandRegistration({
  spineInstance,
  showBenchmark,
  setShowBenchmark,
  openGitHubReadme,
  setShowLanguageModal,
  meshesVisible,
  physicsVisible,
  ikVisible,
  toggleMeshes,
  togglePhysics,
  toggleIk
}: UseCommandRegistrationProps) {
  const { t } = useTranslation();
  
  useEffect(() => {
    // Animation Commands
    if (spineInstance) {
      commandRegistry.register({
        id: 'animation.play-pause',
        title: t('commands.animation.playPause'),
        category: 'animation',
        description: t('commands.animation.playPauseDescription'),
        keywords: [t('commands.keywords.animation'), t('commands.keywords.play'), t('commands.keywords.pause'), t('commands.keywords.toggle')],
        execute: () => {
          const currentTimeScale = spineInstance.state.timeScale;
          spineInstance.state.timeScale = currentTimeScale === 0 ? 1 : 0;
        }
      });

      commandRegistry.register({
        id: 'animation.stop',
        title: t('commands.animation.stop'),
        category: 'animation',
        description: t('commands.animation.stopDescription'),
        keywords: [t('commands.keywords.animation'), t('commands.keywords.stop')],
        execute: () => {
          spineInstance.state.clearTrack(0);
        }
      });

      commandRegistry.register({
        id: 'animation.restart',
        title: t('commands.animation.restart'),
        category: 'animation',
        description: t('commands.animation.restartDescription'),
        keywords: [t('commands.keywords.animation'), t('commands.keywords.restart'), t('commands.keywords.reset')],
        execute: () => {
          const currentEntry = spineInstance.state.getCurrent(0);
          if (currentEntry) {
            spineInstance.state.setAnimation(0, currentEntry.animation.name, currentEntry.loop);
          }
        }
      });

      // Register skin commands dynamically
      const skins = spineInstance.skeleton.data.skins;
      skins.forEach((skin: any) => {
        commandRegistry.register({
          id: `skin.${skin.name}`,
          title: t('commands.skin.switchTo', { 0: skin.name }),
          category: 'skin',
          description: t('commands.skin.switchToDescription', { 0: skin.name }),
          keywords: [t('commands.keywords.skin'), skin.name.toLowerCase()],
          execute: () => {
            spineInstance.skeleton.setSkin(skin.name);
            spineInstance.skeleton.setSlotsToSetupPose();
          }
        });
      });
    }

    // Debug Commands - only register if spine instance exists
    if (spineInstance) {
      // Show/Hide Mesh Debug (includes attachment visualization)
      if (!meshesVisible) {
        commandRegistry.register({
          id: 'debug.show-mesh',
          title: t('commands.debug.showMeshDebug'),
          category: 'debug',
          description: t('commands.debug.showMeshDebugDescription'),
          keywords: [t('commands.keywords.show'), 'mesh', 'attachment', 'debug', 'vertices', 'triangles', 'visualization'],
          execute: toggleMeshes
        });
      } else {
        commandRegistry.register({
          id: 'debug.hide-mesh',
          title: t('commands.debug.hideMeshDebug'),
          category: 'debug',
          description: t('commands.debug.hideMeshDebugDescription'),
          keywords: ['hide', 'mesh', 'attachment', 'debug', 'vertices', 'triangles', 'visualization'],
          execute: toggleMeshes
        });
      }

      // Show/Hide IK Controls Debug (using ikVisible state and toggleIk function)
      if (!ikVisible) {
        commandRegistry.register({
          id: 'debug.show-ik',
          title: t('commands.debug.showIkDebug'),
          category: 'debug',
          description: t('commands.debug.showIkDebugDescription'),
          keywords: [t('commands.keywords.show'), 'ik', 'debug', 'constraints', 'controls'],
          execute: toggleIk
        });
      } else {
        commandRegistry.register({
          id: 'debug.hide-ik',
          title: t('commands.debug.hideIkDebug'),
          category: 'debug',
          description: t('commands.debug.hideIkDebugDescription'),
          keywords: ['hide', 'ik', 'debug', 'constraints', 'controls'],
          execute: toggleIk
        });
      }

      // Show/Hide Physics Debug (using physicsVisible state and togglePhysics function)
      if (!physicsVisible) {
        commandRegistry.register({
          id: 'debug.show-physics',
          title: t('commands.debug.showPhysicsDebug'),
          category: 'debug',
          description: t('commands.debug.showPhysicsDebugDescription'),
          keywords: [t('commands.keywords.show'), 'physics', 'debug', 'constraints', 'simulation'],
          execute: togglePhysics
        });
      } else {
        commandRegistry.register({
          id: 'debug.hide-physics',
          title: t('commands.debug.hidePhysicsDebug'),
          category: 'debug',
          description: t('commands.debug.hidePhysicsDebugDescription'),
          keywords: ['hide', 'physics', 'debug', 'constraints', 'simulation'],
          execute: togglePhysics
        });
      }
    }

    // Performance Commands - only register if spine instance exists
    if (spineInstance) {
      commandRegistry.register({
        id: 'performance.show-benchmark',
        title: t('commands.performance.showBenchmark'),
        category: 'performance',
        description: t('commands.performance.showBenchmarkDescription'),
        keywords: [t('commands.keywords.performance'), t('commands.keywords.benchmark'), t('commands.keywords.info'), t('commands.keywords.stats'), t('commands.keywords.show')],
        execute: () => setShowBenchmark(true)
      });
    }

    // Navigation Commands
    commandRegistry.register({
      id: 'help.documentation',
      title: t('commands.help.documentation'),
      category: 'performance',
      description: t('commands.help.documentationDescription'),
      keywords: [t('commands.keywords.help'), t('commands.keywords.documentation'), t('commands.keywords.readme'), t('commands.keywords.github')],
      execute: openGitHubReadme
    });

    // Language Commands - single command to open modal
    console.log('🔧 Registering language command with translations:', {
      title: t('language.changeLanguage'),
      description: t('language.changeLanguageDescription'),
      keywords: [
        t('commands.keywords.language'),
        t('commands.keywords.switch'),
        'change',
        'modal'
      ]
    });
    
    commandRegistry.register({
      id: 'language.change',
      title: t('language.changeLanguage'),
      category: 'language',
      description: t('language.changeLanguageDescription'),
      keywords: [
        t('commands.keywords.language'),
        t('commands.keywords.switch'),
        'change',
        'modal'
      ],
      execute: () => {
        console.log('🌐 Language command executed - opening modal');
        setShowLanguageModal(true);
      }
    });
    
    console.log('✅ Language command registered successfully');

    // Cleanup function to unregister commands
    // Cleanup function to unregister commands
    return () => {
      const commandIds = [
        'animation.play-pause',
        'animation.stop',
        'animation.restart',
        'debug.show-mesh',
        'debug.hide-mesh',
        'debug.show-ik',
        'debug.hide-ik',
        'debug.show-physics',
        'debug.hide-physics',
        'performance.show-benchmark',
        'help.documentation',
        'language.change'
      ];

      commandIds.forEach(id => commandRegistry.unregister(id));
      // Unregister skin commands
      if (spineInstance) {
        const skins = spineInstance.skeleton.data.skins;
        skins.forEach((skin: any) => {
          commandRegistry.unregister(`skin.${skin.name}`);
        });
      }
    };
  }, [
    spineInstance,
    showBenchmark,
    setShowBenchmark,
    openGitHubReadme,
    setShowLanguageModal,
    meshesVisible,
    physicsVisible,
    ikVisible,
    toggleMeshes,
    togglePhysics,
    toggleIk,
    t
  ]);
}
```


## src\hooks\useSafeLocalStorage.ts

```
import { useState, useEffect, Dispatch, SetStateAction } from 'react';

export function useSafeLocalStorage<T>(
  key: string, 
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Function to safely access localStorage
  const isLocalStorageAvailable = (): boolean => {
    try {
      const testKey = '__test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  };

  // Initialize stored value from localStorage if available
  useEffect(() => {
    try {
      if (!isLocalStorageAvailable()) return;
      
      const item = localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage.
  const setValue: Dispatch<SetStateAction<T>> = (value) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      
      // Save state
      setStoredValue(valueToStore);
      
      // Save to localStorage if available
      if (isLocalStorageAvailable()) {
        localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}
```


## src\hooks\useSpineApp.ts

```
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { Application } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackgroundManager } from '../core/BackgroundManager';
import { CameraContainer } from '../core/CameraContainer';
import { SpineAnalyzer } from '../core/SpineAnalyzer';
import { SpineLoader } from '../core/SpineLoader';
import { useToast } from './ToastContext';

export interface BenchmarkData {
  meshAnalysis: any;
  clippingAnalysis: any;
  blendModeAnalysis: any;
  skeletonTree: any;
  summary: any;
  physicsAnalysis: any;
}

export interface DebugFlags {
  showBones: boolean;
  showRegionAttachments: boolean;
  showMeshTriangles: boolean;
  showMeshHull: boolean;
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
  const [spineInstance, setSpineInstance] = useState<Spine | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  
  // Separate flags for each debug visualization type
  const [meshesVisible, setMeshesVisible] = useState(false);
  const [physicsVisible, setPhysicsVisible] = useState(false);
  const [ikVisible, setIkVisible] = useState(false);
  
  const cameraContainerRef = useRef<CameraContainer | null>(null);
  const backgroundManagerRef = useRef<BackgroundManager | null>(null);
  const { addToast } = useToast();

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
    
    // Create the background manager
    const backgroundManager = new BackgroundManager(app);
    backgroundManagerRef.current = backgroundManager;

    return () => {
      if (cameraContainer) {
        cameraContainer.destroy();
      }
      cameraContainerRef.current = null;
      
      if (backgroundManager) {
        backgroundManager.destroy();
      }
      backgroundManagerRef.current = null;
    };
  }, [app]);

  // Effect to regenerate benchmark data when language changes
  useEffect(() => {
    if (spineInstance) {
      const analysisData = SpineAnalyzer.analyze(spineInstance);
      setBenchmarkData(analysisData);
    }
  }, [i18n.language, spineInstance]);

  // Function to load spine files
  const loadSpineFiles = async (files: FileList) => {
    if (!app || !cameraContainerRef.current) {
      addToast('Application not initialized', 'error');
      return;
    }

    setIsLoading(true);
    
    try {
      // Log file information for debugging
      console.log(`Processing ${files.length} files:`);
      Array.from(files).forEach((file, index) => {
        console.log(`File ${index + 1}: ${file.name} (${file.type})`);
      });
      
      // Check if we have the basic required files
      const hasJsonFile = Array.from(files).some(file => 
        file.name.endsWith('.json') || file.type === 'application/json'
      );
      
      const hasSkelFile = Array.from(files).some(file => 
        file.name.endsWith('.skel')
      );
      
      const hasAtlasFile = Array.from(files).some(file => 
        file.name.endsWith('.atlas')
      );
      
      const hasImageFiles = Array.from(files).some(file => 
        file.type.startsWith('image/') || 
        file.name.endsWith('.png') || 
        file.name.endsWith('.jpg') || 
        file.name.endsWith('.jpeg') || 
        file.name.endsWith('.webp')
      );
      
      if (!hasAtlasFile) {
        throw new Error('Missing .atlas file. Please include an atlas file with your Spine data.');
      }
      
      if (!hasJsonFile && !hasSkelFile) {
        throw new Error('Missing skeleton file (.json or .skel). Please include a skeleton file with your Spine data.');
      }
      
      if (!hasImageFiles) {
        throw new Error('Missing image files. Please include image files referenced by your atlas.');
      }

      // Remove previous Spine instance if exists
      if (spineInstance) {
        cameraContainerRef.current.removeChild(spineInstance);
        setSpineInstance(null);
      }

      // Load spine files
      const loader = new SpineLoader(app);
      const newSpineInstance = await loader.loadSpineFiles(files);
      
      if (!newSpineInstance) {
        throw new Error('Failed to load Spine instance');
      }

      // Add to camera container and look at it
      cameraContainerRef.current.addChild(newSpineInstance);
      cameraContainerRef.current.lookAtChild(newSpineInstance);
      
      // Analyze spine data
      const analysisData = SpineAnalyzer.analyze(newSpineInstance);
      setBenchmarkData(analysisData);
      
      setSpineInstance(newSpineInstance);
      addToast('Spine files loaded successfully', 'success');
      
      // Reset all debug flags
      setMeshesVisible(false);
      setPhysicsVisible(false);
      setIkVisible(false);
      
      // Ensure debug visualization is turned off by default
      if (cameraContainerRef.current) {
        cameraContainerRef.current.setDebugFlags({
          showBones: false,
          showMeshTriangles: false,
          showMeshHull: false,
          showRegionAttachments: false,
          showBoundingBoxes: false,
          showPaths: false,
          showClipping: false,
          showPhysics: false,
          showIkConstraints: false,
          showTransformConstraints: false,
          showPathConstraints: false
        });
      }
      
    } catch (error) {
      console.error('Error loading Spine files:', error);
      addToast(`Error loading Spine files: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      throw error; // Re-throw to allow the calling code to handle it
    } finally {
      setIsLoading(false);
    }
  };
  
  // New function to forcefully remove all debug graphics
  const removeAllDebugGraphics = () => {
    if (!spineInstance || !cameraContainerRef.current) return;
    
    // Set all debug flags to false in the camera container
    if (cameraContainerRef.current.setDebugFlags) {
      cameraContainerRef.current.setDebugFlags({
        showBones: false,
        showRegionAttachments: false,
        showMeshTriangles: false,
        showMeshHull: false,
        showBoundingBoxes: false,
        showPaths: false,
        showClipping: false,
        showPhysics: false,
        showIkConstraints: false,
        showTransformConstraints: false,
        showPathConstraints: false
      });
    }
    
    // Get the debug renderer
    const debugRenderer = (cameraContainerRef.current as any).debugRenderer;
    if (!debugRenderer) return;
    
    // Get access to registered spines
    const registeredSpines = debugRenderer.registeredSpines;
    if (!registeredSpines) return;
    
    // Get debug display objects for our spine instance
    const debugObjs = registeredSpines.get(spineInstance);
    if (!debugObjs) return;
    
    // Clear all graphics objects
    const graphicsProps = [
      'skeletonXY', 
      'regionAttachmentsShape', 
      'meshTrianglesLine',
      'meshHullLine', 
      'clippingPolygon', 
      'boundingBoxesRect',
      'boundingBoxesCircle', 
      'boundingBoxesPolygon', 
      'pathsCurve',
      'pathsLine'
    ];
    
    graphicsProps.forEach(prop => {
      if (debugObjs[prop] && typeof debugObjs[prop].clear === 'function') {
        debugObjs[prop].clear();
      }
    });
    
    // Remove bone dots (which are children of the bones container)
    if (debugObjs.bones && debugObjs.bones.children) {
      while (debugObjs.bones.children.length > 0) {
        const bone = debugObjs.bones.children[0];
        debugObjs.bones.removeChild(bone);
        if (bone.destroy) {
          bone.destroy({children: true});
        }
      }
    }
    
    // Clear custom constraint graphics
    const customGraphicsProps = [
      'physicsConstraints',
      'ikConstraints',
      'transformConstraints',
      'pathConstraints'
    ];
    
    customGraphicsProps.forEach(prop => {
      if (debugObjs[prop] && typeof debugObjs[prop].clear === 'function') {
        debugObjs[prop].clear();
      }
    });
    
    // Force a render update
    if (app) {
      app.renderer.render(app.stage);
    }
  };

  // Updated toggle functions
  const toggleMeshes = () => {
    if (!cameraContainerRef.current) return;
    
    const newValue = !meshesVisible;
    setMeshesVisible(newValue);
    
    if (newValue) {
      // Turn on meshes visualization
      cameraContainerRef.current.toggleMeshes(true);
    } else {
      // Turn off and forcefully clear
      cameraContainerRef.current.toggleMeshes(false);
      removeAllDebugGraphics();
    }
  };
  
  const togglePhysics = () => {
    if (!cameraContainerRef.current) return;
    
    const newValue = !physicsVisible;
    setPhysicsVisible(newValue);
    
    if (newValue) {
      // Turn on physics visualization
      cameraContainerRef.current.togglePhysics(true);
    } else {
      // Turn off and forcefully clear
      cameraContainerRef.current.togglePhysics(false);
      removeAllDebugGraphics();
    }
  };
  
  const toggleIk = () => {
    if (!cameraContainerRef.current) return;
    
    const newValue = !ikVisible;
    setIkVisible(newValue);
    
    if (newValue) {
      // Turn on IK constraints visualization
      cameraContainerRef.current.toggleIkConstraints(true);
    } else {
      // Turn off and forcefully clear
      cameraContainerRef.current.toggleIkConstraints(false);
      removeAllDebugGraphics();
    }
  };
  
  // Function to set the background image using base64 data
  const setBackgroundImage = async (base64Data: string) => {
    if (!backgroundManagerRef.current) {
      addToast('Background manager not initialized', 'error');
      return;
    }
    
    try {
      await backgroundManagerRef.current.setBackgroundImage(base64Data);
      addToast('Background image set successfully', 'success');
    } catch (error) {
      console.error('Error setting background image:', error);
      addToast(`Error setting background image: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };
  
  // Function to clear the background image
  const clearBackgroundImage = () => {
    if (!backgroundManagerRef.current) {
      return;
    }
    
    backgroundManagerRef.current.clearBackground();
    addToast('Background image removed', 'info');
  };

  return {
    spineInstance,
    loadSpineFiles,
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
```


## src\hooks\useUrlHash.ts

```
import { useEffect, useCallback, useRef } from 'react';

export interface WindowState {
  commandPalette: boolean;
  benchmarkInfo: boolean;
  benchmarkTab?: string;
}

export interface UseUrlHashReturn {
  updateHash: (state: Partial<WindowState>) => void;
  clearHash: () => void;
  getStateFromHash: () => WindowState;
  onHashChange: (callback: (state: WindowState) => void) => () => void;
}

/**
 * Custom hook to manage URL hash based on window/panel states
 */
export function useUrlHash(): UseUrlHashReturn {
  const hashChangeCallbacks = useRef<Set<(state: WindowState) => void>>(new Set());
  
  const parseHashToState = useCallback((hash: string): WindowState => {
    const state: WindowState = {
      commandPalette: false,
      benchmarkInfo: false
    };
    
    if (!hash || hash === '#') {
      return state;
    }
    
    // Remove the # and split by & for multiple states
    const hashParts = hash.substring(1).split('&');
    
    hashParts.forEach(part => {
      if (part === 'command-palette') {
        state.commandPalette = true;
      } else if (part === 'benchmark-info') {
        state.benchmarkInfo = true;
      } else if (part.startsWith('benchmark-tab=')) {
        state.benchmarkTab = part.split('=')[1];
        state.benchmarkInfo = true; // If tab is specified, panel should be open
      }
    });
    
    return state;
  }, []);
  
  const stateToHash = useCallback((state: WindowState): string => {
    const hashParts: string[] = [];
    
    if (state.commandPalette) {
      hashParts.push('command-palette');
    }
    
    if (state.benchmarkInfo) {
      if (state.benchmarkTab) {
        hashParts.push(`benchmark-tab=${state.benchmarkTab}`);
      } else {
        hashParts.push('benchmark-info');
      }
    }
    
    return hashParts.length > 0 ? `#${hashParts.join('&')}` : '';
  }, []);
  
  const updateHash = useCallback((newState: Partial<WindowState>) => {
    const currentState = parseHashToState(window.location.hash);
    const updatedState = { ...currentState, ...newState };
    
    // Clean up state - if benchmarkInfo is false, remove benchmarkTab
    if (!updatedState.benchmarkInfo) {
      delete updatedState.benchmarkTab;
    }
    
    const newHash = stateToHash(updatedState);
    
    // Only update if hash actually changed
    if (window.location.hash !== newHash) {
      if (newHash) {
        window.history.replaceState(null, '', newHash);
      } else {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, [parseHashToState, stateToHash]);
  
  const clearHash = useCallback(() => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);
  
  const getStateFromHash = useCallback((): WindowState => {
    return parseHashToState(window.location.hash);
  }, [parseHashToState]);

  const onHashChange = useCallback((callback: (state: WindowState) => void) => {
    hashChangeCallbacks.current.add(callback);
    
    // Return cleanup function
    return () => {
      hashChangeCallbacks.current.delete(callback);
    };
  }, []);

  // Listen for browser navigation (back/forward buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const newState = parseHashToState(window.location.hash);
      hashChangeCallbacks.current.forEach(callback => callback(newState));
    };

    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [parseHashToState]);
  
  return {
    updateHash,
    clearHash,
    getStateFromHash,
    onHashChange
  };
}
```


## src\i18n.ts

```
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from './locales/en.json';
import ru from './locales/ru.json';
import zh from './locales/zh.json';
import uk from './locales/uk.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import pt from './locales/pt.json';
import es from './locales/es.json';

const resources = {
  en: { translation: en },
  ru: { translation: ru },
  zh: { translation: zh },
  uk: { translation: uk },
  fr: { translation: fr },
  de: { translation: de },
  pt: { translation: pt },
  es: { translation: es },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'spine-benchmark-language',
    },
  });

export default i18n;
```


## src\index.tsx

```
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ToastProvider } from './hooks/ToastContext';
import './styles.css';
// Import the custom toastify styles
import './toastify.css'; // Make sure to create this file with the custom styles
// Initialize i18n
import './i18n';

// Create root element
const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find the root element');
}

const root = createRoot(container);

// Render the app
root.render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
```


## src\md-module.d.ts

```
/// <reference types="vite/client" />

declare module '*.md' {
    const attributes: Record<string, unknown>;
    const html: string;
    const raw: string;
    export { attributes, html, raw };
  }
```


## src\utils\commandRegistry.ts

```
export interface Command {
  id: string;
  title: string;
  category: 'recently-used' | 'debug' | 'animation' | 'skin' | 'performance' | 'language';
  description?: string;
  icon?: string;
  execute: () => void | Promise<void>;
  keywords?: string[];
}

export interface CommandCategory {
  id: string;
  title: string;
  commands: Command[];
}

class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private recentCommands: string[] = [];
  private maxRecentCommands = 10;

  register(command: Command): void {
    console.log('📝 Registering command:', { id: command.id, title: command.title, category: command.category });
    this.commands.set(command.id, command);
  }

  unregister(commandId: string): void {
    this.commands.delete(commandId);
  }

  getCommand(commandId: string): Command | undefined {
    return this.commands.get(commandId);
  }

  getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  getCommandsByCategory(category: Command['category']): Command[] {
    return Array.from(this.commands.values()).filter(cmd => cmd.category === category);
  }

  getRecentCommands(): Command[] {
    return this.recentCommands
      .map(id => this.commands.get(id))
      .filter((cmd): cmd is Command => cmd !== undefined);
  }

  executeCommand(commandId: string): void {
    console.log('⚡ Executing command:', commandId);
    const command = this.commands.get(commandId);
    if (command) {
      console.log('✅ Command found:', { title: command.title, category: command.category });
      // Add to recent commands
      this.addToRecent(commandId);
      
      // Execute the command
      try {
        command.execute();
        console.log('🎯 Command executed successfully');
      } catch (error) {
        console.error('❌ Command execution failed:', error);
      }
    } else {
      console.error('❌ Command not found:', commandId);
      console.log('Available commands:', Array.from(this.commands.keys()));
    }
  }

  private addToRecent(commandId: string): void {
    // Remove if already exists
    const existingIndex = this.recentCommands.indexOf(commandId);
    if (existingIndex !== -1) {
      this.recentCommands.splice(existingIndex, 1);
    }

    // Add to beginning
    this.recentCommands.unshift(commandId);

    // Limit size
    if (this.recentCommands.length > this.maxRecentCommands) {
      this.recentCommands = this.recentCommands.slice(0, this.maxRecentCommands);
    }

    // Persist to localStorage
    this.saveRecentCommands();
  }

  private saveRecentCommands(): void {
    try {
      localStorage.setItem('spine-benchmark-recent-commands', JSON.stringify(this.recentCommands));
    } catch (error) {
      console.warn('Failed to save recent commands to localStorage:', error);
    }
  }

  loadRecentCommands(): void {
    try {
      const saved = localStorage.getItem('spine-benchmark-recent-commands');
      if (saved) {
        this.recentCommands = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load recent commands from localStorage:', error);
      this.recentCommands = [];
    }
  }

  search(query: string): Command[] {
    if (!query.trim()) {
      return this.getAllCommands();
    }

    const lowerQuery = query.toLowerCase();
    return Array.from(this.commands.values()).filter(command => {
      const titleMatch = command.title.toLowerCase().includes(lowerQuery);
      const descriptionMatch = command.description?.toLowerCase().includes(lowerQuery) || false;
      const keywordMatch = command.keywords?.some(keyword => 
        keyword.toLowerCase().includes(lowerQuery)
      ) || false;

      return titleMatch || descriptionMatch || keywordMatch;
    });
  }

  getGroupedCommands(query?: string, t?: (key: string) => string): CommandCategory[] {
    const commands = query ? this.search(query) : this.getAllCommands();
    const recentCommands = this.getRecentCommands();

    const categories: CommandCategory[] = [
      {
        id: 'recently-used',
        title: t ? t('commands.categories.recentlyUsed') : 'Recently Used',
        commands: query ? recentCommands.filter(cmd =>
          cmd.title.toLowerCase().includes(query.toLowerCase())
        ) : recentCommands
      },
      {
        id: 'debug',
        title: t ? t('commands.categories.debug') : 'Debug Commands',
        commands: commands.filter(cmd => cmd.category === 'debug')
      },
      {
        id: 'animation',
        title: t ? t('commands.categories.animation') : 'Animation Commands',
        commands: commands.filter(cmd => cmd.category === 'animation')
      },
      {
        id: 'skin',
        title: t ? t('commands.categories.skin') : 'Skin Commands',
        commands: commands.filter(cmd => cmd.category === 'skin')
      },
      {
        id: 'performance',
        title: t ? t('commands.categories.performance') : 'Performance Commands',
        commands: commands.filter(cmd => cmd.category === 'performance')
      },
      {
        id: 'language',
        title: t ? t('commands.categories.language') : 'Language Commands',
        commands: commands.filter(cmd => cmd.category === 'language')
      }
    ];

    // Filter out empty categories
    return categories.filter(category => category.commands.length > 0);
  }
}

export const commandRegistry = new CommandRegistry();

// Expose to global scope for debugging
if (typeof window !== 'undefined') {
  (window as any).commandRegistry = commandRegistry;
  console.log('🌍 Command registry exposed to window.commandRegistry for debugging');
}
```


## src\vite.env.d.ts

```
/// <reference types="vite/client" />

declare module '*.md' {
    const attributes: Record<string, unknown>;
    const html: string;
    const raw: string;
    export { attributes, html, raw };
  }
```
