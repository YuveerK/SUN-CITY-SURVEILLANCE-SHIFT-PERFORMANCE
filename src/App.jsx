import React, { useMemo, useState, useEffect } from "react";
import { useCSVReader } from "react-papaparse";

const TABLE_COLUMNS = [
  "Officer",
  "Cashiering",
  "Count",
  "Technical",
  "Security",
  "MVG",
  "Slots",
  "AR",
  "BJ",
  "RPK",
  "PB/BACCARAT",
  "GEN (TABLES)",
  "Total (T)",
  "Total",
  "Detections",
  "Punter scans",
  "Systems Check",
  "Target Breaches",
  "All Breaches",
];

const NUMERIC_COLUMNS = TABLE_COLUMNS.filter((c) => c !== "Officer");

// -------- helpers ----------
function clean(value) {
  return String(value ?? "").trim();
}
function lower(value) {
  return clean(value).toLowerCase();
}
function isBlank(value) {
  return clean(value) === "";
}
function normalizeOfficerName(capturedBy) {
  return clean(capturedBy);
}

// Systems Check -> Occurrence Task matches these exact values
const SYSTEM_TASKS = new Set([
  "alarm test",
  "camera fault logged",
  "early warning test",
  "armed robbery practice",
]);

function buildOfficerStats(rows, officerName) {
  const stats = {
    Officer: officerName,

    Cashiering: 0,
    Count: 0,

    Technical: 0,
    Security: 0,
    MVG: 0,
    Slots: 0,

    AR: 0,
    BJ: 0,
    RPK: 0,
    "PB/BACCARAT": 0,
    "GEN (TABLES)": 0,

    "Total (T)": 0,
    Total: 0,

    Detections: 0,
    "Punter scans": 0,
    "Systems Check": 0,

    "Target Breaches": 0,
    "All Breaches": 0,
  };

  const officerRows = rows.filter(
    (r) => normalizeOfficerName(r["Captured By"]) === officerName
  );

  // Count = all rows for that officer (your current logic)
  stats.Count = officerRows.length;

  for (const r of officerRows) {
    const dept = lower(r["Department"]);
    const task = lower(r["Occurrence Task"]);
    const occurrenceType = lower(r["Occurrence Type"]);
    const station = clean(r["Station"]);
    const stationLower = lower(r["Station"]);
    const detection = clean(r["Detection"]);

    // ---- Department counts
    if (dept === "cashiering") stats.Cashiering += 1;
    if (dept === "technical") stats.Technical += 1;
    if (dept === "security") stats.Security += 1;
    if (dept === "mvg") stats.MVG += 1;
    if (dept === "slots") stats.Slots += 1;

    // ---- Tables buckets
    if (dept === "tables") {
      const s = stationLower;

      // GEN (TABLES): Department=Tables AND Station blank
      if (isBlank(station)) {
        stats["GEN (TABLES)"] += 1;
      } else {
        if (s.startsWith("ar") || s.includes("ar")) stats.AR += 1;
        if (s.startsWith("bj") || s.includes("bj")) stats.BJ += 1;
        if (s.startsWith("pk") || s.includes("pk")) stats.RPK += 1;
        if (s.startsWith("pb") || s.includes("pb") || s.includes("baccarat")) {
          stats["PB/BACCARAT"] += 1;
        }
      }
    }

    // ---- Detections
    if (lower(detection) === "yes") stats.Detections += 1;

    // ---- Punter scans -> Occurrence Task === "Punter Scan"
    if (task === "punter scan") stats["Punter scans"] += 1;

    // ---- Systems Check
    if (SYSTEM_TASKS.has(task)) stats["Systems Check"] += 1;

    // ---- Target Breaches: Occurrence Type === "Target Report"
    if (occurrenceType === "target report") stats["Target Breaches"] += 1;
  }

  // All Breaches: no filter = all rows for officer
  stats["All Breaches"] = stats.Count;

  // Total (T): AR + BJ + RPK + PB/BACCARAT + GEN (TABLES)
  stats["Total (T)"] =
    stats.AR +
    stats.BJ +
    stats.RPK +
    stats["PB/BACCARAT"] +
    stats["GEN (TABLES)"];

  // Total: Cashiering + Count + Technical + Security + MVG + Slots + AR + BJ + RPK + PB/BACCARAT + GEN (TABLES)
  stats.Total =
    stats.Cashiering +
    stats.Count +
    stats.Technical +
    stats.Security +
    stats.MVG +
    stats.Slots +
    stats.AR +
    stats.BJ +
    stats.RPK +
    stats["PB/BACCARAT"] +
    stats["GEN (TABLES)"];

  return stats;
}

