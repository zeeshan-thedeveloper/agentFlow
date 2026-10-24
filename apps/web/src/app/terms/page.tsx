import type { Metadata } from 'next';
import { Contact, LegalPage, LegalSection, Operator } from '@/components/legal/LegalPage';
import '../landing.css';

export const metadata: Metadata = {
  title: 'Terms of Service · AgentFlow',
  description: 'The terms for using AgentFlow.',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These terms cover your use of AgentFlow at agentflow.zeeshanahmed.app, operated by <Operator />
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By signing in or using AgentFlow you agree to them. If you don&apos;t
          agree, please don&apos;t use the service. Our <a href="/privacy" className="l-link">Privacy Policy</a> explains
          how we handle your data.
        </p>
      }
    >
      <LegalSection title="The service">
        <p>AgentFlow lets you build workflows of AI agents on a visual canvas, connect them to apps such as Gmail, Slack, Telegram, GitHub and databases, run them yourself or when a chat message arrives, and get their results as notifications by email, Slack or Telegram.</p>
        <p>AgentFlow is under active development and is offered free of charge. Features may change, be limited or be removed, and the service may be unavailable at times.</p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>You sign in with a Google or GitHub account and must be at least 16 years old. You are responsible for what happens under your account and for keeping access to it secure. Tell us through <Contact /> if you think someone else has used it.</p>
      </LegalSection>

      <LegalSection title="Your keys, connections and costs">
        <ul>
          <li>AI and search features use API keys you provide (for example OpenAI and Tavily). Usage is billed to you by those providers under their own terms; we don&apos;t cover those costs.</li>
          <li>When you connect an app, you confirm you are allowed to give AgentFlow that access, and you remain bound by that app&apos;s own terms (for example Google, Slack, Telegram and GitHub).</li>
          <li>You can disconnect apps and remove keys at any time.</li>
        </ul>
      </LegalSection>

      <LegalSection title="What agents do for you">
        <p>Agents act on the instructions you give them, using the tools and apps you connect. You decide what each agent may do. Some actions, such as sending email or opening GitHub issues, are off until you allow them on a node.</p>
        <p>Email notifications are sent from your own Gmail account to the recipients you set. Only send them to people who expect them; they are subject to Gmail&apos;s own limits and policies. You can change or turn off a notification at any time in the workflow&apos;s Output step.</p>
        <p>AI output can be wrong, incomplete or unexpected, and text an agent reads (an email, document, web page or message) may try to mislead it. Review what your workflows do, especially before allowing them to send messages or change things. You are responsible for the actions your workflows take and for the messages they send.</p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Don&apos;t use AgentFlow to:</p>
        <ul>
          <li>break the law or anyone else&apos;s rights, including privacy and intellectual property;</li>
          <li>send spam, unsolicited bulk email or notifications, scams, harassment or malware, or access accounts, systems or data you aren&apos;t authorized to;</li>
          <li>get around the limits or terms of the AI providers and apps you connect;</li>
          <li>attack, overload or probe AgentFlow, or try to reach other users&apos; data.</li>
        </ul>
        <p>We may suspend or remove accounts that break these rules or put the service or others at risk.</p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>You keep all rights to your workflows, prompts and the data you process with AgentFlow. You give us permission to store, process and transmit it only as needed to run the service for you, as described in the Privacy Policy.</p>
      </LegalSection>

      <LegalSection title="Our service">
        <p>AgentFlow&apos;s software, design and name belong to us. These terms don&apos;t give you rights to them beyond using the service.</p>
      </LegalSection>

      <LegalSection title="Disclaimers">
        <p>AgentFlow is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind, including fitness for a particular purpose and uninterrupted or error-free operation. We don&apos;t guarantee the accuracy of anything an AI model or connected app produces.</p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>To the extent the law allows, we are not liable for indirect, incidental or consequential losses, lost data or profits, or costs charged by third-party providers, arising from your use of AgentFlow or the actions of your workflows. Nothing in these terms limits liability that cannot be limited by law.</p>
      </LegalSection>

      <LegalSection title="Ending use">
        <p>You can stop using AgentFlow and delete your account at any time from Settings. We may end or suspend access if you break these terms, or stop offering the service, and will give notice where we reasonably can.</p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>We may update these terms. We will change the date at the top and, for significant changes, tell you in the app or by email before they take effect. Using AgentFlow after that means you accept the updated terms.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions about these terms: <Contact />.</p>
      </LegalSection>
    </LegalPage>
  );
}
