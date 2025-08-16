import { Graphics } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { DebugLayer, DebugLayerOptions } from '../DebugLayer';

export interface PathConstraintDebugOptions extends DebugLayerOptions {
  pathColor?: number;
  startEndColor?: number;
  boneConnectionColor?: number;
  targetColor?: number;
  showPath?: boolean;
  showStartEnd?: boolean;
  showBoneConnections?: boolean;
  showTarget?: boolean;
}

export class PathConstraintDebugLayer extends DebugLayer {
  private pathColor: number;
  private startEndColor: number;
  private boneConnectionColor: number;
  private targetColor: number;
  
  private showPath: boolean;
  private showStartEnd: boolean;
  private showBoneConnections: boolean;
  private showTarget: boolean;

  constructor(options: PathConstraintDebugOptions) {
    super(options);
    
    this.pathColor = options.pathColor ?? 0x00ff00;
    this.startEndColor = options.startEndColor ?? 0x00ff00;
    this.boneConnectionColor = options.boneConnectionColor ?? 0x00ff00;
    this.targetColor = options.targetColor ?? 0x00ff00;
    
    this.showPath = options.showPath ?? true;
    this.showStartEnd = options.showStartEnd ?? true;
    this.showBoneConnections = options.showBoneConnections ?? true;
    this.showTarget = options.showTarget ?? true;
  }

  public update(spine: Spine): void {
    if (!this.isVisible) return;
    
    this.clear();
    const skeleton = spine.skeleton;
    const pathConstraints = skeleton.pathConstraints || [];

    for (const constraint of pathConstraints) {
      if (!constraint?.isActive?.()) continue;
      
      const world = constraint.world as number[] | undefined;
      if (!world || world.length === 0) continue;

      // Draw the path
      if (this.showPath) {
        this.drawPath(world);
      }

      // Draw start and end circles
      if (this.showStartEnd) {
        this.drawStartEndCircles(world);
      }

      // Draw bone connections
      if (this.showBoneConnections) {
        this.drawBoneConnections(constraint, world);
      }

      // Draw target
      if (this.showTarget && constraint.target?.bone) {
        this.drawTarget(constraint.target.bone);
      }
    }
  }

  private drawPath(world: number[]): void {
    if (!this.isPolylineVisible(world, 3, 0, 1)) return;

    const g = this.graphics;
    
    // Draw main path line
    g.stroke({ color: this.pathColor, width: this.strokeWidth, pixelLine: true, alpha: this.alpha })
      .moveTo(world[0], world[1]);

    for (let i = 3; i < world.length; i += 3) {
      const px = world[i];
      const py = world[i + 1];
      g.lineTo(px, py);
    }

    // Draw small dots along the path
    g.stroke({ color: this.pathColor, width: 0, alpha: 0 }); // No stroke for dots
    for (let i = 0; i < world.length; i += 3) {
      const px = world[i];
      const py = world[i + 1];
      if (this.isCircleVisible(px, py, 3)) {
        g.fill({ color: this.pathColor, alpha: this.alpha * 0.4 })
          .circle(px, py, 3)
          .fill();
      }
    }
  }

  private drawStartEndCircles(world: number[]): void {
    const g = this.graphics;
    
    // Start circle
    if (world.length >= 3 && this.isCircleVisible(world[0], world[1], 8)) {
      // Fill
      g.fill({ color: this.startEndColor, alpha: this.alpha * 0.6 })
        .circle(world[0], world[1], 8)
        .fill();
      
      // Stroke
      g.stroke({ color: this.startEndColor, width: 2, pixelLine: true, alpha: this.alpha })
        .circle(world[0], world[1], 8);
    }

    // End circle
    if (world.length >= 3) {
      const endX = world[world.length - 3];
      const endY = world[world.length - 2];
      
      if (this.isCircleVisible(endX, endY, 8)) {
        // Fill
        g.fill({ color: this.startEndColor, alpha: this.alpha * 0.6 })
          .circle(endX, endY, 8)
          .fill();
        
        // Stroke
        g.stroke({ color: this.startEndColor, width: 2, pixelLine: true, alpha: this.alpha })
          .circle(endX, endY, 8);
      }
    }
  }

  private drawBoneConnections(constraint: any, world: number[]): void {
    const bones = constraint.bones as any[];
    if (!bones || bones.length === 0) return;

    const g = this.graphics;
    g.stroke({ 
      color: this.boneConnectionColor, 
      width: this.strokeWidth, 
      pixelLine: true, 
      alpha: this.alpha * 0.5 
    });

    for (const bone of bones) {
      // Find nearest point on path
      let closestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      
      for (let i = 0; i < world.length; i += 3) {
        const dx = world[i] - bone.worldX;
        const dy = world[i + 1] - bone.worldY;
        const dist = dx * dx + dy * dy;
        
        if (dist < bestDist) {
          bestDist = dist;
          closestIdx = i;
        }
      }

      const px = world[closestIdx];
      const py = world[closestIdx + 1];
      
      if (this.isSegmentVisible(bone.worldX, bone.worldY, px, py)) {
        g.moveTo(bone.worldX, bone.worldY)
          .lineTo(px, py);
      }
    }
  }

  private drawTarget(targetBone: any): void {
    const tx = targetBone.worldX;
    const ty = targetBone.worldY;
    
    if (!this.isCircleVisible(tx, ty, 15)) return;

    const g = this.graphics;
    
    // Fill
    g.fill({ color: this.targetColor, alpha: this.alpha * 0.2 })
      .circle(tx, ty, 15)
      .fill();
    
    // Stroke
    g.stroke({ color: this.targetColor, width: this.strokeWidth, pixelLine: true, alpha: this.alpha })
      .circle(tx, ty, 15);
  }

  // Configuration methods
  public setShowPath(show: boolean): void {
    this.showPath = show;
  }

  public setShowStartEnd(show: boolean): void {
    this.showStartEnd = show;
  }

  public setShowBoneConnections(show: boolean): void {
    this.showBoneConnections = show;
  }

  public setShowTarget(show: boolean): void {
    this.showTarget = show;
  }

  public setColors(colors: {
    path?: number;
    startEnd?: number;
    boneConnection?: number;
    target?: number;
  }): void {
    if (colors.path !== undefined) this.pathColor = colors.path;
    if (colors.startEnd !== undefined) this.startEndColor = colors.startEnd;
    if (colors.boneConnection !== undefined) this.boneConnectionColor = colors.boneConnection;
    if (colors.target !== undefined) this.targetColor = colors.target;
  }
}