"""Measure real telemetry allocation overhead independently of the running API."""
import gc
import json
from pathlib import Path
import sys
import time
import tracemalloc
import psutil

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
from connectome.loader import load_connectome
from connectome.dynamics import build_dynamics_graph, DynamicsEngine, Stimulus
from connectome.control import ControlEngine

start=time.perf_counter()
loaded=load_connectome()
engine=ControlEngine(DynamicsEngine(build_dynamics_graph(loaded.graph)))
load_seconds=time.perf_counter()-start
process=psutil.Process()
result={'method':'One process, full official dataset retained, same real controller. tracemalloc measures Python-tracked allocations, not total native/GPU memory.', 'load_and_controller_setup_seconds':load_seconds,'rss_after_load_bytes':process.memory_info().rss}
for rich in [False,True]:
    for _ in range(10):engine.evaluate(Stimulus(left=.4,front=.7,right=.1),include_activity=rich)
    gc.collect();tracemalloc.start();tracemalloc.reset_peak()
    response=engine.evaluate(Stimulus(left=.4,front=.7,right=.1),include_activity=rich)
    retained,peak=tracemalloc.get_traced_memory();tracemalloc.stop()
    result['with_activity' if rich else 'default']={'python_retained_bytes':retained,'python_peak_bytes':peak,'compact_json_bytes':len(json.dumps(response,separators=(',',':')).encode()),'rss_bytes':process.memory_info().rss}
    del response
result['additional_python_retained_bytes']=result['with_activity']['python_retained_bytes']-result['default']['python_retained_bytes']
(ROOT/'docs/MALECNS_ANATOMICAL_BACKEND_MEMORY.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
