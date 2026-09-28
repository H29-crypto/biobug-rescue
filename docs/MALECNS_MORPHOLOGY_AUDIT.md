# MaleCNS anatomical activity viewer: prerequisite audit

Date: 27 September 2026. Scope: local MaleCNS v1.0 files, the unchanged current controller, current Virtual Fly telemetry, and official resource documentation.

**Result: STOP before viewer implementation. The project does not currently possess the required neuron skeletons, neurite geometry, synapse positions or CNS reference geometry.** Official morphology resources exist remotely, but their existence does not establish that all 295 individual files have been obtained and validated. No substitute brain, anatomical layout, viewer, dynamics change, movement change or commit was created.

## Answers to the ten audit questions

| Question | Result |
|---|---|
| 1. Do we possess neuron morphology coordinates? | **NO neurite morphology.** Some neuron records have isolated soma/to-soma points; these do not describe branching paths. |
| 2. Which local morphology format? | **None.** Downloaded tables are Arrow Feather and JSON metadata. No SWC, anatomical mesh or skeleton stream was found in the dataset. |
| 3. Can the controller's IDs be mapped to morphology? | **NO verified local mapping yet.** The same-release `bodyId` provides the intended remote SWC filename key. All 295 candidate URLs are listed in the audit JSON, marked unverified. |
| 4. Can all 266 ProLN cells be rendered anatomically now? | **NO.** Zero local skeletons for this population. Missing soma points must not be replaced with invented positions. |
| 5. Can all 27 intermediates be rendered anatomically now? | **NO.** Zero local skeletons. Soma points, where available, are not an arbor. |
| 6. Can both DNa02 cells be rendered anatomically now? | **NO.** IDs and soma positions exist, but no local neurite paths. |
| 7. Do we have a CNS/neuropil reference mesh? | **NO.** ROI descriptions in metadata are not vertices/faces or a segmentation volume. A ready-to-use official surface mesh has not been verified. |
| 8. Do we have synapse coordinates? | **NO.** The local edge table has only `body_pre`, `body_post`, `weight`. |
| 9. Which coordinate system? | Metadata declares 8 nm isotropic voxels. Future assets must retain their documented frame/units; see the official resource table below. Do not assume native x/y/z correspond to camera front/side/top. |
| 10. What will browser rendering cost? | **Not measurable yet.** There are no skeleton point/segment counts, downloaded morphology bytes, geometry buffers or anatomical viewer frames. Explicit planning estimates follow below. |

Local availability summary: **morphology NO; skeletons NO; meshes NO; synapse coordinates NO; CNS reference geometry NO; verified 295-neuron morphology mapping NO.** Remote skeleton availability is documented, which makes acquisition a concrete next step rather than requiring invented anatomy.

## Actual local inventory and controller selection

| Official downloaded file | Exact bytes | Anatomy contained |
| --- | --- | --- |
| `body-annotations-male-cns-v1.0-minconf-0.5.feather` | 14,483,314 | Soma/to-soma points only |
| `body-neurotransmitters-male-cns-v1.0.feather` | 43,282,834 | No morphology coordinates |
| `body-stats-male-cns-v1.0-minconf-0.5.feather` | 778,062,826 | No morphology coordinates |
| `connectome-weights-male-cns-v1.0-minconf-0.5.feather` | 1,051,241,946 | No morphology coordinates |
| `Neuprint_Meta_debug.json` | 1,747,811 | Calibration and ROI descriptions only |

`download-receipts.json` and `inspection.json` are also present: they are provenance/inspection records, not geometry. The prior Digital Fly research cache contains sparse connectivity and a merged neuron table, not anatomical paths. Existing Three.js Rescue scene geometry is illustrative application geometry and is not a CNS asset.

Fresh checksums and the existing loader were used, then the existing `build_dynamics_graph(..., max_hops=2)` selection was evaluated without running dynamics. It confirms **295 neurons = 266 ProLN + 27 intermediates + two DNa02**, **280 selected structural edges**, **2,308 contacts**. Structural neuron-to-neuron edges are not skeleton segments: the two counts must never be substituted for each other in a rendering estimate.

| Population | Cells | Soma points | To-soma points | Local skeletons |
| --- | --- | --- | --- | --- |
| ProLN | 266 | 0 | 0 | 0 |
| intermediate | 27 | 27 | 0 | 0 |
| DNa02 | 2 | 2 | 0 | 0 |

| Target | MaleCNS body ID | Recorded somaLocation, native voxel coordinates |
| --- | --- | --- |
| DNa02-R | 10360 | [33699, 18906, 15758] |
| DNa02-L | 523769 | [61859, 18876, 14052] |

All 295 IDs, relevant annotations, available soma coordinates and candidate official SWC URLs are saved in `MALECNS_MORPHOLOGY_AUDIT.json`. The script can reproduce the audit:

```powershell
backend/.venv/Scripts/python scripts/audit_malecns_morphology.py
```

