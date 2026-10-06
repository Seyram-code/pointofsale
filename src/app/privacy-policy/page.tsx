import type { Metadata } from "next";
import { PublicDocumentLayout } from "@/components/brand/PublicDocumentLayout";
import { publicEnv } from "@/lib/config/env";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${publicEnv.appName} collects, uses and protects information.` ,
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <PublicDocumentLayout
      title="Privacy Policy"
      intro={`This policy explains how ${publicEnv.appName} handles information when a shop and its authorised staff use the point-of-sale and retail management service.`}
    >
      <section>
        <h2>Information handled by the service</h2>
        <p>Depending on how your shop uses VidyPOS, information may include account and staff details, shop settings, products and stock, sales and payment records, customer details entered by your shop, and audit or support activity.</p>
        <p>The service also uses essential session information to keep authorised users signed in. If you choose “Remember me,” your sign-in identifier may be saved on that device; your password is not saved by that option.</p>
      </section>
      <section>
        <h2>How information is used</h2>
        <ul>
          <li>To provide checkout, inventory, reporting, staff access and account features.</li>
          <li>To authenticate users, apply permissions, prevent misuse and maintain service reliability.</li>
          <li>To respond to support requests and communicate important service or account information.</li>
          <li>To meet applicable legal, accounting and security obligations.</li>
        </ul>
      </section>
      <section>
        <h2>Shop and customer records</h2>
        <p>Your shop controls the business records its staff enter into VidyPOS. Shop administrators are responsible for providing appropriate notices and having a lawful basis before adding staff or customer information. Staff should only access records needed for their work.</p>
      </section>
      <section>
        <h2>Service providers and disclosure</h2>
        <p>Information may be processed by infrastructure, hosting, database, communications or payment providers used to operate features selected by your shop. We do not sell shop or customer information. Information may also be disclosed when required by law or when needed to protect users, the service or the public.</p>
      </section>
      <section>
        <h2>Retention and security</h2>
        <p>Records are retained for as long as needed to provide the service and meet operational or legal obligations. Retention periods can depend on your shop’s settings and applicable record-keeping requirements. Access controls and other safeguards are used to protect information, but no internet-connected system can guarantee absolute security.</p>
      </section>
      <section>
        <h2>Your choices and requests</h2>
        <p>Staff should contact their shop administrator to correct or remove information held in the shop account. Shop administrators can manage user access and business records. Requests relating to the operation of the VidyPOS service can be made through the support contact provided by your shop.</p>
      </section>
      <section>
        <h2>Updates and contact</h2>
        <p>This policy may be updated as the service changes. The current version and its update date will be published here. For privacy questions, contact your shop administrator or the support contact configured for your shop.</p>
      </section>
    </PublicDocumentLayout>
  );
}