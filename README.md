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

This is the **admin web dashboard** for the UPM DRRM-H Incident Reporting System — a centralized web platform designed to manage, monitor, and analyze incident reports submitted by field teams across the UP Manila campus during drills, emergencies, and other DRRM-H-related events.

Field teams and bystanders submit reports directly through the web app (including QR-accessible public forms), with data flowing into Supabase. This dashboard gives administrators a centralized view of all incidents, headcounts, drill statuses, and post-event summaries.

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

The IRS is a centralized web platform consisting of:

| Component     | Description                   |
| ------------- | ----------------------------- |
| **This repo** | Admin web dashboard (Next.js) |
| Supabase      | PostgreSQL database and auth  |

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

## Roles & Access

| Role                 | Access                                                             |
| -------------------- | ------------------------------------------------------------------ |
| **Super Admin**      | Full access — all pages including users and settings               |
| **Administrator**    | Dashboard, events, reports, calendar, news, activity logs          |
| **ERT Member**       | Public `/report` page — submit incident reports via web or QR code |
| **Public/Bystander** | `/bystander-report` — anonymous incident reporting via QR code     |

---

## C4 Diagram — System Context

```mermaid
---
config:
  layout: dagre
  look: handDrawn
  theme: default
---
graph LR
  admin[<b>Administrator / Super Admin</b><br/><small>Manages events, reports, users, and settings</small>]
  ertMember[<b>ERT Member / Bystander</b><br/><small>Submits incident and bystander reports, including via QR code</small>]

  subgraph SYSTEM[<b>System</b>]
    irs[<b>IRS Web Dashboard</b><br/><small>Next.js web platform for managing and monitoring DRRM-H incidents and drills</small>]
  end

  supabase[(<i><small>external_system</small></i><br/>Supabase<br/>PostgreSQL + Auth + Realtime)]
  vercel[<i><small>external_system</small></i><br/>Vercel]

  admin -->|HTTPS| irs
  ertMember -->|HTTPS| irs

  irs -->|Reads/writes data, authenticates users| supabase
  irs -->|Deployment| vercel
```

## C4 Diagram — Containers

```mermaid
---
config:
  layout: dagre
  look: handDrawn
  theme: default
---
graph LR
  admin[<b>Administrator / Super Admin</b>]
  ertMember[<b>ERT Member / Bystander</b>]

  subgraph IRS[<b>IRS Web Dashboard</b>]
    webApp[<b>Web Application</b><br/><small>Next.js 16 App Router — renders the admin dashboard and public/ERT report forms</small>]
    serverActions[<b>Server Actions</b><br/><small>Next.js Server Actions + Prisma — business logic and all DB reads/writes</small>]
    authClient[<b>Auth Client</b><br/><small>Supabase JS SDK — sign-in/out and session state</small>]
  end

  db[(<i><small>external_system</small></i><br/>Database<br/>Supabase PostgreSQL)]
  supaAuth[<i><small>external_system</small></i><br/>Supabase Auth<br/>Google OAuth — @up.edu.ph only]
  vercel[<i><small>external_system</small></i><br/>Vercel]


  admin -->|HTTPS| webApp
  ertMember -->|HTTPS| webApp

  webApp -->|Invokes| serverActions
  webApp -->|Uses| authClient

  serverActions -->|Reads/writes via Prisma| db
  authClient -->|Authenticates| supaAuth
  webApp -->|Deployment| vercel
```

---

## Flowchart — Report Submission

```mermaid
---
config:
  layout: dagre
  look: handDrawn
  theme: default
---
flowchart TD
  A([Field User opens web app]) --> B[Selects active event]
  B --> C[Fills in incident report form]
  C --> D{Form valid?}
  D -- No --> C
  D -- Yes --> E[Submits report]
  E --> F[(Supabase — reports table)]
  F --> G[Real-time subscription triggers]
  G --> H[Web dashboard updates]
  H --> I[Admin views reports page]
  I --> K[Admin opens event details page]
  I --> L[Admin reviews headcount and casualties]
  K --> M([End])
  L --> M
```

---

## Use-Case Diagram — Super Admin

