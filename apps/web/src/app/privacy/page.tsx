import type { Metadata } from 'next';
import { Contact, LegalPage, LegalSection, Operator } from '@/components/legal/LegalPage';
import '../landing.css';

export const metadata: Metadata = {
  title: 'Privacy Policy · AgentFlow',
  description: 'What data AgentFlow collects, how it is used and stored, and the choices you have.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          AgentFlow (&ldquo;AgentFlow&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a visual builder for AI agent
          workflows, available at agentflow.zeeshanahmed.app and operated by <Operator />. This policy explains what
          we collect when you use AgentFlow, why, where it goes, and how to remove it. If anything here is unclear,
          get in touch through <Contact />.
        </p>
      }
    >
      <LegalSection title="Summary">
        <ul>
          <li>We collect what we need to run your workflows: your account, the workflows you build, the keys and connections you add, and the history of your runs.</li>
          <li>Secrets you give us (API keys, tokens, connection strings) are stored encrypted.</li>
          <li>When a workflow runs, the data its agent reads is sent to the AI provider you set up (OpenAI, with your own API key) so the agent can do the task. We don&apos;t sell your data, use it for advertising, or use it to train AI models.</li>
          <li>You can disconnect any app and delete your account at any time. Deleting your account deletes everything we store about you.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Information we collect">
        <p><strong>Account information.</strong> When you sign in with Google or GitHub we receive your name, email address and profile picture, and store a record of that sign-in so you can sign in again.</p>
        <p><strong>Workflows.</strong> The workflows you build on the canvas: their nodes, prompts, settings and connections between nodes.</p>
        <p><strong>API keys.</strong> Keys you add for AI and search providers (for example OpenAI and Tavily). They are encrypted before they are stored and are only decrypted to make requests you started.</p>
        <p><strong>Connected apps.</strong> When you connect an app we store what is needed to act for you there, encrypted:</p>
        <ul>
          <li>Google (Gmail): OAuth access and refresh tokens, the account&apos;s email address and the permissions you granted.</li>
          <li>Slack: your bot token, signing secret and workspace name.</li>
          <li>Telegram: your bot token and the bot&apos;s username.</li>
          <li>GitHub: your personal access token and GitHub username.</li>
          <li>Databases: the connection string you enter and the table permissions you set.</li>
        </ul>
        <p><strong>Run history.</strong> For each workflow run we keep what started it (the Run button, or a Slack or Telegram message with its text, sender ID and chat), its status and timing, and each step&apos;s result. Results can include text an agent read or wrote, such as part of an email, document or chat message, shortened to at most 4,000 characters per step.</p>
        <p><strong>Operational logs.</strong> Our servers keep technical logs to run and debug the service. They can include short excerpts (up to 500 characters) of workflow inputs, tool results and outputs. Logs are kept only as long as needed for operating and securing the service.</p>
        <p><strong>Usage analytics.</strong> Our public pages may use Google Analytics to count visits and see which pages are used. It sets cookies in your browser and does not receive your workflows or connected-app data.</p>
      </LegalSection>

      <LegalSection id="google-user-data" title="Google user data">
        <p>If you connect a Google account, AgentFlow asks only for the permissions its features need:</p>
        <ul>
          <li><strong>Sign-in</strong> (your name, email address and profile picture): to create your account and show who is signed in.</li>
          <li><strong>Gmail: send email</strong>: an agent you wired to a Gmail node can send a plain-text email from your account, only if you turned on &ldquo;Allow sending email&rdquo; for that node. This is off by default, and this permission does not let AgentFlow read your mailbox.</li>
        </ul>
        <p>AgentFlow does not ask for access to read your mailbox, your Google Drive or any other Google data.</p>
        <p>The Gmail permission is used only while a workflow you built is running, and only by agents connected to a Gmail node where you allowed sending. The email&apos;s recipient, subject and text come from your workflow; the text may be written by the AI provider configured on that agent (OpenAI, using your own API key). A record of what was sent is shown only to you, in your run results and run history.</p>
        <p>We do not use Google user data to serve advertising, we do not sell it, we do not use it to develop, improve or train generalized AI or machine-learning models, and people do not read it unless you ask us to for support, it is needed for security, or the law requires it.</p>
        <p>
          AgentFlow&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" className="l-link" target="_blank" rel="noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <p>
          You can disconnect Google from any Gmail node&apos;s settings, which deletes the stored tokens and asks Google to revoke them. You can also remove AgentFlow at{' '}
          <a href="https://myaccount.google.com/permissions" className="l-link" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.
        </p>
      </LegalSection>

      <LegalSection title="How we use information">
        <ul>
          <li>To sign you in and keep your session.</li>
          <li>To save your workflows and run them when you click Run or when a Slack or Telegram message triggers them.</li>
          <li>To call the AI providers and connected apps your workflows use, with your keys and connections.</li>
          <li>To show your run results and history.</li>
          <li>To keep the service secure, fix problems and understand which pages are used.</li>
        </ul>
        <p>We don&apos;t use your data for advertising and we don&apos;t sell it.</p>
      </LegalSection>

      <LegalSection title="Who your data is shared with">
        <p>Only the services needed to do what you asked:</p>
        <ul>
          <li><strong>AI and search providers</strong> you configure (OpenAI, Tavily): prompts, the input to each agent and the results of its tools are sent to them when a workflow runs.</li>
          <li><strong>Apps you connect</strong> (Google, Slack, Telegram, GitHub, your databases): AgentFlow sends them the requests your workflows make, such as reading a channel or posting a reply.</li>
          <li><strong>Websites</strong> an agent visits with its HTTP or page-reading tools.</li>
          <li><strong>Infrastructure providers</strong> that host our servers and database.</li>
          <li><strong>Authorities</strong>, if the law requires it.</li>
        </ul>
        <p>Each of these services handles data under its own privacy policy.</p>
      </LegalSection>

      <LegalSection title="Storage and security">
        <p>Your data is stored in our database on servers run by our hosting providers. API keys, tokens and connection strings are encrypted with AES-256-GCM before they are stored. Traffic to AgentFlow uses HTTPS. Webhooks from Slack and Telegram are checked against your connection&apos;s signing secret or secret token before anything runs.</p>
        <p>No system is perfectly secure. If we learn of a breach affecting your data, we will tell you without undue delay.</p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>Your account, workflows, keys, connections and run history are kept until you delete them or delete your account. Disconnecting an app deletes its stored credentials straight away. Deleting your account deletes all of the above. Operational logs and backups are removed on a rolling basis.</p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <ul>
          <li>Disconnect any app from its node&apos;s settings, and remove API keys under Keys.</li>
          <li>Delete your account from Settings; this removes your workflows, keys, connections and run history.</li>
          <li>Ask us for a copy of your data, or to correct or delete it, through <Contact />.</li>
        </ul>
        <p>Depending on where you live (for example under the GDPR or UK GDPR), you may have further rights, including to object to or restrict processing and to complain to your data protection authority. We process your data to provide the service you asked for and, for security and analytics, on the basis of our legitimate interests.</p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>We use a session cookie to keep you signed in, a short-lived cookie to protect the Google connection flow, and, on public pages, Google Analytics cookies. Your theme choice is kept in your browser&apos;s local storage.</p>
      </LegalSection>

      <LegalSection title="Children">
        <p>AgentFlow is not meant for children under 16, and we don&apos;t knowingly collect their data.</p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>If we change this policy we will update the date at the top, and tell you in the app or by email before significant changes take effect.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions or requests about your data: <Contact />.</p>
      </LegalSection>
    </LegalPage>
  );
}
