# TrainOps - Trainer Scheduling & Management System

## Overview

TrainOps is a comprehensive web-based trainer scheduling and management application designed to streamline the assignment, tracking, and management of trainers for training programs. The system facilitates coordination between administrators, program managers, and trainers through real-time scheduling, clock-in/out tracking, and automated notifications.

## User Roles

The application supports three distinct user roles, each with specific permissions and capabilities:

### 1. **Admin**
Full system access with complete control over all features and data.

### 2. **Program Manager**
Manages trainers and training programs for assigned clients, approves clock requests, and monitors training activities.

### 3. **Trainer**
Views personal schedules, clocks in/out for training sessions, and manages their training assignments.

## Core Features

### Admin Features

#### 1. **Schedule Management** (`/admin/schedule`)
- **Calendar & Matrix Views**: Toggle between calendar and matrix views for schedule visualization
- **Matrix View**:
  - **Holiday styling**: Sundays and named holidays (from `data/holidays.js`) shown with distinct header style; cells for “available” on holidays use holiday color (slate) instead of green
  - **Category buttons**: Training Allocated, Non-Training Task, Leave, Available (and Holiday label). Click any category to open a **today’s list** popup with:
    - List for the selected category (trainers with training / non-training / leave / available today)
    - **Search** by name (and relevant fields: client, course, task, etc.)
    - Names in **alphabetical order**
    - Date in **DD/MM/YYYY** in the popup title
- **Create Assignments**:
  - Training assignments (with client, course, role, specialization)
  - Non-training assignments (with task type and description)
  - Leave assignments
  - Multi-date range scheduling with excluded dates
  - Program Manager assignment to tasks
- **Bulk Operations**: Edit or delete multiple assignments across date ranges; bulk select by day or by trainer
- **Quick Allocation**: Fast assignment creation with optional email notifications
- **Real-time Updates**: Live synchronization of schedule changes across all users
- **Search & Filter**: Advanced filtering by trainer, client, course, task type, role, date range, specialization (using managed tech stacks only)
- **Export**:
  - **Formats**: Excel (.xlsx), CSV (.csv), PDF (.pdf)
  - **Schedule types**: Include Training Schedule, Include Non-Training Schedule, **Include Available Schedule** (trainer–date slots with no assignment)
  - **Date range**: All time, Today, This week, This month, or custom range
  - **CSV**: UTF-8 with BOM, CRLF line endings, quoted fields for **Excel compatibility**
  - **Excel**: Separate sheets for Training, Non-Training, and Available (when selected); per-date columns with trainer status
  - **Options**: Show only scheduled tasks, filter by selected trainers

#### 2. **Trainer Management** (`/admin/trainers`) — Trainer Accounts
- **Trainer CRUD**: Create, read, update, and delete trainer profiles
- **Alphabetical order**: Trainer list sorted A–Z by name (always)
- **Search by name**: Text search to filter trainers by name
- **Training assigned filter**: Filter by **All**, **Has training assigned**, or **No training assigned** (based on schedule data)
- **No training assigned indicator**: Per-trainer badge beside Active/Verified when the trainer has no training assignment in the schedule
- **Tech Stack & Category filters**: Filter by managed tech stack and category (Internal/Freelancer); options use **managed tech stacks only** (see Manage Tech Stack)
- **Bulk Import/Export**: Excel-based bulk operations for trainer data
- **Trainer profiles**: Name, email, phone, specialization, experience, status (Active/Inactive), verification status
- **Manage Tech Stack**: Add, edit, remove tech stack options; this list is the **single source of truth** for tech stacks across the app (filters, dropdowns, Bulk Assignment, Assignments Dashboard, Schedule)
- **Sync with Auth**: Synchronize trainer accounts with Firebase Authentication
- **Onboarding Approvals**: Review and approve trainer onboarding requests
- **Invitation System**: Send invitations to trainers for account creation

#### 3. **Trainer Profiles** (`/admin/profiles`)
- Detailed trainer profile management
- Profile viewing and editing capabilities

