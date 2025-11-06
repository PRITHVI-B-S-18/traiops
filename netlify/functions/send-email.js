// Netlify Function for sending emails via Mailjet
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

    // Mailjet SMTP configuration
    // Get credentials from Netlify environment variables:
    // MAILJET_API_KEY, MAILJET_SECRET_KEY, MAILJET_FROM_EMAIL
    const transporter = nodemailer.createTransport({
      host: 'in-v3.mailjet.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.MAILJET_API_KEY || process.env.EMAIL_USER,
        pass: process.env.MAILJET_SECRET_KEY || process.env.EMAIL_PASSWORD
      }
    });

    // Email templates
    const templates = {
      schedule_created: {
        subject: 'New Training Session Assigned',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #2C2C2C; margin-bottom: 20px;">New Training Session Assigned</h2>
              <p style="color: #666666; line-height: 1.6;">Hello ${data.trainerName},</p>
              <p style="color: #666666; line-height: 1.6;">You have been assigned to a new training session:</p>
              <ul style="color: #666666; line-height: 1.8; margin: 20px 0;">
                <li><strong>Date:</strong> ${data.date}</li>
                <li><strong>Client:</strong> ${data.client}</li>
                <li><strong>Course:</strong> ${data.course}</li>
                <li><strong>Role:</strong> ${data.role}</li>
              </ul>
              <p style="color: #666666; line-height: 1.6;">Best regards,<br>Training Team</p>
            </div>
          </div>
        `
      },
      user_invitation: {
        subject: `You've been invited to ${data.appName || 'Training Scheduler'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #2C2C2C; margin-bottom: 20px;">Welcome to ${data.appName || 'Training Scheduler'}!</h2>
              <p style="color: #666666; line-height: 1.6;">Hello,</p>
              <p style="color: #666666; line-height: 1.6;">
                You have been invited to join as a <strong>${data.role === 'trainer' ? 'Trainer' : data.role === 'program_manager' ? 'Program Manager' : 'Admin'}</strong>.
              </p>
              <div style="background-color: #F5F5F5; padding: 20px; border-radius: 6px; margin: 20px 0;">
                <p style="color: #2C2C2C; margin: 0 0 10px 0;"><strong>Your Login Credentials:</strong></p>
                <p style="color: #666666; margin: 5px 0;"><strong>Email:</strong> ${data.email}</p>
                <p style="color: #666666; margin: 5px 0;"><strong>Temporary Password:</strong> ${data.temporaryPassword}</p>
              </div>
              <p style="color: #666666; line-height: 1.6;">
                <strong>Important:</strong> Please change your password after your first login for security.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.loginUrl || 'https://your-app-url.com/login'}" 
                   style="display: inline-block; background: linear-gradient(to right, #5A5A5A, #3D3D3D); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Login to Your Account
                </a>
              </div>
              <p style="color: #888888; font-size: 12px; line-height: 1.6; margin-top: 30px; border-top: 1px solid #E0E0E0; padding-top: 20px;">
                If you did not expect this invitation, please ignore this email.<br>
                This is an automated message, please do not reply.
              </p>
            </div>
          </div>
        `
      },
      bulk_invitation: {
        subject: `You've been invited to ${data.appName || 'Training Scheduler'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #2C2C2C; margin-bottom: 20px;">Welcome to ${data.appName || 'Training Scheduler'}!</h2>
              <p style="color: #666666; line-height: 1.6;">Hello,</p>
              <p style="color: #666666; line-height: 1.6;">
                You have been invited to join as a <strong>${data.role === 'trainer' ? 'Trainer' : data.role === 'program_manager' ? 'Program Manager' : 'Admin'}</strong>.
              </p>
              <div style="background-color: #F5F5F5; padding: 20px; border-radius: 6px; margin: 20px 0;">
                <p style="color: #2C2C2C; margin: 0 0 10px 0;"><strong>Your Login Credentials:</strong></p>
                <p style="color: #666666; margin: 5px 0;"><strong>Email:</strong> ${data.email}</p>
                <p style="color: #666666; margin: 5px 0;"><strong>Temporary Password:</strong> ${data.temporaryPassword}</p>
              </div>
              <p style="color: #666666; line-height: 1.6;">
                <strong>Important:</strong> Please change your password after your first login for security.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.loginUrl || 'https://your-app-url.com/login'}" 
                   style="display: inline-block; background: linear-gradient(to right, #5A5A5A, #3D3D3D); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Login to Your Account
                </a>
              </div>
              <p style="color: #888888; font-size: 12px; line-height: 1.6; margin-top: 30px; border-top: 1px solid #E0E0E0; padding-top: 20px;">
                If you did not expect this invitation, please ignore this email.<br>
                This is an automated message, please do not reply.
              </p>
            </div>
          </div>
        `
      }
    };

    const template = templates[type];
    if (!template) {
      throw new Error(`Unknown email type: ${type}`);
    }

    const mailOptions = {
      from: process.env.MAILJET_FROM_EMAIL || process.env.EMAIL_USER || 'noreply@trainingscheduler.com',
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