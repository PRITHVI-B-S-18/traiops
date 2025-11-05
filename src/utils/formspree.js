// Formspree Configuration - Free form-to-email service
// Sign up at: https://formspree.io/

export const sendFormspreeEmail = async (formData) => {
  try {
    const response = await fetch('https://formspree.io/f/YOUR_FORM_ID', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      console.log('Email sent successfully via Formspree');
      return { success: true, message: 'Email sent successfully' };
    } else {
      throw new Error('Failed to send email');
    }
  } catch (error) {
    console.error('Error sending email via Formspree:', error);
    throw error;
  }
};

// Email templates for Formspree
export const sendScheduleNotificationFormspree = async (type, trainerEmail, data) => {
  const formData = {
    _subject: `Training Schedule ${type}`,
    to_email: trainerEmail,
    trainer_name: data.trainerName,
    date: data.date,
    client: data.client || 'N/A',
    course: data.course || 'N/A',
    role: data.role || 'N/A',
    message: `Hello ${data.trainerName}, you have a new training schedule for ${data.date}.`
  };

  return await sendFormspreeEmail(formData);
}; 