#### 4. **Bulk Assignment** (`/admin/bulk-assignment`)
- Bulk create or update assignments across multiple trainers and date ranges
- Tech stack and other fields use **managed tech stacks only**

#### 5. **Assignments Dashboard** (`/admin/assignments-dashboard`)
- Overview of assignments with filters by client, trainer, **tech stack** (managed list only), category, type, and date range
- Available trainers modal; summary counts and pagination

#### 6. **Trainer Utilization** (`/admin/utilization`)
- **Analytics Dashboard**: View trainer utilization metrics
- **Time Period Analysis**: Filter by week, month, or custom date ranges
- **Utilization Metrics**: Calculate training days, utilization percentages
- **Export Reports**: Generate utilization reports in Excel format
- **Sorting & Filtering**: Sort by utilization, name, or training days

#### 7. **User Management** (`/admin/users`)
- **User CRUD**: Manage system users (admins, program managers, trainers)
- **Role Assignment**: Assign and modify user roles
- **User Status**: Activate/deactivate user accounts
- **Invitation System**: 
  - Send email invitations to new users
  - Bulk invitation via Excel upload
  - Track invitation status (pending, accepted, expired)
  - Resend invitations
- **Real-time Updates**: Live synchronization of user changes

#### 8. **Client Management** (`/admin/clients`)
- **Client CRUD**: Create, update, and delete client records
- **Program Manager Assignment**: Assign program managers to clients
- **Client Status**: Manage active/inactive client status
- **Pre-population**: Quick setup with sample client data

#### 9. **Clock Requests Management** (`/admin/clock-requests`)
- **Request Review**: View all clock-in/out requests from trainers
- **Approval/Rejection**: Approve or reject clock requests with notes
- **Request History**: Track all clock request activities
- **Location Tracking**: View location data for clock requests
- **Export**: Export clock request data to CSV/Excel
- **Real-time Updates**: Live updates of request status changes
- **Filtering**: Filter by status, trainer, date range

### Program Manager Features

#### 1. **Dashboard** (`/program-manager/dashboard`)
- **Overview Statistics**: 
  - Total assigned trainers
  - Total clients
  - Pending clock requests
  - Recent activity
- **Quick Actions**: Navigate to key features
- **Real-time Updates**: Live data synchronization

#### 2. **My Trainers** (`/program-manager/trainers`)
- View trainers assigned to their clients
- Monitor trainer schedules and activities
- Access trainer information and contact details

#### 3. **Request Approvals** (`/program-manager/requests`)
- **Clock Request Approval**: Review and approve/reject clock requests from trainers
- **Request Details**: View detailed information including location, timestamps
- **Approval Notes**: Add notes when approving requests
- **Rejection Management**: Reject requests with reasons, ability to revoke rejections

#### 4. **Request History** (`/program-manager/history`)
- View historical clock request approvals
- Track approval/rejection patterns
- Review past decisions

### Trainer Features

#### 1. **Schedule View** (`/trainer/schedule`)
- **Personal Calendar**: View assigned training and non-training tasks
- **Task Details**: Click tasks to view detailed information
- **Statistics Dashboard**: 
  - Total scheduled days
  - Training vs non-training breakdown
  - Upcoming assignments
- **Real-time Updates**: Instant updates when admin assigns new tasks
- **Location Permission**: Request location access for clock-in/out
- **Timezone Support**: Display dates in user's local timezone

#### 2. **Clock History** (`/trainer/history`)
- View personal clock-in/out history
- Track request status (pending, approved, rejected)
- View location data for clock events
- Filter by date range

#### 3. **Clock In/Out Functionality**
- **Location-based Clocking**: Clock in/out with GPS location tracking
- **Request System**: Submit clock requests for approval
- **Automatic Routing**: Requests automatically routed to assigned Program Managers
- **Status Tracking**: Real-time status updates for requests

#### 4. **Onboarding** (First-time trainers)
- **Onboarding Form**: Complete profile information
- **Status Tracking**: View onboarding approval status
- **Pending Approval**: Wait for admin approval before full access

## Technical Features

