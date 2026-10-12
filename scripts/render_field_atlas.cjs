// The home-page drawing uses actual recorded movement, sampled once per second.
// It intentionally shows terrain as an editorial overview; no targets are exported.
const fs = require('node:fs');
const load = require('../tests/compile.cjs')();
const { createResearchTrial, stepResearchTrial } = load('researchExperiment');
const config = { scenario: 'residential', seed: 2026, duration: 60, count: 4 };
const trial = createResearchTrial(config, 'information');
while (!stepResearchTrial(trial, 600)) {}
const { environment } = trial.swarm.agents[0].simulation;
const atlas = {
  caption: 'Information-gain exploration. Residential map, seed 2026, four agents, 60 simulated seconds.',
  width: environment.width, height: environment.height,
  obstacles: environment.obstacles,
  paths: trial.frames[0].agents.map((agent, index) => ({ id: agent.id,
    points: trial.frames.map(frame => ({
      x: Number(frame.agents[index].position.x.toFixed(1)),
      y: Number(frame.agents[index].position.y.toFixed(1)),
    })),
  })),
};
fs.writeFileSync('src/research/atlas.json', JSON.stringify(atlas) + '\n');
console.log('Wrote field atlas: measured routes, terrain, no hidden targets.');
