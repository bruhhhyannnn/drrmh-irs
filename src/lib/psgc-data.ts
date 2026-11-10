import { indexBarangays, type BuildingLocation, type PsgcTree } from './psgc';

// The location list on the server. It's large, so it loads on first use: import this only from
// server code. The browser gets it once through getLocationTree and keeps it on the phone.

let tree: Promise<PsgcTree> | null = null;
let index: Promise<Map<string, BuildingLocation>> | null = null;

export function loadPsgcTree(): Promise<PsgcTree> {
  tree ??= import('../data/psgc.json').then((m) => m.default as PsgcTree);
  return tree;
}

/** Where a barangay is, from the server's own list; null when the code isn't on it. */
export async function findBarangay(code: string): Promise<BuildingLocation | null> {
  index ??= loadPsgcTree().then(indexBarangays);
  return (await index).get(code) ?? null;
}
