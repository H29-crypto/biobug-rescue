import type {MotionSample} from '../rendering/rescue3d/model';
import type {Vec2,Sensors} from '../domain/types';
import type {MotorCommand} from '../simulation/controller';
import type {Stimulus} from '../simulation/sensorMapping';
import type {ThermalFinding,ThermalReading,ThermalState} from './thermal';
import type {RescueDiscovery} from '../simulation/rescue';

export type Authority='explore'|'waypoint'|'operator'|'investigate'|'hold';
export type FlightPhase='grounded'|'taking off'|'flying'|'landing';
export interface DecisionExplanation {
  time:number;mode:string;distances:{left:number;front:number;right:number};stimulus:Stimulus|null;
  neuralTime:number|null;dna02:{left:number;right:number}|null;proposal:MotorCommand;chosen:MotorCommand;applied:MotorCommand;
  reason:string;blocked:boolean;distance:number;altitudeChange:number;
}
export interface MissionCommand {kind:'waypoint'|'manual'|'explore'|'operator'|'flight'|'land'|'investigate';target?:Vec2;findingId?:string;forward?:number;angular?:number}
export interface OperatorAgent {
  authority:Authority;resume:Authority;goal:Vec2|null;route:Vec2[];task:string;findingId:string|null;taskStarted:number;scanRemaining:number;scanStarted:number;
  altitude:number;targetAltitude:number;phase:FlightPhase;speed:number;angular:number;manual:MotorCommand;lease:number;
  battery:number;connected:boolean;lowBattery:boolean;commandEpoch:number;commands:{due:number;epoch:number;command:MissionCommand}[];
  motionTrace:MotionSample[];actuations:{due:number;command:MotorCommand}[];desired:MotorCommand;localHeat:ThermalState;
  packet:RadioPacket|null;pendingPackets:RadioPacket[];nextPacket:number;seenHeat:Map<string,number>;explanation:DecisionExplanation|null;
}
/** All settings are reproducible engineering assumptions, not measured hardware. */
export const BACKPACK={commandDelay:.35,actuationDelay:.12,packetInterval:.5,packetDelay:.3,manualLease:.65,heartbeatTimeout:1.5,
  idleDrain:.08,radioDrain:.06,thermalDrain:.03,stimulationDrain:.10,reserve:15} as const;
export interface HeatMessage {association:string;finding:ThermalFinding}
export interface RadioPacket {
  time:number;due:number;position:Vec2;heading:number;altitude:number;phase:FlightPhase;state:'exploring'|'blocked'|'investigating'|'stopped';
  battery:number;authority:Authority;task:string;explored:boolean[];heat:HeatMessage[];reading:ThermalReading;gas:RescueDiscovery[];explanation:DecisionExplanation|null;
  motionSamples:MotionSample[];sensors:Sensors;gasSignal:number;route:Vec2[];distance:number;coordination:string;ownCoverage:number;peerBlocks:number;novelCells:number;neuralStatus:'idle'|'waiting'|'ready'|'offline';investigations:Investigation[];activity:{graph:string;ids:string[];time:number;sequence:number;values:number[];proposal:string}|null;
}
export interface Investigation {id:string;findingId:string;agentId:string;started:number;finished:number|null;status:'queued'|'en route'|'scanning'|'observed again'|'no new observation'|'blocked'|'cancelled';target:Vec2;message:string}
export interface MissionEvent {time:number;agentId:string;text:string}
export const emptyCommand=():MotorCommand=>({forward:0,angular:0});