function sumStatsRows(rows, label) {
  const total = { Officer: label };
  for (const col of NUMERIC_COLUMNS) total[col] = 0;

  for (const r of rows) {
    for (const col of NUMERIC_COLUMNS) {
      const v = Number(r?.[col] ?? 0);
      total[col] += Number.isFinite(v) ? v : 0;
    }
  }
  return total;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function StatPill({ children, theme }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        theme === "dark"
          ? "border-white/10 bg-white/5 text-white/80"
          : "border-gray-300 bg-gray-100 text-gray-700"
      )}
    >
      {children}
    </span>
  );
}

function PrimaryButton({ className = "", theme, ...props }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40",
        theme === "dark" ? "bg-white text-black" : "bg-gray-900 text-white",
        className
      )}
    />
  );
}

function GhostButton({ className = "", theme, ...props }) {
  return (
    <button
      {...props}
      className={cx(
        "cursor-pointer inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40",
        theme === "dark"
          ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
          : "border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100",
        className
      )}
    />
  );
}

function Input({ className = "", theme, ...props }) {
  return (
    <input
      {...props}
      className={cx(
        "h-11 w-full rounded-xl border px-3 text-sm placeholder:text-gray-400 outline-none ring-0 transition focus:border-opacity-50",
        theme === "dark"
          ? "border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-white/20 focus:bg-white/10"
          : "border-gray-300 bg-white text-gray-900 focus:border-gray-400 focus:bg-white",
        className
      )}
    />
  );
}

function Select({ className = "", theme, ...props }) {
  return (
    <select
      {...props}
      className={cx(
        "h-11 w-full rounded-xl border px-3 text-sm outline-none transition focus:border-opacity-50 appearance-none",
        theme === "dark"
          ? "border-white/10 bg-white/5 text-white focus:border-white/20 focus:bg-white/10 [color-scheme:dark]"
          : "border-gray-300 bg-white text-gray-900 focus:border-gray-400 [color-scheme:light]",
        "[&>option]:bg-white [&>option]:text-gray-900 [&>optgroup]:bg-white [&>optgroup]:text-gray-900",
        className
      )}
    />
  );
}

// Theme Toggle Component
function ThemeToggle({ theme, toggleTheme }) {
  return (
    <button
      onClick={toggleTheme}
      className={cx(
        "relative flex h-10 w-20 items-center rounded-full p-1 transition-colors",
        theme === "dark" ? "bg-gray-700" : "bg-gray-300"
      )}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <div
        className={cx(
          "flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-transform",
          theme === "dark"
            ? "translate-x-10 bg-gray-900"
            : "translate-x-0 bg-yellow-400"
        )}
      >
        {theme === "dark" ? (
          <span className="text-white">🌙</span>
        ) : (
          <span className="text-gray-900">☀️</span>
        )}
      </div>
    </button>
  );
}

