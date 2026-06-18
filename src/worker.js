// ============================================================
// worker.js — الباك إند الرئيسي (Cloudflare Worker)
// API + D1 + خدمة الواجهة
// ============================================================
import {
  resolveQ, normalDepth, froude, backwaterProfile
} from './hydraulics.js';
import { INDEX_HTML, APP_JS } from './frontend.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cors() },
  });

const cors = () => ({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type',
});

async function audit(env, action, node_id, detail) {
  await env.DB.prepare(
    'INSERT INTO audit_log (action, node_id, detail) VALUES (?,?,?)'
  ).bind(action, node_id ?? null, JSON.stringify(detail ?? {})).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { headers: cors() });

    try {
      // ---------- API ----------
      if (path.startsWith('/api/')) {

        // GET /api/nodes — كل العقد + منحنى المعايرة
        if (path === '/api/nodes' && method === 'GET') {
          const { results } = await env.DB.prepare(
            `SELECT n.*, c.curve_type, c.a, c.b, c.h0, c.c_n, c.c_up, c.c_dn,
                    c.intercept, c.avg_error_pct, c.n_samples
             FROM nodes n LEFT JOIN calib_curves c ON c.node_id = n.id
             ORDER BY n.sort_order, n.km`
          ).all();
          return json(results);
        }

        // GET /api/readings?date=YYYY-MM-DD — قراءات يوم + التصرف المحسوب
        if (path === '/api/readings' && method === 'GET') {
          const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
          const { results: nodes } = await env.DB.prepare(
            `SELECT n.*, c.curve_type, c.a, c.b, c.h0, c.c_n, c.c_up, c.c_dn, c.intercept
             FROM nodes n LEFT JOIN calib_curves c ON c.node_id = n.id
             ORDER BY n.sort_order, n.km`
          ).all();
          const { results: reads } = await env.DB.prepare(
            'SELECT * FROM readings WHERE reading_date = ?'
          ).bind(date).all();
          const rmap = Object.fromEntries(reads.map(r => [r.node_id, r]));

          const out = nodes.map(n => {
            const r = rmap[n.id] || {};
            const curve = n.curve_type ? n : null;
            const { q, method: m } = resolveQ(n, curve, r);
            return {
              id: n.id, name_ar: n.name_ar, kind: n.kind, km: n.km,
              wl_up: r.wl_up ?? null, wl_dn: r.wl_dn ?? null,
              gates_open: r.gates_open ?? null, q_manual: r.q_manual ?? null,
              q: Number(q.toFixed(3)), method: m,
              calib_error: n.avg_error_pct ?? null,
            };
          });
          return json({ date, nodes: out });
        }

        // POST /api/readings — حفظ/تحديث قراءة (upsert)
        if (path === '/api/readings' && method === 'POST') {
          const body = await request.json();
          const { node_id, reading_date, wl_up, wl_dn, gates_open, q_manual } = body;
          if (!node_id || !reading_date) return json({ error: 'node_id و reading_date مطلوبان' }, 400);
          await env.DB.prepare(
            `INSERT INTO readings (node_id, reading_date, wl_up, wl_dn, gates_open, q_manual)
             VALUES (?,?,?,?,?,?)
             ON CONFLICT(node_id, reading_date) DO UPDATE SET
               wl_up=excluded.wl_up, wl_dn=excluded.wl_dn,
               gates_open=excluded.gates_open, q_manual=excluded.q_manual`
          ).bind(node_id, reading_date, wl_up ?? null, wl_dn ?? null,
                 gates_open ?? null, q_manual ?? null).run();
          await audit(env, 'upsert_reading', node_id, body);
          return json({ ok: true });
        }

        // GET /api/history?node_id=&days=30 — سلسلة زمنية لعقدة
        if (path === '/api/history' && method === 'GET') {
          const node_id = url.searchParams.get('node_id');
          const days = Math.min(Number(url.searchParams.get('days') || 30), 365);
          const { results } = await env.DB.prepare(
            `SELECT reading_date, wl_up, wl_dn, gates_open, q_manual
             FROM readings WHERE node_id = ?
             ORDER BY reading_date DESC LIMIT ?`
          ).bind(node_id, days).all();
          return json(results.reverse());
        }

        // GET /api/profile?node_id=&date= — منحنى backwater (مخزّن)
        if (path === '/api/profile' && method === 'GET') {
          const node_id = url.searchParams.get('node_id');
          const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
          const key = `profile:${node_id}:${date}`;
          const cached = await env.DB.prepare(
            'SELECT payload FROM calc_cache WHERE cache_key = ?'
          ).bind(key).first();
          if (cached) return json(JSON.parse(cached.payload));

          const node = await env.DB.prepare('SELECT * FROM nodes WHERE id=?').bind(node_id).first();
          if (!node) return json({ error: 'node غير موجود' }, 404);
          const r = await env.DB.prepare(
            'SELECT * FROM readings WHERE node_id=? AND reading_date=?'
          ).bind(node_id, date).first() || {};
          const yStart = (r.wl_dn ?? node.bed_level) - node.bed_level;
          const Q = r.q_manual ?? 50;
          const pts = backwaterProfile(Q, node, Math.max(yStart, 0.3), 5000, 50);
          const payload = { node_id, date, Q, points: pts };
          await env.DB.prepare(
            'INSERT OR REPLACE INTO calc_cache (cache_key, payload) VALUES (?,?)'
          ).bind(key, JSON.stringify(payload)).run();
          return json(payload);
        }

        // GET /api/balance?date= — ميزان كتلي مبسّط للترعة
        if (path === '/api/balance' && method === 'GET') {
          const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
          const { results: nodes } = await env.DB.prepare(
            `SELECT n.*, c.curve_type, c.a, c.b, c.h0, c.c_n, c.c_up, c.c_dn, c.intercept
             FROM nodes n LEFT JOIN calib_curves c ON c.node_id=n.id ORDER BY n.km`
          ).all();
          const { results: reads } = await env.DB.prepare(
            'SELECT * FROM readings WHERE reading_date=?'
          ).bind(date).all();
          const rmap = Object.fromEntries(reads.map(r => [r.node_id, r]));
          let inflow = 0, outflow = 0;
          const rows = nodes.map(n => {
            const { q } = resolveQ(n, n.curve_type ? n : null, rmap[n.id] || {});
            if (n.kind === 'mouth') inflow += q; else outflow += q;
            return { id: n.id, name_ar: n.name_ar, kind: n.kind, q: Number(q.toFixed(3)) };
          });
          return json({ date, inflow: +inflow.toFixed(3), outflow: +outflow.toFixed(3),
                        gap: +(inflow - outflow).toFixed(3), rows });
        }

        // GET /api/audit?limit=50
        if (path === '/api/audit' && method === 'GET') {
          const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
          const { results } = await env.DB.prepare(
            'SELECT * FROM audit_log ORDER BY id DESC LIMIT ?'
          ).bind(limit).all();
          return json(results);
        }

        return json({ error: 'مسار API غير معروف' }, 404);
      }

      // ---------- app.js ----------
      if (path === '/app.js') {
        return new Response(APP_JS, {
          headers: { 'content-type': 'application/javascript; charset=utf-8' },
        });
      }
      // ---------- الواجهة ----------
      if (path === '/' || path === '/index.html') {
        return new Response(INDEX_HTML, {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return json({ error: String(err?.message || err) }, 500);
    }
  },
};
