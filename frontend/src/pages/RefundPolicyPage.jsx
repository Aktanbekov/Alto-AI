import { Link } from "react-router-dom";
import LegalLayout, { Section, List, Callout } from "../components/LegalLayout";
import { REFUSAL_COVER_INTERVIEWS } from "../constants/pricing";
import { useLang } from "../i18n";
import RefundPolicyRu from "./legal/RefundPolicyRu";

const CONTACT = "altovisas@gmail.com";
const UPDATED = "21 October 2026";

const TOC = [
  { id: "covers", title: "What this policy covers" },
  { id: "final", title: "All sales are final" },
  { id: "why", title: "Why we don't offer refunds" },
  { id: "refusal", title: "If your visa is refused" },
  { id: "mistakes", title: "Billing mistakes we will fix" },
  { id: "unused", title: "Unused mock interviews" },
  { id: "ending", title: "If we end the Service or remove a feature" },
  { id: "law", title: "Your rights under consumer law" },
  { id: "disputes", title: "Before you dispute a charge" },
  { id: "contact", title: "How to reach us" },
  { id: "changes", title: "Changes to this policy" },
];

export default function RefundPolicyPage() {
  const { lang } = useLang();
  if (lang === "ru") return <RefundPolicyRu />;
  return (
    <LegalLayout
      title="Refund Policy"
      updated={UPDATED}
      toc={TOC}
      summary={
        <Callout>
          <p className="doc-callout-h">The short version</p>
          <p>
            Altovisas plans are one-time purchases of a digital service that starts working
            the moment you buy it. For that reason all sales are final and we do not offer
            refunds, including when a visa is refused. You can try the free mock interview
            first, with no card. We will always put right a billing mistake, and nothing here
            takes away rights your local consumer law gives you.
          </p>
        </Callout>
      }
    >
      <Section id="covers" title="1. What this policy covers">
        <p>
          This policy applies to every paid plan listed on our{" "}
          <Link to="/pricing">Pricing page</Link> (Quick prep, Full prep and Complete) and
          to any other paid plan we offer on altovisas.com. The free plan costs nothing, so
          there is nothing to refund. This policy is part of our{" "}
          <Link to="/terms">Terms of Service</Link>.
        </p>
      </Section>

      <Section id="final" title="2. All sales are final">
        <p>
          Once your payment goes through, the plan is added to your account and you can use
          it straight away. From that moment the purchase is not refundable, in whole or in
          part. That holds whether or not you use the mock interviews, and whatever the
          reason, including:
        </p>
        <List>
          <li>you changed your mind, or bought the wrong plan;</li>
          <li>your interview was moved, cancelled, or no longer needed;</li>
          <li>you did not find the feedback as useful as you hoped;</li>
          <li>your visa was refused (see section 4 for what the Complete plan includes).</li>
        </List>
      </Section>

      <Section id="why" title="3. Why we don't offer refunds">
        <List>
          <li>
            <strong>You can try before you pay.</strong> The free mock interview shows you
            the full feedback format with no card and no charge, so you know what a plan
            contains before you buy one.
          </li>
          <li>
            <strong>The service is delivered at once.</strong> A plan works the moment you
            buy it, and every mock interview you run costs us money to score. That work cannot
            be handed back.
          </li>
          <li>
            <strong>The outcome is not ours to promise.</strong> Visa decisions are made only
            by consular officers. A refund tied to the result would suggest we can influence
            it, and we cannot.
          </li>
        </List>
      </Section>

      <Section id="refusal" title="4. If your visa is refused">
        <Callout>
          <p>
            A visa refusal is not grounds for a refund on any plan. Nothing we sell can change
            what a consular officer decides.
          </p>
        </Callout>
        <p>
          The Complete plan includes refusal cover. If your F-1 visa is refused after you
          bought Complete, we add {REFUSAL_COVER_INTERVIEWS} more mock interviews to your
          account at no charge, so you can prepare for your next attempt. To claim it, email{" "}
          {CONTACT} from the address on your account and tell us your visa was refused. Do
          not send passport, visa, or DS-160 numbers; we never need them.
        </p>
        <p>
          Refusal cover can be claimed once for each Complete purchase. It is extra practice,
          not money: it cannot be exchanged for cash, a refund, or a different plan.
        </p>
      </Section>

      <Section id="mistakes" title="5. Billing mistakes we will fix">
        <p>All sales being final never means you pay for our mistakes. We will put right:</p>
        <List>
          <li>a charge made more than once for the same purchase;</li>
          <li>a charge for a different amount from the price shown when you paid;</li>
          <li>
            a payment that went through without the plan reaching your account, where we
            cannot fix that promptly;
          </li>
          <li>
            a charge you did not make or authorise. Tell your bank as well as us.
          </li>
        </List>
        <p>
          Depending on what went wrong, we will either deliver what you paid for or refund
          the mistaken amount to the payment method you used. Tell us as soon as you notice
          the problem. Refunds usually take a few working days to appear, depending on your
          bank.
        </p>
      </Section>

      <Section id="unused" title="6. Unused mock interviews">
        <p>
          Mock interviews you have not used have no cash value. They cannot be refunded,
          moved to another account, or exchanged for money or for a different plan.
        </p>
      </Section>

      <Section id="ending" title="7. If we end the Service or remove a feature">
        <p>
          If we close Altovisas, or permanently remove a feature included in a plan you
          bought before you have been able to use it, we will refund the part of the price
          that covers what you could not use. If we close your account because you broke our{" "}
          <Link to="/terms">Terms of Service</Link>, no refund is due.
        </p>
      </Section>

      <Section id="law" title="8. Your rights under consumer law">
        <p>
          This policy does not take away any right that the consumer law of the country you
          live in gives you and does not allow to be waived. If the law where you live gives
          you a right to cancel or to a refund, we will honour it.
        </p>
        <p>
          If you live in the European Union or the United Kingdom, consumer law usually gives
          you 14 days to cancel an online purchase. For a digital service that starts
          immediately, that right can end once you begin using it, if you asked for immediate
          access and acknowledged that you would lose the right to cancel. Where the law still
          gives you a right to cancel, this policy does not override it.
        </p>
      </Section>

      <Section id="disputes" title="9. Before you dispute a charge">
        <p>
          Please email us before you open a dispute or chargeback with your bank. A billing
          mistake is usually put right faster by us than through a bank dispute, and we would
          rather fix it directly.
        </p>
      </Section>

      <Section id="contact" title="10. How to reach us">
        <p>
          Write to{" "}
          <a href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>{" "}
          from the email address on your account. Include the date and amount of the charge,
          the plan you bought, and what went wrong. We aim to reply within a few working days.
        </p>
      </Section>

      <Section id="changes" title="11. Changes to this policy">
        <p>
          We may update this policy. The "Last updated" date above shows the current version.
          A purchase is always governed by the version in force on the day you paid; a later
          change never applies to a plan you have already bought.
        </p>
      </Section>
    </LegalLayout>
  );
}
