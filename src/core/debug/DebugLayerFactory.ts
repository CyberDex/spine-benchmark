import { Application } from 'pixi.js';
import { DebugLayer } from './DebugLayer';
import { PathConstraintDebugLayer } from './layers/PathConstraintDebugLayer';
import { IkConstraintDebugLayer } from './layers/IkConstraintDebugLayer';
import { BoneDebugLayer } from './layers/BoneDebugLayer';

/**
 * DebugLayerFactory - Factory for creating consistent debug layers
 * 
 * This factory provides a consistent interface for creating debug layers
 * and helps reduce complexity in DebugRendererManager.
 */

// Define layer types
export type DebugLayerType = 
  'bones' | 
  'meshes' | 
  'physics' | 
  'ikConstraints' | 
  'pathConstraints' | 
  'transformConstraints' |
  'clipping' |
  'blendModes' |
  'boundingBoxes';

// Define options for each layer type
interface BaseLayerOptions {
  app: Application;
  alpha?: number;
  strokeWidth?: number;
}

interface BoneLayerOptions extends BaseLayerOptions {
  boneColor?: number;
  jointColor?: number;
  jointRadius?: number;
  showBones?: boolean;
  showJoints?: boolean;
}

interface PathConstraintLayerOptions extends BaseLayerOptions {
  pathColor?: number;
  showPath?: boolean;
  showStartEnd?: boolean;
  showBoneConnections?: boolean;
  showTarget?: boolean;
}

interface IkConstraintLayerOptions extends BaseLayerOptions {
  boneColor?: number;
  targetColor?: number;
  startCircleColor?: number;
  showBoneChain?: boolean;
  showTarget?: boolean;
  showStartCircle?: boolean;
}

type LayerOptions = 
  BoneLayerOptions | 
  PathConstraintLayerOptions | 
  IkConstraintLayerOptions | 
  BaseLayerOptions;

/**
 * DebugLayerFactory class
 * Provides a consistent interface for creating debug layers
 */
export class DebugLayerFactory {
  /**
   * Create a debug layer of the specified type
   * @param type - The type of layer to create
   * @param options - Options for the layer
   * @returns DebugLayer instance
   */
  static createLayer(type: DebugLayerType, options: LayerOptions): DebugLayer {
    switch(type) {
      case 'bones':
        return new BoneDebugLayer({
          app: options.app,
          boneColor: (options as BoneLayerOptions).boneColor ?? 0xFFA500,
          jointColor: (options as BoneLayerOptions).jointColor ?? 0xFFFFFF,
          jointRadius: (options as BoneLayerOptions).jointRadius ?? 3,
          alpha: options.alpha ?? 0.6,
          strokeWidth: options.strokeWidth ?? 2,
          showBones: (options as BoneLayerOptions).showBones ?? true,
          showJoints: (options as BoneLayerOptions).showJoints ?? true
        });
      
      case 'pathConstraints':
        return new PathConstraintDebugLayer({
          app: options.app,
          pathColor: (options as PathConstraintLayerOptions).pathColor ?? 0x00ff00,
          alpha: options.alpha ?? 1.0,
          strokeWidth: options.strokeWidth ?? 1,
          showPath: (options as PathConstraintLayerOptions).showPath ?? true,
          showStartEnd: (options as PathConstraintLayerOptions).showStartEnd ?? true,
          showBoneConnections: (options as PathConstraintLayerOptions).showBoneConnections ?? true,
          showTarget: (options as PathConstraintLayerOptions).showTarget ?? true
        });
      
      case 'ikConstraints':
        return new IkConstraintDebugLayer({
          app: options.app,
          boneColor: (options as IkConstraintLayerOptions).boneColor ?? 0x00ffff,
          targetColor: (options as IkConstraintLayerOptions).targetColor ?? 0x00ffff,
          startCircleColor: (options as IkConstraintLayerOptions).startCircleColor ?? 0x00ffff,
          alpha: options.alpha ?? 1.0,
          strokeWidth: options.strokeWidth ?? 1,
          showBoneChain: (options as IkConstraintLayerOptions).showBoneChain ?? true,
          showTarget: (options as IkConstraintLayerOptions).showTarget ?? true,
          showStartCircle: (options as IkConstraintLayerOptions).showStartCircle ?? true
        });
      
      // TODO: Implement other layer types
      case 'meshes':
      case 'physics':
      case 'transformConstraints':
      case 'clipping':
      case 'blendModes':
      case 'boundingBoxes':
        throw new Error(`Layer type '${type}' not yet implemented`);
      
      default:
        throw new Error(`Unknown layer type: ${type}`);
    }
  }

  /**
   * Get default options for a layer type
   * @param type - The type of layer
   * @returns Default options for the layer type
   */
  static getDefaultOptions(type: DebugLayerType, app: Application): LayerOptions {
    switch(type) {
      case 'bones':
        return {
          app,
          boneColor: 0xFFA500,
          jointColor: 0xFFFFFF,
          jointRadius: 3,
          alpha: 0.6,
          strokeWidth: 2,
          showBones: true,
          showJoints: true
        };
      
      case 'pathConstraints':
        return {
          app,
          pathColor: 0x00ff00,
          alpha: 1.0,
          strokeWidth: 1,
          showPath: true,
          showStartEnd: true,
          showBoneConnections: true,
          showTarget: true
        };
      
      case 'ikConstraints':
        return {
          app,
          boneColor: 0x00ffff,
          targetColor: 0x00ffff,
          startCircleColor: 0x00ffff,
          alpha: 1.0,
          strokeWidth: 1,
          showBoneChain: true,
          showTarget: true,
          showStartCircle: true
        };
      
      default:
        return {
          app,
          alpha: 1.0,
          strokeWidth: 1
        };
    }
  }
}