// Group shape: { id, name, role: "officer" | "manager", members: string[] }
export default function App() {
  const { CSVReader } = useCSVReader();
  const [searchQuery, setSearchQuery] = useState("");
  // Theme state
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      return saved || "dark";
    }
    return "dark";
  });

  // Quarterly datasets + active view
  const [datasets, setDatasets] = useState({ Jan: [], Feb: [], Mar: [] });
  const [activeView, setActiveView] = useState("Jan"); // Jan | Feb | Mar | Q1

  // People + grouping
  const [people, setPeople] = useState([]);
  const [checkedPeople, setCheckedPeople] = useState([]);

  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupRole, setNewGroupRole] = useState("officer");

  // Toggle theme
  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Save theme preference
  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.className = theme;
  }, [theme]);

  const quarterRows = useMemo(
    () => [...datasets.Jan, ...datasets.Feb, ...datasets.Mar],
    [datasets]
  );

  const activeRows = useMemo(() => {
    if (activeView === "Jan") return datasets.Jan;
    if (activeView === "Feb") return datasets.Feb;
    if (activeView === "Mar") return datasets.Mar;
    return quarterRows; // Q1
  }, [activeView, datasets, quarterRows]);

  const statsMap = useMemo(() => {
    const map = new Map();
    for (const name of people) {
      map.set(name, buildOfficerStats(activeRows, name));
    }
    return map;
  }, [activeRows, people]);

  // Map person -> groupId (ensures only 1 group per person)
  const personToGroup = useMemo(() => {
    const map = new Map();
    for (const g of groups) {
      for (const m of g.members) map.set(m, g.id);
    }
    return map;
  }, [groups]);

  function toggleChecked(name) {
    setCheckedPeople((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  }

  const groupedTableRows = useMemo(() => {
    const out = [];

    for (const g of groups) {
      if (g.members.length === 0) continue;

      out.push({
        type: "groupHeader",
        data: { Officer: `${g.name} (${g.role})` },
      });

      const memberRows = g.members
        .map((name) => statsMap.get(name))
        .filter(Boolean);

      for (const r of memberRows) out.push({ type: "row", data: r });

      out.push({
        type: "subtotal",
        data: sumStatsRows(memberRows, `${g.name} Totals`),
      });

      out.push({ type: "spacer" });
    }

    return out;
  }, [groups, statsMap]);

  function createGroup() {
    const name = clean(newGroupName);
    if (!name) return;

    const id = uid();
    const next = { id, name, role: newGroupRole, members: [] };

    setGroups((prev) => [...prev, next]);
    setSelectedGroupId(id); // auto-select new group
    setNewGroupName("");
  }

  // ✅ only 1 group per person: remove from all groups, then add to selected group
  function assignCheckedToGroup() {
    if (!selectedGroupId || checkedPeople.length === 0) return;

    setGroups((prev) => {
      const cleared = prev.map((g) => ({
        ...g,
        members: g.members.filter((m) => !checkedPeople.includes(m)),
      }));

      return cleared.map((g) => {
        if (g.id !== selectedGroupId) return g;
        const merged = Array.from(new Set([...g.members, ...checkedPeople]));
        return { ...g, members: merged };
      });
    });

    setCheckedPeople([]);
  }

  function clearGroup(groupId) {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, members: [] } : g))
    );
  }

  function deleteGroup(groupId) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setSelectedGroupId((cur) => (cur === groupId ? "" : cur));
  }

  function removeMember(groupId, member) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, members: g.members.filter((m) => m !== member) }
          : g
      )
    );
  }

  // Load a specific month, keep groups (don't reset them)
  function loadMonth(monthKey, results) {
    const parsed = Array.isArray(results?.data) ? results.data : [];

    setDatasets((prev) => {
      const next = { ...prev, [monthKey]: parsed };

      const all = [...next.Jan, ...next.Feb, ...next.Mar];

      const unique = Array.from(
        new Set(
          all
            .map((r) => normalizeOfficerName(r["Captured By"]))
            .filter((n) => n.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b));

      // update dependent state safely
      setPeople(unique);

      setGroups((prevGroups) =>
        prevGroups.map((g) => ({
          ...g,
          members: g.members.filter((m) => unique.includes(m)),
        }))
      );

      setCheckedPeople((prevChecks) =>
        prevChecks.filter((m) => unique.includes(m))
      );

      return next;
    });
  }

  function clearAll() {
    setDatasets({ Jan: [], Feb: [], Mar: [] });
    setActiveView("Jan");

    setPeople([]);
    setCheckedPeople([]);

    setGroups([]);
    setSelectedGroupId("");

    setNewGroupName("");
    setNewGroupRole("officer");
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const monthCounts = useMemo(
    () => ({
      Jan: datasets.Jan.length,
      Feb: datasets.Feb.length,
      Mar: datasets.Mar.length,
      Q1: quarterRows.length,
    }),
    [datasets, quarterRows]
  );

  const themeClasses =
    theme === "dark" ? "bg-neutral-950 text-white" : "bg-gray-50 text-gray-900";

  const borderColor = theme === "dark" ? "border-white/10" : "border-gray-200";
  const bgColor = theme === "dark" ? "bg-white/5" : "bg-white";
  const subtleBg = theme === "dark" ? "bg-white/5" : "bg-gray-100";
  const headerBg = theme === "dark" ? "bg-neutral-950" : "bg-white";
  const tableHeaderBg = theme === "dark" ? "bg-neutral-950/90" : "bg-white/90";
  const stickyBg = theme === "dark" ? "bg-neutral-950/60" : "bg-white/60";

  // Add this filter function to filter people based on search
  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return people;

    const query = searchQuery.toLowerCase();
    return people.filter((name) => name.toLowerCase().includes(query));
  }, [people, searchQuery]);

  return (
    <div className={`min-h-screen ${themeClasses}`}>
      {/* Top chrome */}
      <div
        className={`sticky top-0 z-40 w-full border-b ${borderColor} ${headerBg}/80 backdrop-blur`}
      >
        <div className="mx-auto w-full max-w-7xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div
                className={`text-xs font-semibold tracking-widest ${
                  theme === "dark" ? "text-white/50" : "text-gray-500"
                }`}
              >
                SURVEILLANCE ANALYTICS
              </div>
              <div className="text-xl font-semibold tracking-tight">
                Officer Performance — Quarterly Loader
              </div>
              <div
                className={`mt-1 max-w-3xl text-sm ${
                  theme === "dark" ? "text-white/60" : "text-gray-600"
                }`}
              >
                Upload Jan/Feb/Mar CSVs and switch to <b>Q1</b> to view totals
                across all three months. Grouping works across every view.
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
              <GhostButton theme={theme} onClick={clearAll}>
                Clear All
              </GhostButton>
            </div>
          </div>

          {/* Upload row + view tabs */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CSVReader
                config={{ header: true, skipEmptyLines: true }}
                onUploadAccepted={(results) => loadMonth("Jan", results)}
              >
                {({ getRootProps }) => (
                  <GhostButton theme={theme} {...getRootProps()}>
                    Upload Jan{" "}
                    <span
                      className={
                        theme === "dark" ? "text-white/60" : "text-gray-500"
                      }
                    >
                      ({monthCounts.Jan})
                    </span>
                  </GhostButton>
                )}
              </CSVReader>

              <CSVReader
                config={{ header: true, skipEmptyLines: true }}
                onUploadAccepted={(results) => loadMonth("Feb", results)}
              >
                {({ getRootProps }) => (
                  <GhostButton theme={theme} {...getRootProps()}>
                    Upload Feb{" "}
                    <span
                      className={
                        theme === "dark" ? "text-white/60" : "text-gray-500"
                      }
                    >
                      ({monthCounts.Feb})
                    </span>
                  </GhostButton>
                )}
              </CSVReader>

              <CSVReader
                config={{ header: true, skipEmptyLines: true }}
                onUploadAccepted={(results) => loadMonth("Mar", results)}
              >
                {({ getRootProps }) => (
                  <GhostButton theme={theme} {...getRootProps()}>
                    Upload Mar{" "}
                    <span
                      className={
                        theme === "dark" ? "text-white/60" : "text-gray-500"
                      }
                    >
                      ({monthCounts.Mar})
                    </span>
                  </GhostButton>
                )}
              </CSVReader>
            </div>

            <div
              className={`inline-flex shrink-0 overflow-hidden rounded-2xl border ${borderColor} ${subtleBg} p-1`}
            >
              {["Jan", "Feb", "Mar", "Q1"].map((v) => {
                const active = activeView === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setActiveView(v)}
                    className={cx(
                      "rounded-xl px-4 py-2 text-sm font-semibold transition",
                      active
                        ? theme === "dark"
                          ? "bg-white text-black shadow-sm"
                          : "bg-gray-900 text-white shadow-sm"
                        : theme === "dark"
                        ? "text-white/70 hover:text-white"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    {v}
                    <span
                      className={cx(
                        "ml-2 text-xs",
                        active
                          ? theme === "dark"
                            ? "text-black/60"
                            : "text-white/60"
                          : theme === "dark"
                          ? "text-white/40"
                          : "text-gray-400"
                      )}
                    >
                      {monthCounts[v]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main content (centered) */}
      <div className="w-full">
        <div className="mx-auto w-full container px-6 py-5">
          <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
            {/* LEFT: Groups */}
            <div
              className={`rounded-3xl border ${borderColor} ${bgColor} p-4 shadow-sm`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Groups</div>
                  <div
                    className={`mt-1 text-xs ${
                      theme === "dark" ? "text-white/60" : "text-gray-600"
                    }`}
                  >
                    Unlimited groups. A person can be in <b>one</b> group only
                    (re-assigning moves them).
                  </div>
                </div>
                <StatPill theme={theme}>{people.length} people</StatPill>
              </div>

              {/* Create */}
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_110px]">
                <Input
                  theme={theme}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder='e.g. "Shift 1" / "Managers"'
                />
                <Select
                  theme={theme}
                  value={newGroupRole}
                  onChange={(e) => setNewGroupRole(e.target.value)}
                >
                  <option value="officer">officer</option>
                  <option value="manager">manager</option>
                </Select>
                <PrimaryButton theme={theme} onClick={createGroup}>
                  Add
                </PrimaryButton>
              </div>

              {/* Assign */}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px]">
                <Select
                  theme={theme}
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                >
                  <option value="">Select group…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.role})
                    </option>
                  ))}
                </Select>
                <PrimaryButton
                  theme={theme}
                  onClick={assignCheckedToGroup}
                  disabled={!selectedGroupId || checkedPeople.length === 0}
                  title={
                    selectedGroup
                      ? `Assign to ${selectedGroup.name}`
                      : "Select a group first"
                  }
                >
                  Assign
                </PrimaryButton>
              </div>

              {/* Quick actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                <GhostButton
                  theme={theme}
                  onClick={() => setCheckedPeople(people)}
                  disabled={people.length === 0}
                >
                  Check all
                </GhostButton>
                <GhostButton
                  theme={theme}
                  onClick={() => setCheckedPeople([])}
                  disabled={people.length === 0}
                >
                  Clear checks
                </GhostButton>
              </div>

              {/* People list */}
              <div
                className={`mt-4 overflow-hidden rounded-2xl border ${borderColor}`}
              >
                <div
                  className={`flex items-center justify-between ${subtleBg} px-3 py-2`}
                >
                  <div
                    className={`text-xs font-semibold ${
                      theme === "dark" ? "text-white/70" : "text-gray-600"
                    }`}
                  >
                    People (Captured By)
                  </div>
                  <div
                    className={`text-xs ${
                      theme === "dark" ? "text-white/50" : "text-gray-500"
                    }`}
                  >
                    checked:{" "}
                    <b
                      className={
                        theme === "dark" ? "text-white/80" : "text-gray-700"
                      }
                    >
                      {checkedPeople.length}
                    </b>
                    {searchQuery && (
                      <span className="ml-2">
                        • showing {filteredPeople.length} of {people.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Search bar - Add this inside the div above the people list */}
                <div className={`border-b ${borderColor} px-3 py-2`}>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search people..."
                      className={`w-full rounded-lg border ${
                        theme === "dark"
                          ? "border-white/10 bg-white/5"
                          : "border-gray-300 bg-white"
                      } px-3 py-2 text-sm ${
                        theme === "dark"
                          ? "text-white placeholder:text-white/40"
                          : "text-gray-900 placeholder:text-gray-400"
                      } outline-none transition focus:border-opacity-50 ${
                        theme === "dark"
                          ? "focus:border-white/30"
                          : "focus:border-gray-400"
                      }`}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 ${
                          theme === "dark"
                            ? "text-white/60 hover:text-white"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                        aria-label="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className={`max-h-[320px] overflow-auto ${
                    theme === "dark" ? "bg-neutral-950/20" : "bg-gray-50/50"
                  } px-3 py-2`}
                >
                  {people.length === 0 ? (
                    <div
                      className={`py-6 text-center text-sm ${
                        theme === "dark" ? "text-white/50" : "text-gray-500"
                      }`}
                    >
                      Upload at least one month CSV to see names.
                    </div>
                  ) : filteredPeople.length === 0 ? (
                    <div
                      className={`py-6 text-center text-sm ${
                        theme === "dark" ? "text-white/50" : "text-gray-500"
                      }`}
                    >
                      No people found for "{searchQuery}"
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredPeople.map((name) => {
                        const checked = checkedPeople.includes(name);
                        const groupId = personToGroup.get(name);
                        return (
                          <label
                            key={name}
                            className={cx(
                              "flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition",
                              theme === "dark"
                                ? "hover:bg-white/5"
                                : "hover:bg-gray-100",
                              groupId ? "opacity-80" : ""
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleChecked(name)}
                              className={cx(
                                "h-4 w-4 rounded focus:ring-0",
                                theme === "dark"
                                  ? "border-white/20 bg-white/10 text-white"
                                  : "border-gray-300 bg-white text-gray-900"
                              )}
                            />
                            <span
                              className={`flex-1 truncate text-sm ${
                                theme === "dark"
                                  ? "text-white/90"
                                  : "text-gray-900"
                              }`}
                            >
                              {name}
                            </span>
                            {groupId && (
                              <StatPill theme={theme}>assigned</StatPill>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Groups list */}
              <div className="mt-4 space-y-3">
                {groups.map((g) => (
                  <div
                    key={g.id}
                    className={`rounded-2xl border ${borderColor} ${bgColor} p-3`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {g.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatPill theme={theme}>
                            {g.role} • {g.members.length}
                          </StatPill>
                          {selectedGroupId === g.id && (
                            <StatPill theme={theme}>selected</StatPill>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <GhostButton
                          theme={theme}
                          onClick={() => clearGroup(g.id)}
                          disabled={g.members.length === 0}
                          className="px-3 py-2"
                        >
                          Clear
                        </GhostButton>
                        <GhostButton
                          theme={theme}
                          onClick={() => deleteGroup(g.id)}
                          className="px-3 py-2"
                        >
                          Delete
                        </GhostButton>
                      </div>
                    </div>

                    {g.members.length === 0 ? (
                      <div
                        className={`mt-3 text-xs ${
                          theme === "dark" ? "text-white/50" : "text-gray-500"
                        }`}
                      >
                        No members.
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {g.members.map((m) => (
                          <div
                            key={m}
                            className={`flex items-center justify-between gap-2 rounded-xl border ${borderColor} ${
                              theme === "dark"
                                ? "bg-neutral-950/20"
                                : "bg-gray-50"
                            } px-3 py-2`}
                          >
                            <div
                              className={`min-w-0 truncate text-sm ${
                                theme === "dark"
                                  ? "text-white/85"
                                  : "text-gray-800"
                              }`}
                            >
                              {m}
                            </div>
                            <GhostButton
                              theme={theme}
                              onClick={() => removeMember(g.id, m)}
                              className="px-3 py-2"
                            >
                              Remove
                            </GhostButton>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {groups.length === 0 && (
                  <div
                    className={`rounded-2xl border border-dashed ${
                      theme === "dark" ? "border-white/15" : "border-gray-300"
                    } ${bgColor} p-4 text-sm ${
                      theme === "dark" ? "text-white/60" : "text-gray-600"
                    }`}
                  >
                    Create a group above, then check people and click{" "}
                    <b>Assign</b>.
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Table */}
            <div
              className={`rounded-3xl border ${borderColor} ${bgColor} p-4 shadow-sm`}
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    Summary Table{" "}
                    <span
                      className={
                        theme === "dark" ? "text-white/60" : "text-gray-600"
                      }
                    >
                      ({activeView})
                    </span>
                  </div>
                  <div
                    className={`mt-1 text-xs ${
                      theme === "dark" ? "text-white/60" : "text-gray-600"
                    }`}
                  >
                    Table shows your groups, each member, then a totals row
                    (like your Excel).
                  </div>
                </div>
                <StatPill theme={theme}>
                  {activeRows.length} active rows
                </StatPill>
              </div>

              <div
                className={`mt-4 overflow-hidden rounded-2xl border ${borderColor}`}
              >
                <div className="overflow-auto">
                  <table className="w-full min-w-[1350px] border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        {TABLE_COLUMNS.map((c, idx) => (
                          <th
                            key={c}
                            className={cx(
                              "sticky top-0 backdrop-blur px-3 py-3 text-left text-xs font-semibold tracking-wide border-b",
                              theme === "dark"
                                ? "bg-neutral-950/90 text-white/70 border-white/10"
                                : "bg-white/90 text-gray-700 border-gray-200",
                              idx === 0 ? "left-0 z-20" : "z-10"
                            )}
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {groupedTableRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={TABLE_COLUMNS.length}
                            className={`px-3 py-8 text-center text-sm ${
                              theme === "dark"
                                ? "text-white/50"
                                : "text-gray-500"
                            }`}
                          >
                            Create a group, assign people, and the table will
                            appear here.
                          </td>
                        </tr>
                      ) : (
                        groupedTableRows.map((item, idx) => {
                          if (item.type === "spacer") {
                            return (
                              <tr key={`sp-${idx}`}>
                                <td
                                  colSpan={TABLE_COLUMNS.length}
                                  className="h-3"
                                />
                              </tr>
                            );
                          }

                          if (item.type === "groupHeader") {
                            return (
                              <tr key={`gh-${idx}`}>
                                <td
                                  colSpan={TABLE_COLUMNS.length}
                                  className={`border-y ${
                                    theme === "dark"
                                      ? "border-white/10 bg-white/5"
                                      : "border-gray-200 bg-gray-100"
                                  } px-3 py-3 text-sm font-semibold ${
                                    theme === "dark"
                                      ? "text-white"
                                      : "text-gray-900"
                                  }`}
                                >
                                  {item.data.Officer}
                                </td>
                              </tr>
                            );
                          }

                          const row = item.data;
                          const isSubtotal = item.type === "subtotal";

                          return (
                            <tr
                              key={`${item.type}-${row.Officer}-${idx}`}
                              className={cx(
                                theme === "dark"
                                  ? "border-white/5"
                                  : "border-gray-200",
                                isSubtotal
                                  ? theme === "dark"
                                    ? "bg-white/5"
                                    : "bg-gray-100"
                                  : `transition ${
                                      theme === "dark"
                                        ? "hover:bg-white/5"
                                        : "hover:bg-gray-50"
                                    }`
                              )}
                            >
                              {TABLE_COLUMNS.map((c, colIdx) => (
                                <td
                                  key={c}
                                  className={cx(
                                    "px-3 py-3 text-sm border-b",
                                    theme === "dark"
                                      ? `text-white/85 ${
                                          isSubtotal
                                            ? "font-semibold text-white"
                                            : ""
                                        }`
                                      : `text-gray-800 ${
                                          isSubtotal
                                            ? "font-semibold text-gray-900"
                                            : ""
                                        }`,
                                    colIdx === 0
                                      ? `sticky left-0 z-[5] backdrop-blur ${
                                          theme === "dark"
                                            ? "bg-neutral-950/60"
                                            : "bg-white/60"
                                        } ${
                                          theme === "dark"
                                            ? "border-white/5"
                                            : "border-gray-200"
                                        }`
                                      : theme === "dark"
                                      ? "border-white/5"
                                      : "border-gray-200"
                                  )}
                                >
                                  {row?.[c] ?? ""}
                                </td>
                              ))}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                className={`mt-4 rounded-2xl border ${borderColor} ${subtleBg} p-3 text-xs ${
                  theme === "dark" ? "text-white/60" : "text-gray-600"
                }`}
              >
                Tip: Switch to <b>Q1</b> after uploading Jan/Feb/Mar to see
                combined totals. Re-assigning a person moves them so they're
                only ever in 1 group.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