```mermaid
---
config:
  layout: elk
  look: handDrawn
  theme: default
---
flowchart TB
    Actor(["Super Admin"]) --- UC_Dash(("view dashboard<br>statistics")) & UC_Campuses(("view all<br>campuses")) & UC_Clusters(("view all<br>clusters")) & UC_Events(("view all<br>events")) & UC_Reports(("view all<br>reports")) & UC_Users(("view all<br>users")) & UC_Bystander(("view all<br>bystander reports")) & UC_Units(("view all<br>units")) & UC_Positions(("view all<br>positions")) & UC_Casualty(("view all<br>casualty conditions")) & UC_Damage(("view all<br>damage conditions")) & UC_SignIn(("sign-in")) & UC_SignOut(("sign-out"))
    UC_Dash -. include .-> UC_Recent(("view recent<br>events")) & UC_Calendar(("view events<br>on calendar"))
    UC_CampusCreate(("create campus")) -. extend .-> UC_Campuses
    UC_CampusEdit(("edit campus")) -. extend .-> UC_Campuses
    UC_CampusDelete(("delete campus")) -. extend .-> UC_Campuses
    UC_CampusDetails(("view campus<br>details")) -. extend .-> UC_Campuses
    UC_ClusterCreate(("create cluster")) -. extend .-> UC_Clusters
    UC_ClusterEdit(("edit cluster")) -. extend .-> UC_Clusters
    UC_ClusterDelete(("delete cluster")) -. extend .-> UC_Clusters
    UC_EventCreate(("create event")) -. extend .-> UC_Events
    UC_EventEdit(("edit event")) -. extend .-> UC_Events
    UC_EventDelete(("delete event")) -. extend .-> UC_Events
    UC_EventDetails(("view event<br>details")) -. extend .-> UC_Events
    UC_ReportCreate(("create report")) -. extend .-> UC_Reports
    UC_ReportEdit(("edit report")) -. extend .-> UC_Reports
    UC_ReportDelete(("delete report")) -. extend .-> UC_Reports
    UC_UserCreate(("create user")) -. extend .-> UC_Users
    UC_UserEdit(("edit user")) -. extend .-> UC_Users
    UC_UserDelete(("delete user")) -. extend .-> UC_Users
    UC_BystanderVerify(("verify/dismiss<br>bystander report")) -. extend .-> UC_Bystander
    UC_BystanderDelete(("delete bystander<br>report")) -. extend .-> UC_Bystander
    UC_UnitCreate(("create unit")) -. extend .-> UC_Units
    UC_UnitEdit(("edit unit")) -. extend .-> UC_Units
    UC_UnitDelete(("delete unit")) -. extend .-> UC_Units
    UC_PositionCreate(("create position")) -. extend .-> UC_Positions
    UC_PositionEdit(("edit position")) -. extend .-> UC_Positions
    UC_PositionDelete(("delete position")) -. extend .-> UC_Positions
    UC_CasualtyCreate(("create casualty<br>condition")) -. extend .-> UC_Casualty
    UC_CasualtyEdit(("edit casualty<br>condition")) -. extend .-> UC_Casualty
    UC_CasualtyDelete(("delete casualty<br>condition")) -. extend .-> UC_Casualty
    UC_DamageCreate(("create damage<br>condition")) -. extend .-> UC_Damage
    UC_DamageEdit(("edit damage<br>condition")) -. extend .-> UC_Damage
    UC_DamageDelete(("delete damage<br>condition")) -. extend .-> UC_Damage
    UC_SignIn -. include .-> UC_NewProfile(("new user<br>create profile"))
    UC_EditProfile(("edit profile")) -. extend .-> UC_NewProfile
```

## Use-Case Diagram — Admin

