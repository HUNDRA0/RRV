import type { ClientGameState, Resources, Resource } from './types';

const RESOURCES: Resource[] = ['wood', 'brick', 'grain', 'ore', 'wool'];

export function canAfford(resources: Resources, cost: Resources): boolean {
  return RESOURCES.every(r => resources[r] >= cost[r]);
}

export function getValidSettlementPlacements(state: ClientGameState, myId: string): string[] {
  const { vertices, edges } = state.board;

  // Build set of occupied vertex IDs and neighbor sets
  const occupiedIds = new Set(vertices.filter(v => v.building).map(v => v.id));

  // Build adjacency from edges
  const adjacent = new Map<string, Set<string>>();
  edges.forEach(edge => {
    if (!adjacent.has(edge.v1)) adjacent.set(edge.v1, new Set());
    if (!adjacent.has(edge.v2)) adjacent.set(edge.v2, new Set());
    adjacent.get(edge.v1)!.add(edge.v2);
    adjacent.get(edge.v2)!.add(edge.v1);
  });

  // Vertices too close to existing buildings (distance rule)
  const tooClose = new Set<string>();
  occupiedIds.forEach(id => {
    tooClose.add(id);
    adjacent.get(id)?.forEach(n => tooClose.add(n));
  });

  if (state.phase === 'setup') {
    // In setup, any vertex not too close
    return vertices.filter(v => !tooClose.has(v.id)).map(v => v.id);
  }

  // Playing: must be connected to own road network
  const myRoadVertices = new Set<string>();
  edges.forEach(edge => {
    if (edge.road?.playerId === myId) {
      myRoadVertices.add(edge.v1);
      myRoadVertices.add(edge.v2);
    }
  });

  // Also include vertices with own settlements (they're already connected)
  vertices.forEach(v => {
    if (v.building?.playerId === myId) myRoadVertices.add(v.id);
  });

  return vertices
    .filter(v => myRoadVertices.has(v.id) && !tooClose.has(v.id))
    .map(v => v.id);
}

export function getValidRoadPlacements(state: ClientGameState, myId: string): string[] {
  const { edges, vertices } = state.board;

  const occupiedEdgeIds = new Set(edges.filter(e => e.road).map(e => e.id));

  // ── Setup phase: road must touch the last-placed settlement (the one with no road yet) ──
  if (state.phase === 'setup') {
    const mySettlements = vertices.filter(
      v => v.building?.playerId === myId && v.building.type === 'settlement',
    );
    // Last settlement = the one that doesn't yet have a road from this player touching it
    const lastSettlement = mySettlements.find(v =>
      !edges.some(e => e.road?.playerId === myId && (e.v1 === v.id || e.v2 === v.id)),
    ) ?? mySettlements[mySettlements.length - 1];

    if (!lastSettlement) return [];
    return edges
      .filter(e => !occupiedEdgeIds.has(e.id) && (e.v1 === lastSettlement.id || e.v2 === lastSettlement.id))
      .map(e => e.id);
  }

  // ── Playing phase: any edge connected to own road network ──
  const myOccupiedVertexIds = new Set(
    vertices.filter(v => v.building?.playerId === myId).map(v => v.id),
  );

  const myRoadEdgeVertices = new Set<string>();
  edges.forEach(e => {
    if (e.road?.playerId === myId) {
      myRoadEdgeVertices.add(e.v1);
      myRoadEdgeVertices.add(e.v2);
    }
  });

  const myConnectedVertices = new Set([...myOccupiedVertexIds, ...myRoadEdgeVertices]);

  return edges
    .filter(e => {
      if (occupiedEdgeIds.has(e.id)) return false;
      const touchesMine = myConnectedVertices.has(e.v1) || myConnectedVertices.has(e.v2);
      if (!touchesMine) return false;

      // Road cannot pass through an opponent's building
      const v1Building = vertices.find(v => v.id === e.v1)?.building;
      const v2Building = vertices.find(v => v.id === e.v2)?.building;
      if (v1Building && v1Building.playerId !== myId && !myConnectedVertices.has(e.v2)) return false;
      if (v2Building && v2Building.playerId !== myId && !myConnectedVertices.has(e.v1)) return false;
      return true;
    })
    .map(e => e.id);
}

export function getValidCityPlacements(state: ClientGameState, myId: string): string[] {
  return state.board.vertices
    .filter(v => v.building?.playerId === myId && v.building.type === 'settlement')
    .map(v => v.id);
}

export function getValidRobberHexes(state: ClientGameState): string[] {
  return state.board.hexes
    .filter(h => !h.hasRobber)
    .map(h => h.id);
}
