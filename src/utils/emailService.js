import { loadTrainerData } from './firestoreTrainers';
import { sendScheduleNotificationEmail } from './resendEmailService';

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

import { formatDateForDisplay } from './timezoneUtils';
    
    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';
      // Use timezone-aware date formatting
      return formatDateForDisplay(dateStr, 'MMMM d, yyyy', true); // true = isUTC
    };

const buildScheduleEmailPayload = (emailType, trainer, data) => {
  const isTraining = emailType.startsWith('schedule_');
  const actionType = emailType.split('_')[1] || 'updated';

  const subjectMap = {
    schedule_created: 'New Training Session Assigned',
    schedule_updated: 'Training Session Updated',
    schedule_deleted: 'Training Session Cancelled',
    non_training_created: 'New Non-Training Task Assigned',
    non_training_updated: 'Non-Training Task Updated',
    non_training_deleted: 'Non-Training Task Cancelled',
    daily_reminder: 'Daily Schedule Reminder',
    weekly_reminder: 'Weekly Schedule Summary'
  };

  const messageMap = {
    schedule_created: 'You have been assigned to a new training session:',
    schedule_updated: 'Your training session has been updated:',
    schedule_deleted: 'Your training session has been cancelled:',
    non_training_created: 'You have been assigned to a new non-training task:',
    non_training_updated: 'Your non-training task has been updated:',
    non_training_deleted: 'Your non-training task has been cancelled:',
    daily_reminder: `Here is your schedule for today (${formatDate(data.date)}):`,
    weekly_reminder: `Here is your schedule for the week of ${formatDate(data.weekStart)}:`
  };

  const actionMessageMap = {
    created: 'Please review your schedule and prepare accordingly.',
    updated: 'Please note the updated details below.',
    deleted: 'This session has been removed from your schedule.',
    reminder: 'Stay prepared by reviewing your upcoming sessions.'
  };

  const actionKey =
    actionType === 'created' || actionType === 'updated' || actionType === 'deleted'
      ? actionType
      : 'reminder';

  const excludedDates = (data.excludedDates || []).map(formatDate);

  return {
    to: trainer.email,
    trainerName: trainer.name,
    emailSubject: subjectMap[emailType] || 'Schedule Update',
    emailTitle: subjectMap[emailType] || 'Schedule Update',
    emailMessage: messageMap[emailType] || 'Here are your schedule details:',
    actionMessage: actionMessageMap[actionKey],
    taskTypeLabel: isTraining ? 'Training Session' : (data.taskType || 'Non-Training Task'),
    startDate: formatDate(data.startDate || data.date),
    endDate: formatDate(data.endDate || data.startDate || data.date),
      client: data.client || 'N/A',
      course: data.course || 'N/A',
      role: data.role || 'N/A',
    taskDetails: data.taskDetails || (isTraining ? 'Refer to course details' : 'N/A'),
      description: data.description || 'N/A',
    excludedDates,
    isTraining
  };
};

export const sendEmailNotification = async (emailType, trainerName, data) => {
  try {
    const trainerList = await loadTrainerData();
    const trainer = trainerList.find(t => t.name === trainerName);
    if (!trainer || !trainer.email) {
      throw new Error(`No email found for trainer: ${trainerName}`);
    }
    const payload = buildScheduleEmailPayload(emailType, trainer, data);
    await sendScheduleNotificationEmail(payload);
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