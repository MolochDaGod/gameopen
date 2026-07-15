import * as THREE from "three";
import {
  ROOM_PRESETS,
  type PropSpec,
  type RoomPreset,
  type RoomPresetId,
} from "./RoomPresets";

/**
 * The Danger Room training chamber. Originally a single fixed X-Men holographic
 * room, it is now **data-driven**: the look (floor, walls, grid, pillars,
 * lighting mood and decorative props) comes entirely from a {@link RoomPreset},
 * and {@link setPreset} tears the room down and rebuilds it from a different
 * preset on the fly.
 *
 * The structural shell — enclosing walls with the dungeon door + the recessed DJ
 * alcove window, the ceiling and the corner pillars — is built for EVERY preset
 * at the same fixed coordinates, so {@link doorPos}/{@link nearDoor} and the DJ
 * booth anchor stay valid no matter which environment is chosen. Presets only
 * re-skin materials/colours, change the lighting accents and place their own
 * props. Pure geometry, fully disposable.
 */
export class DangerRoom {
  group = new THREE.Group();
  readonly half = 16; // room is 32x32
  readonly height = 18; // wall/ceiling height (raised ~10m for headroom)
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  private grid!: THREE.GridHelper;
  /** Caller-requested grid visibility; gated by the preset's grid opacity. */
  private gridWanted = true;
  /** Extra push-out collision circles from collidable preset props. */
  private propObstacles: { x: number; z: number; r: number }[] = [];
  /** World position of the dungeon entrance portal (centre of the arch, floor). */
  readonly doorPos = new THREE.Vector3(0, 0, this.half - 0.2);
  private doorGlow: THREE.MeshBasicMaterial[] = [];

  // --- DJ alcove (a lit cut-out above the door for the resident DJ) ---
  /** Window opening half-width in the +Z wall above the door. */
  private readonly djWinHalfW = 3.6;
  /** Window opening bottom / top in the +Z wall (above the 4.2m door lintel). */
  private readonly djWinBottom = 4.9;
  private readonly djWinTop = 9.4;
  /** Floor height of the recessed booth platform (flush with the window sill). */
  private readonly djFloorY = 4.9;
  /** How far the alcove is recessed behind the +Z wall plane. */
  private readonly djDepth = 3.0;
  /**
   * World anchor where the DJ stands on the alcove platform, facing -Z into the
   * room. {@link DjBooth} places the booth + character relative to this.
   */
  readonly djBoothAnchor = new THREE.Vector3(0, this.djFloorY, this.half + this.djDepth * 0.62);
  /** Pulsing club lights/emissives in the alcove (animated in {@link update}). */
  private djGlow: { mat: THREE.MeshBasicMaterial; base: number; speed: number; phase: number }[] = [];
  private djLights: { light: THREE.PointLight; base: number; speed: number; phase: number }[] = [];
  /** When true, only the floor + grid are built (no enclosing walls/ceiling). */
  private readonly open: boolean;
  /** The active environment preset. */
  private preset: RoomPreset;

  constructor(opts: { open?: boolean; preset?: RoomPresetId } = {}) {
    this.open = !!opts.open;
    this.preset = ROOM_PRESETS[opts.preset ?? "holo"];
    this.build();
  }

  /** The id of the currently-built environment preset. */
  get presetId(): RoomPresetId {
    return this.preset.id;
  }

  /**
   * Swap to a different environment preset: dispose the current geometry and
   * rebuild from `id`. The door, DJ alcove anchor and combat coordinates are
   * preset-independent, so the dungeon portal, DJ booth and fighting all keep
   * working across the swap. No-op when the preset is already active.
   */
  setPreset(id: RoomPresetId) {
    if (id === this.preset.id) return;
    this.clearBuilt();
    this.preset = ROOM_PRESETS[id];
    this.build();
  }

