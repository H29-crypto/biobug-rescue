/** Coordinates are world units, not browser pixels. Time is measured in seconds. */
export interface Vec2 { x: number; y: number }
export interface Rect extends Vec2 { width: number; height: number }
export interface Obstacle extends Rect { id: string; kind: 'wall' | 'debris' }
export interface Survivor { id: string; position: Vec2; status: 'undetected' | 'possible' | 'confirmed'; discoveredBy?: string }
export interface Hazard { id: string; position: Vec2; radius: number; kind: 'gas' | 'heat' | 'unstable'; severity: number; discovered: boolean }
export interface ExplorationGrid { columns: number; rows: number; cellSize: number; explored: boolean[] }
export interface Environment { id: string; name: string; width: number; height: number; obstacles: Obstacle[]; exploration: ExplorationGrid; survivors: Survivor[]; hazards: Hazard[]; entry: Vec2 }
/** Future milestones only: normalized sensory values in [0, 1]. */
export interface Sensors { obstacleLeft: number; obstacleFront: number; obstacleRight: number; hazard: number; survivorCue: number; unexploredDirection: number }
export interface Neuron { id: string; kind: 'sensory' | 'interneuron' | 'motor'; activation: number; bias: number }
export interface Synapse { source: string; target: string; weight: number }
export interface NeuralController { neurons: Neuron[]; synapses: Synapse[]; motorOutput: { left: number; right: number } }
export interface BioBug { id: string; position: Vec2; heading: number; radius: number; speed: number; state: 'exploring' | 'avoiding' | 'idle'; sensors: Sensors; controller: NeuralController }
export interface Discovery { kind: 'survivor' | 'hazard'; entityId: string; bugId: string; time: number }
export interface Swarm { bugs: BioBug[]; sharedExploration: ExplorationGrid; discoveries: Discovery[]; elapsedTime: number }
