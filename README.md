# Dia 2: Kanban de Tarefas

Gerenciador de tarefas estilo Kanban, com três colunas (A fazer, Fazendo, Concluído). Cada usuário vê apenas as próprias tarefas.

## Stack

- **Front:** Next.js (App Router, JavaScript, sem Tailwind)
- **API:** Express 5 + Prisma 6 + PostgreSQL 16 (Docker)
- **Auth:** JWT (register/login) com senhas em bcrypt

## Funcionalidades

- Cadastro, login e logout
- Criar tarefa com título, prioridade e prazo
- Editar título, descrição, prioridade e prazo
- Mover entre colunas (botões ← e → ou arrastando)
- Excluir com confirmação
- Filtro por prioridade e filtro de tarefas atrasadas, com contador

## Como rodar

Pré-requisitos: Node.js, Docker Desktop.

1. Banco (porta 5433 no host):

   ```
   docker compose up -d
   ```

2. API (porta 3001):

   ```
   cd api
   copy .env.example .env
   npm install
   npx prisma migrate dev
   npm run dev
   ```

   Edite o `JWT_SECRET` no `.env`. Se o npm bloquear scripts de instalação:
   `npm install-scripts approve @prisma/client prisma @prisma/engines bcrypt` e depois `npm rebuild`.

3. Front (porta 3000), em outro terminal:

   ```
   cd web
   npm install
   npm run dev
   ```

   O `web/.env.local` precisa de `NEXT_PUBLIC_API_URL=http://localhost:3001`.

Abra http://localhost:3000/login e crie uma conta.

## Rotas da API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/register` | Cria usuário, responde `{ token }` |
| POST | `/auth/login` | Autentica, responde `{ token }` |
| GET | `/tasks` | Lista as tarefas do usuário |
| POST | `/tasks` | Cria tarefa (`title`, `description`, `status`, `priority`, `dueDate`) |
| PATCH | `/tasks/:id` | Edita ou move (qualquer campo acima) |
| DELETE | `/tasks/:id` | Exclui |

Todas as rotas `/tasks` exigem `Authorization: Bearer <token>` e filtram por usuário.

## Decisões

- `status` e `priority` são enums no banco, então valores inválidos são recusados.
- Mover de coluna manda a tarefa para o fim da nova coluna (`position`).
- O atraso é calculado no fuso local do navegador, para uma tarefa com prazo de hoje não aparecer como atrasada à noite.
- Drag and drop nativo do HTML5, sem biblioteca. Os botões ← e → cobrem o celular.

## Limitações

- Não dá para reordenar cards dentro da mesma coluna (o campo `position` já existe no banco).
- O token fica no `localStorage`, aceitável para um MVP de estudo.
- Sem testes automatizados.

## Adições

- Acredito que eu possa polir mais o front com um sistema drag and release
- quero adicionar um calendario semanal para facilitar encontar as tarefas