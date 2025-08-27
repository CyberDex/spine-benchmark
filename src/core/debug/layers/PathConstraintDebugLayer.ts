import { Graphics } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { DebugLayer, DebugLayerOptions } from '../DebugLayer';

export interface PathConstraintDebugOptions extends DebugLayerOptions {
  /** Main path color */
  pathColor?: number;
  /** Start/End node color */
  startEndColor?: number;
  /** Lines from bones to nearest path point */
  boneConnectionColor?: number;
  /** Target bone marker color */
  targetColor?: number;
  /** Control point color */
  controlPointColor?: number;
  /** Control line color */
  controlLineColor?: number;

  showPath?: boolean;
  showStartEnd?: boolean;
  showBoneConnections?: boolean;
  showTarget?: boolean;
  showControlPoints?: boolean;
  showControlLines?: boolean;

  /** Pixel radius for node dots placed along the path. Default 3. */
  pathDotRadius?: number;
  /** Stroke width used for the path. Falls back to DebugLayer.strokeWidth. */
  pathStrokeWidth?: number;
  /** Radius for control point circles. Default 6. */
  controlPointRadius?: number;
}

export class PathConstraintDebugLayer extends DebugLayer {
  private pathColor: number;
  private startEndColor: number;
  private boneConnectionColor: number;
  private targetColor: number;
  private controlPointColor: number;
  private controlLineColor: number;
  
  private showPath: boolean;
  private showStartEnd: boolean;
  private showBoneConnections: boolean;
  private showTarget: boolean;
  private showControlPoints: boolean;
  private showControlLines: boolean;

  private pathDotRadius: number;
  private pathStrokeWidth?: number;
  private controlPointRadius: number;

  constructor(options: PathConstraintDebugOptions) {
    super(options);
    // "orangy" palette
    this.pathColor = options.pathColor ?? 0xffa500;       // orange
    this.startEndColor = options.startEndColor ?? 0xffc266; // lighter orange
    this.boneConnectionColor = options.boneConnectionColor ?? 0xff8c00; // dark orange
    this.targetColor = options.targetColor ?? 0xffa500;
    this.controlPointColor = options.controlPointColor ?? 0xffff00; // yellow
    this.controlLineColor = options.controlLineColor ?? 0xffff00; // yellow
    
    this.showPath = options.showPath ?? true;
    this.showStartEnd = options.showStartEnd ?? true;
    this.showBoneConnections = options.showBoneConnections ?? true;
    this.showTarget = options.showTarget ?? true;
    this.showControlPoints = options.showControlPoints ?? true;
    this.showControlLines = options.showControlLines ?? true;

    this.pathDotRadius = options.pathDotRadius ?? 3;
    this.pathStrokeWidth = options.pathStrokeWidth;
    this.controlPointRadius = options.controlPointRadius ?? 6;
  }

  public update(spine: Spine): void {
    if (!this.isVisible) return;
    this.clear();

    const skeleton = spine.skeleton;
    const pathConstraints = skeleton.pathConstraints || [];

    for (const constraint of pathConstraints) {
      // Some runtimes expose isActive, some always true; guard either way
      if (typeof constraint?.isActive === 'function' && !constraint.isActive()) continue;
      
      const world = constraint.world as number[] | undefined;
      if (!world || world.length < 3) continue;

      // Debug logging to understand the data structure
      console.log('Path constraint world data:', {
        name: constraint.target?.data?.name || 'unknown',
        worldLength: world.length,
        worldData: world,
        constraint: constraint
      });

      // Check if we have bezier curve data
      const hasCurveData = this.hasBezierData(world);
      
      if (hasCurveData) {
        this.drawBezierPath(world);
      } else {
        if (this.showPath) this.drawPath(world);
      }
      
      if (this.showStartEnd) this.drawStartEndCircles(world);
      if (this.showBoneConnections) this.drawBoneConnections(constraint, world);
      if (this.showTarget && constraint.target?.bone) this.drawTarget(constraint.target.bone);
    }
  }

  private hasBezierData(world: number[]): boolean {
    // Check if the world array contains bezier curve data
    // For a single bezier curve in Spine: [startX, startY, curve, control1X, control1Y, curve, control2X, control2Y, curve, endX, endY, curve]
    // So we need exactly 12 values for one bezier segment
    // The third value (index 2, 5, 8, 11) is usually a curve type indicator
    return world.length === 12;
  }

