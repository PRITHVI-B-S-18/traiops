const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

const gmailConfig = functions.config().gmail || {};
const gmailUser = gmailConfig.user;
const gmailAppPassword = gmailConfig.app_password;

let transporter = null;

if (gmailUser && gmailAppPassword) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });
} else {
  console.warn('Gmail credentials are not set. Invitation emails will fail until configured.');
}

const generatePasswordFromEmail = (email) => {
  if (!email || !email.includes('@')) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$';
    let password = '';
    for (let i = 0; i < 10; i += 1) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
  return email.split('@')[0];
};

const sendInvitationEmail = async ({ email, displayName, tempPassword }) => {
  if (!transporter) {
    throw new Error('Email transporter not configured');
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">Welcome to the Trainer Scheduler Platform</h2>
      <p>Hi ${displayName || 'Trainer'},</p>
      <p>Your account has been created. Please use the credentials below to log in:</p>
      <ul>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Temporary Password:</strong> ${tempPassword}</li>
      </ul>
      <p>
        You will be asked to change your password after logging in for the first time. If you didn't expect this invite, please contact the program administrator.
      </p>
      <p>
        <a href="https://trainer-scheduler-1812.web.app/login" style="background-color: #4F46E5; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px;">
          Log in to Trainer Scheduler
        </a>
      </p>
      <p>Best regards,<br/>Training Team</p>
    </div>
  `;

  await transporter.sendMail({
    from: gmailUser,
    to: email,
    subject: 'You have been invited to Trainer Scheduler',
    html: htmlBody,
  });
};

exports.adminCreateUser = functions.region('asia-south1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be authenticated to perform this action.');
  }

  const { email, displayName, role } = data || {};

  if (!email || !displayName || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: email, displayName or role.');
  }

  const callerUid = context.auth.uid;
  const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();

  if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can invite users.');
  }

  try {
    const tempPassword = generatePasswordFromEmail(email);

    // Create Auth user via Admin SDK (does not sign out the caller)
    const userRecord = await admin.auth().createUser({
      email,
      password: tempPassword,
      displayName,
      emailVerified: false,
    });

    const userDoc = {
      uid: userRecord.uid,
      email,
      displayName,
      role,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      invitedBy: callerUid,
      invitedAt: admin.firestore.FieldValue.serverTimestamp(),
      mustChangePassword: true,
    };

    if (role === 'program_manager') {
      userDoc.assignedLocations = [];
    }

    if (role === 'trainer') {
      userDoc.locationAccessGranted = false;
      userDoc.onboardingStatus = 'not_started';
    }

    await admin.firestore().collection('users').doc(userRecord.uid).set(userDoc);

    if (transporter) {
      try {
        await sendInvitationEmail({ email, displayName, tempPassword });
      } catch (mailError) {
        console.error('Failed to send invitation email:', mailError);
      }
    }

    return {
      success: true,
      uid: userRecord.uid,
      tempPassword,
      role,
      email,
      message: 'User created successfully',
    };
  } catch (error) {
    console.error('adminCreateUser error:', error);

    if (error?.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'A user with this email already exists.');
    }

    throw new functions.https.HttpsError('internal', error.message || 'Failed to create user');
  }
});

exports.sendInviteEmailOnly = functions.region('asia-south1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be authenticated to perform this action.');
  }

  const { email, displayName, tempPassword } = data || {};

  if (!email || !tempPassword) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: email or tempPassword.');
  }

  if (!transporter) {
    throw new functions.https.HttpsError('failed-precondition', 'Email transporter not configured.');
  }

  try {
    await sendInvitationEmail({ email, displayName, tempPassword });
    return { success: true };
  } catch (error) {
    console.error('sendInviteEmailOnly error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to send invitation email');
  }
});
