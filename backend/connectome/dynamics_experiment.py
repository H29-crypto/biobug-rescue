"""Run all deterministic engineering presets against an actual bounded MaleCNS graph."""
import argparse
import json
from pathlib import Path
import time
import psutil
from .dynamics import PRESETS, DynamicsEngine, SimulationParameters, SimulationRequest, build_dynamics_graph
from .loader import load_connectome
from .metadata import DEFAULT_DATA_DIR


def main():
    parser=argparse.ArgumentParser(description='Experimental MaleCNS dynamics; no BioBug movement control')
    parser.add_argument('--data-dir',type=Path,default=DEFAULT_DATA_DIR)
    parser.add_argument('--hops',type=int,choices=(2,3),default=2,help='3-hop expansion is an offline experiment only')
    parser.add_argument('--steps',type=int,default=20)
    parser.add_argument('--pulse-steps',type=int,default=3)
    parser.add_argument('--sign-mode',choices=('unsigned','predicted','both'),default='both')
    parser.add_argument('--report',type=Path)
    args=parser.parse_args()
    try:
        print('Loading checksum-verified real MaleCNS data...',flush=True)
        loaded=load_connectome(args.data_dir)
        graph=build_dynamics_graph(loaded.graph,args.hops)
        engine=DynamicsEngine(graph)
        print('Dynamics graph:',json.dumps(graph.summary()),flush=True)
        experiments=[]
        for mode in ('unsigned','predicted') if args.sign_mode=='both' else (args.sign_mode,):
            for name,stimulus in PRESETS.items():
                req=SimulationRequest(stimulus=stimulus,steps=args.steps,pulse_steps=args.pulse_steps,parameters=SimulationParameters(sign_mode=mode))
                result=engine.simulate(req)
                repeated=engine.simulate(req)
                assert result['trace']==repeated['trace'] and result['summary']==repeated['summary'], 'Nondeterministic experiment'
                experiments.append({'preset':name,**result})
                dna=result['summary']['dna02']
                print(f"{mode} | {name}: L peak={dna['L']['peak']:.8f} cumulative={dna['L']['cumulative']:.8f}; R peak={dna['R']['peak']:.8f} cumulative={dna['R']['cumulative']:.8f}; peak active={result['summary']['peak_active_neurons']}; step={result['performance']['seconds_per_step']*1000:.4f}ms",flush=True)
        report={'dataset':loaded.report['dataset'],'version':loaded.report['version'],'loaded_graph':loaded.status(),
                'dynamics_graph':graph.summary(),'experiments':experiments,'deterministic_repeat_verified':True,
                'process_rss_bytes':psutil.Process().memory_info().rss,
                'provenance':loaded.report['sources']}
        if args.report:
            args.report.parent.mkdir(parents=True,exist_ok=True)
            args.report.write_text(json.dumps(report,indent=2,allow_nan=False)+'\n',encoding='utf-8')
        print('Process RSS bytes:',report['process_rss_bytes'])
    except (OSError,ValueError,KeyError) as error:
        parser.exit(1,f'Cannot run dynamics experiment: {error}\n')

if __name__=='__main__':
    main()
