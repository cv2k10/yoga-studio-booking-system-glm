import type { ReactNode } from "@/lib/next";

type Props = { href: string; children?: ReactNode; [attr: string]: unknown };

export default function Link({ href, children, ...rest }: Props) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
