"""Annotation queries: source fields stay distinct from functional interpretations."""
from __future__ import annotations
from dataclasses import dataclass, asdict
import numpy as np
import pyarrow as pa
import pyarrow.compute as pc

DATA_SOURCE = 'https://male-cns.janelia.org/download/'


def query_mask(table: pa.Table, criteria: dict[str, tuple[str, ...]]) -> np.ndarray:
    mask = np.ones(table.num_rows, dtype=bool)
    for field, values in criteria.items():
        if field not in table.column_names:
            raise ValueError(f'Annotation field is unavailable: {field}')
        mask &= pc.fill_null(pc.is_in(table[field], value_set=pa.array(values, type=pa.string())), False).to_numpy()
    return mask


def query_neurons(table: pa.Table, **criteria: str | tuple[str, ...]) -> pa.Table:
    normalized = {key: (value,) if isinstance(value, str) else tuple(value) for key, value in criteria.items()}
    return table.filter(pa.array(query_mask(table, normalized)))


def counts(table: pa.Table, field: str) -> dict[str, int]:
    if field not in table.column_names:
        return {}
    return {str(row['values']) if row['values'] is not None else '(missing)': row['counts']
            for row in pc.value_counts(table[field]).to_pylist()}


def laterality(record: dict, field: str) -> dict:
    if field not in ('rootSide', 'somaSide'):
        raise ValueError('Laterality must name the actual rootSide or somaSide field')
    value = record.get(field)
    return {'side': value if value in ('L', 'R', 'M') else None, 'side_field': field, 'raw_value': value}


def inventory(table: pa.Table) -> dict:
    result = {}
    for field in ['superclass', 'class', 'subclass', 'type', 'rootSide', 'somaSide', 'somaNeuromere',
                  'entryNerve', 'exitNerve', 'receptorType', 'serialMotif', 'predicted_nt', 'consensus_nt']:
        available = field in table.column_names
        frequencies = counts(table, field) if available else {}
        result[field] = {'available': available, 'non_null': table.num_rows - table[field].null_count if available else 0,
                         'distinct_non_null': len(frequencies) - int('(missing)' in frequencies),
                         'values': dict(sorted(frequencies.items(), key=lambda pair: (-pair[1], pair[0]))[:40])}
    return {'columns': table.column_names, 'fields': result,
            'neuropil_limit': 'The loaded neuron table has somaNeuromere and entry/exit nerves, but no per-neuron neuropil innervation or ROI-specific edges. The release metadata lists ROIs globally only.',
            'function_limit': 'No generic walking, turning, locomotion, or interneuron function field exists. Named-type functional evidence is curated separately; cb_intrinsic/vnc_intrinsic are anatomical categories.'}


@dataclass(frozen=True)
class Population:
    id: str
    label: str
    role: str
    criteria: dict[str, tuple[str, ...]]
    side_field: str
    evidence: str
    evidence_note: str
    sources: tuple[str, ...] = (DATA_SOURCE,)

    def mask(self, table: pa.Table) -> np.ndarray:
        return query_mask(table, self.criteria)

    def describe(self, table: pa.Table, *, include_ids: bool = False) -> dict:
        selected = table.filter(pa.array(self.mask(table)))
        result = {**asdict(self), 'count': selected.num_rows, 'laterality': counts(selected, self.side_field),
                  'regions': {field: counts(selected, field) for field in ('somaNeuromere', 'entryNerve', 'exitNerve')},
                  'types': counts(selected, 'type')}
        if include_ids:
            result['neuron_ids'] = selected['bodyId'].to_pylist()
        return result


