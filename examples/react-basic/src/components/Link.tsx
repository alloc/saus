import { ComponentProps } from 'react'

export type LinkProps = ComponentProps<'a'> & { href: string }

export const Link = ({ href, ...props }: LinkProps) => (
  <a {...props} href={import.meta.env.BASE_URL + href.replace(/^\//, '')} />
)