  private drawBezierPath(world: number[]): void {
    const g = this.graphics;
    const width = this.pathStrokeWidth ?? this.strokeWidth;

    // For Spine path constraints, if we have exactly 4 points (12 values), 
    // it's a single bezier curve: start, control1, control2, end
    if (world.length === 12) {
      const start = { x: world[0], y: world[1] };
      const control1 = { x: world[3], y: world[4] };
      const control2 = { x: world[6], y: world[7] };
      const end = { x: world[9], y: world[10] };

      // Draw control lines if enabled
      if (this.showControlLines) {
        g.stroke({ 
          color: this.controlLineColor, 
          width: 1, 
          pixelLine: true, 
          alpha: this.alpha * 0.5 
        });
        
        // Draw dashed lines
        this.drawDashedLine(start.x, start.y, control1.x, control1.y);
        this.drawDashedLine(end.x, end.y, control2.x, control2.y);
      }

      // Draw the bezier curve
      g.stroke({ color: this.pathColor, width, pixelLine: true, alpha: this.alpha });
      this.drawBezierCurve(start, control1, control2, end);

      // Draw control points if enabled
      if (this.showControlPoints) {
        // Start and end points (larger circles)
        this.drawControlPoint(start.x, start.y, this.startEndColor);
        this.drawControlPoint(end.x, end.y, this.startEndColor);
        
        // Control points (smaller circles)
        this.drawControlPoint(control1.x, control1.y, this.controlPointColor);
        this.drawControlPoint(control2.x, control2.y, this.controlPointColor);
      }
    } else {
      // Fall back to the parsed segments approach for multi-segment paths
      const segments = this.parseBezierSegments(world);

      for (const segment of segments) {
        // Draw control lines if enabled
        if (this.showControlLines) {
          g.stroke({ 
            color: this.controlLineColor, 
            width: 1, 
            pixelLine: true, 
            alpha: this.alpha * 0.5 
          });
          
          // Draw dashed lines
          this.drawDashedLine(segment.start.x, segment.start.y, segment.control1.x, segment.control1.y);
          this.drawDashedLine(segment.end.x, segment.end.y, segment.control2.x, segment.control2.y);
        }

        // Draw the bezier curve
        g.stroke({ color: this.pathColor, width, pixelLine: true, alpha: this.alpha });
        this.drawBezierCurve(segment.start, segment.control1, segment.control2, segment.end);

        // Draw control points if enabled
        if (this.showControlPoints) {
          // Start and end points
          this.drawControlPoint(segment.start.x, segment.start.y, this.startEndColor);
          this.drawControlPoint(segment.end.x, segment.end.y, this.startEndColor);
          
          // Control points
          this.drawControlPoint(segment.control1.x, segment.control1.y, this.controlPointColor);
          this.drawControlPoint(segment.control2.x, segment.control2.y, this.controlPointColor);
        }
      }
    }
  }

  private parseBezierSegments(world: number[]): Array<{
    start: { x: number, y: number },
    control1: { x: number, y: number },
    control2: { x: number, y: number },
    end: { x: number, y: number }
  }> {
    const segments = [];
    
    // Parse the world array assuming groups of 3 values [x, y, curveType]
    // We need at least 4 points (12 values) for a bezier curve
    if (world.length >= 12) {
      for (let i = 0; i < world.length - 9; i += 9) {
        // Each bezier segment needs 4 points (start, control1, control2, end)
        if (i + 11 < world.length) {
          segments.push({
            start: { x: world[i], y: world[i + 1] },
            control1: { x: world[i + 3], y: world[i + 4] },
            control2: { x: world[i + 6], y: world[i + 7] },
            end: { x: world[i + 9], y: world[i + 10] }
          });
        }
      }
    }
    
    // If we couldn't parse bezier segments, fall back to treating consecutive points as a single bezier
    if (segments.length === 0 && world.length >= 6) {
      // Try to interpret as a single bezier curve with evenly distributed control points
      const points = [];
      for (let i = 0; i < world.length; i += 3) {
        points.push({ x: world[i], y: world[i + 1] });
      }
      
      if (points.length >= 2) {
        // Create bezier segments between consecutive points
        for (let i = 0; i < points.length - 1; i++) {
          const start = points[i];
          const end = points[i + 1];
          
          // Calculate control points at 1/3 and 2/3 of the way between points
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          
          segments.push({
            start,
            control1: { x: start.x + dx * 0.33, y: start.y + dy * 0.33 },
            control2: { x: start.x + dx * 0.67, y: start.y + dy * 0.67 },
            end
          });
        }
      }
    }
    
    return segments;
  }

  private drawBezierCurve(
    start: { x: number, y: number },
    control1: { x: number, y: number },
    control2: { x: number, y: number },
    end: { x: number, y: number }
  ): void {
    const g = this.graphics;
    
    // Use PIXI's bezierCurveTo for smooth curve rendering
    g.moveTo(start.x, start.y);
    g.bezierCurveTo(
      control1.x, control1.y,
      control2.x, control2.y,
      end.x, end.y
    );
  }

