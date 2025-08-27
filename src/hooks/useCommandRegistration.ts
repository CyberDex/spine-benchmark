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
  cameraContainer?: any; // Add camera container reference
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
  toggleIk,
  cameraContainer
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
      // Bones Debug
      commandRegistry.register({
        id: 'debug.toggle-bones',
        title: t('commands.debug.toggleBones', 'Toggle Bones'),
        category: 'debug',
        description: t('commands.debug.toggleBonesDescription', 'Show/hide bone structure'),
        keywords: [t('commands.keywords.toggle'), 'bones', 'skeleton', 'debug', 'joints'],
        execute: () => {
          if (cameraContainer) {
            const flags = cameraContainer.getDebugFlags();
            console.log('Toggle Bones - Current flags:', flags);
            console.log('Toggle Bones - showBones before:', flags.showBones);
            cameraContainer.setDebugFlags({ showBones: !flags.showBones });
            const newFlags = cameraContainer.getDebugFlags();
            console.log('Toggle Bones - showBones after:', newFlags.showBones);
          } else {
            console.error('Toggle Bones - No camera container!');
          }
        }
      });

      // Mesh Debug (triangles and hull)
      commandRegistry.register({
        id: 'debug.toggle-meshes',
        title: t('commands.debug.toggleMeshes', 'Toggle Meshes'),
        category: 'debug',
        description: t('commands.debug.toggleMeshesDescription', 'Show/hide mesh triangles and hulls'),
        keywords: [t('commands.keywords.toggle'), 'mesh', 'triangles', 'hull', 'debug', 'vertices'],
        execute: () => {
          if (cameraContainer) {
            const flags = cameraContainer.getDebugFlags();
            const newValue = !flags.showMeshTriangles;
            cameraContainer.setDebugFlags({ 
              showMeshTriangles: newValue,
              showMeshHull: newValue,
              showVertices: newValue,
              showRegionAttachments: newValue,
              showBoundingBoxes: newValue,
              showClipping: newValue
            });
          }
        }
      });

      // Region Attachments Debug
      commandRegistry.register({
        id: 'debug.toggle-regions',
        title: t('commands.debug.toggleRegions', 'Toggle Region Attachments'),
        category: 'debug',
        description: t('commands.debug.toggleRegionsDescription', 'Show/hide region attachment bounds'),
        keywords: [t('commands.keywords.toggle'), 'region', 'attachments', 'debug', 'bounds'],
        execute: () => {
          if (cameraContainer) {
            const flags = cameraContainer.getDebugFlags();
            cameraContainer.setDebugFlags({ showRegionAttachments: !flags.showRegionAttachments });
          }
        }
      });

      // Bounding Boxes Debug
      commandRegistry.register({
        id: 'debug.toggle-bounding-boxes',
        title: t('commands.debug.toggleBoundingBoxes', 'Toggle Bounding Boxes'),
        category: 'debug',
        description: t('commands.debug.toggleBoundingBoxesDescription', 'Show/hide bounding boxes'),
        keywords: [t('commands.keywords.toggle'), 'bounding', 'boxes', 'debug', 'collision'],
        execute: () => {
          if (cameraContainer) {
            const flags = cameraContainer.getDebugFlags();
            cameraContainer.setDebugFlags({ showBoundingBoxes: !flags.showBoundingBoxes });
          }
        }
      });

      // Clipping Debug
      commandRegistry.register({
        id: 'debug.toggle-clipping',
        title: t('commands.debug.toggleClipping', 'Toggle Clipping'),
        category: 'debug',
        description: t('commands.debug.toggleClippingDescription', 'Show/hide clipping masks'),
        keywords: [t('commands.keywords.toggle'), 'clipping', 'masks', 'debug'],
        execute: () => {
          if (cameraContainer) {
            const flags = cameraContainer.getDebugFlags();
            cameraContainer.setDebugFlags({ showClipping: !flags.showClipping });
          }
        }
      });

      // IK Constraints Debug
      commandRegistry.register({
        id: 'debug.toggle-ik-constraints',
        title: t('commands.debug.toggleIkConstraints', 'Toggle IK Constraints'),
        category: 'debug',
        description: t('commands.debug.toggleIkConstraintsDescription', 'Show/hide IK constraints'),
        keywords: [t('commands.keywords.toggle'), 'ik', 'constraints', 'debug', 'inverse', 'kinematics'],
        execute: () => {
          if (cameraContainer) {
            const flags = cameraContainer.getDebugFlags();
            cameraContainer.setDebugFlags({ showIkConstraints: !flags.showIkConstraints });
          }
        }
      });

      // Transform Constraints Debug
      commandRegistry.register({
        id: 'debug.toggle-transform-constraints',
        title: t('commands.debug.toggleTransformConstraints', 'Toggle Transform Constraints'),
        category: 'debug',
        description: t('commands.debug.toggleTransformConstraintsDescription', 'Show/hide transform constraints'),
        keywords: [t('commands.keywords.toggle'), 'transform', 'constraints', 'debug'],
        execute: () => {
          if (cameraContainer) {
            const flags = cameraContainer.getDebugFlags();
            cameraContainer.setDebugFlags({ showTransformConstraints: !flags.showTransformConstraints });
          }
        }
      });

      // Convenience commands for common debug combinations
      commandRegistry.register({
        id: 'debug.show-all',
        title: t('commands.debug.showAll', 'Show All Debug'),
        category: 'debug',
        description: t('commands.debug.showAllDescription', 'Enable all debug visualizations'),
        keywords: [t('commands.keywords.show'), 'all', 'debug', 'everything'],
        execute: () => {
          if (cameraContainer) {
            cameraContainer.setDebugFlags({
              showBones: true,
              showRegionAttachments: true,
              showMeshTriangles: true,
              showMeshHull: true,
              showBoundingBoxes: true,
              showClipping: true,
              showIkConstraints: true,
              showTransformConstraints: true
            });
          }
        }
      });

      commandRegistry.register({
        id: 'debug.hide-all',
        title: t('commands.debug.hideAll', 'Hide All Debug'),
        category: 'debug',
        description: t('commands.debug.hideAllDescription', 'Disable all debug visualizations'),
        keywords: ['hide', 'all', 'debug', 'clear'],
        execute: () => {
          if (cameraContainer) {
            cameraContainer.setDebugFlags({
              showBones: false,
              showRegionAttachments: false,
              showMeshTriangles: false,
              showMeshHull: false,
              showBoundingBoxes: false,
              showClipping: false,
              showIkConstraints: false,
              showTransformConstraints: false
            });
          }
        }
      });

      // Legacy compatibility - use the convenience toggle functions
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
    return () => {
      const commandIds = [
        'animation.play-pause',
        'animation.stop',
        'animation.restart',
        'debug.toggle-bones',
        'debug.toggle-meshes',
        'debug.toggle-regions',
        'debug.toggle-bounding-boxes',
        'debug.toggle-clipping',
        'debug.toggle-ik-constraints',
        'debug.toggle-transform-constraints',
        'debug.show-all',
        'debug.hide-all',
        'debug.show-mesh',
        'debug.hide-mesh',
        'debug.show-ik',
        'debug.hide-ik',
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
    ikVisible,
    toggleMeshes,
    toggleIk,
    cameraContainer,
    t
  ]);
}