type Constants = 'defaultPath'

const context: Omit<typeof saus, Constants> = {
  hydrated: false,
}

// @ts-ignore
saus = context
