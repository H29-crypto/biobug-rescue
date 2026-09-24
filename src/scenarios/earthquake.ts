import type { Environment, Obstacle } from '../domain/types';

const wall = (id: string, x: number, y: number, width: number, height: number): Obstacle => ({ id, kind: 'wall', x, y, width, height });
const debris = (id: string, x: number, y: number, width: number, height: number): Obstacle => ({ id, kind: 'debris', x, y, width, height });

export function createEarthquakeEnvironment(): Environment {
  const columns = 40, rows = 28, cellSize = 20;
  return {
    id: 'earthquake-01', name: 'Collapsed residential building', width: 800, height: 560,
    entry: { x: 90, y: 480 },
    obstacles: [
      wall('north', 40, 40, 720, 16), wall('east', 744, 40, 16, 480),
      wall('south', 150, 504, 610, 16), wall('south-entry', 40, 504, 20, 16), wall('west', 40, 40, 16, 480),
      wall('a', 250, 40, 14, 170), wall('b', 250, 265, 14, 155),
      wall('c', 40, 230, 135, 14), wall('d', 330, 230, 180, 14),
      wall('e', 510, 40, 14, 130), wall('f', 510, 230, 14, 195),
      wall('g', 340, 405, 170, 14), wall('h', 595, 320, 150, 14),
      debris('d1', 125, 125, 55, 32), debris('d2', 181, 166, 29, 46),
      debris('d3', 310, 295, 52, 35), debris('d4', 373, 321, 38, 25),
      debris('d5', 577, 119, 67, 43), debris('d6', 643, 178, 39, 25),
      debris('d7', 615, 398, 51, 40), debris('d8', 155, 371, 42, 36),
    ],
    exploration: { columns, rows, cellSize, explored: Array<boolean>(columns * rows).fill(false) },
    survivors: [{ id: 'S-01', position: { x: 207, y: 305 }, status: 'undetected' }, { id: 'S-02', position: { x: 350, y: 120 }, status: 'undetected' }],
    hazards: [{ id: 'H-01', position: { x: 440, y: 462 }, radius: 33, kind: 'gas', severity: 0.7, discovered: false }, { id: 'H-02', position: { x: 110, y: 300 }, radius: 35, kind: 'gas', severity: 0.8, discovered: false }],
  };
}

