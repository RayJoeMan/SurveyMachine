import type { ReactNode } from "react";

function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <span className="eyebrow">Legal</span>
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: {updated}</p>
        <div className="legal-body">{children}</div>
      </article>
    </main>
  );
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2>{heading}</h2>
      {children}
    </section>
  );
}

export function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service" updated="2026-08-16">
      <p>
        These Terms of Service ("Terms") govern your organization&apos;s use of Survey Machine ("the
        Service"), provided by Don&apos;t Be a Bump. By using the Service you agree to these Terms.
      </p>
      <Section heading="1. Your organization and account">
        <p>
          You must be authorized to act on behalf of the organization you register. You are
          responsible for safeguarding account credentials and for activity under your account.
        </p>
      </Section>
      <Section heading="2. Acceptable use">
        <p>
          You may not use the Service to collect data unlawfully, to target children under 13
          without verifiable parental consent, to transmit malware, to harass, or to violate any
          applicable law. You are responsible for the surveys you create and for how you process
          responses.
        </p>
      </Section>
      <Section heading="3. Your data">
        <p>
          You own the survey definitions and responses you collect. We process them only to provide
          the Service. See the Privacy Policy for details, including retention and deletion.
        </p>
      </Section>
      <Section heading="4. Subscriptions and payments">
        <p>
          Paid plans are billed in advance on a recurring basis through our payment provider. Prices
          and plan terms are shown at purchase. Cancellation takes effect at the end of the current
          billing period; you keep access to your data for export during any notice period described
          at purchase.
        </p>
      </Section>
      <Section heading="5. Termination">
        <p>
          You may stop using the Service at any time and export or delete your data. We may suspend
          access for violation of these Terms or legal requirements, with notice where practicable.
        </p>
      </Section>
      <Section heading="6. Disclaimers and limitation of liability">
        <p>
          The Service is provided "as is" without warranties of any kind. To the maximum extent
          permitted by law, our aggregate liability is limited to the amounts you paid in the twelve
          months preceding the claim. Nothing in these Terms limits liability that cannot be limited
          by law.
        </p>
      </Section>
      <Section heading="7. Changes">
        <p>
          We may update these Terms with notice (for example, by updating this page). Continued use
          after changes take effect constitutes acceptance.
        </p>
      </Section>
      <Section heading="8. Contact">
        <p>
          Questions about these Terms: support at Don&apos;t Be a Bump, Minneapolis, MN — see the
          support contact in the application.
        </p>
      </Section>
    </LegalLayout>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" updated="2026-08-16">
      <p>
        This Privacy Policy explains what information Survey Machine collects, why, how long it is
        kept, and how you can export or delete it.
      </p>
      <Section heading="1. What we collect">
        <p>
          <strong>Account and membership:</strong> email address, display name, and organization
          membership and roles. <strong>Survey responses:</strong> the answers respondents submit,
          which may include free text and contact details that you choose to collect.{" "}
          <strong>Technical:</strong> anonymous, short-lived operational data for abuse protection;
          we do not store raw IP addresses. <strong>Payments:</strong> handled by our payment
          provider; we do not store card numbers.
        </p>
      </Section>
      <Section heading="2. How we use information">
        <p>
          To operate the Service (validate and store responses, produce reports and exports, enforce
          access and limits), to prevent abuse, and to communicate about your account. We do not
          sell personal information.
        </p>
      </Section>
      <Section heading="3. Retention and deletion">
        <p>
          Response data is retained while your survey is active and per the retention policy you
          configure or we communicate. You can delete a survey (including its responses) or export
          your data from the administration area at any time; deletion is server-side and audited.
          Partial responses expire per the applicable retention window.
        </p>
      </Section>
      <Section heading="4. Youth data and children">
        <p>
          The Service is not directed at children under 13, and we do not knowingly collect personal
          information from children under 13. If you operate a program that may involve minors, you
          are responsible for ensuring your surveys comply with the Children&apos;s Online Privacy
          Protection Act (COPPA) and other applicable laws, including obtaining verifiable parental
          consent before collecting any personal information from a child under 13, and for not
          asking children for information that is not necessary.
        </p>
      </Section>
      <Section heading="5. Sharing">
        <p>
          We share data only with service providers that help operate the Service (hosting,
          payments, email) under confidentiality obligations, or where required by law.
        </p>
      </Section>
      <Section heading="6. Your rights and choices">
        <p>
          Depending on where you are located you may have rights to access, correct, export, or
          delete your personal information. Contact us using the support contact in the application
          to exercise these rights.
        </p>
      </Section>
      <Section heading="7. Changes">
        <p>
          We will post changes to this policy and update the date above. Material changes will be
          announced.
        </p>
      </Section>
    </LegalLayout>
  );
}

export function RefundsAndCancellations() {
  return (
    <LegalLayout title="Refunds &amp; Cancellations" updated="2026-08-16">
      <Section heading="1. Cancellation">
        <p>
          You can cancel your paid subscription at any time from the billing portal. Cancellation
          takes effect at the end of the current billing period, and you keep access through that
          period.
        </p>
      </Section>
      <Section heading="2. Refunds">
        <p>
          We offer a refund within 14 days of a first purchase if the Service does not work as
          described, provided you have not exported or reused data in a conflicting way. Refunds are
          issued to the original payment method. After the first period, fees are generally
          non-refundable except where required by law.
        </p>
      </Section>
      <Section heading="3. Failed payments">
        <p>
          If a payment fails, we will notify you and retry according to our payment provider&apos;s
          schedule. Continued failure may result in downgrade to a free tier or suspension after
          notice; your data remains exportable.
        </p>
      </Section>
      <Section heading="4. Data after cancellation">
        <p>
          After cancellation you can still export and delete your data for a reasonable period, as
          described in the Privacy Policy.
        </p>
      </Section>
    </LegalLayout>
  );
}
