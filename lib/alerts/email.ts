import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendAlertEmail(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  const from = process.env.ALERT_FROM_EMAIL || "alerts@example.com";
  try {
    const { error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      console.error("[email] resend error", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] send failed", e);
    return false;
  }
}
