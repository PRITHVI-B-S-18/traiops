# Clock-In/Clock-Out System - Complete Requirements & Specifications

## 📋 Table of Contents
1. [Overview](#overview)
2. [User Roles & Interfaces](#user-roles--interfaces)
3. [Core Features](#core-features)
4. [Data Structure](#data-structure)
5. [Workflow Details](#workflow-details)
6. [UI/UX Specifications](#uiux-specifications)
7. [Security & Validation](#security--validation)
8. [Edge Cases & Handling](#edge-cases--handling)
9. [Implementation Phases](#implementation-phases)
10. [Technical Recommendations](#technical-recommendations)

---

## 🎯 Overview

### Objective
Implement a location-based clock-in/clock-out system (similar to Keka) where trainers can log their attendance, and Program Managers can verify and approve these requests. The system should support three distinct user roles with role-based access control.

### Key Principles
- **Timestamp Source**: Clock-in/out timestamps are recorded from the time the trainer submits the request (not approval time)
- **Approval Workflow**: Requests go to all Program Managers assigned to the trainer's location
- **First Approval Wins**: If any Program Manager approves, the request is stored and visible to all
- **Rejection Impact**: If a request is rejected, clock-in/out is disabled for that specific day
- **Location-Based**: Trainers must be at the correct location to clock in/out

---

## 👥 User Roles & Interfaces

### 1. Trainer Interface

#### Login & Onboarding Flow
- **Login Page**: Same for all users (existing design)
- **Role-Based Redirect**: After login, users are redirected based on their role
- **New Trainer Flow**:
  1. First-time login → Location permission request
  2. If location access granted → Show basic details form (if not in Trainer Accounts)
  3. Submit details → Wait for admin approval
  4. Once approved → Access to homepage
- **Existing Trainer Flow**:
  1. If trainer exists in Trainer Accounts → Skip details form
  2. Location permission check → Homepage

#### Homepage Features
- **Location Access Required**: Homepage only shows after location permission is granted
- **Calendar Interface**: 
  - Unique calendar view showing allocated tasks
  - Visual indicators for task status
  - Click on day → See task details
  - Click on task → Clock-in option available

#### Clock-In/Clock-Out Features
- **Flexible Clock-In**: Trainers can clock in anytime (not blocked by time)
- **Task-Based Clock-In**: Clock in directly from task details
- **Request Submission**: Creates a clock-in/out request with:
  - Current location (GPS coordinates)
  - Timestamp (request submission time)
  - Task ID (if applicable)
- **Status Visibility**: 
  - Pending: Yellow/Orange indicator
  - Approved: Green indicator
  - Rejected: Red indicator (clock-in/out disabled for that day)
- **View History**: See all past clock-in/out records with timestamps

#### Navigation
- Calendar/Schedule View
- Clock-In/Out History
- Profile/Account Settings

---

### 2. Program Manager Interface

#### Dashboard
- **Welcome Section**: "These are the trainers under me"
- **Pending Requests Counter**: Number of pending clock-in/out requests
- **Quick Actions**: Approve/Reject buttons
- **Trainer List**: All trainers assigned to this Program Manager

#### Request Management
- **Request List View**:
  - Filter by: Trainer, Date, Location, Status
  - Sort by: Date, Trainer name, Status
  - Search functionality
- **Request Details**:
  - Trainer name and details
  - Request timestamp
  - Location (with map view if possible)
  - Task details (if applicable)
  - Request type (Clock-in/Clock-out)

#### Approval Workflow
- **Approve Action**:
  - Single click approval
  - Request status changes to "Approved"
  - Clock record is created
  - Notification sent to trainer
- **Reject Action**:
  - Opens rejection modal
  - **Required**: Description/reason field (mandatory)
  - Request status changes to "Rejected"
  - Clock-in/out disabled for that day for the trainer
  - Notification sent to trainer with rejection reason

#### Access Control
- **Scope**: Only see trainers assigned to them
- **Multi-Location**: Can manage trainers across multiple locations (if assigned)
- **Bulk Actions**: Option to approve/reject multiple requests at once

#### Navigation
- Dashboard/Home
- Trainer Management
- Request Approvals
- Reports/Analytics (optional)

---

### 3. Admin Interface

#### User Management Section
- **Invite Users**:
  - Invite Trainers (email invitation)
  - Invite Program Managers (email invitation)
  - Send invitation links with role assignment
- **User List**:
  - View all users (Trainers, Program Managers, Admins)
  - Filter by role
  - Edit user details
  - Deactivate/Activate users

#### Trainer Onboarding Approval Section
- **Pending Approvals List**:
  - New trainers who submitted basic details
  - Trainer information preview
  - Approve/Reject actions
- **Approval Flow**:
  - If approved → Trainer added to Trainer Accounts
  - Trainer can now access full application
- **Rejection Flow**:
  - If rejected → Trainer can resubmit
  - Feedback visible to trainer
- **Skip Logic**:
  - If trainer details exist in Trainer Accounts → Skip details form
  - If admin adds trainer directly → No details form needed

#### Clock-In/Out Request Management
- **Global View**: See all requests from all trainers
- **Filtered View**: 
  - Filter by Program Manager
  - Filter by location
  - Filter by date range
  - Filter by status
- **Direct Approval**: Admin can approve/reject any request
- **Override Capability**: Admin can override Program Manager decisions

#### Trainer-Program Manager Mapping Section
- **Mapping Interface**:
  - Drag-and-drop interface (recommended)
  - Or simple dropdown/checkbox selection
- **Mapping Features**:
  - Assign trainers to Program Managers
  - Multiple Program Managers per trainer (if needed)
  - Multiple trainers per Program Manager
  - Location-based assignment
- **Visual Representation**:
  - List view with checkboxes
  - Or visual drag-and-drop board
- **Bulk Assignment**: Assign multiple trainers to a Program Manager at once

#### Additional Admin Features
- **Location Management**: Create/edit/delete client locations
- **Analytics Dashboard**: 
  - Attendance reports
  - Request approval rates
  - Trainer activity
- **Audit Trail**: View all system actions and changes

#### Navigation
- Schedule Management (existing)
- Trainer Accounts (existing)
- Trainer Profiles (existing)
- Utilization (existing)
- **NEW**: User Management
- **NEW**: Trainer Onboarding Approvals
- **NEW**: Clock-In/Out Requests
- **NEW**: Trainer-Program Manager Mapping
- **NEW**: Location Management

---

## 🔄 Core Features

### Location-Based Clock-In/Out

#### Location Verification
- **Method**: Browser Geolocation API with configurable radius
- **Process**:
  1. Trainer requests clock-in/out
  2. System requests location permission
  3. Gets GPS coordinates
  4. Validates if within location radius
  5. If valid → Proceed with request
  6. If invalid → Show error or allow manual entry (requires admin approval)
- **Location Data Stored**:
  - Latitude/Longitude
  - Address (reverse geocoded)
  - Accuracy radius
  - Timestamp

#### Location Configuration
- **Admin Can Configure**:
  - Location name
  - Address
  - GPS coordinates (center point)
  - Radius (in meters) - default: 100m
  - Assigned Program Managers

### Clock-In/Clock-Out Request Flow

#### Request Creation
1. Trainer clicks "Clock In" or "Clock Out"
2. System requests location permission
3. Validates location (if enabled)
4. Creates request with:
   - Trainer ID
   - Location ID
   - Request type (clock-in/clock-out)
   - Timestamp (current time - **this is the official time**)
   - Location coordinates
   - Task ID (if applicable)
   - Status: "pending"

#### Request Routing
1. System identifies trainer's assigned Program Managers
2. If multiple Program Managers → Request sent to all
3. If no Program Manager assigned → Request sent to Admin
4. Notification sent to all relevant approvers

#### Approval Process
1. **First Approval Wins**:
   - If any Program Manager approves → Request approved
   - Clock record created immediately
   - Other Program Managers see "Approved by [Name]"
   - Status: "approved"

2. **Rejection Process**:
   - If any Program Manager rejects → Request rejected
   - Rejection reason stored
   - Clock-in/out disabled for that day
   - Status: "rejected"
   - Trainer notified with reason

3. **Conflict Resolution**:
   - If one approves and another rejects → Approval takes precedence
   - Rejection is logged for audit but doesn't affect status

#### Clock Record Creation
- Created when request is approved
- Contains:
  - Original request timestamp (official time)
  - Approval timestamp
  - Approver details
  - Location details
  - Task details (if applicable)

---

## 🗄️ Data Structure

### Firestore Collections

#### 1. `users/` (Existing - Enhanced)
```javascript
{
  uid: string,
  email: string,
  displayName: string,
  role: 'admin' | 'trainer' | 'program_manager',
  createdAt: timestamp,
  status: 'active' | 'inactive',
  // For Program Managers
  assignedLocations: string[], // locationIds
  // For Trainers
  trainerAccountId: string, // Reference to trainers collection
  locationAccessGranted: boolean,
  onboardingStatus: 'pending' | 'approved' | 'rejected'
}
```

#### 2. `trainers/` (Existing - Enhanced)
```javascript
{
  id: string,
  name: string,
  email: string,
  phone: string,
  specialization: string,
  experience: array,
  summary: string,
  status: 'Active' | 'Inactive',
  // NEW FIELDS
  programManagerIds: string[], // Array of PM UIDs
  locationIds: string[], // Array of location IDs trainer can work at
  locationAccessGranted: boolean,
  onboardingStatus: 'pending' | 'approved' | 'rejected'
}
```

#### 3. `locations/` (NEW)
```javascript
{
  locationId: string,
  name: string,
  address: string,
  coordinates: {
    lat: number,
    lng: number
  },
  radius: number, // in meters, default: 100
  programManagerIds: string[], // Array of PM UIDs assigned to this location
  clientName: string,
  status: 'active' | 'inactive',
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 4. `clock_requests/` (NEW)
```javascript
{
  requestId: string,
  trainerId: string, // User UID
  locationId: string,
  type: 'clock_in' | 'clock_out',
  requestedAt: timestamp, // **OFFICIAL TIMESTAMP - from trainer submission**
  location: {
    lat: number,
    lng: number,
    address: string,
    accuracy: number
  },
  status: 'pending' | 'approved' | 'rejected',
  taskId: string | null, // If clocking in for a specific task
  // Approval tracking
  approvals: [{
    programManagerId: string,
    approvedAt: timestamp,
    action: 'approved'
  }],
  rejections: [{
    programManagerId: string,
    rejectedAt: timestamp,
    reason: string, // Required field
    action: 'rejected'
  }],
  // Admin override
  adminApproved: boolean,
  adminApprovedBy: string | null,
  adminApprovedAt: timestamp | null
}
```

#### 5. `clock_records/` (NEW)
```javascript
{
  recordId: string,
  trainerId: string,
  date: string, // YYYY-MM-DD format
  clockIn: {
    requestId: string,
    timestamp: timestamp, // From original request
    location: {
      lat: number,
      lng: number,
      address: string
    },
    approvedBy: string, // PM or Admin UID
    approvedAt: timestamp
  } | null,
  clockOut: {
    requestId: string,
    timestamp: timestamp, // From original request
    location: {
      lat: number,
      lng: number,
      address: string
    },
    approvedBy: string,
    approvedAt: timestamp
  } | null,
  status: 'active' | 'completed' | 'rejected',
  taskId: string | null,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 6. `trainer_mappings/` (NEW)
```javascript
{
  mappingId: string,
  trainerId: string, // User UID
  programManagerIds: string[], // Array of PM UIDs
  locationIds: string[], // Array of location IDs
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: string, // Admin UID
  status: 'active' | 'inactive'
}
```

#### 7. `trainer_onboarding/` (NEW)
```javascript
{
  requestId: string,
  trainerId: string, // Firebase Auth UID
  details: {
    name: string,
    email: string,
    phone: string,
    specialization: string,
    experience: array,
    summary: string
  },
  status: 'pending' | 'approved' | 'rejected',
  submittedAt: timestamp,
  reviewedBy: string | null, // Admin UID
  reviewedAt: timestamp | null,
  rejectionReason: string | null,
  // If approved, link to trainer account
  trainerAccountId: string | null
}
```

#### 8. `trainer_profiles/` (Existing - No changes)
- Keep existing structure

---

## 🔀 Workflow Details

### Trainer Onboarding Workflow

```
1. Admin invites Trainer (email invitation)
   ↓
2. Trainer receives invitation, creates account
   ↓
3. Trainer logs in for first time
   ↓
4. System checks: Does trainer exist in Trainer Accounts?
   ├─ YES → Skip to step 6
   └─ NO → Continue to step 5
   ↓
5. Show basic details form
   - Trainer fills: name, email, phone, specialization, etc.
   - Submit → Status: "pending"
   ↓
6. Request location permission
   ├─ GRANTED → Continue to step 7
   └─ DENIED → Show manual location entry option
   ↓
7. Homepage accessible
   - Calendar view with tasks
   - Can view but clock-in disabled until onboarding approved
   ↓
8. Admin reviews onboarding request (if step 5 occurred)
   ├─ APPROVE → Trainer added to Trainer Accounts, full access
   └─ REJECT → Trainer can resubmit with feedback
```

### Clock-In Workflow

```
1. Trainer views calendar/task
   ↓
2. Trainer clicks "Clock In" button
   ↓
3. System requests location permission
   ├─ GRANTED → Get GPS coordinates
   └─ DENIED → Show manual location entry
   ↓
4. Validate location (if GPS available)
   ├─ WITHIN RADIUS → Continue
   └─ OUTSIDE RADIUS → Show warning, allow with admin approval flag
   ↓
5. Create clock_requests document
   - requestedAt: NOW (official timestamp)
   - status: "pending"
   ↓
6. Route request to approvers
   - Find trainer's assigned Program Managers
   - If multiple PMs → Send to all
   - If no PM → Send to Admin
   ↓
7. Send notifications to approvers
   ↓
8. Approver reviews request
   ├─ APPROVE → Create clock_records, update status
   └─ REJECT → Update status, disable clock-in for that day
   ↓
9. Trainer receives notification
   ↓
10. Trainer sees updated status in calendar
```

### Clock-Out Workflow

```
1. Trainer has active clock-in record for the day
   ↓
2. Trainer clicks "Clock Out" button
   ↓
3. Follow same location verification as clock-in
   ↓
4. Create clock_requests document (type: "clock_out")
   ↓
5. Route to approvers (same as clock-in)
   ↓
6. Approval/rejection process (same as clock-in)
   ↓
7. Update clock_records with clockOut data
   ↓
8. Mark record status as "completed"
```

### Approval Workflow (Program Manager)

```
1. Program Manager logs in
   ↓
2. Dashboard shows pending requests count
   ↓
3. Click on request to view details
   - Trainer info
   - Timestamp
   - Location (with map if possible)
   - Task details
   ↓
4. Program Manager decides
   ├─ APPROVE:
   │  - Single click
   │  - Request status → "approved"
   │  - Create/update clock_records
   │  - Send notification to trainer
   │
   └─ REJECT:
      - Opens modal
      - REQUIRED: Enter rejection reason
      - Request status → "rejected"
      - Disable clock-in/out for that day
      - Send notification to trainer with reason
   ↓
5. Request disappears from pending list
   ↓
6. Trainer sees updated status
```

---

## 🎨 UI/UX Specifications

### Trainer Interface

#### Location Permission Screen
- **Design**: Modal or full-screen overlay
- **Content**:
  - Clear explanation of why location is needed
  - "Allow Location Access" button
  - "Skip for now" option (with limitations)
- **Styling**: Match application's grey/white theme

#### Calendar Interface
- **Layout**: Monthly calendar view (similar to existing schedule)
- **Visual Indicators**:
  - Days with tasks: Highlighted
  - Pending requests: Orange/Yellow badge
  - Approved: Green checkmark
  - Rejected: Red X (with disabled state)
- **Interactions**:
  - Click day → Show task details modal
  - Click task → Show clock-in button
  - Hover → Show quick info

#### Task Details Modal
- **Content**:
  - Task name
  - Date and time
  - Location
  - Client details
  - Clock-in button (if not already clocked in)
  - Clock-out button (if clocked in)
  - Request status (if pending/approved/rejected)

#### Clock-In/Out Button States
- **Available**: Green button, "Clock In" / "Clock Out"
- **Pending**: Orange button, "Pending Approval"
- **Approved**: Green checkmark, "Approved at [time]"
- **Rejected**: Red X, "Rejected - [reason]"
- **Disabled**: Grey button, "Clock-in disabled for this day"

#### Request History Page
- **Layout**: Table or card view
- **Columns/Fields**:
  - Date
  - Type (Clock-in/Clock-out)
  - Requested Time
  - Location
  - Status
  - Approved/Rejected By
  - Rejection Reason (if applicable)
- **Filters**: By date range, status, type

### Program Manager Interface

#### Dashboard
- **Header**: "Trainers Under Me" or "My Team"
- **Stats Cards**:
  - Total trainers
  - Pending requests count (highlighted)
  - Approved today
  - Rejected today
- **Quick Actions**: 
  - "View All Requests" button
  - "Approve All" bulk action (optional)

#### Trainer List View
- **Layout**: Card or table view
- **Information**:
  - Trainer name
  - Email
  - Assigned locations
  - Recent activity
  - Pending requests count

#### Request Approval Page
- **Layout**: List view with filters
- **Request Card/Row**:
  - Trainer name and avatar
  - Request type (Clock-in/Clock-out)
  - Requested timestamp
  - Location (with map preview)
  - Task details (if applicable)
  - Approve button (green)
  - Reject button (red)
- **Filters**:
  - By trainer
  - By date
  - By location
  - By status
- **Search**: By trainer name or email

#### Rejection Modal
- **Design**: Modal overlay
- **Fields**:
  - Title: "Reject Clock-In Request"
  - Reason field (textarea, required)
  - Character limit: 500
  - Placeholder: "Please provide a reason for rejection..."
  - Cancel button
  - Confirm Reject button (red)
- **Validation**: Cannot submit without reason

### Admin Interface

#### User Management Section
- **Invite Users Tab**:
  - Form to invite trainers
  - Form to invite program managers
  - Email input
  - Role selection
  - "Send Invitation" button
- **User List Tab**:
  - Table with all users
  - Columns: Name, Email, Role, Status, Actions
  - Filter by role
  - Edit/Delete actions

#### Trainer Onboarding Approval Section
- **Layout**: List of pending requests
- **Request Card**:
  - Trainer name
  - Email
  - Submitted details preview
  - "View Full Details" button
  - Approve button
  - Reject button (with reason field)
- **Filters**: By status, date

#### Clock-In/Out Request Management
- **Global View Tab**:
  - All requests from all trainers
  - Same filters as Program Manager view
  - Additional filter: By Program Manager
- **Filtered View Tab**:
  - Select Program Manager
  - See only their trainers' requests
- **Request Actions**:
  - View details
  - Approve/Reject (override capability)
  - View approval history

#### Trainer-Program Manager Mapping Section
- **Recommended: Drag-and-Drop Interface**
  - Left panel: List of trainers
  - Right panel: List of Program Managers (grouped by location if needed)
  - Drag trainer to Program Manager to assign
  - Visual connection lines
- **Alternative: Checkbox Interface**
  - Table with trainers as rows
  - Program Managers as columns
  - Checkboxes for assignment
  - Bulk selection
- **Features**:
  - Search trainers
  - Search Program Managers
  - Filter by location
  - Save mapping button
  - Undo/Redo (optional)

#### Location Management Section
- **Location List**:
  - Table with all locations
  - Columns: Name, Address, Radius, Assigned PMs, Status
  - Add/Edit/Delete actions
- **Add/Edit Location Form**:
  - Name
  - Address
  - Map picker for coordinates
  - Radius input (meters)
  - Program Manager assignment (multi-select)
  - Save button

---

## 🔒 Security & Validation

### Location Verification

#### GPS-Based Verification
- **Process**:
  1. Request location permission
  2. Get coordinates using Geolocation API
  3. Calculate distance from location center
  4. If within radius → Valid
  5. If outside radius → Flag for review or require manual entry
- **Accuracy Handling**:
  - Consider GPS accuracy radius
  - If accuracy is poor (>50m), flag for review
  - Store accuracy value with request

#### Manual Location Entry
- **When Allowed**:
  - Location permission denied
  - GPS unavailable
  - Outside radius (with admin approval flag)
- **Process**:
  - Trainer selects location from dropdown
  - Or enters address manually
  - Request flagged as "manual_entry"
  - Requires admin approval (not Program Manager)

### Role-Based Access Control

#### Trainer Access
- ✅ View own clock-in/out records
- ✅ Submit clock-in/out requests
- ✅ View own task calendar
- ❌ View other trainers' records
- ❌ Approve/reject requests
- ❌ View Program Manager dashboard

#### Program Manager Access
- ✅ View assigned trainers only
- ✅ Approve/reject requests for assigned trainers
- ✅ View trainer details for assigned trainers
- ❌ View trainers not assigned to them
- ❌ Approve requests for unassigned trainers
- ❌ Access admin features

#### Admin Access
- ✅ Full access to all features
- ✅ View all trainers and requests
- ✅ Override any approval/rejection
- ✅ Manage users and mappings
- ✅ Configure locations

### Data Validation

#### Clock-In Validation
- ✅ Trainer must have location access granted
- ✅ Trainer must be assigned to a location
- ✅ Only one clock-in per day (unless previous rejected)
- ✅ Cannot clock-in if already clocked in for the day
- ✅ Location must be valid (within radius or manual entry approved)

#### Clock-Out Validation
- ✅ Trainer must have active clock-in for the day
- ✅ Cannot clock-out if not clocked in
- ✅ Only one clock-out per day

#### Request Validation
- ✅ Timestamp must be current (within last 24 hours for clock-in)
- ✅ Location data must be present
- ✅ Trainer ID must be valid
- ✅ Location ID must be valid

---

## ⚠️ Edge Cases & Handling

### 1. Location Access Denied
**Scenario**: Trainer denies location permission  
**Handling**:
- Show manual location selection
- Request flagged for admin approval
- Allow trainer to proceed but notify that approval required

### 2. No Program Manager Assigned
**Scenario**: Trainer clocks in but has no assigned Program Manager  
**Handling**:
- Route request directly to Admin
- Show warning to Admin
- Admin can assign Program Manager or approve directly

### 3. Multiple Program Managers - Mixed Responses
**Scenario**: One PM approves, another rejects  
**Handling**:
- **Approval takes precedence**
- Rejection is logged for audit
- Status: "approved"
- Clock record created
- Rejection reason stored but doesn't affect functionality

### 4. Program Manager Removed While Requests Pending
**Scenario**: Admin removes PM, but PM has pending requests  
**Handling**:
- Re-route pending requests to:
  1. Other assigned Program Managers (if any)
  2. Admin (if no other PMs)
- Notify trainer of routing change

### 5. Trainer Mapped to Multiple Program Managers
**Scenario**: Trainer has multiple PMs, one rejects  
**Handling**:
- If any PM rejects → Clock-in/out disabled for that day
- If any PM approves → Clock record created (first approval wins)
- All PMs see the final status

### 6. Clock-In Outside Working Hours
**Scenario**: Trainer clocks in at unusual time  
**Handling**:
- Allow clock-in (flexible system)
- Flag request for review (optional)
- Show warning to trainer: "Unusual time detected"
- Program Manager sees flag in request details

### 7. Trainer Forgets to Clock Out
**Scenario**: Trainer clocks in but forgets to clock out  
**Handling**:
- Allow manual clock-out next day
- Require reason for late clock-out
- Flag for Program Manager review
- Show in reports as "incomplete"

### 8. GPS Accuracy Issues
**Scenario**: GPS shows trainer far from location but they claim to be there  
**Handling**:
- If accuracy > 50m → Flag for review
- Allow manual location entry with reason
- Require admin approval for manual entries
- Store GPS data for audit

### 9. Multiple Clock-Ins Same Day
**Scenario**: Trainer tries to clock in multiple times  
**Handling**:
- Prevent duplicate clock-ins
- Show message: "You have already clocked in today"
- If previous request rejected → Allow new clock-in
- If previous request pending → Show pending status

### 10. Location Changed Mid-Day
**Scenario**: Trainer clocks in at Location A, tries to clock out at Location B  
**Handling**:
- Allow clock-out from different location
- Flag for review
- Store both locations
- Program Manager sees location change in request

### 11. Trainer Details Rejected
**Scenario**: Admin rejects trainer's onboarding details  
**Handling**:
- Show rejection reason to trainer
- Allow trainer to resubmit
- Keep original submission for reference
- Trainer can edit and resubmit

### 12. Clock-In Request Expires
**Scenario**: Request pending for too long (e.g., 7 days)  
**Handling**:
- Auto-flag as "expired" after 7 days
- Notify Admin
- Trainer can submit new request
- Old request archived

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal**: Set up basic infrastructure

#### Tasks:
1. **Authentication & Roles**
   - Add `program_manager` role to AuthContext
   - Update role detection logic
   - Update ProtectedRoute for three roles
   - Update routing in App.jsx

2. **Database Structure**
   - Create Firestore collections structure
   - Set up security rules
   - Create data models/types

3. **Location Management (Admin)**
   - Create locations collection
   - Admin UI to add/edit/delete locations
   - Map integration for coordinate selection
   - Radius configuration

4. **Basic Routing**
   - Create Program Manager routes
   - Update redirect logic after login
   - Create layout components for each role

**Deliverables**:
- ✅ Three-role authentication system
- ✅ Location management interface
- ✅ Basic routing structure

---

### Phase 2: Trainer Interface (Week 2)
**Goal**: Complete trainer clock-in/out functionality

#### Tasks:
1. **Location Permission Flow**
   - Permission request screen
   - Geolocation API integration
   - Permission state management
   - Manual location fallback

2. **Calendar Interface**
   - Enhanced calendar view
   - Task integration
   - Visual status indicators
   - Day/task click handlers

3. **Clock-In/Out Request System**
   - Request creation
   - Location validation
   - Request submission
   - Status display

4. **Request History**
   - History page/component
   - Filter and search
   - Status indicators

**Deliverables**:
- ✅ Trainer can request location access
- ✅ Trainer can view calendar with tasks
- ✅ Trainer can submit clock-in/out requests
- ✅ Trainer can view request history

---

### Phase 3: Program Manager Interface (Week 3)
**Goal**: Complete Program Manager approval workflow

#### Tasks:
1. **Dashboard**
   - Trainer list
   - Pending requests counter
   - Quick stats

2. **Request Management**
   - Request list view
   - Filters and search
   - Request details view
   - Map integration for location

3. **Approval Workflow**
   - Approve functionality
   - Reject modal with reason
   - Status updates
   - Notifications

4. **Access Control**
   - Filter trainers by assignment
   - Role-based data fetching
   - Security rules enforcement

**Deliverables**:
- ✅ Program Manager dashboard
- ✅ Request approval/rejection workflow
- ✅ Trainer management view
- ✅ Notification system

---

### Phase 4: Admin Interface (Week 4)
**Goal**: Complete admin management features

#### Tasks:
1. **User Management**
   - Invite trainers
   - Invite Program Managers
   - User list and management
   - Role assignment

2. **Trainer Onboarding**
   - Onboarding request list
   - Approval/rejection workflow
   - Integration with Trainer Accounts
   - Skip logic implementation

3. **Global Request Management**
   - All requests view
   - Filter by Program Manager
   - Override capabilities
   - Analytics dashboard

4. **Mapping System**
   - Drag-and-drop interface (or checkbox)
   - Trainer-Program Manager assignment
   - Bulk operations
   - Location-based mapping

**Deliverables**:
- ✅ User invitation system
- ✅ Trainer onboarding approval
- ✅ Global request management
- ✅ Trainer-Program Manager mapping

---

### Phase 5: Polish & Testing (Week 5)
**Goal**: Refinement, edge cases, and testing

#### Tasks:
1. **Edge Case Handling**
   - Implement all edge cases
   - Error handling
   - Fallback mechanisms

2. **Notifications**
   - Email notifications (optional)
   - In-app notifications
   - Toast messages

3. **Reports & Analytics**
   - Attendance reports
   - Request statistics
   - Export functionality

4. **Testing**
   - Unit tests
   - Integration tests
   - User acceptance testing
   - Performance testing

5. **Documentation**
   - User guides
   - Admin documentation
   - API documentation

**Deliverables**:
- ✅ All edge cases handled
- ✅ Notification system
- ✅ Reports and analytics
- ✅ Comprehensive testing
- ✅ Documentation

---

## 💡 Technical Recommendations

### Frontend Technologies
- **React Router**: For routing and navigation
- **Framer Motion**: For animations (already in use)
- **Geolocation API**: For location tracking
- **React Calendar**: For calendar component (or custom)
- **React DnD**: For drag-and-drop mapping (if using)
- **Leaflet/Google Maps**: For map visualization

### Backend/Firebase
- **Firestore**: For data storage
- **Firebase Auth**: For authentication
- **Cloud Functions**: For notifications (optional)
- **Firestore Security Rules**: For access control

### State Management
- **React Context**: For global state (AuthContext)
- **Local State**: For component-specific state
- **Firestore Real-time Listeners**: For live updates

### Performance Optimizations
- **Memoization**: For expensive calculations
- **Lazy Loading**: For routes and components
- **Pagination**: For large lists
- **Indexing**: Firestore indexes for queries

### Security Best Practices
- **Firestore Security Rules**: Enforce at database level
- **Role Validation**: Validate on both client and server
- **Input Validation**: Sanitize all user inputs
- **Location Verification**: Server-side validation (Cloud Functions)

### UI/UX Best Practices
- **Loading States**: Show spinners during async operations
- **Error Messages**: Clear, user-friendly error messages
- **Success Feedback**: Toast notifications for actions
- **Responsive Design**: Mobile-friendly interfaces
- **Accessibility**: ARIA labels, keyboard navigation

---

## 📝 Additional Features (Future Enhancements)

### Notifications
- Email notifications for:
  - Pending requests (to Program Managers)
  - Approval/rejection (to Trainers)
  - Onboarding status (to Trainers)
- Push notifications (if mobile app)
- In-app notification center

### Reports & Analytics
- **For Program Managers**:
  - Attendance reports for their trainers
  - Request approval rates
  - Trainer activity summary
- **For Admin**:
  - Global attendance dashboard
  - Request statistics
  - Location-wise reports
  - Export to Excel/PDF

### Mobile App (Future)
- Native mobile app for easier clock-in/out
- Better GPS accuracy
- Offline support
- Push notifications

### Advanced Features
- **Biometric Authentication**: For clock-in/out
- **Photo Verification**: Take photo at clock-in
- **QR Code Check-in**: For specific locations
- **Shift Management**: Define shifts and validate against them
- **Overtime Tracking**: Automatic overtime calculation

---

## ✅ Acceptance Criteria

### Trainer
- [ ] Can request location access on first login
- [ ] Can view calendar with allocated tasks
- [ ] Can clock in/out from task details
- [ ] Can see request status (pending/approved/rejected)
- [ ] Cannot clock in if request rejected for that day
- [ ] Can view clock-in/out history
- [ ] Receives notifications on approval/rejection

### Program Manager
- [ ] Can see only assigned trainers
- [ ] Can view pending requests
- [ ] Can approve requests with one click
- [ ] Can reject requests with mandatory reason
- [ ] Can filter and search requests
- [ ] Can see location on map
- [ ] Receives notifications for new requests

### Admin
- [ ] Can invite trainers and Program Managers
- [ ] Can approve/reject trainer onboarding
- [ ] Can view all clock-in/out requests
- [ ] Can filter requests by Program Manager
- [ ] Can override any approval/rejection
- [ ] Can map trainers to Program Managers
- [ ] Can manage locations
- [ ] Can see global analytics

### System
- [ ] Location verification works correctly
- [ ] Timestamps are from request time (not approval)
- [ ] Multiple Program Managers can see same request
- [ ] First approval wins (conflict resolution)
- [ ] Rejection disables clock-in/out for that day
- [ ] All edge cases are handled
- [ ] Security rules enforce access control
- [ ] Performance is optimized

---

## 📞 Questions & Clarifications

### Answered/Clarified:
1. ✅ **Location Verification**: GPS with radius validation
2. ✅ **Multiple Approvals**: First approval wins
3. ✅ **Clock-In Frequency**: One per day (unless rejected)
4. ✅ **Program Manager Assignment**: Per trainer (can be multiple)
5. ✅ **Rejection Impact**: Disables for that day only
6. ✅ **Trainer Details**: Use existing Trainer Accounts fields

### Pending (If Needed):
- Email notification preferences
- Report export formats
- Mobile app timeline
- Biometric authentication requirements

---

## 📚 Document Version History

- **v1.0** (Current): Initial comprehensive requirements document
  - Includes all original requirements
  - Includes all recommendations and improvements
  - Includes data structure specifications
  - Includes workflow details
  - Includes edge case handling

---

**Last Updated**: [Current Date]  
**Status**: Ready for Implementation  
**Next Step**: Begin Phase 1 - Foundation

