from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

Unit = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
Time = Annotated[float, Field(ge=0, le=1e8, allow_inf_nan=False)]
Sector = Annotated[str, Field(pattern=r'^[A-D][1-4]$')]
BugId = Annotated[str, Field(pattern=r'^BioBug #[1-8]$')]
class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')
class Location(Strict):
    x: Annotated[float, Field(ge=0, le=800, allow_inf_nan=False)]
    y: Annotated[float, Field(ge=0, le=560, allow_inf_nan=False)]
class Survivor(Strict):
    id: Annotated[str, Field(pattern=r'^S-\d{2}$')]
    status: Literal['possible', 'confirmed']
    sector: Sector
    confidence: Unit
    estimatedLocation: Location
    detectedBy: BugId
    confirmedBy: Annotated[list[BugId], Field(max_length=8)]
    observers: Annotated[list[BugId], Field(min_length=1, max_length=8)]
    firstDetected: Time
    latestObservation: Time
    observations: Annotated[int, Field(ge=1, le=10000000)]
class Hazard(Strict):
    id: Annotated[str, Field(pattern=r'^H-\d{2}$')]
    type: Literal['gas']
    status: Literal['gas warning', 'high gas']
    sector: Sector
    confidence: Unit
    severity: Unit
    detectedBy: BugId
class Stimulus(Strict):
    left: Unit
    front: Unit
    right: Unit
class Controller(Strict):
    status: Literal['idle','waiting','ready','offline']
    stimulus: Stimulus
    dna02L: Unit
    dna02R: Unit
    decoderDecision: Literal['FORWARD','TURN_LEFT','TURN_RIGHT','STOP']
class Agent(Strict):
    id: BugId
    status: Literal['EXPLORING','INVESTIGATING','HAZARD EXPOSURE','PAUSED']
    sector: Sector
    controller: Controller | None
class Swarm(Strict):
    deployed: Annotated[int, Field(ge=1, le=8)]
    active: Annotated[int, Field(ge=0, le=8)]
    coverage: Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)]
class Event(Strict):
    timestamp: Time
    bugId: BugId
    targetId: Annotated[str, Field(pattern=r'^[SH]-\d{2}$')]
    type: Literal['POSSIBLE LIFE SIGNAL','GAS HAZARD DETECTED','SURVIVOR LOCATED','INDEPENDENT SURVIVOR CONFIRMATION','HIGH GAS CONCENTRATION']
    sector: Sector
class MissionSnapshot(Strict):
    missionTime: Time
    controllerMode: Literal['rule-based','malecns']
    completedAt: Time | None
    swarm: Swarm
    survivors: Annotated[list[Survivor], Field(max_length=16)]
    hazards: Annotated[list[Hazard], Field(max_length=16)]
    agents: Annotated[list[Agent], Field(min_length=1, max_length=8)]
    recentEvents: Annotated[list[Event], Field(max_length=6)]

    @model_validator(mode='after')
    def consistent(self):
        ids={a.id for a in self.agents}
        targets={d.id for d in [*self.survivors,*self.hazards]}
        if len(ids)!=len(self.agents) or len(ids)!=self.swarm.deployed or self.swarm.active>self.swarm.deployed:
            raise ValueError('Inconsistent swarm')
        if len(targets)!=len(self.survivors)+len(self.hazards): raise ValueError('Duplicate target')
        for d in self.survivors:
            if not {d.detectedBy,*d.confirmedBy,*d.observers}<=ids: raise ValueError('Unknown observer')
            if (d.status=='confirmed')!=bool(d.confirmedBy): raise ValueError('Confirmation mismatch')
            if not set(d.confirmedBy)<=set(d.observers) or d.detectedBy not in d.observers: raise ValueError('Observer mismatch')
            if not d.firstDetected<=d.latestObservation<=self.missionTime: raise ValueError('Observation time')
        if any(h.detectedBy not in ids for h in self.hazards): raise ValueError('Unknown detector')
        if any(e.bugId not in ids or e.targetId not in targets or e.timestamp>self.missionTime for e in self.recentEvents): raise ValueError('Unknown event reference')
        if self.completedAt is not None and (self.completedAt>self.missionTime or not self.survivors or any(d.status!='confirmed' for d in self.survivors)): raise ValueError('Completion mismatch')
        return self

class CommanderRequest(Strict):
    snapshot: MissionSnapshot
    question: Annotated[str, Field(max_length=500)] = ''

# The model chooses evidence and priority; it cannot author unverified factual strings.
class Priority(Strict):
    priority: Literal['HIGH','MEDIUM','LOW']
    factId: str
    sector: str | None
class CommanderPlan(Strict):
    situation: list[str]
    priorities: list[Priority]
    keyFindings: list[str]
    answer: list[str]
    uncertainties: list[Literal['unobserved','estimates','confidence','missing_answer']]
    suggestedOperatorActions: list[Literal['review_life','review_gas','continue_observation','human_review']]
