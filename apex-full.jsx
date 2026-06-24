import { useState, useEffect, useRef, useCallback } from "react";

// ─── PALETTE & CONSTANTS ──────────────────────────────────────────────────────
// These constants are used throughout and are also the targets for the App Editor
const PALETTE = {
  ACCENT:  "#00FFB2",
  ACCENT2: "#FF6B35",
  GOLD:    "#FFD700",
  BG:      "#080C10",
  CARD:    "#0D1117",
  CARD2:   "#111820",
  BORDER:  "#1E2A3A",
  TEXT:    "#E8F4FF",
  MUTED:   "#4A6080",
};

const TARGET_ZAR    = 10_000_000;
const TWO_YEARS_MS  = 2 * 365 * 24 * 60 * 60 * 1000;
const START_DATE    = new Date("2025-06-05");

// ─── THEME STATE (mutable by App Editor) ─────────────────────────────────────
// The App Editor patches this object at runtime and triggers a re-render
let _themeOverrides = {};
const getC = (key) => _themeOverrides[key] || PALETTE[key];

// ─── STORAGE (uses artifact persistent storage API) ───────────────────────────
const store = {
  get: async (k, d) => {
    try {
      const r = await window.storage.get(k);
      return r ? JSON.parse(r.value) : d;
    } catch { return d; }
  },
  set: async (k, v) => {
    try { await window.storage.set(k, JSON.stringify(v)); } catch {}
  },
};

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 18, color = "currentColor", style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d={d} />
  </svg>
);
const IC = {
  dashboard: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  tasks:     "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  ai:        "M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2M8 12h8M12 8v8",
  code:      "M10 20l4-16M14 6l6 6-6 6M4 18l-6-6 6-6", // actually ` < / > ` style
  goals:     "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  finance:   "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  bolt:      "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  send:      "M22 2L11 13 M22 2L15 22l-4-9-9-4 22-7z",
  plus:      "M12 5v14M5 12h14",
  trash:     "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  check:     "M20 6L9 17l-5-5",
  edit:      "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  filter:    "M22 3H2l8 9.46V19l4 2V12.46L22 3z",
  flag:      "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
  clock:     "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  chart:     "M18 20V10M12 20V4M6 20v-6",
  money:     "M2 17l10 5 10-5M2 12l10 5 10-5M2 7l10-5 10 5-10 5-10-5z",
  target:    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 22zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  brush:     "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L3 14.67 9.33 21l10.05-10.06a5.5 5.5 0 0 0 0-7.77 M8 8.5l7 7",
  tag:       "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  cpu:       "M18 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM9 9h6v6H9z",
  sparkle:   "M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5L5 3zM19 13l.5 1.5L21 15l-1.5.5L19 17l-.5-1.5L17 15l1.5-.5L19 13z",
  calendar:  "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
};

// ─── UTILITY: Call Anthropic API ──────────────────────────────────────────────
// API key is handled by the Claude.ai platform automatically — no key needed here.
async function callClaude(messages, systemPrompt, maxTokens = 1000) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });
  const data = await response.json();
  return (data.content || []).map(i => i.type === "text" ? i.text : "").join("\n").trim();
}

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────
function RadialProgress({ pct, size = 72, stroke = 6, color, label }) {
  const c = color || getC("ACCENT");
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 1));
  return (
    <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={getC("BORDER")} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div style={{ fontSize: size * 0.19, fontWeight: 800, color: c, fontFamily: "'Space Mono', monospace" }}>
          {Math.round(pct * 100)}%
        </div>
        {label && <div style={{ fontSize: size * 0.11, color: getC("MUTED") }}>{label}</div>}
      </div>
    </div>
  );
}

function Card({ children, accent, style: s = {}, onClick }) {
  const ac = accent || getC("ACCENT");
  return (
    <div onClick={onClick} style={{
      background: getC("CARD"), border: `1px solid ${getC("BORDER")}`,
      borderRadius: 16, padding: 20, position: "relative", overflow: "hidden",
      cursor: onClick ? "pointer" : undefined, ...s,
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${ac}, ${ac}00)` }} />
      {children}
    </div>
  );
}

function CardHeader({ icon, title, accent, children }) {
  const ac = accent || getC("ACCENT");
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${ac}18`,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon d={icon} size={14} color={ac} />
        </div>
        <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 12,
          color: getC("TEXT"), letterSpacing: 1.2 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Btn({ children, onClick, color, ghost, disabled, style: s = {}, size = "md" }) {
  const bg = color || getC("ACCENT");
  const pad = size === "sm" ? "5px 12px" : size === "lg" ? "12px 24px" : "8px 16px";
  const fs  = size === "sm" ? 11 : size === "lg" ? 15 : 13;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: ghost ? `${bg}15` : bg,
      color: ghost ? bg : getC("BG"),
      border: ghost ? `1px solid ${bg}50` : "none",
      borderRadius: 8, padding: pad, cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 700, fontSize: fs, opacity: disabled ? 0.5 : 1,
      display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.18s",
      fontFamily: "inherit", ...s,
    }}>{children}</button>
  );
}

function Badge({ label, color }) {
  const c = color || getC("ACCENT");
  return (
    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20,
      background: `${c}18`, color: c, fontWeight: 700, letterSpacing: 0.5 }}>{label}</span>
  );
}

