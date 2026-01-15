import React, { useMemo, useState, useEffect } from "react";
import { useCSVReader } from "react-papaparse";
import * as XLSX from "xlsx-js-style";

const DEFAULT_COLUMN_DEFS = [
  {
    id: "cashiering",
    label: "Cashiering",
    type: "count",
    match: "all",
    conditions: [
      { id: "cashiering-1", field: "Department", op: "equals", value: "cashiering" },
    ],
  },
  {
    id: "count",
    label: "Count",
    type: "count",
    match: "all",
    conditions: [],
  },
  {
    id: "technical",
    label: "Technical",
    type: "count",
    match: "all",
    conditions: [
      { id: "technical-1", field: "Department", op: "equals", value: "technical" },
    ],
  },
  {
    id: "security",
    label: "Security",
    type: "count",
    match: "all",
    conditions: [
      { id: "security-1", field: "Department", op: "equals", value: "security" },
    ],
  },
  {
    id: "mvg",
    label: "MVG",
    type: "count",
    match: "all",
    conditions: [{ id: "mvg-1", field: "Department", op: "equals", value: "mvg" }],
  },
  {
    id: "slots",
    label: "Slots",
    type: "count",
    match: "all",
    conditions: [{ id: "slots-1", field: "Department", op: "equals", value: "slots" }],
  },
  {
    id: "ar",
    label: "AR",
    type: "count",
    match: "all",
    conditions: [
      { id: "ar-1", field: "Department", op: "equals", value: "tables" },
      { id: "ar-2", field: "Station", op: "contains", value: "ar" },
    ],
  },
  {
    id: "bj",
    label: "BJ",
    type: "count",
    match: "all",
    conditions: [
      { id: "bj-1", field: "Department", op: "equals", value: "tables" },
      { id: "bj-2", field: "Station", op: "contains", value: "bj" },
    ],
  },
  {
    id: "rpk",
    label: "RPK",
    type: "count",
    match: "all",
    conditions: [
      { id: "rpk-1", field: "Department", op: "equals", value: "tables" },
      { id: "rpk-2", field: "Station", op: "contains", value: "pk" },
    ],
  },
  {
    id: "pb-baccarat",
    label: "PB/BACCARAT",
    type: "count",
    match: "all",
    conditions: [
      { id: "pb-1", field: "Department", op: "equals", value: "tables" },
      { id: "pb-2", field: "Station", op: "containsAny", value: "pb, baccarat" },
    ],
  },
  {
    id: "gen-tables",
    label: "GEN (TABLES)",
    type: "count",
    match: "all",
    conditions: [
      { id: "gen-1", field: "Department", op: "equals", value: "tables" },
      { id: "gen-2", field: "Station", op: "isBlank", value: "" },
    ],
  },
  {
    id: "total-t",
    label: "Total (T)",
    type: "sum",
    sourceIds: ["ar", "bj", "rpk", "pb-baccarat", "gen-tables"],
    highlight: true,
  },
  {
    id: "total",
    label: "Total",
    type: "sum",
    sourceIds: [
      "cashiering",
      "count",
      "technical",
      "security",
      "mvg",
      "slots",
      "ar",
      "bj",
      "rpk",
      "pb-baccarat",
      "gen-tables",
    ],
    highlight: true,
  },
  {
    id: "detections",
    label: "Detections",
    type: "count",
    match: "all",
    conditions: [
      { id: "detections-1", field: "Detection", op: "equals", value: "yes" },
    ],
  },
  {
    id: "punter-scans",
    label: "Punter scans",
    type: "count",
    match: "all",
    conditions: [
      {
        id: "punter-1",
        field: "Occurrence Task",
        op: "equals",
        value: "punter scan",
      },
    ],
  },
  {
    id: "systems-check",
    label: "Systems Check",
    type: "count",
    match: "all",
    conditions: [
      {
        id: "systems-1",
        field: "Occurrence Task",
        op: "equalsAny",
        value: "alarm test, camera fault logged, early warning test, armed robbery practice",
      },
    ],
  },
  {
    id: "target-breaches",
    label: "Target Breaches",
    type: "count",
    match: "all",
    conditions: [
      {
        id: "target-1",
        field: "Occurrence Type",
        op: "equals",
        value: "target report",
      },
    ],
  },
  {
    id: "all-breaches",
    label: "All Breaches",
    type: "count",
    match: "all",
    conditions: [],
  },
];

