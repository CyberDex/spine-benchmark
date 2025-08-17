import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { DebugLayer, DebugLayerOptions } from '../DebugLayer';

export interface BoneDebugOptions extends DebugLayerOptions {
  boneColor?: number;
  jointColor?: number;
  jointRadius?: number;
  showBones?: boolean;
  showJoints?: boolean;

  /** Triangle base width as a fraction of bone length (default 0.1). */
  boneWidthScale?: number;
  /** Minimum base width in pixels (default 2). */
  boneMinWidth?: number;
  /** Maximum base width in pixels (default 12). */
  boneMaxWidth?: number;
}

export class BoneDebugLayer extends DebugLayer {
  private boneColor: number;
  private jointColor: number;
  private jointRadius: number;
  private showBones: boolean;
  private showJoints: boolean;

  private boneWidthScale: number;
  private boneMinWidth: number;
  private boneMaxWidth: number;

  constructor(options: BoneDebugOptions) {
    super(options);

    this.boneColor = options.boneColor ?? 0xffa500;
    this.jointColor = options.jointColor ?? 0xffa500;
    this.jointRadius = options.jointRadius ?? 2;
    this.showBones = options.showBones ?? true;
    this.showJoints = options.showJoints ?? true;

    this.boneWidthScale = options.boneWidthScale ?? 0.1;
    this.boneMinWidth = options.boneMinWidth ?? 2;
    this.boneMaxWidth = options.boneMaxWidth ?? 12;
  }

  public update(spine: Spine): void {
    if (!this.isVisible) return;

    this.clear();

    const skeleton = spine.skeleton;
    const bones = skeleton.bones || [];

    const g = this.graphics;

    // Draw bones as filled triangles that touch the exact bone end
    if (this.showBones) {
      let drawn = 0;

      for (const bone of bones) {
        const sx = bone.worldX;
        const sy = bone.worldY;

        // Compute ideal tip from bone length along local X axis transformed to world
        const len = bone.data?.length ?? 0;
        let tx = sx + bone.a * len;
        let ty = sy + bone.c * len;

        // If children exist, snap to the child whose origin projects farthest along the bone's forward axis
        if (bone.children && bone.children.length > 0) {
          let bestX = bone.children[0].worldX;
          let bestY = bone.children[0].worldY;

          if (bone.children.length > 1) {
            const fdx = tx - sx;
            const fdy = ty - sy;
            let bestProj = -Infinity;

            for (const ch of bone.children) {
              const vx = ch.worldX - sx;
              const vy = ch.worldY - sy;
              const proj = vx * fdx + vy * fdy; // dot product along forward axis
              if (proj > bestProj) {
                bestProj = proj;
                bestX = ch.worldX;
                bestY = ch.worldY;
              }
            }
          }

          // Snap if close to ideal tip, or if bone length is effectively zero
          const dx0 = bestX - tx;
          const dy0 = bestY - ty;
          const nearChild = dx0 * dx0 + dy0 * dy0 <= 4; // <= 2px squared
          if (nearChild || len < 1e-4) {
            tx = bestX;
            ty = bestY;
          }
        } else if (len < 1e-4) {
          // No children and zero length: nothing meaningful to draw
          continue;
        }

        // Build triangle with tip exactly at (tx, ty)
        const dx = tx - sx;
        const dy = ty - sy;
        const mag = Math.hypot(dx, dy);
        if (mag < 1e-4) continue;

        const baseW = this.clamp(mag * this.boneWidthScale, this.boneMinWidth, this.boneMaxWidth);

        // Perpendicular unit normal
        const nx = -dy / mag;
        const ny = dx / mag;

        // Base corners at the start joint
        const half = baseW * 0.5;
        const bx1 = sx + nx * half;
        const by1 = sy + ny * half;
        const bx2 = sx - nx * half;
        const by2 = sy - ny * half;

        // Visibility heuristic
        const visible =
          this.isSegmentVisible(sx, sy, tx, ty) ||
          this.isSegmentVisible(bx1, by1, tx, ty) ||
          this.isSegmentVisible(bx2, by2, tx, ty) ||
          this.isCircleVisible(sx, sy, half);
        if (!visible) continue;

        // Fill triangle (bx1,by1)-(bx2,by2)-(tx,ty)
        g.fill({ color: this.boneColor, alpha: this.alpha })
          .poly([bx1, by1, bx2, by2, tx, ty])
          .fill();

        // Optional outline for clarity
        if (this.strokeWidth > 0) {
          g.stroke({ color: this.boneColor, width: this.strokeWidth, pixelLine: true, miterLimit: 1.5 })
            .moveTo(bx1, by1).lineTo(bx2, by2)
            .moveTo(bx2, by2).lineTo(tx, ty)
            .moveTo(tx, ty).lineTo(bx1, by1);
        }

        drawn++;
      }

      console.log(`BoneDebugLayer: Drew ${drawn} bone triangles`);
    }

    // Draw joints as circles at each bone origin
    if (this.showJoints) {
      g.stroke({ width: 1 });
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
  public setShowBones(show: boolean): void { this.showBones = show; }
  public setShowJoints(show: boolean): void { this.showJoints = show; }
  public setColors(colors: { bone?: number; joint?: number }): void {
    if (colors.bone !== undefined) this.boneColor = colors.bone;
    if (colors.joint !== undefined) this.jointColor = colors.joint;
  }
  public setJointRadius(radius: number): void { this.jointRadius = radius; }
  public setBoneWidth(opts: { scale?: number; min?: number; max?: number }): void {
    if (opts.scale !== undefined) this.boneWidthScale = opts.scale;
    if (opts.min !== undefined) this.boneMinWidth = opts.min;
    if (opts.max !== undefined) this.boneMaxWidth = opts.max;
  }

  // Helpers
  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}