```mermaid
---
config:
  layout: elk
  look: handDrawn
  theme: default
---
flowchart TB
    Actor(["Admin"]) --- UC_Dash(("view filtered dashboard<br>statistics")) & UC_Events(("view filtered<br>events")) & UC_Clusters(("view filtered<br>clusters")) & UC_Reports(("view filtered<br>reports")) & UC_Users(("view filtered<br>users")) & UC_Bystander(("view filtered<br>bystander reports")) & UC_Units(("view filtered<br>units")) & UC_Positions(("view all<br>positions")) & UC_Casualty(("view all<br>casualty conditions")) & UC_Damage(("view all<br>damage conditions")) & UC_SignIn(("sign-in")) & UC_SignOut(("sign-out"))
    UC_Dash -. include .-> UC_Recent(("view recent<br>events")) & UC_Calendar(("view events<br>on calendar"))
    UC_EventCreate(("create event")) -. extend .-> UC_Events
    UC_EventEdit(("edit event")) -. extend .-> UC_Events
    UC_EventDelete(("delete event")) -. extend .-> UC_Events
    UC_EventDetails(("view event<br>details")) -. extend .-> UC_Events
    UC_ClusterCreate(("create cluster")) -. extend .-> UC_Clusters
    UC_ClusterEdit(("edit cluster")) -. extend .-> UC_Clusters
    UC_ClusterDelete(("delete cluster")) -. extend .-> UC_Clusters
    UC_ReportCreate(("create report")) -. extend .-> UC_Reports
    UC_ReportEdit(("edit report")) -. extend .-> UC_Reports
    UC_ReportDelete(("delete report")) -. extend .-> UC_Reports
    UC_UserCreate(("create user")) -. extend .-> UC_Users
    UC_UserEdit(("edit user")) -. extend .-> UC_Users
    UC_UserDelete(("delete user")) -. extend .-> UC_Users
    UC_BystanderVerify(("verify/dismiss<br>bystander report")) -. extend .-> UC_Bystander
    UC_BystanderDelete(("delete bystander<br>report")) -. extend .-> UC_Bystander
    UC_UnitCreate(("create unit")) -. extend .-> UC_Units
    UC_UnitEdit(("edit unit")) -. extend .-> UC_Units
    UC_UnitDelete(("delete unit")) -. extend .-> UC_Units
    UC_PositionCreate(("create position")) -. extend .-> UC_Positions
    UC_PositionEdit(("edit position")) -. extend .-> UC_Positions
    UC_PositionDelete(("delete position")) -. extend .-> UC_Positions
    UC_CasualtyCreate(("create casualty<br>condition")) -. extend .-> UC_Casualty
    UC_CasualtyEdit(("edit casualty<br>condition")) -. extend .-> UC_Casualty
    UC_CasualtyDelete(("delete casualty<br>condition")) -. extend .-> UC_Casualty
    UC_DamageCreate(("create damage<br>condition")) -. extend .-> UC_Damage
    UC_DamageEdit(("edit damage<br>condition")) -. extend .-> UC_Damage
    UC_DamageDelete(("delete damage<br>condition")) -. extend .-> UC_Damage
    UC_SignIn -. include .-> UC_NewProfile(("new user<br>create profile"))
    UC_EditProfile(("edit profile")) -. extend .-> UC_NewProfile
```

## Use-Case Diagram — ERT Member

```mermaid
---
config:
  layout: elk
  look: handDrawn
  theme: default
---
flowchart TB
    Actor(["ERT"]) --- UC_CreateReport(("create report")) & UC_SignIn(("sign-in/-sign-up")) & UC_SignOut(("sign-out"))
    UC_CreateReport -. extend .-> UC_ViewReport(("view created<br>report"))
    UC_AddMissing(("add missing<br>person")) -. extend .-> UC_ViewReport
    UC_AddCasualty(("add casualty")) -. extend .-> UC_ViewReport
    UC_SignIn -. include .-> UC_NewProfile(("new user<br>create profile"))
    UC_EditProfile(("edit profile")) -. extend .-> UC_NewProfile
```

## Use-Case Diagram — Bystander

```mermaid
---
config:
  layout: elk
  look: handDrawn
  theme: default
---
flowchart TB
    Actor(["Bystander"]) --- UC_ScanQR(("scan QR code")) & UC_Submit(("submit bystander<br>report"))
    UC_Submit -. include .-> UC_Location(("pin incident<br>location")) & UC_Type(("select incident<br>type"))
    UC_AddMissing(("add missing<br>person")) -. extend .-> UC_Submit
    UC_AddCasualty(("add casualty")) -. extend .-> UC_Submit
    UC_Offline(("save offline and<br>sync later")) -. extend .-> UC_Submit
```

---

## Sequence Diagrams

Simplified sequence diagrams for each role. "Server" means the Next.js Server Actions. "Database" means Supabase PostgreSQL, accessed through Prisma.

### All Signed-in Roles — Sign In with Google

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant App as Web App
    participant Auth as Supabase Auth
    participant S as Server
    participant DB as Database

    U->>App: Click "Continue with Google"
    App->>Auth: Sign in with Google (@up.edu.ph only)
    Auth-->>App: Session
    App->>S: Provision user account
    alt Not a @up.edu.ph email
        S-->>App: Rejected
        App-->>U: "Only UP accounts are allowed"
    else First sign-in
        S->>DB: Create user as ERT Member
    else Returning user
        S->>DB: Find existing user
    end
    S-->>App: User role
    alt Super Admin / Administrator
        App-->>U: Open Dashboard
    else ERT Member
        App-->>U: Open Report page
    end
