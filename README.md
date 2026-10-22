
# Vinyl & Records — Online Store

An online storefront for vinyl records and audio accessories, built as the CS 308 Software Engineering course project at Sabancı University.

> **Status:** Sprint 1 — initial architecture committed; project scaffolding in progress.

---

## About

A full-stack web application where customers can browse and purchase vinyl records across categories, manage a wish list, track orders, and interact with support — alongside a role-based admin interface for sales managers, product managers, and support agents.

The store domain is **vinyl records and accessories**: genres as categories, limited stock per pressing, and product metadata tailored to records (artist, label, genre, pressing year) on top of the standard product fields.

---


## For Team Members — Local Setup
1. **Clone:** `git clone <repo-url> && cd vinyl-store`
2. **Database:** `docker compose up -d`
3. **Backend:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   npx prisma migrate dev
   npm run dev
   ```
4. **Frontend** (once scaffolded): `cd frontend && npm install && npm run dev`

Test backend at `http://localhost:3000`.

### If using AI tools
Paste this repo's screenshot of folder and file skeleton to the AI first, plus:
- Stack: Node + Express + Prisma + PostgreSQL, JWT + bcrypt
- Use Prisma Client only (no raw SQL)
- Follow controller/service/routes separation
- Read `prisma/schema.prisma` before DB code

Don't accept AI-suggested folder changes unless discussed with team first; structure is team-agreed.


## Tech Stack

| Layer | Choice |
|---|---|
| Backend | Node.js + Express |
| Database | PostgreSQL |
| ORM | Prisma |
| Frontend | React |
| Containerization | Docker + Docker Compose |
| CI | GitHub Actions |
| Backend Testing | Jest + Supertest |
| Frontend Testing | React Testing Library |
| Auth | JWT + bcrypt |

---

## Project Structure

```
vinyl-store/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   │   └── prisma.js
│   │   ├── middlewares/
│   │   │   ├── auth.js
│   │   │   └── errorHandler.js
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── products/
│   │   │   └── cart/
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── frontend/
├── docker-compose.yml
└── .github/
    └── workflows/
        └── ci.yml
```

---

## Getting Started

### Prerequisites
- Docker
- Docker Compose
- Node.js (v20+)
- npm

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd vinyl-store

# 2. Start PostgreSQL
docker compose up -d

# 3. Backend setup
cd backend
npm install
cp .env.example .env        # fill in your values
npx prisma migrate dev       # creates tables
npm run dev                  # starts server on :3000

# 4. Frontend setup (once scaffolded)
cd ../frontend
npm install
npm run dev
```

### Environment Variables (backend/.env)
```
DATABASE_URL="postgresql://vinyl:vinyl_dev@localhost:5432/vinyl_store?schema=public"
JWT_SECRET=your_jwt_secret_here
PORT=3000
```

---

## Roles

- **Customer** — browse, cart, order, rate/comment, wish list, returns
- **Sales Manager** — pricing, discounts, invoices, revenue/loss reporting
- **Product Manager** — products, categories, stock, deliveries, comment approval
- **Support Agent** — live chat support, customer context

---

## Team

| Name | Role |
|---|---|
| **Syeda Manaal Amir** | Scrum Master, Backend Developer |
| **Sedra Alyousef** | Product Owner, Backend Developer |
| **Ayesha Musharaf** | Backend Developer |
| **Rand M O Khaled** | Frontend Developer |
| **Khadija Gulieyva** | Frontend Developer |
| **Salma Tubail** | Frontend Developer |



## Development Workflow

- **Methodology:** Scrum, 2-week sprints with overlapping planning
- **Branching:** `main` protected; feature branches `feature/<name>`; PR required to merge
- **Board:** GitHub Projects (Sprint 1 column active)
- **Labels:** `story`, `bug`, `sprint-1`, `progress-demo`
- **Definition of Done:** PR reviewed by cross-review partner + tests passing in CI + acceptance criteria verified + no console errors + works in local Docker

### Testing
- Authors write unit tests for their own code (counts toward ≥25 tests/demo)
- Rotating QA person does manual/integration testing and files bug reports
- Bug reports tracked as GitHub Issues with `bug` label

---



## License

Course project — not for distribution.
