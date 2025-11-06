/**
 * Invitation service for sending user invitations via Mailjet
 * Note: User creation requires Firebase Admin SDK (Cloud Function)
 * For now, this service handles email sending only
 */

/**
 * Generate a secure temporary password
 * @returns {string} - Temporary password
 */
export const generateTemporaryPassword = () => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

/**
 * Get Netlify function URL
 * @returns {string} - Netlify function URL
 */
const getNetlifyFunctionUrl = () => {
  // In development, use local Netlify dev server
  // In production, use your deployed Netlify function URL
  if (import.meta.env.DEV) {
    return 'http://localhost:8888/.netlify/functions/send-email';
  }
  // Replace with your actual Netlify function URL
  return import.meta.env.VITE_NETLIFY_FUNCTION_URL || 'https://your-site.netlify.app/.netlify/functions/send-email';
};

/**
 * Send invitation email via Netlify function
 * @param {string} email - Recipient email
 * @param {string} role - User role ('trainer' or 'program_manager')
 * @param {string} temporaryPassword - Temporary password
 * @param {string} [appName] - Application name
 * @param {string} [loginUrl] - Login page URL
 * @returns {Promise<Object>} - Success/error response
 */
export const sendInvitationEmail = async (email, role, temporaryPassword, appName = 'Training Scheduler', loginUrl = window.location.origin + '/login') => {
  try {
    const response = await fetch(getNetlifyFunctionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'user_invitation',
        recipientEmail: email,
        data: {
          email,
          role,
          temporaryPassword,
          appName,
          loginUrl,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to send invitation email');
    }

    return {
      success: true,
      message: 'Invitation email sent successfully',
    };
  } catch (error) {
    console.error('Error sending invitation email:', error);
    throw error;
  }
};

/**
 * Send bulk invitation emails
 * @param {Array<{email: string, role: string, temporaryPassword: string}>} invitations - Array of invitation data
 * @param {string} [appName] - Application name
 * @param {string} [loginUrl] - Login page URL
 * @returns {Promise<Object>} - Success/error response with results
 */
export const sendBulkInvitationEmails = async (invitations, appName = 'Training Scheduler', loginUrl = window.location.origin + '/login') => {
  const results = {
    success: [],
    failed: [],
  };

  for (const invitation of invitations) {
    try {
      await sendInvitationEmail(
        invitation.email,
        invitation.role,
        invitation.temporaryPassword,
        appName,
        loginUrl
      );
      results.success.push(invitation.email);
    } catch (error) {
      results.failed.push({
        email: invitation.email,
        error: error.message,
      });
    }
  }

  return results;
};

/**
 * Parse CSV file for bulk invitations
 * @param {File} file - CSV file
 * @returns {Promise<Array<{email: string, role: string, name?: string}>>} - Parsed invitation data
 */
export const parseInvitationCSV = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        // Expected headers: email, role, name (optional)
        const emailIndex = headers.indexOf('email');
        const roleIndex = headers.indexOf('role');
        const nameIndex = headers.indexOf('name');
        
        if (emailIndex === -1 || roleIndex === -1) {
          reject(new Error('CSV must contain "email" and "role" columns'));
          return;
        }
        
        const invitations = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const email = values[emailIndex];
          const role = values[roleIndex];
          const name = nameIndex !== -1 ? values[nameIndex] : '';
          
          if (email && role) {
            // Validate role
            if (!['trainer', 'program_manager'].includes(role.toLowerCase())) {
              reject(new Error(`Invalid role "${role}" at line ${i + 1}. Must be "trainer" or "program_manager"`));
              return;
            }
            
            invitations.push({
              email,
              role: role.toLowerCase(),
              name,
            });
          }
        }
        
        resolve(invitations);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read CSV file'));
    };
    
    reader.readAsText(file);
  });
};

