import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { DebugLayer, DebugLayerOptions } from '../DebugLayer';

export interface BoneDebugOptions extends DebugLayerOptions {
  boneColor?: number;
  jointColor?: number;
  jointRadius?: number;
  showBones?: boolean;
  showJoints?: boolean;
  showHierarchy?: boolean;  // New option for hierarchy visualization

  /** Position of rhombus center as fraction of bone length (default 0.1) */
  rhombusCenterPosition?: number;
  /** Width of rhombus as fraction of bone length (default 0.12) */
  rhombusWidthScale?: number;
  /** Height of rhombus as fraction of bone length (default 0.06) */
  rhombusHeightScale?: number;
  /** Minimum rhombus width in pixels (default 3) */
  rhombusMinWidth?: number;
  /** Maximum rhombus width in pixels (default 20) */
  rhombusMaxWidth?: number;
  /** Minimum rhombus height in pixels (default 2) */
  rhombusMinHeight?: number;
  /** Maximum rhombus height in pixels (default 10) */
  rhombusMaxHeight?: number;
  /** Radius of circles drawn at bone start/end (default 2.5) */
  boneEndCircleRadius?: number;
}

export class BoneDebugLayer extends DebugLayer {
  private boneColor: number;
  private jointColor: number;
  private jointRadius: number;
  private showBones: boolean;
  private showJoints: boolean;
  private showHierarchy: boolean;

  private rhombusCenterPosition: number;
  private rhombusWidthScale: number;
  private rhombusHeightScale: number;
  private rhombusMinWidth: number;
  private rhombusMaxWidth: number;
  private rhombusMinHeight: number;
  private rhombusMaxHeight: number;
  private boneEndCircleRadius: number;

  constructor(options: BoneDebugOptions) {
    super(options);

    this.boneColor = options.boneColor ?? 0xFF8C00;  // Dark orange instead of white
    this.jointColor = options.jointColor ?? 0xFFFFFF;  // Keep white but increase opacity
    this.jointRadius = options.jointRadius ?? 3.5;  // Increase from 2 to 3.5
    this.showBones = options.showBones ?? true;
    this.showJoints = options.showJoints ?? true;
    this.showHierarchy = options.showHierarchy ?? false;

    this.rhombusCenterPosition = options.rhombusCenterPosition ?? 0.1;
    this.rhombusWidthScale = options.rhombusWidthScale ?? 0.12;  // Reduced from 0.15
    this.rhombusHeightScale = options.rhombusHeightScale ?? 0.06;  // Reduced from 0.08
    this.rhombusMinWidth = options.rhombusMinWidth ?? 3;
    this.rhombusMaxWidth = options.rhombusMaxWidth ?? 20;
    this.rhombusMinHeight = options.rhombusMinHeight ?? 2;
    this.rhombusMaxHeight = options.rhombusMaxHeight ?? 10;
    this.boneEndCircleRadius = options.boneEndCircleRadius ?? 2.5;  // Increase from 2 to 2.5
  }

