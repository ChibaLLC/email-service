import { DASHBOARD_LOGGED_IN_COOKIE } from "~~/shared/utils/cookie";

export default defineNuxtRouteMiddleware((to) => {
  const loggedIn = useCookie(DASHBOARD_LOGGED_IN_COOKIE);

  if (loggedIn.value && to.path === "/dashboard/login") {
    return navigateTo("/dashboard");
  }
});
