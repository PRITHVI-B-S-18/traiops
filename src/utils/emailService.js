import { EMAILJS_CONFIG } from '../config/emailjs';
import { loadTrainerData } from './firestoreTrainers';

// EmailJS Configuration - Free email service
// Sign up at: https://www.emailjs.com/

// Email notification types
export const EMAIL_TYPES = {
  SCHEDULE_CREATED: 'schedule_created',
  SCHEDULE_UPDATED: 'schedule_updated',
  SCHEDULE_DELETED: 'schedule_deleted',
  NON_TRAINING_CREATED: 'non_training_created',
  NON_TRAINING_UPDATED: 'non_training_updated',
  NON_TRAINING_DELETED: 'non_training_deleted',
  DAILY_REMINDER: 'daily_reminder',
  WEEKLY_REMINDER: 'weekly_reminder',
  SESSION_REMINDER: 'session_reminder'
};

// Send email notification using EmailJS
export const sendEmailNotification = async (emailType, trainerName, data) => {
  try {
    // Load trainer data to get the email
    const trainerList = await loadTrainerData();
    const trainer = trainerList.find(t => t.name === trainerName);
    
    if (!trainer || !trainer.email) {
      throw new Error(`No email found for trainer: ${trainerName}`);
    }
    
    const recipientEmail = trainer.email;
    console.log(`Found email for trainer ${trainerName}: ${recipientEmail}`);

    // Load EmailJS if not already loaded
    if (typeof window !== 'undefined' && !window.emailjs) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
      document.head.appendChild(script);
      
      await new Promise((resolve) => {
        script.onload = resolve;
      });
    }

    // Map email types to EmailJS templates
    const templateMap = {
      'schedule_created': EMAILJS_CONFIG.TEMPLATES.SCHEDULE_CREATED,
      'schedule_updated': EMAILJS_CONFIG.TEMPLATES.SCHEDULE_UPDATED,
      'schedule_deleted': EMAILJS_CONFIG.TEMPLATES.SCHEDULE_DELETED,
      'non_training_created': EMAILJS_CONFIG.TEMPLATES.NON_TRAINING_CREATED,
      'non_training_updated': EMAILJS_CONFIG.TEMPLATES.NON_TRAINING_UPDATED,
      'non_training_deleted': EMAILJS_CONFIG.TEMPLATES.NON_TRAINING_DELETED,
      'daily_reminder': EMAILJS_CONFIG.TEMPLATES.DAILY_REMINDER,
      'weekly_reminder': EMAILJS_CONFIG.TEMPLATES.WEEKLY_REMINDER
    };

    const templateId = templateMap[emailType];
    if (!templateId) {
      throw new Error(`Unknown email type: ${emailType}`);
    }

    // Format dates properly for email
    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';
      try {
        return new Date(dateStr).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      } catch (error) {
        return dateStr;
      }
    };

    // Prepare email data based on type
    let emailData = {
      to_email: recipientEmail,
      trainer_name: data.trainerName,
      date: formatDate(data.date),
      start_date: formatDate(data.startDate || data.date),
      end_date: formatDate(data.endDate || data.date),
      client: data.client || 'N/A',
      course: data.course || 'N/A',
      role: data.role || 'N/A',
      task_details: data.taskDetails || 'N/A',
      task_type: data.taskType || 'N/A',
      description: data.description || 'N/A',
      excluded_dates: data.excludedDates || []
    };

    // Add template-specific data
    if (emailType === 'schedule_created') {
      emailData = {
        ...emailData,
        task_type: 'Training Session',
        email_subject: 'New Training Session Assigned',
        email_title: 'New Training Session Assigned',
        email_message: 'You have been assigned to a new training session:',
        action_message: 'Please review your schedule and prepare accordingly.',
        is_training: true,
        has_excluded_dates: emailData.excluded_dates && emailData.excluded_dates.length > 0,
        excluded_dates_list: emailData.excluded_dates ? emailData.excluded_dates.join(', ') : ''
      };
    } else if (emailType === 'schedule_updated') {
      emailData = {
        ...emailData,
        task_type: 'Training Session',
        email_subject: 'Training Session Updated',
        email_title: 'Training Session Updated',
        email_message: 'Your training session has been updated:',
        action_message: 'Please check the updated details.',
        is_training: true,
        has_excluded_dates: emailData.excluded_dates && emailData.excluded_dates.length > 0,
        excluded_dates_list: emailData.excluded_dates ? emailData.excluded_dates.join(', ') : ''
      };
    } else if (emailType === 'schedule_deleted') {
      emailData = {
        ...emailData,
        task_type: 'Training Session',
        email_subject: 'Training Session Cancelled',
        email_title: 'Training Session Cancelled',
        email_message: 'Your training session has been cancelled:',
        action_message: 'Please check your updated schedule.',
        is_training: true,
        has_excluded_dates: emailData.excluded_dates && emailData.excluded_dates.length > 0,
        excluded_dates_list: emailData.excluded_dates ? emailData.excluded_dates.join(', ') : ''
      };
    } else if (emailType === 'non_training_created') {
      emailData = {
        ...emailData,
        task_type: data.taskType || 'Non-Training Task',
        email_subject: 'New Non-Training Task Assigned',
        email_title: 'New Non-Training Task Assigned',
        email_message: 'You have been assigned to a new non-training task:',
        action_message: 'Please review the task details and prepare accordingly.',
        is_training: false,
        has_excluded_dates: emailData.excluded_dates && emailData.excluded_dates.length > 0,
        excluded_dates_list: emailData.excluded_dates ? emailData.excluded_dates.join(', ') : ''
      };
    } else if (emailType === 'non_training_updated') {
      emailData = {
        ...emailData,
        task_type: data.taskType || 'Non-Training Task',
        email_subject: 'Non-Training Task Updated',
        email_title: 'Non-Training Task Updated',
        email_message: 'Your non-training task has been updated:',
        action_message: 'Please check the updated task details.',
        is_training: false,
        has_excluded_dates: emailData.excluded_dates && emailData.excluded_dates.length > 0,
        excluded_dates_list: emailData.excluded_dates ? emailData.excluded_dates.join(', ') : ''
      };
    } else if (emailType === 'non_training_deleted') {
      emailData = {
        ...emailData,
        task_type: data.taskType || 'Non-Training Task',
        email_subject: 'Non-Training Task Cancelled',
        email_title: 'Non-Training Task Cancelled',
        email_message: 'Your non-training task has been cancelled:',
        action_message: 'Please check your updated schedule.',
        is_training: false,
        has_excluded_dates: emailData.excluded_dates && emailData.excluded_dates.length > 0,
        excluded_dates_list: emailData.excluded_dates ? emailData.excluded_dates.join(', ') : ''
      };
    } else if (emailType === 'daily_reminder') {
      emailData = {
        ...emailData,
        email_subject: 'Daily Schedule Reminder',
        email_title: 'Daily Schedule Reminder',
        email_message: `Here's your schedule for today (${data.date}):`,
        schedule_details: data.sessions ? data.sessions.map(session => `
          <div style="margin: 10px 0; padding: 10px; border-left: 3px solid #007bff;">
            <strong>${session.time || 'N/A'}</strong><br>
            <strong>Client:</strong> ${session.client}<br>
            <strong>Course:</strong> ${session.course}<br>
            <strong>Role:</strong> ${session.role}
          </div>
        `).join('') : '<p>No sessions scheduled for today.</p>',
        action_message: 'Have a great day!'
      };
    } else if (emailType === 'weekly_reminder') {
      emailData = {
        ...emailData,
        email_subject: 'Weekly Schedule Summary',
        email_title: 'Weekly Schedule Summary',
        email_message: `Here's your schedule for the week of ${data.weekStart}:`,
        schedule_details: data.sessions ? data.sessions.map(session => `
          <div style="margin: 10px 0; padding: 10px; border-left: 3px solid #28a745;">
            <strong>${session.date} - ${session.time || 'N/A'}</strong><br>
            <strong>Client:</strong> ${session.client}<br>
            <strong>Course:</strong> ${session.course}<br>
            <strong>Role:</strong> ${session.role}
          </div>
        `).join('') : '<p>No sessions scheduled for this week.</p>',
        action_message: 'Have a productive week!'
      };
    }

    // Send email using EmailJS with public key
    const response = await window.emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      templateId,
      emailData,
      EMAILJS_CONFIG.USER_ID
    );

    console.log(`Email sent successfully to ${recipientEmail}: ${emailType}`);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Error sending email notification:', error);
    throw error;
  }
};

