import { Link } from "react-router-dom";
import LegalLayout, { Section, List, Callout } from "../components/LegalLayout";

const CONTACT = "altovisas@gmail.com";
const UPDATED = "21 October 2026";

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
          <p className="doc-callout-h">The short version</p>
          <p>
            We collect what the Service needs to give you feedback, and not more. We do not
            sell your information, we do not run advertising, and we never share anything you
            write with any government or with your university. What you type stays private to
            your account; only anonymous, aggregated counts are used to see how the site is
            doing. Your profile and practice answers are scored by three AI providers, one of
            which processes data in China; section 6 explains what that means. You can delete
            your data at any time by emailing {CONTACT}.
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
          <Link to="/terms">Terms of Service</Link>.
        </p>
      </Section>

      <Section id="collect" title="2. What we collect">
        <p className="doc-sub">Information you give us</p>
        <List>
          <li>
            <strong>Account details.</strong> Your name and email address, and a hashed
            password. If you sign in with Google, we receive your name, email address, and
            profile picture from Google; we never see your Google password.
          </li>
          <li>
            <strong>Your profile.</strong> What you tell us about your situation so the
            feedback can be about you: university and programme, degree level, academic
            record including GPA and test scores, intended consulate and country, funding,
            scholarship and sponsor information, work history, which visa attempt this is,
            and your plans after study.
          </li>
          <li>
            <strong>Your practice answers.</strong> What you write in response to practice
            questions, and the reports we generate from them.
          </li>
          <li>
            <strong>Purchases.</strong> If you buy a plan: which plan, the price, the date,
            and the payment reference our payment processor gives us. The processor collects
            your card or payment details directly; we never receive or store your full card
            number.
          </li>
          <li>
            <strong>Refusal cover claims.</strong> If you claim the Complete plan&rsquo;s
            refusal cover, the fact that you told us your visa was refused and the date you
            told us.
          </li>
          <li>
            <strong>Feedback and surveys.</strong> Ratings, free-text comments, survey
            answers, and a waitlist email address if you give one.
          </li>
          <li>
            <strong>Correspondence.</strong> Anything you send us by email.
          </li>
        </List>

        <p className="doc-sub">Information collected automatically</p>
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
            <strong>Page analytics.</strong> We count page views with Umami Cloud, an
            analytics service that sets no cookies. It receives the page address, the site
            that sent you, your browser, operating system, device type, screen size,
            language, and approximate location (country or city), and nothing you type.
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
          <li>
            bank account or card details (when you buy a plan, you enter these on our
            payment processor&rsquo;s checkout, not into Altovisas);
          </li>
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
            To process purchases, give you the plan you paid for, handle refusal-cover
            claims and billing questions, and keep the records tax and accounting law
            requires.
          </li>
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
            your feedback, your reports, and any plan you buy.
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
            something, such as tax and accounting records of purchases.
          </li>
        </List>
      </Section>

      <Section id="ai" title="6. AI processing">
        <p>
          To generate your feedback, we send your profile and your practice answers to three
          third-party AI providers, which process them on our behalf and return a report.
          Every check goes to all three. You are shown one report; all three are stored with
          your account so we can compare the providers&rsquo; quality. We do not send your
          name, email address, or account identifiers to any of them, but anything you write
          inside an answer goes as written.
        </p>
        <List>
          <li>
            <strong>Anthropic</strong> (Claude), United States.
          </li>
          <li>
            <strong>OpenAI</strong> (GPT), United States.
          </li>
          <li>
            <strong>DeepSeek</strong> (DeepSeek&rsquo;s API), which processes and stores data
            in the People&rsquo;s Republic of China.
          </li>
        </List>
        <p>
          Anthropic&rsquo;s and OpenAI&rsquo;s commercial API terms do not allow them to use
          what we send to train their models, though they may keep it for a limited time to
          monitor abuse. DeepSeek&rsquo;s own terms govern how it handles what it receives,
          and we cannot make the same commitment for it. We do not use your content to train
          any model of our own.
        </p>
        <Callout>
          <p>
            Because your answers are read by three outside providers in two countries, keep
            them to what the questions ask. Leave out names, contact details, and anything you
            would not want to leave your hands.
          </p>
        </Callout>
      </Section>

      <Section id="cookies" title="7. Cookies, storage, and link tags">
        <p>We use a small number of cookies and browser-storage entries, all functional:</p>
        <List>
          <li>
            <strong>Cookies.</strong> A secure, HTTP-only refresh-token cookie keeps you
            signed in for up to 30 days. An HTTP-only guest cookie identifies your browser
            before you sign in, so free usage is counted fairly. A short-lived cookie remembers
            which page to return you to during Google sign-in, and expires after five minutes.
          </li>
          <li>
            <strong>Local storage.</strong> A random visitor identifier and a session
            identifier, used to group your own usage events together, and the link tag
            described below.
          </li>
          <li>
            <strong>Session storage.</strong> Your sign-in token, and an unfinished profile
            check or survey, kept in that browser tab so a reload does not lose your work. All
            of it is cleared when the tab closes or you sign out.
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
          behavioural advertising. Our usage events go to our own servers. Page-view counts go
          to Umami Cloud, which sets no cookies and does not track you across other sites.
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
          <li>
            <strong>Anthropic, OpenAI, and DeepSeek</strong> - AI processing that generates
            your feedback (see section 6).
          </li>
          <li><strong>Google</strong> - optional sign-in, if you use it.</li>
          <li>
            <strong>Our payment processor</strong> - taking payment when you buy a plan.
          </li>
          <li><strong>Umami</strong> - cookie-free page-view counts.</li>
          <li><strong>Our email provider</strong> - delivery of verification and account email.</li>
          <li>
            <strong>Vercel and our database provider</strong> - hosting the Service and storing
            its data.
          </li>
        </List>
        <p>
          We may also disclose information if we are legally required to, to enforce our{" "}
          <Link to="/terms">Terms</Link>, or to
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
            <strong>Purchase records</strong> - for as long as tax and accounting law
            requires, even after your account is deleted.
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
          <a href={`mailto:${CONTACT}`}>
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
          rotation and to anything we are legally required to keep, such as purchase records.
          Copies held by the AI providers under their own retention terms are not in our
          control, which is one more reason to keep answers to what the questions ask.
        </p>
        <p>
          Aggregated statistics that can no longer identify you - counts, medians, approval
          shares - are not deleted, because they contain nothing that points back to you.
        </p>
      </Section>

      <Section id="transfers" title="13. International transfers">
        <p>
          We operate from and store data in the United States, and most of our service
          providers are U.S.-based. If you use the Service from outside the United States,
          your information will be transferred there, where data protection law differs from
          your own. Your profile and practice answers are also sent to DeepSeek in the
          People&rsquo;s Republic of China to be scored (see section 6).
        </p>
        <p>
          Where we transfer personal information out of the EEA or the UK, we rely on the
          safeguards our providers offer for such transfers, such as the European
          Commission&rsquo;s Standard Contractual Clauses and the UK Addendum, where they
          offer them.
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
          <a href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          . We read everything sent there.
        </p>
      </Section>
    </LegalLayout>
  );
}
