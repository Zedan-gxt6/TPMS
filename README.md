# 🌱 TPMS — Tree Plantation Management System

A full-stack web application for managing tree plantation activities across multiple zones. Built with **Node.js**, **Express**, **EJS**, and **PostgreSQL**.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Routes Reference](#routes-reference)
- [Role-Based Access](#role-based-access)
- [Screenshots](#screenshots)

---

## Overview

TPMS helps organizations track and manage tree saplings planted across different geographical zones. It supports two user roles — **Admin** and **Field User** — with different levels of access. Admins can directly manage all data, while field users submit requests that admins review and approve or decline.

---

## Features

### Admin
- Manage **zones**, **species**, **saplings**, and **maintenance** logs directly
- View and **approve / decline** user requests (zone, species, maintenance)
- Access **reports**: sapling count per zone and survival rate analysis
- Manage all **users**

### Field User
- View all zones, species, and saplings
- Submit requests to add zones, species, and maintenance logs
- Track their own saplings and maintenance history
- Receive **notifications** when requests are approved or declined

### General
- Role-based login (Admin / Field User)
- User signup (defaults to Field User role)
- Responsive UI with Poppins font and Font Awesome icons

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Template engine | EJS |
| Database | PostgreSQL |
| DB client | `pg` (node-postgres) |
| Middleware | body-parser, cors, method-override |
| Styling | Custom CSS + Google Fonts + Font Awesome |

---

## Project Structure

```
TPMS/
├── server.js               # Main application — all routes and DB logic
├── package.json
├── public/
│   ├── styles.css          # Global stylesheet
│   └── planting-small-tree-stockcake.webp
└── views/
    ├── partials/
    │   ├── header.ejs      # Navbar + HTML head
    │   └── footer.ejs      # Closing tags
    ├── index.ejs           # Dashboard (home)
    ├── login.ejs           # Login page
    ├── signup.ejs          # Sign up page
    ├── zones.ejs           # Zones management
    ├── species.ejs         # Species management
    ├── saplings.ejs        # Saplings management
    ├── maintenance.ejs     # Maintenance logs
    ├── reports.ejs         # Admin reports
    ├── requests.ejs        # Admin request management
    ├── notifications.ejs   # User notifications
    └── users.ejs           # User list (admin)
```

---

## Database Schema

The application expects a PostgreSQL database named **`TPMS`** with the following tables:

### Core tables

```sql
-- Users
CREATE TABLE users (
  user_id   SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  email     TEXT UNIQUE NOT NULL,
  password  TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'user'  -- 'admin' or 'user'
);

-- Zones
CREATE TABLE zones (
  zone_id  SERIAL PRIMARY KEY,
  area     TEXT NOT NULL
);

-- Species
CREATE TABLE species (
  species_id        SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  scientific_name   TEXT,
  growth_type       TEXT,
  average_lifespan  INTEGER
);

-- Saplings
CREATE TABLE saplings (
  sapling_id  SERIAL PRIMARY KEY,
  species_id  INTEGER REFERENCES species(species_id),
  zone_id     INTEGER REFERENCES zones(zone_id),
  user_id     INTEGER REFERENCES users(user_id),
  plant_date  DATE,
  status      TEXT,   -- 'Alive', 'Dead', 'Diseased'
  height      NUMERIC
);

-- Maintenance logs
CREATE TABLE maintenance (
  maintenance_id  SERIAL PRIMARY KEY,
  sapling_id      INTEGER REFERENCES saplings(sapling_id),
  user_id         INTEGER REFERENCES users(user_id),
  date            DATE,
  activity        TEXT,
  remarks         TEXT
);

-- Notifications
CREATE TABLE notifications (
  notification_id  SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES users(user_id),
  message          TEXT,
  created_at       TIMESTAMP DEFAULT NOW()
);
```

### Request tables (pending approvals)

```sql
CREATE TABLE zone_requests (
  request_id  SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(user_id),
  area        TEXT
);

CREATE TABLE species_requests (
  request_id        SERIAL PRIMARY KEY,
  user_id           INTEGER REFERENCES users(user_id),
  name              TEXT,
  scientific_name   TEXT,
  growth_type       TEXT,
  average_lifespan  INTEGER
);

CREATE TABLE maintenance_requests (
  request_id  SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(user_id),
  sapling_id  INTEGER,
  date        DATE,
  activity    TEXT,
  remarks     TEXT
);
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL installed and running

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd TPMS
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up the database

Create the database and run the schema:

```bash
psql -U postgres -c "CREATE DATABASE TPMS;"
psql -U postgres -d TPMS -f schema.sql   # paste the SQL from above
```

### 4. Configure the database connection

Open `server.js` and update the pool config with your own credentials:

```js
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "TPMS",
  password: "your_password_here",   // change this
  port: 5432,
});
```

> **Note:** For production, move credentials to a `.env` file and use `process.env` — never hardcode passwords.

### 5. Start the server

```bash
npm start
```

Visit **http://localhost:3000** in your browser.

### 6. Create your first admin user

Sign up normally at `/signup`, then manually update the role in the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## Routes Reference

### Auth

| Method | Route | Description |
|---|---|---|
| GET | `/` | Login page |
| POST | `/` | Submit login |
| GET | `/signup` | Sign up page |
| POST | `/signup` | Create account |
| GET | `/home` | Dashboard |

### Zones

| Method | Route | Description | Role |
|---|---|---|---|
| GET | `/zones` | View all zones | All |
| POST | `/zones` | Add zone directly | Admin |
| POST | `/zones/update/:id` | Edit zone | Admin |
| POST | `/zones/request` | Request new zone | User |

### Species

| Method | Route | Description | Role |
|---|---|---|---|
| GET | `/species` | View all species | All |
| POST | `/species` | Add species directly | Admin |
| POST | `/species/request` | Request new species | User |

### Saplings

| Method | Route | Description | Role |
|---|---|---|---|
| GET | `/saplings` | View saplings | All (filtered by role) |
| POST | `/saplings` | Add sapling | Admin |
| POST | `/saplings/update/:id` | Update sapling status | Admin |

### Maintenance

| Method | Route | Description | Role |
|---|---|---|---|
| GET | `/maintenance` | View maintenance logs | All (filtered by role) |
| POST | `/maintenance` | Add log directly | Admin |
| POST | `/maintenance/request` | Request maintenance log | User |

### Reports (Admin only)

| Method | Route | Description |
|---|---|---|
| GET | `/reports` | Full report page |
| GET | `/reports/zones` | Zone sapling counts (JSON) |
| GET | `/reports/survival` | Survival rate per zone (JSON) |

### Requests (Admin only)

| Method | Route | Description |
|---|---|---|
| GET | `/requests` | View all pending requests |
| POST | `/requests/zones/:id/:action` | Accept or decline zone request |
| POST | `/requests/species/:id/:action` | Accept or decline species request |
| POST | `/requests/maintenance/:id/:action` | Accept or decline maintenance request |

### Notifications (Users)

| Method | Route | Description |
|---|---|---|
| GET | `/notifications` | View notifications |
| POST | `/notifications/clear` | Clear all notifications |

---

## Role-Based Access

| Feature | Admin | Field User |
|---|---|---|
| View zones, species, saplings | ✅ | ✅ |
| Add / edit data directly | ✅ | ❌ |
| Submit requests | ❌ | ✅ |
| Approve / decline requests | ✅ | ❌ |
| View all saplings (any user) | ✅ | Optional (`?view=all`) |
| View own saplings only | ✅ | ✅ (default) |
| Access reports | ✅ | ❌ |
| Manage users page | ✅ | ❌ |
| Receive notifications | ❌ | ✅ |

---

## Known Limitations

- **No session management** — the current user is stored in a server-side variable (`currentUser`), which means all users share the same session. This is fine for local/demo use but not suitable for production with multiple concurrent users. Replace with `express-session` or JWT-based auth.
- **Passwords stored in plain text** — use `bcrypt` before deploying.
- **DB credentials hardcoded** — move to `.env` using the `dotenv` package.

---

## License

ISC
