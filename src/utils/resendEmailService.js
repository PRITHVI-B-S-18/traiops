/**
 * Email Service using Custom API Endpoint
 * API: POST http://localhost:3000/send
 * Format: { toAddress, Subject, Body }
 */

import { buildAppUrl } from './appUrls';
import { formatDateForDisplay, formatTimestamp } from './timezoneUtils';

// API endpoint configuration
const EMAIL_API_URL = import.meta.env.VITE_EMAIL_API_URL;

// Default URLs for emails
const DEFAULT_LOGIN_URL = buildAppUrl('login');
const DEFAULT_PM_REQUESTS_URL = buildAppUrl('program-manager/requests');
const DEFAULT_TRAINER_CLOCK_URL = buildAppUrl('trainer/clock-in');
const DEFAULT_ADMIN_CLOCK_REQUESTS_URL = buildAppUrl('admin/clock-requests');

/**
 * Send email via custom API endpoint
 * @param {string} toAddress - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body (HTML or plain text)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const sendEmail = async (toAddress, subject, body) => {
  try {
    // Add timeout to prevent hanging requests (10 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(EMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        toAddress,
        Subject: subject,
        Body: body
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    const messageId =
      result?.id ||
      result?.messageId ||
      result?.data?.id ||
      result?.data?.messageId ||
      null;

    return {
      success: true,
      messageId,
      result
    };
  } catch (error) {
    // Provide helpful error messages
    let errorMessage = error.message;
    
    if (error.name === 'AbortError') {
      errorMessage = `Email API timeout: Server did not respond within 10 seconds. Please check if your API server is running at ${EMAIL_API_URL}`;
    } else if (error.message === 'Failed to fetch') {
      errorMessage = `Cannot connect to email API at ${EMAIL_API_URL}. Please ensure your API server is running.`;
    }
    
    console.error('Email API error:', errorMessage);
    return {
      success: false,
      error: errorMessage,
      messageId: null
    };
  }
};

/**
 * Email Templates
 */
