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

// URL Input Modal Component
const UrlInputModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onLoad: (jsonUrl: string, atlasUrl: string) => void;
}> = ({ isOpen, onClose, onLoad }) => {
  const [jsonUrl, setJsonUrl] = useState('');
  const [atlasUrl, setAtlasUrl] = useState('');
  const { t } = useTranslation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (jsonUrl && atlasUrl) {
      onLoad(jsonUrl, atlasUrl);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{t('ui.loadFromUrl', 'Load Spine from URL')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="json-url">JSON URL:</label>
            <input
              id="json-url"
              type="url"
              value={jsonUrl}
              onChange={(e) => setJsonUrl(e.target.value)}
              placeholder="https://example.com/spine.json"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="atlas-url">Atlas URL:</label>
            <input
              id="atlas-url"
              type="url"
              value={atlasUrl}
              onChange={(e) => setAtlasUrl(e.target.value)}
              placeholder="https://example.com/spine.atlas"
              required
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose}>{t('ui.cancel', 'Cancel')}</button>
            <button type="submit">{t('ui.load', 'Load')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { t } = useTranslation();
  const [app, setApp] = useState<Application | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlLoadAttempted, setUrlLoadAttempted] = useState(false);
  const [urlLoadStatus, setUrlLoadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

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
    loadSpineFromUrls,
    isLoading: spineLoading,
    benchmarkData,
    meshesVisible,
    physicsVisible,
    ikVisible,
    toggleMeshes,
    togglePhysics,
    toggleIk
  } = useSpineApp(app);

  // Check for URL parameters on mount - Enhanced version
  useEffect(() => {
    if (!app || urlLoadAttempted) return;

    const checkAndLoadFromUrl = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const jsonUrl = urlParams.get('json');
      const atlasUrl = urlParams.get('atlas');

      if (jsonUrl && atlasUrl) {
        console.log('Found Spine URLs in query parameters:', { jsonUrl, atlasUrl });
        setUrlLoadAttempted(true);
        setUrlLoadStatus('loading');
        
        try {
          await loadSpineFromUrls(jsonUrl, atlasUrl);
          setUrlLoadStatus('success');
          addToast(t('success.loadedFromUrl', 'Successfully loaded Spine from URL'), 'success');
        } catch (error) {
          console.error('Failed to load files from URLs:', error);
          setUrlLoadStatus('error');
          addToast(t('error.failedToLoadFromUrls', { error: (error as any).message }), 'error');
        }
      }
    };

    checkAndLoadFromUrl();
  }, [app, loadSpineFromUrls, urlLoadAttempted, addToast, t]);

  // Handle URL loading from modal
  const handleUrlLoad = useCallback(async (jsonUrl: string, atlasUrl: string) => {
    try {
      setUrlLoadStatus('loading');
      await loadSpineFromUrls(jsonUrl, atlasUrl);
      setUrlLoadStatus('success');
      
      // Update URL parameters to persist the loaded URLs
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('json', jsonUrl);
      newUrl.searchParams.set('atlas', atlasUrl);
      window.history.replaceState({}, '', newUrl);
      
      addToast(t('success.loadedFromUrl', 'Successfully loaded Spine from URL'), 'success');
    } catch (error) {
      setUrlLoadStatus('error');
      console.error('Failed to load from URLs:', error);
      addToast(t('error.failedToLoadFromUrls', { error: error.message }), 'error');
    }
  }, [loadSpineFromUrls, addToast, t]);

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

  // Add this to register URL load command
  useEffect(() => {
    if (app) {
      commandRegistry.register({
        id: 'file.load-from-url',
        title: t('commands.file.loadFromUrl', 'Load Spine from URL'),
        category: 'file',
        description: t('commands.file.loadFromUrlDescription', 'Load Spine files from remote URLs'),
        keywords: ['load', 'url', 'remote', 'cdn', 's3', 'http'],
        execute: () => setShowUrlModal(true)
      });
    }

    return () => {
      commandRegistry.unregister('file.load-from-url');
    };
  }, [app, t]);

  return (
    <div className="app-container">
      <div 
        className="canvas-container"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <canvas ref={canvasRef} id="pixiCanvas" />
        
        {!spineInstance && urlLoadStatus !== 'loading' && (
          <div className="drop-area">
            <p>{t('ui.dropArea')}</p>
            <button 
              className="url-load-button"
              onClick={() => setShowUrlModal(true)}
            >
              {t('ui.loadFromUrl', 'Load from URL')}
            </button>
          </div>
        )}
        
        {(isLoading || spineLoading || urlLoadStatus === 'loading') && (
          <div className="loading-indicator">
            <p>{urlLoadStatus === 'loading' ? t('ui.loadingFromUrl', 'Loading from URL...') : t('ui.loading')}</p>
          </div>
        )}
      </div>
      
      {/* Help text when no Spine file is loaded */}
      {!spineInstance && urlLoadStatus !== 'loading' && (
        <div className="help-text">
          <p>{t('ui.helpText')}</p>
          <p>{t('ui.urlHelp', 'You can also load Spine files from URL using the button above or by adding ?json=<url>&atlas=<url> to the URL')}</p>
        </div>
      )}
      
      {/* Controls container - only visible when Spine file is loaded */}
      <div className={`controls-container ${spineInstance ? 'visible' : 'hidden'}`}>    

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
        appVersion="1.2.0"
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
      
      {/* URL Input Modal */}
      <UrlInputModal
        isOpen={showUrlModal}
        onClose={() => setShowUrlModal(false)}
        onLoad={handleUrlLoad}
      />
    </div>
  );
};

// Import command registry for registration
import { commandRegistry } from './utils/commandRegistry';

export default App;