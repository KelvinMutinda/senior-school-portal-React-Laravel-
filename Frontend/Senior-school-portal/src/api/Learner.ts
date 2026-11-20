// Put this at src/api/learners.ts
// Adjust the import path below to wherever RegisterLearner.tsx lives in your project.
import type { LearnerForm } from "../Hoi/RegisterLearner";

// Vite projects read VITE_API_URL from .env; the fallback is `php artisan serve`.
const API = (import.meta as any).env?.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;
  constructor(message: string, status: number, errors: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

const SIMPLE_FIELDS = [
  "firstName", "middleName", "surname", "gender", "dateOfBirth", "nationality", "birthCertNo", "upi",
  "admissionNo", "admissionDate", "grade", "stream", "pathway", "residence",
  "previousSchool", "kjseaIndexNo", "kjseaPerformance",
  "emergencyName", "emergencyPhone", "medicalConditions", "allergies", "specialNeeds",
] as const;

export async function registerLearner(form: LearnerForm) {
  const fd = new FormData();

  SIMPLE_FIELDS.forEach((k) => fd.append(k, String(form[k] ?? "")));
  form.subjects.forEach((s) => fd.append("subjects[]", s));

  (["primaryGuardian", "secondaryGuardian"] as const).forEach((who) => {
    Object.entries(form[who]).forEach(([k, v]) => fd.append(`${who}[${k}]`, String(v ?? "")));
  });

  // Laravel reads "1" and "0" as booleans.
  fd.append("consentDataUse", form.consentDataUse ? "1" : "0");
  fd.append("consentAi", form.consentAi ? "1" : "0");
  fd.append("consentPhoto", form.consentPhoto ? "1" : "0");

  if (form.photo) fd.append("photo", form.photo);

  // Do not set Content-Type: the browser adds the multipart boundary itself.
  const res = await fetch(`${API}/learners`, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: fd,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const errors: Record<string, string[]> = body?.errors ?? {};
    const first = Object.values(errors)[0]?.[0];
    throw new ApiError(first ?? body?.message ?? "Could not register the learner.", res.status, errors);
  }

  return body as { message: string; learner: { id: number; admission_no: string; name: string } };
}