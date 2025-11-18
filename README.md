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
- **Create Assignments**: 
  - Training assignments (with client, course, role, specialization)
  - Non-training assignments (with task type and description)
  - Multi-date range scheduling with excluded dates
  - Program Manager assignment to tasks
- **Bulk Operations**: Edit or delete multiple assignments across date ranges
- **Quick Allocation**: Fast assignment creation with optional email notifications
- **Real-time Updates**: Live synchronization of schedule changes across all users
- **Search & Filter**: Advanced filtering by trainer, client, course, task type, date range
- **Export**: Export schedules to Excel or PDF with customizable filters

#### 2. **Trainer Management** (`/admin/trainers`)
- **Trainer CRUD**: Create, read, update, and delete trainer profiles
- **Bulk Import/Export**: Excel-based bulk operations for trainer data
- **Trainer Profiles**: Manage trainer information including:
  - Personal details (name, email, phone)
  - Specialization and experience
  - Status (Active/Inactive)
- **Sync with Auth**: Synchronize trainer accounts with Firebase Authentication
- **Onboarding Approvals**: Review and approve trainer onboarding requests
- **Invitation System**: Send invitations to trainers for account creation

#### 3. **Trainer Profiles** (`/admin/profiles`)
- Detailed trainer profile management
- Profile viewing and editing capabilities

#### 4. **Trainer Utilization** (`/admin/utilization`)
- **Analytics Dashboard**: View trainer utilization metrics
- **Time Period Analysis**: Filter by week, month, or custom date ranges
- **Utilization Metrics**: Calculate training days, utilization percentages
- **Export Reports**: Generate utilization reports in Excel format
- **Sorting & Filtering**: Sort by utilization, name, or training days

#### 5. **User Management** (`/admin/users`)
- **User CRUD**: Manage system users (admins, program managers, trainers)
- **Role Assignment**: Assign and modify user roles
- **User Status**: Activate/deactivate user accounts
- **Invitation System**: 
  - Send email invitations to new users
  - Bulk invitation via Excel upload
  - Track invitation status (pending, accepted, expired)
  - Resend invitations
- **Real-time Updates**: Live synchronization of user changes

#### 6. **Client Management** (`/admin/clients`)
- **Client CRUD**: Create, update, and delete client records
- **Program Manager Assignment**: Assign program managers to clients
- **Client Status**: Manage active/inactive client status
- **Pre-population**: Quick setup with sample client data

#### 7. **Clock Requests Management** (`/admin/clock-requests`)
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
  - 24-hour session timeout
  - Idle timeout detection
  - Session warning system
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
- **Firebase Firestore**: Cloud-based NoSQL database
- **Excel Import/Export**: Bulk data operations via Excel files
- **PDF Generation**: Export schedules and reports to PDF
- **Data Validation**: Comprehensive input validation and error handling

### Timezone Support
- **Timezone Awareness**: All dates stored in UTC, displayed in user's timezone
- **Date Range Handling**: Proper timezone conversion for date ranges
- **Holiday Management**: Support for excluded dates and holidays

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

### 1. Creating a Training Assignment
1. Admin navigates to Schedule page
2. Selects date range and excluded dates
3. Chooses trainer, client, course, role, specialization
4. Optionally assigns Program Managers
5. System creates assignment and sends email notification to trainer
6. Trainer sees assignment appear in real-time on their schedule

### 2. Trainer Clock-In Process
1. Trainer navigates to schedule page
2. Clicks clock-in button for a scheduled task
3. System requests location permission
4. Trainer's location is captured
5. Clock request is created and routed to assigned Program Manager
6. Program Manager reviews and approves/rejects
7. Trainer receives status update in real-time

### 3. User Invitation Flow
1. Admin creates invitation with email and role
2. System sends invitation email with signup link
3. User clicks link and completes signup
4. Account is created with assigned role
5. User can now log in and access role-specific features

### 4. Bulk Schedule Operations
1. Admin selects multiple assignments or date range
2. Chooses bulk edit or delete operation
3. System applies changes across all selected items
4. Email notifications sent for affected trainers
5. Real-time updates reflected across all users

## Data Models

### Schedule Assignment
- Date, Trainer, Client, Course
- Type (training/non-training)
- Role, Specialization, Task Type
- Description, Program Manager IDs
- Unique ID for tracking

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

## Deployment

- **Build**: `npm run build` generates production build in `dist/` folder
- **Firebase Hosting**: Configured for Firebase deployment
- **Environment Variables**: Required environment variables:
  - `VITE_EMAIL_API_URL`: NodeMailer API endpoint (e.g., `https://nodemailer-q13k.onrender.com/send`)
  - `VITE_MAPBOX_ACCESS_TOKEN`: Mapbox access token for location services
  - Firebase configuration (typically in `src/firebase.js`)

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

