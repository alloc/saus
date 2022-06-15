import { CloudFormation } from './cloudformation'

export interface Actions {
  CreateStack: {
    input: CloudFormation.CreateStackInput
    output: CloudFormation.CreateStackOutput
  }
  UpdateStack: {
    input: CloudFormation.UpdateStackInput
    output: CloudFormation.UpdateStackOutput
  }
  DeleteStack: {
    input: CloudFormation.DeleteStackInput
    output: void
  }
  DescribeStacks: {
    input: CloudFormation.DescribeStacksInput
    output: CloudFormation.DescribeStacksOutput
  }
  GetTemplate: {
    input: CloudFormation.GetTemplateInput
    output: CloudFormation.GetTemplateOutput
  }
}