// Send schedule creation notification
export const notifyScheduleCreated = async (scheduleData) => {
  const emailData = {
    trainerName: scheduleData.trainer,
    date: scheduleData.startDate,
    startDate: scheduleData.startDate,
    endDate: scheduleData.endDate || scheduleData.startDate,
    client: scheduleData.client || 'N/A',
    course: scheduleData.course || 'N/A',
    role: scheduleData.role || 'N/A',
    description: scheduleData.description || 'N/A',
    excludedDates: scheduleData.excludedDates || []
  };

  return await sendEmailNotification(
    EMAIL_TYPES.SCHEDULE_CREATED,
    scheduleData.trainer,
    emailData
  );
};

// Send schedule update notification
export const notifyScheduleUpdated = async (scheduleData) => {
  const emailData = {
    trainerName: scheduleData.trainer,
    date: scheduleData.startDate,
    startDate: scheduleData.startDate,
    endDate: scheduleData.endDate || scheduleData.startDate,
    client: scheduleData.client || 'N/A',
    course: scheduleData.course || 'N/A',
    role: scheduleData.role || 'N/A',
    description: scheduleData.description || 'N/A',
    excludedDates: scheduleData.excludedDates || []
  };

  return await sendEmailNotification(
    EMAIL_TYPES.SCHEDULE_UPDATED,
    scheduleData.trainer,
    emailData
  );
};

