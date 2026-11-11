require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const tasksRoutes = require("./routes/tasks");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/tasks", tasksRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, (err) => {
  if (err) {
    console.error("Falha ao subir a API:", err.message);
    process.exit(1);
  }
  console.log(`API rodando em http://localhost:${PORT}`);
});