  private drawDashedLine(x1: number, y1: number, x2: number, y2: number): void {
    const g = this.graphics;
    const dashLength = 5;
    const gapLength = 5;
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const dashCount = Math.floor(distance / (dashLength + gapLength));
    
    const dashX = dx / distance * dashLength;
    const dashY = dy / distance * dashLength;
    const gapX = dx / distance * gapLength;
    const gapY = dy / distance * gapLength;
    
    let currentX = x1;
    let currentY = y1;
    
    for (let i = 0; i < dashCount; i++) {
      g.moveTo(currentX, currentY);
      g.lineTo(currentX + dashX, currentY + dashY);
      currentX += dashX + gapX;
      currentY += dashY + gapY;
    }
    
    // Draw the last segment
    if (currentX < x2 || currentY < y2) {
      g.moveTo(currentX, currentY);
      g.lineTo(x2, y2);
    }
  }

  private drawControlPoint(x: number, y: number, color: number): void {
    const radius = this.controlPointRadius;
    if (!this.isCircleVisible(x, y, radius)) return;
    
    const g = this.graphics;
    
    // Filled circle
    g.fill({ color, alpha: this.alpha * 0.6 })
      .circle(x, y, radius)
      .fill();
    
    // Outlined circle
    g.stroke({ color, width: 2, pixelLine: true, alpha: this.alpha })
      .circle(x, y, radius);
  }