function Input({ value, onChange, placeholder, onKeyDown, style: s = {}, multiline, rows = 2 }) {
  const base = {
    background: getC("CARD2"), border: `1px solid ${getC("BORDER")}`, borderRadius: 8,
    padding: "8px 12px", color: getC("TEXT"), fontSize: 13, outline: "none",
    fontFamily: "inherit", resize: "none", width: "100%", boxSizing: "border-box", ...s,
  };
  return multiline
    ? <textarea value={value} onChange={onChange} placeholder={placeholder}
        onKeyDown={onKeyDown} rows={rows} style={base} />
    : <input value={value} onChange={onChange} placeholder={placeholder}
        onKeyDown={onKeyDown} style={base} />;
}

// ─── PRIORITY CONFIG ──────────────────────────────────────────────────────────
const PRIORITY = {
  high:   { label: "High",   color: "#FF6B35" },
  medium: { label: "Medium", color: "#FFD700" },
  low:    { label: "Low",    color: "#60A5FA" },
};
const STATUS = {
  todo:        { label: "To Do",       color: "#4A6080" },
  in_progress: { label: "In Progress", color: "#FFD700" },
  done:        { label: "Done",        color: "#00FFB2" },
  blocked:     { label: "Blocked",     color: "#FF6B35" },
};

