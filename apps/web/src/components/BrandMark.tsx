import Image from 'next/image';

/** The AgentFlow logo mark, the same image as the favicon and the Google consent screen. */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      priority
      style={{ borderRadius: Math.round(size * 0.28), flexShrink: 0 }}
    />
  );
}
