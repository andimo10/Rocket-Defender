export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface SmokePuff {
  yOffset: number; // Distance from endY (top)
  xOffset: number;
  size: number;
}

export interface Trail {
  id: number;
  x: number;
  startY: number;
  endY: number;
  life: number;
  maxLife: number;
  puffs: SmokePuff[];
}

export interface Alien {
  id: number;
  pos: Position;
  vel: Velocity;
  radius: number;
  hp: number; // 2 = shielded, 1 = vulnerable, 0 = dead
  maxHp: number;
  active: boolean;
  pulseOffset: number;
}

export interface Particle {
  id: number;
  pos: Position;
  vel: Velocity;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export type GameState = 'START' | 'PLAYING' | 'GAME_OVER';