Local file schemas were inspected directly. Annotation coordinate fields are `somaLocation` and `tosomaLocation` (lists of integers); there are no per-neuron polylines, parent-node indices, radii arrays or faces. The transmitter file adds chemical predictions, not anatomy. The body-statistics file adds counts. Metadata contains voxel calibration and ROI descriptions, not a renderable CNS surface. Its `meshHost` value is an empty string and `overviewRois` is null; the local metadata does not supply a usable mesh endpoint.

The dataset directory was fully inventoried. A broader repository search found no anatomical asset candidates; access-denied temporary pytest directories were excluded from that broader scan and are not part of the dataset inventory. No reference image files accompanied this attachment—only the text brief—so no visual-reference comparison was performed.

## Official data needed next

The following are documented by the [official MaleCNS download page](https://male-cns.janelia.org/download/), under CC BY 4.0. Remote sizes are publisher approximations, not measured downloads in this audit.

| Resource | Location / format | Coordinates / size |
|---|---|---|
| Required: selected skeletons | `gs://flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/{bodyId}.swc` | Native MaleCNS EM frame, 8 nm units; selected-file sizes unknown |
| Alternative skeleton export | `gs://flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-precomputed/` | Neuroglancer precomputed; 1 nm units |
| Optional brain context | `gs://flyem-male-cns/rois/fullbrain-roi-v4` | ROI segmentation; 256 nm resolution; no local surface |
| Optional VNC context | `gs://flyem-male-cns/rois/malecns-vnc-neuropil-roi-v0` | ROI segmentation; 256 nm resolution; no local surface |
| Optional synapse points | `connectome-data/flat-connectome/syn-points-male-cns-v1.0-minconf-0.5.feather` under the v1.0 bucket | Positions, body IDs and ROIs; 8 nm voxels; ~12.7 GB |
| Optional synaptic partners | `connectome-data/flat-connectome/syn-partners-male-cns-v1.0-minconf-0.5.feather` under the v1.0 bucket | Paired coordinates/body IDs and neuropil; ~6.8 GB |

The documented alternative is neuPrint/navis skeleton retrieval against `male-cns:v1.0`, using a neuPrint token. No token was requested or used. Do not mix mirrored, native and template-space skeletons. Official JRC2018 unisex exports use micrometers; they are a different frame.

Concrete same-release candidate URLs for the two target cells:

- [DNa02-R / 10360.swc](https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/10360.swc)
- [DNa02-L / 523769.swc](https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/523769.swc)

These URLs follow documented naming. **Individual responses and contents have not been verified.** A 404, missing arbor, truncated file, or invalid parent graph must be reported per ID rather than replaced by synthetic geometry.

First acquire the selected SWCs and validate all 295 IDs, coordinates, parent references, units, finite values, radii semantics, bounds and coverage. Record URL/version/checksum/byte size and import statistics. Missing soma coordinates do not necessarily mean missing skeletons; only the actual SWC files can resolve coverage.

For context, verify an official surface endpoint or derive an explicitly labeled surface from the official brain/VNC ROI segmentation, preserving its scale and origin. The ROI `info` metadata endpoints could not be retrieved with the research browser in this audit; that is not proof that the service or meshes do not exist. No complete CNS envelope has been verified. A reference mesh is optional for an honest skeleton-only first view; skeletons are mandatory. Full synapse tables are unnecessary for the requested initial morphology/activity display.

## A second prerequisite: complete, synchronized telemetry

The current implementation was inspected in `backend/connectome/control.py`, `src/simulation/neuralClient.ts`, and `src/virtual-fly/simulation.ts`:

- Each accepted control request runs **20 abstract neural steps from rest**, with input during the first three steps. It is not continuous biological time integration.
- The backend calculates per-neuron `activity`, `peak` and `cumulative` arrays but returns only **two DNa02 peaks**, an **active-input count**, and **up to five cumulative intermediate-type totals**.
- The frontend stores those summaries with the accepted decision's simulated time. The simulation holds body movement while a neural response is pending.
- There is currently **no complete per-ID activity vector** in the live response, and no retained per-ID substep history. An intermediate-type total cannot be divided among neurons and presented as measured per-neuron computational telemetry. Input stimulus values are not equivalent to sensory neuron activity.

Thus geometry alone will not satisfy the live overlay. A future readout-only extension should expose the already computed per-ID values from the **same evaluation that produced the motor decision**, alongside run/generation ID, sample sequence, simulated body time, graph fingerprint and a declared activity statistic. Preserve the calculation, stimulus, ordering, peak decoder inputs and movement behavior exactly; verify response equivalence before/after instrumentation.

The least misleading first overlay is **per-decision simulated peak activity**, held between accepted decisions and labeled as such. Show the last sample time and stale/waiting/paused status. Do not interpolate decorative pulses between samples. If neural substep replay is later displayed, capture actual intermediate arrays and label its abstract substep axis; do not pretend those 20 steps span a measured physiological interval or move the body on another timeline.

Selected-neuron traces must use the same per-ID statistic and accepted simulation timestamps. Rule-Based mode supplies no neural values: display “no neural telemetry,” not residual MaleCNS activity. Reset must clear traces, and late responses from earlier generations must not update geometry colors or readouts. Current inputs are proximity rays and can increase before contact; the visualization must not relabel them as reconstructed biological touch receptors.

## Recommended implementation architecture, after acquisition

1. **Immutable morphology assets:** same-release SWCs parsed into compact binary position/parent/segment arrays; metadata maps GPU neuron indices to exact body IDs and controller populations. Keep structural contacts separate from morphology segments. Cache verified assets and expose completeness/provenance.
2. **An isolated Virtual Fly anatomical panel:** reuse installed Three.js 0.180.0, WebGL and batched line geometry. Avoid one React element or cylinder mesh per segment. React handles controls/inspection; static GPU buffers hold skeletons; a small activity buffer/texture drives per-neuron intensity. [Three.js BufferGeometry documentation](https://threejs.org/docs/pages/BufferGeometry.html)
3. **Camera and anatomical frame:** orbit, zoom, pan and reset using the existing compatible Three.js controls. Apply one documented global unit/frame transform, never independent neuron layout or arbitrary placement. Validate anatomical axes before naming presets FRONT/SIDE/TOP. [OrbitControls documentation](https://threejs.org/docs/pages/OrbitControls.html)
4. **Context and filters:** subdued real reference surface if verified; controller/all, ProLN, intermediates, DNa02 and active-only filters. Keep DNa02-L/R jump controls. Filters hide data; they must not recalculate the controller.
5. **Picking and inspection:** map the selected line segment or GPU pick ID back to the exact body ID. Show type, annotation, population, incoming/outgoing contact totals with their scope stated, current sampled activity and trace. No inference of activity from geometric proximity.
6. **One timeline:** render the most recent accepted neural sample already paired with the fly's motor decision. Display DNa02-L/R and the existing engineering decoder's actual TURN LEFT/RIGHT/FORWARD/STOP output. No second neural evaluation for the visualizer.
7. **Progressive loading:** level 1 = both DNa02 plus explicitly ranked intermediates; level 2 = 27 intermediates + two DNa02; level 3 = all 295. Disclose IDs/counts and displayed level. Use complete downloaded skeletons at each level initially; any later geometric simplification needs an explicit tolerance and provenance label.

Required visible labels:

> MALECNS ANATOMICAL VIEW  
> Structural morphology: REAL MaleCNS DATA  
> Neural activity: SIMULATED  
> Sensory mapping: ENGINEERING MODEL  
> Motor decoding: ENGINEERING MODEL

“Real brain activity” would be incorrect. Even real skeleton centerlines are a structural representation, not electrical recordings or synaptic activity maps. Coloring an entire cell by a single model activity does not resolve dendritic/axonal compartment dynamics.

## Rendering-cost estimate and measurement plan

**No measured anatomical FPS, frame time, CPU/GPU memory, geometry size or load time exists yet.** Cell count alone is insufficient: 295 fine skeletons may contain vastly more segments than 295 coarse skeletons.

An explicit planning layout with non-indexed line segments uses six float32 position components plus two uint32 neuron indices per segment: **32 bytes/segment**, excluding other attributes, software/driver overhead and context mesh. Each neuron’s single float32 activity occupies 4 bytes: all 295 use only **1,180 bytes** per sample. A 21-sample substep trace would contain **24,780 raw float32 bytes** before IDs/headers/transport overhead, if captured in future instrumentation.

| Hypothetical segment count, not measured | Geometry per CPU or GPU copy | CPU + GPU copies, before overhead |
|---|---:|---:|
| 100,000 | 3.2 MB | 6.4 MB |
| 1,000,000 | 32 MB | 64 MB |
| 5,000,000 | 160 MB | 320 MB |

Indexed geometry may reduce duplication; thick lines, tubes, picking buffers and transparency can increase cost. Actual download size depends on SWC text density and compression, not these decoded buffer estimates. No FPS promise follows from this table.

Once real assets are present, measure separately: transferred/compressed bytes; parser time; point/segment counts; decoded arrays; GPU upload time; first useful frame; CPU frame-time median/p95; observed render FPS during the same fly run; GPU timing if a supported timer query is available; and frame behavior under all filters/levels. Record browser, viewport/device-pixel ratio and GPU. Buffer allocations can be accounted for; exact total GPU VRAM and whole-process CPU memory are not reliably available from portable browser APIs and must be labeled estimates/unavailable when necessary. Renderer object counts are not memory bytes.

## Stop condition and unchanged application

The requested local anatomy is absent, so the conditional implementation gate is not met. **The next required data is the real SWC skeleton set for the exact 295 controller body IDs.** Reference context and synapse points are optional additions, not reasons to download the entire connectome geometry immediately.

This turn adds only the audit report, evidence JSON and a reproducible audit script. No morphology downloads, viewer implementation, fabricated coordinates, activity animation, package changes, neural calculations or movement changes were made. No commit was made. Frontend builds/tests are not viewer validation and were not rerun for this documentation/audit-only work.

Validation: source checksums were verified; controller size/contact assertions passed; all **151 pre-existing tracked files** remained byte-for-byte unchanged during the audit. The latest data verification/loading took 73.519 seconds; this is not morphology download or rendering time.
