// EmailJS Configuration - Free email service
// Sign up at: https://www.emailjs.com/

// Initialize EmailJS
// Add this to your main.jsx or index.html
// <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

// Initialize with your EmailJS user ID
// emailjs.init("YOUR_USER_ID");

export const sendEmailJS = async (templateId, templateParams) => {
  try {
    // Load EmailJS if not already loaded
    if (typeof window !== 'undefined' && !window.emailjs) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
      document.head.appendChild(script);
      
      await new Promise((resolve) => {
        script.onload = resolve;
      });
    }

    // Send email using EmailJS
    const response = await window.emailjs.send(
      'YOUR_SERVICE_ID', // EmailJS service ID
      templateId, // Template ID
      templateParams // Template parameters
    );

    console.log('Email sent successfully:', response);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Email templates for EmailJS
export const EMAILJS_TEMPLATES = {
  SCHEDULE_CREATED: 'template_schedule_created',
  SCHEDULE_UPDATED: 'template_schedule_updated',
  SCHEDULE_DELETED: 'template_schedule_deleted',
  DAILY_REMINDER: 'template_daily_reminder',
  WEEKLY_REMINDER: 'template_weekly_reminder'
};

// Send schedule notification
export const sendScheduleNotification = async (type, trainerEmail, data) => {
  const templateParams = {
    to_email: trainerEmail,
    trainer_name: data.trainerName,
    date: data.date,
    client: data.client || 'N/A',
    course: data.course || 'N/A',
    role: data.role || 'N/A'
  };

  return await sendEmailJS(EMAILJS_TEMPLATES[type], templateParams);
}; 