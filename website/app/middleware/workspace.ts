export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;
  const auth = useStudioAuth();
  await auth.initialize(true);
  if (!auth.user.value) return navigateTo("/login", { replace: true });
  if (to.meta.workspaceRole === "admin" && !auth.isAdmin.value) return navigateTo("/portal", { replace: true });
  if (to.meta.workspaceRole === "client" && auth.isAdmin.value) return navigateTo("/studio", { replace: true });
});
