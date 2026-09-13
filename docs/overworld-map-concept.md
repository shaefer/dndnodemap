# Overworld Node Map — Concept Document

## What This Is

A web-based tool for generating and editing overworld maps for tabletop RPGs — specifically designed around how a dungeon master actually uses a map at the table, not how a cartographer draws one.

The core output is a **node graph**: named locations connected by directional routes. Every connection is labeled with a compass direction. Every location is a named node. There are no coordinates, no scale, no precise distances — just "from Ashford, you can go North to Greenvale, Southeast to Hollow Reach, or West into the Thornwood."

This is intentionally abstract. Real travel doesn't follow a grid. Mountains block some directions entirely. A swamp makes northeast impractical even if it's technically passable. A river crossing requires the party to make a decision. The node graph captures all of this without pretending to be a precise geographic simulation.

---

## The Inspiration: MUDs and Hex Maps

Two older systems shaped this design.

**Multi-user dungeons (MUDs)** used pure node graphs for world navigation. A room had exits — north, south, east, up, down — and the programmer decided which exits existed. No hex grid, no tile map. Just: "you can go these directions from here." This is extremely powerful for DMs because it models how parties actually decide to travel: by available options, not by coordinates.

**Hex grid overworld maps** are popular in D&D because hexes give six clean directions of travel without the diagonal weirdness of square grids. But hex grids are still grids — they impose regularity that the real world doesn't have. A mountain range doesn't align to hex columns. A river doesn't run along hex edges.

This tool takes the MUD's flexibility and adds compass direction labeling so the map feels geographically grounded even though it isn't geographically precise. "You're heading north" means something to players even when north doesn't correspond to exactly N on a coordinate plane.

---

## How Travel Works

Each node has a set of **exits** — connections to other nodes, each labeled with one of the eight compass directions (N, NE, E, SE, S, SW, W, NW). A node will typically have 2–6 exits. Not all eight directions need to be available from every node.

Connections come in two flavors:

**Standard routes** — the party can travel this way without special effort. Rendered as solid lines on the map. These may be well-maintained roads, dirt trails, or just "the direction you'd naturally travel to reach this area."

**Check-required routes** — something makes this connection difficult or gated. A mountain pass. A river ford in spring flood. A cliff descent. The map shows the route exists but flags it as a challenge. What the challenge is, and whether the party can handle it, is not the map's problem — the map just communicates "this way is harder." Rendered as dashed lines with a skill check notation (e.g., "Athletics DC 14").

This mirrors a design pattern from exploration board games: you can see that a direction is *possible*, but some directions cost something extra. The standard directions are free; the gated ones require a decision.

---

## The Map Is a DM Tool, Not Player Handout

The map stores DM notes on nodes and edges that don't render on the player-facing export. A node can have hidden information — what's actually there, what the party will find, what foreshadowing it offers. The map is a planning and navigation tool for the DM first.

The player-facing output (PNG, SVG, printed reference) shows node names, connections, compass directions, and check-required flags. The DM's notes stay private.

---

## Node Types

Five core categories. These are the building blocks the generator uses, and they have distinct visual representations on the map:

**Settlement** — anywhere people live and the party can interact with: cities, towns, isolated outposts, monasteries, waystations, ports. The party will pass through these, trade here, get quests, find beds. Large filled circles.

**Wilderness** — traversable open terrain that has character but isn't a destination in itself: forests, plains, swamps, canyons, coastline. These are the connective tissue of the map — you travel through them to get somewhere. Small filled circles.

**Mountain (fringe)** — the boundary of the traversable world. Mountain nodes mark the edges of the map, imply impassable ranges beyond, and are where the hardest check-required routes live. The party might reach the foothills, but the map isn't designed for alpine exploration. Filled squares.

**Ruin / Landmark** — places of significance that aren't settlements: dungeons, monster lairs, ancient monuments, cursed shrines, mysterious towers. These are adventure sites. Filled diamonds.

**Water** — small-scale visitable water features that the party travels *to* and makes decisions at: river crossings, named ponds, waterfalls, hot springs. Scale matters here: a small pond is a node; a vast inland sea is a terrain region, not a node. Circles with an inner ring.

---

## The Scale Rule (Important)

One design decision that appears repeatedly: **if a party travels to a place and makes decisions there, it's a node. If a feature defines the ambient character of a region, it's a terrain zone.**

A specific named ford across the Ashflow River → node (water, subtype: river_crossing).
The Ashflow River itself running across the southern third of the map → terrain annotation on the relevant edges.

A named pond where the party camps and finds a druid → node (water, subtype: pond).
The vast Lake Imren that defines the eastern region → terrain zone (lake), rendered as a blue wash behind the coastal nodes.

A particular mountain peak with a dragon's lair → node (ruin, subtype: lair).
The entire Greymount Range that walls off the north → mountain fringe nodes along the edge, implied impassable terrain beyond.

This rule keeps the core graph clean and the extension layer meaningful.

---

## The Extension Layer

The core map — nodes and edges — is always fully functional on its own. The extension layer adds optional richness without complicating the generator or the base data model.

**Terrain zones** — group nodes that share an ambient terrain type (forest, swamp, desert, lake, ocean). Rendered as soft colored washes behind the nodes they contain. Toggleable.

**Factions / Territories** — group nodes by political ownership (kingdoms, badlands, disputed zones). Rendered as styled borders around territory clusters. Solid lines for stable kingdoms, dashed for disputed, dot-dash for ancient/fallen. Toggleable.

