import emailjs from '@emailjs/browser';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

/**
 * Sends an email using EmailJS
 * @param {Object} templateParams - Parameters for the email template
 * @returns {Promise}
 */
export const sendEmail = async (templateParams) => {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.error('EmailJS is not configured. Please check your .env file.');
    return { success: false, error: 'EmailJS not configured' };
  }

  try {
    const result = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      templateParams,
      PUBLIC_KEY
    );
    console.log('Email sent successfully:', result.text);
    return { success: true, text: result.text };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.text || error.message };
  }
};

export const sendLeadAssignmentEmail = (toEmail, toName, assignedByName, leadName, instruction) => {
  return sendEmail({
    to_email: toEmail,
    to_name: toName,
    from_name: 'Real Estate CRM',
    subject: 'New Lead Assigned - Real Estate CRM',
    message: `Hello ${toName},\n\n${assignedByName} has assigned a new lead to you: ${leadName}.\n\n${instruction ? `Instruction: ${instruction}` : ''}\n\nPlease check your dashboard for details.`,
    lead_name: leadName,
    assigned_by: assignedByName,
    instruction: instruction || 'None'
  });
};

/**
 * Sends a reminder email for site visits scheduled for tomorrow
 */
export const sendVisitReminderEmail = (
  toEmail,
  toName,
  leadName,
  leadPhone,
  leadEmail,
  lastFollowUp,
  visitDate,
  visitTime,
  visitLocation,
  visitNote,
  leadDesignation,
  leadCompany
) => {
  // Safe date formatting
  let formattedDate = visitDate;
  try {
    const parts = visitDate.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      formattedDate = d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    }
  } catch (e) {
    console.error('Error formatting visit date for email:', e);
  }

  const subject = `Upcoming Site Visit Reminder: ${leadName} - Tomorrow`;
  
  const messageBody = `
Dear ${toName},

This is a reminder that you have a site visit scheduled for tomorrow with your client, ${leadName}.

Here are the details for the visit:

=========================================
          VISIT INFORMATION             
=========================================
Date: ${formattedDate}
Time: ${visitTime || '10:00 AM'}
Location: ${visitLocation || 'Not Specified'}
Additional Note: ${visitNote || 'No specific notes'}

=========================================
         CLIENT CONTACT DETAILS         
=========================================
Client Name: ${leadName}
Designation: ${leadDesignation || 'Not Provided'}
Company/Project: ${leadCompany || 'Not Provided'}
Phone Number: ${leadPhone || 'Not Provided'}
Email Address: ${leadEmail || 'Not Provided'}

=========================================
        LATEST FOLLOW-UP MESSAGE        
=========================================
"${lastFollowUp || 'No previous follow-up notes.'}"

-----------------------------------------
Please ensure you are prepared with the project brochures, pricing details, and necessary documents. 

Have a successful meeting!

Best Regards,
Real Estate CRM System
  `.trim();

  return sendEmail({
    to_email: toEmail,
    to_name: toName,
    from_name: 'Real Estate CRM System',
    subject: subject,
    message: messageBody,
    lead_name: leadName,
    visit_date: formattedDate,
    visit_time: visitTime,
    visit_location: visitLocation,
    last_followup: lastFollowUp || 'None'
  });
};
