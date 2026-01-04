import React, { useMemo, useState, useEffect } from "react";
import { useCSVReader } from "react-papaparse";
import * as XLSX from "xlsx-js-style";

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

    const TOTAL_T_COL = TABLE_COLUMNS.indexOf("Total (T)");
    const TOTAL_COL = TABLE_COLUMNS.indexOf("Total");

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

      ws["!cols"] = [
        { wch: 30 }, // Officer
        { wch: 12 }, // Cashiering
        { wch: 8 }, // Count
        { wch: 12 }, // Technical
        { wch: 12 }, // Security
        { wch: 8 }, // MVG
        { wch: 8 }, // Slots
        { wch: 8 }, // AR
        { wch: 8 }, // BJ
        { wch: 8 }, // RPK
        { wch: 15 }, // PB/BACCARAT
        { wch: 15 }, // GEN (TABLES)
        { wch: 12 }, // Total (T)
        { wch: 10 }, // Total
        { wch: 12 }, // Detections
        { wch: 12 }, // Punter scans
        { wch: 15 }, // Systems Check
        { wch: 15 }, // Target Breaches
        { wch: 12 }, // All Breaches
      ];

      // Find table header row
      const headerRowIndex = sheetData.findIndex(
        (r) => r && r[0] === "Officer" && r.length === TABLE_COLUMNS.length
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
          const isTotalColumn = C === TOTAL_T_COL || C === TOTAL_COL;

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
    quarterlySheetData.push(TABLE_COLUMNS);

    groupedTableRows.forEach((item) => {
      if (item.type === "spacer") {
        quarterlySheetData.push(Array(TABLE_COLUMNS.length).fill(""));
      } else if (item.type === "groupHeader") {
        return;
      } else {
        quarterlySheetData.push(
          TABLE_COLUMNS.map((col) => item.data[col] ?? "")
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
        monthStats.set(name, buildOfficerStats(datasets[month], name));
      }

      const monthSheetData = [];
      monthSheetData.push([`${month} Performance Summary`]);
      monthSheetData.push([`Exported: ${exportDate}`]);
      monthSheetData.push([""]);
      monthSheetData.push(TABLE_COLUMNS);

      groups.forEach((g) => {
        if (g.members.length === 0) return;

        const memberRows = g.members
          .map((name) => monthStats.get(name))
          .filter(Boolean);

        memberRows.forEach((row) => {
          monthSheetData.push(TABLE_COLUMNS.map((col) => row[col] ?? ""));
        });

        const subtotal = sumStatsRows(memberRows, `${g.name} Totals`);
        monthSheetData.push(TABLE_COLUMNS.map((col) => subtotal[col] ?? ""));

        monthSheetData.push(Array(TABLE_COLUMNS.length).fill(""));
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
