import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { DebugLayer, DebugLayerOptions } from '../DebugLayer';

export interface BoneDebugOptions extends DebugLayerOptions {
  boneColor?: number;
  jointColor?: number;
  jointRadius?: number;
  showBones?: boolean;
  showJoints?: boolean;
}

export class BoneDebugLayer extends DebugLayer {
  private boneColor: number;
  private jointColor: number;
  private jointRadius: number;
  private showBones: boolean;
  private showJoints: boolean;

  constructor(options: BoneDebugOptions) {
    super(options);
    
    this.boneColor = options.boneColor ?? 0xffa500;
    this.jointColor = options.jointColor ?? 0xffa500;
    this.jointRadius = options.jointRadius ?? 2;
    this.showBones = options.showBones ?? true;
    this.showJoints = options.showJoints ?? true;
  }

  public update(spine: Spine): void {
    if (!this.isVisible) return;
    
    this.clear();
    const skeleton = spine.skeleton;
    const bones = skeleton.bones || [];

    console.log(`BoneDebugLayer: Updating with ${bones.length} bones, visible: ${this.isVisible}`);

    const g = this.graphics;

    // Draw bones
    if (this.showBones) {
      g.stroke({ 
        color: this.boneColor, 
        width: this.strokeWidth, 
        pixelLine: true, 
        // alpha: this.alpha 
      });

      let drawnSegments = 0;
      for (const bone of bones) {
        console.log(bone)
        const parent = bone.parent;
        if (parent) {
          const px = parent.worldX;
          const py = parent.worldY;
          const x = bone.worldX;
          const y = bone.worldY;
          
          if (this.isSegmentVisible(px, py, x, y)) {
            g.moveTo(px, py).lineTo(x, y);
            drawnSegments++;
          }
        }
      }
      console.log(`BoneDebugLayer: Drew ${drawnSegments} bone segments`);
    }

    // Draw joints
    if (this.showJoints) {
      g.stroke({ width: 1 }); // No stroke for joints
      
      let drawnJoints = 0;
      for (const bone of bones) {
        const x = bone.worldX;
        const y = bone.worldY;
        
        if (this.isCircleVisible(x, y, this.jointRadius)) {
          g.fill({ color: this.jointColor, alpha: this.alpha })
            .circle(x, y, this.jointRadius)
            .fill();
          drawnJoints++;
        }
      }
      console.log(`BoneDebugLayer: Drew ${drawnJoints} joints`);
    }
  }

  // Configuration methods
  public setShowBones(show: boolean): void {
    this.showBones = show;
  }

  public setShowJoints(show: boolean): void {
    this.showJoints = show;
  }

  public setColors(colors: { bone?: number; joint?: number }): void {
    if (colors.bone !== undefined) this.boneColor = colors.bone;
    if (colors.joint !== undefined) this.jointColor = colors.joint;
  }

  public setJointRadius(radius: number): void {
    this.jointRadius = radius;
  }
}