// Send schedule deletion notification
export const notifyScheduleDeleted = async (scheduleData) => {
  const emailData = {
    trainerName: scheduleData.trainer,
    date: scheduleData.startDate,
    startDate: scheduleData.startDate,
    endDate: scheduleData.endDate || scheduleData.startDate,
    client: scheduleData.client || 'N/A',
    course: scheduleData.course || 'N/A',
    role: scheduleData.role || 'N/A',
    description: scheduleData.description || 'N/A',
    excludedDates: scheduleData.excludedDates || []
  };

  return await sendEmailNotification(
    EMAIL_TYPES.SCHEDULE_DELETED,
    scheduleData.trainer,
    emailData
  );
};

// Send non-training task creation notification
export const notifyNonTrainingCreated = async (scheduleData) => {
  const emailData = {
    trainerName: scheduleData.trainer,
    date: scheduleData.startDate,
    startDate: scheduleData.startDate,
    endDate: scheduleData.endDate,
    taskDetails: scheduleData.taskDetails || 'N/A',
    taskType: scheduleData.taskType || 'N/A',
    description: scheduleData.description || 'N/A',
    excludedDates: scheduleData.excludedDates || []
  };

  return await sendEmailNotification(
    EMAIL_TYPES.NON_TRAINING_CREATED,
    scheduleData.trainer,
    emailData
  );
};

// Send non-training task update notification
export const notifyNonTrainingUpdated = async (scheduleData) => {
  const emailData = {
    trainerName: scheduleData.trainer,
    date: scheduleData.startDate,
    startDate: scheduleData.startDate,
    endDate: scheduleData.endDate,
    taskDetails: scheduleData.taskDetails || 'N/A',
    taskType: scheduleData.taskType || 'N/A',
    description: scheduleData.description || 'N/A',
    excludedDates: scheduleData.excludedDates || []
  };

  return await sendEmailNotification(
    EMAIL_TYPES.NON_TRAINING_UPDATED,
    scheduleData.trainer,
    emailData
  );
};

// Send non-training task deletion notification
export const notifyNonTrainingDeleted = async (scheduleData) => {
  const emailData = {
    trainerName: scheduleData.trainer,
    date: scheduleData.startDate,
    startDate: scheduleData.startDate,
    endDate: scheduleData.endDate,
    taskDetails: scheduleData.taskDetails || 'N/A',
    taskType: scheduleData.taskType || 'N/A',
    description: scheduleData.description || 'N/A',
    excludedDates: scheduleData.excludedDates || []
  };

  return await sendEmailNotification(
    EMAIL_TYPES.NON_TRAINING_DELETED,
    scheduleData.trainer,
    emailData
  );
};

// Get trainer email by name
export const getTrainerEmail = (trainerName, trainerList) => {
  const trainer = trainerList.find(t => t.name === trainerName);
  return trainer ? trainer.email : null;
}; 