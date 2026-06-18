// ============================================================
// hydraulics.js — محرّك الحسابات الهيدروليكية (server-side)
// ============================================================

const G = 9.81;

export function trapezoid(y, b, z) {
  const area = (b + z * y) * y;
  const wp = b + 2 * y * Math.sqrt(1 + z * z);
  const top = b + 2 * z * y;
  const R = area / wp;
  return { area, wp, top, R };
}

export function manningQ(y, node) {
  const { b = 0, z = 0, S0 = 1e-4, n = 0.02 } = node;
  if (y <= 0) return 0;
  const { area, R } = trapezoid(y, b, z);
  return (1 / n) * area * Math.pow(R, 2 / 3) * Math.sqrt(S0);
}

export function normalDepth(Q, node, { tol = 1e-6, maxIter = 60 } = {}) {
  if (Q <= 0) return 0;
  let lo = 1e-4, hi = 50;
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const q = manningQ(mid, node);
    if (Math.abs(q - Q) < tol) return mid;
    if (q < Q) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function froude(Q, y, node) {
  if (y <= 0) return 0;
  const { area, top } = trapezoid(y, node.b, node.z);
  const v = Q / area;
  return v / Math.sqrt(G * area / top);
}

export function calibQ(curve, reading) {
  if (!curve) return null;
  if (curve.curve_type === 'power') {
    const head = (reading.wl_dn ?? 0) - curve.h0;
    if (head <= 0) return 0;
    return curve.a * Math.pow(head, curve.b);
  }
  if (curve.curve_type === 'linear') {
    const N = reading.gates_open ?? 0;
    const up = reading.wl_up ?? 0;
    const dn = reading.wl_dn ?? 0;
    return curve.c_n * N + curve.c_up * up + curve.c_dn * dn + curve.intercept;
  }
  return null;
}

export function resolveQ(node, curve, reading) {
  if (reading?.q_manual != null && reading.q_manual !== '') {
    return { q: Number(reading.q_manual), method: 'manual' };
  }
  const cq = calibQ(curve, reading);
  if (cq != null && isFinite(cq) && cq >= 0) {
    return { q: cq, method: 'calibrated' };
  }
  const node2 = {
    b: node.gauge_width ?? node.bed_width,
    z: node.gauge_slope ?? node.side_slope,
    S0: node.bed_slope, n: node.manning_n
  };
  const y = (reading?.wl_dn ?? 0) - (node.bed_level ?? 0);
  return { q: manningQ(Math.max(y, 0), node2), method: 'manning' };
}

export function backwaterProfile(Q, node, yStart, length, step = 25) {
  const node2 = { b: node.bed_width, z: node.side_slope, S0: node.bed_slope, n: node.manning_n };
  const Sf = (y) => {
    const { area, R } = trapezoid(y, node2.b, node2.z);
    const v = Q / area;
    return Math.pow((v * node2.n) / Math.pow(R, 2 / 3), 2);
  };
  const dydx = (y) => {
    const { area, top } = trapezoid(y, node2.b, node2.z);
    const Fr2 = (Q * Q * top) / (G * area * area * area);
    return (node2.S0 - Sf(y)) / (1 - Fr2);
  };
  const pts = [{ x: 0, y: yStart }];
  let y = yStart;
  for (let x = 0; x < length; x += step) {
    const k1 = dydx(y);
    const yp = y + k1 * step;
    const k2 = dydx(yp);
    y = y + 0.5 * (k1 + k2) * step;
    pts.push({ x: x + step, y });
  }
  return pts;
                                 }
