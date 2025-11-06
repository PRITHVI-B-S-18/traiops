/**
 * Validation utilities for the application
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (basic validation)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid
 */
export const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[\d\s\-()]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

/**
 * Validate coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} - True if valid
 */
export const isValidCoordinates = (lat, lng) => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

/**
 * Validate radius (must be positive number)
 * @param {number} radius - Radius in meters
 * @returns {boolean} - True if valid
 */
export const isValidRadius = (radius) => {
  return typeof radius === 'number' && radius > 0 && radius <= 10000;
};

/**
 * Validate user role
 * @param {string} role - Role to validate
 * @returns {boolean} - True if valid
 */
export const isValidRole = (role) => {
  const validRoles = ['admin', 'trainer', 'program_manager'];
  return validRoles.includes(role);
};

/**
 * Validate status
 * @param {string} status - Status to validate
 * @param {Array<string>} validStatuses - Array of valid statuses
 * @returns {boolean} - True if valid
 */
export const isValidStatus = (status, validStatuses = ['active', 'inactive']) => {
  return validStatuses.includes(status);
};

/**
 * Validate required fields in an object
 * @param {Object} obj - Object to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {Object} - {isValid: boolean, missingFields: Array<string>}
 */
export const validateRequiredFields = (obj, requiredFields) => {
  const missingFields = requiredFields.filter(
    (field) => !obj[field] || (typeof obj[field] === 'string' && obj[field].trim() === '')
  );
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};

/**
 * Sanitize string input (remove potentially harmful characters)
 * @param {string} input - Input to sanitize
 * @returns {string} - Sanitized input
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/<script.*?>.*?<\/script>/gi, '')
    .replace(/<.*?>/g, '');
};

/**
 * Validate location data
 * @param {Object} locationData - Location data to validate
 * @returns {Object} - {isValid: boolean, errors: Array<string>}
 */
export const validateLocationData = (locationData) => {
  const errors = [];
  
  if (!locationData.name || locationData.name.trim() === '') {
    errors.push('Location name is required');
  }
  
  if (!locationData.address || locationData.address.trim() === '') {
    errors.push('Address is required');
  }
  
  if (!locationData.coordinates || !locationData.coordinates.lat || !locationData.coordinates.lng) {
    errors.push('Coordinates are required');
  } else if (!isValidCoordinates(locationData.coordinates.lat, locationData.coordinates.lng)) {
    errors.push('Invalid coordinates');
  }
  
  if (locationData.radius && !isValidRadius(locationData.radius)) {
    errors.push('Radius must be between 1 and 10,000 meters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate trainer data
 * @param {Object} trainerData - Trainer data to validate
 * @returns {Object} - {isValid: boolean, errors: Array<string>}
 */
export const validateTrainerData = (trainerData) => {
  const errors = [];
  
  if (!trainerData.name || trainerData.name.trim() === '') {
    errors.push('Trainer name is required');
  }
  
  if (!trainerData.email || !isValidEmail(trainerData.email)) {
    errors.push('Valid email is required');
  }
  
  if (!trainerData.phone || !isValidPhone(trainerData.phone)) {
    errors.push('Valid phone number is required');
  }
  
  if (!trainerData.specialization || trainerData.specialization.trim() === '') {
    errors.push('Specialization is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate clock request data
 * @param {Object} requestData - Clock request data to validate
 * @returns {Object} - {isValid: boolean, errors: Array<string>}
 */
export const validateClockRequestData = (requestData) => {
  const errors = [];
  
  if (!requestData.trainerId) {
    errors.push('Trainer ID is required');
  }
  
  if (!requestData.locationId) {
    errors.push('Location ID is required');
  }
  
  if (!requestData.type || !['clock_in', 'clock_out'].includes(requestData.type)) {
    errors.push('Valid request type is required (clock_in or clock_out)');
  }
  
  if (!requestData.location || !requestData.location.lat || !requestData.location.lng) {
    errors.push('Location coordinates are required');
  } else if (!isValidCoordinates(requestData.location.lat, requestData.location.lng)) {
    errors.push('Invalid location coordinates');
  }
  
  if (!requestData.requestedAt) {
    errors.push('Request timestamp is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Format error message for display
 * @param {Error|string} error - Error object or message
 * @returns {Object} - {title: string, message: string}
 */
export const formatErrorMessage = (error) => {
  if (typeof error === 'string') {
    return {
      title: 'Error',
      message: error,
    };
  }
  
  if (error.code) {
    // Firebase error codes
    const errorMessages = {
      'auth/user-not-found': {
        title: 'User Not Found',
        message: 'No user found with this email address',
      },
      'auth/wrong-password': {
        title: 'Invalid Password',
        message: 'The password is incorrect',
      },
      'auth/email-already-in-use': {
        title: 'Email Already in Use',
        message: 'An account with this email already exists',
      },
      'auth/weak-password': {
        title: 'Weak Password',
        message: 'Password should be at least 6 characters',
      },
      'auth/invalid-email': {
        title: 'Invalid Email',
        message: 'Please enter a valid email address',
      },
      'auth/network-request-failed': {
        title: 'Network Error',
        message: 'Please check your internet connection',
      },
      'permission-denied': {
        title: 'Permission Denied',
        message: 'You do not have permission to perform this action',
      },
      'not-found': {
        title: 'Not Found',
        message: 'The requested resource was not found',
      },
    };
    
    return errorMessages[error.code] || {
      title: 'Error',
      message: error.message || 'An unexpected error occurred',
    };
  }
  
  return {
    title: 'Error',
    message: error.message || 'An unexpected error occurred',
  };
};

/**
 * Validate GPS accuracy
 * @param {number} accuracy - GPS accuracy in meters
 * @returns {Object} - {isAcceptable: boolean, warning: string|null}
 */
export const validateGPSAccuracy = (accuracy) => {
  if (accuracy <= 20) {
    return { isAcceptable: true, warning: null };
  } else if (accuracy <= 50) {
    return {
      isAcceptable: true,
      warning: 'GPS accuracy is moderate. Consider improving signal.',
    };
  } else {
    return {
      isAcceptable: false,
      warning: 'GPS accuracy is poor. Please try again in an area with better signal.',
    };
  }
};

/**
 * Check if timestamp is within acceptable range (e.g., not too old)
 * @param {number} timestamp - Timestamp to check
 * @param {number} maxAgeMinutes - Maximum age in minutes (default: 5)
 * @returns {boolean} - True if within range
 */
export const isTimestampRecent = (timestamp, maxAgeMinutes = 5) => {
  const now = Date.now();
  const diff = now - timestamp;
  const maxAgeMs = maxAgeMinutes * 60 * 1000;
  return diff >= 0 && diff <= maxAgeMs;
};