### Authentication & Security
- **Firebase Authentication**: Secure email/password authentication
- **Role-based Access Control**: Protected routes based on user roles
- **Session Management**:
  - Configurable session timeout (default 12 hours; override with `VITE_DEBUG_SESSION_MINUTES` for testing)
  - Idle timeout detection
  - Session warning before expiry with option to extend
  - Automatic logout on expiration
- **Account Status**: Real-time account deactivation handling
- **Password Reset**: Email-based password reset functionality

### Real-time Data Synchronization
- **Firestore Real-time Listeners**: Live updates across all users
- **Optimistic Updates**: Immediate UI updates for better UX
- **Conflict Resolution**: Handles concurrent edits gracefully

### Email Notifications
- **NodeMailer API Integration**: Automated email notifications via custom API endpoint
  - API endpoint configured via `VITE_EMAIL_API_URL` environment variable
  - API expects POST requests with JSON body: `{ toAddress, Subject, Body }`
  - Supports HTML email templates for rich formatting
- **Schedule Notifications**: Email alerts for new/updated/deleted assignments
- **Invitation Emails**: Automated user invitation emails with signup links
- **Clock Request Notifications**: Email alerts for clock request approvals/rejections
- **Password Reset**: Email-based password recovery (via Firebase Auth)

### Data Management
- **Firebase Firestore**: Cloud-based NoSQL database; schedule data stored by month to avoid document size limits
- **Single source for tech stacks**: “Manage Tech Stack” (Trainer Accounts) is the only list; used everywhere: Trainer Accounts filter, Schedule matrix/filters, Bulk Assignment, Assignments Dashboard
- **Excel Import/Export**: Bulk data operations via Excel files
- **PDF Generation**: Export schedules and reports to PDF
- **CSV export**: Excel-friendly CSV (UTF-8 BOM, CRLF, quoted fields) for schedule and clock data
- **Data Validation**: Comprehensive input validation and error handling

### Timezone Support
- **Timezone Awareness**: All dates stored in UTC, displayed in user's timezone
- **Date Range Handling**: Proper timezone conversion for date ranges
- **Holiday Management**: 
  - Excluded dates in schedule creation
  - **Sundays** and **named holidays** (e.g. from `data/holidays.js`) shown as holidays in matrix view
  - Holiday column styling and “available on holiday” shown in distinct color (not green)
  - Admin can still assign training/non-training on holiday days

### Location Services
- **GPS Tracking**: Location-based clock-in/out verification
- **Permission Management**: Browser location permission handling
- **Location Storage**: Store and display location data for clock events

### UI/UX Features
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Built with Tailwind CSS and Radix UI components
- **Animations**: Smooth transitions using Framer Motion
- **Loading States**: Skeleton loaders and loading indicators
- **Toast Notifications**: User-friendly feedback messages
- **Search & Filter**: Advanced search and filtering capabilities
- **Keyboard Navigation**: Accessible keyboard shortcuts

## Technology Stack

### Frontend
- **React 18**: UI framework
- **React Router**: Client-side routing
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **Framer Motion**: Animation library
- **date-fns**: Date manipulation and formatting
- **XLSX**: Excel file processing
- **@react-pdf/renderer**: PDF generation

### Backend & Services
- **Firebase Authentication**: User authentication
- **Cloud Firestore**: Real-time database
- **NodeMailer API**: Email service via custom API endpoint (`VITE_EMAIL_API_URL`)
- **Mapbox**: Location services (via `VITE_MAPBOX_ACCESS_TOKEN`)
- **Firebase Functions**: Serverless backend functions (optional)

### Development Tools
- **ESLint**: Code linting
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixing

## Key Workflows

### 1. Viewing Today’s Assignments by Category (Matrix View)
1. Admin opens Schedule and switches to Matrix view.
2. Clicks a category button (Training Allocated, Non-Training Task, Leave, or Available).
3. Popup shows today’s list for that category (alphabetically, with search).
4. Search filters by name and relevant fields; date is shown as DD/MM/YYYY.

### 2. Creating a Training Assignment
1. Admin navigates to Schedule page
2. Selects date range and excluded dates
3. Chooses trainer, client, course, role, specialization
4. Optionally assigns Program Managers
5. System creates assignment and sends email notification to trainer
6. Trainer sees assignment appear in real-time on their schedule

