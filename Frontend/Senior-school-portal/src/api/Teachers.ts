import type { TeacherForm } from "../Hoi/RegisterTeacher"; // ADJUST path

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api"; // ADJUST if not Vite

export interface RegisterTeacherResult {
  message: string;
  login_email_sent: boolean;
  data: { id: number; staff_no: string; full_name: string; email: string };
}

/** Thrown on HTTP 422. `errors` is keyed by the form's own field names (camelCase). */
export class ApiValidationError extends Error {
  errors: Record<string, string>;
  constructor(message: string, errors: Record<string, string>) {
    super(message);
    this.name = "ApiValidationError";
    this.errors = errors;
  }
}

const toSnake = (s: string) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function buildFormData(form: TeacherForm): FormData {
  const fd = new FormData();

  (Object.keys(form) as (keyof TeacherForm)[]).forEach((k) => {
    const value = form[k];
    const key = toSnake(k);

    if (value === null || value === "") return;

    if (k === "certificates") {
      (value as File[]).forEach((f) => fd.append("certificates[]", f));
    } else if (Array.isArray(value)) {
      value.forEach((v) => fd.append(`${key}[]`, v));
    } else if (typeof value === "boolean") {
      fd.append(key, value ? "1" : "0");
    } else if (value instanceof File) {
      fd.append(key, value);
    } else {
      fd.append(key, String(value));
    }
  });

  return fd;
}

export async function registerTeacher(form: TeacherForm): Promise<RegisterTeacherResult> {
  const token = localStorage.getItem("token"); // ADJUST to wherever your login stores the Sanctum token

  const res = await fetch(`${API_URL}/teachers`, {
    method: "POST",
    headers: {
      Accept: "application/json", // makes Laravel return JSON errors instead of redirects
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // No Content-Type: the browser sets the multipart boundary itself.
    },
    body: buildFormData(form),
  });

  const body = await res.json().catch(() => ({}));

  if (res.status === 422) {
    const errors: Record<string, string> = {};
    Object.entries((body.errors ?? {}) as Record<string, string[]>).forEach(([field, msgs]) => {
      // "teaching_subjects.0" -> "teachingSubjects"
      const key = toCamel(field.replace(/\.\d+$/, ""));
      if (!errors[key]) errors[key] = msgs[0];
    });
    throw new ApiValidationError(body.message ?? "Please correct the highlighted fields.", errors);
  }

  if (res.status === 401) throw new Error("Your session has expired. Please sign in again.");
  if (res.status === 403) throw new Error("You do not have permission to register teachers.");
  if (!res.ok) throw new Error(body.message ?? "Something went wrong on the server. Please try again.");

  return body as RegisterTeacherResult;
}