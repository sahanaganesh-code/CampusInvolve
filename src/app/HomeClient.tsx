"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Club = {
  id: string;
  name: string;
  score: number;
  matched: string[];
  categories: string[];
  url?: string | null;
};

export default function Page() {
  const [majors, setMajors] = useState<string[]>([]);

  const [major1, setMajor1] = useState("");
  const [major2, setMajor2] = useState("");
  const [major3, setMajor3] = useState("");

  const [interestsText, setInterestsText] = useState("ai, robotics, consulting");
  const [topK, setTopK] = useState(60);
  const [broad, setBroad] = useState(true);

  const [ranked, setRanked] = useState<Club[]>([]);
  const [filterText, setFilterText] = useState("");

  const [consideredIds, setConsideredIds] = useState<Set<string>>(new Set());
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

  const [weeklyBudgetHours, setWeeklyBudgetHours] = useState(6);
  const [maxClubs, setMaxClubs] = useState(4);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
    (async () => {
        const supabase = supabaseBrowser();
        const { data } = await supabase.auth.getUser();
        setUserEmail(data.user?.email ?? null);
    })();
    }, []);

    async function logout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
    }
  const interests = useMemo(
    () => interestsText.split(",").map((s) => s.trim()).filter(Boolean),
    [interestsText]
  );

  const selectedMajors = useMemo(() => {
    const arr = [major1, major2, major3].map((x) => x.trim()).filter(Boolean);
    return Array.from(new Set(arr));
  }, [major1, major2, major3]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/majors");
      const text = await res.text();
      if (!res.ok) {
        console.error("GET /api/majors failed:", res.status, text);
        return;
      }
      const json = JSON.parse(text);
      const list: string[] = json.majors ?? [];
      setMajors(list);

      // better default: pick something CS-ish if present
      if (list.length && !major1) {
        const cs =
          list.find((m) => m.toLowerCase().includes("computer")) ??
          list.find((m) => m.toLowerCase().includes("data")) ??
          list[0];
        setMajor1(cs);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRanked = useMemo(() => {
    const ft = filterText.trim().toLowerCase();
    const base = ranked.slice(0, topK);
    if (!ft) return base;

    return base.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const cats = (c.categories ?? []).join(" ").toLowerCase();
      const matched = (c.matched ?? []).join(" ").toLowerCase();
      return name.includes(ft) || cats.includes(ft) || matched.includes(ft);
    });
  }, [ranked, topK, filterText]);

  function toggleConsider(id: string, checked: boolean) {
    setConsideredIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

    if (!checked) {
      setLockedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function toggleLock(id: string, checked: boolean) {
    setLockedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function runRecommend() {
    setLoading(true);
    setPlan(null);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          majors: selectedMajors,
          interests,
          topK,
          broad,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        console.error("POST /api/recommend failed:", res.status, text);
        throw new Error(text);
      }

      const json = JSON.parse(text);
      const results: Club[] = json.results ?? [];
      setRanked(results);

      setConsideredIds(new Set(results.map((c) => c.id)));
      setLockedIds(new Set());
      setFilterText("");
    } finally {
      setLoading(false);
    }
  }

  async function runPlan() {
    setLoading(true);
    try {
      const candidates = ranked.filter((c) => consideredIds.has(c.id));
      const locked = Array.from(lockedIds).filter((id) => consideredIds.has(id));

      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rankedClubs: candidates,
          lockedIds: locked,
          weeklyBudgetHours,
          maxClubs,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        console.error("POST /api/plan failed:", res.status, text);
        throw new Error(text);
      }

      const json = JSON.parse(text);
      setPlan(json);
    } finally {
      setLoading(false);
    }
  }

  function selectAllShown() {
    setConsideredIds((prev) => {
      const next = new Set(prev);
      for (const c of visibleRanked) next.add(c.id);
      return next;
    });
  }

  function selectNoneShown() {
    setConsideredIds((prev) => {
      const next = new Set(prev);
      for (const c of visibleRanked) next.delete(c.id);
      return next;
    });
    setLockedIds((prev) => {
      const next = new Set(prev);
      for (const c of visibleRanked) next.delete(c.id);
      return next;
    });
  }

  function selectTop20() {
    const top = visibleRanked.slice(0, 20).map((c) => c.id);
    setConsideredIds((prev) => {
      const next = new Set(prev);
      for (const id of top) next.add(id);
      return next;
    });
  }

  function clearLocks() {
    setLockedIds(new Set());
  }

  const consideredCount = ranked.filter((c) => consideredIds.has(c.id)).length;

  return (
    <main className="ui-shell">
      <div className="header">
        <div className="brand">
          <div className="brandTitle">
            Campus<span>Involve</span>
          </div>
          <div className="brandSubtitle">
            Pick up to 3 majors, add interests, get club matches, then optimize a weekly plan that fits your time.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            {/* Logo on top */}
            <div className="badge">
                <Image
                src="/uw-logo.png"
                alt="UW–Madison"
                width={220}
                height={60}
                style={{ height: 44, width: "auto" }}
                priority
                />
            </div>

            {/* (optional) email under logo */}
            {userEmail ? (
                <div className="kpi">
                Signed in as <strong>{userEmail}</strong>
                </div>
            ) : null}

            {/* Logout under logo */}
            <button className="btn btn-primary" onClick={logout}>
                Log out
            </button>
        </div>


      </div>

      <div className="ui-grid">
        {/* LEFT */}
        <section className="card">
          <div className="cardTitle">1) Choose majors and interests</div>

          <div className="row3">
            <div className="field">
              <div className="label">Major 1</div>
              <select className="select" value={major1} onChange={(e) => setMajor1(e.target.value)}>
                {majors.length === 0 ? <option>Loading…</option> : null}
                {majors.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <div className="label">Major 2 (optional)</div>
              <select className="select" value={major2} onChange={(e) => setMajor2(e.target.value)}>
                <option value="">None</option>
                {majors.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <div className="label">Major 3 (optional)</div>
              <select className="select" value={major3} onChange={(e) => setMajor3(e.target.value)}>
                <option value="">None</option>
                {majors.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="divider" />

          <div className="row2">
            <div className="field">
              <div className="label">Interests (comma-separated)</div>
              <input
                className="input"
                value={interestsText}
                onChange={(e) => setInterestsText(e.target.value)}
                placeholder="ai, robotics, consulting"
              />
            </div>

            <div className="field">
              <div className="label">Number of recommendations</div>
              <input
                className="input"
                type="number"
                value={topK}
                min={10}
                max={200}
                onChange={(e) => setTopK(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="actions">
            <button className="btn btn-primary" onClick={runRecommend} disabled={loading || selectedMajors.length === 0}>
              {loading ? "Finding matches…" : "Recommend clubs"}
            </button>
            <button className="btn" onClick={() => setBroad((v) => !v)} disabled={loading}>
              Broader matching: {broad ? "On" : "Off"}
            </button>
          </div>

          <div className="divider" />

          <div className="resultsHeader">
            <div className="cardTitle" style={{ margin: 0 }}>2) Review results and pick clubs</div>
            <div className="kpiRow">
              <div className="kpi">Returned <strong>{ranked.length}</strong></div>
              <div className="kpi">Showing <strong>{visibleRanked.length}</strong></div>
              <div className="kpi">Considered <strong>{consideredIds.size}</strong></div>
              <div className="kpi">Locked <strong>{lockedIds.size}</strong></div>
            </div>
          </div>

          <div className="searchRow">
            <div className="field">
              <div className="label">Filter results</div>
              <input
                className="input"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="try: robotics, finance, engineering"
              />
            </div>

            <div className="field">
              <div className="label">Quick actions</div>
              <div className="actions" style={{ marginTop: 0 }}>
                <button className="btn" onClick={selectAllShown} disabled={ranked.length === 0}>Select all shown</button>
                <button className="btn" onClick={selectNoneShown} disabled={ranked.length === 0}>Select none shown</button>
                <button className="btn" onClick={selectTop20} disabled={ranked.length === 0}>Select top 20</button>
                <button className="btn" onClick={clearLocks} disabled={lockedIds.size === 0}>Clear locks</button>
              </div>
            </div>
          </div>

          {ranked.length === 0 ? (
            <div className="emptyState">
              <div className="emptyTitle">Your matches will show here</div>
              <p className="emptyText">
                Pick majors, add interests, then click <b>Recommend clubs</b>. You can filter results, select what you actually
                care about, and lock must-join clubs before building your plan.
              </p>
            </div>
          ) : visibleRanked.length === 0 ? (
            <div className="emptyState">
              <div className="emptyTitle">No results match your filter</div>
              <p className="emptyText">Try a broader keyword like “engineering”, “finance”, or clear the filter.</p>
            </div>
          ) : (
            <div className="clubGrid">
              {visibleRanked.map((c) => (
                <div key={c.id} className="clubCard">
                  <div className="clubTop">
                    <div className="clubName">{c.name}</div>
                    <div className="clubScore">score {c.score.toFixed(2)}</div>
                  </div>

                  <div className="pills">
                    <label className="pill">
                      <input
                        type="checkbox"
                        checked={consideredIds.has(c.id)}
                        onChange={(e) => toggleConsider(c.id, e.target.checked)}
                      />
                      Consider
                    </label>

                    <label className="pill" style={{ opacity: consideredIds.has(c.id) ? 1 : 0.55 }}>
                      <input
                        type="checkbox"
                        checked={lockedIds.has(c.id)}
                        disabled={!consideredIds.has(c.id)}
                        onChange={(e) => toggleLock(c.id, e.target.checked)}
                      />
                      Lock
                    </label>

                    {c.url ? (
                      <a className="pill" href={c.url} target="_blank" rel="noreferrer">
                        Open WIN →
                      </a>
                    ) : null}
                  </div>

                  <div className="small">
                    <div><b>matched:</b> {(c.matched ?? []).slice(0, 10).join(", ") || "—"}</div>
                    <div><b>categories:</b> {(c.categories ?? []).slice(0, 6).join(", ") || "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* RIGHT */}
        <aside className="card sticky">
          <div className="cardTitle">3) Build your plan</div>

          <div className="row2">
            <div className="field">
              <div className="label">Weekly time budget (hours)</div>
              <input
                className="input"
                type="number"
                value={weeklyBudgetHours}
                onChange={(e) => setWeeklyBudgetHours(Number(e.target.value))}
              />
            </div>

            <div className="field">
              <div className="label">Max clubs</div>
              <input
                className="input"
                type="number"
                value={maxClubs}
                onChange={(e) => setMaxClubs(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="divider" />

          <div className="kpiRow">
            <div className="kpi">Candidates <strong>{consideredCount}</strong></div>
            <div className="kpi">Locked <strong>{lockedIds.size}</strong></div>
          </div>

          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={runPlan}
              disabled={loading || ranked.length === 0 || consideredCount === 0}
            >
              {loading ? "Optimizing…" : "Build my plan"}
            </button>
            <button className="btn" onClick={() => setPlan(null)} disabled={!plan}>
              Clear plan
            </button>
          </div>

          <div className="divider" />

          {!plan ? (
            <div className="small">
              Build a feasible club set under your weekly time budget. Locked clubs are always included first.
            </div>
          ) : plan.error ? (
            <div className="small" style={{ color: "var(--red)" }}>
              <b>{plan.error}</b> {plan.detail ? `(${plan.detail})` : ""}
            </div>
          ) : (
            <>
              <div className="kpiRow">
                <div className="kpi">
                  Used hours <strong>{plan.usedHours}</strong> / {weeklyBudgetHours}
                </div>
              </div>

              <div className="divider" />

              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {(plan.chosen ?? []).map((c: any) => (
                  <li key={c.id} style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 850, fontSize: 15 }}>{c.name}</div>
                    <div className="small" style={{ marginTop: 4 }}>
                      hours {c.hours}, utility/hour {c.utilityPerHour.toFixed(2)}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}