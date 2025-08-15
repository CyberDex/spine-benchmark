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
