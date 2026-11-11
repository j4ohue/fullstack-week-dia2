const express = require("express");
const prisma = require("../lib/prisma");
const auth = require("../middleware/auth");

const router = express.Router();
router.use(auth);

const STATUSES = ["TODO", "DOING", "DONE"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// retorna null (sem prazo), Date válida, ou undefined (inválida)
function parseDueDate(value) {
  if (value === null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

async function nextPosition(userId, status) {
  const r = await prisma.task.aggregate({
    where: { userId, status },
    _max: { position: true },
  });
  return (r._max.position ?? -1) + 1;
}

// Listar
router.get("/", async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: req.userId },
      orderBy: [{ status: "asc" }, { position: "asc" }, { id: "asc" }],
    });
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Criar
router.post("/", async (req, res) => {
  try {
    const { title, description, status = "TODO", priority = "MEDIUM", dueDate } = req.body || {};

    if (typeof title !== "string" || !title.trim() || title.trim().length > 120) {
      return res.status(400).json({ error: "Título obrigatório (até 120 caracteres)" });
    }
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }
    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: "Prioridade inválida" });
    }
    const due = dueDate === undefined ? null : parseDueDate(dueDate);
    if (due === undefined) {
      return res.status(400).json({ error: "Prazo inválido" });
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: typeof description === "string" && description.trim() ? description.trim() : null,
        status,
        priority,
        dueDate: due,
        position: await nextPosition(req.userId, status),
        userId: req.userId,
      },
    });
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Editar / mover
router.patch("/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const current = await prisma.task.findFirst({ where: { id, userId: req.userId } });
    if (!current) return res.status(404).json({ error: "Tarefa não encontrada" });

    const { title, description, status, priority, dueDate, position } = req.body || {};
    const data = {};

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim() || title.trim().length > 120) {
        return res.status(400).json({ error: "Título inválido" });
      }
      data.title = title.trim();
    }
    if (description !== undefined) {
      data.description = typeof description === "string" && description.trim() ? description.trim() : null;
    }
    if (priority !== undefined) {
      if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: "Prioridade inválida" });
      data.priority = priority;
    }
    if (dueDate !== undefined) {
      const due = parseDueDate(dueDate);
      if (due === undefined) return res.status(400).json({ error: "Prazo inválido" });
      data.dueDate = due;
    }
    if (status !== undefined) {
      if (!STATUSES.includes(status)) return res.status(400).json({ error: "Status inválido" });
      data.status = status;
      if (status !== current.status) {
        data.position = await nextPosition(req.userId, status); // vai para o fim da nova coluna
      }
    }
    if (position !== undefined) {
      if (!Number.isInteger(position) || position < 0) {
        return res.status(400).json({ error: "Posição inválida" });
      }
      data.position = position;
    }

    const task = await prisma.task.update({ where: { id }, data });
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Excluir
router.delete("/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const result = await prisma.task.deleteMany({ where: { id, userId: req.userId } });
    if (result.count === 0) return res.status(404).json({ error: "Tarefa não encontrada" });

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

module.exports = router;