### 3. Trainer Clock-In Process
1. Trainer navigates to schedule page
2. Clicks clock-in button for a scheduled task
3. System requests location permission
4. Trainer's location is captured
5. Clock request is created and routed to assigned Program Manager
6. Program Manager reviews and approves/rejects
7. Trainer receives status update in real-time

### 4. User Invitation Flow
1. Admin creates invitation with email and role
2. System sends invitation email with signup link
3. User clicks link and completes signup
4. Account is created with assigned role
5. User can now log in and access role-specific features

### 5. Bulk Schedule Operations
1. Admin selects multiple assignments or date range
2. Chooses bulk edit or delete operation
3. System applies changes across all selected items
4. Email notifications sent for affected trainers
5. Real-time updates reflected across all users

## Data Models

### Schedule Assignment
- Date (or date range), Trainer, Client, Course
- Type (training / non-training / leave)
- Role, Specialization, Task Type, Tech Stack
- Description, Program Manager IDs
- Unique ID for tracking; “available” = no assignment for that trainer–date

### Clock Request
- Trainer ID, Date, Type (clock_in/clock_out)
- Location (latitude, longitude)
- Status (pending/approved/rejected)
- Timestamps, Approval information
- Rejection reason (if rejected)

### User
- UID, Email, Role
- Status (active/inactive)
- Onboarding status
- Profile information

### Trainer
- ID, Name, Email, Phone
- Specialization, Experience
- Status (Active/Inactive)
- Summary, Profile data

### Client
- ID, Name, Description
- Status (active/inactive)
- Program Manager IDs

## Performance Optimizations

- **Partial Firestore Updates**: Only update changed fields to reduce write operations
- **Real-time Subscriptions**: Efficient Firestore listeners with proper cleanup
- **Debounced Search**: Optimized search with debouncing
- **Memoization**: React memo and useMemo for expensive calculations
- **Lazy Loading**: Code splitting for better initial load times
- **Optimistic Updates**: Immediate UI feedback before server confirmation

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers supported
- Location services require HTTPS (or localhost for development)

## Quick Reference — Feature Summary

| Area | Features |
|------|----------|
| **Schedule** | Matrix/calendar views, holiday styling, category popups (today’s list + search), training/non-training/leave/available, bulk select & delete, export (Excel/CSV/PDF) with **Include Available** |
| **Trainer Accounts** | A–Z sort, search by name, “No training assigned” filter & badge, tech stack/category filters (managed stacks only) |
| **Tech Stacks** | Single list in Manage Tech Stack; used in Trainer Accounts, Schedule, Bulk Assignment, Assignments Dashboard |
| **Export** | Schedule types: Training, Non-Training, **Available**; date range; CSV CRLF + BOM for Excel; Excel multi-sheet |
| **Matrix** | Holiday columns (Sunday + named holidays), category buttons → today’s list popup (search, alphabetical, DD/MM/YYYY) |

## Deployment

- **Build**: `npm run build` generates production build in `dist/` folder
- **Firebase Hosting**: Configured for Firebase deployment
- **Environment Variables**: Required environment variables:
  - `VITE_EMAIL_API_URL`: NodeMailer API endpoint (e.g., `https://nodemailer-q13k.onrender.com/send`)
  - `VITE_MAPBOX_ACCESS_TOKEN`: Mapbox access token for location services (optional)
  - Firebase configuration (typically in `src/firebase.js`)
  - `VITE_DEBUG_SESSION_MINUTES`: Optional; overrides session timeout for testing (e.g. `2` for 2 minutes)

## Security Considerations

- All routes protected by role-based access control
- Firebase security rules enforce data access permissions
- Session timeout prevents unauthorized access
- Account deactivation immediately logs out users
- Location data stored securely in Firestore

---

**Note**: This application requires:
- Firebase project setup with Authentication and Firestore enabled
- NodeMailer API endpoint configured via `VITE_EMAIL_API_URL` environment variable
- Mapbox access token for location services (optional, if using location features)

# traiops
