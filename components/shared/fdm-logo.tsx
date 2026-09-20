import Image from 'next/image';

interface FdmLogoProps {
  className?: string;
}

export function FdmLogo({ className = 'h-12 w-auto' }: FdmLogoProps) {
  return (
    <Image
      src="/fdm-logo.png"
      alt="FDM"
      width={256}
      height={176}
      className={className}
    />
  );
}
