// Netlify Function for sending emails
// Deploy to Netlify for free serverless functions

const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { type, recipientEmail, data } = JSON.parse(event.body);

    // Email configuration (use environment variables)
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Email templates
    const templates = {
      schedule_created: {
        subject: 'New Training Session Assigned',
        html: `
          <h2>New Training Session Assigned</h2>
          <p>Hello ${data.trainerName},</p>
          <p>You have been assigned to a new training session:</p>
          <ul>
            <li><strong>Date:</strong> ${data.date}</li>
            <li><strong>Client:</strong> ${data.client}</li>
            <li><strong>Course:</strong> ${data.course}</li>
            <li><strong>Role:</strong> ${data.role}</li>
          </ul>
          <p>Best regards,<br>Training Team</p>
        `
      }
    };

    const template = templates[type];
    if (!template) {
      throw new Error(`Unknown email type: ${type}`);
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: template.subject,
      html: template.html
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Email sent successfully' })
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}; 