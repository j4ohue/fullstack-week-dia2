"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, clearToken } from "@/lib/api";

const COLUMNS = [
  { key: "TODO", label: "A fazer" },
  { key: "DOING", label: "Fazendo" },
  { key: "DONE", label: "Concluído" },
];

const PRIORITY_LABEL = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" };
const PRIORITY_COLOR = { LOW: "#16a34a", MEDIUM: "#d97706", HIGH: "#dc2626" };

const PRIORITY_FILTERS = [
  { key: "ALL", label: "Todas" },
  { key: "HIGH", label: "Alta" },
  { key: "MEDIUM", label: "Média" },
  { key: "LOW", label: "Baixa" },
];

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// data de hoje no fuso local (YYYY-MM-DD), sem passar por UTC
function todayLocal() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function isOverdue(task) {
  if (!task.dueDate || task.status === "DONE") return false;
  return task.dueDate.slice(0, 10) < todayLocal();
}

export default function DashboardPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    dueDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);

  const logout = useCallback(() => {
    clearToken();
    router.push("/login");
  }, [router]);

  const loadTasks = useCallback(async () => {
    try {
      setTasks(await api("/tasks"));
    } catch (err) {
      if (err.status === 401) logout();
      else setError(err.message);
    }
  }, [logout]);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    loadTasks();
  }, [router, loadTasks]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/tasks", {
        method: "POST",
        body: { title, priority, dueDate: dueDate || null },
      });
      setTitle("");
      setPriority("MEDIUM");
      setDueDate("");
      await loadTasks();
    } catch (err) {
      if (err.status === 401) logout();
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function moveTask(task, newStatus) {
    setError("");
    const previous = tasks;
    setTasks((list) =>
      list.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );
    try {
      await api(`/tasks/${task.id}`, { method: "PATCH", body: { status: newStatus } });
      await loadTasks();
    } catch (err) {
      setTasks(previous);
      if (err.status === 401) logout();
      else setError(err.message);
    }
  }

  async function removeTask(task) {
    if (!window.confirm(`Excluir "${task.title}"?`)) return;
    setError("");
    try {
      await api(`/tasks/${task.id}`, { method: "DELETE" });
      setTasks((list) => list.filter((t) => t.id !== task.id));
      if (editingId === task.id) setEditingId(null);
    } catch (err) {
      if (err.status === 401) logout();
      else setError(err.message);
    }
  }

  function startEdit(task) {
    setError("");
    setEditingId(task.id);
    setEditForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const updated = await api(`/tasks/${editingId}`, {
        method: "PATCH",
        body: {
          title: editForm.title,
          description: editForm.description,
          priority: editForm.priority,
          dueDate: editForm.dueDate || null,
        },
      });
      setTasks((list) => list.map((t) => (t.id === updated.id ? updated : t)));
      setEditingId(null);
    } catch (err) {
      if (err.status === 401) logout();
      else setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ---- drag and drop ----
  function handleDragStart(e, task) {
    setDraggingId(task.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(task.id));
  }

  function handleDragEnd() {
    setDraggingId(null);
    setOverColumn(null);
  }

  function handleDragOver(e, colKey) {
    if (draggingId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overColumn !== colKey) setOverColumn(colKey);
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setOverColumn(null);
  }

  function handleDrop(e, colKey) {
    e.preventDefault();
    const id = draggingId;
    setDraggingId(null);
    setOverColumn(null);
    if (id === null) return;
    const task = tasks.find((t) => t.id === id);
    if (task && task.status !== colKey) moveTask(task, colKey);
  }

  const overdueCount = tasks.filter(isOverdue).length;
  const filtersActive = priorityFilter !== "ALL" || onlyOverdue;
  const visibleTasks = tasks.filter(
    (t) =>
      (priorityFilter === "ALL" || t.priority === priorityFilter) &&
      (!onlyOverdue || isOverdue(t))
  );

  function clearFilters() {
    setPriorityFilter("ALL");
    setOnlyOverdue(false);
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Minhas tarefas</h1>
        <button onClick={logout} style={styles.ghost}>Sair</button>
      </header>

      <form onSubmit={handleCreate} style={styles.form}>
        <input
          type="text"
          placeholder="Nova tarefa..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          style={{ ...styles.input, flex: 1, minWidth: 200 }}
        />
        <select value={priority} onChange={(e) => setPriority(e.target.value)} style={styles.input}>
          <option value="LOW">Prioridade baixa</option>
          <option value="MEDIUM">Prioridade média</option>
          <option value="HIGH">Prioridade alta</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          style={styles.input}
        />
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? "Criando..." : "Adicionar"}
        </button>
      </form>

      <div style={styles.filters}>
        <span style={{ fontSize: 14, opacity: 0.7 }}>Prioridade:</span>
        {PRIORITY_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setPriorityFilter(f.key)}
            style={priorityFilter === f.key ? styles.chipActive : styles.chip}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setOnlyOverdue((v) => !v)}
          style={onlyOverdue ? styles.chipDangerActive : styles.chipDanger}
          title="Mostrar só as tarefas atrasadas"
        >
          Atrasadas ({overdueCount})
        </button>
        {filtersActive && (
          <button onClick={clearFilters} style={styles.ghost}>
            Limpar filtros
          </button>
        )}
      </div>

      {error && <p style={{ color: "#c0392b" }}>{error}</p>}

      <div style={styles.board}>
        {COLUMNS.map((col, index) => {
          const items = visibleTasks.filter((t) => t.status === col.key);
          const isOver = overColumn === col.key;
          return (
            <section
              key={col.key}
              style={{ ...styles.column, ...(isOver ? styles.columnOver : {}) }}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              <h2 style={styles.columnTitle}>
                {col.label} <span style={{ opacity: 0.6 }}>({items.length})</span>
              </h2>

              {items.map((task) =>
                editingId === task.id ? (
                  <form key={task.id} onSubmit={saveEdit} style={{ ...styles.card, ...styles.editForm }}>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      maxLength={120}
                      required
                      autoFocus
                      style={styles.input}
                    />
                    <textarea
                      placeholder="Descrição (opcional)"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={3}
                      style={{ ...styles.input, resize: "vertical", fontFamily: "inherit" }}
                    />
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                      style={styles.input}
                    >
                      <option value="LOW">Prioridade baixa</option>
                      <option value="MEDIUM">Prioridade média</option>
                      <option value="HIGH">Prioridade alta</option>
                    </select>
                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                      style={styles.input}
                    />
                    <div style={styles.actions}>
                      <button type="submit" disabled={saving} style={{ ...styles.button, padding: "8px 14px" }}>
                        {saving ? "Salvando..." : "Salvar"}
                      </button>
                      <button type="button" onClick={cancelEdit} style={styles.ghost}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    style={{
                      ...styles.card,
                      cursor: "grab",
                      opacity: draggingId === task.id ? 0.4 : 1,
                    }}
                  >
                    <strong style={{ wordBreak: "break-word" }}>{task.title}</strong>
                    {task.description && (
                      <p style={{ margin: "4px 0 0", opacity: 0.8, fontSize: 14, whiteSpace: "pre-wrap" }}>
                        {task.description}
                      </p>
                    )}
                    <div style={styles.meta}>
                      <span style={{ ...styles.badge, background: PRIORITY_COLOR[task.priority] }}>
                        {PRIORITY_LABEL[task.priority]}
                      </span>
                      {task.dueDate && (
                        <span style={{ color: isOverdue(task) ? "#dc2626" : "inherit", fontSize: 13 }}>
                          {isOverdue(task) ? "Atrasada: " : "Prazo: "}
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                    <div style={styles.actions}>
                      <button
                        onClick={() => moveTask(task, COLUMNS[index - 1].key)}
                        disabled={index === 0}
                        style={styles.ghost}
                        title="Mover para a esquerda"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => moveTask(task, COLUMNS[index + 1].key)}
                        disabled={index === COLUMNS.length - 1}
                        style={styles.ghost}
                        title="Mover para a direita"
                      >
                        →
                      </button>
                      <button onClick={() => startEdit(task)} style={{ ...styles.ghost, marginLeft: "auto" }}>
                        Editar
                      </button>
                      <button onClick={() => removeTask(task)} style={styles.ghost}>
                        Excluir
                      </button>
                    </div>
                  </article>
                )
              )}

              {items.length === 0 && (
                <p style={{ opacity: 0.5, fontSize: 14, margin: 0 }}>
                  {filtersActive ? "Nenhuma tarefa com esses filtros." : "Nenhuma tarefa aqui."}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

const chipBase = {
  padding: "6px 12px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#8886",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  fontSize: 14,
};

const styles = {
  form: { display: "flex", gap: 8, flexWrap: "wrap", margin: "24px 0 8px" },
  filters: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    margin: "12px 0 0",
  },
  chip: { ...chipBase },
  chipActive: { ...chipBase, background: "#2563eb", borderColor: "#2563eb", color: "#fff" },
  chipDanger: { ...chipBase, borderColor: "#dc2626", color: "#dc2626" },
  chipDangerActive: { ...chipBase, background: "#dc2626", borderColor: "#dc2626", color: "#fff" },
  input: { padding: 10, borderRadius: 8, border: "1px solid #8886", fontSize: 16 },
  button: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontSize: 16,
    cursor: "pointer",
  },
  ghost: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #8886",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
  },
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
    marginTop: 16,
    alignItems: "start",
  },
  column: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 12,
    border: "1px solid #8884",
    borderRadius: 12,
    minHeight: 160,
  },
  columnOver: {
    border: "1px dashed #2563eb",
    background: "#2563eb12",
  },
  columnTitle: { margin: 0, fontSize: 18 },
  card: {
    padding: 12,
    border: "1px solid #8884",
    borderRadius: 10,
    background: "#8881",
  },
  editForm: { display: "flex", flexDirection: "column", gap: 8 },
  meta: { display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" },
  badge: { color: "#fff", fontSize: 12, padding: "2px 8px", borderRadius: 999 },
  actions: { display: "flex", gap: 6, marginTop: 10 },
};