```

### All Signed-in Roles — Sign Out

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant App as Web App
    participant Auth as Supabase Auth

    U->>App: Click "Sign out"
    App->>Auth: Sign out
    Auth-->>App: Session cleared
    App-->>U: Redirect to Sign-in page
```

### Bystander — Submit a Bystander Report

```mermaid
sequenceDiagram
    autonumber
    actor B as Bystander
    participant App as Web App
    participant Q as Device Storage (Offline Queue)
    participant S as Server
    participant DB as Database

    B->>App: Scan QR code and open the report form
    B->>App: Pin location, choose incident type, add details
    opt Missing persons or casualties
        B->>App: Add missing persons / casualties
    end
    B->>App: Submit
    alt Online
        App->>S: Create bystander report
        S->>DB: Save report (status: pending)
        App-->>B: "Report submitted"
    else Offline
        App->>Q: Save report on device
        App-->>B: "Saved — will send when back online"
    end
```

### ERT Member — Complete Profile (First Sign-in)

```mermaid
sequenceDiagram
    autonumber
    actor E as ERT Member
    participant App as Web App
    participant S as Server
    participant DB as Database

    App-->>E: Show "Complete your profile" form
    E->>App: Select campus, cluster, unit, and position
    App->>S: Save profile
    S->>DB: Update user (profile complete)
    S-->>App: Updated profile
    App-->>E: Show Report form
```

### ERT Member — Submit a Field Report

```mermaid
sequenceDiagram
    autonumber
    actor E as ERT Member
    participant App as Web App
    participant Q as Device Storage (Offline Queue)
    participant S as Server
    participant DB as Database

    E->>App: Open Report page
    App->>S: Load ongoing events for my campus
    S->>DB: Query ongoing events
    S-->>App: Events
    E->>App: Select event, pin location, enter headcount and damage
    opt Missing persons or casualties
        E->>App: Add missing persons / casualties
    end
    E->>App: Submit
    App->>App: Validate form
    alt Online
        App->>S: Create report
        S->>DB: Save report with headcount, casualties, missing persons
        App-->>E: "Report submitted"
    else Offline
        App->>Q: Save report on device
        App-->>E: "Saved — will send when back online"
    end
```

### ERT Member / Bystander — Sync Offline Reports

```mermaid
sequenceDiagram
    autonumber
    participant App as Web App
    participant Q as Device Storage (Offline Queue)
    participant S as Server
    participant DB as Database
    actor U as ERT Member / Bystander

    App->>App: Connection restored
    App->>Q: Get pending reports
    Q-->>App: Pending reports
    loop Each pending report
        App->>S: Create report
        alt Saved
            S->>DB: Save report
            App->>Q: Remove from device
        else Rejected by server
            App->>Q: Mark as failed
        end
    end
    App-->>U: "N offline reports submitted"
```

### ERT Member — View Submitted Report

```mermaid
sequenceDiagram
    autonumber
    actor E as ERT Member
    participant App as Web App
    participant S as Server
    participant DB as Database

    E->>App: Click "View Submission"
    App->>S: Get my report
    S->>DB: Query report details
    S-->>App: Report
    App-->>E: Show report details
    opt Update missing persons or casualties
        E->>App: Edit list and save
        App->>S: Replace missing persons / casualties
        S->>DB: Delete old entries, save new entries
        App-->>E: "Updated"
    end
```

### Administrator — Create and Manage an Event

```mermaid
sequenceDiagram
    autonumber
    actor A as Administrator
    participant App as Web App
    participant S as Server
    participant DB as Database

    A->>App: Open Events page and click "Create"
    A->>App: Enter name, quarter, status, and dates
    App->>S: Create event (for my campus)
    S->>DB: Save event
    S-->>App: New event
    App-->>A: Event listed
    opt Start or end the drill
        A->>App: Change status (e.g. Ongoing / Done)
        App->>S: Update event
        S->>DB: Save status
    end
```

### Administrator — Review Field Reports and Headcount