  private track<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }
  private trackMat<T extends THREE.Material>(m: T): T {
    this.mats.push(m);
    return m;
  }

  /** Build the whole room from the active preset. */
  private build() {
    this.buildFloor();
    this.grid = this.buildGrid();
    this.applyGridVisible();
    if (!this.open) {
      this.buildWalls();
      this.buildPillars();
      this.buildDoor();
      this.buildDjAlcove();
      this.buildAccentLights();
      this.buildProps();
    }
  }

  private buildFloor() {
    const p = this.preset;
    const geo = this.track(new THREE.PlaneGeometry(this.half * 2, this.half * 2, 64, 64));
    // Subtle procedural micro-noise so the floor doesn't read as flat plastic
    // under ACES + soft shadows (still pure-colour tinted by the preset).
    const noise = this.trackMat(
      (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        const ctx = c.getContext("2d")!;
        const img = ctx.createImageData(256, 256);
        for (let i = 0; i < img.data.length; i += 4) {
          const n = 200 + ((Math.random() * 55) | 0);
          img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
          img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(12, 12);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        return new THREE.MeshStandardMaterial({
          color: p.floorColor,
          map: tex,
          metalness: p.floorMetalness,
          roughness: p.floorRoughness,
          envMapIntensity: 0.35,
        });
      })(),
    );
    const floor = new THREE.Mesh(geo, noise);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Emissive hologrid tiles slightly above the floor (preset-gated).
    if (p.showTiles) {
      const tileGeo = this.track(new THREE.PlaneGeometry(this.half * 2, this.half * 2, 16, 16));
      const tileMat = this.trackMat(
        new THREE.MeshBasicMaterial({ color: p.tileColor, wireframe: true, transparent: true, opacity: 0.35 }),
      );
      const tiles = new THREE.Mesh(tileGeo, tileMat);
      tiles.rotation.x = -Math.PI / 2;
      tiles.position.y = 0.02;
      this.group.add(tiles);
    }
  }

  private buildGrid(): THREE.GridHelper {
    const p = this.preset;
    const grid = new THREE.GridHelper(this.half * 2, 32, p.gridColor1, p.gridColor2);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = p.gridOpacity > 0 ? p.gridOpacity : 0.5;
    grid.position.y = 0.03;
    this.group.add(grid);
    return grid;
  }

  private buildWalls() {
    const p = this.preset;
    const h = this.height;
    const wallMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: p.wallColor, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }),
    );
    const seamMat = p.showSeams
      ? this.trackMat(new THREE.MeshBasicMaterial({ color: p.seamColor, transparent: true, opacity: 0.8 }))
      : null;
    const sides: [number, number, number][] = [
      [0, h / 2, -this.half],
      [0, h / 2, this.half],
      [-this.half, h / 2, 0],
      [this.half, h / 2, 0],
    ];
    sides.forEach(([x, y, z], i) => {
      // The +Z wall (i===1) gets a rectangular window cut above the door for the
      // DJ alcove, so it is built from four panels around the opening instead of
      // one full plane (and skips the seam strips that would cross the window).
      if (i === 1) {
        this.buildFrontWall(wallMat, z);
        return;
      }
      const wallGeo = this.track(new THREE.PlaneGeometry(this.half * 2, h));
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(x, y, z);
      if (i < 2) wall.rotation.y = z < 0 ? 0 : Math.PI;
      else wall.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      wall.receiveShadow = true;
      this.group.add(wall);

      // Glowing seam strips up the wall (every 2m, leaving headroom near top).
      if (!seamMat) return;
      const seamCount = Math.floor((h - 2) / 2);
      for (let s = 1; s <= seamCount; s++) {
        const seamGeo = this.track(new THREE.PlaneGeometry(this.half * 2, 0.08));
        const seam = new THREE.Mesh(seamGeo, seamMat);
        seam.position.set(x, s * 2, z);
        seam.rotation.copy(wall.rotation);
        seam.position.addScaledVector(new THREE.Vector3(0, 0, 1).applyEuler(wall.rotation), 0.02);
        this.group.add(seam);
      }
    });

    // Ceiling.
    const ceilGeo = this.track(new THREE.PlaneGeometry(this.half * 2, this.half * 2));
    const ceilMat = this.trackMat(new THREE.MeshStandardMaterial({ color: p.ceilColor, metalness: 0.5, roughness: 0.6, side: THREE.DoubleSide }));
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = h;
    this.group.add(ceil);
  }

  private buildPillars() {
    const p = this.preset;
    const pillarMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: p.pillarColor, metalness: 0.8, roughness: 0.3 }),
    );
    const glowMat = this.trackMat(new THREE.MeshBasicMaterial({ color: p.pillarGlowColor }));
    const c = this.half - 1.2;
    const corners: [number, number][] = [
      [-c, -c],
      [c, -c],
      [-c, c],
      [c, c],
    ];
    const h = this.height;
    for (const [x, z] of corners) {
      const geo = this.track(new THREE.CylinderGeometry(0.5, 0.6, h, 12));
      const pillar = new THREE.Mesh(geo, pillarMat);
      pillar.position.set(x, h / 2, z);
      pillar.castShadow = true;
      this.group.add(pillar);
      const stripGeo = this.track(new THREE.CylinderGeometry(0.52, 0.52, h - 2, 12, 1, true));
      const strip = new THREE.Mesh(stripGeo, glowMat);
      strip.position.set(x, h / 2, z);
      this.group.add(strip);
    }
  }

  /** Preset lighting mood: a few coloured point lights baked into the room. */
  private buildAccentLights() {
    for (const a of this.preset.accents) {
      const light = new THREE.PointLight(a.color, a.intensity, a.distance, 1.8);
      light.position.set(a.pos[0], a.pos[1], a.pos[2]);
      this.group.add(light);
    }
  }

  /** Build the preset's deliberate decorative props around the perimeter. */
  private buildProps() {
    for (const spec of this.preset.props) this.buildProp(spec);
  }

  private buildProp(spec: PropSpec) {
    switch (spec.kind) {
      case "crate":
        return this.buildCrate(spec);
      case "barrel":
        return this.buildBarrel(spec);
      case "column":
        return this.buildColumn(spec);
      case "banner":
        return this.buildBanner(spec);
      case "girder":
        return this.buildGirder(spec);
      case "pylon":
        return this.buildPylon(spec);
    }
  }

  private buildCrate(spec: PropSpec) {
    const h = spec.height ?? 1.0;
    const size = 1.1 * (spec.scale ?? 1);
    const geo = this.track(new THREE.BoxGeometry(size, h, size));
    const mat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: spec.color ?? 0x6b5236, metalness: 0.2, roughness: 0.85 }),
    );
    const crate = new THREE.Mesh(geo, mat);
    crate.position.set(spec.x, h / 2, spec.z);
    crate.rotation.y = spec.rotY ?? 0;
    crate.castShadow = true;
    crate.receiveShadow = true;
    this.group.add(crate);
    if (spec.collide) this.propObstacles.push({ x: spec.x, z: spec.z, r: size * 0.7 });
  }

  private buildBarrel(spec: PropSpec) {
    const s = spec.scale ?? 1;
    const r = 0.45 * s;
    const h = 1.1 * s;
    const geo = this.track(new THREE.CylinderGeometry(r, r * 1.05, h, 14));
    const mat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: spec.color ?? 0x7a3320, metalness: 0.5, roughness: 0.6 }),
    );
    const barrel = new THREE.Mesh(geo, mat);
    barrel.position.set(spec.x, h / 2, spec.z);
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    this.group.add(barrel);
    if (spec.collide) this.propObstacles.push({ x: spec.x, z: spec.z, r: r + 0.15 });
  }

  private buildColumn(spec: PropSpec) {
    const s = spec.scale ?? 1;
    const h = (spec.height ?? 9) * s;
    const r = 0.55 * s;
    const stoneMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: spec.color ?? 0xc9b894, metalness: 0.05, roughness: 0.95 }),
    );
    // Shaft.
    const shaftGeo = this.track(new THREE.CylinderGeometry(r * 0.9, r, h, 16));
    const shaft = new THREE.Mesh(shaftGeo, stoneMat);
    shaft.position.set(spec.x, h / 2, spec.z);
    shaft.castShadow = true;
    this.group.add(shaft);
    // Base + capital blocks.
    const blockGeo = this.track(new THREE.BoxGeometry(r * 2.6, 0.5, r * 2.6));
    const base = new THREE.Mesh(blockGeo, stoneMat);
    base.position.set(spec.x, 0.25, spec.z);
    this.group.add(base);
    const cap = new THREE.Mesh(blockGeo, stoneMat);
    cap.position.set(spec.x, h - 0.25, spec.z);
    this.group.add(cap);
    // Warm glow band just under the capital (torch-lit feel).
    if (spec.glow !== undefined) {
      const bandGeo = this.track(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.3, 16, 1, true));
      const bandMat = this.trackMat(
        new THREE.MeshBasicMaterial({ color: spec.glow, transparent: true, opacity: 0.7 }),
      );
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.set(spec.x, h - 1.0, spec.z);
      this.group.add(band);
    }
    if (spec.collide) this.propObstacles.push({ x: spec.x, z: spec.z, r: r + 0.3 });
  }

  private buildBanner(spec: PropSpec) {
    const s = spec.scale ?? 1;
    const w = 2.6 * s;
    const h = 7.5 * s;
    const geo = this.track(new THREE.PlaneGeometry(w, h));
    const mat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: spec.color ?? 0x8a2b2b,
        metalness: 0.0,
        roughness: 1.0,
        side: THREE.DoubleSide,
      }),
    );
    const banner = new THREE.Mesh(geo, mat);
    banner.position.set(spec.x, this.height * 0.5, spec.z);
    banner.rotation.y = spec.rotY ?? 0;
    this.group.add(banner);
  }

  private buildGirder(spec: PropSpec) {
    const len = spec.height ?? 16;
    const geo = this.track(new THREE.BoxGeometry(0.45, 0.6, len));
    const mat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: spec.color ?? 0x33302a, metalness: 0.8, roughness: 0.5 }),
    );
    const girder = new THREE.Mesh(geo, mat);
    girder.position.set(spec.x, this.height - 1.6, spec.z);
    girder.rotation.y = spec.rotY ?? 0;
    girder.castShadow = true;
    this.group.add(girder);
  }

  private buildPylon(spec: PropSpec) {
    const s = spec.scale ?? 1;
    const h = 3.2 * s;
    const baseMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: spec.color ?? 0x141a24, metalness: 0.7, roughness: 0.4 }),
    );
    const geo = this.track(new THREE.BoxGeometry(0.6 * s, h, 0.6 * s));
    const pylon = new THREE.Mesh(geo, baseMat);
    pylon.position.set(spec.x, h / 2, spec.z);
    pylon.castShadow = true;
    this.group.add(pylon);
    if (spec.glow !== undefined) {
      const glowMat = this.trackMat(
        new THREE.MeshBasicMaterial({ color: spec.glow, transparent: true, opacity: 0.85 }),
      );
      this.doorGlow.push(glowMat); // ride the soft pulse already driven in update()
      const glowGeo = this.track(new THREE.BoxGeometry(0.66 * s, h * 0.7, 0.12));
      for (const rot of [0, Math.PI / 2]) {
        const strip = new THREE.Mesh(glowGeo, glowMat);
        strip.position.set(spec.x, h / 2, spec.z);
        strip.rotation.y = rot;
        this.group.add(strip);
      }
    }
    if (spec.collide) this.propObstacles.push({ x: spec.x, z: spec.z, r: 0.45 * s });
  }

  /**
   * The dungeon entrance: a glowing arched portal recessed into the +Z wall with
   * a pulsing semicircle decal on the floor in front of it. Players walk into the
   * semicircle and press E to enter the dungeon.
   */
  private buildDoor() {
    const z = this.half - 0.15;
    const archMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x161c28, metalness: 0.7, roughness: 0.4 }),
    );
    const glowMat = this.trackMat(
      new THREE.MeshBasicMaterial({ color: 0x7b4dff, transparent: true, opacity: 0.9 }),
    );
    this.doorGlow.push(glowMat);

    // Door frame: two posts + a lintel framing a glowing portal plane.
    const postGeo = this.track(new THREE.BoxGeometry(0.4, 4.2, 0.5));
    for (const px of [-1.4, 1.4]) {
      const post = new THREE.Mesh(postGeo, archMat);
      post.position.set(px, 2.1, z);
      post.castShadow = true;
      this.group.add(post);
    }
    const lintelGeo = this.track(new THREE.BoxGeometry(3.2, 0.5, 0.5));
    const lintel = new THREE.Mesh(lintelGeo, archMat);
    lintel.position.set(0, 4.2, z);
    this.group.add(lintel);

    // The portal energy surface itself, facing into the room (-Z).
    const portalGeo = this.track(new THREE.PlaneGeometry(2.4, 3.9));
    const portal = new THREE.Mesh(portalGeo, glowMat);
    portal.position.set(0, 2.0, z - 0.26);
    portal.rotation.y = Math.PI;
    this.group.add(portal);

    // Pulsing semicircle decal on the floor in front of the door.
    const ringGeo = this.track(new THREE.RingGeometry(2.0, 2.5, 32, 1, 0, Math.PI));
    const ringMat = this.trackMat(
      new THREE.MeshBasicMaterial({ color: 0x9b6dff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    this.doorGlow.push(ringMat);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    // Orient the flat side of the semicircle along the wall, bulge into the room.
    ring.rotation.z = Math.PI;
    ring.position.set(0, 0.04, this.doorPos.z - 0.1);
    this.group.add(ring);
  }

  /**
   * The +Z wall built from four panels around a rectangular window above the
   * door, leaving the {@link djWinHalfW}/{@link djWinBottom}/{@link djWinTop}
   * opening clear so the recessed DJ alcove behind it is visible from the room.
   */
  private buildFrontWall(wallMat: THREE.Material, z: number) {
    const h = this.height;
    const W = this.half * 2;
    const winB = this.djWinBottom;
    const winT = this.djWinTop;
    const winHW = this.djWinHalfW;
    const sideW = this.half - winHW;
    const panels: [number, number, number, number][] = [
      // [width, height, centreX, centreY]
      [W, winB, 0, winB / 2], // below the window (includes the door region)
      [W, h - winT, 0, (winT + h) / 2], // above the window
      [sideW, winT - winB, -(winHW + sideW / 2), (winB + winT) / 2], // left of window
      [sideW, winT - winB, winHW + sideW / 2, (winB + winT) / 2], // right of window
    ];
    for (const [w, ph, cx, cy] of panels) {
      const geo = this.track(new THREE.PlaneGeometry(w, ph));
      const panel = new THREE.Mesh(geo, wallMat);
      panel.position.set(cx, cy, z);
      panel.rotation.y = Math.PI;
      panel.receiveShadow = true;
      this.group.add(panel);
    }
  }

  /**
   * The recessed, club-lit booth alcove behind the window: a platform floor,
   * back/side walls + ceiling forming a shallow box outside the +Z wall, a glowing
   * neon frame around the window and pulsing coloured spots so the resident DJ
   * (see {@link DjBooth}) reads as backlit. Pure geometry; pulsing handled in
   * {@link update}.
   */
  private buildDjAlcove() {
    const front = this.half; // window plane z
    const back = this.half + this.djDepth;
    const winHW = this.djWinHalfW;
    const floorY = this.djFloorY;
    const ceilY = this.djWinTop + 0.2;
    const innerHW = winHW + 0.5;

    const shellMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x0c0f17, metalness: 0.5, roughness: 0.6, side: THREE.DoubleSide }),
    );

    // Platform floor.
    const floorGeo = this.track(new THREE.BoxGeometry(innerHW * 2, 0.3, this.djDepth + 0.4));
    const floor = new THREE.Mesh(floorGeo, shellMat);
    floor.position.set(0, floorY - 0.15, (front + back) / 2);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Back wall.
    const backGeo = this.track(new THREE.PlaneGeometry(innerHW * 2, ceilY - floorY + 0.6));
    const backWall = new THREE.Mesh(backGeo, shellMat);
    backWall.position.set(0, (floorY + ceilY) / 2, back);
    this.group.add(backWall);

    // Ceiling.
    const ceilGeo = this.track(new THREE.PlaneGeometry(innerHW * 2, this.djDepth + 0.4));
    const ceil = new THREE.Mesh(ceilGeo, shellMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, ceilY, (front + back) / 2);
    this.group.add(ceil);

    // Side walls.
    for (const sx of [-1, 1]) {
      const sideGeo = this.track(new THREE.PlaneGeometry(this.djDepth + 0.4, ceilY - floorY + 0.6));
      const side = new THREE.Mesh(sideGeo, shellMat);
      side.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
      side.position.set(sx * innerHW, (floorY + ceilY) / 2, (front + back) / 2);
      this.group.add(side);
    }

    // Neon frame around the window opening (top + bottom + sides), pulsing.
    const frameColor = 0xff2bd6;
    const frameBars: [number, number, number, number][] = [
      // [width, height, centreX, centreY]
      [winHW * 2 + 0.3, 0.16, 0, this.djWinBottom], // sill
      [winHW * 2 + 0.3, 0.16, 0, this.djWinTop], // header
      [0.16, this.djWinTop - this.djWinBottom, -winHW, (this.djWinBottom + this.djWinTop) / 2],
      [0.16, this.djWinTop - this.djWinBottom, winHW, (this.djWinBottom + this.djWinTop) / 2],
    ];
    for (const [w, ph, cx, cy] of frameBars) {
      const mat = this.trackMat(
        new THREE.MeshBasicMaterial({ color: frameColor, transparent: true, opacity: 0.85 }),
      );
      this.djGlow.push({ mat, base: 0.85, speed: 3.0, phase: Math.random() * Math.PI * 2 });
      const geo = this.track(new THREE.PlaneGeometry(w, ph));
      const bar = new THREE.Mesh(geo, mat);
      bar.position.set(cx, cy, front - 0.08);
      bar.rotation.y = Math.PI;
      this.group.add(bar);
    }

    // Emissive light strips on the back wall behind the DJ.
    for (let i = 0; i < 3; i++) {
      const mat = this.trackMat(
        new THREE.MeshBasicMaterial({
          color: i === 1 ? 0x29e0ff : 0xff2bd6,
          transparent: true,
          opacity: 0.7,
        }),
      );
      this.djGlow.push({ mat, base: 0.7, speed: 2.0 + i, phase: Math.random() * Math.PI * 2 });
      const geo = this.track(new THREE.PlaneGeometry(0.18, ceilY - floorY - 0.4));
      const strip = new THREE.Mesh(geo, mat);
      strip.position.set((i - 1) * (innerHW * 0.7), (floorY + ceilY) / 2, back - 0.06);
      this.group.add(strip);
    }

    // Pulsing coloured spots lighting the booth.
    const lightDefs: [number, number][] = [
      [0xff2bd6, -winHW * 0.6],
      [0x29e0ff, winHW * 0.6],
    ];
    for (let i = 0; i < lightDefs.length; i++) {
      const [color, lx] = lightDefs[i];
      const light = new THREE.PointLight(color, 6, 14, 2);
      light.position.set(lx, ceilY - 0.4, (front + back) / 2);
      this.group.add(light);
      this.djLights.push({ light, base: 6, speed: 2.5 + i, phase: Math.random() * Math.PI * 2 });
    }
  }

  /**
   * Static interior obstacle circles (XZ) for player push-out collision: the
   * four corner light pillars plus any collidable preset props. Kept in sync with
   * {@link buildPillars}/{@link buildProps}. Live training dummies / fighters
   * supply their own footprints via `Targets.obstacleCircles()`.
   */
  get obstacles(): { x: number; z: number; r: number }[] {
    if (this.open) return [];
    const c = this.half - 1.2;
    const pillars: [number, number][] = [
      [-c, -c],
      [c, -c],
      [-c, c],
      [c, c],
    ];
    return [...pillars.map(([x, z]) => ({ x, z, r: 0.6 })), ...this.propObstacles];
  }

  /** True when `p` is standing in the door's activation zone (xz proximity). */
  nearDoor(p: THREE.Vector3): boolean {
    const dx = p.x - this.doorPos.x;
    const dz = p.z - this.doorPos.z;
    return Math.hypot(dx, dz) < 3.0;
  }

  setGridVisible(v: boolean) {
    this.gridWanted = v;
    this.applyGridVisible();
  }

  /** Grid is shown only when both requested AND the preset uses a grid. */
  private applyGridVisible() {
    this.grid.visible = this.gridWanted && this.preset.gridOpacity > 0;
  }

  /** Soft pulse of the holographic accents (door + DJ alcove club lighting). */
  update(t: number) {
    this.grid.position.y = 0.03 + Math.sin(t * 1.5) * 0.01;
    const pulse = 0.6 + Math.sin(t * 3) * 0.25;
    for (const m of this.doorGlow) m.opacity = pulse;
    for (const g of this.djGlow) {
      g.mat.opacity = Math.max(0.15, g.base * (0.55 + 0.45 * Math.sin(t * g.speed + g.phase)));
    }
    for (const l of this.djLights) {
      l.light.intensity = l.base * (0.5 + 0.5 * Math.abs(Math.sin(t * l.speed + l.phase)));
    }
  }

  /** Dispose all geometry/materials and empty the group (for rebuild/teardown). */
  private clearBuilt() {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.geos = [];
    this.mats = [];
    if (this.grid) {
      this.grid.geometry.dispose();
      (this.grid.material as THREE.Material).dispose();
    }
    this.doorGlow = [];
    this.djGlow = [];
    this.djLights = [];
    this.propObstacles = [];
    this.group.clear();
  }

  dispose() {
    this.clearBuilt();
    this.group.parent?.remove(this.group);
  }
}