const OPERATOR_OPTIONS = [
  { value: "equals", label: "Equals" },
  { value: "contains", label: "Contains" },
  { value: "startsWith", label: "Starts with" },
  { value: "equalsAny", label: "Equals any (comma)" },
  { value: "containsAny", label: "Contains any (comma)" },
  { value: "startsWithAny", label: "Starts with any (comma)" },
  { value: "isBlank", label: "Is blank" },
];

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

function splitList(value) {
  return clean(value)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function evaluateCondition(row, condition) {
  const raw = row?.[condition.field];
  const value = lower(raw);
  const needle = lower(condition.value);

  if (condition.op === "isBlank") return isBlank(raw);
  if (condition.op === "equals") return value === needle;
  if (condition.op === "contains") return value.includes(needle);
  if (condition.op === "startsWith") return value.startsWith(needle);

  if (condition.op === "equalsAny") {
    const list = splitList(condition.value);
    return list.some((item) => value === lower(item));
  }

  if (condition.op === "containsAny") {
    const list = splitList(condition.value);
    return list.some((item) => value.includes(lower(item)));
  }

  if (condition.op === "startsWithAny") {
    const list = splitList(condition.value);
    return list.some((item) => value.startsWith(lower(item)));
  }

  return false;
}

function matchesRule(row, columnDef) {
  const conditions = Array.isArray(columnDef.conditions)
    ? columnDef.conditions
    : [];

  if (conditions.length === 0) return true;

  const results = conditions.map((condition) =>
    evaluateCondition(row, condition)
  );

  return columnDef.match === "any"
    ? results.some(Boolean)
    : results.every(Boolean);
}

function buildOfficerStats(rows, officerName, columnDefs) {
  const stats = { Officer: officerName };
  const officerRows = rows.filter(
    (r) => normalizeOfficerName(r["Captured By"]) === officerName
  );

  for (const col of columnDefs) stats[col.label] = 0;

  for (const col of columnDefs) {
    if (col.type !== "count") continue;
    let count = 0;
    for (const r of officerRows) {
      if (matchesRule(r, col)) count += 1;
    }
    stats[col.label] = count;
  }

  const labelById = new Map(columnDefs.map((col) => [col.id, col.label]));
  for (const col of columnDefs) {
    if (col.type !== "sum") continue;
    const sources = Array.isArray(col.sourceIds) ? col.sourceIds : [];
    let total = 0;
    for (const id of sources) {
      const label = labelById.get(id);
      total += Number(stats?.[label] ?? 0);
    }
    stats[col.label] = total;
  }

  return stats;
}

function sumStatsRows(rows, label, numericColumns) {
  const total = { Officer: label };
  for (const col of numericColumns) total[col] = 0;

  for (const r of rows) {
    for (const col of numericColumns) {
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

// Quarter configuration - can be easily changed
const QUARTER_CONFIG = {
  months: ["Month 1", "Month 2", "Month 3"], // Generic month names
  quarterName: "Quarter", // Default quarter name
};

// Group shape: { id, name, role: "officer" | "manager", members: string[] }
export default function App() {
  const { CSVReader } = useCSVReader();
  const [searchQuery, setSearchQuery] = useState("");

  // Quarter configuration state - can be customized by user
  const [quarterConfig, setQuarterConfig] = useState(QUARTER_CONFIG);

  const [columnDefs, setColumnDefs] = useState(DEFAULT_COLUMN_DEFS);

  // Theme state
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      return saved || "dark";
    }
    return "dark";
  });

  // Quarterly datasets + active view
  const [datasets, setDatasets] = useState(() => {
    const initial = {};
    quarterConfig.months.forEach((month) => {
      initial[month] = [];
    });
    return initial;
  });
  const [activeView, setActiveView] = useState(quarterConfig.months[0]); // Month 1 | Month 2 | Month 3 | Quarter

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

  // Calculate all rows for the quarter
  const quarterRows = useMemo(() => {
    return quarterConfig.months.flatMap((month) => datasets[month] || []);
  }, [datasets, quarterConfig.months]);

  const activeRows = useMemo(() => {
    if (activeView === quarterConfig.quarterName) return quarterRows;
    return datasets[activeView] || [];
  }, [activeView, datasets, quarterRows, quarterConfig.quarterName]);

  const tableColumns = useMemo(
    () => ["Officer", ...columnDefs.map((col) => col.label)],
    [columnDefs]
  );

  const numericColumns = useMemo(
    () => tableColumns.filter((col) => col !== "Officer"),
    [tableColumns]
  );

  const availableFields = useMemo(() => {
    const fieldSet = new Set();
    for (const row of quarterRows) {
      Object.keys(row || {}).forEach((key) => {
        if (clean(key)) fieldSet.add(key);
      });
    }

    const fields = Array.from(fieldSet).sort((a, b) =>
      a.localeCompare(b)
    );

    if (fields.length > 0) return fields;

    return [
      "Captured By",
      "Department",
      "Occurrence Task",
      "Occurrence Type",
      "Station",
      "Detection",
    ];
  }, [quarterRows]);

  const statsMap = useMemo(() => {
    const map = new Map();
    for (const name of people) {
      map.set(name, buildOfficerStats(activeRows, name, columnDefs));
    }
    return map;
  }, [activeRows, people, columnDefs]);

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
        data: sumStatsRows(memberRows, `${g.name} Totals`, numericColumns),
      });

      out.push({ type: "spacer" });
    }

    return out;
  }, [groups, statsMap, numericColumns]);

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

  function resetColumns() {
    setColumnDefs(DEFAULT_COLUMN_DEFS);
  }

  function addColumn() {
    setColumnDefs((prev) => [
      ...prev,
      {
        id: uid(),
        label: "New Column",
        type: "count",
        match: "all",
        conditions: [],
      },
    ]);
  }

  function updateColumn(columnId, updater) {
    setColumnDefs((prev) =>
      prev.map((col) => (col.id === columnId ? updater(col) : col))
    );
  }

  function removeColumn(columnId) {
    setColumnDefs((prev) =>
      prev
        .filter((col) => col.id !== columnId)
        .map((col) =>
          col.type === "sum"
            ? {
                ...col,
                sourceIds: (col.sourceIds || []).filter(
                  (id) => id !== columnId
                ),
              }
            : col
        )
    );
  }

  function addCondition(columnId) {
    const fallbackField = availableFields[0] || "Department";
    updateColumn(columnId, (col) => ({
      ...col,
      conditions: [
        ...(col.conditions || []),
        {
          id: uid(),
          field: fallbackField,
          op: "equals",
          value: "",
        },
      ],
    }));
  }

  function updateCondition(columnId, conditionId, updater) {
    updateColumn(columnId, (col) => ({
      ...col,
      conditions: (col.conditions || []).map((condition) =>
        condition.id === conditionId ? updater(condition) : condition
      ),
    }));
  }

  function removeCondition(columnId, conditionId) {
    updateColumn(columnId, (col) => ({
      ...col,
      conditions: (col.conditions || []).filter(
        (condition) => condition.id !== conditionId
      ),
    }));
  }

  function toggleSourceId(columnId, sourceId) {
    updateColumn(columnId, (col) => {
      const current = new Set(col.sourceIds || []);
      if (current.has(sourceId)) current.delete(sourceId);
      else current.add(sourceId);
      return { ...col, sourceIds: Array.from(current) };
    });
  }

  // Load a specific month, keep groups (don't reset them)
  function loadMonth(monthKey, results) {
    const parsed = Array.isArray(results?.data) ? results.data : [];

    setDatasets((prev) => {
      const next = { ...prev, [monthKey]: parsed };

      // Combine all months to get unique people
      const all = quarterConfig.months.flatMap((month) => next[month] || []);

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
    const emptyDatasets = {};
    quarterConfig.months.forEach((month) => {
      emptyDatasets[month] = [];
    });

    setDatasets(emptyDatasets);
    setActiveView(quarterConfig.months[0]);

    setPeople([]);
    setCheckedPeople([]);

    setGroups([]);
    setSelectedGroupId("");

    setNewGroupName("");
    setNewGroupRole("officer");
  }

  // ========== EXPORT TO EXCEL (MATCHES YOUR SCREENSHOT STYLING) ==========
  function exportToExcel() {
    if (groups.length === 0) {
      alert("Please create at least one group with members before exporting.");
      return;
    }

    const wb = XLSX.utils.book_new();
    const exportDate = new Date().toLocaleString();
    const highlightSet = new Set(
      columnDefs.filter((col) => col.highlight).map((col) => col.label)
    );

    const BORDER = {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    };

    const isAllBlankRow = (row) =>
      !row || row.every((v) => String(v ?? "").trim() === "");

    const addFormattedSheet = (sheetData, sheetName) => {
      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      ws["!cols"] = tableColumns.map((col, idx) => {
        if (idx === 0) return { wch: 30 };
        const width = Math.min(22, Math.max(10, col.length + 2));
        return { wch: width };
      });

      // Find table header row
      const headerRowIndex = sheetData.findIndex(
        (r) => r && r[0] === "Officer" && r.length === tableColumns.length
      );
      const tableStartRow = headerRowIndex;

      // Find last meaningful table row
      let tableEndRow = sheetData.length - 1;
      while (tableEndRow >= 0 && isAllBlankRow(sheetData[tableEndRow])) {
        tableEndRow -= 1;
      }

      const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");

      for (let R = range.s.r; R <= range.e.r; R++) {
        // ✅ Detect totals row ONCE per row (by checking column A label)
        const labelCellRef = XLSX.utils.encode_cell({ c: 0, r: R });
        const rowLabel = String(ws[labelCellRef]?.v ?? "");
        const inTable = R >= tableStartRow && R <= tableEndRow;
        const isHeader = inTable && R === headerRowIndex;
        const isTotalsRow = inTable && rowLabel.includes("Totals");

        for (let C = range.s.c; C <= range.e.c; C++) {
          const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
          if (!ws[cellRef]) continue;

          const value = ws[cellRef].v;
          const isTotalColumn = highlightSet.has(tableColumns[C]);

          // ---- BASE STYLE
          const style = {
            font: { sz: 11, bold: false, color: { rgb: "000000" } },
            alignment: {
              vertical: "center",
              horizontal: C === 0 ? "left" : "center",
              wrapText: true,
            },
          };

          // Borders for whole table area
          if (inTable) style.border = BORDER;

          // ---- COLUMN HEADERS (bold)
          if (isHeader) {
            style.font = { sz: 11, bold: true, color: { rgb: "000000" } };
            style.fill = { fgColor: { rgb: "F2F2F2" }, patternType: "solid" };
            style.alignment = {
              vertical: "center",
              horizontal: "center",
              wrapText: true,
            };
          }

          // ---- TOTAL (T) & TOTAL columns (keep as you said they're correct)
          if (inTable && isTotalColumn && R > headerRowIndex) {
            style.font = { ...(style.font || {}), bold: true };
            style.fill = { fgColor: { rgb: "D9D9D9" }, patternType: "solid" };
          }

          // ---- Numeric formatting
          if (inTable && typeof value === "number" && !isHeader) {
            style.numFmt = "0";
            style.alignment = { vertical: "center", horizontal: "center" };
          }

          // ---- Officer column left-aligned
          if (inTable && C === 0 && !isHeader) {
            style.alignment = { vertical: "center", horizontal: "left" };
          }

          // ✅ FINAL OVERRIDE: GROUP TOTALS ROW MUST BE GREY ACROSS ALL CELLS
          if (isTotalsRow) {
            style.font = { sz: 11, bold: true, color: { rgb: "000000" } };
            style.fill = { fgColor: { rgb: "D9D9D9" }, patternType: "solid" };
          }

          ws[cellRef].s = style;
        }
      }

      // Freeze panes
      ws["!freeze"] = {
        xSplit: 1,
        ySplit: Math.max(0, headerRowIndex + 1),
        topLeftCell: XLSX.utils.encode_cell({ c: 1, r: headerRowIndex + 1 }),
        activePane: "bottomRight",
      };

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    // ========== 1) QUARTER SUMMARY SHEET ==========
    const quarterlySheetData = [];
    quarterlySheetData.push(["Quarterly Performance Summary"]);
    quarterlySheetData.push([`Exported: ${exportDate}`]);
    quarterlySheetData.push([`Period: ${quarterConfig.quarterName}`]);
    quarterlySheetData.push([""]);
    quarterlySheetData.push(tableColumns);

    groupedTableRows.forEach((item) => {
      if (item.type === "spacer") {
        quarterlySheetData.push(Array(tableColumns.length).fill(""));
      } else if (item.type === "groupHeader") {
        return;
      } else {
        quarterlySheetData.push(
          tableColumns.map((col) => item.data[col] ?? "")
        );
      }
    });

    addFormattedSheet(
      quarterlySheetData,
      `${quarterConfig.quarterName} Summary`
    );

    // ========== 2) MONTH SHEETS ==========
    quarterConfig.months.forEach((month) => {
      if (!datasets[month] || datasets[month].length === 0) return;

      const monthStats = new Map();
      for (const name of people) {
        monthStats.set(
          name,
          buildOfficerStats(datasets[month], name, columnDefs)
        );
      }

      const monthSheetData = [];
      monthSheetData.push([`${month} Performance Summary`]);
      monthSheetData.push([`Exported: ${exportDate}`]);
      monthSheetData.push([""]);
      monthSheetData.push(tableColumns);

      groups.forEach((g) => {
        if (g.members.length === 0) return;

        const memberRows = g.members
          .map((name) => monthStats.get(name))
          .filter(Boolean);

        memberRows.forEach((row) => {
          monthSheetData.push(tableColumns.map((col) => row[col] ?? ""));
        });

        const subtotal = sumStatsRows(
          memberRows,
          `${g.name} Totals`,
          numericColumns
        );
        monthSheetData.push(tableColumns.map((col) => subtotal[col] ?? ""));

        monthSheetData.push(Array(tableColumns.length).fill(""));
      });

      addFormattedSheet(monthSheetData, month);
    });

    // ========== 3) RAW DATA SHEET ==========
    if (quarterRows.length > 0) {
      const rawDataSheetData = [];
      rawDataSheetData.push(["Raw Data - All Months Combined"]);
      rawDataSheetData.push([`Exported: ${exportDate}`]);
      rawDataSheetData.push([`Total Records: ${quarterRows.length}`]);
      rawDataSheetData.push([""]);

      const allHeaders = new Set();
      quarterRows.forEach((row) =>
        Object.keys(row).forEach((k) => allHeaders.add(k))
      );
      const headers = Array.from(allHeaders);

      rawDataSheetData.push(headers);
      quarterRows.forEach((row) => {
        rawDataSheetData.push(headers.map((h) => row[h] ?? ""));
      });

      const rawWs = XLSX.utils.aoa_to_sheet(rawDataSheetData);
      rawWs["!cols"] = headers.map(() => ({ wch: 22 }));

      const rawRange = XLSX.utils.decode_range(rawWs["!ref"] || "A1:A1");
      for (let R = rawRange.s.r; R <= rawRange.e.r; R++) {
        for (let C = rawRange.s.c; C <= rawRange.e.c; C++) {
          const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
          if (!rawWs[cellRef]) continue;

          const style = {
            font: { sz: 10, bold: false, color: { rgb: "000000" } },
            alignment: { vertical: "center", wrapText: true },
          };

          if (R === 0)
            style.font = { sz: 14, bold: true, color: { rgb: "000000" } };
          if (R === 1 || R === 2)
            style.font = { sz: 9, italic: true, color: { rgb: "555555" } };

          if (R === 4) {
            style.font = { sz: 10, bold: true, color: { rgb: "000000" } };
            style.fill = { fgColor: { rgb: "F2F2F2" }, patternType: "solid" };
            style.border = BORDER;
            style.alignment = {
              vertical: "center",
              horizontal: "center",
              wrapText: true,
            };
          } else if (R > 4) {
            style.border = BORDER;
          }

          rawWs[cellRef].s = style;
        }
      }

      rawWs["!freeze"] = {
        xSplit: 0,
        ySplit: 5,
        topLeftCell: "A6",
        activePane: "bottomRight",
      };

      XLSX.utils.book_append_sheet(wb, rawWs, "Raw Data");
    }

    const fileName = `Surveillance_Analytics_${
      quarterConfig.quarterName
    }_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const monthCounts = useMemo(() => {
    const counts = {};
    quarterConfig.months.forEach((month) => {
      counts[month] = datasets[month]?.length || 0;
    });
    counts[quarterConfig.quarterName] = quarterRows.length;
    return counts;
  }, [datasets, quarterRows, quarterConfig]);

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
                Officer Performance — {quarterConfig.quarterName} Loader
              </div>
              <div
                className={`mt-1 max-w-3xl text-sm ${
                  theme === "dark" ? "text-white/60" : "text-gray-600"
                }`}
              >
                Upload {quarterConfig.months.join("/")} CSVs and switch to{" "}
                <b>{quarterConfig.quarterName}</b> to view totals across all
                months. Grouping works across every view.
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
              <GhostButton theme={theme} onClick={clearAll}>
                Clear All
              </GhostButton>
              <PrimaryButton
                theme={theme}
                onClick={exportToExcel}
                disabled={groups.length === 0}
                title={
                  groups.length === 0
                    ? "Create groups first"
                    : "Export to Excel"
                }
              >
                Export to Excel
              </PrimaryButton>
            </div>
          </div>

          {/* Upload row + view tabs */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {quarterConfig.months.map((month) => (
                <CSVReader
                  key={month}
                  config={{ header: true, skipEmptyLines: true }}
                  onUploadAccepted={(results) => loadMonth(month, results)}
                >
                  {({ getRootProps }) => (
                    <GhostButton theme={theme} {...getRootProps()}>
                      Upload {month}{" "}
                      <span
                        className={
                          theme === "dark" ? "text-white/60" : "text-gray-500"
                        }
                      >
                        ({monthCounts[month]})
                      </span>
                    </GhostButton>
                  )}
                </CSVReader>
              ))}
            </div>

            <div
              className={`inline-flex shrink-0 overflow-hidden rounded-2xl border ${borderColor} ${subtleBg} p-1`}
            >
              {[...quarterConfig.months, quarterConfig.quarterName].map((v) => {
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Column Rules</div>
                  <div
                    className={`mt-1 text-xs ${
                      theme === "dark" ? "text-white/60" : "text-gray-600"
                    }`}
                  >
                    Rules apply per month. Quarter view sums all months.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <GhostButton theme={theme} onClick={resetColumns}>
                    Reset
                  </GhostButton>
                  <PrimaryButton theme={theme} onClick={addColumn}>
                    Add column
                  </PrimaryButton>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {columnDefs.map((col) => (
                  <div
                    key={col.id}
                    className={`rounded-2xl border ${borderColor} ${subtleBg} p-3`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-[180px] flex-1">
                        <Input
                          theme={theme}
                          value={col.label}
                          onChange={(e) =>
                            updateColumn(col.id, (current) => ({
                              ...current,
                              label: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (!clean(e.target.value)) {
                              updateColumn(col.id, (current) => ({
                                ...current,
                                label: "Column",
                              }));
                            }
                          }}
                          placeholder="Column name"
                        />
                      </div>
                      <div className="min-w-[120px]">
                        <Select
                          theme={theme}
                          value={col.type}
                          onChange={(e) => {
                            const nextType = e.target.value;
                            updateColumn(col.id, (current) => {
                              if (nextType === "sum") {
                                return {
                                  ...current,
                                  type: "sum",
                                  sourceIds: current.sourceIds || [],
                                  conditions: [],
                                  match: "all",
                                };
                              }
                              return {
                                ...current,
                                type: "count",
                                match: current.match || "all",
                                conditions: current.conditions || [],
                                sourceIds: [],
                              };
                            });
                          }}
                        >
                          <option value="count">count</option>
                          <option value="sum">sum</option>
                        </Select>
                      </div>
                      <label
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                          theme === "dark"
                            ? "border-white/10 text-white/70"
                            : "border-gray-300 text-gray-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(col.highlight)}
                          onChange={(e) =>
                            updateColumn(col.id, (current) => ({
                              ...current,
                              highlight: e.target.checked,
                            }))
                          }
                          className={cx(
                            "h-4 w-4 rounded focus:ring-0",
                            theme === "dark"
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-gray-300 bg-white text-gray-900"
                          )}
                        />
                        highlight
                      </label>
                      <GhostButton
                        theme={theme}
                        onClick={() => removeColumn(col.id)}
                        className="px-3 py-2"
                      >
                        Remove
                      </GhostButton>
                    </div>

                    {col.type === "count" ? (
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div
                            className={`text-xs ${
                              theme === "dark"
                                ? "text-white/60"
                                : "text-gray-600"
                            }`}
                          >
                            Match
                          </div>
                          <div className="min-w-[120px]">
                            <Select
                              theme={theme}
                              value={col.match || "all"}
                              onChange={(e) =>
                                updateColumn(col.id, (current) => ({
                                  ...current,
                                  match: e.target.value,
                                }))
                              }
                            >
                              <option value="all">all conditions</option>
                              <option value="any">any condition</option>
                            </Select>
                          </div>
                          <GhostButton
                            theme={theme}
                            onClick={() => addCondition(col.id)}
                            className="px-3 py-2"
                          >
                            Add condition
                          </GhostButton>
                        </div>

                        {(col.conditions || []).length === 0 ? (
                          <div
                            className={`rounded-xl border px-3 py-2 text-xs ${
                              theme === "dark"
                                ? "border-white/10 text-white/50"
                                : "border-gray-300 text-gray-500"
                            }`}
                          >
                            No conditions means count all rows for the officer.
                          </div>
                        ) : (
                          (col.conditions || []).map((condition) => (
                            <div
                              key={condition.id}
                              className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto]"
                            >
                              <Select
                                theme={theme}
                                value={condition.field}
                                onChange={(e) =>
                                  updateCondition(col.id, condition.id, (cur) => ({
                                    ...cur,
                                    field: e.target.value,
                                  }))
                                }
                              >
                                {availableFields.map((field) => (
                                  <option key={field} value={field}>
                                    {field}
                                  </option>
                                ))}
                              </Select>
                              <Select
                                theme={theme}
                                value={condition.op}
                                onChange={(e) =>
                                  updateCondition(col.id, condition.id, (cur) => ({
                                    ...cur,
                                    op: e.target.value,
                                  }))
                                }
                              >
                                {OPERATOR_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                              <Input
                                theme={theme}
                                value={condition.value}
                                onChange={(e) =>
                                  updateCondition(col.id, condition.id, (cur) => ({
                                    ...cur,
                                    value: e.target.value,
                                  }))
                                }
                                disabled={condition.op === "isBlank"}
                                placeholder={
                                  condition.op === "isBlank"
                                    ? "No value"
                                    : "Value"
                                }
                              />
                              <GhostButton
                                theme={theme}
                                onClick={() =>
                                  removeCondition(col.id, condition.id)
                                }
                                className="px-3 py-2"
                              >
                                Remove
                              </GhostButton>
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="mt-3">
                        <div
                          className={`text-xs ${
                            theme === "dark" ? "text-white/60" : "text-gray-600"
                          }`}
                        >
                          Sum these columns
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {columnDefs
                            .filter((source) => source.id !== col.id)
                            .map((source) => (
                              <label
                                key={source.id}
                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                                  theme === "dark"
                                    ? "border-white/10 text-white/70"
                                    : "border-gray-300 text-gray-600"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={(col.sourceIds || []).includes(
                                    source.id
                                  )}
                                  onChange={() =>
                                    toggleSourceId(col.id, source.id)
                                  }
                                  className={cx(
                                    "h-4 w-4 rounded focus:ring-0",
                                    theme === "dark"
                                      ? "border-white/20 bg-white/10 text-white"
                                      : "border-gray-300 bg-white text-gray-900"
                                  )}
                                />
                                {source.label}
                              </label>
                            ))}
                          {columnDefs.length <= 1 && (
                            <div
                              className={`text-xs ${
                                theme === "dark"
                                  ? "text-white/50"
                                  : "text-gray-500"
                              }`}
                            >
                              Add more columns to build a sum.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className={`mt-6 border-t ${borderColor} pt-4`}>
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

                {/* Search bar */}
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
                <div className="flex items-center gap-2">
                  <StatPill theme={theme}>
                    {activeRows.length} active rows
                  </StatPill>
                  <PrimaryButton
                    theme={theme}
                    onClick={exportToExcel}
                    disabled={groups.length === 0}
                    className="text-xs px-3 py-1"
                    title={
                      groups.length === 0
                        ? "Create groups first"
                        : "Export to Excel"
                    }
                  >
                    Export Excel
                  </PrimaryButton>
                </div>
              </div>

              <div
                className={`mt-4 overflow-hidden rounded-2xl border ${borderColor}`}
              >
                <div className="overflow-auto">
                  <table className="w-full min-w-[1350px] border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        {tableColumns.map((c, idx) => (
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
                            colSpan={tableColumns.length}
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
                                  colSpan={tableColumns.length}
                                  className="h-3"
                                />
                              </tr>
                            );
                          }

                          if (item.type === "groupHeader") {
                            return (
                              <tr key={`gh-${idx}`}>
                                <td
                                  colSpan={tableColumns.length}
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
                              {tableColumns.map((c, colIdx) => (
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
                <div className="flex items-center justify-between">
                  <div>
                    Tip: Switch to <b>{quarterConfig.quarterName}</b> after
                    uploading all months to see combined totals. Re-assigning a
                    person moves them so they're only ever in 1 group.
                  </div>
                  <PrimaryButton
                    theme={theme}
                    onClick={exportToExcel}
                    disabled={groups.length === 0}
                    className="text-xs px-3 py-1"
                    title={
                      groups.length === 0
                        ? "Create groups first"
                        : "Export to Excel"
                    }
                  >
                    Export to Excel
                  </PrimaryButton>
                </div>
                <div className="mt-2 text-xs opacity-75">
                  Excel export includes: {quarterConfig.quarterName} Summary,{" "}
                  {quarterConfig.months.join(", ")} sheets, and Raw Data.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
