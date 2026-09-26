import { requestNeural } from '../simulation/neuralClient';
import type { NeuralRequest } from './neuralLoop';
import { createDecoder, decodeMotor } from '../simulation/motorDecoder';
import type { FlySimulation } from './simulation';
import type { Stimulus } from '../simulation/sensorMapping';
export async function stimulateFly(sim:FlySimulation,stimulus:Stimulus,signal:AbortSignal,request:NeuralRequest=requestNeural){
  if(sim.running)throw Error('Pause the virtual body before stimulation');
  const input={...stimulus},sensors={...sim.fly.sensors},speed=sim.fly.speed,seed=sim.config.seed;
  const response=await request(input,signal);if(signal.aborted)throw Error('Stimulation cancelled');
  const decision=decodeMotor(response.dna02.L.peak,response.dna02.R.peak,input,sensors,speed,createDecoder(seed));
  return {response,decision};
}
