# MaleCNS structural pathway investigation — Milestone 3B

Measured 2026-09-18 using the checksum-verified **official MaleCNS v1.0** files. This milestone identifies candidate interfaces from real annotations and structural connectivity. It implements no neural dynamics, sensor injection, motor decoding, or BioBug movement changes. The existing one-bug rule-based controller remains operational.

## Provenance and reproduction

[Official release/download](https://male-cns.janelia.org/download/), CC BY 4.0. Berg et al. (2026), *Sexual dimorphism in the complete Drosophila male central nervous system connectome*, Cell, [DOI:10.1016/j.cell.2026.08.015](https://doi.org/10.1016/j.cell.2026.08.015). See [MALECNS.md](MALECNS.md) and `backend/connectome/sources.json` for exact files, generations, checksums, columns, license and the neuron selection rule.

The loaded graph contains **166,606 selected neurons**, **25,574,615 directed neuron-pair edges** and **124,144,950 synaptic contacts**. It retains 206 isolates and excludes source records outside the documented superclass selection. Counts were measured, not copied from published totals. The validation report retains the previous v0.9-notebook count differences; it does not treat those as v1.0 expectations.

From `backend/` (activate the Python environment first, or replace `python` with `.\.venv\Scripts\python`):

```powershell
python -m connectome.pathways --report ../docs/MALECNS_PATHWAYS_ANALYSIS.json --export ../docs/MALECNS_PATHWAY_SUBGRAPH.json
python -m connectome.pathways --source front_leg_tactile --target DNa02 --report data/front-leg-DNa02.json
python -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000
```

The full [machine-readable analysis](MALECNS_PATHWAYS_ANALYSIS.json) contains every candidate neuron ID, exact annotation predicates, region counts, side counts, 48 relationships, strongest intermediate types and 192 left/right comparisons. Example bounded exports are [tactile → DNa02](MALECNS_PATHWAY_SUBGRAPH.json) and [ProLN tactile → DNa02](MALECNS_FRONT_LEG_SUBGRAPH.json).

## Evidence labels

- **DOCUMENTED:** the selection matches an explicit dataset annotation, or a named type has an explicitly described function in a primary publication. Published experiments generally concern other flies; type matching is not a physiological measurement of this specimen.
- **INFERRED:** interpreting an observed structural route as relevant to navigation or assigning an intermediate route role. The graph calculation itself is measured and reproducible; its functional interpretation is uncertain.
- **ENGINEERING MAPPING:** any artificial FRONT/LEFT/RIGHT input encoding, bilateral balancing, signal scaling, sign, speed or turning decoder. These interfaces are proposals only and are not implemented.

## Actual annotation inventory

`annotations.py` implements exact-field queries, explicit laterality, field availability/frequencies and annotation-defined populations. Missing fields raise a clear query error. Missing/unknown side values are never filled from a different anatomical field. No population uses a hand-picked neuron ID.

| Requested concept | Actual field/value or limitation |
| --- | --- |
| Sensory | `superclass`: cb_sensory 4,868; vnc_sensory 6,370; ol_sensory 6,098; sensory_ascending 537; sensory_descending 12. These broader categories are not interchangeable with modality classes. |
| Mechanosensory/touch/movement | `class`: mechanosensory 1,733; mechanosensory_tactile 2,558; mechanosensory_proprioceptive 1,453. `subclass` and nerves refine them. |
| Visual / olfactory | `class=visual` 6,091; `class=olfactory` 2,639. |
| Descending / ascending | `superclass=descending_neuron` 1,314; `ascending_neuron` 1,846. Sensory-ascending is a separate superclass. |
| Interneurons / intrinsic | `cb_intrinsic` 32,164; `vnc_intrinsic` 13,161; `ol_intrinsic` 89,403. These anatomical classes do not prove a navigation function. |
| VNC | Several explicit vnc_* superclasses; somaNeuromere for annotated cells. No single generic `isVNC` field. |
| Motor / legs | vnc_motor 708; cb_motor 107. Restricting vnc_motor to subclass fl/ml/hl selects 381 leg motor cells; subclass alone would include other categories. |
| Locomotion / walking / turning | No generic locomotion-function field. Use actual named types plus primary literature, not neuron ID numerology. |
| Laterality | rootSide and somaSide are distinct fields with missing/unknown entries. |
| Neuropils | somaNeuromere, entryNerve and exitNerve exist. This loaded table has no per-neuron neuropil innervation map, and edges lack ROI-specific weights. Global ROI names in metadata cannot assign a cell to a neuropil. |
| Neurotransmitters | predicted_nt, predicted_nt_confidence, celltype_predicted_nt, its confidence, consensus_nt and ground_truth exist. They do not provide receptor-specific connection sign. |
| Coordinates | somaLocation and tosomaLocation exist; these are not complete neurite morphology or neuropil membership. Availability is in MALECNS_INSPECTION.json. |

| Field | Non-null neurons | Distinct non-null values |
| --- | ---: | ---: |
| superclass | 166,606 | 21 |
| class | 26,512 | 21 |
| subclass | 21,929 | 49 |
| type | 164,503 | 11,751 |
| rootSide | 17,874 | 3 |
| somaSide | 148,692 | 3 |
| somaNeuromere | 21,796 | 21 |
| entryNerve | 11,774 | 21 |
| exitNerve | 1,005 | 28 |
| receptorType | 752 | 3 |
| serialMotif | 902 | 8 |
| predicted_nt | 166,440 | 8 |
| consensus_nt | 166,440 | 8 |

The inventory reports actual missingness; non-null is not necessarily experimentally validated. `subclass=leg bristle` includes gustatory cells in this release and must not be blindly treated as touch. The tactile selection uses the explicit mechanosensory class. `SNxxxx` and compound type names are preserved as supplied.

Consensus NT counts: acetylcholine: 103,691, glutamate: 29,298, gaba: 22,053, histamine: 7,891, unclear: 2,966, dopamine: 392, (missing): 166, octopamine: 101, serotonin: 48. The viewer shows consensus_nt and leaves absent values unannotated; no excitatory/inhibitory sign is invented.

## Candidate populations

All populations below have DOCUMENTED annotation identity. A publication-based type function is distinguished in the notes. Populations overlap (for example ProLN tactile is a subset of tactile), so counts must not be added together.

| Population ID | Exact predicate (AND between fields; OR within values) | Neurons | Actual side field/counts |
| --- | --- | ---: | --- |
| tactile | `class=mechanosensory_tactile` | 2,558 | rootSide: L: 1,264, R: 1,294 |
| proprioceptive | `class=mechanosensory_proprioceptive` | 1,453 | rootSide: R: 718, L: 734, unknown: 1 |
| head_mechanosensory | `class=mechanosensory; superclass=cb_sensory` | 1,733 | rootSide: L: 838, R: 895 |
| front_leg_tactile | `class=mechanosensory_tactile; entryNerve=ProLN` | 266 | rootSide: L: 151, R: 115 |
| head_bristle | `type=BM_InOm` | 745 | rootSide: L: 340, R: 405 |
| chordotonal | `class=mechanosensory_proprioceptive; subclass=chordotonal organ` | 425 | rootSide: R: 204, L: 221 |
| visual | `class=visual; superclass=ol_sensory,cb_sensory` | 6,091 | rootSide: L: 2,345, R: 3,746 |
| olfactory | `class=olfactory; superclass=cb_sensory` | 2,639 | rootSide: R: 1,344, L: 884, unknown: 411 |
| descending | `superclass=descending_neuron` | 1,314 | somaSide: R: 648, L: 656, M: 10 |
| DNa01 | `type=DNa01; superclass=descending_neuron` | 2 | somaSide: L: 1, R: 1 |
| DNa02 | `type=DNa02; superclass=descending_neuron` | 2 | somaSide: R: 1, L: 1 |
| DNg13 | `type=DNg13; superclass=descending_neuron` | 2 | somaSide: L: 1, R: 1 |
| DNp09 | `type=DNp09; superclass=descending_neuron` | 2 | somaSide: L: 1, R: 1 |
| MDN | `type=MDN; superclass=descending_neuron` | 4 | somaSide: R: 2, L: 2 |
| leg_motor | `superclass=vnc_motor; subclass=fl,ml,hl` | 381 | somaSide: L: 192, R: 189 |
| vnc_motor | `superclass=vnc_motor` | 708 | somaSide: L: 355, R: 353 |

### IDs, anatomy, relevance and limitations

Each large selection lists its first eight sorted IDs below for orientation; these are examples, not the selection rule. **Every ID** is saved in `populations[].neuron_ids` in the JSON analysis. Small named descending selections list all IDs. Region values are literal source annotations and may be missing.

**tactile — VNC tactile sensory (2,558). DOCUMENTED identity.**

IDs: 801756, 802409, 802759, 802939, 803150, 803525, 803555, 803626; complete list in JSON. Anatomy: entryNerve: MesoLN 806, MetaLN 805, ADMN 352, ProLN 266, PDMN 264, DMetaN 39, DProN 23, VProN 2, ProAN 1.

Tactile sensory classification is explicit in the dataset; obstacle-distance encoding is not. [source 1](https://male-cns.janelia.org/download/).

**proprioceptive — Proprioceptive sensory (1,453). DOCUMENTED identity.**

IDs: 24427, 28875, 29510, 31229, 32502, 34432, 34735, 36095; complete list in JSON. Anatomy: entryNerve: DMetaN 396, MetaLN 297, MesoLN 283, ADMN 237, AbN3 66, ProLN 64, PrN 36, ProCN 33, VProN 14, PDMN 12, ProAN 8, DProN 6.

Dataset identifies proprioception, not external obstacle range. [source 1](https://male-cns.janelia.org/download/).

**head_mechanosensory — Central-brain mechanosensory (1,733). DOCUMENTED identity.**

IDs: 10438, 13670, 14742, 14844, 15333, 16270, 17347, 17362; complete list in JSON. Anatomy: entryNerve: MxLbN 917, AN 744, aPhN 39, ON 33.

Mechanosensory input classification; this includes several distinct sensory modalities. [source 1](https://male-cns.janelia.org/download/).

**front_leg_tactile — ProLN tactile afferents (266). DOCUMENTED identity.**

IDs: 807971, 808535, 808998, 809535, 809633, 809864, 810040, 810775; complete list in JSON. Anatomy: entryNerve: ProLN 266.

Tactile afferents entering the prothoracic leg nerve. This is an anatomical front-leg selection, not a frontal range sensor. [source 1](https://elifesciences.org/reviewed-preprints/97766); [source 2](https://male-cns.janelia.org/download/).

**head_bristle — Interommatidial bristle BM_InOm (745). DOCUMENTED identity.**

IDs: 157870, 170326, 184643, 189426, 189997, 190983, 191539, 192612; complete list in JSON. Anatomy: entryNerve: MxLbN 745.

Interommatidial bristle touch afferents; documented touch/grooming identity does not imply navigation or obstacle-distance coding. [source 1](https://doi.org/10.7554/eLife.87602.2); [source 2](https://male-cns.janelia.org/download/).

**chordotonal — Chordotonal proprioceptors (425). DOCUMENTED identity.**

IDs: 86060, 104602, 105298, 107573, 111523, 112864, 113192, 113457; complete list in JSON. Anatomy: entryNerve: MetaLN 193, MesoLN 163, ProLN 36, ProCN 33.

Chordotonal organ subclass is annotated; movement feedback differs from environmental range sensing. [source 1](https://male-cns.janelia.org/download/).

**visual — Visual sensory (6,091). DOCUMENTED identity.**

IDs: 11139, 15479, 15625, 15983, 16357, 16394, 16398, 16681; complete list in JSON. Anatomy: not specified by somaNeuromere/entryNerve/exitNerve for this selection; superclass/type identity remains available.

Visual sensory identity is annotated; BioBug has no biological visual input. [source 1](https://male-cns.janelia.org/download/).

**olfactory — Olfactory sensory (2,639). DOCUMENTED identity.**

IDs: 11151, 18147, 26225, 26286, 27153, 29521, 31800, 32864; complete list in JSON. Anatomy: entryNerve: AN 2,455, MxLbN 184.

Olfaction is annotated; it is not an obstacle-distance modality. [source 1](https://male-cns.janelia.org/download/).

**descending — All descending neurons (1,314). DOCUMENTED identity.**

IDs: 10001, 10010, 10026, 10030, 10033, 10038, 10045, 10048; complete list in JSON. Anatomy: somaNeuromere: LB 418, MX 201, CG 66, MD 43, GNG 17, DC 8, TC 2.

Descending anatomical identity alone does not establish a locomotor function. [source 1](https://male-cns.janelia.org/download/).

**DNa01 — DNa01 steering candidate (2). DOCUMENTED identity.**

IDs: 10442, 10760. Anatomy: not specified by somaNeuromere/entryNerve/exitNerve for this selection; superclass/type identity remains available.

Named-type steering evidence is documented in primary studies; MaleCNS body identities are matched by type annotation. [source 1](https://elifesciences.org/articles/102230); [source 2](https://male-cns.janelia.org/download/).

**DNa02 — DNa02 steering candidate (2). DOCUMENTED identity.**

IDs: 10360, 523769. Anatomy: not specified by somaNeuromere/entryNerve/exitNerve for this selection; superclass/type identity remains available.

Named-type steering evidence is documented in primary studies; soma side is not a validated turn command. [source 1](https://elifesciences.org/articles/102230); [source 2](https://doi.org/10.1016/j.cell.2024.08.033); [source 3](https://male-cns.janelia.org/download/).

**DNg13 — DNg13 locomotor candidate (2). DOCUMENTED identity.**

IDs: 11074, 512006. Anatomy: not specified by somaNeuromere/entryNerve/exitNerve for this selection; superclass/type identity remains available.

DNg13 modulates outside-leg stride length during turning; it crosses to the contralateral VNC, so soma side must not be equated with output side. [source 1](https://doi.org/10.1016/j.cell.2024.08.033); [source 2](https://male-cns.janelia.org/download/).

**DNp09 — DNp09 walking candidate (2). DOCUMENTED identity.**

IDs: 10783, 11177. Anatomy: somaNeuromere: CG 2.

P9/DNp09 supports forward walking and ipsilateral turning in pursuit-related experiments; this does not establish a generic speed command. [source 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC9435592/); [source 2](https://male-cns.janelia.org/download/).

**MDN — Moonwalker descending neurons (4). DOCUMENTED identity.**

IDs: 10763, 11288, 11332, 12348. Anatomy: not specified by somaNeuromere/entryNerve/exitNerve for this selection; superclass/type identity remains available.

Moonwalker descending neurons are associated with backward walking in primary experiments and cross relative to soma side; a reverse command would remain an engineering mapping. [source 1](https://doi.org/10.1126/science.1249964); [source 2](https://male-cns.janelia.org/download/).

**leg_motor — Front/middle/hind leg motor neurons (381). DOCUMENTED identity.**

IDs: 800061, 800158, 800175, 800230, 800290, 800316, 800358, 800504; complete list in JSON. Anatomy: somaNeuromere: T1 135, T3 130, T2 116; exitNerve: MetaLN 122, MesoLN 116, ProLN 81, ProAN 24, VProN 22, DProN 8, AbN1 8.

fl/ml/hl identify front/middle/hind leg motor subclasses. Cell soma side alone does not specify muscle action or a steering decoder. [source 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC13384506/); [source 2](https://male-cns.janelia.org/download/).

**vnc_motor — VNC motor neurons (708). DOCUMENTED identity.**

IDs: 164190, 800056, 800061, 800146, 800158, 800175, 800184, 800190; complete list in JSON. Anatomy: somaNeuromere: T2 175, T1 173, T3 152, A1 56, A2 28, A4 22, A3 22, A9 21, A8 18, A5 16, A10 10, A6 8, A7 6; exitNerve: MetaLN 122, MesoLN 116, ProLN 81, AbN4 72, AbNT 64, AbN2 44, AbN1 30, ADMN 28, DProN 28, AbN3 28, ProAN 24, VProN 22, MesoAN 19, PDMNa 16, PDMNp 6, CvN 4, DMetaN 4.

Motor identity is annotated. This population includes multiple motor domains, not just legs. [source 1](https://male-cns.janelia.org/download/).

DNa01 IDs: 10442 L, 10760 R. DNa02: 523769 L, 10360 R. DNg13: 11074 L, 512006 R. DNp09: 10783 L, 11177 R. MDN: 11288/12348 L and 10763/11332 R. These sides are **somaSide**. Leg motor subgroups are 135 fl/T1, 116 ml/T2 and 130 hl/T3.

## Connectivity method and metric

Rows are presynaptic and columns postsynaptic. Sparse matrix-vector operations calculate exact-hop reachability using positive contact counts only as an edge-existence test. Forward and reverse Boolean frontiers identify edges participating in each bounded source-to-target route. The implementation never builds millions of Python edge dictionaries or enumerates all paths.

For each exact length h=1,2,3, the reported **contact sum** adds each distinct participating directed edge weight once, even if it participates in many walks or positions. It is not a sum of products, a number of walks, a probability, effective synaptic strength or a measured physiological gain. Different hop-length totals can reuse the same edge, so do not sum the columns together. Intermediate type support sums incident participating-edge contacts; an edge can contribute to two intermediate types. Counts can favor large populations and broadly connected hubs.

The calculation permits directed **walks** (vertices may repeat) and does not constrain intermediate cells to a particular superclass. Thus motor, descending or sensory cells can occur at intermediate positions. No unproven anatomical feedforward model is imposed. Shortest target distances are tracked separately. The tests compare this bounded aggregation to an independent exhaustive oracle on tiny cyclic graphs; exhaustive enumeration is never used on MaleCNS.

### All 48 candidate relationships

Each hop cell is **reachable target neurons / distinct participating edges / summed contacts**. Reachability is exact-hop; the JSON additionally provides cumulative and newly reached targets, total reachable cells and intermediate counts. The `min` column is the shortest observed source-to-target distance.

| Source | Target (population size) | min | 1 hop: targets / edges / contacts | 2 hops: targets / edges / contacts | 3 hops: targets / edges / contacts |
| --- | --- | ---: | ---: | ---: | ---: |
| tactile | DNa01 (2) | 2 | 0 / 0 / 0 | 2 / 3,030 / 14,744 | 2 / 346,064 / 1,968,793 |
| tactile | DNa02 (2) | 2 | 0 / 0 / 0 | 2 / 3,667 / 20,715 | 2 / 333,126 / 1,865,055 |
| tactile | DNg13 (2) | 2 | 0 / 0 / 0 | 2 / 2,809 / 11,573 | 2 / 322,932 / 1,753,396 |
| tactile | DNp09 (2) | 2 | 0 / 0 / 0 | 2 / 2,646 / 13,736 | 2 / 306,971 / 1,639,998 |
| tactile | MDN (4) | 2 | 0 / 0 / 0 | 4 / 7,421 / 36,720 | 4 / 366,925 / 1,949,257 |
| tactile | leg_motor (381) | 1 | 91 / 1,643 / 6,571 | 381 / 177,505 / 1,103,573 | 381 / 1,330,806 / 8,657,168 |
| front_leg_tactile | DNa01 (2) | 2 | 0 / 0 / 0 | 2 / 304 / 969 | 2 / 37,166 / 219,832 |
| front_leg_tactile | DNa02 (2) | 2 | 0 / 0 / 0 | 2 / 280 / 2,308 | 2 / 36,253 / 219,606 |
| front_leg_tactile | DNg13 (2) | 2 | 0 / 0 / 0 | 2 / 717 / 2,074 | 2 / 39,017 / 211,914 |
| front_leg_tactile | DNp09 (2) | 2 | 0 / 0 / 0 | 2 / 121 / 249 | 2 / 27,806 / 128,053 |
| front_leg_tactile | MDN (4) | 2 | 0 / 0 / 0 | 4 / 458 / 1,390 | 4 / 40,900 / 220,992 |
| front_leg_tactile | leg_motor (381) | 1 | 16 / 244 / 822 | 352 / 21,899 / 138,968 | 381 / 349,650 / 2,513,583 |
| proprioceptive | DNa01 (2) | 2 | 0 / 0 / 0 | 2 / 3,026 / 20,157 | 2 / 277,895 / 1,986,152 |
| proprioceptive | DNa02 (2) | 1 | 2 / 20 / 48 | 2 / 6,205 / 42,609 | 2 / 321,047 / 2,185,116 |
| proprioceptive | DNg13 (2) | 2 | 0 / 0 / 0 | 2 / 2,345 / 13,031 | 2 / 241,131 / 1,593,701 |
| proprioceptive | DNp09 (2) | 2 | 0 / 0 / 0 | 2 / 2,820 / 13,450 | 2 / 245,332 / 1,561,826 |
| proprioceptive | MDN (4) | 2 | 0 / 0 / 0 | 4 / 2,451 / 13,803 | 4 / 264,303 / 1,700,817 |
| proprioceptive | leg_motor (381) | 1 | 291 / 2,664 / 18,344 | 381 / 137,272 / 1,306,957 | 381 / 1,736,152 / 11,691,828 |
| chordotonal | DNa01 (2) | 2 | 0 / 0 / 0 | 2 / 874 / 6,022 | 2 / 90,206 / 721,016 |
| chordotonal | DNa02 (2) | 2 | 0 / 0 / 0 | 2 / 636 / 4,126 | 2 / 84,925 / 656,738 |
| chordotonal | DNg13 (2) | 2 | 0 / 0 / 0 | 2 / 602 / 3,021 | 2 / 77,400 / 543,262 |
| chordotonal | DNp09 (2) | 2 | 0 / 0 / 0 | 2 / 508 / 1,808 | 2 / 82,308 / 546,455 |
| chordotonal | MDN (4) | 2 | 0 / 0 / 0 | 4 / 463 / 1,848 | 4 / 85,261 / 563,677 |
| chordotonal | leg_motor (381) | 1 | 196 / 946 / 4,788 | 381 / 56,198 / 616,316 | 381 / 867,691 / 6,368,405 |
| head_mechanosensory | DNa01 (2) | 2 | 0 / 0 / 0 | 2 / 4,335 / 25,055 | 2 / 199,676 / 1,356,403 |
| head_mechanosensory | DNa02 (2) | 2 | 0 / 0 / 0 | 2 / 4,337 / 27,977 | 2 / 211,707 / 1,359,873 |
| head_mechanosensory | DNg13 (2) | 2 | 0 / 0 / 0 | 2 / 3,335 / 16,848 | 2 / 183,117 / 1,161,171 |
| head_mechanosensory | DNp09 (2) | 2 | 0 / 0 / 0 | 2 / 1,971 / 7,295 | 2 / 189,791 / 1,125,661 |
| head_mechanosensory | MDN (4) | 2 | 0 / 0 / 0 | 4 / 6,176 / 29,434 | 4 / 191,536 / 1,148,857 |
| head_mechanosensory | leg_motor (381) | 2 | 0 / 0 / 0 | 363 / 17,128 / 117,989 | 381 / 429,782 / 3,391,206 |
| head_bristle | DNa01 (2) | 2 | 0 / 0 / 0 | 2 / 1,256 / 3,979 | 2 / 54,736 / 324,496 |
| head_bristle | DNa02 (2) | 2 | 0 / 0 / 0 | 2 / 1,032 / 3,937 | 2 / 50,322 / 292,512 |
| head_bristle | DNg13 (2) | 2 | 0 / 0 / 0 | 2 / 882 / 2,157 | 2 / 48,359 / 253,025 |
| head_bristle | DNp09 (2) | 2 | 0 / 0 / 0 | 2 / 281 / 502 | 2 / 40,719 / 183,529 |
| head_bristle | MDN (4) | 2 | 0 / 0 / 0 | 4 / 2,661 / 7,617 | 4 / 57,734 / 300,520 |
| head_bristle | leg_motor (381) | 2 | 0 / 0 / 0 | 302 / 7,162 / 29,625 | 381 / 206,993 / 1,804,385 |
| visual | DNa01 (2) | 2 | 0 / 0 / 0 | 1 / 4 / 11 | 2 / 16,236 / 75,164 |
| visual | DNa02 (2) | 2 | 0 / 0 / 0 | 2 / 98 / 362 | 2 / 30,172 / 151,538 |
| visual | DNg13 (2) | 2 | 0 / 0 / 0 | 1 / 2 / 2 | 2 / 9,167 / 32,753 |
| visual | DNp09 (2) | 2 | 0 / 0 / 0 | 2 / 27 / 36 | 2 / 34,377 / 149,811 |
| visual | MDN (4) | 2 | 0 / 0 / 0 | 1 / 2 / 3 | 4 / 11,670 / 49,413 |
| visual | leg_motor (381) | 3 | 0 / 0 / 0 | 0 / 0 / 0 | 373 / 9,896 / 67,042 |
| olfactory | DNa01 (2) | 2 | 0 / 0 / 0 | 1 / 14 / 17 | 2 / 52,511 / 398,270 |
| olfactory | DNa02 (2) | 2 | 0 / 0 / 0 | 2 / 285 / 496 | 2 / 121,314 / 930,777 |
| olfactory | DNg13 (2) | 2 | 0 / 0 / 0 | 1 / 2 / 9 | 2 / 49,512 / 460,773 |
| olfactory | DNp09 (2) | 2 | 0 / 0 / 0 | 1 / 9 / 15 | 2 / 62,113 / 559,584 |
| olfactory | MDN (4) | 2 | 0 / 0 / 0 | 4 / 752 / 1,430 | 4 / 173,555 / 1,232,540 |
| olfactory | leg_motor (381) | 2 | 0 / 0 / 0 | 69 / 244 / 799 | 381 / 168,821 / 1,295,978 |

### Strongest intermediate types on two-hop routes

The following table lists the top three types for every analyzed pair, ranked by incident contact sum with neuron count in parentheses. It is a structural ranking, with **INFERRED** functional relevance; a name or large contact total is not proof of behavior. The JSON includes the top ten at every hop length.

| Source → target | Intermediate type: incident contacts (neurons) |
| --- | --- |
| tactile → DNa01 | IN07B012: 3,195 (3); IN13A004: 1,766 (1); ANXXX024: 1,504 (1) |
| tactile → DNa02 | IN06B012: 2,456 (2); ANXXX027: 2,448 (1); AN06B089: 2,172 (2) |
| tactile → DNg13 | IN13A004: 3,599 (2); IN07B012: 2,442 (2); ANXXX026: 591 (2) |
| tactile → DNp09 | ANXXX027: 2,771 (1); IN06B003: 2,420 (1); IN06B016: 2,310 (1) |
| tactile → MDN | AN09B009: 4,536 (1); AN09B023: 3,639 (2); AN17A015: 3,528 (4) |
| tactile → leg_motor | ANXXX027: 16,319 (3); AN08B012: 15,940 (2); IN20A.22A007: 15,572 (12) |
| front_leg_tactile → DNa01 | ANXXX006: 225 (1); AN03A008: 204 (2); IN10B002: 98 (1) |
| front_leg_tactile → DNa02 | AN03A008: 1,636 (2); IN23B001: 170 (1); AN06B015: 95 (1) |
| front_leg_tactile → DNg13 | IN13B004: 589 (2); ANXXX026: 583 (2); AN03A008: 181 (2) |
| front_leg_tactile → DNp09 | AN03A008: 104 (1); IN09A001: 61 (2); DNg34: 33 (2) |
| front_leg_tactile → MDN | AN03A008: 289 (2); IN23B001: 186 (1); AN17A015: 183 (2) |
| front_leg_tactile → leg_motor | ANXXX006: 4,234 (2); IN01B003: 2,471 (2); IN08A036: 2,358 (14) |
| proprioceptive → DNa01 | IN03A006: 1,702 (3); INXXX464: 1,372 (5); AN02A002: 1,130 (2) |
| proprioceptive → DNa02 | MNhm42: 2,671 (2); AN04B003: 1,593 (6); PS059: 1,593 (4) |
| proprioceptive → DNg13 | AN02A002: 1,030 (2); IN19A008: 863 (6); IN21A007: 779 (3) |
| proprioceptive → DNp09 | AN02A002: 853 (2); IN06B003: 816 (1); ANXXX027: 732 (1) |
| proprioceptive → MDN | AN02A002: 1,037 (2); IN06B012: 688 (2); AN06B012: 623 (2) |
| proprioceptive → leg_motor | IN19A016: 15,110 (12); IN20A.22A001: 14,233 (12); IN19A003: 10,020 (6) |
| chordotonal → DNa01 | IN03A006: 1,119 (3); INXXX464: 605 (4); IN21A011: 458 (3) |
| chordotonal → DNa02 | AN04B003: 1,004 (5); IN19B035: 542 (2); IN09A004: 320 (3) |
| chordotonal → DNg13 | IN19A008: 623 (5); IN19A015: 507 (5); IN21A022: 166 (2) |
| chordotonal → DNp09 | AN10B019: 232 (1); IN13B013: 179 (1); AN06B009: 136 (2) |
| chordotonal → MDN | ANXXX049: 205 (4); IN19A001: 187 (2); AN04B003: 170 (2) |
| chordotonal → leg_motor | IN20A.22A001: 11,023 (9); IN21A017: 8,168 (8); IN13A002: 7,553 (5) |
| head_mechanosensory → DNa01 | DNg35: 2,612 (1); DNge054: 2,346 (2); pIP1: 2,173 (2) |
| head_mechanosensory → DNa02 | DNg35: 6,079 (2); pIP1: 2,062 (2); WED203: 1,937 (2) |
| head_mechanosensory → DNg13 | DNge054: 2,322 (2); DNg37: 1,845 (1); pIP1: 1,372 (1) |
| head_mechanosensory → DNp09 | pIP1: 1,372 (1); SAD072: 531 (2); DNge138: 447 (2) |
| head_mechanosensory → MDN | DNge132: 6,428 (2); DNg35: 2,612 (1); pIP1: 2,072 (2) |
| head_mechanosensory → leg_motor | DNg15: 8,971 (2); DNg35: 7,025 (2); DNge079: 6,721 (2) |
| head_bristle → DNa01 | DNge054: 871 (2); DNg35: 608 (1); CB0297: 272 (1) |
| head_bristle → DNa02 | DNg35: 1,622 (2); DNge054: 615 (1); GNG515: 440 (2) |
| head_bristle → DNg13 | DNge054: 847 (2); DNg83: 226 (1); GNG502: 181 (1) |
| head_bristle → DNp09 | GNG502: 171 (1); DNg104: 50 (1); GNG284: 41 (1) |
| head_bristle → MDN | DNge132: 2,142 (2); AN09B009: 897 (1); DNg87: 667 (1) |
| head_bristle → leg_motor | DNge079: 3,368 (1); DNg35: 2,568 (2); DNg15: 2,007 (2) |
| visual → DNa01 | MeVP56: 9 (1); MeVCMe1: 2 (1) |
| visual → DNa02 | MeVPLp1: 334 (1); OA-AL2i3: 25 (1); MeVPMe2: 3 (1) |
| visual → DNg13 | 5-HTPMPV03: 2 (1) |
| visual → DNp09 | OA-AL2i3: 23 (1); MeVP51: 6 (1); MeVPMe2: 4 (1) |
| visual → MDN | MeVP49: 3 (1) |
| visual → leg_motor | No two-hop route |
| olfactory → DNa01 | PPM1201: 10 (1); DNp32: 7 (1) |
| olfactory → DNa02 | lLN1_bc: 267 (1); M_spPN5t10: 215 (1); LAL119: 8 (1) |
| olfactory → DNg13 | PPM1201: 9 (1) |
| olfactory → DNp09 | PS096: 8 (1); DNp32: 7 (1) |
| olfactory → MDN | ALIN4: 704 (1); lLN1_a: 413 (1); lLN1_bc: 268 (1) |
| olfactory → leg_motor | DNb05: 546 (2); DNc02: 151 (2); DNp32: 102 (2) |

### Strong candidate routes and recommended starting point

**Recommendation (INFERRED suitability): ProLN tactile → real intermediates → DNa02.** The 266 ProLN tactile afferents provide a relatively narrow, explicitly front-leg/touch selection with complete rootSide labels. Both DNa02 cells have published steering evidence. Both are reachable in two hops: **280 participating edges, 2,308 contacts**, with AN03A008 the strongest intermediate type by incident support (**1,636 contacts, two cells**). Three-hop routes include **36,253 edges and 219,606 contacts**. There are **no direct** ProLN-tactile-to-DNa02 edges.

This is recommended for a tractable future experiment, not because it has the largest raw contact total. Broad proprioceptive → leg-motor connectivity is numerically stronger: **291/381 targets directly, 2,664 edges, 18,344 contacts**; two hops reach all 381 using 137,272 edges/1,306,957 contacts. Proprioception senses body motion, so it is better considered for later motion feedback than as an unqualified external range input.

For steering-associated targets, broad proprioceptive → DNa02 has **20 direct edges/48 contacts**, and 6,205 edges/42,609 contacts on two-hop walks. Central-brain mechanosensory → DNa02 has 4,337 two-hop edges/27,977 contacts, led by DNg35 support (6,079). Broad tactile → DNa02 has 3,667 two-hop edges/20,715 contacts; IN06B012 (2,456), ANXXX027 (2,448), and AN06B089 (2,172) lead intermediate support. Broad classes mix multiple body parts/modalities. They are useful comparisons but less specific engineering interfaces.

The loaded BM_InOm records carry entryNerve=MxLbN, whereas the cited head-touch anatomical study uses EyeNv (eye nerve) for this afferent route. We preserve the release label and have not resolved this nomenclature/annotation discrepancy; MxLbN is not silently reinterpreted as EyeNv.

The narrower head bristle BM_InOm selection also reaches all four MDNs in two hops (2,661 edges/7,617 contacts), but its documented sensory context is head touch/grooming, not distance-based obstacle avoidance. DNa01, DNg13, DNp09 and MDN remain comparison candidates with distinct experimental functions, not interchangeable turn/speed actuators.

A contact-ranked **three-hop example** from the bounded ProLN export is:

`820562 (SNxxxx, rootSide L) --26--> 21763 (AN13B002, somaSide R) --67--> 13538 (AN03A008, somaSide L) --741--> 523769 (DNa02, somaSide L)`

Its bottleneck is 26 contacts. The source has an unresolved type label but is selected by its explicit tactile class and ProLN entry nerve. A more specifically typed example is `818488 (SNta41) --17--> 558778 (AN08B012) --40--> 12594 (WED069) --28--> 523769 (DNa02)`. These ID sequences are query results, not hard-coded selections. Their functional relevance is INFERRED. The shortest population distance can be two hops while stronger sampled routes from other individual sources have three hops.

## Laterality and possible engineering interfaces

Sensory population splits use **rootSide**; named descending and motor splits use **somaSide**. Missing, `unknown`, or midline values do not enter L/R comparisons. Root and soma positions are different anatomical measurements; neither automatically means left/right muscle output. DNg13 and MDN cross relative to soma side, as described in [MANC circuit analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC13384506/). DNa02 descending projections are ipsilateral in that account.

For ProLN tactile → DNa02, **all four root-side/soma-side combinations (L→L, L→R, R→L, R→R) reach one target in two hops**; none is directly connected. Broad tactile and central-brain mechanosensory have the same bilateral two-hop result. This does not support an exclusive one-sided obstacle-to-turn circuit.

Proprioceptive → DNa02 direct contacts show same-label structure: root L → soma L has **12 edges/33 contacts**; root R → soma R **8 edges/15 contacts**; both crossed combinations have zero direct edges. At two hops, all four combinations reach their target. This anatomical asymmetry is not a validated decoder or turn sign.

A future FRONT signal could be delivered bilaterally to a defined tactile selection; LEFT/RIGHT signals could target its rootSide subsets. Every such choice is **ENGINEERING MAPPING**, including any per-cell normalization for unequal 151-L/115-R population sizes, signal polarity or obstacle proximity scaling. No FRONT biological receptor identity is claimed. A future decoder comparing DNa02 outputs would also be ENGINEERING MAPPING and require separate testing; this milestone implements none of it.

## Bounded export and frontend

`GET /connectome/populations` returns loaded population counts, predicates, evidence and sources. `GET /connectome/pathway-subgraph?source=front_leg_tactile&target=DNa02&max_nodes=24&max_edges=40` returns a small real graph, available annotations, role/layer labels, original contact counts and sampling caveats. The saved response has **24 nodes/22 edges**. Default tactile/DNa02 export has **32 nodes/30 edges**. Node IDs are JSON strings for frontend safety.

Each source contributes at most one widest shortest route (maximize the minimum edge contact count among shortest paths for that source), ranked deterministically across sources by bottleneck, hops and ID. Its union is capped at 80 nodes/160 edges; viewer defaults are 32/64. It is a selected route union, **not an induced subgraph or complete circuit**. Different route lengths share nodes, so layout columns indicate earliest sampled position and are not exact shortest distances for all displayed edges. Display roles are query-relative assignments.

The optional development panel sits below the unchanged simulation. It renders actual nodes/edges, allows neuron selection, displays literal anatomical side fields and available NT predictions, and marks proposed input/output boxes ENGINEERING MAPPING. Backend errors appear only in this panel. No activity visualization or movement integration is present.

## Runtime and validation

This full 48-pair run took **106.50 seconds to load/checksum-verify** and **300.76 seconds to analyze/export**. Retained graph/annotation arrays: **349.06 MiB**; loader RSS **540.43 MiB**, sampled loader peak **929.48 MiB**. Analysis adds a **97.56 MiB** numeric row-index array; process RSS after analysis was **644.91 MiB**. This is not a sampled analysis peak. Timings depend on disk/cache and concurrent activity.

- Backend: 50 tests passed; one optional full-data pytest case skipped. The completed 48-pair CLI and live API exercised the actual full dataset separately. Two dependency deprecation warnings remain.
- Frontend: all nine existing simulation checks passed; `npm run build` passed.
- Browser: actual population selection loaded; the 32-node/30-edge real graph rendered; selecting DNa02 displayed its body ID, somaSide, available NT and measured incoming contacts. Local API returned the saved 24-node/22-edge ProLN graph.

## Scientific and technical limits

- Structural connectivity is not an executable biological brain. No activation, rates, spikes, training, weight changes, controller replacement, multiple agents, swarm, OpenAI or survivor detection were added.
- Annotations and transmitter predictions are incomplete, with unequal bilateral counts and unresolved/compound type labels. Type-level literature does not establish identical function for this individual or simulation.
- Contact counts do not encode receptor-specific sign, synaptic efficacy, delay, cell state, physiology or behavioral causation. Strong aggregate support can reflect large populations or hubs.
- RootSide and somaSide cannot establish motor output sign. Three-hop reachability is widespread; reachability alone is a weak specificity criterion.
- The provided loaded artifacts do not supply a per-neuron neuropil/ROI innervation matrix. Coordinates are partial soma/reference locations; no neuropil membership is manufactured.
- Exact-hop walks may revisit neurons. No four-hop analysis or exhaustive path enumeration was attempted. Exports are bounded samples and can omit weak, short or less-supported routes.
- This is a local development query service. It loads the real dataset at startup, retains numeric arrays, serializes expensive graph exports and caches up to 16 bounded responses. No production deployment or multi-user scalability claim is made.

Future work, if authorized, should be called a **MaleCNS-connectome-based computational controller**, or a **controller using the real MaleCNS structural connectome with simulated neural dynamics**. This milestone stops at reproducible structural inspection.
