"use client";
import { useState, useEffect, useCallback } from "react";
import "./admin.css";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");
const AREAS = ["Executive education programme", "General management", "Leadership and strategy", "Finance and business analytics", "Operations and supply chain", "Digital transformation", "Other / Not sure yet"];
const LABELS = [["fullName", "Full name"], ["email", "Email"], ["phone", "Mobile"], ["city", "City"], ["areaOfInterest", "Area of interest"], ["learningMode", "Learning mode"], ["startPeriod", "Start period"], ["source", "Heard via"], ["qualification", "Qualification"], ["specialisation", "Specialisation"], ["experience", "Work experience"], ["designation", "Designation"], ["organisation", "Organisation"], ["industry", "Industry"], ["contactTime", "Contact time"], ["message", "Enquiry message"]];
const fmt = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-");

async function request(path, token, opts = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (res.status === 401 && token) throw Object.assign(new Error("Your session has expired. Please sign in again."), { expired: true });
  return res;
}

// Components are defined outside the page so inputs keep focus while typing.
function Login({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(e) {
    e.preventDefault();
    if (!pw) return setErr("Enter the admin password.");
    setBusy(true); setErr("");
    try {
      const res = await request("/api/admin/login", null, { method: "POST", body: JSON.stringify({ password: pw }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) onLogin(data.token); else setErr(data.message || "Sign in failed.");
    } catch { setErr("Can't reach the server. Check your connection and try again."); }
    setBusy(false);
  }
  return (
    <form className="login" onSubmit={go} noValidate>
      <h2>Admin sign in</h2>
      <p>View and manage executive programme enquiries.</p>
      <div className="field">
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} className={err ? "bad" : undefined} autoFocus />
        {err && <p className="err" role="alert">{err}</p>}
      </div>
      <button type="submit" disabled={busy}>{busy ? <><span className="spin" /> Signing in...</> : "Sign in"}</button>
    </form>
  );
}

function Detail({ row, onClose, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Enquiry details" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div><h2>{row.fullName}</h2><span className="sub">{row.reference} · Submitted {fmt(row.created_at)}</span></div>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-b">
          <dl>{LABELS.map(([k, l]) => (
            <div className="dl-row" key={k}><dt>{l}</dt><dd>{row[k] || "-"}</dd></div>
          ))}</dl>
        </div>
        <div className="modal-f">
          {confirm ? (
            <>
              <span style={{ fontSize: 13 }}>Delete this enquiry permanently?</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-line" onClick={() => setConfirm(false)} disabled={busy}>Cancel</button>
                <button className="btn-danger" disabled={busy} onClick={async () => { setBusy(true); await onDelete(row.id); setBusy(false); }}>{busy ? "Deleting..." : "Yes, delete"}</button>
              </div>
            </>
          ) : (
            <>
              <button className="btn-line" onClick={() => setConfirm(true)}>Delete</button>
              <div style={{ display: "flex", gap: 8 }}>
                <a className="btn-line" style={{ borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none", padding: "10px 14px" }} href={`mailto:${row.email}`}>Email</a>
                <button onClick={onClose}>Close</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ token, onLogout }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);

  const flash = (type, text) => { setToast({ type, text }); setTimeout(() => setToast(null), 4500); };
  const fail = useCallback((e) => (e.expired ? onLogout(e.message) : setError("Can't load enquiries. Check your connection and try again.")), [onLogout]);

  useEffect(() => { const t = setTimeout(() => { setQ(input.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [input]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const p = new URLSearchParams({ page, search: q, area });
      const res = await request(`/api/admin/enquiries?${p}`, token);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch (e) { fail(e); }
    setLoading(false);
  }, [page, q, area, token, fail]);
  useEffect(() => { load(); }, [load]);

  async function remove(id) {
    try {
      const res = await request(`/api/admin/enquiries/${id}`, token, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSelected(null); flash("ok", "Enquiry deleted."); load();
    } catch (e) { e.expired ? onLogout(e.message) : flash("error", "Could not delete. Please try again."); }
  }

  async function exportCsv() {
    try {
      const p = new URLSearchParams({ search: q, area });
      const res = await fetch(`${API}/api/admin/export?${p}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) return onLogout("Your session has expired. Please sign in again.");
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: "iimt-enquiries.csv" });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      flash("ok", "Export downloaded.");
    } catch { flash("error", "Export failed. Please try again."); }
  }

  const items = data?.items || [];
  const s = data?.stats;
  return (
    <>
      <div className="adm-bar"><div className="adm-bar-in">
        <div><h1>Enquiry Dashboard</h1><small>IIM Tiruchirappalli · Executive Education</small></div>
        <div className="adm-actions">
          <button className="btn-gold" onClick={exportCsv}>Export CSV</button>
          <button className="btn-ghost" onClick={() => onLogout()}>Sign out</button>
        </div>
      </div></div>

      <div className="adm-wrap">
        <div className="stats">
          <div className="stat"><b>{s?.total ?? "-"}</b><span>Total enquiries</span></div>
          <div className="stat"><b>{s?.today ?? "-"}</b><span>Today</span></div>
          <div className="stat"><b>{s?.week ?? "-"}</b><span>Last 7 days</span></div>
          <div className="stat"><b className="sm">{s?.topArea || "-"}</b><span>Most popular area</span></div>
        </div>

        <div className="tools">
          <input type="search" placeholder="Search name, email, mobile, city or organisation" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Search enquiries" />
          <select value={area} onChange={(e) => { setArea(e.target.value); setPage(1); }} aria-label="Filter by area">
            <option value="">All areas of interest</option>
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>

        <div className="panel" aria-busy={loading}>
          {error ? (
            <div className="empty">{error}<br /><br /><button onClick={load}>Try again</button></div>
          ) : loading && !data ? (
            <div style={{ padding: 20, display: "grid", gap: 14 }}>{[1, 2, 3, 4].map((i) => <div className="sk" key={i} />)}</div>
          ) : items.length === 0 ? (
            <div className="empty">{q || area ? "No enquiries match your search or filter." : "No enquiries yet. New submissions will appear here."}</div>
          ) : (
            <>
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>Reference</th><th>Applicant</th><th>Mobile</th><th>City</th><th>Area of interest</th><th>Experience</th><th>Submitted</th><th /></tr></thead>
                  <tbody>{items.map((r) => (
                    <tr key={r.id}>
                      <td className="ref">{r.reference}</td>
                      <td><strong>{r.fullName}</strong><span className="sub">{r.email}</span></td>
                      <td style={{ whiteSpace: "nowrap" }}>{r.phone}</td>
                      <td>{r.city}</td>
                      <td><span className="tag">{r.areaOfInterest}</span></td>
                      <td>{r.experience}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{fmt(r.created_at)}</td>
                      <td><button className="btn-line" onClick={() => setSelected(r)}>View</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="cards">{items.map((r) => (
                <div className="card-row" key={r.id} onClick={() => setSelected(r)}>
                  <strong>{r.fullName}</strong>
                  <span className="sub">{r.email} · {r.phone}</span>
                  <span><span className="tag">{r.areaOfInterest}</span></span>
                  <span className="sub">{r.city} · {fmt(r.created_at)} · {r.reference}</span>
                </div>
              ))}</div>
              <div className="pager">
                <span>{data.total} result{data.total === 1 ? "" : "s"} · Page {data.page} of {data.pages}</span>
                <div>
                  <button className="btn-line" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</button>
                  <button className="btn-line" disabled={page >= data.pages || loading} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {selected && <Detail row={selected} onClose={() => setSelected(null)} onDelete={remove} />}
      {toast && <div className={`toast ${toast.type === "ok" ? "info" : "error"}`} role="status" style={toast.type === "ok" ? { background: "var(--success)" } : undefined}><span>{toast.text}</span></div>}
    </>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => { setToken(sessionStorage.getItem("iimt_admin")); setReady(true); }, []);
  const login = (t) => { sessionStorage.setItem("iimt_admin", t); setNotice(""); setToken(t); };
  const logout = useCallback((msg) => { sessionStorage.removeItem("iimt_admin"); setNotice(typeof msg === "string" ? msg : ""); setToken(null); }, []);

  if (!ready) return null;
  return (
    <div className="adm">
      {token ? <Dashboard token={token} onLogout={logout} /> : (
        <>
          <div className="topbar" />
          {notice && <p className="err" style={{ textAlign: "center", marginTop: 24 }} role="alert">{notice}</p>}
          <Login onLogin={login} />
        </>
      )}
    </div>
  );
}
