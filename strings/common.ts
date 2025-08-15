import tracknames from '../umalator-cn/tracknames.json';

export const TRACKNAMES_ja = {};
Object.keys(tracknames).forEach(k => TRACKNAMES_ja[k] = tracknames[k][0]);
Object.freeze(TRACKNAMES_ja);

export const TRACKNAMES_en = {};
Object.keys(tracknames).forEach(k => TRACKNAMES_en[k] = tracknames[k][1]);
Object.freeze(TRACKNAMES_en);


export const TRACKNAMES_cn = {};
Object.keys(tracknames).forEach(k => TRACKNAMES_cn[k] = tracknames[k][2]);
Object.freeze(TRACKNAMES_cn);