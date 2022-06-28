import { UserDeviceType } from './types'

export type UserDeviceType = keyof typeof deviceHeaders

const deviceHeaders = {
  desktop: 'CloudFront-Is-Desktop-Viewer',
  mobile: 'CloudFront-Is-Mobile-Viewer',
  tablet: 'CloudFront-Is-Tablet-Viewer',
  tv: 'CloudFront-Is-SmartTV-Viewer',
} as const

export function varyByDevice(deviceTypes: UserDeviceType[] | undefined) {
  if (deviceTypes?.length) {
    return deviceTypes.map(
      (type): string => deviceHeaders[type as keyof typeof deviceHeaders]
    )
  }
  return []
}
