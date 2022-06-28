export interface SessionResponse {
  status: string
  code: string
  session_uuid: string
  user_uuid: string
  user_email: string
  email: string
  phone: string
  name: string
  session_company: SessionCompany
  session_project: SessionProject
  companies: Company[]
  meta: Meta
  infos: Infos
  action: Action
}

export interface Action {
  type: string
  current_subdomain: string
  new_subdomain: string
}

export interface Company {
  uuid: string
  name: string
  slug: string
  role: Role
  projects: Projects
  data: any[]
}

export interface Projects {
  count: number
  uuids: string[]
  items: Items
}

export interface Items {
  '6c398cd9-565e-4e88-acdb-11a69633fdac': string
}

export interface Role {
  level: string
  updated_at: Date
}

export interface Infos {
  email: string
  phone: string
  company: string
  country: string
  lastname: string
  pathname: string
  firstname: string
  querystring: string
  auth_provider: string
  referral_token: null
  referral_provider: string
  onboarding_finished: boolean
  cms: CMS
  website: string
  vertical: string
  salesforce: Salesforce
}

export interface CMS {
  value: string
  user_input_value: null
}

export interface Salesforce {
  synced: number
  sfdc_type: string
  isConverted: number
  sfdc_lead_id: string
  last_sync_date: Date
}

export interface Meta {
  seconds_elapsed_since_registration: string
}

export interface SessionCompany {
  uuid: string
  name: string
  role: string
  coupons_added: any[]
  projects_roles: SessionProject[]
}

export interface SessionProject {
  project_uuid: string
  uuid: string
  name: string
  role: string
  data: null
}
