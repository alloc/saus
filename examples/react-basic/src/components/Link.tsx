import { ComponentProps } from 'react'
import { prependBase } from '../url'

export type LinkProps = ComponentProps<'a'> & { href: string }

export const Link = ({ href, ...props }: LinkProps) => (
  <a {...props} href={prependBase(href)} />
)
