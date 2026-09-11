import { Link } from "react-router-dom";
import LegalLayout, { Section, List, Callout } from "../components/LegalLayout";

const CONTACT = "altovisas@gmail.com";
const UPDATED = "30 August 2026";

const TOC = [
  { id: "agreement", title: "The agreement" },
  { id: "what-this-is", title: "What Altovisas is, and is not" },
  { id: "no-guarantee", title: "No guarantee of any visa outcome" },
  { id: "honesty", title: "Honesty at your interview" },
  { id: "eligibility", title: "Who may use the service" },
  { id: "accounts", title: "Accounts" },
  { id: "price", title: "Price and availability" },
  { id: "acceptable-use", title: "Acceptable use" },
  { id: "your-content", title: "Your content" },
  { id: "data", title: "Where our data comes from" },
  { id: "ai", title: "How the AI works, and how it fails" },
  { id: "ip", title: "Our intellectual property" },
  { id: "third-parties", title: "Third-party services" },
  { id: "warranty", title: "Disclaimer of warranties" },
  { id: "liability", title: "Limitation of liability" },
  { id: "indemnity", title: "Indemnification" },
  { id: "termination", title: "Termination" },
  { id: "changes", title: "Changes to these Terms" },
  { id: "disputes", title: "Governing law and disputes" },
  { id: "general", title: "General terms" },
  { id: "contact", title: "Contact" },
];

