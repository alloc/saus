export interface LoginResponse {
  status: string
  session_uuid: string
  user_uuid: string
  user_email: string
  redirect_to: string
  companies: Company[]
  msg: string
}

export interface Company {
  id: string
  uuid: string
  slug: string
  name: string
  uniq: null
}
