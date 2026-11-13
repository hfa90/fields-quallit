export type Role = 'admin' | 'field_admin' | 'field' | 'pending' | 'blocked'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: Role
  created_at: string
  updated_at: string
  cd_id?: string | null
  prefs?: Record<string, { v: string; t: number }>
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
  review_interval_months?: number
  reviewed_at?: string
  reviewed_by?: string | null
  verified_at?: string | null
  verified_by?: string | null
  kind?: 'tutorial' | 'quick'
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
  helpful_count?: number
  not_helpful_count?: number
  comment_count?: number
  outdated_count?: number
  review_due?: boolean
  reviewed_at?: string
  verified?: boolean
  verified_at?: string | null
  verified_by_name?: string | null
  kind?: 'tutorial' | 'quick'
  thanks_count?: number
  contributors_count?: number
  author_cd?: string | null
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

export type CommentKind = 'comment' | 'outdated' | 'tip' | 'question'
export interface Comment {
  id: string
  tutorial_id: string | null
  request_id: string | null
  parent_id: string | null
  user_id: string
  kind: CommentKind
  body: string
  resolved: boolean
  created_at: string
  updated_at: string
  author?: { full_name: string | null; email: string; avatar_url: string | null } | null
}

export interface Notification {
  id: number
  type: string
  title: string
  body: string | null
  link: string | null
  actor_id: string | null
  tutorial_id: string | null
  read_at: string | null
  created_at: string
}

export interface RequestItem {
  id: string
  user_id: string
  title: string
  details: string | null
  category_id: string | null
  status: 'open' | 'answered' | 'closed'
  tutorial_id: string | null
  answered_by: string | null
  created_at: string
  author?: { full_name: string | null; email: string; avatar_url: string | null } | null
  category?: { name: string; color: string; icon: string } | null
  tutorial?: { title: string; short_code: string } | null
  votes?: { user_id: string }[]
  comments?: { count: number }[]
}

export interface UserStats {
  user_id: string
  full_name: string | null
  avatar_url: string | null
  email: string
  role: Role
  created_at: string
  tutorials: number
  helpful_received: number
  comments: number
  requests_answered: number
  views_received: number
  followers: number
  points: number
  cd_name?: string | null
}

export interface SearchResult {
  kind: 'tutorial' | 'request' | 'person'
  id: string
  short_code: string | null
  title: string
  snippet: string | null
  category_name: string | null
  category_color: string | null
  category_icon: string | null
  author_name: string | null
  author_avatar: string | null
  matched_in: string
  score: number
  created_at: string
  verified?: boolean
}
