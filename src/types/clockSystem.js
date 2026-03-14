/**
 * @fileoverview Type definitions for Clock-In/Clock-Out system
 * Using JSDoc comments for type checking
 */

/**
 * User roles in the system
 * @typedef {'admin' | 'trainer' | 'program_manager'} UserRole
 */

/**
 * User status
 * @typedef {'active' | 'inactive'} UserStatus
 */

/**
 * Onboarding status for trainers
 * @typedef {'not_started' | 'pending' | 'approved' | 'rejected'} OnboardingStatus
 */

/**
 * User document structure in Firestore
 * @typedef {Object} User
 * @property {string} uid - Firebase Auth UID
 * @property {string} email - User email
 * @property {string} displayName - User display name
 * @property {UserRole} role - User role
 * @property {UserStatus} status - User status
 * @property {Date} createdAt - Creation timestamp
 * @property {string} invitedBy - Admin UID who invited the user
 * @property {Date} invitedAt - Invitation timestamp
 * @property {boolean} mustChangePassword - Force password change on first login
 * @property {string[]} assignedLocations - For Program Managers: array of location IDs
 * @property {boolean} locationAccessGranted - For Trainers: location permission granted
 * @property {OnboardingStatus} onboardingStatus - For Trainers: onboarding status
 */

/**
 * Location document structure
 * @typedef {Object} Location
 * @property {string} locationId - Unique location ID
 * @property {string} name - Location name
 * @property {string} address - Location address
 * @property {Object} coordinates - GPS coordinates
 * @property {number} coordinates.lat - Latitude
 * @property {number} coordinates.lng - Longitude
 * @property {number} radius - Radius in meters (default: 100)
 * @property {string[]} programManagerIds - Array of PM UIDs assigned to this location
 * @property {string} clientName - Client name
 * @property {'active' | 'inactive'} status - Location status
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * Clock request types
 * @typedef {'clock_in' | 'clock_out'} ClockRequestType
 */

/**
 * Clock request status
 * @typedef {'pending' | 'approved' | 'rejected'} ClockRequestStatus
 */

/**
 * Clock request document structure
 * @typedef {Object} ClockRequest
 * @property {string} requestId - Unique request ID
 * @property {string} trainerId - Trainer's user UID
 * @property {string} locationId - Location ID
 * @property {ClockRequestType} type - Request type
 * @property {Date} requestedAt - Timestamp when trainer submitted (OFFICIAL TIME)
 * @property {Object} location - Location data at time of request
 * @property {number} location.lat - Latitude
 * @property {number} location.lng - Longitude
 * @property {string} location.address - Address
 * @property {number} location.accuracy - GPS accuracy in meters
 * @property {ClockRequestStatus} status - Request status
 * @property {string|null} taskId - Task ID if clocking in for specific task
 * @property {Array<Object>} approvals - Array of approval records
 * @property {string} approvals[].programManagerId - PM UID
 * @property {Date} approvals[].approvedAt - Approval timestamp
 * @property {string} approvals[].action - 'approved'
 * @property {Array<Object>} rejections - Array of rejection records
 * @property {string} rejections[].programManagerId - PM UID
 * @property {Date} rejections[].rejectedAt - Rejection timestamp
 * @property {string} rejections[].reason - Rejection reason (required)
 * @property {string} rejections[].action - 'rejected'
 * @property {boolean} adminApproved - Admin override flag
 * @property {string|null} adminApprovedBy - Admin UID if overridden
 * @property {Date|null} adminApprovedAt - Admin approval timestamp
 */

/**
 * Clock record status
 * @typedef {'active' | 'completed' | 'rejected'} ClockRecordStatus
 */

/**
 * Clock record document structure
 * @typedef {Object} ClockRecord
 * @property {string} recordId - Unique record ID
 * @property {string} trainerId - Trainer's user UID
 * @property {string} date - Date in YYYY-MM-DD format
 * @property {Object|null} clockIn - Clock-in data
 * @property {string} clockIn.requestId - Request ID
 * @property {Date} clockIn.timestamp - Timestamp from original request
 * @property {Object} clockIn.location - Location data
 * @property {number} clockIn.location.lat - Latitude
 * @property {number} clockIn.location.lng - Longitude
 * @property {string} clockIn.location.address - Address
 * @property {string} clockIn.approvedBy - PM or Admin UID
 * @property {Date} clockIn.approvedAt - Approval timestamp
 * @property {Object|null} clockOut - Clock-out data
 * @property {string} clockOut.requestId - Request ID
 * @property {Date} clockOut.timestamp - Timestamp from original request
 * @property {Object} clockOut.location - Location data
 * @property {number} clockOut.location.lat - Latitude
 * @property {number} clockOut.location.lng - Longitude
 * @property {string} clockOut.location.address - Address
 * @property {string} clockOut.approvedBy - PM or Admin UID
 * @property {Date} clockOut.approvedAt - Approval timestamp
 * @property {ClockRecordStatus} status - Record status
 * @property {string|null} taskId - Task ID if applicable
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * Trainer mapping document structure
 * @typedef {Object} TrainerMapping
 * @property {string} mappingId - Unique mapping ID
 * @property {string} trainerId - Trainer's user UID
 * @property {string[]} programManagerIds - Array of PM UIDs
 * @property {string[]} locationIds - Array of location IDs
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {string} createdBy - Admin UID who created the mapping
 * @property {'active' | 'inactive'} status - Mapping status
 */

/**
 * Trainer onboarding document structure
 * @typedef {Object} TrainerOnboarding
 * @property {string} requestId - Unique request ID
 * @property {string} trainerId - Trainer's Firebase Auth UID
 * @property {Object} details - Trainer details
 * @property {string} details.name - Trainer name
 * @property {string} details.email - Trainer email
 * @property {string} details.phone - Trainer phone
 * @property {string} details.specialization - Trainer tech stack
 * @property {Array} details.experience - Experience array
 * @property {string} details.summary - Trainer summary
 * @property {OnboardingStatus} status - Onboarding status
 * @property {Date} submittedAt - Submission timestamp
 * @property {string|null} reviewedBy - Admin UID who reviewed
 * @property {Date|null} reviewedAt - Review timestamp
 * @property {string|null} rejectionReason - Rejection reason if rejected
 * @property {string|null} trainerAccountId - Trainer account ID if approved
 */

export {
  // Types are exported for IDE autocomplete and documentation
  // Actual usage: /** @type {User} */ const user = {...}
};

