import { Container, Sprite } from 'pixi.js';

export interface CircleBody {
  id: string;
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  isMerging: boolean;
  spawnTime: number;
  sprite: Sprite;
}

export interface BoxBoundary {
  left: number;
  right: number;
  bottom: number;
  dangerY: number;
}

export interface PhysicsWorldOptions {
  gravity?: number;
  friction?: number;
  restitution?: number;
  substeps?: number;
  boundary: BoxBoundary;
  onMerge?: (bodyA: CircleBody, bodyB: CircleBody) => void;
  onDangerChange?: (isDanger: boolean) => void;
}

export class CirclePhysicsWorld {
  public bodies: CircleBody[] = [];
  public readonly boundary: BoxBoundary;
  public gravity: number;
  public friction: number;
  public restitution: number;
  public substeps: number;

  private onMerge?: (bodyA: CircleBody, bodyB: CircleBody) => void;
  private onDangerChange?: (isDanger: boolean) => void;

  private isDangerState = false;
  private dangerDuration = 0; // 处于危险线上的累计持续时间（秒）

  constructor(options: PhysicsWorldOptions) {
    this.boundary = options.boundary;
    this.gravity = options.gravity ?? 0.42;
    this.friction = options.friction ?? 0.985;
    this.restitution = options.restitution ?? 0.22;
    this.substeps = options.substeps ?? 4;
    this.onMerge = options.onMerge;
    this.onDangerChange = options.onDangerChange;
  }

  public addBody(body: CircleBody): void {
    this.bodies.push(body);
  }

  public removeBody(id: string): CircleBody | null {
    const idx = this.bodies.findIndex((b) => b.id === id);
    if (idx >= 0) {
      const [removed] = this.bodies.splice(idx, 1);
      return removed;
    }
    return null;
  }

  public clear(): void {
    this.bodies.forEach((b) => {
      if (b.sprite.parent) {
        b.sprite.parent.removeChild(b.sprite);
      }
    });
    this.bodies = [];
    this.isDangerState = false;
    this.dangerDuration = 0;
  }

  public update(delta: number): void {
    // 微信与 Web 双端 delta 归一化 (delta 通常在 0.5 ~ 2 之间)
    const dt = Math.min(2.0, Math.max(0.2, delta)) / this.substeps;
    const subGravity = this.gravity * dt;

    for (let step = 0; step < this.substeps; step++) {
      // 1. 速度与位置积分
      for (const b of this.bodies) {
        if (b.isMerging) continue;
        b.vy += subGravity;
        b.vx *= Math.pow(this.friction, dt);
        b.vy *= Math.pow(this.friction, dt);

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // 边界约束与碰撞反弹
        this.resolveBoundary(b);
      }

      // 2. 双球碰撞与合成判定
      this.resolveBodyCollisions();
    }

    // 3. 将物理坐标同步给 Pixi 精灵
    for (const b of this.bodies) {
      b.sprite.x = b.x;
      b.sprite.y = b.y;
    }

    // 4. 危险线判定 (只检测产生超过 1.5 秒且稳定的水果)
    this.checkDangerLine(delta / 60);
  }

  private resolveBoundary(b: CircleBody): void {
    const { left, right, bottom } = this.boundary;

    // 左侧墙体
    if (b.x - b.radius < left) {
      b.x = left + b.radius;
      if (b.vx < 0) b.vx = -b.vx * this.restitution;
    }

    // 右侧墙体
    if (b.x + b.radius > right) {
      b.x = right - b.radius;
      if (b.vx > 0) b.vx = -b.vx * this.restitution;
    }

    // 底部箱体
    if (b.y + b.radius > bottom) {
      b.y = bottom - b.radius;
      if (b.vy > 0) {
        b.vy = -b.vy * this.restitution;
        // 地面摩擦减速
        b.vx *= 0.94;
        if (Math.abs(b.vy) < 0.2) b.vy = 0;
      }
    }
  }

  private resolveBodyCollisions(): void {
    const len = this.bodies.length;
    for (let i = 0; i < len; i++) {
      const b1 = this.bodies[i];
      if (b1.isMerging) continue;

      for (let j = i + 1; j < len; j++) {
        const b2 = this.bodies[j];
        if (b2.isMerging) continue;

        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const distSq = dx * dx + dy * dy;
        const minDist = b1.radius + b2.radius;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.001;
          const nx = dx / dist;
          const ny = dy / dist;

          // 同等级水果合成判定
          if (b1.tier === b2.tier && b1.tier < 10) {
            b1.isMerging = true;
            b2.isMerging = true;
            this.onMerge?.(b1, b2);
            continue;
          }

          // 弹性冲量响应
          const kx = b1.vx - b2.vx;
          const ky = b1.vy - b2.vy;
          const p = 2 * (nx * kx + ny * ky) / (b1.mass + b2.mass);

          b1.vx -= p * b2.mass * nx * (1 + this.restitution) * 0.5;
          b1.vy -= p * b2.mass * ny * (1 + this.restitution) * 0.5;
          b2.vx += p * b1.mass * nx * (1 + this.restitution) * 0.5;
          b2.vy += p * b1.mass * ny * (1 + this.restitution) * 0.5;

          // 穿透分离 (位置修正，避免粘连)
          const penetration = (minDist - dist) * 0.5;
          const totalMass = b1.mass + b2.mass;
          const ratio1 = b2.mass / totalMass;
          const ratio2 = b1.mass / totalMass;

          b1.x -= nx * penetration * ratio1;
          b1.y -= ny * penetration * ratio1;
          b2.x += nx * penetration * ratio2;
          b2.y += ny * penetration * ratio2;
        }
      }
    }
  }

  private checkDangerLine(dtSeconds: number): void {
    const now = performance.now();
    let hasOverhead = false;

    for (const b of this.bodies) {
      if (b.isMerging) continue;
      // 水果掉落 1.2 秒后且垂直速度不大时，才参与超高判定
      if (now - b.spawnTime > 1200 && Math.abs(b.vy) < 1.5) {
        if (b.y - b.radius < this.boundary.dangerY) {
          hasOverhead = true;
          break;
        }
      }
    }

    if (hasOverhead) {
      this.dangerDuration += dtSeconds;
      if (!this.isDangerState) {
        this.isDangerState = true;
        this.onDangerChange?.(true);
      }
    } else {
      this.dangerDuration = Math.max(0, this.dangerDuration - dtSeconds * 2);
      if (this.isDangerState && this.dangerDuration <= 0) {
        this.isDangerState = false;
        this.onDangerChange?.(false);
      }
    }
  }

  public getDangerDuration(): number {
    return this.dangerDuration;
  }

  /**
   * 道具：大地震动 / 晃动箱体 (给予所有水果向上并带随机水平扰动冲量)
   */
  public applyEarthquake(): void {
    for (const b of this.bodies) {
      if (b.isMerging) continue;
      b.vy = - (6 + Math.random() * 8);
      b.vx = (Math.random() - 0.5) * 12;
    }
  }

  /**
   * 道具：爆破冲击波 (以某点为圆心对周围水果造成推开冲量)
   */
  public applyExplosionImpulse(cx: number, cy: number, blastRadius = 320, force = 20): void {
    for (const b of this.bodies) {
      if (b.isMerging) continue;
      const dx = b.x - cx;
      const dy = b.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < blastRadius && dist > 1) {
        const ratio = 1 - dist / blastRadius;
        const nx = dx / dist;
        const ny = dy / dist;
        b.vx += nx * force * ratio;
        b.vy += ny * force * ratio - 4; // 附带向上抬升
      }
    }
  }
}