  // Original drawPath method for non-bezier paths
  private drawPath(world: number[]): void {
    // world is [x,y,curve?, x,y,curve?, ...] -> step 3
    if (!this.isPolylineVisible(world, 3, 0, 1)) return;

    const g = this.graphics;
    const width = this.pathStrokeWidth ?? this.strokeWidth;

    // If we have exactly 4 points (12 values), treat as bezier curve
    if (world.length === 12) {
      const start = { x: world[0], y: world[1] };
      const control1 = { x: world[3], y: world[4] };
      const control2 = { x: world[6], y: world[7] };
      const end = { x: world[9], y: world[10] };

      // Draw control lines first (behind the curve)
      if (this.showControlLines) {
        g.stroke({ 
          color: this.controlLineColor, 
          width: 1, 
          pixelLine: true, 
          alpha: this.alpha * 0.5 
        });
        
        this.drawDashedLine(start.x, start.y, control1.x, control1.y);
        this.drawDashedLine(end.x, end.y, control2.x, control2.y);
      }

      // Draw the bezier curve
      g.stroke({ color: this.pathColor, width, pixelLine: true, alpha: this.alpha });
      g.moveTo(start.x, start.y);
      g.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, end.x, end.y);

      // Draw all four control points
      if (this.showControlPoints) {
        // Start and end points (larger, orange)
        const endRadius = 8;
        g.fill({ color: this.startEndColor, alpha: this.alpha * 0.6 })
          .circle(start.x, start.y, endRadius)
          .fill();
        g.stroke({ color: this.startEndColor, width: 2, pixelLine: true, alpha: this.alpha })
          .circle(start.x, start.y, endRadius);
          
        g.fill({ color: this.startEndColor, alpha: this.alpha * 0.6 })
          .circle(end.x, end.y, endRadius)
          .fill();
        g.stroke({ color: this.startEndColor, width: 2, pixelLine: true, alpha: this.alpha })
          .circle(end.x, end.y, endRadius);
        
        // Control points (smaller, yellow)
        this.drawControlPoint(control1.x, control1.y, this.controlPointColor);
        this.drawControlPoint(control2.x, control2.y, this.controlPointColor);
      }
    } else {
      // For non-bezier paths, just draw as polyline
      g.stroke({ color: this.pathColor, width, pixelLine: true, alpha: this.alpha });
      g.moveTo(world[0], world[1]);

      for (let i = 3; i < world.length; i += 3) {
        const px = world[i];
        const py = world[i + 1];
        g.lineTo(px, py);
      }

      // Draw dots along the path
      const r = this.pathDotRadius;
      if (r > 0) {
        for (let i = 0; i < world.length; i += 3) {
          const px = world[i];
          const py = world[i + 1];
          if (this.isCircleVisible(px, py, r)) {
            g.fill({ color: this.pathColor, alpha: this.alpha * 0.35 })
              .circle(px, py, r)
              .fill();
          }
        }
      }
    }
  }

  private drawStartEndCircles(world: number[]): void {
    const g = this.graphics;
    const radius = 8;

    // Start circle
    if (world.length >= 3 && this.isCircleVisible(world[0], world[1], radius)) {
      g.fill({ color: this.startEndColor, alpha: this.alpha * 0.6 })
        .circle(world[0], world[1], radius)
        .fill();
      g.stroke({ color: this.startEndColor, width: 2, pixelLine: true, alpha: this.alpha })
        .circle(world[0], world[1], radius);
    }

    // End circle
    const endX = world[world.length - 3];
    const endY = world[world.length - 2];
    if (this.isCircleVisible(endX, endY, radius)) {
      g.fill({ color: this.startEndColor, alpha: this.alpha * 0.6 })
        .circle(endX, endY, radius)
        .fill();
      g.stroke({ color: this.startEndColor, width: 2, pixelLine: true, alpha: this.alpha })
        .circle(endX, endY, radius);
    }
  }

  private drawBoneConnections(constraint: any, world: number[]): void {
    const bones = constraint.bones as any[];
    if (!bones || bones.length === 0) return;

    const g = this.graphics;
    g.stroke({ 
      color: this.boneConnectionColor, 
      width: Math.max(1, this.strokeWidth - 1), 
      pixelLine: true, 
      alpha: this.alpha * 0.6 
    });

    for (const bone of bones) {
      const bx = bone.worldX;
      const by = bone.worldY;

      // find closest sampled path point
      let closestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < world.length; i += 3) {
        const dx = world[i] - bx;
        const dy = world[i + 1] - by;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist) {
          bestDist = d2;
          closestIdx = i;
        }
      }

      const px = world[closestIdx];
      const py = world[closestIdx + 1];

      if (this.isSegmentVisible(bx, by, px, py)) {
        g.moveTo(bx, by).lineTo(px, py);

        // subtle anchor dot at projection point
        if (this.isCircleVisible(px, py, 2)) {
          g.fill({ color: this.boneConnectionColor, alpha: this.alpha * 0.8 })
            .circle(px, py, 2)
            .fill();
        }
      }
    }
  }

  private drawTarget(targetBone: any): void {
    const tx = targetBone.worldX;
    const ty = targetBone.worldY;
    const R = 15;
    if (!this.isCircleVisible(tx, ty, R)) return;

    const g = this.graphics;

    // ring + crosshair for target
    g.fill({ color: this.targetColor, alpha: this.alpha * 0.18 })
      .circle(tx, ty, R)
      .fill();

    g.stroke({ color: this.targetColor, width: this.strokeWidth, pixelLine: true, alpha: this.alpha })
      .circle(tx, ty, R)
      .moveTo(tx - R * 0.7, ty).lineTo(tx + R * 0.7, ty)
      .moveTo(tx, ty - R * 0.7).lineTo(tx, ty + R * 0.7);
  }

  private drawArrowhead(sx: number, sy: number, tx: number, ty: number, size: number, color: number, alpha: number) {
    const dx = tx - sx;
    const dy = ty - sy;
    const mag = Math.hypot(dx, dy);
    if (mag < 1e-4) return;

    const ux = dx / mag;
    const uy = dy / mag;
    const nx = -uy;
    const ny = ux;

    const baseX = tx - ux * size;
    const baseY = ty - uy * size;
    const bx1 = baseX + nx * (size * 0.5);
    const by1 = baseY + ny * (size * 0.5);
    const bx2 = baseX - nx * (size * 0.5);
    const by2 = baseY - ny * (size * 0.5);

    this.graphics
      .fill({ color, alpha })
      .poly([bx1, by1, bx2, by2, tx, ty])
      .fill();
  }

  // Configuration methods
  public setShowPath(show: boolean): void { this.showPath = show; }
  public setShowStartEnd(show: boolean): void { this.showStartEnd = show; }
  public setShowBoneConnections(show: boolean): void { this.showBoneConnections = show; }
  public setShowTarget(show: boolean): void { this.showTarget = show; }
  public setShowControlPoints(show: boolean): void { this.showControlPoints = show; }
  public setShowControlLines(show: boolean): void { this.showControlLines = show; }

  public setColors(colors: {
    path?: number;
    startEnd?: number;
    boneConnection?: number;
    target?: number;
    controlPoint?: number;
    controlLine?: number;
  }): void {
    if (colors.path !== undefined) this.pathColor = colors.path;
    if (colors.startEnd !== undefined) this.startEndColor = colors.startEnd;
    if (colors.boneConnection !== undefined) this.boneConnectionColor = colors.boneConnection;
    if (colors.target !== undefined) this.targetColor = colors.target;
    if (colors.controlPoint !== undefined) this.controlPointColor = colors.controlPoint;
    if (colors.controlLine !== undefined) this.controlLineColor = colors.controlLine;
  }

  public setPathStyle(opts: { dotRadius?: number; strokeWidth?: number; controlRadius?: number }): void {
    if (opts.dotRadius !== undefined) this.pathDotRadius = opts.dotRadius;
    if (opts.strokeWidth !== undefined) this.pathStrokeWidth = opts.strokeWidth;
    if (opts.controlRadius !== undefined) this.controlPointRadius = opts.controlRadius;
  }
}