from __future__ import annotations
from contextlib import asynccontextmanager
import logging
import os
import time
from functools import lru_cache
from threading import Lock
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from .dynamics import DynamicsEngine, SimulationRequest, build_dynamics_graph
from .dynamics import Stimulus
from .control import ControlEngine, BatchStimulus
from .annotations import POPULATIONS
from .pathway_analysis import PathwayAnalyzer
from .graph import json_value
from .loader import load_connectome
from .metadata import DEFAULT_DATA_DIR


def create_app(data_dir: Path | None = None, *, loader=load_connectome) -> FastAPI:
    directory = data_dir or Path(os.environ.get("MALECNS_DATA_DIR", str(DEFAULT_DATA_DIR)))

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.connectome = None
        app.state.load_error = None
        app.state.pathway_analyzer = None
        app.state.dynamics_engine = None
        app.state.control_engine = None
        try:
            app.state.connectome = loader(directory)
        except Exception as error:
            # Report failure explicitly. Never substitute placeholder counts or a synthetic graph.
            app.state.load_error = f"{type(error).__name__}: {error}"
            logging.exception("MaleCNS loading failed")
        yield
        app.state.connectome = None
        app.state.pathway_analyzer = None
        app.state.dynamics_engine = None
        app.state.control_engine = None
        pathway_export.cache_clear()

    app = FastAPI(title="BioBug Rescue - MaleCNS structural data prototype", lifespan=lifespan,
                  description="Real structural connectivity and simulated neural dynamics for an engineering BioBug controller. Not a biological brain simulation.")

    app.add_middleware(CORSMiddleware,
        allow_origins=[f'http://{host}:{port}' for host in ('localhost', '127.0.0.1') for port in (5173, 5174, 4173, 4174)],
        allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])
    pathway_lock = Lock()

    def loaded():
        value = app.state.connectome
        if value is None:
            raise HTTPException(503, detail=app.state.load_error or "Dataset not loaded")
        return value

    @app.get("/connectome/status")
    def status():
        if app.state.connectome is None:
            return {"dataset": "MaleCNS", "version": None, "neurons": None, "edges": None,
                    "synaptic_contacts": None, "loaded": False, "error": app.state.load_error}
        return app.state.connectome.status()

    @app.get("/connectome/neurons/{body_id}")
    def neuron(body_id: int):
        try:
            return loaded().graph.neuron(body_id)
        except KeyError as error:
            raise HTTPException(404, str(error)) from error

    @app.get("/connectome/neurons")
    def neurons(neuron_type: str | None = None, limit: int = Query(default=20, ge=1, le=1000)):
        return json_value(loaded().graph.find_neurons(neuron_type=neuron_type, limit=limit).to_pylist())

    @app.get("/connectome/edges/{pre}/{post}")
    def edge(pre: int, post: int):
        try:
            return {"body_pre": pre, "body_post": post, "synaptic_contacts": loaded().graph.edge(pre, post)}
        except KeyError as error:
            raise HTTPException(404, str(error)) from error

    @app.get('/connectome/populations')
    def populations():
        value = loaded()
        return {'dataset': value.report['dataset'], 'version': value.report['version'],
                'populations': [p.describe(value.graph.neurons) for p in POPULATIONS]}

    @lru_cache(maxsize=16)
    def pathway_export(source: str, target: str, max_nodes: int, max_edges: int):
        value = loaded()
        if app.state.pathway_analyzer is None:
            app.state.pathway_analyzer = PathwayAnalyzer(value.graph)
        result = app.state.pathway_analyzer.export(source, target, max_nodes, max_edges)
        result.update(dataset=value.report['dataset'], version=value.report['version'])
        return result

    @app.get('/connectome/pathway-subgraph')
    def pathway_subgraph(source: str = 'tactile', target: str = 'DNa02',
                         max_nodes: int = Query(default=32, ge=4, le=80),
                         max_edges: int = Query(default=64, ge=3, le=160)):
        # Serialize expensive analysis; keep repeated development selections bounded in memory.
        with pathway_lock:
            try:
                return pathway_export(source, target, max_nodes, max_edges)
            except ValueError as error:
                raise HTTPException(422, str(error)) from error

    @app.post('/connectome/simulate')
    def simulate(request: SimulationRequest):
        started = time.perf_counter()
        value = loaded()
        with pathway_lock:
            cold = app.state.dynamics_engine is None
            try:
                if cold:
                    app.state.dynamics_engine = DynamicsEngine(build_dynamics_graph(value.graph))
                result = app.state.dynamics_engine.simulate(request)
            except ValueError as error:
                raise HTTPException(422, str(error)) from error
        result.update(dataset=value.report['dataset'], version=value.report['version'])
        result['performance'].update(api_handler_seconds=time.perf_counter()-started, cold_graph_build=cold)
        return result

    def control_engine():
        value = loaded()
        if app.state.dynamics_engine is None:
            app.state.dynamics_engine = DynamicsEngine(build_dynamics_graph(value.graph))
        if app.state.control_engine is None:
            app.state.control_engine = ControlEngine(app.state.dynamics_engine)
        return app.state.control_engine

    @app.get('/connectome/control-network')
    def control_network():
        value = loaded()
        with pathway_lock:
            engine = control_engine()
            e = engine.engine
            return {'dataset': value.report['dataset'], 'version': value.report['version'],
                    'graph': engine.summary, 'nodes': [e.node(i) for i in range(len(e.records))],
                    'edges': [{'source': str(e.records[e.rows[i]]['bodyId']),
                               'target': str(e.records[e.cols[i]]['bodyId']),
                               'structural_contacts': int(e.graph.structural.adjacency.data[i]),
                               'engineering_weight': float(engine.weights.data[i])}
                              for i in range(engine.weights.nnz)]}

    @app.post('/connectome/control')
    def control(stimulus: Stimulus):
        value = loaded()
        with pathway_lock:
            try:
                result = control_engine().evaluate(stimulus)
            except ValueError as error:
                raise HTTPException(422, str(error)) from error
        result.update(dataset=value.report['dataset'], version=value.report['version'])
        return result

    @app.post('/connectome/control-batch')
    def control_batch(request: BatchStimulus):
        value = loaded()
        with pathway_lock:
            try:
                engine = control_engine()
                results = []
                for agent in request.agents:
                    response = engine.evaluate(agent.stimulus)
                    response.update(dataset=value.report['dataset'], version=value.report['version'])
                    results.append({'id': agent.id, 'response': response})
                return {'results': results}
            except ValueError as error:
                raise HTTPException(422, str(error)) from error

    return app


app = create_app()
