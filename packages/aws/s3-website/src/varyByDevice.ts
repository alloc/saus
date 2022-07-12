export type UserDeviceType = keyof typeof deviceHeaders

const deviceHeaders = {
  android: 'CloudFront-Is-Android-Viewer',
  desktop: 'CloudFront-Is-Desktop-Viewer',
  ios: 'CloudFront-Is-IOS-Viewer',
  mobile: 'CloudFront-Is-Mobile-Viewer',
  tablet: 'CloudFront-Is-Tablet-Viewer',
  tv: 'CloudFront-Is-SmartTV-Viewer',
} as const

export function varyByDevice(
  deviceTypes: readonly UserDeviceType[] | undefined
): string[] {
  if (deviceTypes?.length) {
    return deviceTypes.map(
      (type): string => deviceHeaders[type as keyof typeof deviceHeaders]
    )
  }
  return []
}