# All selections are annotation predicates. There are no hand-picked body IDs.
POPULATIONS = [
    Population('tactile', 'VNC tactile sensory', 'sensory', {'class': ('mechanosensory_tactile',)}, 'rootSide', 'DOCUMENTED',
               'Tactile sensory classification is explicit in the dataset; obstacle-distance encoding is not.'),
    Population('proprioceptive', 'Proprioceptive sensory', 'sensory', {'class': ('mechanosensory_proprioceptive',)}, 'rootSide', 'DOCUMENTED',
               'Dataset identifies proprioception, not external obstacle range.'),
    Population('head_mechanosensory', 'Central-brain mechanosensory', 'sensory', {'class': ('mechanosensory',), 'superclass': ('cb_sensory',)}, 'rootSide', 'DOCUMENTED',
               'Mechanosensory input classification; this includes several distinct sensory modalities.'),
    Population('front_leg_tactile', 'ProLN tactile afferents', 'sensory', {'class': ('mechanosensory_tactile',), 'entryNerve': ('ProLN',)}, 'rootSide', 'DOCUMENTED',
               'Tactile afferents entering the prothoracic leg nerve. This is an anatomical front-leg selection, not a frontal range sensor.', ('https://elifesciences.org/reviewed-preprints/97766', DATA_SOURCE)),
    Population('head_bristle', 'Interommatidial bristle BM_InOm', 'sensory', {'type': ('BM_InOm',)}, 'rootSide', 'DOCUMENTED',
               'Interommatidial bristle touch afferents; documented touch/grooming identity does not imply navigation or obstacle-distance coding. Release entryNerve=MxLbN differs from the cited EyeNv description; this discrepancy is unresolved.', ('https://doi.org/10.7554/eLife.87602.2', DATA_SOURCE)),
    Population('chordotonal', 'Chordotonal proprioceptors', 'sensory', {'class': ('mechanosensory_proprioceptive',), 'subclass': ('chordotonal organ',)}, 'rootSide', 'DOCUMENTED',
               'Chordotonal organ subclass is annotated; movement feedback differs from environmental range sensing.'),
    Population('visual', 'Visual sensory', 'sensory', {'class': ('visual',), 'superclass': ('ol_sensory', 'cb_sensory')}, 'rootSide', 'DOCUMENTED',
               'Visual sensory identity is annotated; BioBug has no biological visual input.'),
    Population('olfactory', 'Olfactory sensory', 'sensory', {'class': ('olfactory',), 'superclass': ('cb_sensory',)}, 'rootSide', 'DOCUMENTED',
               'Olfaction is annotated; it is not an obstacle-distance modality.'),
    Population('descending', 'All descending neurons', 'descending', {'superclass': ('descending_neuron',)}, 'somaSide', 'DOCUMENTED',
               'Descending anatomical identity alone does not establish a locomotor function.'),
    Population('DNa01', 'DNa01 steering candidate', 'descending', {'type': ('DNa01',), 'superclass': ('descending_neuron',)}, 'somaSide', 'DOCUMENTED',
               'Named-type steering evidence is documented in primary studies; MaleCNS body identities are matched by type annotation.', ('https://elifesciences.org/articles/102230', DATA_SOURCE)),
    Population('DNa02', 'DNa02 steering candidate', 'descending', {'type': ('DNa02',), 'superclass': ('descending_neuron',)}, 'somaSide', 'DOCUMENTED',
               'Named-type steering evidence is documented in primary studies; soma side is not a validated turn command.', ('https://elifesciences.org/articles/102230', 'https://doi.org/10.1016/j.cell.2024.08.033', DATA_SOURCE)),
    Population('DNg13', 'DNg13 locomotor candidate', 'descending', {'type': ('DNg13',), 'superclass': ('descending_neuron',)}, 'somaSide', 'DOCUMENTED',
               'DNg13 modulates outside-leg stride length during turning; it crosses to the contralateral VNC, so soma side must not be equated with output side.', ('https://doi.org/10.1016/j.cell.2024.08.033', DATA_SOURCE)),
    Population('DNp09', 'DNp09 walking candidate', 'descending', {'type': ('DNp09',), 'superclass': ('descending_neuron',)}, 'somaSide', 'DOCUMENTED',
               'P9/DNp09 supports forward walking and ipsilateral turning in pursuit-related experiments; this does not establish a generic speed command.', ('https://pmc.ncbi.nlm.nih.gov/articles/PMC9435592/', DATA_SOURCE)),
    Population('MDN', 'Moonwalker descending neurons', 'descending', {'type': ('MDN',), 'superclass': ('descending_neuron',)}, 'somaSide', 'DOCUMENTED',
               'Moonwalker descending neurons are associated with backward walking in primary experiments and cross relative to soma side; a reverse command would remain an engineering mapping.', ('https://doi.org/10.1126/science.1249964', DATA_SOURCE)),
    Population('leg_motor', 'Front/middle/hind leg motor neurons', 'motor', {'superclass': ('vnc_motor',), 'subclass': ('fl', 'ml', 'hl')}, 'somaSide', 'DOCUMENTED',
               'fl/ml/hl identify front/middle/hind leg motor subclasses. Cell soma side alone does not specify muscle action or a steering decoder.', ('https://pmc.ncbi.nlm.nih.gov/articles/PMC13384506/', DATA_SOURCE)),
    Population('vnc_motor', 'VNC motor neurons', 'motor', {'superclass': ('vnc_motor',)}, 'somaSide', 'DOCUMENTED',
               'Motor identity is annotated. This population includes multiple motor domains, not just legs.'),
]


def get_population(identifier: str) -> Population:
    for population in POPULATIONS:
        if population.id == identifier:
            return population
    raise ValueError(f'Unknown population: {identifier}')
