export type Role = 'admin' | 'field_admin' | 'field' | 'pending' | 'blocked'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: Role
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  sort_order: number
}

export type Difficulty = 'basico' | 'intermediario' | 'avancado'
export type Status = 'draft' | 'published'

export interface Tutorial {
  id: string
  short_code: string
  title: string
  summary: string | null
  content_html: string
  content_json: unknown
  category_id: string | null
  tags: string[]
  difficulty: Difficulty
  status: Status
  author_id: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface TutorialListItem {
  id: string
  short_code: string
  title: string
  summary: string | null
  category_id: string | null
  tags: string[]
  difficulty: Difficulty
  status: Status
  author_id: string
  created_at: string
  updated_at: string
  author_name: string | null
  author_avatar: string | null
  category_name: string | null
  category_color: string | null
  category_icon: string | null
  viewer_count: number
  view_count: number
  attachment_count: number
}

export interface LinkItem {
  id?: string
  url: string
  title: string | null
  sort_order?: number
}

export interface Attachment {
  id: string
  tutorial_id: string
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

export interface Viewer {
  user_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  views: number
  first_viewed: string
  last_viewed: string
  via_share: boolean
}
