<script setup lang="ts">
import "~/assets/css/workspace.css";
import { keepDialogFocus } from "~/utils/dialog";
import type {
  Client,
  Enquiry,
  Project,
  PortfolioWork,
  ProjectFile,
} from "~/types/studio";

const auth = useStudioAuth();
const workspace = useStudioWorkspace();
const { user, isAdmin } = auth;
const { data, loading, error } = workspace;
const route = useRoute();
const router = useRouter();
const search = ref("");
const filter = ref("");
const mobileNav = ref(false);
const mobileToggle = ref<HTMLButtonElement | null>(null);
const navigationElement = ref<HTMLElement | null>(null);
const busy = ref(false);
const actionError = ref("");
const notice = ref("");
const noticeIsError = ref(false);
const dialog = ref<HTMLDialogElement | null>(null);
const editor = ref<
  "client" | "project" | "enquiry" | "new-enquiry" | "work" | "file" | null
>(null);
const editingId = ref("");
const selectedFile = ref<File | null>(null);
const downloading = ref("");
const previewDialog = ref<HTMLDialogElement | null>(null);
const previewFile = ref<ProjectFile | null>(null);
const previewUrl = ref("");
const previewFailed = ref(false);
let previewReturnFocus: HTMLElement | null = null;
let returnFocus: HTMLElement | null = null;
const clientForm = reactive({ name: "", email: "", company: "" });
const projectForm = reactive({
  title: "",
  client_id: "",
  description: "",
  status: "planning",
  next_step: "",
  due_date: "",
});
const enquiryForm = reactive({
  name: "",
  email: "",
  interest: "A photographic commission",
  message: "",
  status: "new",
  internal_notes: "",
});
const workForm = reactive({
  title: "",
  discipline: "Fine art",
  image_url: "",
  alt: "",
  description: "",
  width: 1600,
  height: 1200,
  sort_order: 0,
  published: false,
});
const fileForm = reactive({ project_id: "" });
const profileForm = reactive({ firstName: "", lastName: "" });
const passwordForm = reactive({ currentPassword: "", newPassword: "" });
const settingsBusy = ref("");
const settingsError = ref("");
const labels: Record<string, string> = {
  overview: "Overview",
  enquiries: "Enquiries",
  projects: "Projects",
  clients: "Clients",
  files: "Files & galleries",
  portfolio: "Portfolio",
  settings: "Account settings",
};
const navigation = computed(() =>
  isAdmin.value
    ? ["overview", "enquiries", "projects", "clients", "files", "portfolio"]
    : ["overview", "projects", "enquiries", "files"],
);
const section = computed(() => {
  const value = String(route.query.section || "overview");
  return [...navigation.value, "settings"].includes(value) ? value : "overview";
});
const sectionTitle = computed(() => labels[section.value]);
const activeProjects = computed(() =>
  data.value.projects.filter((p) => p.status !== "completed"),
);
const openEnquiries = computed(() =>
  data.value.enquiries.filter((e) => e.status !== "closed"),
);
const clientName = (id: string) =>
  data.value.clients.find((c) => c.id === id)?.name || "Client";
const projectName = (id: string) =>
  data.value.projects.find((p) => p.id === id)?.title || "Project";
const statusLabel = (status: string) =>
  (
    ({
      new: "New",
      planning: "Planning",
      in_progress: "In progress",
      review: "In review",
      completed: "Completed",
      closed: "Closed",
    }) as Record<string, string>
  )[status] || status;
const matches = (...values: (string | null | undefined)[]) =>
  values.join(" ").toLowerCase().includes(search.value.toLowerCase().trim());
const projects = computed(() =>
  data.value.projects.filter(
    (p) =>
      matches(p.title, p.description, clientName(p.client_id)) &&
      (!filter.value || p.status === filter.value),
  ),
);
const enquiries = computed(() =>
  data.value.enquiries.filter(
    (e) =>
      matches(e.name, e.email, e.interest, e.message) &&
      (!filter.value || e.status === filter.value),
  ),
);
const clients = computed(() =>
  data.value.clients.filter((c) => matches(c.name, c.email, c.company)),
);
const files = computed(() =>
  data.value.files.filter(
    (f) =>
      matches(f.name, projectName(f.project_id)) &&
      (!filter.value || f.project_id === filter.value),
  ),
);
const works = computed(() =>
  data.value.works
    .filter(
      (w) =>
        matches(w.title, w.discipline) &&
        (!filter.value ||
          (filter.value === "published" ? w.published : !w.published)),
    )
    .sort((a, b) => a.sort_order - b.sort_order),
);
const initials = computed(() =>
  (
    (user.value?.firstName?.[0] || user.value?.email?.[0] || "K") +
    (user.value?.lastName?.[0] || "")
  ).toUpperCase(),
);
const pageIntro = computed(
  () =>
    (
      ({
        enquiries: isAdmin.value
          ? "Every new conversation, in one place."
          : "Your ideas and conversations with the studio.",
        projects: isAdmin.value
          ? "Keep commissions moving, from the first idea to the final image."
          : "Follow your commissions and see what happens next.",
        clients: "The people and collaborators behind the work.",
        files: "Project images and final files, ready when you need them.",
        portfolio: "Curate the work visitors see in your public gallery.",
        settings: "A few details to make this space yours.",
      }) as Record<string, string>
    )[section.value] || "",
);
const editorTitle = computed(
  () =>
    ({
      client: editingId.value ? "Edit client" : "Add a client",
      project: isAdmin.value
        ? editingId.value
          ? "Edit project"
          : "Start a project"
        : "Project details",
      enquiry: "Enquiry details",
      "new-enquiry": "Start a conversation",
      work: editingId.value ? "Edit portfolio work" : "Add portfolio work",
      file: "Share a file",
    })[editor.value || "client"],
);
function date(value?: string | null) {
  if (!value) return "No date set";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? "No date set"
    : parsed.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}
function fileSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
async function toggleMobileNav(open = !mobileNav.value) {
  mobileNav.value = open;
  await nextTick();
  if (open)
    navigationElement.value
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus();
  else mobileToggle.value?.focus();
}
async function go(value: string, selectedFilter = "") {
  const wasMobile = mobileNav.value;
  search.value = "";
  filter.value = selectedFilter;
  mobileNav.value = false;
  await router.replace({
    query: value === "overview" ? {} : { section: value },
  });
  if (wasMobile) document.getElementById("main")?.focus();
}
watch(section, () => {
  search.value = "";
  if (section.value !== "files") filter.value = "";
  notice.value = "";
});
watch(
  user,
  (value) => {
    profileForm.firstName = value?.firstName || "";
    profileForm.lastName = value?.lastName || "";
  },
  { immediate: true },
);
async function open(
  kind: NonNullable<typeof editor.value>,
  record?: Client | Project | Enquiry | PortfolioWork,
) {
  editingId.value = record?.id || "";
  editor.value = kind;
  actionError.value = "";
  selectedFile.value = null;
  if (kind === "client")
    Object.assign(clientForm, { name: "", email: "", company: "" }, record);
  if (kind === "project")
    Object.assign(
      projectForm,
      {
        title: "",
        client_id: "",
        description: "",
        status: "planning",
        next_step: "",
        due_date: "",
      },
      record,
      { due_date: (record as Project)?.due_date || "" },
    );
  if (kind === "enquiry" || kind === "new-enquiry")
    Object.assign(
      enquiryForm,
      {
        name: [user.value?.firstName, user.value?.lastName]
          .filter(Boolean)
          .join(" "),
        email: user.value?.email || "",
        interest: "A photographic commission",
        message: "",
        status: "new",
        internal_notes: "",
      },
      record,
    );
  if (kind === "work")
    Object.assign(
      workForm,
      {
        title: "",
        discipline: "Fine art",
        image_url: "",
        alt: "",
        description: "",
        width: 1600,
        height: 1200,
        sort_order: data.value.works.length,
        published: false,
      },
      record,
    );
  if (kind === "file") fileForm.project_id = filter.value || "";
  returnFocus = document.activeElement as HTMLElement;
  await nextTick();
  dialog.value?.showModal();
}
function close() {
  if (!busy.value) dialog.value?.close();
}
function afterClose() {
  editor.value = null;
  actionError.value = "";
  returnFocus?.focus();
}
function pickFile(event: Event) {
  selectedFile.value = (event.target as HTMLInputElement).files?.[0] || null;
}
async function imageDimensions(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function save() {
  if (busy.value) return;
  busy.value = true;
  actionError.value = "";
  noticeIsError.value = false;
  try {
    const idPath = editingId.value ? `/${editingId.value}` : "";
    const method = editingId.value ? "PATCH" : "POST";
    if (editor.value === "client")
      await workspace.save(
        `/workspace/clients${idPath}`,
        {
          name: clientForm.name,
          email: clientForm.email,
          company: clientForm.company,
        },
        method,
      );
    if (editor.value === "project")
      await workspace.save(
        `/workspace/projects${idPath}`,
        {
          title: projectForm.title,
          client_id: projectForm.client_id,
          description: projectForm.description,
          status: projectForm.status,
          next_step: projectForm.next_step,
          due_date: projectForm.due_date || null,
        },
        method,
      );
    if (editor.value === "enquiry")
      await workspace.save(
        `/workspace/enquiries${idPath}`,
        {
          status: enquiryForm.status,
          internal_notes: enquiryForm.internal_notes,
        },
        "PATCH",
      );
    if (editor.value === "new-enquiry")
      await workspace.save("/enquiries", {
        name: enquiryForm.name,
        email: enquiryForm.email,
        interest: enquiryForm.interest,
        message: enquiryForm.message,
      });
    if (editor.value === "work") {
      if (selectedFile.value) {
        if (selectedFile.value.size > 15 * 1024 * 1024)
          throw new Error("Choose an image smaller than 15 MB.");
        const dimensions = await imageDimensions(selectedFile.value);
        const body = new FormData();
        body.append("file", selectedFile.value);
        const uploaded = (await workspace.upload(
          "/workspace/portfolio-image",
          body,
        )) as { image_url: string };
        workForm.image_url = uploaded.image_url;
        Object.assign(workForm, dimensions);
        selectedFile.value = null;
      }
      if (!workForm.image_url)
        throw new Error("Choose a photograph for this work.");
      await workspace.save(
        `/workspace/works${idPath}`,
        {
          title: workForm.title,
          discipline: workForm.discipline,
          image_url: workForm.image_url,
          alt: workForm.alt,
          description: workForm.description,
          width: Number(workForm.width),
          height: Number(workForm.height),
          sort_order: Number(workForm.sort_order),
          published: workForm.published,
        },
        method,
      );
    }
    if (editor.value === "file") {
      if (!selectedFile.value) throw new Error("Choose a file to share.");
      if (selectedFile.value.size > 15 * 1024 * 1024)
        throw new Error("Choose a file smaller than 15 MB.");
      const body = new FormData();
      body.append("file", selectedFile.value);
      body.append("project_id", fileForm.project_id);
      await workspace.upload("/workspace/files", body);
    }
    notice.value =
      editor.value === "new-enquiry"
        ? "Your enquiry has been sent to the studio."
        : editor.value === "file"
          ? "File shared with this project's client."
          : "Changes saved.";
    dialog.value?.close();
  } catch (cause) {
    actionError.value = studioError(
      cause,
      "We couldn't save that. Please try again.",
    );
  } finally {
    busy.value = false;
  }
}
async function preview(file: ProjectFile) {
  downloading.value = file.id;
  notice.value = "";
  previewReturnFocus = document.activeElement as HTMLElement;
  try {
    const result = await auth.request<{ url: string }>(
      `/workspace/files/${encodeURIComponent(file.id)}/download?preview=true`,
    );
    const url = new URL(result.url);
    if (!["https:", "http:"].includes(url.protocol))
      throw new Error("This image is unavailable.");
    previewFile.value = file;
    previewUrl.value = url.href;
    previewFailed.value = false;
    await nextTick();
    previewDialog.value?.showModal();
  } catch (cause) {
    noticeIsError.value = true;
    notice.value = studioError(
      cause,
      "The image could not be opened. Please try again.",
    );
  } finally {
    downloading.value = "";
  }
}
function closePreview() {
  previewFile.value = null;
  previewUrl.value = "";
  previewReturnFocus?.focus();
}
async function download(file: ProjectFile) {
  downloading.value = file.id;
  notice.value = "";
  try {
    await workspace.download(file.id);
  } catch (cause) {
    noticeIsError.value = true;
    notice.value = studioError(
      cause,
      "The download could not be opened. Please try again.",
    );
  } finally {
    downloading.value = "";
  }
}
async function updateSettings(kind: "profile" | "password") {
  settingsBusy.value = kind;
  settingsError.value = "";
  notice.value = "";
  noticeIsError.value = false;
  try {
    if (kind === "profile") {
      const result = await auth.request<{
        user: NonNullable<typeof user.value>;
      }>("/auth/me", {
        method: "PATCH",
        body: {
          firstName: profileForm.firstName,
          lastName: profileForm.lastName,
        },
      });
      user.value = result.user;
      notice.value = "Your profile has been updated.";
    } else {
      await auth.request("/auth/change-password", {
        method: "POST",
        body: { ...passwordForm },
      });
      passwordForm.currentPassword = "";
      passwordForm.newPassword = "";
      notice.value = "Your password has been changed.";
    }
  } catch (cause) {
    settingsError.value = studioError(
      cause,
      "Unable to update your account. Please try again.",
    );
  } finally {
    settingsBusy.value = "";
  }
}
onMounted(() => {
  void workspace.load();
});
</script>

<template>
  <div class="workspace-app" @keydown.esc="mobileNav && toggleMobileNav(false)">
    <a href="#main" class="ws-skip">Skip to workspace</a>
    <aside
      class="ws-sidebar"
      :class="{ 'is-open': mobileNav }"
      aria-label="Workspace navigation"
    >
      <button
        type="button"
        class="ws-icon-button ws-sidebar-close"
        aria-label="Close navigation"
        @click="toggleMobileNav(false)"
      >
        <WorkspaceIcon name="close" />
      </button>
      <NuxtLink to="/" class="ws-brand" aria-label="Kojo Appiah Oppong home"
        ><span class="ws-brand-mark">ko.</span
        ><span
          >KOJO APPIAH OPPONG<small>Photography & fine art</small></span
        ></NuxtLink
      >
      <div class="ws-sidebar-label">
        {{ isAdmin ? "STUDIO WORKSPACE" : "YOUR WORKSPACE" }}
      </div>
      <nav ref="navigationElement" class="ws-navigation">
        <button
          v-for="item in navigation"
          :key="item"
          type="button"
          :class="{ active: section === item }"
          :aria-current="section === item ? 'page' : undefined"
          @click="go(item)"
        >
          <WorkspaceIcon :name="item" /><span>{{ labels[item] }}</span
          ><span
            v-if="item === 'enquiries' && openEnquiries.length"
            class="ws-nav-count"
            >{{ openEnquiries.length }}</span
          >
        </button>
      </nav>
      <div class="ws-sidebar-bottom">
        <div class="ws-sidebar-note">
          <span class="ws-small-label">A SPACE FOR THE WORK</span>
          <p>
            {{
              isAdmin
                ? "From the first conversation to the final image."
                : "Good things begin with a conversation."
            }}
          </p>
        </div>
        <button
          class="ws-account-link"
          type="button"
          :aria-current="section === 'settings' ? 'page' : undefined"
          @click="go('settings')"
        >
          <span class="ws-avatar">{{ initials }}</span><span
            class="ws-account-name"
            >{{ user?.firstName || "Your account"
            }}<small>{{
              isAdmin ? "Studio administrator" : "Client account"
            }}</small></span
          ><WorkspaceIcon name="settings" />
        </button>
      </div>
    </aside>
    <button
      v-if="mobileNav"
      class="ws-nav-overlay"
      aria-label="Close navigation"
      @click="toggleMobileNav(false)"
    />
    <div class="ws-body" :inert="mobileNav || undefined">
      <header class="ws-topbar">
        <button
          ref="mobileToggle"
          type="button"
          class="ws-icon-button ws-mobile-menu"
          :aria-expanded="mobileNav"
          aria-label="Open navigation"
          @click="toggleMobileNav()"
        >
          <WorkspaceIcon name="menu" />
        </button>
        <p class="ws-breadcrumb">
          <span>{{ isAdmin ? "Studio" : "Client portal" }}</span><span
            aria-hidden="true"
            >/</span
          >{{ sectionTitle }}
        </p>
        <div class="ws-topbar-actions">
          <NuxtLink to="/" class="ws-site-link">View website</NuxtLink
          ><button
            type="button"
            class="ws-signout"
            aria-label="Sign out"
            @click="auth.signOut()"
          >
            <WorkspaceIcon name="logout" /><span>Sign out</span>
          </button>
        </div>
      </header>
      <main id="main" class="ws-main" tabindex="-1">
        <div
          v-if="notice"
          class="ws-notice"
          :class="{ 'is-error': noticeIsError }"
          :role="noticeIsError ? 'alert' : 'status'"
        >
          <WorkspaceIcon :name="noticeIsError ? 'close' : 'check'" /><span>{{
            notice
          }}</span
          ><button aria-label="Dismiss notification" @click="notice = ''">
            <WorkspaceIcon name="close" />
          </button>
        </div>
        <div class="ws-page-heading">
          <div>
            <p class="ws-kicker">
              {{ isAdmin ? "STUDIO DASHBOARD" : "CLIENT PORTAL" }}
            </p>
            <h1>
              {{
                section === "overview"
                  ? isAdmin
                    ? "Your studio, at a glance."
                    : `Good to see you${user?.firstName ? ", " + user.firstName : ""}.`
                  : sectionTitle
              }}
            </h1>
            <p>
              {{
                section === "overview"
                  ? isAdmin
                    ? "The conversations, commissions, and work that matter today."
                    : "Your projects, shared images, and next steps. All together."
                  : pageIntro
              }}
            </p>
          </div>
          <button
            v-if="isAdmin && section === 'projects'"
            class="ws-button ws-button-primary"
            @click="open('project')"
          >
            <WorkspaceIcon name="plus" />New project
          </button>
          <button
            v-else-if="isAdmin && section === 'clients'"
            class="ws-button ws-button-primary"
            @click="open('client')"
          >
            <WorkspaceIcon name="plus" />Add client
          </button>
          <button
            v-else-if="isAdmin && section === 'portfolio'"
            class="ws-button ws-button-primary"
            @click="open('work')"
          >
            <WorkspaceIcon name="plus" />Add work
          </button>
          <button
            v-else-if="isAdmin && section === 'files'"
            class="ws-button ws-button-primary"
            :disabled="!data.projects.length"
            @click="open('file')"
          >
            <WorkspaceIcon name="plus" />Share file
          </button>
          <button
            v-else-if="!isAdmin && ['overview', 'enquiries'].includes(section)"
            class="ws-button ws-button-primary"
            @click="open('new-enquiry')"
          >
            <WorkspaceIcon name="plus" />New enquiry
          </button>
        </div>

        <div
          v-if="error && section !== 'settings'"
          class="ws-error"
          role="alert"
        >
          <h2>We couldn't load your workspace.</h2>
          <p>{{ error }}</p>
          <button
            class="ws-button"
            :disabled="loading"
            @click="workspace.load()"
          >
            Try again
          </button>
        </div>
        <div
          v-else-if="
            loading &&
            !data.projects.length &&
            !data.enquiries.length &&
            !data.clients.length &&
            !data.works.length &&
            section !== 'settings'
          "
          class="ws-loading"
          role="status"
        >
          <span class="ws-spinner" />Loading your workspace…
        </div>
        <template v-else-if="section === 'overview'">
          <div class="ws-metrics">
            <button class="ws-metric" @click="go('projects')">
              <span>Active projects<WorkspaceIcon name="projects" /></span
              ><strong>{{ activeProjects.length }}</strong
              ><small
                >{{
                  data.projects.filter((p) => p.status === "review").length
                }}
                ready for review</small
              >
            </button>
            <button class="ws-metric" @click="go('enquiries')">
              <span>Open enquiries<WorkspaceIcon name="enquiries" /></span
              ><strong>{{ openEnquiries.length }}</strong
              ><small>{{
                isAdmin
                  ? `${data.enquiries.filter((e) => e.status === "new").length} awaiting a first response`
                  : "Conversations with the studio"
              }}</small>
            </button>
            <button class="ws-metric" @click="go('files')">
              <span>Shared files<WorkspaceIcon name="files" /></span
              ><strong>{{ data.files.length }}</strong
              ><small>Images and project deliveries</small>
            </button>
            <button v-if="isAdmin" class="ws-metric" @click="go('portfolio')">
              <span>Published work<WorkspaceIcon name="portfolio" /></span
              ><strong>{{
                data.works.filter((w) => w.published).length
              }}</strong
              ><small
                >{{ data.works.filter((w) => !w.published).length }} saved as
                drafts</small
              >
            </button>
          </div>
          <div class="ws-overview-grid">
            <section class="ws-panel">
              <div class="ws-panel-heading">
                <div>
                  <p class="ws-kicker">IN THE MAKING</p>
                  <h2>Current projects</h2>
                </div>
                <button class="ws-inline-button" @click="go('projects')">
                  View all
                </button>
              </div>
              <div v-if="!activeProjects.length" class="ws-empty">
                <span class="ws-empty-icon"
                  ><WorkspaceIcon name="projects"
                /></span>
                <h3>
                  {{
                    isAdmin
                      ? "Make room for the next idea."
                      : "Your next project starts here."
                  }}
                </h3>
                <p>
                  {{
                    isAdmin
                      ? "Add a client, then create a commission to keep everyone in the loop."
                      : "Once a commission begins, its progress and next steps will appear here."
                  }}
                </p>
                <button
                  class="ws-button"
                  @click="
                    isAdmin
                      ? open(data.clients.length ? 'project' : 'client')
                      : open('new-enquiry')
                  "
                >
                  {{
                    isAdmin
                      ? data.clients.length
                        ? "Start a project"
                        : "Add your first client"
                      : "Send an enquiry"
                  }}
                </button>
              </div>
              <div v-else class="ws-project-list">
                <button
                  v-for="project in activeProjects.slice(0, 4)"
                  :key="project.id"
                  class="ws-project-row"
                  @click="open('project', project)"
                >
                  <div>
                    <span class="ws-status" :data-status="project.status">{{
                      statusLabel(project.status)
                    }}</span>
                    <h3>{{ project.title }}</h3>
                    <p>
                      {{
                        project.next_step || "Next steps will be shared here."
                      }}
                    </p>
                  </div>
                  <span class="ws-project-date">{{
                    date(project.due_date)
                  }}</span>
                </button>
              </div>
            </section>
            <section class="ws-panel">
              <div class="ws-panel-heading">
                <div>
                  <p class="ws-kicker">THE CONVERSATION</p>
                  <h2>Recent enquiries</h2>
                </div>
                <button class="ws-inline-button" @click="go('enquiries')">
                  View all
                </button>
              </div>
              <div
                v-if="!data.enquiries.length"
                class="ws-empty ws-empty-compact"
              >
                <span class="ws-empty-icon"
                  ><WorkspaceIcon name="enquiries"
                /></span>
                <h3>No enquiries yet.</h3>
                <p>
                  {{
                    isAdmin
                      ? "Requests from the website will arrive here, ready for your attention."
                      : "Have a photographic commission or a collaboration in mind? Let’s talk."
                  }}
                </p>
              </div>
              <button
                v-for="enquiry in data.enquiries.slice(0, 4)"
                :key="enquiry.id"
                class="ws-enquiry-preview"
                @click="open('enquiry', enquiry)"
              >
                <div>
                  <strong>{{
                    isAdmin ? enquiry.name : enquiry.interest
                  }}</strong><span
                    class="ws-status"
                    :data-status="enquiry.status"
                    >{{ statusLabel(enquiry.status) }}</span
                  >
                </div>
                <p>{{ enquiry.message }}</p>
                <small>{{ date(enquiry.created_at) }}</small>
              </button>
            </section>
          </div>
          <div class="ws-bottom-note">
            <span class="ws-brand-mark">ko.</span>
            <p>
              A considered approach. From first conversation to final frame.
            </p>
            <NuxtLink to="/">Explore the exhibition</NuxtLink>
          </div>
        </template>

        <template v-else-if="section !== 'settings'">
          <div class="ws-toolbar">
            <label class="ws-search"
              ><WorkspaceIcon name="search" /><span class="sr-only"
                >Search {{ sectionTitle }}</span
              ><input
                v-model="search"
                type="search"
                :placeholder="`Search ${section === 'files' ? 'files' : section}…`" /></label
            ><label
              v-if="
                ['projects', 'enquiries', 'portfolio', 'files'].includes(
                  section,
                )
              "
              class="ws-filter"
              ><span class="sr-only">Filter {{ sectionTitle }}</span
              ><select v-model="filter">
                <option value="">
                  {{ section === "files" ? "All projects" : "All statuses" }}
                </option>
                <template v-if="section === 'projects'"
                  ><option value="planning">Planning</option>
                  <option value="in_progress">In progress</option>
                  <option value="review">In review</option>
                  <option value="completed">Completed</option></template
                ><template v-if="section === 'enquiries'"
                  ><option value="new">New</option>
                  <option value="in_progress">In progress</option>
                  <option value="closed">Closed</option></template
                ><template v-if="section === 'portfolio'"
                  ><option value="published">Published</option>
                  <option value="draft">Drafts</option></template
                ><template v-if="section === 'files'"
                  ><option
                    v-for="project in data.projects"
                    :key="project.id"
                    :value="project.id"
                  >
                    {{ project.title }}
                  </option></template
                >
              </select></label
            >
          </div>
          <div v-if="section === 'projects'" class="ws-card-grid">
            <article
              v-for="project in projects"
              :key="project.id"
              class="ws-project-card"
            >
              <div class="ws-card-top">
                <span class="ws-status" :data-status="project.status">{{
                  statusLabel(project.status)
                }}</span><button
                  v-if="isAdmin"
                  class="ws-inline-button"
                  @click="open('project', project)"
                >
                  Edit
                </button>
              </div>
              <p v-if="isAdmin" class="ws-card-client">
                {{ clientName(project.client_id) }}
              </p>
              <h2>{{ project.title }}</h2>
              <p class="ws-card-description">
                {{
                  project.description || "Project details will be shared here."
                }}
              </p>
              <div class="ws-next-step">
                <span class="ws-small-label">NEXT STEP</span>
                <p>
                  {{
                    project.next_step ||
                    "The studio will share the next step shortly."
                  }}
                </p>
              </div>
              <div class="ws-card-footer">
                <span
                  ><WorkspaceIcon name="calendar" />{{
                    date(project.due_date)
                  }}</span
                ><button
                  class="ws-inline-button"
                  @click="go('files', project.id)"
                >
                  {{
                    data.files.filter((f) => f.project_id === project.id).length
                  }}
                  files
                </button>
              </div>
            </article>
            <div v-if="!projects.length" class="ws-empty ws-full-empty">
              <WorkspaceIcon name="projects" />
              <h2>
                {{
                  search || filter
                    ? "No matching projects."
                    : "A new commission starts here."
                }}
              </h2>
              <p>
                {{
                  search || filter
                    ? "Try another search or status."
                    : isAdmin
                      ? "Create a project to share progress and files with a client."
                      : "Your commissions will appear here once the studio gets started."
                }}
              </p>
              <button
                v-if="isAdmin && !search && !filter"
                class="ws-button"
                @click="open('project')"
              >
                Create project
              </button>
            </div>
          </div>
          <section
            v-else-if="section === 'enquiries'"
            class="ws-panel ws-table-panel"
          >
            <div class="ws-table-scroll">
              <table v-if="enquiries.length" class="ws-table">
                <thead>
                  <tr>
                    <th>{{ isAdmin ? "Client / enquiry" : "Enquiry" }}</th>
                    <th>Status</th>
                    <th>Received</th>
                    <th><span class="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="enquiry in enquiries" :key="enquiry.id">
                    <td>
                      <strong>{{
                        isAdmin ? enquiry.name : enquiry.interest
                      }}</strong><span>{{
                        isAdmin
                          ? enquiry.interest
                          : enquiry.message.slice(0, 95)
                      }}</span>
                    </td>
                    <td>
                      <span class="ws-status" :data-status="enquiry.status">{{
                        statusLabel(enquiry.status)
                      }}</span>
                    </td>
                    <td class="ws-nowrap">{{ date(enquiry.created_at) }}</td>
                    <td>
                      <button
                        class="ws-inline-button"
                        @click="open('enquiry', enquiry)"
                      >
                        View enquiry
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="!enquiries.length" class="ws-empty ws-full-empty">
              <WorkspaceIcon name="enquiries" />
              <h2>
                {{
                  search || filter
                    ? "No matching enquiries."
                    : "Every project begins with a conversation."
                }}
              </h2>
              <p>
                {{
                  search || filter
                    ? "Try another search or status."
                    : isAdmin
                      ? "New website enquiries will appear in this inbox."
                      : "Send an idea to the studio and keep track of it here."
                }}
              </p>
            </div>
          </section>
          <section
            v-else-if="section === 'clients'"
            class="ws-panel ws-table-panel"
          >
            <div class="ws-table-scroll">
              <table v-if="clients.length" class="ws-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Company</th>
                    <th>Projects</th>
                    <th><span class="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="client in clients" :key="client.id">
                    <td>
                      <strong>{{ client.name }}</strong><a
                        :href="`mailto:${client.email}`"
                        >{{ client.email }}</a
                      >
                    </td>
                    <td>{{ client.company || "—" }}</td>
                    <td>
                      {{
                        data.projects.filter((p) => p.client_id === client.id)
                          .length
                      }}
                    </td>
                    <td>
                      <button
                        class="ws-inline-button"
                        @click="open('client', client)"
                      >
                        Edit client
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="!clients.length" class="ws-empty ws-full-empty">
              <WorkspaceIcon name="clients" />
              <h2>
                {{
                  search
                    ? "No matching clients."
                    : "Good work starts with good people."
                }}
              </h2>
              <p>
                {{
                  search
                    ? "Try another name or email."
                    : "Add a client using the email they use to sign in to their portal."
                }}
              </p>
              <button v-if="!search" class="ws-button" @click="open('client')">
                Add client
              </button>
            </div>
          </section>
          <div v-else-if="section === 'files'" class="ws-file-grid">
            <article v-for="file in files" :key="file.id" class="ws-file-card">
              <div class="ws-file-type">
                <WorkspaceIcon
                  :name="
                    file.mime_type.startsWith('image/') ? 'portfolio' : 'files'
                  "
                /><span>{{
                  file.mime_type.startsWith("image/")
                    ? "IMAGE"
                    : file.name.split(".").pop()?.toUpperCase() || "FILE"
                }}</span>
              </div>
              <h2>{{ file.name }}</h2>
              <p>{{ projectName(file.project_id) }}</p>
              <div class="ws-file-meta">
                <span>{{ fileSize(file.size) }}</span><span>{{
                  date(file.created_at)
                }}</span>
              </div>
              <button
                v-if="file.mime_type.startsWith('image/')"
                class="ws-button ws-file-preview-button"
                :disabled="downloading === file.id"
                @click="preview(file)"
              >
                <WorkspaceIcon name="portfolio" />View image
              </button>
              <button
                class="ws-button"
                :disabled="downloading === file.id"
                @click="download(file)"
              >
                <WorkspaceIcon name="download" />{{
                  downloading === file.id ? "Opening…" : "Download file"
                }}
              </button>
            </article>
            <div v-if="!files.length" class="ws-empty ws-full-empty">
              <WorkspaceIcon name="files" />
              <h2>
                {{
                  search || filter
                    ? "No files here yet."
                    : "The final frame deserves its own space."
                }}
              </h2>
              <p>
                {{
                  isAdmin
                    ? data.projects.length
                      ? "Share an image, PDF, or ZIP with a project’s client."
                      : "Create a project first, then share its images and final files."
                    : "When the studio shares your images or final files, you’ll find them here."
                }}
              </p>
            </div>
          </div>
          <div v-else-if="section === 'portfolio'" class="ws-portfolio-grid">
            <article v-for="work in works" :key="work.id" class="ws-work-card">
              <div class="ws-work-image">
                <img
                  :src="work.image_url"
                  :alt="work.alt"
                  loading="lazy"
                /><span
                  class="ws-status"
                  :data-status="work.published ? 'completed' : 'planning'"
                  >{{ work.published ? "Published" : "Draft" }}</span
                >
              </div>
              <div class="ws-work-info">
                <p class="ws-small-label">{{ work.discipline }}</p>
                <h2>{{ work.title }}</h2>
                <div>
                  <span>Position {{ work.sort_order + 1 }}</span
                  ><button class="ws-inline-button" @click="open('work', work)">
                    Edit work
                  </button>
                </div>
              </div>
            </article>
            <div v-if="!works.length" class="ws-empty ws-full-empty">
              <WorkspaceIcon name="portfolio" />
              <h2>
                {{
                  search || filter
                    ? "No matching work."
                    : "Give your work a place to live."
                }}
              </h2>
              <p>
                {{
                  search || filter
                    ? "Try another title or status."
                    : "Add a photograph, tell its story, and publish it to the gallery."
                }}
              </p>
              <button
                v-if="!search && !filter"
                class="ws-button"
                @click="open('work')"
              >
                Add your first work
              </button>
            </div>
          </div>
        </template>

        <div v-else class="ws-settings-grid">
          <form
            class="ws-panel ws-settings-panel"
            @submit.prevent="updateSettings('profile')"
          >
            <h2>Personal details</h2>
            <p>Your name appears in your studio conversations.</p>
            <div class="ws-form-grid">
              <label
                >First name<input
                  v-model="profileForm.firstName"
                  required
                  maxlength="100"
                  autocomplete="given-name" /></label
              ><label
                >Last name<input
                  v-model="profileForm.lastName"
                  maxlength="100"
                  autocomplete="family-name"
              /></label>
            </div>
            <label
              >Email address<input
                :value="user?.email || ''"
                readonly
                type="email"
            /></label>
            <p class="ws-help">
              Your email connects this account to your client records.
            </p>
            <button
              class="ws-button ws-button-primary"
              :disabled="!!settingsBusy"
            >
              {{ settingsBusy === "profile" ? "Saving…" : "Save details" }}
            </button>
          </form>
          <form
            class="ws-panel ws-settings-panel"
            @submit.prevent="updateSettings('password')"
          >
            <h2>Change password</h2>
            <p>Choose a strong password you don’t use elsewhere.</p>
            <label
              >Current password<input
                v-model="passwordForm.currentPassword"
                type="password"
                required
                maxlength="128"
                autocomplete="current-password" /></label
            ><label
              >New password<input
                v-model="passwordForm.newPassword"
                type="password"
                required
                minlength="8"
                maxlength="128"
                autocomplete="new-password"
            /></label>
            <p class="ws-help">At least 8 characters.</p>
            <button class="ws-button" :disabled="!!settingsBusy">
              {{
                settingsBusy === "password" ? "Updating…" : "Update password"
              }}
            </button>
          </form>
          <p v-if="settingsError" class="ws-form-error" role="alert">
            {{ settingsError }}
          </p>
        </div>
        <footer class="ws-footer">
          <span>Kojo Appiah Oppong</span><span>Photography & fine art</span>
        </footer>
      </main>
    </div>

    <dialog
      ref="previewDialog"
      class="ws-dialog ws-image-dialog"
      aria-labelledby="ws-image-title"
      @close="closePreview"
      @keydown="keepDialogFocus"
      @click="$event.target === previewDialog && previewDialog?.close()"
    >
      <div class="ws-dialog-content">
        <div class="ws-dialog-heading">
          <div>
            <p class="ws-kicker">PROJECT IMAGE</p>
            <h2 id="ws-image-title">{{ previewFile?.name }}</h2>
          </div>
          <button
            type="button"
            class="ws-icon-button"
            aria-label="Close image"
            @click="previewDialog?.close()"
          >
            <WorkspaceIcon name="close" />
          </button>
        </div>
        <p v-if="previewFailed" class="ws-form-error" role="alert">
          This image could not be loaded. Close it and try opening it again.
        </p>
        <img
          v-else-if="previewUrl"
          class="ws-preview-image"
          :src="previewUrl"
          :alt="previewFile?.name || 'Project image'"
          @error="previewFailed = true"
        />
        <div class="ws-dialog-actions">
          <button
            type="button"
            class="ws-button"
            @click="previewDialog?.close()"
          >
            Close image</button
          ><button
            v-if="previewFile"
            class="ws-button ws-button-primary"
            :disabled="!!downloading"
            @click="download(previewFile)"
          >
            <WorkspaceIcon name="download" />Download image
          </button>
        </div>
      </div>
    </dialog>
    <dialog
      ref="dialog"
      class="ws-dialog"
      aria-labelledby="ws-dialog-title"
      @close="afterClose"
      @cancel="busy && $event.preventDefault()"
      @keydown="keepDialogFocus"
      @click="$event.target === dialog && close()"
    >
      <div class="ws-dialog-content">
        <div class="ws-dialog-heading">
          <div>
            <p class="ws-kicker">{{ isAdmin ? "STUDIO" : "YOUR WORKSPACE" }}</p>
            <h2 id="ws-dialog-title">{{ editorTitle }}</h2>
          </div>
          <button
            type="button"
            class="ws-icon-button"
            aria-label="Close dialog"
            :disabled="busy"
            @click="close()"
          >
            <WorkspaceIcon name="close" />
          </button>
        </div>
        <form v-if="editor" class="ws-form" @submit.prevent="save">
          <template v-if="editor === 'client'"
            ><p class="ws-help">
              Use the email address this client will sign in with. Their
              projects are linked automatically after sign-in.
            </p>
            <label
              >Full name<input
                v-model="clientForm.name"
                required
                maxlength="120"
                autocomplete="name" /></label
            ><label
              >Email address<input
                v-model="clientForm.email"
                required
                type="email"
                maxlength="254"
                autocomplete="email" /></label
            ><label
              >Company <span class="ws-optional">optional</span
              ><input
                v-model="clientForm.company"
                maxlength="160"
                autocomplete="organization" /></label
          ></template>
          <template v-if="editor === 'project'"
            ><label
              >Project title<input
                v-model="projectForm.title"
                required
                maxlength="160"
                :readonly="!isAdmin" /></label
            ><label v-if="isAdmin"
              >Client<select v-model="projectForm.client_id" required>
                <option value="" disabled>Choose a client</option>
                <option
                  v-for="client in data.clients"
                  :key="client.id"
                  :value="client.id"
                >
                  {{ client.name }} — {{ client.email }}
                </option>
              </select></label
            >
            <p v-if="isAdmin && !data.clients.length" class="ws-help">
              Add a client before creating a project.
              <button
                type="button"
                class="ws-inline-button"
                @click="
                  dialog?.close();
                  go('clients');
                "
              >
                Go to clients
              </button>
            </p>
            <label
              >Description<textarea
                v-model="projectForm.description"
                rows="3"
                maxlength="4000"
                :readonly="!isAdmin"
              />
            </label>
            <div class="ws-form-grid">
              <label
                >Stage<select v-model="projectForm.status" :disabled="!isAdmin">
                  <option value="planning">Planning</option>
                  <option value="in_progress">In progress</option>
                  <option value="review">In review</option>
                  <option value="completed">Completed</option>
                </select></label
              ><label
                >Target date <span class="ws-optional">optional</span
                ><input
                  v-model="projectForm.due_date"
                  type="date"
                  :readonly="!isAdmin"
              /></label>
            </div>
            <label
              >Next step<textarea
                v-model="projectForm.next_step"
                rows="2"
                maxlength="1000"
                :readonly="!isAdmin"
                placeholder="What should happen next?"
              /></label
          ></template>
          <template v-if="editor === 'enquiry'"
            ><div class="ws-enquiry-details">
              <span class="ws-status" :data-status="enquiryForm.status">{{
                statusLabel(enquiryForm.status)
              }}</span>
              <h3>{{ enquiryForm.interest }}</h3>
              <p>
                {{ enquiryForm.name }}<br /><a
                  :href="`mailto:${enquiryForm.email}`"
                  >{{ enquiryForm.email }}</a
                >
              </p>
              <div class="ws-message-body">{{ enquiryForm.message }}</div>
            </div>
            <template v-if="isAdmin"
              ><label
                >Status<select v-model="enquiryForm.status">
                  <option value="new">New</option>
                  <option value="in_progress">In progress</option>
                  <option value="closed">Closed</option>
                </select></label
              ><label
                >Private studio notes<textarea
                  v-model="enquiryForm.internal_notes"
                  rows="4"
                  maxlength="4000"
                  placeholder="Follow-ups, context, and things to remember…"
                />
              </label>
              <p class="ws-help">
                These notes are only visible to studio administrators.
              </p>
              <a
                class="ws-inline-button"
                :href="`mailto:${enquiryForm.email}?subject=${encodeURIComponent('Re: ' + enquiryForm.interest)}`"
                >Reply by email</a
              ></template
            ></template
          >
          <template v-if="editor === 'new-enquiry'"
            ><p class="ws-help">
              Tell us a little about your idea. The studio will follow up with
              you by email.
            </p>
            <div class="ws-form-grid">
              <label
                >Your name<input
                  v-model="enquiryForm.name"
                  required
                  maxlength="120"
                  autocomplete="name" /></label
              ><label
                >Email address<input
                  v-model="enquiryForm.email"
                  type="email"
                  readonly
                  required
                  autocomplete="email"
              /></label>
            </div>
            <label
              >I'm interested in<select v-model="enquiryForm.interest">
                <option>A photographic commission</option>
                <option>Fine art and exhibitions</option>
                <option>A creative collaboration</option>
                <option>Something else</option>
              </select></label
            ><label
              >Your idea<textarea
                v-model="enquiryForm.message"
                required
                rows="5"
                maxlength="4000"
                placeholder="The vision, the occasion, a possible timeline…"
              /></label
          ></template>
          <template v-if="editor === 'work'"
            ><label
              >Title<input v-model="workForm.title" required maxlength="160"
            /></label>
            <div class="ws-form-grid">
              <label
                >Discipline<select v-model="workForm.discipline">
                  <option>Fine art</option>
                  <option>Architecture</option>
                  <option>Fashion</option>
                  <option>Advertising</option>
                </select></label
              ><label
                >Display position<input
                  v-model.number="workForm.sort_order"
                  type="number"
                  min="0"
                  max="9999"
                  required
              /></label>
            </div>
            <label
              >{{ workForm.image_url ? "Replace photograph" : "Photograph"
              }}<input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                :required="!workForm.image_url"
                @change="pickFile"
            /></label>
            <p class="ws-help">
              JPEG, PNG, or WebP. Up to 15 MB. Display positions start at 0.
            </p>
            <img
              v-if="workForm.image_url"
              class="ws-editor-image"
              :src="workForm.image_url"
              :alt="workForm.alt || 'Current photograph'"
            /><label
              >Image description<input
                v-model="workForm.alt"
                required
                maxlength="500"
                placeholder="Describe the photograph for someone who cannot see it." /></label
            ><label
              >About the work<textarea
                v-model="workForm.description"
                rows="3"
                maxlength="4000"
              /></label
            ><label class="ws-checkbox"
              ><input v-model="workForm.published" type="checkbox" /><span
                >Publish to the website<small
                  >Leave unchecked to save as a draft.</small
                ></span
              ></label
            ></template
          >
          <template v-if="editor === 'file'"
            ><p class="ws-help">
              Files are private to the studio and the client assigned to this
              project.
            </p>
            <label
              >Project<select v-model="fileForm.project_id" required>
                <option value="" disabled>Choose a project</option>
                <option
                  v-for="project in data.projects"
                  :key="project.id"
                  :value="project.id"
                >
                  {{ project.title }}
                </option>
              </select></label
            ><label
              >File<input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,application/zip,.zip"
                required
                @change="pickFile"
            /></label>
            <p class="ws-help">
              JPEG, PNG, WebP, PDF, or ZIP. Up to 15 MB.
            </p></template
          >
          <p v-if="actionError" class="ws-form-error" role="alert">
            {{ actionError }}
          </p>
          <div class="ws-dialog-actions">
            <button
              type="button"
              class="ws-button"
              :disabled="busy"
              @click="close()"
            >
              {{
                !isAdmin && ["project", "enquiry"].includes(editor)
                  ? "Close"
                  : "Cancel"
              }}</button><button
              v-if="isAdmin || !['project', 'enquiry'].includes(editor)"
              type="submit"
              class="ws-button ws-button-primary"
              :disabled="busy || (editor === 'project' && !data.clients.length)"
            >
              {{
                busy
                  ? "Saving…"
                  : editor === "new-enquiry"
                    ? "Send enquiry"
                    : editor === "file"
                      ? "Share file"
                      : "Save changes"
              }}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  </div>
</template>
