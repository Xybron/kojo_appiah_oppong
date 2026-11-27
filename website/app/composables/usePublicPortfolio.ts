import { studies as previewStudies, type Study } from "~/data/exhibition";

interface PublishedWork {
  id: string;
  title: string;
  discipline: Study["discipline"];
  image_url: string;
  alt: string;
  description: string;
  width: number;
  height: number;
  sort_order: number;
  published: boolean;
}

/** A configured portfolio never falls back to unpublished demonstration work. */
export function usePublicPortfolio() {
  const config = useRuntimeConfig();
  const apiBase = String(config.public.apiBaseUrl || "").replace(/\/+$/, "");
  const works = useState<Study[]>("public-portfolio", () =>
    apiBase ? [] : [...previewStudies],
  );
  const loading = useState("public-portfolio-loading", () => false);
  const error = useState("public-portfolio-error", () => "");

  async function load() {
    if (!apiBase || loading.value) return;
    loading.value = true;
    error.value = "";
    try {
      const response = await $fetch<{ works: PublishedWork[] }>(
        `${apiBase}/api/v1/portfolio`,
        { timeout: 15000 },
      );
      works.value = response.works
        .filter((work) => work.published)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((work) => ({
          id: work.id,
          title: work.title,
          discipline: work.discipline,
          image: work.image_url,
          alt: work.alt,
          description: work.description,
          width: work.width,
          height: work.height,
        }));
    } catch {
      error.value = "The portfolio is temporarily unavailable. Please try again.";
    } finally {
      loading.value = false;
    }
  }

  onMounted(load);
  return { studies: works, loading, error, load };
}

/** Image sources are public uploads or the existing local image presets. */
export function portfolioImageSource(image: string, size = 1600): string {
  if (/^[a-z0-9-]+$/i.test(image)) return `/images/${image}-${size}.jpg`;
  if (image.startsWith("/") && !image.startsWith("//") && !image.includes("\\"))
    return image;
  try {
    const url = new URL(image);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch {
    // Invalid sources receive the same accessible fallback as failed images.
  }
  return "";
}