// ─── TASK MANAGER ─────────────────────────────────────────────────────────────
function TaskManager({ tasks, setTasks, onAiAction }) {
  const [filter, setFilter]     = useState("all");
  const [sortBy, setSortBy]     = useState("created");
  const [search, setSearch]     = useState("");
  const [editing, setEditing]   = useState(null); // task id being edited
  const [newTask, setNewTask]   = useState({
    title: "", description: "", priority: "medium", status: "todo",
    dueDate: "", tags: "",
  });
  const [showForm, setShowForm] = useState(false);

  const makeId = () => `task-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;

  const addTask = () => {
    if (!newTask.title.trim()) return;
    const task = {
      id: makeId(),
      title:       newTask.title.trim(),
      description: newTask.description.trim(),
      priority:    newTask.priority,
      status:      newTask.status,
      dueDate:     newTask.dueDate,
      tags:        newTask.tags.split(",").map(t => t.trim()).filter(Boolean),
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    };
    setTasks(t => [task, ...t]);
    setNewTask({ title: "", description: "", priority: "medium", status: "todo", dueDate: "", tags: "" });
    setShowForm(false);
  };

  const updateTask = (id, patch) =>
    setTasks(t => t.map(x => x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x));

  const deleteTask = (id) => setTasks(t => t.filter(x => x.id !== id));

  const cycleStatus = (task) => {
    const order = ["todo", "in_progress", "done", "blocked"];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    updateTask(task.id, { status: next });
  };

  const filtered = tasks
    .filter(t => filter === "all" || t.status === filter)
    .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase())
               || t.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "priority") {
        const p = { high: 0, medium: 1, low: 2 };
        return p[a.priority] - p[b.priority];
      }
      if (sortBy === "due") return (a.dueDate || "9") < (b.dueDate || "9") ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const counts = Object.fromEntries(
    Object.keys(STATUS).map(k => [k, tasks.filter(t => t.status === k).length])
  );

  const EditingTask = ({ task }) => {
    const [form, setForm] = useState({ ...task, tags: task.tags.join(", ") });
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="Task title" />
        <Input multiline rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Description (optional)" />
        <div style={{ display: "flex", gap: 8 }}>
          <select value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}
            style={{ flex: 1, background: getC("CARD2"), border: `1px solid ${getC("BORDER")}`, borderRadius: 8, padding: "7px 10px", color: getC("TEXT"), fontSize: 12, outline: "none" }}>
            {Object.entries(PRIORITY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
            style={{ flex: 1, background: getC("CARD2"), border: `1px solid ${getC("BORDER")}`, borderRadius: 8, padding: "7px 10px", color: getC("TEXT"), fontSize: 12, outline: "none" }}>
            {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <input type="date" value={form.dueDate} onChange={e => setForm(f => ({...f, dueDate: e.target.value}))}
            style={{ flex: 1, background: getC("CARD2"), border: `1px solid ${getC("BORDER")}`, borderRadius: 8, padding: "7px 10px", color: getC("TEXT"), fontSize: 12, outline: "none" }} />
        </div>
        <Input value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))} placeholder="Tags: comma-separated" />
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={() => { updateTask(task.id, { ...form, tags: form.tags.split(",").map(t=>t.trim()).filter(Boolean) }); setEditing(null); }} size="sm">Save</Btn>
          <Btn ghost color={getC("MUTED")} onClick={() => setEditing(null)} size="sm">Cancel</Btn>
        </div>
      </div>
    );
  };

  return (
    <div style={{ animation: "slide-in 0.3s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, color: getC("TEXT") }}>Task Manager</h1>
          <p style={{ color: getC("MUTED"), fontSize: 13, marginTop: 3 }}>Create, track, and let AI manage your tasks</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn ghost color={getC("ACCENT")} onClick={() => onAiAction()} size="sm">
            <Icon d={IC.sparkle} size={13} color={getC("ACCENT")} /> AI Action
          </Btn>
          <Btn onClick={() => setShowForm(!showForm)}>
            <Icon d={IC.plus} size={14} color={getC("BG")} /> New Task
          </Btn>
        </div>
      </div>

      {/* Status summary pills */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {[["all", "All Tasks", tasks.length, getC("ACCENT")], ...Object.entries(STATUS).map(([k,v]) => [k, v.label, counts[k], v.color])].map(([k, lbl, cnt, col]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
            background: filter === k ? `${col}22` : getC("CARD2"),
            border: `1px solid ${filter === k ? col : getC("BORDER")}`,
            color: filter === k ? col : getC("MUTED"), fontWeight: filter === k ? 700 : 400,
            transition: "all 0.18s", display: "flex", alignItems: "center", gap: 6,
          }}>
            {lbl} <span style={{ background: `${col}30`, padding: "1px 6px", borderRadius: 10, fontSize: 10 }}>{cnt}</span>
          </button>
        ))}
      </div>

      {/* Search + sort row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Icon d={IC.filter} size={14} color={getC("MUTED")} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
            style={{ paddingLeft: 32 }} />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
          background: getC("CARD2"), border: `1px solid ${getC("BORDER")}`, borderRadius: 8,
          padding: "8px 12px", color: getC("MUTED"), fontSize: 12, outline: "none",
        }}>
          <option value="created">Newest first</option>
          <option value="priority">By priority</option>
          <option value="due">By due date</option>
        </select>
      </div>

      {/* New task form */}
      {showForm && (
        <Card accent={getC("ACCENT")} style={{ marginBottom: 16 }}>
          <CardHeader icon={IC.plus} title="NEW TASK" accent={getC("ACCENT")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Input value={newTask.title} onChange={e => setNewTask(t => ({...t, title: e.target.value}))}
              placeholder="Task title *" onKeyDown={e => e.key === "Enter" && addTask()} />
            <Input multiline rows={2} value={newTask.description}
              onChange={e => setNewTask(t => ({...t, description: e.target.value}))}
              placeholder="Description (optional)" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={newTask.priority} onChange={e => setNewTask(t => ({...t, priority: e.target.value}))}
                style={{ flex: 1, minWidth: 100, background: getC("CARD2"), border: `1px solid ${getC("BORDER")}`, borderRadius: 8, padding: "8px 10px", color: getC("TEXT"), fontSize: 12, outline: "none" }}>
                {Object.entries(PRIORITY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={newTask.status} onChange={e => setNewTask(t => ({...t, status: e.target.value}))}
                style={{ flex: 1, minWidth: 100, background: getC("CARD2"), border: `1px solid ${getC("BORDER")}`, borderRadius: 8, padding: "8px 10px", color: getC("TEXT"), fontSize: 12, outline: "none" }}>
                {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <input type="date" value={newTask.dueDate} onChange={e => setNewTask(t => ({...t, dueDate: e.target.value}))}
                style={{ flex: 1, minWidth: 120, background: getC("CARD2"), border: `1px solid ${getC("BORDER")}`, borderRadius: 8, padding: "8px 10px", color: getC("TEXT"), fontSize: 12, outline: "none" }} />
              <Input value={newTask.tags} onChange={e => setNewTask(t => ({...t, tags: e.target.value}))}
                placeholder="Tags (comma-separated)" style={{ flex: 2, minWidth: 140 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={addTask}>Add Task</Btn>
              <Btn ghost color={getC("MUTED")} onClick={() => setShowForm(false)}>Cancel</Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Task list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && (
          <Card>
            <div style={{ textAlign: "center", padding: "32px 0", color: getC("MUTED") }}>
              <Icon d={IC.tasks} size={36} color={getC("BORDER")} style={{ display: "block", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14 }}>{search ? "No tasks match your search." : "No tasks yet. Create your first one!"}</div>
            </div>
          </Card>
        )}
        {filtered.map(task => {
          const sc = STATUS[task.status]?.color || getC("MUTED");
          const pc = PRIORITY[task.priority]?.color || getC("MUTED");
          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
          return (
            <Card key={task.id} accent={sc} style={{ transition: "all 0.2s" }}>
              {editing === task.id ? (
                <EditingTask task={task} />
              ) : (
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {/* Status toggle */}
                  <button onClick={() => cycleStatus(task)} title="Click to advance status" style={{
                    width: 24, height: 24, borderRadius: 6, border: `2px solid ${sc}`,
                    background: task.status === "done" ? sc : "transparent", flexShrink: 0,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
                  }}>
                    {task.status === "done" && <Icon d={IC.check} size={12} color={getC("BG")} />}
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <span style={{
                        flex: 1, fontSize: 14, fontWeight: 600, color: task.status === "done" ? getC("MUTED") : getC("TEXT"),
                        textDecoration: task.status === "done" ? "line-through" : "none",
                      }}>{task.title}</span>
                      <Badge label={PRIORITY[task.priority]?.label} color={pc} />
                      <Badge label={STATUS[task.status]?.label} color={sc} />
                    </div>
                    {task.description && (
                      <div style={{ fontSize: 12, color: getC("MUTED"), marginTop: 4, lineHeight: 1.5 }}>{task.description}</div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {task.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10,
                          background: `${getC("ACCENT")}12`, color: getC("MUTED") }}>#{tag}</span>
                      ))}
                      {task.dueDate && (
                        <span style={{ fontSize: 11, color: isOverdue ? "#FF6B35" : getC("MUTED"), display: "flex", alignItems: "center", gap: 4 }}>
                          <Icon d={IC.clock} size={11} color={isOverdue ? "#FF6B35" : getC("MUTED")} />
                          {isOverdue ? "Overdue: " : "Due: "}{task.dueDate}
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: getC("MUTED"), marginLeft: "auto" }}>
                        {new Date(task.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setEditing(task.id)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: getC("MUTED"), padding: 4, borderRadius: 6,
                    }}><Icon d={IC.edit} size={14} /></button>
                    <button onClick={() => deleteTask(task.id)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: getC("MUTED"), padding: 4, borderRadius: 6,
                    }}><Icon d={IC.trash} size={14} /></button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── AI ACTION PANEL ──────────────────────────────────────────────────────────
// This is the brain: it parses natural language and CRUD-manipulates tasks directly
function AiActionPanel({ tasks, setTasks, chatHistory, setChatHistory }) {
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [lastActions, setLastActions] = useState([]);
  const chatEndRef               = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);

  const quickPrompts = [
    "Mark all high-priority tasks as in progress",
    "Add a task: Review quarterly financials — high priority, due next Friday",
    "Show me a summary of my task progress",
    "Complete all tasks tagged 'done'",
    "Delete all blocked tasks",
    "Add 3 tasks for growing a freelance business",
  ];

  const sendMessage = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || loading) return;
    setInput("");

    const userMsg = { role: "user", content: text, ts: Date.now() };
    setChatHistory(h => [...h, userMsg]);
    setLoading(true);

    // Build task summary for context
    const taskSummary = tasks.length > 0
      ? tasks.map(t => `ID:${t.id} | "${t.title}" | status:${t.status} | priority:${t.priority} | tags:[${t.tags.join(",")}] | due:${t.dueDate || "none"}`).join("\n")
      : "(no tasks yet)";

    const systemPrompt = `You are APEX, an AI task management agent. You help users manage their tasks through natural language.

CURRENT TASKS:
${taskSummary}

Your job is to:
1. Interpret the user's request
2. Determine what task operations are needed (create, update, delete, or just reply)
3. Return a JSON response in this exact format:

{
  "reply": "A friendly message explaining what you did",
  "actions": [
    {
      "type": "create",
      "task": { "title": "...", "description": "...", "priority": "high|medium|low", "status": "todo|in_progress|done|blocked", "dueDate": "YYYY-MM-DD or empty string", "tags": ["tag1","tag2"] }
    },
    {
      "type": "update",
      "id": "task-id-here",
      "patch": { "status": "done" }
    },
    {
      "type": "delete",
      "id": "task-id-here"
    }
  ]
}

Rules:
- ONLY return valid JSON — no markdown fences, no preamble
- If the user just wants info (no mutations), return an empty actions array
- For "next Friday" type dates, calculate from today: ${new Date().toISOString().split("T")[0]}
- Be decisive and action-oriented
- Use real task IDs from the task list above when updating/deleting`;

    try {
      const raw = await callClaude(
        [{ role: "user", content: text }],
        systemPrompt,
        1200
      );

      // Parse JSON safely
      let parsed;
      try {
        const clean = raw.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(clean);
      } catch {
        parsed = { reply: raw, actions: [] };
      }

      // Execute actions
      const actionLog = [];
      for (const action of (parsed.actions || [])) {
        if (action.type === "create") {
          const newT = {
            id: `task-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
            title: action.task.title || "Untitled",
            description: action.task.description || "",
            priority: action.task.priority || "medium",
            status: action.task.status || "todo",
            dueDate: action.task.dueDate || "",
            tags: action.task.tags || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setTasks(t => [newT, ...t]);
          actionLog.push({ icon: "✅", text: `Created: "${newT.title}"` });
        } else if (action.type === "update") {
          setTasks(t => t.map(x => x.id === action.id
            ? { ...x, ...action.patch, updatedAt: new Date().toISOString() } : x));
          actionLog.push({ icon: "✏️", text: `Updated task ${action.id.slice(0,12)}…` });
        } else if (action.type === "delete") {
          setTasks(t => t.filter(x => x.id !== action.id));
          actionLog.push({ icon: "🗑️", text: `Deleted task ${action.id.slice(0,12)}…` });
        }
      }

      setLastActions(actionLog);
      const assistantMsg = { role: "assistant", content: parsed.reply || "Done!", actions: actionLog, ts: Date.now() };
      setChatHistory(h => [...h, assistantMsg]);
    } catch (err) {
      setChatHistory(h => [...h, { role: "assistant", content: `Error: ${err.message}`, ts: Date.now() }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", animation: "slide-in 0.3s ease" }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12,
            background: `linear-gradient(135deg, ${getC("ACCENT")}, #00A878)`,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon d={IC.sparkle} size={20} color={getC("BG")} />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: getC("TEXT") }}>AI Action Panel</h1>
            <div style={{ fontSize: 12, color: getC("MUTED") }}>Natural language → automatic task manipulation</div>
          </div>
        </div>

        {/* Action log */}
        {lastActions.length > 0 && (
          <div style={{ background: `${getC("ACCENT")}08`, border: `1px solid ${getC("ACCENT")}30`,
            borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, flexWrap: "wrap" }}>
            {lastActions.map((a, i) => (
              <span key={i} style={{ fontSize: 12, color: getC("ACCENT") }}>{a.icon} {a.text}</span>
            ))}
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {quickPrompts.map((p, i) => (
          <button key={i} onClick={() => sendMessage(p)} style={{
            background: getC("CARD2"), border: `1px solid ${getC("BORDER")}`, borderRadius: 16,
            padding: "5px 12px", color: getC("MUTED"), fontSize: 11, cursor: "pointer", transition: "all 0.18s",
          }}>{p}</button>
        ))}
      </div>

      {/* Chat history */}
      <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
        {chatHistory.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px", color: getC("MUTED") }}>
            <Icon d={IC.sparkle} size={40} color={getC("BORDER")} style={{ display: "block", margin: "0 auto 14px" }} />
            <div style={{ fontSize: 15, marginBottom: 8, color: getC("TEXT") }}>Ask me to manage your tasks</div>
            <div style={{ fontSize: 13 }}>I can create, update, complete, or delete tasks based on plain English.</div>
          </div>
        )}
        {chatHistory.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
              {!isUser && (
                <div style={{ width: 28, height: 28, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${getC("ACCENT")}, #00A878)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginRight: 8, flexShrink: 0, marginTop: 2 }}>
                  <Icon d={IC.sparkle} size={13} color={getC("BG")} />
                </div>
              )}
              <div style={{ maxWidth: "76%", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{
                  padding: "10px 14px",
                  borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: isUser ? `${getC("ACCENT")}15` : getC("CARD2"),
                  border: `1px solid ${isUser ? getC("ACCENT") + "40" : getC("BORDER")}`,
                  fontSize: 13, color: getC("TEXT"), lineHeight: 1.6, whiteSpace: "pre-wrap",
                }}>{msg.content}</div>
                {msg.actions?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {msg.actions.map((a, j) => (
                      <span key={j} style={{ fontSize: 11, padding: "3px 9px",
                        background: `${getC("ACCENT")}12`, border: `1px solid ${getC("ACCENT")}30`,
                        borderRadius: 10, color: getC("ACCENT") }}>
                        {a.icon} {a.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%",
              background: `linear-gradient(135deg, ${getC("ACCENT")}, #00A878)`,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon d={IC.sparkle} size={13} color={getC("BG")} />
            </div>
            <div style={{ background: getC("CARD2"), border: `1px solid ${getC("BORDER")}`,
              borderRadius: "14px 14px 14px 4px", padding: "12px 16px",
              display: "flex", gap: 4, alignItems: "center" }}>
              {[0,1,2].map(j => (
                <div key={j} style={{ width: 6, height: 6, borderRadius: "50%",
                  background: getC("ACCENT"), animation: "pulse 1.2s infinite",
                  animationDelay: `${j*0.2}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Tell me what to do with your tasks… (Enter to send, Shift+Enter for newline)"
          rows={2} style={{
            flex: 1, background: getC("CARD"), border: `1px solid ${getC("BORDER")}`, borderRadius: 12,
            padding: "12px 16px", color: getC("TEXT"), fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit",
          }} />
        <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{
          background: `linear-gradient(135deg, ${getC("ACCENT")}, #00A878)`,
          color: getC("BG"), border: "none", borderRadius: 12, padding: "0 20px",
          cursor: (!input.trim() || loading) ? "not-allowed" : "pointer",
          fontWeight: 800, opacity: (!input.trim() || loading) ? 0.5 : 1, transition: "all 0.2s",
        }}>
          <Icon d={IC.send} size={20} color={getC("BG")} />
        </button>
      </div>
    </div>
  );
}

// ─── APP EDITOR ───────────────────────────────────────────────────────────────
// This lets users type "change theme to teal" or "add a progress bar" and the AI
// interprets and applies patches to the live app state.
function AppEditor({ onThemeChange, tasks, themeOverrides }) {
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [editorHistory, setEditorHistory] = useState([]);
  const [activeTab, setActiveTab]   = useState("palette");
  const chatEndRef                   = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [editorHistory]);

  const exampleCommands = [
    "Change the accent color to electric purple",
    "Make the background a deep navy blue",
    "Switch to a warm amber and dark brown theme",
    "Set accent to coral red and secondary to mint green",
    "Make it look like a cyberpunk terminal (neon green on black)",
    "Apply a clean monochrome white-on-dark theme",
  ];

  // Current palette display
  const currentPalette = Object.fromEntries(
    Object.keys(PALETTE).map(k => [k, themeOverrides[k] || PALETTE[k]])
  );

  const executeEditorCommand = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);

    const entry = { role: "user", content: text, ts: Date.now() };
    setEditorHistory(h => [...h, entry]);

    const currentThemeJson = JSON.stringify(currentPalette, null, 2);

    const systemPrompt = `You are an AI app editor that modifies UI theme properties in real-time.

CURRENT THEME:
${currentThemeJson}

THEME KEYS:
- ACCENT: primary action color (buttons, highlights, progress)
- ACCENT2: secondary/warning color
- GOLD: tertiary accent (achievements, milestones)
- BG: main page background
- CARD: card/surface background
- CARD2: secondary card/input background
- BORDER: border color
- TEXT: primary text color
- MUTED: secondary/dimmed text

The user wants to change the app's appearance. Return ONLY valid JSON in this format:
{
  "description": "Brief description of what you changed",
  "changes": {
    "ACCENT": "#hexcode",
    "BG": "#hexcode"
  },
  "preview": "One sentence describing the new look"
}

Rules:
- Only include keys you're actually changing
- All colors must be valid hex codes
- Maintain good contrast (dark bg needs light text and vice versa)
- Make sure CARD and CARD2 are slightly different shades
- BORDER should be subtly visible but not harsh
- Think about the whole palette as a cohesive system
- Return ONLY JSON — no markdown, no preamble`;

    try {
      const raw = await callClaude(
        [{ role: "user", content: text }],
        systemPrompt,
        600
      );

      let parsed;
      try {
        const clean = raw.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(clean);
      } catch {
        parsed = { description: "Could not parse response", changes: {}, preview: raw };
      }

      if (parsed.changes && Object.keys(parsed.changes).length > 0) {
        onThemeChange(parsed.changes);
      }

      setEditorHistory(h => [...h, {
        role: "assistant",
        content: parsed.description || "Applied changes.",
        preview: parsed.preview,
        changes: parsed.changes,
        ts: Date.now(),
      }]);
    } catch (err) {
      setEditorHistory(h => [...h, {
        role: "assistant",
        content: `Error: ${err.message}`,
        ts: Date.now(),
      }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ animation: "slide-in 0.3s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12,
          background: `linear-gradient(135deg, #A78BFA, #7C3AED)`,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon d={IC.brush} size={20} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: getC("TEXT") }}>App Editor</h1>
          <div style={{ fontSize: 12, color: getC("MUTED") }}>Describe changes in plain English — AI applies them live</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Left: Command interface */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Example commands */}
          <Card accent="#A78BFA">
            <CardHeader icon={IC.sparkle} title="EXAMPLE COMMANDS" accent="#A78BFA" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {exampleCommands.map((cmd, i) => (
                <button key={i} onClick={() => executeEditorCommand(cmd)} style={{
                  background: getC("CARD2"), border: `1px solid ${getC("BORDER")}`,
                  borderRadius: 8, padding: "8px 12px", color: getC("MUTED"),
                  fontSize: 12, cursor: "pointer", textAlign: "left", transition: "all 0.18s",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{ color: "#A78BFA" }}>→</span> {cmd}
                </button>
              ))}
            </div>
          </Card>

          {/* Command input */}
          <Card accent="#A78BFA">
            <CardHeader icon={IC.cpu} title="COMMAND PALETTE" accent="#A78BFA" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); executeEditorCommand(); } }}
                placeholder={`Describe the change you want…\n\nExamples:\n• "Change theme to cyberpunk neon"\n• "Make the background dark navy"\n• "Use coral and teal as main colors"`}
                rows={5}
                style={{
                  background: getC("CARD2"), border: `1px solid ${getC("BORDER")}`, borderRadius: 10,
                  padding: "12px 14px", color: getC("TEXT"), fontSize: 13, resize: "none", outline: "none",
                  fontFamily: "'Space Mono', monospace", lineHeight: 1.7,
                }}
              />
              <Btn onClick={() => executeEditorCommand()} disabled={!input.trim() || loading}
                color="#A78BFA" style={{ alignSelf: "flex-end" }}>
                {loading ? "Applying…" : <><Icon d={IC.brush} size={14} color="#fff" /> Apply Change</>}
              </Btn>
            </div>
          </Card>
        </div>

        {/* Right: Live palette + history */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Live palette */}
          <Card accent={getC("GOLD")}>
            <CardHeader icon={IC.tag} title="LIVE PALETTE" accent={getC("GOLD")} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {Object.entries(currentPalette).map(([key, hex]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                  background: getC("CARD2"), borderRadius: 8, border: `1px solid ${getC("BORDER")}` }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: hex,
                    border: `1px solid ${getC("BORDER")}`, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 10, color: getC("MUTED"), fontFamily: "'Space Mono', monospace" }}>{key}</div>
                    <div style={{ fontSize: 11, color: getC("TEXT"), fontFamily: "'Space Mono', monospace" }}>{hex}</div>
                  </div>
                  {themeOverrides[key] && (
                    <span style={{ fontSize: 9, color: "#A78BFA", marginLeft: "auto" }}>edited</span>
                  )}
                </div>
              ))}
            </div>
            {Object.keys(themeOverrides).length > 0 && (
              <button onClick={() => onThemeChange("reset")} style={{
                marginTop: 10, background: "none", border: `1px solid ${getC("BORDER")}`,
                borderRadius: 8, padding: "6px 14px", color: getC("MUTED"), fontSize: 12, cursor: "pointer",
              }}>↩ Reset to defaults</button>
            )}
          </Card>

          {/* Change history */}
          <Card accent="#A78BFA" style={{ flex: 1 }}>
            <CardHeader icon={IC.clock} title="CHANGE HISTORY" accent="#A78BFA" />
            <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {editorHistory.length === 0 && (
                <div style={{ color: getC("MUTED"), fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                  No changes yet. Try a command!
                </div>
              )}
              {editorHistory.map((entry, i) => {
                const isUser = entry.role === "user";
                return (
                  <div key={i} style={{
                    padding: "10px 12px", borderRadius: 10, fontSize: 12,
                    background: isUser ? `#A78BFA12` : getC("CARD2"),
                    border: `1px solid ${isUser ? "#A78BFA40" : getC("BORDER")}`,
                    color: getC("TEXT"),
                  }}>
                    <div style={{ fontSize: 10, color: getC("MUTED"), marginBottom: 4 }}>
                      {isUser ? "🧑 You" : "🤖 APEX Editor"} · {new Date(entry.ts).toLocaleTimeString()}
                    </div>
                    <div>{entry.content}</div>
                    {entry.preview && <div style={{ fontSize: 11, color: "#A78BFA", marginTop: 4 }}>✨ {entry.preview}</div>}
                    {entry.changes && Object.keys(entry.changes).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {Object.entries(entry.changes).map(([k, v]) => (
                          <span key={k} style={{ display: "flex", alignItems: "center", gap: 4,
                            fontSize: 10, padding: "2px 7px", borderRadius: 8,
                            background: `${v}20`, border: `1px solid ${v}40`, color: getC("TEXT") }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: v, display: "inline-block" }} />
                            {k}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ tasks, setActiveTab, sendAiAction }) {
  const done       = tasks.filter(t => t.status === "done").length;
  const inProg     = tasks.filter(t => t.status === "in_progress").length;
  const blocked    = tasks.filter(t => t.status === "blocked").length;
  const highPri    = tasks.filter(t => t.priority === "high" && t.status !== "done").length;
  const overdue    = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done").length;
  const totalPct   = tasks.length > 0 ? done / tasks.length : 0;
  const daysSince  = Math.max(1, Math.floor((Date.now() - START_DATE.getTime()) / 86400000));
  const daysLeft   = Math.max(0, Math.floor((START_DATE.getTime() + TWO_YEARS_MS - Date.now()) / 86400000));

  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 5);

  const byStatus = Object.entries(STATUS).map(([k, v]) => ({
    key: k, ...v, count: tasks.filter(t => t.status === k).length,
  }));

  return (
    <div style={{ animation: "slide-in 0.3s ease" }}>
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Space Mono', monospace", fontSize: 26, fontWeight: 700, color: getC("TEXT") }}>
          Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"} 👋
        </h1>
        <div style={{ color: getC("MUTED"), fontSize: 13, marginTop: 4 }}>
          {new Date().toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          {" · "}<span style={{ color: getC("ACCENT") }}>Day {daysSince} of 730 · {daysLeft} days remaining</span>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Tasks",     value: tasks.length,  sub: "all time",           color: getC("ACCENT") },
          { label: "Completed",       value: done,          sub: `${Math.round(totalPct*100)}% done`, color: "#00FFB2" },
          { label: "High Priority",   value: highPri,       sub: "need attention",     color: "#FF6B35" },
          { label: "Overdue",         value: overdue,       sub: "past due date",      color: overdue > 0 ? "#FF4444" : getC("MUTED") },
        ].map((s, i) => (
          <div key={i} style={{ background: getC("CARD2"), border: `1px solid ${getC("BORDER")}`,
            borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: getC("MUTED"), letterSpacing: 1.5,
              fontFamily: "'Space Mono', monospace", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color,
              fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: getC("MUTED"), marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Progress ring */}
        <Card accent={getC("ACCENT")}>
          <CardHeader icon={IC.target} title="OVERALL PROGRESS" />
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <RadialProgress pct={totalPct} size={90} color={getC("ACCENT")} />
            <div style={{ flex: 1 }}>
              {byStatus.map(s => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: getC("TEXT"), flex: 1 }}>{s.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: s.color,
                    fontFamily: "'Space Mono', monospace" }}>{s.count}</span>
                  <div style={{ width: 60, height: 4, background: getC("BORDER"), borderRadius: 4 }}>
                    <div style={{ height: "100%", borderRadius: 4, background: s.color,
                      width: `${tasks.length > 0 ? (s.count/tasks.length)*100 : 0}%`,
                      transition: "width 0.6s" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Recent activity */}
        <Card accent={getC("ACCENT2")}>
          <CardHeader icon={IC.clock} title="RECENT ACTIVITY" accent={getC("ACCENT2")} />
          {recentTasks.length === 0 ? (
            <div style={{ color: getC("MUTED"), fontSize: 13, textAlign: "center", padding: "20px 0" }}>
              No tasks yet.{" "}
              <button onClick={() => setActiveTab("tasks")} style={{ color: getC("ACCENT"), background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                Create one →
              </button>
            </div>
          ) : (
            recentTasks.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10,
                padding: "7px 0", borderBottom: `1px solid ${getC("BORDER")}` }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%",
                  background: STATUS[t.status]?.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: getC("TEXT"),
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                <Badge label={PRIORITY[t.priority]?.label} color={PRIORITY[t.priority]?.color} />
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Quick AI actions */}
      <Card accent={getC("GOLD")}>
        <CardHeader icon={IC.sparkle} title="QUICK AI ACTIONS" accent={getC("GOLD")} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            "Add 3 high-impact tasks for today",
            "Mark all completed tasks as done",
            `I have ${highPri} high-priority tasks — help me prioritize`,
            "Suggest tasks to grow income",
            overdue > 0 ? `I have ${overdue} overdue tasks — what should I do?` : "Plan my week",
          ].map((p, i) => (
            <button key={i} onClick={() => { setActiveTab("ai"); sendAiAction(p); }}
              style={{ background: getC("CARD2"), border: `1px solid ${getC("BORDER")}`,
                borderRadius: 20, padding: "7px 14px", color: getC("MUTED"),
                fontSize: 12, cursor: "pointer", transition: "all 0.18s" }}>
              {p}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab]     = useState("dashboard");
  const [tasks, setTasks]             = useState([]);
  const [loaded, setLoaded]           = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [themeOverrides, setThemeOverrides] = useState({});
  const pendingAiInput                = useRef(null);

  // Load from persistent storage on mount
  useEffect(() => {
    (async () => {
      const savedTasks = await store.get("tasks_v2", []);
      const savedChat  = await store.get("ai_chat_v2", []);
      const savedTheme = await store.get("theme_overrides", {});
      setTasks(savedTasks);
      setChatHistory(savedChat);
      setThemeOverrides(savedTheme);
      _themeOverrides = savedTheme;
      setLoaded(true);
    })();
  }, []);

  // Persist tasks
  useEffect(() => {
    if (loaded) store.set("tasks_v2", tasks);
  }, [tasks, loaded]);

  // Persist chat (last 80 messages)
  useEffect(() => {
    if (loaded) store.set("ai_chat_v2", chatHistory.slice(-80));
  }, [chatHistory, loaded]);

  // Persist theme
  useEffect(() => {
    if (loaded) store.set("theme_overrides", themeOverrides);
  }, [themeOverrides, loaded]);

  const handleThemeChange = (changes) => {
    if (changes === "reset") {
      _themeOverrides = {};
      setThemeOverrides({});
    } else {
      _themeOverrides = { ..._themeOverrides, ...changes };
      setThemeOverrides(prev => ({ ...prev, ...changes }));
    }
  };

  // Allow other panels to pre-fill the AI input
  const sendAiAction = useCallback((text) => {
    pendingAiInput.current = text;
    setActiveTab("ai");
  }, []);

  const [aiPendingText, setAiPendingText] = useState(null);
  useEffect(() => {
    if (activeTab === "ai" && pendingAiInput.current) {
      setAiPendingText(pendingAiInput.current);
      pendingAiInput.current = null;
    }
  }, [activeTab]);

  const navItems = [
    { id: "dashboard", icon: IC.dashboard, label: "Dashboard" },
    { id: "tasks",     icon: IC.tasks,     label: "Tasks"     },
    { id: "ai",        icon: IC.sparkle,   label: "AI Actions" },
    { id: "editor",    icon: IC.brush,     label: "App Editor" },
  ];

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: PALETTE.BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: PALETTE.MUTED }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
          <div style={{ fontFamily: "'Space Mono', monospace", color: PALETTE.ACCENT }}>Loading APEX…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: getC("BG"), color: getC("TEXT"), fontFamily: "'DM Sans', 'Segoe UI', sans-serif", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${getC("CARD")}; }
        ::-webkit-scrollbar-thumb { background: ${getC("BORDER")}; border-radius: 4px; }
        input::placeholder, textarea::placeholder { color: ${getC("MUTED")}; }
        select option { background: ${getC("CARD")}; color: ${getC("TEXT")}; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes slide-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        button:hover { filter: brightness(1.08); }
      `}</style>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 210, background: getC("CARD"), borderRight: `1px solid ${getC("BORDER")}`,
        display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${getC("BORDER")}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${getC("ACCENT")}, #00A878)`,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon d={IC.bolt} size={18} color={getC("BG")} />
            </div>
            <div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 15, color: getC("ACCENT") }}>APEX</div>
              <div style={{ fontSize: 10, color: getC("MUTED") }}>AI Task Platform</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "10px 8px", flex: 1 }}>
          {navItems.map(item => {
            const active = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 10, border: "none",
                background: active ? `${getC("ACCENT")}18` : "transparent",
                color: active ? getC("ACCENT") : getC("MUTED"),
                cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 400,
                marginBottom: 2, transition: "all 0.15s",
              }}>
                <Icon d={item.icon} size={15} color={active ? getC("ACCENT") : getC("MUTED")} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Task progress */}
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${getC("BORDER")}` }}>
          <div style={{ fontSize: 10, color: getC("MUTED"), marginBottom: 6, fontFamily: "'Space Mono', monospace" }}>TASKS DONE</div>
          <div style={{ background: `${getC("ACCENT")}15`, borderRadius: 6, height: 5, marginBottom: 5 }}>
            <div style={{
              background: `linear-gradient(90deg, ${getC("ACCENT")}, #00D9A6)`, height: "100%", borderRadius: 6,
              width: `${tasks.length > 0 ? (tasks.filter(t=>t.status==="done").length / tasks.length) * 100 : 0}%`,
              transition: "width 0.8s",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
            <span style={{ color: getC("ACCENT"), fontFamily: "'Space Mono', monospace" }}>
              {tasks.filter(t => t.status === "done").length}/{tasks.length}
            </span>
            <span style={{ color: getC("MUTED") }}>completed</span>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
        {activeTab === "dashboard" && (
          <Dashboard tasks={tasks} setActiveTab={setActiveTab} sendAiAction={sendAiAction} />
        )}
        {activeTab === "tasks" && (
          <TaskManager tasks={tasks} setTasks={setTasks}
            onAiAction={() => setActiveTab("ai")} />
        )}
        {activeTab === "ai" && (
          <AiActionPanel tasks={tasks} setTasks={setTasks}
            chatHistory={chatHistory} setChatHistory={setChatHistory}
            initialText={aiPendingText} onClearInitial={() => setAiPendingText(null)} />
        )}
        {activeTab === "editor" && (
          <AppEditor onThemeChange={handleThemeChange} tasks={tasks} themeOverrides={themeOverrides} />
        )}
      </div>
    </div>
  );
}
