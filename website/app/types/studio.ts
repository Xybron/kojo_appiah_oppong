export interface StudioUser {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: "admin" | "visitor";
}

export interface StudioSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  expiresIn?: number;
  user: StudioUser;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  created_at: string;
}

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  interest: string;
  message: string;
  status: "new" | "in_progress" | "closed";
  internal_notes?: string;
  created_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  title: string;
  description: string;
  status: "planning" | "in_progress" | "review" | "completed";
  next_step: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  name: string;
  mime_type: string;
  size: number;
  created_at: string;
}

export interface PortfolioWork {
  id: string;
  title: string;
  discipline: string;
  image_url: string;
  alt: string;
  description: string;
  width: number;
  height: number;
  sort_order: number;
  published: boolean;
}

export interface StudioWorkspace {
  clients: Client[];
  enquiries: Enquiry[];
  projects: Project[];
  files: ProjectFile[];
  works: PortfolioWork[];
}

export const emptyWorkspace = (): StudioWorkspace => ({
  clients: [], enquiries: [], projects: [], files: [], works: [],
});