```mermaid
sequenceDiagram
    autonumber
    actor A as Administrator
    participant App as Web App
    participant S as Server
    participant DB as Database

    A->>App: Open Reports page
    App->>S: Get reports (filtered by campus)
    S->>DB: Query reports
    S-->>App: Reports
    App-->>A: Show reports list
    A->>App: Open event details
    App->>S: Get headcount, casualties, and damages for the event
    S->>DB: Query summary data
    S-->>App: Event summary
    App-->>A: Show event summary
    opt Fix a report
        A->>App: Edit or delete report
        App->>S: Update / delete report
        S->>DB: Save changes
    end
```

### Administrator — Verify a Bystander Report

```mermaid
sequenceDiagram
    autonumber
    actor A as Administrator
    participant App as Web App
    participant S as Server
    participant DB as Database

    A->>App: Open Emergency Reports page
    App->>S: Get bystander reports
    S->>DB: Query bystander reports
    S-->>App: Reports
    A->>App: Open a report
    alt Verify / Review / Dismiss
        A->>App: Choose new status
        App->>S: Update report status
        S->>DB: Save status
    else Delete
        A->>App: Delete report
        App->>S: Delete report
        S->>DB: Remove report
    end
    App-->>A: List updated
```

### Administrator — Manage Users

```mermaid
sequenceDiagram
    autonumber
    actor A as Administrator
    participant App as Web App
    participant S as Server
    participant Auth as Supabase Auth
    participant DB as Database

    A->>App: Open Users page and click "Create"
    A->>App: Enter user details and role
    App->>S: Create user
    S->>Auth: Create login account
    Auth-->>S: Auth ID
    S->>DB: Save user profile
    S-->>App: New user
    App-->>A: User listed
    opt Edit, deactivate, or delete
        A->>App: Choose action
        App->>S: Update / toggle status / delete user
        S->>DB: Save changes
    end
```

### Super Admin — Manage Campuses

Super Admins can do everything Administrators can, across all campuses. When they create an event they pick its campus.

```mermaid
sequenceDiagram
    autonumber
    actor SA as Super Admin
    participant App as Web App
    participant S as Server
    participant DB as Database

    SA->>App: Open Campus page
    App->>S: Get all campuses
    S->>DB: Query campuses
    S-->>App: Campuses
    alt Create / Edit / Delete campus
        SA->>App: Submit campus form
        App->>S: Save campus
        S->>DB: Insert / update / delete campus
    else View campus details
        SA->>App: Open a campus
        App->>S: Get campus clusters and events
        S->>DB: Query campus data
        S-->>App: Campus details
    end
    App-->>SA: Page updated
```

### Administrator / Super Admin — Manage Settings (Lookup Tables)

```mermaid
sequenceDiagram
    autonumber
    actor A as Administrator / Super Admin
    participant App as Web App
    participant S as Server
    participant DB as Database

    A->>App: Open Settings (clusters, units, positions, conditions, etc.)
    App->>S: Get items for the selected table
    S->>DB: Query table
    S-->>App: Items
    A->>App: Create, edit, or delete an item
    App->>S: Save item
    S->>DB: Insert / update / delete
    S-->>App: Updated list
    App-->>A: Table updated
```

---

## Entity Relationship Diagram

```mermaid
---
config:
  layout: elk
  look: handDrawn
  theme: default
---
erDiagram
  campus {
    uuid id PK
    string name
    bool is_active
  }

  clusters {
    uuid id PK
    string name UK
    uuid campus_id FK
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
    uuid cluster_id FK
    uuid campus_id FK
    bool is_active
    bool is_profile_complete
    timestamptz created_at
  }

  events {
    uuid id PK
    uuid user_id FK
    uuid status_id FK
    uuid campus_id FK
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
    string diagnosis
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

  campus ||--o{ clusters : "contains"
  campus ||--o{ events : "hosts"
  campus ||--o{ users : "scopes"
  clusters ||--o{ units : "contains"
  clusters ||--o{ users : "scopes"
  clusters ||--o{ reports : "tagged_on"
  clusters ||--o{ bystander_reports : "tagged_on"
  units ||--o{ users : "belongs_to"
  units ||--o{ reports : "tagged_on"
  units ||--o{ bystander_reports : "tagged_on"
  positions ||--o{ users : "held_by"
  user_types ||--o{ users : "classifies"
  users ||--o{ reports : "submits"
  users ||--o{ events : "creates"
  event_statuses ||--o{ events : "classifies"
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

---

## License

MIT © 2026 Bryan Jesus Mangapit · UP Manila DRRM-H
