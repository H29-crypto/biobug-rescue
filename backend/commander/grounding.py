from .models import MissionSnapshot, CommanderPlan

UNCERTAINTIES = {
    'unobserved': 'No detected hazard does not mean an area is safe; unexplored and unobserved hazards may remain.',
    'estimates': 'Reported locations are estimates from simulated sensors, not surveyed positions.',
    'confidence': 'Confidence is an engineering simulation score, not a medical survival probability.',
    'thermal': 'Heat alone cannot identify a person or animal, establish life, or distinguish a warm object. Thermal locations include an engineering uncertainty radius; they require human verification.',
    'missing_answer': 'The supplied mission state does not establish an answer to that question.',
}
ACTIONS = {
    'review_life': 'Have the human operator review the observed life signals and their confirmation evidence.',
    'review_gas': 'Have the human operator review detected gas observations before considering entry.',
    'continue_observation': 'Consider gathering additional observations of unexplored areas and uncertain signals.',
    'human_review': 'Use qualified rescue-team judgment; this simulation does not determine safe entry or medical care.',
}

def catalog(s: MissionSnapshot):
    facts = {}
    def add(key, text, sector=None): facts[key]={'text':text,'sector':sector}
    confirmed=sum(d.status=='confirmed' for d in s.survivors)
    add('mission',f'At {s.missionTime:.2f} simulated seconds: {confirmed} confirmed survivors, {len(s.survivors)-confirmed} possible life signals, {len(s.hazards)} detected gas hazards; {s.swarm.active}/{s.swarm.deployed} BioBugs active; reachable-area coverage {s.swarm.coverage:.2f}%.')
    if s.thermalFindings is not None:
        add('mission', f'At {s.missionTime:.2f} simulated seconds: {len(s.thermalFindings)} unidentified heat sources and {len(s.hazards)} gas hazards. Heat alone confirms no survivor; identity and life remain unknown. Reachable-area coverage {s.swarm.coverage:.2f}%.')
    for d in s.thermalFindings or []:
        add(d.id, f'{d.id}: UNIDENTIFIED HEAT in Sector {d.sector}; apparent surface temperature {d.apparentC:.1f} C, contrast {d.contrastC:.1f} C above simulated ambient. Estimated location ({d.estimatedLocation.x:.1f}, {d.estimatedLocation.y:.1f}), uncertainty radius {d.uncertaintyRadius:.0f} world units. {d.observations} observations from {", ".join(d.observers)}; latest {d.latestObservation:.2f}s. Repetition establishes heat persistence only, not a survivor or life.', d.sector)
    add('unexplored',f'{100-s.swarm.coverage:.2f}% of reachable area remains unexplored. This snapshot does not identify individual unexplored sectors.')
    add('controller', 'The experimental MaleCNS-connectome-based computational controller uses real structural connectivity with simulated neural activity and engineering sensor/motor mappings. Local safety and swarm coordination can override its decoder proposal.' if s.controllerMode=='malecns' else 'Rule-Based navigation is active. Engineering obstacle avoidance and swarm coordination determine movement; AI has no control authority.')
    if s.completedAt is not None: add('completion',f'The survivor-location objective completed at {s.completedAt:.2f} simulated seconds. This means located in simulation, not physically rescued.')
    for d in s.survivors:
        add(d.id,f'{d.id}: {"CONFIRMED SURVIVOR" if d.status=="confirmed" else "POSSIBLE LIFE SIGNAL, not confirmed"} in Sector {d.sector}; engineering confidence {d.confidence*100:.1f}%; estimated location ({d.estimatedLocation.x:.1f}, {d.estimatedLocation.y:.1f}). Detected by {d.detectedBy} at {d.firstDetected:.2f}s; latest observation {d.latestObservation:.2f}s.',d.sector)
        evidence=f'{d.id} has {d.observations} readings from {", ".join(d.observers)}.'
        evidence+=f' Confirmed by {", ".join(d.confirmedBy)}: each recorded confirmation required three consecutive life readings at or above 0.45, sampled every 0.25 seconds.' if d.confirmedBy else ' No agent has recorded the required three consecutive strong life readings; confirmation is pending.'
        add(d.id+':evidence',evidence,d.sector)
    for h in s.hazards:
        add(h.id,f'{h.id}: {h.status.upper()} in Sector {h.sector}, detected by {h.detectedBy}. Peak normalized gas signal {h.severity:.3f}; engineering confidence {h.confidence*100:.1f}%. This is simulated gas sensing, not a physical concentration measurement.',h.sector)
    for a in s.agents:
        add(a.id,f'{a.id} is {a.status} in Sector {a.sector}.',a.sector)
        if a.controller and s.controllerMode=='malecns':
            c=a.controller
            add(a.id+':controller',f'{a.id}: latest sampled MaleCNS telemetry ({c.status}); stimulus left/front/right {c.stimulus.left:.3f}/{c.stimulus.front:.3f}/{c.stimulus.right:.3f}; simulated DNa02-L/R peaks {c.dna02L:.6f}/{c.dna02R:.6f}; engineering decoder proposal {c.decoderDecision}. This proposal may be overridden by local safety/coordination.',a.sector)
    for i,e in enumerate(s.recentEvents): add(f'event:{i}',f'{e.timestamp:.2f}s: {e.bugId} recorded {e.type} for {e.targetId} in Sector {e.sector}.',e.sector)
    return facts

def render(plan:CommanderPlan, facts:dict, snapshot:MissionSnapshot):
    refs=[*plan.situation,*plan.keyFindings,*plan.answer,*(p.factId for p in plan.priorities)]
    if not plan.situation or any(ref not in facts for ref in refs): raise ValueError('Unsupported fact or entity reference')
    if len(plan.situation)>3 or len(plan.priorities)>4 or len(plan.keyFindings)>5 or len(plan.answer)>4 or len(plan.uncertainties)>4 or len(plan.suggestedOperatorActions)>4: raise ValueError('Response too long')
    for p in plan.priorities:
        if p.sector!=facts[p.factId]['sector']: raise ValueError('Unsupported sector reference')
    if 'review_life' in plan.suggestedOperatorActions and not snapshot.survivors: raise ValueError('No life signal to review')
    if 'review_gas' in plan.suggestedOperatorActions and not snapshot.hazards: raise ValueError('No gas to review')
    # Mandatory caveats cannot be omitted by the model. Only server-authored sentences leave this boundary.
    return {'situationSummary':' '.join(facts[k]['text'] for k in plan.situation),
        'priorities':[{'priority':p.priority,'title':p.factId,'reason':facts[p.factId]['text'],'sector':p.sector} for p in plan.priorities],
        'keyFindings':[facts[k]['text'] for k in plan.keyFindings],
        'answer':' '.join(facts[k]['text'] for k in plan.answer) or UNCERTAINTIES['missing_answer'],
        'uncertainties':[UNCERTAINTIES[k] for k in dict.fromkeys([*[u for u in plan.uncertainties if u!='missing_answer' or not plan.answer],'unobserved','estimates','confidence',*(['thermal'] if snapshot.thermalFindings is not None else [])])],
        'suggestedOperatorActions':[ACTIONS[k] for k in dict.fromkeys([*plan.suggestedOperatorActions,'human_review'])]}
