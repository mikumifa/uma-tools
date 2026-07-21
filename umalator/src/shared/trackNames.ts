import tracknames from "@data/tracknames.json";

export const TRACKNAMES_cn = {};
Object.keys(tracknames).forEach(k => (TRACKNAMES_cn[k] = tracknames[k][2]));
Object.freeze(TRACKNAMES_cn);
