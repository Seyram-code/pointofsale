import type { Metadata } from "next";
import { PublicDocumentLayout } from "@/components/brand/PublicDocumentLayout";
import { publicEnv } from "@/lib/config/env";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: `Terms for using ${publicEnv.appName}.`,
};

export default function TermsPage() {
  return (
    <PublicDocumentLayout
      title="Terms and Conditions"
      intro={`These terms cover access to ${publicEnv.appName}, a point-of-sale and retail management service for shops and supermarkets. By creating or using an account, you agree to these terms on behalf of yourself or the shop you are authorised to represent.`}
    >
      <section>
        <h2>Accounts and access</h2>
        <p>Provide accurate account information and keep sign-in credentials private. Shop administrators are responsible for inviting staff, assigning appropriate permissions, and removing access when it is no longer needed. You are responsible for activity carried out through your account.</p>
      </section>
      <section>
        <h2>Using the service</h2>
        <p>Use MyPOS only for lawful business operations and in accordance with the permissions assigned to you. Do not attempt to bypass access controls, disrupt the service, introduce malicious code, or access another shop’s information without authorisation.</p>
      </section>
      <section>
        <h2>Your shop’s information</h2>
        <p>Your shop retains responsibility for the products, stock, staff, customer and transaction information entered into its account. You must have the rights and permissions needed to provide that information and use it through the service. Keep appropriate copies of business records required for your operations.</p>
      </section>
      <section>
        <h2>Plans, trials and payments</h2>
        <p>Available plans, prices, trial details and payment terms are shown during registration or on the plans page and may vary by account. A trial or subscription is subject to the terms shown when you activate it. Taxes, payment-provider charges or other applicable fees may apply. Access to paid features may be limited if a subscription expires or payment is not completed.</p>
      </section>
      <section>
        <h2>Payments and business records</h2>
        <p>Payment methods and processing options depend on what is configured for your shop. External payment providers may apply their own terms. Your shop is responsible for reviewing sales, tax settings, stock levels and reports for accuracy; MyPOS is an operational tool and does not replace professional accounting, tax or legal advice.</p>
      </section>
      <section>
        <h2>Availability and changes</h2>
        <p>We may update, maintain or change parts of the service to improve security or functionality. We aim to keep the service useful and reliable, but continuous or uninterrupted availability is not guaranteed. Where practical, material changes that affect use of the service will be communicated through the service or account channels.</p>
      </section>
      <section>
        <h2>Suspension and ending access</h2>
        <p>Access may be suspended or ended if these terms are breached, an account creates a security risk, or a subscription no longer provides access. Shop administrators can also remove staff access. Contact your shop administrator before an account is closed if you need business records retained or exported.</p>
      </section>
      <section>
        <h2>Liability and applicable law</h2>
        <p>The service is provided subject to warranties and protections that cannot be excluded under applicable law. To the extent permitted by law, MyPOS is not responsible for indirect loss arising from use of the service, incorrect information entered by users, or interruptions outside reasonable control. These terms do not limit liability where such a limit is prohibited by law.</p>
        <p>Applicable consumer, privacy and business laws continue to apply. Any dispute should first be raised with the shop administrator or through the support contact configured for the shop.</p>
      </section>
      <section>
        <h2>Updates to these terms</h2>
        <p>These terms may be updated as the service changes. Continued use after updated terms are published means the updated terms apply, subject to any notice or consent required by law.</p>
      </section>
    </PublicDocumentLayout>
  );
}