**Travel time** — optional day-count on edges for campaigns that track travel carefully.

**Terrain crossing tags** — when an edge crosses from one terrain zone into another, an annotation records what that transition looks like ("enters the treeline," "marshland begins").

All extension data is stored on the map object and round-trips through JSON export. None of it is required. None of it is generated automatically. The DM adds it when they want it.

---

## Generation

The tool can generate a fresh map from a set of parameters and a numeric **seed**. Same seed + same parameters = identical map, every time. This means:

- You can save a seed you like and regenerate it reliably
- You can share a seed with someone else and they get the same starting point
- Algorithm version is tracked on every map so you know whether a saved seed will reproduce correctly after a code update

Generation parameters control:
- How many nodes (20–80, default ~49)
- The shape of the grid (columns × rows)
- How frequently each node type appears (settlement / wilderness / mountain / ruin ratios)
- How dense the connections are (sparse: 2–3 exits per node, dense: 5–6)
- How difficult the map is (fraction of routes marked check-required)
- How contained the map feels (how much of the perimeter is mountain fringe)

The generator places nodes with slight positional jitter so the output doesn't look like a perfect grid, then connects nearby nodes with compass-direction edges, enforces that the graph is fully connected (no isolated areas), and marks appropriate routes as check-required.

After generation, the DM names everything. The generator uses placeholders (Settlement-1, Wilderness-3) as prompts, not as final labels.

---

## What a Typical Session Looks Like

1. Open the app. A demo map is loaded.
2. Click Generate. Set node count to ~50, adjust sliders toward "dense connections" and "medium difficulty." Click the die to get a random seed. Generate.
3. Scan the map. Like the rough shape but want fewer ruins — adjust the slider, regenerate with the same seed. Or randomize the seed and generate again.
4. Find a map you like. Save it to the library under a name.
5. Start renaming nodes. Click "Wilderness-4" → type "The Thornwood." Click "Settlement-2" → type "Millhaven."
6. Add a note to Millhaven: "Walled town, corrupt mayor, party has a contact here."
7. Adjust a connection — click an edge, change it from trail to road (it's a trade route). Add a note: "Imperial road, well-patrolled."
8. Mark a mountain route as check-required: Athletics DC 16, note "Treacherous in winter."
9. Turn on the terrain layer. Create a zone called "The Ashwood" around the three forest nodes. Create a faction zone called "Kingdom of Veldtmark" around the southern settlements.
10. Export. PNG for the table. JSON to keep editing. Markdown table as a DM reference.

---

## What This Is Not

**Not a geographic map.** No coordinates. No scale. North on this map is a direction of travel, not a compass bearing. The map could be 50 miles across or 500 miles — the DM decides that when they narrate travel time.

**Not a drawing tool.** The DM doesn't draw roads or paint terrain. The graph structure is the map. Terrain zones and faction borders are computed from which nodes belong to them.

**Not complete after generation.** The generator creates a skeleton. The DM names it, annotates it, adjusts it. Generation is the starting point, not the end state.

**Not a dungeon mapper.** This is for overworld / regional maps. A dungeon has rooms and corridors — that's a different problem. The same node-graph concept could extend inward (a castle as a node-graph of rooms, a cave system), but that's a future consideration.

---

---

## The Generation-to-Edit Arc

The long-term design intention is a smooth handoff between algorithmic generation and manual editing — two modes that work together rather than competing.

**Phase one: generation.** The algorithm gets you to a workable skeleton in seconds. Adjust sliders, try seeds, regenerate. The goal is to find a rough map shape you want to build on — right number of nodes, right density of connections, right feel of containment. You're not trying to generate the final map; you're trying to avoid starting from a blank canvas.

**Phase two: refinement.** Once you have a skeleton you like, you stop regenerating and start editing. Rename nodes. Change a wilderness node to a ruin because you want a dungeon in that spot. Delete a connection that doesn't make narrative sense. Add a new node in the gap between two clusters. Flip a trail to a road along the trade route. The graph structure the generator produced is now yours to modify freely.

The current build prioritizes the generation side because that's the harder algorithmic problem. The editing capabilities exist but are intentionally basic in early milestones — enough to rename, retype, and toggle check-required. The vision is to make editing progressively more fluid:

- Click a node to rename it inline, without opening a panel
- Drag between two nodes to draw a new connection, with a direction picker appearing automatically
- Click a connection to cycle through connection types without leaving the canvas
- Select and delete a cluster of nodes in one action
- Merge two nearby nodes that the generator placed too close together

The underlying data model is already designed to support this — every edit is a pure transformation of the `WorldMap` object, and the undo stack preserves every prior state. The architecture doesn't need to change to enable richer editing; only the UI layer needs to become more interactive.

**The eventual workflow.** Generate a seed you like. Make broad adjustments via regeneration (too many ruins — dial it back, same seed). Switch to edit mode. Rename everything. Sculpt the specific connections that matter. Add extension data — terrain zones, faction borders, travel notes. Export. The transition from "running the algorithm" to "this is my map now" should feel natural rather than like switching tools.

---

## Files in This Project

- **`overworld-map-app-spec-v2.md`** — the full technical specification. Types, architecture, generator algorithm, UI views, milestones, test strategy. Read this before writing any code.
- **`node-reference.md`** — a hand-verified 49-node example map with all exits listed. Used as the demo map and as a test fixture.
- **`overworld-map.html`** — a single-file working prototype. Renders the example map with pan/zoom/hover and PNG/SVG export. The visual output of the app should match this prototype closely.

