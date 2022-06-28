import { createAmzRequestFn } from '@saus/aws-utils'
import { CloudFormation } from './types'

export const signedRequest = createAmzRequestFn<{
  CreateStack: {
    params: CloudFormation.CreateStackInput
    result: CloudFormation.CreateStackOutput
  }
  UpdateStack: {
    params: CloudFormation.UpdateStackInput
    result: CloudFormation.UpdateStackOutput
  }
  DeleteStack: {
    params: CloudFormation.DeleteStackInput
    result: void
  }
  DescribeStacks: {
    params: CloudFormation.DescribeStacksInput
    result: CloudFormation.DescribeStacksOutput
  }
  DescribeStackEvents: {
    params: CloudFormation.DescribeStackEventsInput
    result: CloudFormation.DescribeStackEventsOutput
  }
  GetTemplate: {
    params: CloudFormation.GetTemplateInput
    result: CloudFormation.GetTemplateOutput
  }
}>({
  service: 'cloudformation',
  apiVersion: '2010-05-15',
  acceptJson: true,
})
