/**
 * Type definitions for Firestore data models
 * These serve as documentation and can be used for validation
 */

/**
 * @typedef {Object} User
 * @property {string} uid - Firebase Auth UID
 * @property {string} email - User email
 * @property {string} displayName - User display name
 * @property {'admin'|'trainer'|'program_manager'} role - User role
 * @property {number} createdAt - Timestamp
 * @property {'active'|'inactive'} status - User status
 * @property {string[]} [assignedLocations] - For Program Managers: locationIds
 * @property {string} [trainerAccountId] - For Trainers: Reference to trainers collection
 * @property {boolean} [locationAccessGranted] - For Trainers: Location permission status
 * @property {'pending'|'approved'|'rejected'} [onboardingStatus] - For Trainers: Onboarding status
 */

/**
 * @typedef {Object} Trainer
 * @property {string} id - Trainer ID
 * @property {string} name - Trainer name
 * @property {string} email - Trainer email
 * @property {string} phone - Trainer phone
 * @property {string} specialization - Trainer specialization
 * @property {Array<Object>} experience - Experience array
 * @property {string} summary - Trainer summary
 * @property {'Active'|'Inactive'} status - Trainer status
 * @property {string[]} [programManagerIds] - Array of PM UIDs
 * @property {string[]} [locationIds] - Array of location IDs trainer can work at
 * @property {boolean} [locationAccessGranted] - Location permission granted
 * @property {'pending'|'approved'|'rejected'} [onboardingStatus] - Onboarding status
 */

/**
 * @typedef {Object} Location
 * @property {string} locationId - Location ID
 * @property {string} name - Location name
 * @property {string} address - Location address
 * @property {Object} coordinates - GPS coordinates
 * @property {number} coordinates.lat - Latitude
 * @property {number} coordinates.lng - Longitude
 * @property {number} radius - Radius in meters (default: 100)
 * @property {string[]} programManagerIds - Array of PM UIDs assigned to this location
 * @property {string} clientName - Client name
 * @property {'active'|'inactive'} status - Location status
 * @property {number} createdAt - Timestamp
 * @property {number} updatedAt - Timestamp
 */

/**
 * @typedef {Object} ClockRequest
 * @property {string} requestId - Request ID
 * @property {string} trainerId - User UID
 * @property {string} locationId - Location ID
 * @property {'clock_in'|'clock_out'} type - Request type
 * @property {number} requestedAt - Timestamp (OFFICIAL TIMESTAMP)
 * @property {Object} location - Location data
 * @property {number} location.lat - Latitude
 * @property {number} location.lng - Longitude
 * @property {string} location.address - Address
 * @property {number} location.accuracy - GPS accuracy
 * @property {'pending'|'approved'|'rejected'} status - Request status
 * @property {string|null} taskId - Task ID if clocking in for a specific task
 * @property {Array<Object>} approvals - Approval tracking
 * @property {Array<Object>} rejections - Rejection tracking
 * @property {boolean} [adminApproved] - Admin override
 * @property {string|null} [adminApprovedBy] - Admin UID
 * @property {number|null} [adminApprovedAt] - Timestamp
 */

/**
 * @typedef {Object} ClockRecord
 * @property {string} recordId - Record ID
 * @property {string} trainerId - User UID
 * @property {string} date - Date in YYYY-MM-DD format
 * @property {Object|null} clockIn - Clock-in data
 * @property {string} clockIn.requestId - Request ID
 * @property {number} clockIn.timestamp - Timestamp
 * @property {Object} clockIn.location - Location data
 * @property {string} clockIn.approvedBy - PM or Admin UID
 * @property {number} clockIn.approvedAt - Timestamp
 * @property {Object|null} clockOut - Clock-out data
 * @property {string} clockOut.requestId - Request ID
 * @property {number} clockOut.timestamp - Timestamp
 * @property {Object} clockOut.location - Location data
 * @property {string} clockOut.approvedBy - PM or Admin UID
 * @property {number} clockOut.approvedAt - Timestamp
 * @property {'active'|'completed'|'rejected'} status - Record status
 * @property {string|null} taskId - Task ID
 * @property {number} createdAt - Timestamp
 * @property {number} updatedAt - Timestamp
 */

/**
 * @typedef {Object} TrainerMapping
 * @property {string} mappingId - Mapping ID
 * @property {string} trainerId - User UID
 * @property {string[]} programManagerIds - Array of PM UIDs
 * @property {string[]} locationIds - Array of location IDs
 * @property {number} createdAt - Timestamp
 * @property {number} updatedAt - Timestamp
 * @property {string} createdBy - Admin UID
 * @property {'active'|'inactive'} status - Mapping status
 */

/**
 * @typedef {Object} TrainerOnboarding
 * @property {string} requestId - Request ID
 * @property {string} trainerId - Firebase Auth UID
 * @property {Object} details - Trainer details
 * @property {string} details.name - Name
 * @property {string} details.email - Email
 * @property {string} details.phone - Phone
 * @property {string} details.specialization - Specialization
 * @property {Array<Object>} details.experience - Experience array
 * @property {string} details.summary - Summary
 * @property {'pending'|'approved'|'rejected'} status - Onboarding status
 * @property {number} submittedAt - Timestamp
 * @property {string|null} reviewedBy - Admin UID
 * @property {number|null} reviewedAt - Timestamp
 * @property {string|null} rejectionReason - Rejection reason
 * @property {string|null} trainerAccountId - Trainer account ID if approved
 */

// Export types for use in other files
export const UserRoles = {
  ADMIN: 'admin',
  TRAINER: 'trainer',
  PROGRAM_MANAGER: 'program_manager',
};

export const UserStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

export const OnboardingStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const ClockRequestType = {
  CLOCK_IN: 'clock_in',
  CLOCK_OUT: 'clock_out',
};

export const ClockRequestStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const ClockRecordStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
};

export const LocationStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

export const TrainerStatus = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