  public update(spine: Spine): void {
    if (!this.isVisible) return;

    this.clear();

    const skeleton = spine.skeleton;
    const bones = skeleton.bones || [];

    const g = this.graphics;

    // Draw bones with semi-transparent color (60% alpha)
    if (this.showBones) {
      let drawn = 0;
      const boneAlpha = 0.6; // 60% transparency for bones

      for (const bone of bones) {
        const sx = bone.worldX;
        const sy = bone.worldY;

        // Compute ideal tip from bone length along local X axis transformed to world
        const len = bone.data?.length ?? 0;
        
        // Check if bone has effectively zero length
        if (len < 1e-4) {
          // Draw a more distinct marker for zero-length bones
          const zeroLengthRadius = this.jointRadius / 2;
          
          if (this.isCircleVisible(sx, sy, zeroLengthRadius)) {
            // Draw shadow
            g.fill({ color: 0xCC6C00, alpha: 0.4 })
              .circle(sx + 1, sy + 1, zeroLengthRadius)
              .fill();
            
            // Draw main circle with outline
            g.fill({ color: this.boneColor, alpha: boneAlpha })
              .circle(sx, sy, zeroLengthRadius)
              .fill();
            
            // Stroke circle
            if (this.strokeWidth > 0) {
              g.stroke({ 
                color: 0x000000, 
                width: 1, 
                alpha: boneAlpha * 0.8, 
                pixelLine: true 
              })
                .circle(sx, sy, zeroLengthRadius);
            }
            
            drawn++;
          
          continue;
        }

        // For bones with length, compute the tip position
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

          // Snap if close to ideal tip
          const dx0 = bestX - tx;
          const dy0 = bestY - ty;
          const nearChild = dx0 * dx0 + dy0 * dy0 <= 4; // <= 2px squared
          if (nearChild) {
            tx = bestX;
            ty = bestY;
          }
        }

        // Calculate bone direction
        const dx = tx - sx;
        const dy = ty - sy;
        const mag = Math.hypot(dx, dy);
        if (mag < 1e-4) continue;

        // Unit vectors
        const ux = dx / mag; // Unit vector along bone
        const uy = dy / mag;
        const nx = -uy; // Perpendicular unit normal
        const ny = ux;

        // Calculate rhombus center position (10% along the bone by default)
        const centerDist = mag * this.rhombusCenterPosition;
        const cx = sx + ux * centerDist;
        const cy = sy + uy * centerDist;

        // Calculate rhombus dimensions
        const rhombusWidth = this.clamp(mag * this.rhombusWidthScale, this.rhombusMinWidth, this.rhombusMaxWidth);
        const rhombusHeight = this.clamp(mag * this.rhombusHeightScale, this.rhombusMinHeight, this.rhombusMaxHeight);

        // Calculate rhombus points
        // Point closest to start (left point)
        const leftX = cx - ux * (rhombusWidth / 2);
        const leftY = cy - uy * (rhombusWidth / 2);
        
        // Point closest to end (right point)
        const rightX = cx + ux * (rhombusWidth / 2);
        const rightY = cy + uy * (rhombusWidth / 2);
        
        // Top and bottom points (perpendicular to bone)
        const topX = cx + nx * (rhombusHeight / 2);
        const topY = cy + ny * (rhombusHeight / 2);
        const bottomX = cx - nx * (rhombusHeight / 2);
        const bottomY = cy - ny * (rhombusHeight / 2);

        // Visibility check
        const visible =
          this.isSegmentVisible(sx, sy, tx, ty) ||
          this.isSegmentVisible(leftX, leftY, rightX, rightY) ||
          this.isSegmentVisible(topX, topY, bottomX, bottomY) ||
          this.isCircleVisible(sx, sy, this.boneEndCircleRadius) ||
          this.isCircleVisible(tx, ty, this.boneEndCircleRadius);
        
        if (!visible) continue;

        // Draw drop shadow first (offset slightly)
        const shadowOffset = 1;
        const shadowAlpha = 0.4;  // 40% opacity for shadow

        // Draw shadow rhombus
        g.fill({ color: 0xCC6C00, alpha: shadowAlpha })
          .poly([
            leftX + shadowOffset, leftY + shadowOffset,
            topX + shadowOffset, topY + shadowOffset,
            rightX + shadowOffset, rightY + shadowOffset,
            bottomX + shadowOffset, bottomY + shadowOffset
          ])
          .fill();

        // Draw circles at start and end with shadows
        if (this.boneEndCircleRadius > 0) {
          // Circle at start with shadow
          if (this.isCircleVisible(sx, sy, this.boneEndCircleRadius)) {
            // Shadow
            g.fill({ color: 0xCC6C00, alpha: shadowAlpha })
              .circle(sx + shadowOffset, sy + shadowOffset, this.boneEndCircleRadius)
              .fill();
            
            // Main circle
            g.fill({ color: this.boneColor, alpha: boneAlpha })
              .circle(sx, sy, this.boneEndCircleRadius)
              .fill();
            if (this.strokeWidth > 0) {
              g.stroke({ color: 0x000000, width: 1, alpha: boneAlpha * 0.8, pixelLine: true })
                .circle(sx, sy, this.boneEndCircleRadius);
            }
          }
          
          // Circle at end with shadow
          if (this.isCircleVisible(tx, ty, this.boneEndCircleRadius)) {
            // Shadow
            g.fill({ color: 0xCC6C00, alpha: shadowAlpha })
              .circle(tx + shadowOffset, ty + shadowOffset, this.boneEndCircleRadius)
              .fill();
            
            // Main circle
            g.fill({ color: this.boneColor, alpha: boneAlpha })
              .circle(tx, ty, this.boneEndCircleRadius)
              .fill();
            if (this.strokeWidth > 0) {
              g.stroke({ color: 0x000000, width: 1, alpha: boneAlpha * 0.8, pixelLine: true })
                .circle(tx, ty, this.boneEndCircleRadius);
            }
          }
        }

        // Draw main bone rhombus with outline
        g.fill({ color: this.boneColor, alpha: boneAlpha })
          .poly([leftX, leftY, topX, topY, rightX, rightY, bottomX, bottomY])
          .fill();

        // Add outline for better visibility
        if (this.strokeWidth > 0) {
          g.stroke({ 
            color: 0x000000, 
            width: this.strokeWidth, 
            alpha: boneAlpha * 0.8, 
            pixelLine: true, 
            miterLimit: 1.5 
          })
            .moveTo(leftX, leftY).lineTo(topX, topY)
            .moveTo(topX, topY).lineTo(rightX, rightY)
            .moveTo(rightX, rightY).lineTo(bottomX, bottomY)
            .moveTo(bottomX, bottomY).lineTo(leftX, leftY);
        }

        drawn++;
      }

      // After drawing the bone, visualize parent-child relationships for selected bones
      if (bone.parent && this.showHierarchy) {
        // Draw a subtle line connecting parent to child
        const parentX = bone.parent.worldX;
        const parentY = bone.parent.worldY;
        
        if (this.isSegmentVisible(parentX, parentY, sx, sy)) {
          g.stroke({ 
            color: 0xFFFFFF, 
            width: 1, 
            alpha: 0.3, 
            pixelLine: true 
          })
            .moveTo(parentX, parentY)
            .lineTo(sx, sy);
        }
      }

      drawn++;
    }

    console.log(`BoneDebugLayer: Drew ${drawn} bones`);
    }

