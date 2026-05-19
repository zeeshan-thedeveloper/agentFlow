import { CanvasScrollLock } from '@/components/CanvasScrollLock';

export default function CanvasLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CanvasScrollLock />
      {children}
    </>
  );
}
