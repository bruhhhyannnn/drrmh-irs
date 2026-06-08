# UPM DRRM-H — Incident Reporting System

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-2-3ECF8E?logo=supabase)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-5-396CB2?logo=mapbox)](https://maplibre.org/)
[![PWA](https://img.shields.io/badge/PWA-enabled-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## **Web Dashboard for the UP Manila Disaster Risk Reduction and Management in Health Incident Reporting System**

---

## About

This is the **admin web dashboard** for the UPM DRRM-H Incident Reporting System — a platform designed to manage, monitor, and analyze incident reports submitted by field teams across the UP Manila campus during drills, emergencies, and other DRRM-H-related events.

The system works alongside a companion Flutter mobile app used by field personnel to submit real-time reports. Data flows from the mobile app into Supabase, and this dashboard gives administrators a centralized view of all incidents, headcounts, drill statuses, and post-event summaries.

### What it does

- **Dashboard** — Live stats on events, reports, and affected personnel with charts
- **Events** — Track drills and incidents from creation to resolution
- **Event Details** — Per-cluster headcount board with casualty and missing person breakdowns
- **Reports** — View and search submitted field reports with full headcount details and GPS-pinned location
- **Bystander Reports** — Public incident submissions with location, incident type, and casualty details
- **Users** — Manage field team accounts, roles, and access levels
- **Calendar** — Visual monthly timeline of all events
- **Activity Logs** — Full audit trail of all system actions
- **News** — Post announcements and advisories for field teams
- **Settings** — Configure clusters, units, locations, positions, user types, event statuses, casualty conditions, and damage conditions

### System Context

The IRS is part of a broader DRRM-H platform consisting of:

| Component          | Description                         |
| ------------------ | ----------------------------------- |
| **This repo**      | Admin web dashboard (Next.js)       |
| Flutter mobile app | Field team incident submission      |
| Supabase           | Shared PostgreSQL database and auth |

---

## Tech Stack

| Category               | Technology                      |
| ---------------------- | ------------------------------- |
| **Framework**          | Next.js 16 (App Router)         |
| **Language**           | TypeScript 5                    |
| **Styling**            | Tailwind CSS v4                 |
| **Database**           | Supabase (PostgreSQL)           |
| **Auth**               | Supabase Auth                   |
| **ORM**                | Prisma 7                        |
| **State Management**   | Zustand 5                       |
| **Data Fetching**      | TanStack Query v5 (React Query) |
| **Table**              | TanStack Table v8               |
| **Forms & Validation** | React Hook Form 7 + Zod 3       |
| **Charts**             | Recharts 3                      |
| **Maps**               | MapLibre GL 5 + Nominatim       |
| **Date Utilities**     | date-fns 4                      |
| **Notifications**      | React Hot Toast                 |
| **Icons**              | Lucide React + HugeIcons        |
| **Email**              | Nodemailer 8                    |
| **PWA**                | @ducanh2912/next-pwa            |

---

## Setting It Up

### Prerequisites

- Node.js v18 or higher
- A Supabase project with the IRS database schema applied

### Installation

1 **Clone the repository**

```bash
git clone https://github.com/your-org/upm-drrm-irs.git
cd upm-drrm-irs
```

2 **Install dependencies**

```bash
npm install
```

3 **Set up environment variables**

```bash
cp .env.local.example .env.local
```

Fill in your credentials in `.env.local`:

```env
# Supabase — used for auth and the client-side SDK
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Prisma — direct database connection for server actions
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# Site URL — used for OAuth redirect callbacks
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

4 **Generate the Prisma client**

```bash
npx prisma generate
```

5 **Push the schema to the database** _(skip if the schema is already applied)_

```bash
npx prisma db push
```

6 **Seed lookup data** _(optional — populates default clusters, positions, etc.)_

```bash
npx prisma db seed
```

7 **Start the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```bash
src/
├── app/                    # Next.js App Router pages
│   ├── (admin)/            # Protected admin routes
│   │   ├── page.tsx        # Dashboard
│   │   ├── events/         # Events list + detail view
│   │   ├── reports/        # Incident reports table
│   │   ├── users/          # User management
│   │   ├── activity-logs/  # Audit log viewer
│   │   ├── calendar/       # Monthly event calendar
│   │   ├── news/           # Announcements
│   │   └── settings/       # Lookup table management
│   ├── (auth)/             # Sign-in page
│   └── (public)/           # Publicly accessible pages
│       ├── report/         # ERT Member report submission (QR-accessible)
│       └── bystander-report/ # Public bystander incident form
├── actions/                # Next.js server actions — all DB access via Prisma
├── components/
│   ├── auth/               # AuthProvider, ProtectedRoute
│   ├── layout/             # Sidebar, header, backdrop
│   ├── ui/                 # Base UI components (DataTable, Badge, Button, Map, etc.)
│   ├── settings/           # Generic SettingsTablePage + SettingsForm
│   ├── users/              # UserForm
│   └── news/               # NewsForm
├── generated/              # Prisma-generated client (auto-generated, do not edit)
├── hooks/                  # TanStack Query hooks (one file per domain)
├── lib/                    # Prisma client, Supabase client, Zod schemas, utils
├── store/                  # Zustand stores (auth, sidebar, theme)
└── types/                  # Shared constants and TypeScript types
```

---

## Roles & Access

| Role                 | Access                                                             |
| -------------------- | ------------------------------------------------------------------ |
| **Super Admin**      | Full access — all pages including users and settings               |
| **Administrator**    | Dashboard, events, reports, calendar, news, activity logs          |
| **ERT Member**       | Public `/report` page — submit incident reports via web or QR code |
| **Public/Bystander** | `/bystander-report` — anonymous incident reporting via QR code     |

---

## System Architecture Diagram

```mermaid
---
config:
  layout: dagre
  look: handDrawn
  theme: default
---
graph LR
  admin[<b>Admin</b>]
  fieldUser[<b>Field User</b>]

  subgraph IRS[<b>IRS Platform</b>]
    webApp[<b>Web Dashboard</b><br/>Next.js 16 — admin monitoring and management]
    mobileApp[<b>Flutter Mobile App</b><br/>Field team incident submission]
  end

  supabase[(<i><small>external_system</small></i><br/>Supabase<br/>PostgreSQL + Auth + Realtime)]
  email[<i><small>external_system</small></i><br/>Email Service<br/>SMTP]
  officeServer[<i><small>external_system</small></i><br/>Office Server]

  admin -->|HTTPS| webApp
  fieldUser -->|Mobile| mobileApp

  webApp -->|Server Actions via Prisma| supabase
  webApp -->|Supabase Auth SDK| supabase
  mobileApp -->|Submit Reports| supabase

  webApp -->|Notifications| email
  webApp -->|Deployment| officeServer
```

## Use-Case Diagram — Web

```mermaid
---
config:
  layout: elk
  look: handDrawn
  theme: default
---
flowchart LR
 subgraph AUTH["Authentication"]
        UC1["Sign In"]
        UC2["Sign Out"]
  end
 subgraph DASHBOARD["Dashboard"]
        UC14["View Summary Statistics"]
        UC15["View Reports by Cluster Chart"]
        UC16["View Events by Status Chart"]
        UC17["View Recent Events"]
  end
 subgraph EVENTS["Event Management"]
        UC3["View All Events"]
        UC4["View Event Details"]
        UC5["Create Event"]
        UC6["Update Event Status"]
        UC7["Search & Filter Events"]
  end
 subgraph REPORTS["Report Management"]
        UC8["View All Reports"]
        UC9["Search & Filter Reports"]
        UC10["View Reports by Event"]
        UC11["View Headcount & Casualty Breakdown"]
  end
 subgraph USERS["User Management"]
        UC18["View All Users"]
        UC19["Create User"]
        UC20["Edit User"]
        UC21["Toggle User Status"]
        UC22["Search Users"]
  end
 subgraph NEWS["News & Announcements"]
        UC23["View News List"]
        UC24["Create News"]
        UC25["Edit News"]
        UC26["Delete News"]
  end
 subgraph CALENDAR["Calendar"]
        UC28["View Events Calendar"]
        UC29["Browse by Month"]
  end
 subgraph LOGS["Activity Logs"]
        UC30["View Activity Logs"]
        UC31["Search Logs"]
  end
 subgraph SETTINGS["Settings"]
        UC32["Manage Clusters"]
        UC33["Manage Units"]
        UC34["Manage Locations"]
        UC35["Manage Positions"]
        UC36["Manage User Types"]
        UC37["Manage Event Statuses"]
        UC38["Manage Casualty Conditions"]
        UC39["Manage Damage Conditions"]
  end
    Admin(["Administrator\n(Web)"]) --- AUTH & DASHBOARD & EVENTS & REPORTS & NEWS & CALENDAR & LOGS
    SuperAdmin(["Super Admin\n(Web)"]) --- AUTH & DASHBOARD & EVENTS & REPORTS & USERS & NEWS & CALENDAR & LOGS & SETTINGS
    UC3 -- includes --> UC4 & UC7
    UC4 -- includes --> UC10 & UC11
    UC8 -- includes --> UC9
```

## Use-Case Diagram — Mobile

```mermaid
---
config:
  layout: elk
  look: handDrawn
  theme: default
---
flowchart LR
 subgraph AUTH["Authentication"]
        UC1["Sign In"]
        UC2["Sign Out"]
  end
 subgraph REPORTS["Report Management"]
        UC12["Submit Incident Report"]
        UC13["Edit Submitted Report"]
  end
 subgraph NEWS["News & Announcements"]
        UC27["View News on Mobile"]
  end
 subgraph MOBILE["Mobile Only"]
        UC40["View Calendar & Events"]
        UC41["View Submitted Reports"]
        UC42["View Profile"]
        UC43["View FAQs"]
  end
    ERT(["ERT Member (Mobile)"]) --- AUTH & UC12 & UC13 & UC27 & MOBILE
    UC12 -- extends --> UC13
```

## Entity Relationship Diagram

```mermaid
---
config:
  layout: elk
  look: handDrawn
  theme: default
---
erDiagram
  users {
    uuid id PK
    uuid auth_id UK
    string username UK
    string email UK
    string first_name
    string middle_name
    string last_name
    string suffix
    uuid unit_id FK
    uuid position_id FK
    uuid user_type_id FK
    bool is_active
    timestamptz created_at
  }

  events {
    uuid id PK
    uuid user_id FK
    uuid status_id FK
    uuid location_id FK
    string name
    string description
    string quarter
    timestamptz started_at
    timestamptz ended_at
    timestamptz created_at
  }

  reports {
    uuid id PK
    uuid event_id FK
    uuid user_id FK
    uuid cluster_id FK
    uuid unit_id FK
    uuid damage_condition_id FK
    int faculty_members
    int admin_members
    int reps_members
    int ra_members
    int students
    int philcare_staff
    int security_personnel
    int construction_workers
    int tenants
    int health_workers
    int non_academic_staff
    int guests
    decimal latitude
    decimal longitude
    string location_name
    timestamptz submitted_at
    timestamptz created_at
  }

  report_casualties {
    uuid id PK
    uuid report_id FK
    uuid bystander_report_id FK
    uuid condition_id FK
    string name
    int age
    string sex
    timestamptz created_at
  }

  report_missing_persons {
    uuid id PK
    uuid report_id FK
    uuid bystander_report_id FK
    string name
    int age
    string sex
    timestamptz created_at
  }

  bystander_reports {
    uuid id PK
    uuid cluster_id FK
    uuid unit_id FK
    uuid incident_type_id FK
    uuid status_id FK
    uuid damage_condition_id FK
    decimal latitude
    decimal longitude
    string location_description
    string description
    timestamptz submitted_at
    timestamptz created_at
  }

  bystander_incident_types {
    uuid id PK
    string name UK
    bool is_active
    timestamptz created_at
  }

  bystander_report_statuses {
    uuid id PK
    string name UK
    bool is_active
    timestamptz created_at
  }

  clusters {
    uuid id PK
    string name UK
    bool is_active
    timestamptz created_at
  }

  units {
    uuid id PK
    string name
    uuid cluster_id FK
    bool is_active
    timestamptz created_at
  }

  locations {
    uuid id PK
    string name
    uuid cluster_id FK
    bool is_active
    timestamptz created_at
  }

  positions {
    uuid id PK
    string name UK
    bool is_active
    timestamptz created_at
  }

  user_types {
    uuid id PK
    string name UK
    bool is_active
    timestamptz created_at
  }

  event_statuses {
    uuid id PK
    string name UK
    bool is_active
    timestamptz created_at
  }

  casualty_conditions {
    uuid id PK
    string name UK
    bool is_active
    timestamptz created_at
  }

  damage_conditions {
    uuid id PK
    string name UK
    bool is_active
    timestamptz created_at
  }

  news {
    uuid id PK
    string title
    string content
    string author
    bool is_active
    string image_url
    string source_url
    timestamptz published_at
    timestamptz created_at
  }

  activity_logs {
    uuid id PK
    uuid user_id FK
    string user_email
    string action
    string module
    string doc_id
    string doc_name
    string status
    json data
    timestamptz created_at
  }

  clusters ||--o{ units : "contains"
  clusters ||--o{ locations : "contains"
  clusters ||--o{ reports : "tagged_on"
  clusters ||--o{ bystander_reports : "tagged_on"
  units ||--o{ users : "belongs_to"
  units ||--o{ reports : "tagged_on"
  units ||--o{ bystander_reports : "tagged_on"
  positions ||--o{ users : "held_by"
  user_types ||--o{ users : "classifies"
  users ||--o{ reports : "submits"
  users ||--o{ events : "creates"
  users ||--o{ activity_logs : "initiates"
  event_statuses ||--o{ events : "classifies"
  locations ||--o{ events : "hosts"
  events ||--o{ reports : "has"
  reports ||--o{ report_casualties : "has"
  reports ||--o{ report_missing_persons : "has"
  bystander_reports ||--o{ report_casualties : "has"
  bystander_reports ||--o{ report_missing_persons : "has"
  bystander_incident_types ||--o{ bystander_reports : "classifies"
  bystander_report_statuses ||--o{ bystander_reports : "classifies"
  casualty_conditions ||--o{ report_casualties : "classifies"
  damage_conditions ||--o{ reports : "classifies"
  damage_conditions ||--o{ bystander_reports : "classifies"
```

## Flowchart — Report Submission

```mermaid
---
config:
  layout: dagre
  look: handDrawn
  theme: default
---
flowchart TD
  A([Field User opens mobile app]) --> B[Selects active event]
  B --> C[Fills in incident report form]
  C --> D{Form valid?}
  D -- No --> C
  D -- Yes --> E[Submits report]
  E --> F[(Supabase — reports table)]
  F --> G[Real-time subscription triggers]
  G --> H[Web dashboard updates]
  H --> I[Admin views reports page]
  I --> J{Action needed?}
  J -- View details --> K[Admin opens event details page]
  J -- Review data --> L[Admin reviews headcount and casualties]
  J -- No action --> M([End])
  K --> M
  L --> M
```

---

## Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
npm run lint:fix   # Auto-fix ESLint issues
npm run seed       # Seed lookup data (clusters, positions, event types, etc.)
```

---

## Developer

**Bryan Mangapit** — Lead Developer
[bruhhhyannnn.framer.website](https://bruhhhyannnn.framer.website) · [GitHub](https://github.com/bruhhhyannnn) · [LinkedIn](https://linkedin.com/in/bryanmangapit)
**Yoshilyn Fujitani** — Lead Developer
[yoshilyn.netlify.app](https://yoshilyn.netlify.app) · [GitHub](https://github.com/yoshilynfujitani) · [LinkedIn](https://linkedin.com/in/yoshilyn-fujitani)

---

## License

MIT © 2026 Bryan Jesus Mangapit · UP Manila DRRM-H
