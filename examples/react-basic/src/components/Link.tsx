import { ComponentProps } from 'react'
import { BASE_URL } from 'saus/client'

export type LinkProps = ComponentProps<'a'> & { href: string }

export const Link = ({ href, ...props }: LinkProps) => (
  <a {...props} href={href.replace(/^\/?/, BASE_URL)} />
)
