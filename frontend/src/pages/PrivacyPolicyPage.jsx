import { Link } from "react-router-dom";
import LegalLayout, { Section, List, Callout } from "../components/LegalLayout";

const CONTACT = "altovisas@gmail.com";
const UPDATED = "30 August 2026";

const TOC = [
  { id: "scope", title: "Who this covers" },
  { id: "collect", title: "What we collect" },
  { id: "never", title: "What we deliberately do not collect" },
  { id: "use", title: "How we use it" },
  { id: "bases", title: "Legal bases (EEA and UK)" },
  { id: "ai", title: "AI processing" },
  { id: "cookies", title: "Cookies, storage, and link tags" },
  { id: "sharing", title: "Who we share it with" },
  { id: "retention", title: "How long we keep it" },
  { id: "security", title: "Security" },
  { id: "rights", title: "Your rights" },
  { id: "delete", title: "Deleting your data" },
  { id: "transfers", title: "International transfers" },
  { id: "children", title: "Children" },
  { id: "changes", title: "Changes to this policy" },
  { id: "contact", title: "Contact" },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      updated={UPDATED}
      toc={TOC}
      summary={
        <Callout>
          <p className="font-semibold mb-2">The short version</p>
          <p>
            We collect what the Service needs to give you feedback, and not more. We do not
            sell your information, we do not run advertising, and we never share anything you
            write with any government or with your university. What you type stays private to
            your account; only anonymous, aggregated counts are used to see how the site is
            doing. You can delete all of it at any time by emailing {CONTACT}.
          </p>
        </Callout>
      }
    >
      <Section id="scope" title="1. Who this covers">
        <p>
          This policy explains how Altovisas ("we", "us") handles personal information on
          altovisas.com (the "Service"). It applies whether or not you have an account. For
          the purposes of the UK and EU GDPR, Altovisas is the data controller. It should be
          read alongside our{" "}
          <Link to="/terms" className="text-indigo-700 hover:underline">Terms of Service</Link>.
        </p>
      </Section>

      <Section id="collect" title="2. What we collect">
        <p className="font-semibold text-stone-900">Information you give us</p>
        <List>
          <li>
            <strong>Account details.</strong> Your name and email address, and a hashed
            password. If you sign in with Google, we receive your name, email address, and
            profile picture from Google; we never see your Google password.
          </li>
          <li>
            <strong>Your profile.</strong> What you tell us about your situation so the
            feedback can be about you: university and programme, degree level, academic
            record including GPA, intended consulate and country, funding and sponsor
            information, work history, and your plans after study.
          </li>
          <li>
            <strong>Your practice answers.</strong> What you write in response to practice
            questions, and the reports we generate from them.
          </li>
          <li>
            <strong>Feedback and surveys.</strong> Ratings, free-text comments, survey
            answers, and a waitlist email address if you give one.
          </li>
          <li>
            <strong>Correspondence.</strong> Anything you send us by email.
          </li>
        </List>

        <p className="font-semibold text-stone-900 pt-2">Information collected automatically</p>
        <List>
          <li>
            <strong>Usage events.</strong> Which pages you open, which steps of the flow you
            reach, roughly how long things take, whether you are on mobile or desktop, and
            your browser language. These are tied to a random identifier generated in your
            browser, not to your name.
          </li>
          <li>
            <strong>Link tags.</strong> If you arrive on a link carrying a <code>src</code>,{" "}
            <code>utm_source</code>, or <code>ref</code> value, we store that short label so
            we can see which channels bring people to the site. It is a channel name such as
            "reddit", never anything about you personally. See section 7.
          </li>
          <li>
            <strong>Technical information.</strong> Standard server logs, including IP
            address, user agent, and timestamps, kept for security and abuse prevention.
          </li>
        </List>

        <p>
          The usage event stream is built to be non-identifying. It deliberately strips out
          free text, names, email addresses, exact GPA figures, sponsor details, funding
          amounts, and your answers, and stores a banded value such as "3.0-3.3" instead of a
          precise one. Those private details live only in your account records, described
          above.
        </p>
      </Section>

      <Section id="never" title="3. What we deliberately do not collect">
        <p>
          The Service never asks for, and does not want, any of the following. Please do not
          type them into any field:
        </p>
        <List>
          <li>passport, visa, DS-160, or SEVIS numbers;</li>
          <li>national identity numbers, including Social Security numbers;</li>
          <li>bank account, card, or payment details;</li>
          <li>photographs or scans of documents;</li>
          <li>anyone else's personal information.</li>
        </List>
        <p>
          If you send us something like this anyway, tell us at {CONTACT} and we will delete
          it. We also do not collect precise location, biometric data, or the special
          categories of data described in Article 9 of the GDPR, and we do not knowingly
          infer them.
        </p>
      </Section>

      <Section id="use" title="4. How we use it">
        <List>
          <li>To create and secure your account, and to sign you in.</li>
          <li>To generate the feedback, statistics, and practice questions you asked for.</li>
          <li>
            To send transactional email: verification codes, password resets, and important
            notices about the Service. We do not send marketing email unless you ask for it,
            and you can unsubscribe from anything that is not transactional.
          </li>
          <li>
            To understand how the Service is used in aggregate - where people get stuck, which
            steps take too long, which channels bring people here - so it can be improved.
          </li>
          <li>To detect, investigate, and prevent abuse, fraud, and security incidents.</li>
          <li>To comply with legal obligations and to establish or defend legal claims.</li>
        </List>
        <p>
          We do not use your information for advertising, we do not build advertising
          profiles, and we do not make decisions with legal or similarly significant effects
          about you by automated means. The feedback the Service generates is informational
          only and decides nothing about you.
        </p>
      </Section>

      <Section id="bases" title="5. Legal bases (EEA and UK)">
        <p>If the UK or EU GDPR applies to you, we rely on:</p>
        <List>
          <li>
            <strong>Contract</strong> - to provide the Service you asked for: your account,
            your feedback, your reports.
          </li>
          <li>
            <strong>Legitimate interests</strong> - to keep the Service secure, prevent
            abuse, and understand aggregate usage so we can improve it. We have weighed these
            against your rights, which is why the usage stream is stripped of personal detail.
          </li>
          <li>
            <strong>Consent</strong> - for anything optional, such as joining a waitlist. You
            can withdraw consent at any time.
          </li>
          <li>
            <strong>Legal obligation</strong> - where the law requires us to keep or disclose
            something.
          </li>
        </List>
      </Section>

      <Section id="ai" title="6. AI processing">
        <p>
          To generate your feedback, we send your profile and your practice answers to a
          third-party AI provider (currently Anthropic, using the Claude API) which processes
          them on our behalf as our processor and returns a result. We do not send your name,
          email address, or account identifiers with them.
        </p>
        <p>
          Under our commercial terms with that provider, your inputs and outputs are not used
          to train their models. We do not use your content to train any model of our own
          either. Providers may retain content briefly for abuse monitoring under their own
          terms.
        </p>
        <p>
          Because your submissions leave our systems to be processed this way, please keep
          them to what the questions actually ask for.
        </p>
      </Section>

      <Section id="cookies" title="7. Cookies, storage, and link tags">
        <p>We use a small number of cookies and browser-storage entries, all functional:</p>
        <List>
          <li>
            <strong>Session cookies.</strong> A secure, HTTP-only refresh-token cookie keeps
            you signed in. A guest cookie lets the free flow work before you have an account.
          </li>
          <li>
            <strong>Local storage.</strong> A random visitor identifier and a session
            identifier, used to group your own usage events together, plus your sign-in token
            and small interface preferences.
          </li>
          <li>
            <strong>The link tag.</strong> When you arrive from a tagged link, we store its
            channel label so that later activity in the same browser is credited to the
            channel that introduced you. The first tag is kept, and it holds until you clear
            your browser storage.
          </li>
        </List>
        <p>
          We do not use third-party advertising cookies, cross-site trackers, or advertising
          pixels, and we do not sell or share personal information for cross-context
          behavioural advertising. Analytics are first-party and stay on our own servers.
        </p>
        <p>
          You can clear or block cookies and local storage in your browser settings. Blocking
          them will sign you out and reset the free-usage flow, but the rest of the Service
          will still work.
        </p>
      </Section>

      <Section id="sharing" title="8. Who we share it with">
        <p>
          <strong>We do not sell your personal information, and we never have.</strong> We
          share it only with service providers who process it on our behalf under contract,
          and only as far as they need to:
        </p>
        <List>
          <li><strong>Anthropic</strong> - AI processing that generates your feedback.</li>
          <li><strong>Google</strong> - optional sign-in, if you use it.</li>
          <li><strong>Our email provider</strong> - delivery of verification and account email.</li>
          <li><strong>Our hosting and database providers</strong> - running the Service and storing its data.</li>
        </List>
        <p>
          We may also disclose information if we are legally required to, to enforce our{" "}
          <Link to="/terms" className="text-indigo-700 hover:underline">Terms</Link>, or to
          protect the rights and safety of our users or the public. If the Service is ever
          part of a merger, acquisition, or sale of assets, information may transfer to the
          new owner, who would remain bound by this policy or give you notice before changing
          it.
        </p>
        <Callout>
          <p>
            We do not report anything you write to any immigration authority, embassy,
            consulate, university, or employer, and we do not receive anything about you from
            them. We have no relationship with any of them.
          </p>
        </Callout>
      </Section>

      <Section id="retention" title="9. How long we keep it">
        <List>
          <li>
            <strong>Account information</strong> - while your account exists, then deleted
            within 30 days of your deletion request.
          </li>
          <li>
            <strong>Profiles, answers, and reports</strong> - while your account exists, so
            you can look back at them, then deleted with your account.
          </li>
          <li>
            <strong>Usage events</strong> - up to 24 months, in a form already stripped of
            personal detail, then deleted or aggregated permanently.
          </li>
          <li>
            <strong>Server logs</strong> - up to 90 days.
          </li>
          <li>
            <strong>Backups</strong> - deleted records persist in encrypted backups until
            those backups rotate out, normally within 90 days.
          </li>
        </List>
      </Section>

      <Section id="security" title="10. Security">
        <p>
          Traffic is encrypted in transit with HTTPS. Passwords are stored hashed, never in
          readable form. Data is held in access-controlled databases, and administrative
          access is limited to the people who need it. Sensitive fields are kept out of the
          analytics stream by design rather than by policy alone.
        </p>
        <p>
          No system is perfectly secure, and we cannot guarantee absolute security. If a
          breach affects your personal information, we will notify you and any relevant
          regulator as the law requires.
        </p>
      </Section>

      <Section id="rights" title="11. Your rights">
        <p>Depending on where you live, you may have the right to:</p>
        <List>
          <li>access a copy of the personal information we hold about you;</li>
          <li>correct information that is wrong or incomplete;</li>
          <li>delete your information;</li>
          <li>receive your information in a portable format;</li>
          <li>object to or restrict certain processing;</li>
          <li>withdraw consent you previously gave;</li>
          <li>not be discriminated against for exercising any of these rights.</li>
        </List>
        <p>
          To exercise any of them, email{" "}
          <a href={`mailto:${CONTACT}`} className="text-indigo-700 hover:underline font-medium">
            {CONTACT}
          </a>{" "}
          from the address on your account. We respond within 30 days. We may need to verify
          who you are first, and an authorized agent may act for you with written permission.
        </p>
        <p>
          <strong>California residents.</strong> We do not sell or share personal information
          as those terms are used in the CCPA/CPRA, and we do not use or disclose sensitive
          personal information beyond the purposes permitted for providing the Service. The
          categories we collect, why, and who we disclose them to are set out in sections 2,
          4, and 8.
        </p>
        <p>
          <strong>EEA and UK residents.</strong> You may also complain to your local
          supervisory authority, or in the UK to the Information Commissioner's Office.
          We would rather you came to us first.
        </p>
      </Section>

      <Section id="delete" title="12. Deleting your data">
        <p>
          Email {CONTACT} from your account address and ask us to delete your account. We
          remove your account record, your profile, your practice answers, the reports
          generated for you, and your usage history, within 30 days, subject only to backup
          rotation and to anything we are legally required to keep.
        </p>
        <p>
          Aggregated statistics that can no longer identify you - counts, medians, approval
          shares - are not deleted, because they contain nothing that points back to you.
        </p>
      </Section>

      <Section id="transfers" title="13. International transfers">
        <p>
          We operate from and store data in the United States, and our service providers are
          largely U.S.-based. If you use the Service from outside the United States, your
          information will be transferred there, where data protection law differs from your
          own.
        </p>
        <p>
          Where we transfer personal information out of the EEA or the UK, we rely on the
          European Commission's Standard Contractual Clauses, and the UK Addendum where
          applicable, together with appropriate safeguards in our contracts with providers.
        </p>
      </Section>

      <Section id="children" title="14. Children">
        <p>
          The Service is not directed to children under 16, and we do not knowingly collect
          their personal information. Users under 18 need the consent and involvement of a
          parent or guardian. If you believe a child under 16 has given us information, email
          {" "}{CONTACT} and we will delete it promptly.
        </p>
      </Section>

      <Section id="changes" title="15. Changes to this policy">
        <p>
          We may update this policy. The "Last updated" date above always reflects the current
          version, and we will give notice on the Service, or by email to account holders,
          before a material change takes effect. Continuing to use the Service after that
          means you accept the updated policy.
        </p>
      </Section>

      <Section id="contact" title="16. Contact">
        <p>
          Questions, requests, or complaints about privacy go to{" "}
          <a href={`mailto:${CONTACT}`} className="text-indigo-700 hover:underline font-medium">
            {CONTACT}
          </a>
          . We read everything sent there.
        </p>
      </Section>
    </LegalLayout>
  );
}
