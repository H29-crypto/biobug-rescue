import copy
import json
from pathlib import Path
import pytest
from pydantic import ValidationError
from commander.models import MissionSnapshot, CommanderPlan
from commander.grounding import catalog, render

@pytest.fixture
def thermal_snapshot():
    s=json.loads((Path(__file__).parents[2]/'docs/COMMANDER_SNAPSHOT_EXAMPLES.json').read_text())[2]
    s.update(survivors=[],completedAt=None,recentEvents=[],thermalFindings=[dict(
        id='T-001',estimatedLocation=dict(x=180,y=450),uncertaintyRadius=30,sector='D1',
        apparentC=32,contrastC=10,observations=5,firstDetected=1,latestObservation=2,
        detectedBy='BioBug #1',observers=['BioBug #1'],persistent=True)])
    return s

def test_thermal_catalog_never_promotes_heat_to_survivor(thermal_snapshot):
    s=MissionSnapshot.model_validate(thermal_snapshot)
    facts=catalog(s)
    assert 'unidentified heat' in facts['mission']['text']
    assert 'not a survivor or life' in facts['T-001']['text']
    assert 'uncertainty radius 30' in facts['T-001']['text']
    plan=CommanderPlan(situation=['mission'],priorities=[],keyFindings=['T-001'],answer=['T-001'],uncertainties=[],suggestedOperatorActions=[])
    response=render(plan,facts,s)
    assert any('Heat alone cannot identify' in text for text in response['uncertainties'])

@pytest.mark.parametrize('change',[
    lambda s:s['thermalFindings'][0].update(confirmed=True),
    lambda s:s['thermalFindings'][0].update(groundTruthPosition={'x':1,'y':2}),
    lambda s:s['thermalFindings'][0].update(uncertaintyRadius=float('nan')),
    lambda s:s['thermalFindings'][0].update(latestObservation=999999),
    lambda s:s['thermalFindings'][0].update(observers=['BioBug #8']),
    lambda s:s.update(completedAt=1),
    lambda s:s.update(recentEvents=[dict(timestamp=1,bugId='BioBug #1',targetId='T-001',type='SURVIVOR LOCATED',sector='D1')]),
])
def test_invalid_or_overclaiming_thermal_packets_rejected(thermal_snapshot,change):
    s=copy.deepcopy(thermal_snapshot);change(s)
    with pytest.raises(ValidationError):MissionSnapshot.model_validate(s)

def test_thermal_event_is_supported(thermal_snapshot):
    thermal_snapshot['recentEvents']=[dict(timestamp=1,bugId='BioBug #1',targetId='T-001',type='UNIDENTIFIED HEAT DETECTED',sector='D1')]
    assert MissionSnapshot.model_validate(thermal_snapshot).recentEvents[0].targetId=='T-001'

def test_thermal_api_grounded_response_and_invalid_confirmation(thermal_snapshot):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from commander.api import create_router
    from commander.service import CommanderService
    plan=CommanderPlan(situation=['mission'],priorities=[],keyFindings=['T-001'],answer=['T-001'],uncertainties=[],suggestedOperatorActions=[])
    parse=AsyncMock(return_value=SimpleNamespace(status='completed',output_parsed=plan))
    service=CommanderService(client=SimpleNamespace(responses=SimpleNamespace(parse=parse)))
    app=FastAPI();app.include_router(create_router(service))
    with TestClient(app) as client:
        r=client.post('/commander/brief',json={'snapshot':thermal_snapshot,'question':'Is this a person?'})
        assert r.status_code==200 and r.json()['status']=='online'
        assert 'Heat alone cannot identify' in str(r.json())
        assert 'uncertainty radius 30' in str(r.json())
        thermal_snapshot['thermalFindings'][0]['confirmed']=True
        assert client.post('/commander/brief',json={'snapshot':thermal_snapshot}).status_code==422
    assert parse.call_count==1
