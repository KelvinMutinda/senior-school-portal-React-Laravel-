import { useNavigate } from "react-router-dom";
import LoginPage from "./Login";
import type { LoginCredentials } from "./Login";
import { login, saveSession } from "../api/authApi";

/**
 * Connects the LoginPage form to the Laravel backend.
 * On success it saves the token and goes to the redirect the backend sent
 * (the dashboard for that role, or the change-password page).
 * On failure it throws, and LoginPage shows the message above the form.
 */
export default function LoginRoute() {
  const navigate = useNavigate();

  const handleSubmit = async (credentials: LoginCredentials) => {
    const result = await login(credentials);
    saveSession(result, credentials.remember);
    navigate(result.redirect, { replace: true });
  };

  return <LoginPage onSubmit={handleSubmit} />;
}