import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { getUser } from "../api/authApi";
import type { PortalRole } from "../api/authApi";

/* ==========================================================================
   Route guards built on authApi.

   <ProtectedRoute>                       any signed-in user
   <ProtectedRoute roles={["TEACHER"]}>   only those roles
   <PublicOnlyRoute>                      login page: signed-in users are sent to their home

   Works two ways:
     1) Layout route:   <Route element={<ProtectedRoute roles={[...]} />}> ...children... </Route>
     2) Wrapper:        <ProtectedRoute roles={[...]}><Page /></ProtectedRoute>

   Rules, in order:
     - no valid token (missing or expired)  -> /login, remembering where the person was going
     - must_change_password is true         -> /change-password (nothing else is reachable)
     - role not allowed                     -> that role's own home page
   ========================================================================== */

export const LOGIN_PATH = "/auth/Login";
export const CHANGE_PASSWORD_PATH = "/auth/ChangePassword";

/**
 * Where each role lands. A role's home must always be a route that role is allowed
 * to open, otherwise the guard would redirect in a loop.
 * There is no parent dashboard yet, so PARENT uses the learner pages.
 */
export const HOME_BY_ROLE: Record<PortalRole, string> = {
  HOI: "/Hoi/Dashboard",
  DEPUTY: "/Hoi/Dashboard",
  TEACHER: "/Teacher/Dashboard",
  FINANCE: "/Finances/Dashboard",
  LEARNER: "/Learner/Dashboard",
  PARENT: "/Learner/Dashboard",
};

export const homeFor = (role: PortalRole): string => HOME_BY_ROLE[role] ?? LOGIN_PATH;

interface ProtectedRouteProps {
  roles?: PortalRole[];
  children?: ReactNode;
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const location = useLocation();
  const user = getUser(); // null when signed out or the token has expired (and clears it)

  if (!user) {
    return <Navigate to={LOGIN_PATH} replace state={{ from: location.pathname + location.search }} />;
  }

  const onChangePage = location.pathname === CHANGE_PASSWORD_PATH;
  if (user.must_change_password && !onChangePage) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  if (roles && !roles.includes(user.role) && !(onChangePage && user.must_change_password)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}

export function PublicOnlyRoute({ children }: { children?: ReactNode }) {
  const user = getUser();
  if (user) {
    return <Navigate to={user.must_change_password ? CHANGE_PASSWORD_PATH : homeFor(user.role)} replace />;
  }
  return <>{children ?? <Outlet />}</>;
}

/**
 * After a successful login, send the person back to the page they asked for,
 * unless the backend's redirect is more specific (e.g. forced password change).
 *
 *   const from = (location.state as { from?: string } | null)?.from;
 *   navigate(result.user.must_change_password ? result.redirect : from ?? result.redirect, { replace: true });
 */