export default function TermsOfServicePage() {
  return (
    <LegalLayout
      title="Terms of Service"
      updated={UPDATED}
      toc={TOC}
      summary={
        <Callout>
          <p className="font-semibold mb-2">The short version</p>
          <p>
            Altovisas is a practice tool. It is not legal advice, not immigration advice,
            and not connected to any government. Nothing here can change what a consular
            officer decides. Answer every question at your real interview truthfully, in
            your own words, whatever this site suggests. If you are making an actual
            immigration decision, talk to a licensed immigration attorney.
          </p>
        </Callout>
      }
    >
      <Section id="agreement" title="1. The agreement">
        <p>
          These Terms of Service (the "Terms") are a binding agreement between you and
          Altovisas ("Altovisas", "we", "us"), covering altovisas.com and everything on
          it (the "Service"). By creating an account, submitting a profile, or otherwise
          using the Service, you agree to these Terms and to our{" "}
          <Link to="/privacy" className="text-indigo-700 hover:underline">Privacy Policy</Link>,
          which is part of this agreement.
        </p>
        <p>
          If you do not agree, do not use the Service. If you are using the Service on
          behalf of an organization, you confirm you are authorized to bind that
          organization to these Terms.
        </p>
      </Section>

      <Section id="what-this-is" title="2. What Altovisas is, and is not">
        <p>
          Altovisas helps you rehearse for a student visa interview. You describe your
          situation, you answer practice questions, and the Service returns automated
          feedback and statistics drawn from write-ups other applicants posted publicly
          about their own interviews.
        </p>
        <p className="font-semibold text-stone-900">The Service is not:</p>
        <List>
          <li>
            <strong>Legal or immigration advice.</strong> We are not a law firm and we are
            not licensed immigration advisers. Using the Service does not create an
            attorney-client relationship, and nothing on the site should be relied on as a
            substitute for advice from a licensed professional about your own situation.
          </li>
          <li>
            <strong>Affiliated with any government.</strong> We are not connected to,
            endorsed by, or acting for the U.S. Department of State, U.S. Citizenship and
            Immigration Services, any embassy or consulate, SEVP/SEVIS, or any other
            government body of any country. We have no role in and no visibility into any
            visa application, and no ability to influence one.
          </li>
          <li>
            <strong>A visa application service.</strong> We do not file, submit, review, or
            transmit any application, form, or document to any authority on your behalf.
          </li>
          <li>
            <strong>Affiliated with any university.</strong> Institution and program names
            appear only to describe your situation back to you.
          </li>
        </List>
      </Section>

      <Section id="no-guarantee" title="3. No guarantee of any visa outcome">
        <Callout>
          <p>
            Nothing on this site predicts, improves, or guarantees the outcome of a real
            visa interview. Visa decisions are made solely by consular officers under laws
            and policies we do not control and cannot see.
          </p>
        </Callout>
        <p>
          Scores, readiness bands, risk flags, approval percentages, and any similar figure
          the Service shows you are descriptions of a dataset of self-reported posts. They
          are not a probability that your visa will be approved, and they are not evidence
          of anything about your individual case. A high score is not an approval and a low
          score is not a refusal.
        </p>
        <p>
          You accept that any decision you make about travel, tuition deposits, housing,
          employment, deferrals, or your application itself is your own, and that you are
          not relying on the Service to make it.
        </p>
      </Section>

      <Section id="honesty" title="4. Honesty at your interview">
        <p>
          This matters more than anything else in these Terms. The Service exists to help
          you present true facts about yourself clearly and calmly. It does not exist to
          help you present facts that are not true.
        </p>
        <p className="font-semibold text-stone-900">You agree that you will not:</p>
        <List>
          <li>
            use the Service to invent, rehearse, or refine a false or misleading statement
            for any immigration authority;
          </li>
          <li>
            recite a suggested answer that is not true of you, or that describes funding,
            family, academic history, employment, or intentions you do not actually have;
          </li>
          <li>
            treat any wording the Service produces as a script to be repeated regardless of
            whether it is accurate about you.
          </li>
        </List>
        <p>
          Misrepresenting a material fact to a consular officer is a serious matter with
          consequences that can last a lifetime, including a permanent bar from entry. Those
          consequences are yours alone. Where the Service suggests an answer, it is a
          suggestion of <em>structure</em> - what to lead with, what to leave out, how much
          detail to give. The facts inside it must be your own and must be true. We may
          suspend or terminate any account we reasonably believe is being used to prepare a
          deceptive statement.
        </p>
      </Section>

      <Section id="eligibility" title="5. Who may use the service">
        <p>
          You must be at least 16 years old to use the Service. If you are under 18, you may
          use it only with the involvement and consent of a parent or legal guardian, who
          agrees to these Terms on your behalf. The Service is not directed to children
          under 16, and we do not knowingly collect their information.
        </p>
        <p>
          You may not use the Service if you are barred from doing so under applicable law,
          including U.S. export control and sanctions law, or if we have previously
          terminated your account.
        </p>
      </Section>

      <Section id="accounts" title="6. Accounts">
        <p>
          Parts of the Service work without an account. For the rest, you agree to give
          accurate registration information, to keep it current, and to keep your
          credentials confidential. You are responsible for activity under your account.
          Tell us at {CONTACT} promptly if you believe it has been used without your
          permission.
        </p>
        <p>
          One account per person. Do not share, sell, or transfer an account, and do not
          create an account for anyone else without their knowledge.
        </p>
      </Section>

      <Section id="price" title="7. Price and availability">
        <p>
          The Service is currently provided free of charge. We may introduce paid features
          in the future; if we do, we will publish the price and the payment and refund
          terms before you are asked to pay for anything, and nothing you have already
          received for free will become retroactively chargeable.
        </p>
        <p>
          Access may be limited by usage caps, and we may change, suspend, or discontinue
          any part of the Service at any time. We aim for continuous availability but do not
          promise it: maintenance, outages, third-party failures, and capacity limits all
          happen. Because the Service is free, we do not offer service-level commitments,
          credits, or compensation for downtime or data loss.
        </p>
      </Section>

      <Section id="acceptable-use" title="8. Acceptable use">
        <p>You agree not to:</p>
        <List>
          <li>break any applicable law, or help anyone else to;</li>
          <li>
            impersonate anyone, or submit another person's information as your own without
            their permission;
          </li>
          <li>
            scrape, crawl, bulk-download, or systematically extract the Service, its
            content, its dataset, or its outputs;
          </li>
          <li>
            resell, sublicense, or redistribute the Service or its outputs as a commercial
            product or a competing service;
          </li>
          <li>
            use the Service or its outputs to train, fine-tune, distil, or benchmark a
            machine-learning model;
          </li>
          <li>
            probe, scan, or test the security of the Service, defeat rate limits or access
            controls, or access accounts, systems, or data that are not yours;
          </li>
          <li>
            interfere with the Service or its infrastructure, including by automated load,
            denial-of-service traffic, or malware;
          </li>
          <li>
            submit content that is unlawful, defamatory, harassing, hateful, or that
            infringes anyone's rights;
          </li>
          <li>
            attempt to make the Service produce content that violates section 4, or that is
            otherwise designed to deceive an official body;
          </li>
          <li>
            remove or obscure any notice on the Service, or misrepresent your relationship
            with us.
          </li>
        </List>
      </Section>

      <Section id="your-content" title="9. Your content">
        <p>
          "Your Content" means everything you submit: your profile, your practice answers,
          your feedback, and your survey responses. You keep ownership of it.
        </p>
        <p>
          You grant us a worldwide, non-exclusive, royalty-free licence to host, store,
          reproduce, and process Your Content, and to create de-identified and aggregated
          statistics from it, for the limited purposes of operating the Service, generating
          your feedback, keeping the Service secure, and improving how it works. This licence
          lasts as long as we hold Your Content and ends when it is deleted, except for
          de-identified aggregates that can no longer be traced back to you and for copies
          retained in backups until they expire.
        </p>
        <p>
          We do not sell Your Content, publish it, or show it to other users. We do not use
          it to train our own machine-learning models, and the AI provider that processes it
          on our behalf is contractually barred from training on it. See the{" "}
          <Link to="/privacy" className="text-indigo-700 hover:underline">Privacy Policy</Link>{" "}
          for the detail, including how to have it deleted.
        </p>
        <p>
          You confirm that you have the right to submit Your Content and that it does not
          infringe anyone's rights. Please do not submit passport numbers, visa or SEVIS
          identifiers, national identity numbers, bank or card numbers, or anyone else's
          personal information. The Service does not ask for these and does not need them.
        </p>
      </Section>

      <Section id="data" title="10. Where our data comes from">
        <p>
          The statistics on the Service are built from interview write-ups that applicants
          posted publicly about their own experiences, which we collected, de-duplicated,
          and parsed. That has consequences you should hold in mind whenever you read a
          number on this site:
        </p>
        <List>
          <li>
            <strong>It is self-selected.</strong> People who post are not a random sample of
            applicants. Approval rates in the dataset describe who chose to write something
            down, not the true rate at any consulate.
          </li>
          <li>
            <strong>It is self-reported.</strong> We did not witness any of these interviews
            and cannot verify any of them.
          </li>
          <li>
            <strong>It is correlational.</strong> Where the Service reports that some factor
            goes with a higher or lower approval share, that is an association in the data,
            not a cause, and not a lever you can pull.
          </li>
          <li>
            <strong>It ages.</strong> Consular practice changes. Older records may describe
            a process that no longer resembles the one you will face.
          </li>
        </List>
        <p>
          We publish these caveats alongside the figures themselves and make no
          representation that the dataset is complete, accurate, current, or representative.
        </p>
      </Section>

      <Section id="ai" title="11. How the AI works, and how it fails">
        <p>
          Feedback on the Service is generated by large language models. These systems are
          probabilistic. They can be confidently wrong, misread what you wrote, produce
          statements that are not supported by the data behind them, and give different
          answers to the same input. We work to keep the output grounded in the dataset, and
          it will still sometimes be wrong.
        </p>
        <p>
          Output is generated automatically and is not reviewed by a human before you see
          it. Treat everything the Service tells you as a prompt for your own thinking, not
          as a finding. Verify anything that matters against official sources, such as
          travel.state.gov, your consulate's own guidance, your designated school official,
          or a licensed immigration attorney.
        </p>
      </Section>

      <Section id="ip" title="12. Our intellectual property">
        <p>
          The Service, including its software, interface, text, graphics, logos, dataset
          compilation, and structure, belongs to Altovisas or its licensors and is protected
          by intellectual property law. Subject to these Terms, we grant you a personal,
          limited, non-exclusive, non-transferable, revocable licence to use the Service for
          your own visa interview preparation. No other rights are granted.
        </p>
        <p>
          The feedback the Service generates for you is yours to use for your own
          preparation, subject to section 8.
        </p>
        <p>
          If you believe something on the Service infringes your copyright, write to{" "}
          {CONTACT} identifying the work, the material in question, and your contact details,
          and confirming that you are the rights holder or authorized to act for them.
        </p>
      </Section>

      <Section id="third-parties" title="13. Third-party services">
        <p>
          The Service depends on third parties for sign-in, email delivery, hosting, and AI
          processing. Their failures can become our outages. We are not responsible for
          third-party services, and your use of one may also be governed by its own terms.
          Links to external sites are provided for convenience only and are not an
          endorsement.
        </p>
      </Section>

      <Section id="warranty" title="14. Disclaimer of warranties">
        <p className="uppercase text-sm tracking-wide text-stone-800">
          The service and everything in it are provided "as is" and "as available", without
          warranty of any kind. To the fullest extent permitted by law, we disclaim all
          warranties, express or implied, including merchantability, fitness for a particular
          purpose, title, non-infringement, and any warranty arising from course of dealing
          or usage of trade.
        </p>
        <p>
          We do not warrant that the Service will be uninterrupted, secure, or error-free,
          that its content or statistics are accurate or current, that defects will be
          corrected, or that any result you obtain from it is reliable. Some jurisdictions do
          not allow the exclusion of implied warranties, so parts of this section may not
          apply to you.
        </p>
      </Section>

      <Section id="liability" title="15. Limitation of liability">
        <p className="uppercase text-sm tracking-wide text-stone-800">
          To the fullest extent permitted by law, Altovisas and its owners, employees, and
          contractors will not be liable for any indirect, incidental, special,
          consequential, exemplary, or punitive damages, or for lost profits, lost
          opportunities, lost data, or loss of goodwill, arising out of or relating to the
          Service, whether in contract, tort, or any other theory, and whether or not we were
          advised of the possibility.
        </p>
        <p className="uppercase text-sm tracking-wide text-stone-800">
          This includes, without limitation, any visa refusal, delay, administrative
          processing, ban, deferred or lost admission, forfeited deposit, cancelled travel,
          or immigration consequence of any kind.
        </p>
        <p className="uppercase text-sm tracking-wide text-stone-800">
          Our total aggregate liability for all claims relating to the Service will not
          exceed the greater of the amount you paid us in the twelve months before the claim
          arose, or one hundred U.S. dollars (US$100).
        </p>
        <p>
          These limits apply even if a remedy fails of its essential purpose. Some
          jurisdictions do not allow certain limitations, so parts of this section may not
          apply to you; nothing here limits liability that cannot lawfully be limited,
          including liability for fraud or for death or personal injury caused by negligence.
        </p>
      </Section>

      <Section id="indemnity" title="16. Indemnification">
        <p>
          You agree to indemnify and hold harmless Altovisas and its owners, employees, and
          contractors from any claim, loss, liability, or expense (including reasonable legal
          fees) arising out of your use of the Service, Your Content, your breach of these
          Terms, or your violation of any law or third-party right, including any statement
          you make to any immigration or government authority.
        </p>
      </Section>

      <Section id="termination" title="17. Termination">
        <p>
          You may stop using the Service and delete your account at any time. We may suspend
          or terminate your access at any time, with or without notice, if we reasonably
          believe you have breached these Terms - in particular section 4 or section 8 - or
          to protect the Service or other users.
        </p>
        <p>
          On termination, your licence to use the Service ends. Sections 3, 4, 9, 10, 11, 12,
          14, 15, 16, 19, and 20 survive. Deletion of your data on termination is covered by
          the{" "}
          <Link to="/privacy" className="text-indigo-700 hover:underline">Privacy Policy</Link>.
        </p>
      </Section>

      <Section id="changes" title="18. Changes to these Terms">
        <p>
          We may update these Terms. When we do, we will change the "Last updated" date
          above, and for material changes we will give notice on the Service or by email to
          account holders before they take effect. Continuing to use the Service after that
          means you accept the updated Terms. If you do not accept them, stop using the
          Service and delete your account.
        </p>
      </Section>

      <Section id="disputes" title="19. Governing law and disputes">
        <p>
          These Terms are governed by the laws of the State of Delaware, USA, without regard
          to its conflict-of-laws rules, and excluding the U.N. Convention on Contracts for
          the International Sale of Goods.
        </p>
        <p>
          <strong>Talk to us first.</strong> If you have a dispute, email {CONTACT} with a
          description of it and what you would like us to do. We will try to resolve it
          informally. Please give us 30 days before starting formal proceedings.
        </p>
        <p>
          If that does not work, you and we agree to the exclusive jurisdiction of the state
          and federal courts located in Delaware, USA, and each of us consents to venue
          there. Claims must be brought individually, not as part of a class or
          representative action.
        </p>
        <p>
          If you are a consumer resident in the European Economic Area, the United Kingdom,
          or another jurisdiction whose law gives you a non-waivable right to the protection
          of your local law or to bring proceedings in your local courts, nothing in this
          section takes that right away.
        </p>
      </Section>

      <Section id="general" title="20. General terms">
        <List>
          <li>
            <strong>Entire agreement.</strong> These Terms and the Privacy Policy are the
            whole agreement between us about the Service and replace anything said before.
          </li>
          <li>
            <strong>Severability.</strong> If a provision is held unenforceable, it is
            limited or removed to the minimum extent necessary and the rest stays in force.
          </li>
          <li>
            <strong>No waiver.</strong> Not enforcing a provision is not a waiver of it.
          </li>
          <li>
            <strong>Assignment.</strong> You may not assign these Terms without our written
            consent. We may assign them in connection with a merger, acquisition, or sale of
            assets.
          </li>
          <li>
            <strong>Force majeure.</strong> Neither party is liable for a failure caused by
            events beyond its reasonable control.
          </li>
          <li>
            <strong>No third-party beneficiaries.</strong> These Terms create rights only
            between you and us.
          </li>
          <li>
            <strong>Language.</strong> These Terms are written in English. A translation is
            provided for convenience only; the English version governs.
          </li>
        </List>
      </Section>

      <Section id="contact" title="21. Contact">
        <p>
          Questions about these Terms go to{" "}
          <a href={`mailto:${CONTACT}`} className="text-indigo-700 hover:underline font-medium">
            {CONTACT}
          </a>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
