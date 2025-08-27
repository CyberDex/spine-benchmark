import { Container, Application } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { DebugLayer } from './DebugLayer';
import { DebugLayerFactory, DebugLayerType } from './DebugLayerFactory';

export interface DebugFlags {
  showBones: boolean;
  showRegionAttachments: boolean;
  showMeshTriangles: boolean;
  showMeshHull: boolean;
  showVertices: boolean;
  showBoundingBoxes: boolean;
  showClipping: boolean;
  showIkConstraints: boolean;
  showTransformConstraints: boolean;
}

export class DebugRendererManager {
  private app: Application;
  private container: Container;
  private layers: Map<string, DebugLayer> = new Map();
  private flags: DebugFlags;
  private currentSpine: Spine | null = null;

  constructor(app: Application) {
    this.app = app;
    this.container = new Container();
    
    // Initialize default flags - all debug visualizations disabled by default
    this.flags = {
      showBones: false,
      showRegionAttachments: false,
      showMeshTriangles: false,
      showMeshHull: false,
      showVertices: false,
      showBoundingBoxes: false,
      showClipping: false,
      showIkConstraints: false,
      showTransformConstraints: false,
    };

    // Initialize debug layers
    this.initializeLayers();
  }

  private initializeLayers(): void {
    // Define all supported layer types (excluding physics and path constraints as requested)
    const layerTypes: DebugLayerType[] = [
      'bones', 
      'ikConstraints',
      'meshes',
      'transformConstraints'
    ];
    
    // Create all layers using the factory
    layerTypes.forEach(type => {
      try {
        const layer = DebugLayerFactory.createLayer(type, 
          DebugLayerFactory.getDefaultOptions(type, this.app));
        this.layers.set(type, layer);
        this.container.addChild(layer.getContainer());
        console.log(`DebugRendererManager: Created ${type} layer`);
      } catch (error) {
        console.warn(`DebugRendererManager: Failed to create ${type} layer:`, error);
      }
    });
  }

  public getContainer(): Container {
    return this.container;
  }

  public setSpine(spine: Spine | null): void {
    this.currentSpine = spine;
    if (!spine) {
      this.clearAll();
    }
  }

  public update(): void {
    // Update each layer based on its flag
    if (this.flags.showBones) {
      console.log('DebugRendererManager: Updating bones layer');
      this.layers.get('bones')?.update(this.currentSpine);
    }

    if (this.flags.showIkConstraints) {
      this.layers.get('ikConstraints')?.update(this.currentSpine);
    }

    // Update mesh layers based on their flags
    if (this.flags.showMeshTriangles || this.flags.showMeshHull || this.flags.showVertices) {
      this.layers.get('meshes')?.update(this.currentSpine);
    }
    
    // Update transform constraint layer
    if (this.flags.showTransformConstraints) {
      this.layers.get('transformConstraints')?.update(this.currentSpine);
    }
  }

  public setDebugFlags(flags: Partial<DebugFlags>): void {
    console.log('DebugRendererManager.setDebugFlags:', flags);
    this.flags = { ...this.flags, ...flags };
    // console.log('DebugRendererManager flags after update:', this.flags);

    // Update layer visibility based on flags
    this.layers.forEach((layer, type) => {
      // Map debug flags to layer visibility
      let visible = false;
      switch(type) {
        case 'bones':
          visible = this.flags.showBones;
          break;
        case 'ikConstraints':
          visible = this.flags.showIkConstraints;
          break;
        case 'meshes':
          visible = this.flags.showMeshTriangles || this.flags.showMeshHull || this.flags.showVertices;
          break;
        case 'transformConstraints':
          visible = this.flags.showTransformConstraints;
          break;
      }
      layer.setVisible(visible);
    });

    // Force update if we have a spine
    if (this.currentSpine) {
      console.log('DebugRendererManager: Forcing update with spine');
      this.update();
    }
  }

  public getDebugFlags(): DebugFlags {
    return { ...this.flags };
  }

  public clearAll(): void {
    this.layers.forEach(layer => layer.clear());
  }

  public getLayer<T extends DebugLayer>(name: string): T | undefined {
    return this.layers.get(name) as T | undefined;
  }

  public destroy(): void {
    this.clearAll();
    this.layers.forEach(layer => layer.destroy());
    this.layers.clear();
    this.container.destroy({ children: true });
  }

  // Convenience methods for toggling specific debug features
  public toggleIkConstraints(visible?: boolean): void {
    const newValue = visible ?? !this.flags.showIkConstraints;
    this.setDebugFlags({ showIkConstraints: newValue });
  }

  public toggleMeshes(visible?: boolean): void {
    const newValue = visible ?? !this.flags.showMeshTriangles;
    this.setDebugFlags({
      showMeshTriangles: newValue,
      showMeshHull: newValue,
      showVertices: newValue,
      showRegionAttachments: newValue,
      showBoundingBoxes: newValue,
      showClipping: newValue
    });
  }

  public toggleTransformConstraints(visible?: boolean): void {
    const newValue = visible ?? !this.flags.showTransformConstraints;
    this.setDebugFlags({
      showTransformConstraints: newValue
    });
  }
}