    // Draw joints as circles at each bone origin (also semi-transparent)
    if (this.showJoints) {
      g.stroke({ width: 1 });
      let drawnJoints = 0;
      const jointAlpha = 0.6; // 60% transparency for joints

      for (const bone of bones) {
        if(bone.data.length === 0) continue;
        const x = bone.worldX;
        const y = bone.worldY;

        if (this.isCircleVisible(x, y, this.jointRadius)) {
          g.fill({ color: this.jointColor, alpha: jointAlpha })
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
  public setShowHierarchy(show: boolean): void { this.showHierarchy = show; }
  public setColors(colors: { bone?: number; joint?: number }): void {
    if (colors.bone !== undefined) this.boneColor = colors.bone;
    if (colors.joint !== undefined) this.jointColor = colors.joint;
  }
  public setJointRadius(radius: number): void { this.jointRadius = radius; }
  public setBoneEndCircleRadius(radius: number): void { this.boneEndCircleRadius = radius; }
  public setRhombusParams(opts: { 
    centerPosition?: number; 
    widthScale?: number; 
    heightScale?: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  }): void {
    if (opts.centerPosition !== undefined) this.rhombusCenterPosition = opts.centerPosition;
    if (opts.widthScale !== undefined) this.rhombusWidthScale = opts.widthScale;
    if (opts.heightScale !== undefined) this.rhombusHeightScale = opts.heightScale;
    if (opts.minWidth !== undefined) this.rhombusMinWidth = opts.minWidth;
    if (opts.maxWidth !== undefined) this.rhombusMaxWidth = opts.maxWidth;
    if (opts.minHeight !== undefined) this.rhombusMinHeight = opts.minHeight;
    if (opts.maxHeight !== undefined) this.rhombusMaxHeight = opts.maxHeight;
  }

  // Helpers
  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}