const templates = {
  /**
   * User Invitation Email
   */
  userInvitation: (data) => {
    const { displayName, email, role, tempPassword, loginUrl, signupUrl } = data;
    const isInvitationLink = !!signupUrl;
    const friendlyRole = role
      ? role
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      : 'Team Member';

    return {
      subject: 'You’re invited to Trainer Scheduler',
      body: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>Trainer Scheduler Invitation</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f9fafb">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#374151 0%,#1f2937 100%);padding:20px 24px;">
              <h1 style="margin:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:18px;color:#ffffff;font-weight:600;">Welcome to Trainer Scheduler</h1>
              <p style="margin:4px 0 0;font-size:12px;color:#d1d5db;">Manage trainers, schedules & approvals seamlessly</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
              <p style="margin:0 0 10px;font-size:14px;">Hi <strong>${displayName || 'there'}</strong>,</p>
              <p style="margin:0 0 16px;font-size:13px;color:#4b5563;line-height:1.6;">
                You’ve been invited to join <strong>Trainer Scheduler</strong> as a <strong>${friendlyRole}</strong>.
                This platform helps Program Managers approve clock-in requests, trainers manage schedules, and admins maintain compliance efficiently.
              </p>

              ${
                isInvitationLink
                  ? `
              <div style="text-align:center;margin:18px 0;">
                <a href="${signupUrl}" style="display:inline-block;padding:10px 24px;background:#1f2937;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px;">
                  Create Your Account →
                </a>
                <p style="margin:10px 0 0;font-size:12px;color:#6b7280;">This link expires in 7 days.</p>
              </div>`
                  : `
              <div style="background:#f3f4f6;border-radius:6px;padding:12px 16px;border-left:4px solid #1f2937;margin:14px 0;">
                <p style="margin:0;font-size:13px;"><strong>Email:</strong> ${email}</p>
                <p style="margin:4px 0 0;font-size:13px;"><strong>Temporary Password:</strong> <span style="font-weight:600;">${tempPassword}</span></p>
              </div>
              <div style="text-align:center;margin:20px 0;">
                <a href="${loginUrl || DEFAULT_LOGIN_URL}" style="display:inline-block;padding:10px 24px;background:#1f2937;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px;">
                  Log In →
                </a>
              </div>`
              }

              <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;text-align:center;">If you weren’t expecting this, you can safely ignore it.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:12px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">© ${new Date().getFullYear()} Trainer Scheduler. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
    };
  },

  scheduleNotification: (data) => {
    const {
      trainerName,
      emailSubject,
      emailTitle,
      emailMessage,
      actionMessage,
      taskTypeLabel,
      startDate,
      endDate,
      client,
      course,
      role,
      taskDetails,
      description,
      excludedDates = [],
      isTraining = true
    } = data;

    // Format dates for display (assume UTC if in YYYY-MM-DD format)
    const formatDateForEmail = (dateStr) => {
      if (!dateStr) return 'N/A';
      // If already formatted (contains spaces, commas, etc.), use as-is
      if (typeof dateStr === 'string' && (dateStr.includes(' ') || dateStr.includes(','))) {
        return dateStr;
      }
      // Otherwise, format as UTC date string
      return formatDateForDisplay(dateStr, 'MMMM d, yyyy', true);
    };

    const formattedStartDate = formatDateForEmail(startDate);
    const formattedEndDate = formatDateForEmail(endDate);
    const formattedExcludedDates = excludedDates.map(d => formatDateForEmail(d));

    const scheduleUrl = buildAppUrl('trainer/schedule');
    const badgeClass = isTraining ? 'training-badge' : 'non-training-badge';
    const excludedSection = formattedExcludedDates.length
      ? `
        <div class="excluded-dates">
            <h4> Excluded Dates:</h4>
            <p>Please note that the following dates have been excluded from your schedule:</p>
            <div class="excluded-dates-list">
                ${formattedExcludedDates.join('<br>')}
            </div>
            <p><em>These dates will not have any scheduled sessions.</em></p>
        </div>
      `
      : '';

    return {
      subject: emailSubject,
      body: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${emailSubject}</title>
    <style>
      body {
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        background-color: #f5f6f8;
        color: #2e2e2e;
        margin: 0;
        padding: 0;
        -webkit-font-smoothing: antialiased;
      }

      .email-wrapper {
        width: 100%;
        background-color: #f5f6f8;
        padding: 24px 0;
      }

      .email-container {
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
        max-width: 580px;
        margin: 0 auto;
        padding: 28px 32px;
        border: 1px solid #eef0f3;
      }

      .header {
        text-align: center;
        padding-bottom: 14px;
        border-bottom: 2px solid #dbeafe;
      }

      .header h1 {
        margin: 0;
        color: #2563eb;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 0.2px;
      }

      .greeting {
        margin-top: 20px;
        font-size: 14px;
        color: #1e293b;
      }

      .message {
        font-size: 13.5px;
        color: #475569;
        line-height: 1.6;
        margin: 12px 0 20px 0;
      }

      .schedule-details {
        background-color: #f8fafc;
        border-left: 4px solid #93c5fd;
        border-radius: 8px;
        padding: 16px 18px;
        margin: 16px 0;
      }

      .badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        margin-bottom: 10px;
        color: #1e3a8a;
        background-color: #dbeafe;
      }

      .non-training-badge {
        background-color: #fee2e2;
        color: #991b1b;
      }

      .schedule-details ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .schedule-details li {
        padding: 5px 0;
        font-size: 13px;
        border-bottom: 1px solid #e2e8f0;
      }

      .schedule-details li:last-child {
        border-bottom: none;
      }

      .schedule-details strong {
        display: inline-block;
        min-width: 120px;
        color: #2563eb;
      }

      .excluded-dates {
        background-color: #fff8e6;
        border: 1px solid #fde68a;
        border-radius: 8px;
        padding: 12px 16px;
        margin: 16px 0;
      }

      .excluded-dates h4 {
        margin: 0 0 8px;
        font-size: 13px;
        color: #92400e;
      }

      .excluded-dates p {
        font-size: 12.5px;
        margin: 0;
        color: #78350f;
      }

      .action-message {
        background-color: #e0f2fe;
        border: 1px solid #bae6fd;
        padding: 14px 18px;
        border-radius: 8px;
        font-size: 13.5px;
        font-weight: 500;
        color: #075985;
        margin-top: 18px;
        text-align: center;
      }

      .footer {
        text-align: center;
        margin-top: 26px;
        padding-top: 14px;
        border-top: 1px solid #e2e8f0;
        font-size: 12.5px;
        color: #64748b;
      }

      .signature {
        margin-bottom: 6px;
        font-weight: 600;
        color: #1e293b;
      }

      @media (max-width: 600px) {
        .email-container {
          padding: 20px 18px;
        }
        .schedule-details strong {
          min-width: 100px;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-wrapper">
      <div class="email-container">
        <!-- Header -->
        <div class="header">
          <h1>${emailTitle}</h1>
        </div>

        <!-- Greeting -->
        <div class="greeting">
          Hello <strong>${trainerName}</strong>,
        </div>

        <!-- Message -->
        <div class="message">
          ${emailMessage}
        </div>

        <!-- Schedule Card -->
        <div class="schedule-details">
          <div class="badge ${badgeClass}">${taskTypeLabel}</div>
          <ul>
            <li><strong>Start Date:</strong> ${formattedStartDate}</li>
            <li><strong>End Date:</strong> ${formattedEndDate}</li>
            <li><strong>Client:</strong> ${client}</li>
            <li><strong>Course:</strong> ${course}</li>
            <li><strong>Role:</strong> ${role}</li>
            <li><strong>Task:</strong> ${taskDetails}</li>
            <li><strong>Description:</strong> ${description}</li>
          </ul>
        </div>

        <!-- Optional Exclusion Section -->
        ${excludedSection}

        <!-- Action Message -->
        <div class="action-message">
          ${actionMessage}
          <p style="margin: 12px 0 0;">
            <a href="${scheduleUrl}" style="color: #2563eb; font-weight: 600; text-decoration: none;">
              Open your schedule →
            </a>
          </p>
        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="signature">
            Best regards,<br />Training Team
          </div>
          <p>
            This is an automated notification from
            <strong>Trainer Scheduler</strong>.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>
      `
    };
  },

  /**
   * Clock Request Pending - Notify Program Manager
   */
  clockRequestPending: (data) => {
    const {
      trainerName,
      date,
      time,
      location,
      approvalUrl,
      requestType,
      recipientName,
      recipientRole,
      ctaLabel,
      requestedAt
    } = data;

    // Format date and time for display
    const formatDateForEmail = (dateStr) => {
      if (!dateStr) return 'N/A';
      if (typeof dateStr === 'string' && (dateStr.includes(' ') || dateStr.includes(','))) {
        return dateStr;
      }
      return formatDateForDisplay(dateStr, 'MMMM d, yyyy', true);
    };

    const formatTimeForEmail = (timeStr) => {
      if (!timeStr) return 'N/A';
      // If time is a timestamp, format it
      if (timeStr?.toDate) {
        return formatTimestamp(timeStr, 'hh:mm a');
      }
      // If time is a Date object or timestamp number
      if (timeStr instanceof Date || typeof timeStr === 'number') {
        return formatTimestamp(timeStr, 'hh:mm a');
      }
      // Otherwise use as-is (already formatted)
      return timeStr;
    };

    // Format requestedAt timestamp for "Requested at" display
    const formatRequestedAt = (requestedAtTimestamp) => {
      if (!requestedAtTimestamp) {
        // Fallback: combine date and time if requestedAt not available
        const formattedDate = formatDateForEmail(date);
        const formattedTime = formatTimeForEmail(time);
        return `${formattedDate} at ${formattedTime}`;
      }
      if (requestedAtTimestamp?.toDate) {
        return formatTimestamp(requestedAtTimestamp, 'MMM d, yyyy hh:mm a');
      }
      if (requestedAtTimestamp instanceof Date || typeof requestedAtTimestamp === 'number') {
        return formatTimestamp(requestedAtTimestamp, 'MMM d, yyyy hh:mm a');
      }
      return 'N/A';
    };

    const formattedDate = formatDateForEmail(date);
    const formattedTime = formatTimeForEmail(time);
    // Use requestedAt if provided, otherwise fallback to combining date and time
    const requestedAtFormatted = requestedAt ? formatRequestedAt(requestedAt) : formatRequestedAt(null);

    const typeLabel = requestType === 'clock_out' ? 'Clock-Out' : 'Clock-In';
    const buttonLabel = ctaLabel || 'Review Request';
    const greetingName = recipientName ? ` ${recipientName}` : '';
  const roleLabel = recipientRole || 'Team Member';
    
    return {
    subject: `New ${typeLabel} Request from ${trainerName}`,
      body: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${typeLabel} Request - Trainer Scheduler</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f9fafb;">
    <table width="100%" cellspacing="0" cellpadding="0" bgcolor="#f9fafb">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,0.06);max-width:560px;">
            <!-- Header -->
            <tr>
              <td align="center" style="background:linear-gradient(135deg,#E3F2FD 0%,#BBDEFB 100%);padding:28px 24px;">
                <h1 style="margin:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:20px;color:#1E3A8A;font-weight:700;">
                  New ${typeLabel} Request
                </h1>
                <p style="margin:6px 0 0;font-size:13px;color:#1E3A8A;opacity:0.8;">Action Required — Review & Approve</p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:24px 24px 16px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
                <p style="margin:0 0 10px;font-size:14px;">Hello <strong>${greetingName || 'Team Member'}</strong>,</p>
                <p style="margin:0 0 10px;font-size:13px;color:#4b5563;line-height:1.6;">
                  You are receiving this notification as the assigned <strong>${roleLabel}</strong> for this request.
                </p>
                <p style="margin:0 0 16px;font-size:13px;color:#4b5563;line-height:1.6;">
                  <strong>${trainerName}</strong> has submitted a new <strong>${typeLabel}</strong> request that requires your review.
                </p>

                <!-- Info Box -->
                <div style="margin:16px 0 20px;background:#E8F0FE;border-radius:6px;padding:14px 18px;border-left:4px solid #1E3A8A;">
                  <p style="margin:0;font-size:13px;color:#1f2937;line-height:1.6;">
                    <strong>Requested for:</strong> ${formattedDate}<br/>
                    <strong>Requested at:</strong> ${requestedAtFormatted}<br/>
                    <strong>Location:</strong> ${location || 'Not specified'}
                        </p>
                </div>

                <!-- CTA Button -->
                <div style="margin:20px 0;text-align:center;">
                  <a href="${approvalUrl || DEFAULT_PM_REQUESTS_URL}"
                     style="display:inline-block;padding:10px 26px;background:#1E3A8A;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px;">
                    ${buttonLabel} →
                  </a>
                </div>

                <p style="margin:8px 0 0;font-size:12px;color:#6b7280;text-align:center;">
                  Please review promptly to maintain accurate attendance records.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb;padding:14px 22px;text-align:center;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:11px;color:#9ca3af;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                  © ${new Date().getFullYear()} Trainer Scheduler. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
    };
  },
  /**
   * Clock Request Approved - Notify Trainer
   */
  clockRequestApproved: (data) => {
    const { trainerName, date, approvedBy, description, location, dashboardUrl, ctaLabel, requestedAt } = data;

    // Format date for display
    const formatDateForEmail = (dateStr) => {
      if (!dateStr) return 'N/A';
      if (typeof dateStr === 'string' && (dateStr.includes(' ') || dateStr.includes(','))) {
        return dateStr;
      }
      return formatDateForDisplay(dateStr, 'MMMM d, yyyy', true);
    };

    // Format requestedAt timestamp for "Requested at" display
    const formatRequestedAt = (requestedAtTimestamp) => {
      if (!requestedAtTimestamp) return 'N/A';
      if (requestedAtTimestamp?.toDate) {
        return formatTimestamp(requestedAtTimestamp, 'MMM d, yyyy hh:mm a');
      }
      if (requestedAtTimestamp instanceof Date || typeof requestedAtTimestamp === 'number') {
        return formatTimestamp(requestedAtTimestamp, 'MMM d, yyyy hh:mm a');
      }
      return 'N/A';
    };

    const formattedDate = formatDateForEmail(date);
    const requestedAtFormatted = formatRequestedAt(requestedAt);

    const historyUrl = dashboardUrl || buildAppUrl('trainer/history');
    const buttonLabel = ctaLabel || 'View My Clock History';
    
    return {
      subject: 'Clock-In Request Approved',
      body: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Clock-In Request Approved - Trainer Scheduler</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f6f8fa;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f6f8fa">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table width="600" border="0" cellspacing="0" cellpadding="0"
            style="max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden;
                   box-shadow:0 8px 28px rgba(0,0,0,0.06);">

            <!-- Header -->
            <tr>
              <td align="center"
                  style="background:linear-gradient(135deg,#D1FAE5 0%,#A7F3D0 100%);
                         padding:40px 32px;">
                <h1 style="margin:0; font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                           font-size:28px; color:#0F766E; font-weight:700;">
                  Clock-In Request Approved
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 32px 24px; font-family:'Segoe UI',Helvetica,Arial,sans-serif; color:#1f1f1f;">
                <p style="margin:0 0 18px; font-size:16px;">Hello <strong>${trainerName}</strong>,</p>
                <p style="margin:0 0 24px; font-size:15px; color:#4b4b4b;">
                  Great news! Your clock-in request has been <strong style="color:#0F766E;">approved</strong>.
                </p>

                <!-- Info Box -->
                <div style="margin:28px 0; background:#ECFDF5; border-radius:8px; padding:20px 24px; 
                            border-left:4px solid #0F766E;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding:6px 0;">
                        <p style="margin:0; font-size:14px; color:#1F2937;">
                          <strong>Requested for:</strong> 
                          <span style="color:#374151;">${formattedDate}</span>
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;">
                        <p style="margin:0; font-size:14px; color:#1F2937;">
                          <strong>Requested at:</strong> 
                          <span style="color:#374151;">${requestedAtFormatted}</span>
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;">
                        <p style="margin:0; font-size:14px; color:#1F2937;">
                          <strong>Approved By:</strong> 
                          <span style="color:#374151;">${approvedBy}</span>
                        </p>
                      </td>
                    </tr>
                    ${location ? `
                    <tr>
                      <td style="padding:6px 0;">
                        <p style="margin:0; font-size:14px; color:#1F2937;">
                          <strong>Location:</strong> 
                          <span style="color:#374151;">${location}</span>
                        </p>
                      </td>
                    </tr>
                    ` : ''}
                    ${description ? `
                    <tr>
                      <td style="padding:12px 0 4px; border-top:1px solid #D1FAE5;">
                        <p style="margin:0 0 6px; font-size:13px; color:#065F46; font-weight:600;">Note from Approver:</p>
                        <p style="margin:0; font-size:14px; color:#374151; font-style:italic; line-height:1.6;">${description}</p>
                      </td>
                    </tr>
                    ` : ''}
                  </table>
                </div>

                <!-- CTA Button -->
                <div style="margin:32px 0; text-align:center;">
                  <a href="${historyUrl}" 
                     style="display:inline-block; padding:14px 36px; background:#0F766E; color:#ffffff; 
                            text-decoration:none; border-radius:8px; font-weight:600; font-size:15px;
                            letter-spacing:0.3px;">
                    ${buttonLabel || 'View Attendance History'} →
                  </a>
</div>

                <p style="margin:0 0 24px; font-size:15px; color:#4b4b4b; text-align:center;">
                  Thank you for keeping your attendance up to date.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#F9FAFB; padding:20px 32px; text-align:center; border-top:1px solid #E5E7EB;">
                <p style="margin:0; font-size:12px; color:#9CA3AF; font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                  © ${new Date().getFullYear()} Trainer Scheduler. All rights reserved.<br/>
                  This is an automated message — please do not reply.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
    };
  },

  /**
   * Clock Request Rejected - Notify Trainer
   */
  clockRequestRejected: (data) => {
    const { trainerName, date, reason, dashboardUrl, location, rejectedBy, ctaLabel, requestedAt } = data;
    
    // Format date for display
    const formatDateForEmail = (dateStr) => {
      if (!dateStr) return 'N/A';
      if (typeof dateStr === 'string' && (dateStr.includes(' ') || dateStr.includes(','))) {
        return dateStr;
      }
      return formatDateForDisplay(dateStr, 'MMMM d, yyyy', true);
    };

    // Format requestedAt timestamp for "Requested at" display
    const formatRequestedAt = (requestedAtTimestamp) => {
      if (!requestedAtTimestamp) return 'N/A';
      if (requestedAtTimestamp?.toDate) {
        return formatTimestamp(requestedAtTimestamp, 'MMM d, yyyy hh:mm a');
      }
      if (requestedAtTimestamp instanceof Date || typeof requestedAtTimestamp === 'number') {
        return formatTimestamp(requestedAtTimestamp, 'MMM d, yyyy hh:mm a');
      }
      return 'N/A';
    };

    const formattedDate = formatDateForEmail(date);
    const requestedAtFormatted = formatRequestedAt(requestedAt);
    
    const resolutionUrl = dashboardUrl || buildAppUrl('trainer/history');
    const buttonLabel = ctaLabel || 'Review in Dashboard';
    
    return {
      subject: 'Clock-In Request Not Approved',
      body: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Clock-In Request Not Approved - Trainer Scheduler</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f6f8fa;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f6f8fa">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table width="600" border="0" cellspacing="0" cellpadding="0"
            style="max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden;
                   box-shadow:0 8px 28px rgba(0,0,0,0.06);">

            <!-- Header -->
            <tr>
              <td align="center"
                  style="background:linear-gradient(135deg,#FEE2E2 0%,#FECACA 100%);
                         padding:40px 32px;">
                <h1 style="margin:0; font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                           font-size:28px; color:#B91C1C; font-weight:700;">
                  Clock-In Request Not Approved
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 32px 24px; font-family:'Segoe UI',Helvetica,Arial,sans-serif; color:#1f1f1f;">
                <p style="margin:0 0 18px; font-size:16px;">Hello <strong>${trainerName}</strong>,</p>
                <p style="margin:0 0 24px; font-size:15px; color:#4b4b4b;">
                  We wanted to inform you that your clock request was not approved. Please review the details below.
                </p>

                <!-- Info Box -->
                <div style="margin:28px 0; background:#FEF2F2; border-radius:8px; padding:20px 24px;
                            border-left:4px solid #B91C1C;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding:6px 0;">
                        <p style="margin:0; font-size:14px; color:#1F2937;">
                          <strong>Requested for:</strong> 
                          <span style="color:#374151;">${formattedDate}</span>
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;">
                        <p style="margin:0; font-size:14px; color:#1F2937;">
                          <strong>Requested at:</strong> 
                          <span style="color:#374151;">${requestedAtFormatted}</span>
                        </p>
                      </td>
                    </tr>
                    ${location ? `
                    <tr>
                      <td style="padding:6px 0;">
                        <p style="margin:0; font-size:14px; color:#1F2937;">
                          <strong>Location:</strong> 
                          <span style="color:#374151;">${location}</span>
                        </p>
                      </td>
                    </tr>
                    ` : ''}
                    ${rejectedBy ? `
                    <tr>
                      <td style="padding:6px 0;">
                        <p style="margin:0; font-size:14px; color:#1F2937;">
                          <strong>Rejected By:</strong> 
                          <span style="color:#374151;">${rejectedBy}</span>
                        </p>
                      </td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding:12px 0 4px; border-top:1px solid #FECACA;">
                        <p style="margin:0 0 6px; font-size:13px; color:#7F1D1D; font-weight:600;">Reason:</p>
                        <p style="margin:0; font-size:14px; color:#374151; line-height:1.6;">${reason || 'No reason provided'}</p>
                      </td>
                    </tr>
                  </table>
                </div>

                <p style="margin:0 0 24px; font-size:15px; color:#4b4b4b;">
                  If you have any questions or concerns about this decision, please contact your program manager for clarification.
                </p>

                <!-- CTA Button -->
                <div style="margin:32px 0; text-align:center;">
                  <a href="${resolutionUrl}" 
                     style="display:inline-block; padding:14px 36px; background:#B91C1C; color:#ffffff; 
                            text-decoration:none; border-radius:8px; font-weight:600; font-size:15px;
                            letter-spacing:0.3px;">
                    ${buttonLabel || 'View Details'} →
                  </a>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#F9FAFB; padding:20px 32px; text-align:center; border-top:1px solid #E5E7EB;">
                <p style="margin:0; font-size:12px; color:#9CA3AF; font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                  © ${new Date().getFullYear()} Trainer Scheduler. All rights reserved.<br/>
                  This is an automated message — please do not reply.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
    };
  },

  /**
   * Clock Request Expired - Notify Trainer
   */
  clockRequestExpiredTrainer: (data) => {
    const { trainerName, date, time, resubmitUrl } = data;

    // Format date and time for display
    const formatDateForEmail = (dateStr) => {
      if (!dateStr) return 'N/A';
      if (typeof dateStr === 'string' && (dateStr.includes(' ') || dateStr.includes(','))) {
        return dateStr;
      }
      return formatDateForDisplay(dateStr, 'MMMM d, yyyy', true);
    };

    const formatTimeForEmail = (timeStr) => {
      if (!timeStr) return 'N/A';
      if (timeStr?.toDate) {
        return formatTimestamp(timeStr, 'hh:mm a');
      }
      return timeStr;
    };

    const formattedDate = formatDateForEmail(date);
    const formattedTime = formatTimeForEmail(time);

    return {
      subject: 'Clock-In Request Expired',
      body: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Clock-In Request Expired - Trainer Scheduler</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f6f8fa;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f6f8fa">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table width="560" border="0" cellspacing="0" cellpadding="0"
            style="max-width:560px; background:#ffffff; border-radius:10px; overflow:hidden;
                   box-shadow:0 6px 18px rgba(0,0,0,0.05);">

            <!-- Header -->
            <tr>
              <td align="center"
                  style="background:linear-gradient(135deg,#E0F2FE 0%,#BFDBFE 100%);
                         padding:26px 22px;">
                <h1 style="margin:0; font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                           font-size:20px; color:#1E3A8A; font-weight:600;">
                  Clock-In Request Expired
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:24px 24px 18px; font-family:'Segoe UI',Helvetica,Arial,sans-serif; color:#1F2937;">
                <p style="margin:0 0 10px; font-size:14px;">Hi <strong>${trainerName}</strong>,</p>
                <p style="margin:0 0 12px; font-size:13px; color:#4B5563; line-height:1.6;">
                  Your pending clock-in request from <strong>${formattedDate}</strong> at <strong>${formattedTime}</strong> has expired because it was not approved within seven days.
                </p>
                <p style="margin:0 0 16px; font-size:13px; color:#4B5563; line-height:1.6;">
                  Please submit a new request if you still need to record your time for this session.
                </p>

                <div style="margin:20px 0; text-align:center;">
                  <a href="${resubmitUrl || DEFAULT_TRAINER_CLOCK_URL}"
                     style="display:inline-block; padding:10px 26px; background:#1E3A8A; color:#ffffff;
                            text-decoration:none; border-radius:6px; font-weight:600; font-size:13px;">
                    Submit New Request →
                  </a>
                </div>

                <p style="margin:8px 0 0; font-size:12px; color:#9CA3AF; text-align:center; line-height:1.5;">
                  This message is for your records. No further action is required if this session is no longer needed.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#F9FAFB; padding:14px 22px; text-align:center; border-top:1px solid #E5E7EB;">
                <p style="margin:0; font-size:11px; color:#9CA3AF; font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                  © ${new Date().getFullYear()} Trainer Scheduler. All rights reserved.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
    };
  },

  /**
   * Clock Request Expired - Notify Admin / PM
   */
  clockRequestExpiredStakeholder: (data) => {
    const { recipientName, trainerName, date, time, requestType, reviewUrl } = data;

    // Format date and time for display
    const formatDateForEmail = (dateStr) => {
      if (!dateStr) return 'N/A';
      if (typeof dateStr === 'string' && (dateStr.includes(' ') || dateStr.includes(','))) {
        return dateStr;
      }
      return formatDateForDisplay(dateStr, 'MMMM d, yyyy', true);
    };

    const formatTimeForEmail = (timeStr) => {
      if (!timeStr) return 'N/A';
      if (timeStr?.toDate) {
        return formatTimestamp(timeStr, 'hh:mm a');
      }
      return timeStr;
    };

    const formattedDate = formatDateForEmail(date);
    const formattedTime = formatTimeForEmail(time);

    return {
      subject: `Expired ${requestType} Request – ${trainerName}`,
      body: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Clock-In Request Expired - Trainer Scheduler</title>
  </head>
  <body style="margin:0; padding:0; background-color:#ffffff;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff">
      <tr>
        <td align="center" style="padding:20px 12px;">
          <table width="540" border="0" cellspacing="0" cellpadding="0"
            style="max-width:540px; background:#ffffff; border-radius:8px; overflow:hidden;
                   border:1px solid #E5E7EB; box-shadow:0 4px 14px rgba(0,0,0,0.04);">

            <!-- Header -->
            <tr>
              <td align="center"
                  style="background:linear-gradient(135deg,#F1F5F9 0%,#E2E8F0 100%);
                         padding:22px 18px;">
                <h1 style="margin:0; font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                           font-size:18px; color:#111827; font-weight:600;">
                  Clock-In Request Expired
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:24px 24px 18px; font-family:'Segoe UI',Helvetica,Arial,sans-serif; color:#1E293B;">
                <p style="margin:0 0 8px; font-size:14px; color:#111827;">
                  Hello <strong>${recipientName || 'Team Member'}</strong>,
                </p>

                <p style="margin:0 0 10px; font-size:13px; color:#374151; line-height:1.6;">
                  A pending <strong>${requestType}</strong> request for <strong>${trainerName}</strong> (submitted on ${formattedDate} at ${formattedTime}) has expired because it was not approved within the allowed timeframe.
                </p>

                <p style="margin:0 0 14px; font-size:13px; color:#374151; line-height:1.6;">
                  You can review this request in your dashboard if additional action is required.
                </p>

                <!-- CTA Button -->
                <div style="margin:20px 0; text-align:center;">
                  <a href="${reviewUrl || DEFAULT_ADMIN_CLOCK_REQUESTS_URL}"
                     style="display:inline-block; padding:9px 22px; background:#1F2937; color:#ffffff;
                            text-decoration:none; border-radius:6px; font-weight:600; font-size:13px;">
                    Review Expired Request →
                  </a>
                </div>

                <p style="margin:8px 0 0; font-size:12px; color:#6B7280; text-align:center; line-height:1.5;">
                  This message is for your records. The request has been archived as expired.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#ffffff; padding:14px 20px; text-align:center; border-top:1px solid #E5E7EB;">
                <p style="margin:0; font-size:11px; color:#9CA3AF; font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                  © ${new Date().getFullYear()} Trainer Scheduler. All rights reserved.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
    };
  },

  /**
   * Clock Request Cancelled - General notification
   */
  clockRequestCancelled: (data) => {
    const { recipientName, trainerName, date, reason, reviewUrl, ctaLabel } = data;

    // Format date for display
    const formatDateForEmail = (dateStr) => {
      if (!dateStr) return 'N/A';
      if (typeof dateStr === 'string' && (dateStr.includes(' ') || dateStr.includes(','))) {
        return dateStr;
      }
      return formatDateForDisplay(dateStr, 'MMMM d, yyyy', true);
    };

    const formattedDate = formatDateForEmail(date);

    return {
      subject: `Clock-In Request Cancelled – ${trainerName}`,
      body: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Clock-In Request Cancelled - Trainer Scheduler</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f6f8fa;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f6f8fa">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table width="560" border="0" cellspacing="0" cellpadding="0"
            style="max-width:560px; background:#ffffff; border-radius:10px; overflow:hidden;
                   box-shadow:0 6px 18px rgba(0,0,0,0.05);">

            <!-- Header -->
            <tr>
              <td align="center"
                  style="background:linear-gradient(135deg,#FEE2E2 0%,#FCA5A5 100%);
                         padding:26px 22px;">
                <h1 style="margin:0; font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                           font-size:20px; color:#7F1D1D; font-weight:600;">
                  Clock-In Request Cancelled
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:24px 24px 18px; font-family:'Segoe UI',Helvetica,Arial,sans-serif; color:#1F2937;">
                <p style="margin:0 0 10px; font-size:14px;">Hello <strong>${recipientName || 'Team Member'}</strong>,</p>
                <p style="margin:0 0 12px; font-size:13px; color:#4B5563; line-height:1.6;">
                  The pending clock-in request for <strong>${trainerName}</strong> on <strong>${formattedDate}</strong> has been cancelled.
                </p>

                <div style="margin:16px 0 20px; background:#FEF2F2; border-radius:6px; padding:14px 18px; border-left:4px solid #B91C1C;">
                  <p style="margin:0; font-size:13px; color:#1F2937; line-height:1.6;">
                    <strong>Reason:</strong> ${reason || 'Request closed by administrator'}
                  </p>
                </div>

                ${reviewUrl ? `
                <div style="margin:20px 0; text-align:center;">
                  <a href="${reviewUrl}" 
                     style="display:inline-block; padding:10px 26px; background:#B91C1C; color:#ffffff;
                            text-decoration:none; border-radius:6px; font-weight:600; font-size:13px;">
                    ${ctaLabel || 'Open Clock Requests'} →
                  </a>
                </div>
                ` : ''}

                <p style="margin:8px 0 0; font-size:12px; color:#9CA3AF; text-align:center; line-height:1.5;">
                  This message is for your records. No further action is required.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#F9FAFB; padding:14px 22px; text-align:center; border-top:1px solid #E5E7EB;">
                <p style="margin:0; font-size:11px; color:#9CA3AF; font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                  © ${new Date().getFullYear()} Trainer Scheduler. All rights reserved.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
    };
  },

  /**
   * Clock Request Rerouted - Notify new assignee
   */
  clockRequestRerouted: (data) => {
    const { recipientName, trainerName, date, requestType, reviewUrl } = data;

    // Format date for display
    const formatDateForEmail = (dateStr) => {
      if (!dateStr) return 'N/A';
      if (typeof dateStr === 'string' && (dateStr.includes(' ') || dateStr.includes(','))) {
        return dateStr;
      }
      return formatDateForDisplay(dateStr, 'MMMM d, yyyy', true);
    };

    const formattedDate = formatDateForEmail(date);

    return {
      subject: `New ${requestType} Request Assigned – ${trainerName}`,
      body: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Clock Request Assigned - Trainer Scheduler</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f6f8fa;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f6f8fa">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table width="560" border="0" cellspacing="0" cellpadding="0"
            style="max-width:560px; background:#ffffff; border-radius:10px; overflow:hidden;
                   box-shadow:0 6px 18px rgba(0,0,0,0.06);">

            <!-- Header -->
            <tr>
              <td align="center"
                  style="background:linear-gradient(135deg,#CFFAFE 0%,#A5F3FC 100%);
                         padding:26px 22px;">
                <h1 style="margin:0; font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                           font-size:20px; color:#0E7490; font-weight:600;">
                  Clock Request Assigned
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:24px 24px 18px; font-family:'Segoe UI',Helvetica,Arial,sans-serif; color:#1F2937;">
                <p style="margin:0 0 10px; font-size:14px;">Hello <strong>${recipientName || 'Program Manager'}</strong>,</p>
                <p style="margin:0 0 12px; font-size:13px; color:#334155; line-height:1.6;">
                  A pending <strong>${requestType}</strong> request for <strong>${trainerName}</strong> dated <strong>${formattedDate}</strong> has been reassigned to you for review.
                </p>

                <!-- CTA Button -->
                <div style="margin:20px 0; text-align:center;">
                  <a href="${reviewUrl || DEFAULT_PM_REQUESTS_URL}"
                     style="display:inline-block; padding:10px 26px; background:#0E7490; color:#ffffff;
                            text-decoration:none; border-radius:6px; font-weight:600; font-size:13px;">
                    Review Now →
                  </a>
                </div>

                <p style="margin:8px 0 0; font-size:12px; color:#64748b; text-align:center; line-height:1.5;">
                  Please review and take action promptly to keep attendance records accurate.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#F9FAFB; padding:14px 22px; text-align:center; border-top:1px solid #E5E7EB;">
                <p style="margin:0; font-size:11px; color:#9CA3AF; font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                  © ${new Date().getFullYear()} Trainer Scheduler. All rights reserved.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
    };
  }
};

/**
 * Send User Invitation Email
 * @param {string} email - Recipient email
 * @param {string} displayName - User's display name
 * @param {string} role - User role (trainer, program_manager, admin)
 * @param {string} tempPassword - Temporary password (legacy method, optional)
 * @param {string} loginUrl - Login page URL (legacy method, optional)
 * @param {string} signupUrl - Signup page URL with invitation token (new method, optional)
 */
export const sendInvitationEmail = async (email, displayName, role, tempPassword = null, loginUrl = null, signupUrl = null) => {
  const template = templates.userInvitation({
    displayName,
    email,
    role,
    tempPassword,
    loginUrl: loginUrl || buildAppUrl('login'),
    signupUrl: signupUrl || null
  });

  const response = await sendEmail(email, template.subject, template.body);

  if (!response?.success) {
    throw new Error(response?.error || 'Failed to send invitation email');
  }

  return response;
};

/**
 * Notify Program Manager of New Clock Request
 * @param {string} pmEmail - Program Manager email
 * @param {string} trainerName - Trainer's name
 * @param {string} date - Request date
 * @param {string} time - Request time
 * @param {string} location - Location string
 * @param {Object} options
 * @param {string} options.approvalUrl - URL to approval page (optional)
 * @param {string} options.requestType - 'clock_in' or 'clock_out' (optional)
 * @param {string} options.recipientName - Recipient display name (optional)
 * @param {string} options.recipientRole - Recipient role label (optional)
 * @param {string} options.ctaLabel - CTA button label override (optional)
 */
export const notifyProgramManager = async (
  pmEmail,
  trainerName,
  date,
  time,
  location,
  {
    approvalUrl = null,
    requestType = 'clock_in',
    recipientName = '',
    recipientRole = '',
    ctaLabel = '',
    requestedAt = null
  } = {}
) => {
  const template = templates.clockRequestPending({
    trainerName,
    date,
    time,
    location,
    approvalUrl: approvalUrl || buildAppUrl('program-manager/requests'),
    requestType,
    recipientName,
    recipientRole,
    ctaLabel,
    requestedAt
  });

  return sendEmail(pmEmail, template.subject, template.body);
};

/**
 * Notify Trainer of Approval
 * @param {string} trainerEmail - Trainer email
 * @param {string} trainerName - Trainer's name
 * @param {string} date - Request date
 * @param {string} approvedBy - Approver's name
 * @param {string} description - Optional approval note
 * @param {string} location - Optional location string
 * @param {string} dashboardUrl - Optional dashboard link for trainer
 * @param {string} ctaLabel - Optional CTA label override
 */
export const notifyTrainerApproved = async (
  trainerEmail,
  trainerName,
  date,
  approvedBy,
  description = null,
  location = null,
  dashboardUrl = null,
  ctaLabel = null,
  requestedAt = null
) => {
  const template = templates.clockRequestApproved({
    trainerName,
    date,
    approvedBy,
    description,
    location,
    dashboardUrl,
    dashboardUrl,
    ctaLabel,
    requestedAt
  });

  return sendEmail(trainerEmail, template.subject, template.body);
};

/**
 * Notify Trainer of Rejection
 * @param {string} trainerEmail - Trainer email
 * @param {string} trainerName - Trainer's name
 * @param {string} date - Request date
 * @param {string} reason - Rejection reason (dynamic, provided by PM/Admin)
 * @param {string} dashboardUrl - Dashboard URL (optional)
 * @param {string} location - Optional location string
 * @param {string} rejectedBy - Name of PM/Admin who rejected (optional)
 * @param {string} ctaLabel - Optional CTA label override
 */
export const notifyTrainerRejected = async (
  trainerEmail,
  trainerName,
  date,
  reason,
  dashboardUrl = null,
  location = null,
  rejectedBy = null,
  ctaLabel = null,
  requestedAt = null
) => {
  const template = templates.clockRequestRejected({
    trainerName,
    date,
    reason,
    dashboardUrl: dashboardUrl || buildAppUrl('trainer/history'),
    location,
    rejectedBy,
    ctaLabel,
    requestedAt
  });

  return sendEmail(trainerEmail, template.subject, template.body);
};

/**
 * Notify Trainer of Expired Request
 */
export const notifyRequestExpiredTrainer = async (trainerEmail, trainerName, date, time, resubmitUrl = null) => {
  const template = templates.clockRequestExpiredTrainer({
    trainerName,
    date,
    time,
    resubmitUrl: resubmitUrl || buildAppUrl('trainer/clock-in')
  });

  return sendEmail(trainerEmail, template.subject, template.body);
};

/**
 * Notify Admin/PM of Expired Request
 */
export const notifyRequestExpiredStakeholder = async (recipientEmail, recipientName, trainerName, date, time, requestType = 'Clock-In', reviewUrl = null) => {
  const template = templates.clockRequestExpiredStakeholder({
    recipientName,
    trainerName,
    date,
    time,
    requestType,
    reviewUrl: reviewUrl || buildAppUrl('admin/clock-requests')
  });

  return sendEmail(recipientEmail, template.subject, template.body);
};

/**
 * Notify stakeholders of cancelled request
 */
export const notifyRequestCancelled = async (recipientEmail, recipientName, trainerName, date, reason, reviewUrl = null, ctaLabel = null) => {
  const template = templates.clockRequestCancelled({
    recipientName,
    trainerName,
    date,
    reason,
    reviewUrl: reviewUrl || buildAppUrl('admin/clock-requests'),
    ctaLabel
  });

  return sendEmail(recipientEmail, template.subject, template.body);
};

/**
 * Notify assignee of rerouted request
 */
export const notifyRequestRerouted = async (recipientEmail, recipientName, trainerName, date, requestType = 'Clock-In', reviewUrl = null) => {
  const template = templates.clockRequestRerouted({
    recipientName,
    trainerName,
    date,
    requestType,
    reviewUrl: reviewUrl || buildAppUrl('program-manager/requests')
  });

  return sendEmail(recipientEmail, template.subject, template.body);
};

export const sendScheduleNotificationEmail = async (data) => {
  const template = templates.scheduleNotification(data);
  return sendEmail(data.to, template.subject, template.body);
};

// Export default for convenience
export default {
  sendEmail,
  sendInvitationEmail,
  notifyProgramManager,
  notifyTrainerApproved,
  notifyTrainerRejected,
  notifyRequestExpiredTrainer,
  notifyRequestExpiredStakeholder,
  notifyRequestCancelled,
  notifyRequestRerouted,
  sendScheduleNotificationEmail
};

