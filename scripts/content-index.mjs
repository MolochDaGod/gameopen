#!/usr/bin/env node
/** Rebuild content/manifests from folder JSON. */
import { rebuildManifests } from "./content-lib.mjs";

const r = rebuildManifests();
console.log("Content index rebuilt:");
console.log(JSON.stringify(r.summary, null, 2));
