import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgentFlow',
  description: 'Visual AI agent builder',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-[#0D0D0F] text-white antialiased">{children}</body>
    </html>
  );
}
