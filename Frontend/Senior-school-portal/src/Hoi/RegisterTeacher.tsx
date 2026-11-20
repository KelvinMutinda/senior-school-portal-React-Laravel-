import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "./HoiDashboard";
import { toast } from "../components/Toast";
import { registerTeacher, ApiValidationError } from "../api/teachers";

export type Gender = "Female" | "Male" | "";
export type EmploymentType = "TSC Permanent" | "TSC Contract" | "BOM Employed" | "Intern / Attachment" | "";

export interface TeacherForm {
  firstName: string;
  middleName: string;
  surname: string;
  gender: Gender;
  dateOfBirth: string;
  nationalId: string;
  nationality: string;
  maritalStatus: string;
  phone: string;
  altPhone: string;
  email: string;
  address: string;
  photo: File | null;
  // Employment
  staffNo: string;
  tscNo: string;
  kraPin: string;
  nssfNo: string;
  shaNo: string;
  employmentType: EmploymentType;
  dateOfEmployment: string;
  designation: string;
  jobGroup: string;
  department: string;
  // Qualifications
  highestQualification: string;
  institution: string;
  graduationYear: string;
  specialization: string;
  certificates: File[];

  teachingSubjects: string[];
  grades: string[];
  classTeacherOf: string;
  isHod: boolean;

  kinName: string;
  kinRelationship: string;
  kinPhone: string;

  sendLogin: boolean;
  consentDataUse: boolean;
}

type Errors = Record<string, string>;

interface Props {
  /** Optional override (tests, previews). By default the form posts to the Laravel API. */
  onSubmit?: (data: TeacherForm) => void | Promise<void>;
}

const initialForm: TeacherForm = {
  firstName: "",
  middleName: "",
  surname: "",
  gender: "",
  dateOfBirth: "",
  nationalId: "",
  nationality: "Kenyan",
  maritalStatus: "",
  phone: "",
  altPhone: "",
  email: "",
  address: "",
  photo: null,
  staffNo: "",
  tscNo: "",
  kraPin: "",
  nssfNo: "",
  shaNo: "",
  employmentType: "",
  dateOfEmployment: "",
  designation: "",
  jobGroup: "",
  department: "",
  highestQualification: "",
  institution: "",
  graduationYear: "",
  specialization: "",
  certificates: [],
  teachingSubjects: [],
  grades: [],
  classTeacherOf: "",
  isHod: false,
  kinName: "",
  kinRelationship: "",
  kinPhone: "",
  sendLogin: true,
  consentDataUse: false,
};

const SUBJECTS = [
  "English", "Kiswahili / KSL", "Mathematics", "Biology", "Chemistry", "Physics",
  "Computer Science", "Agriculture", "History & Citizenship", "Geography", "CRE",
  "Business Studies", "Literature in English", "Music", "Fine Art", "Theatre & Film",
  "Sports Science", "Physical Education", "Community Service Learning",
];
const GRADES = ["10", "11", "12"];
const STREAMS = ["A", "B", "C", "D", "E", "F"];
const EMPLOYMENT_TYPES: Exclude<EmploymentType, "">[] = ["TSC Permanent", "TSC Contract", "BOM Employed", "Intern / Attachment"];
const DEPARTMENTS = ["Languages", "Mathematics", "Sciences", "Humanities", "Technical & Applied", "Arts & Sports", "Guidance & Counselling"];
const QUALIFICATIONS = ["Certificate", "Diploma", "Bachelor's degree", "Postgraduate diploma", "Master's degree", "Doctorate"];
const MARITAL = ["Single", "Married", "Divorced", "Widowed"];
const RELATIONSHIPS = ["Spouse", "Parent", "Sibling", "Child", "Relative", "Friend"];

const phoneOk = (v: string) => /^(?:\+254|0)[17]\d{8}$/.test(v.replace(/\s/g, ""));
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** "Fix N fields" style summary used for both client and server validation failures. */
const summarise = (errs: Errors): string => {
  const messages = Object.values(errs);
  const first = messages[0];
  const more = messages.length - 1;
  return more > 0 ? `${first} (and ${more} more issue${more > 1 ? "s" : ""} below)` : first;
};

/* Field wrapper (kept outside the page component so inputs keep focus while typing) */
function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rl-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && <small className="rl-err" role="alert">{error}</small>}
    </div>
  );
}

/* ---------- Component ---------- */

function RegisterTeacher({ onSubmit }: Props) {
  const [form, setForm] = useState<TeacherForm>(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const photoUrl = useMemo(() => (form.photo ? URL.createObjectURL(form.photo) : null), [form.photo]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  /** Drop a field's error as soon as the user edits it. */
  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });

  const set = <K extends keyof TeacherForm>(key: K, value: TeacherForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    clearError(key);
  };

  const toggle = (key: "teachingSubjects" | "grades", value: string) => {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value],
    }));
    clearError(key);
  };

  const isTsc = form.employmentType.startsWith("TSC");

  const validate = (): Errors => {
    const e: Errors = {};
    const req = (k: string, v: string, msg: string) => { if (!v.trim()) e[k] = msg; };
    req("firstName", form.firstName, "Enter the teacher's first name");
    req("surname", form.surname, "Enter the teacher's surname");
    if (!form.gender) e.gender = "Select a gender";
    req("dateOfBirth", form.dateOfBirth, "Enter the date of birth");
    if (!/^\d{7,8}$/.test(form.nationalId.trim())) e.nationalId = "Enter a valid national ID number (7 or 8 digits)";
    if (!phoneOk(form.phone)) e.phone = "Enter a valid Kenyan phone number, e.g. 0712 345 678";
    if (!emailOk(form.email)) e.email = "Enter a valid email address";
    req("staffNo", form.staffNo, "Enter the staff number");
    if (!form.employmentType) e.employmentType = "Select an employment type";
    if (isTsc) req("tscNo", form.tscNo, "Enter the TSC number");
    req("dateOfEmployment", form.dateOfEmployment, "Enter the date of employment");
    req("designation", form.designation, "Enter the designation");
    if (!form.department) e.department = "Select a department";
    if (!form.highestQualification) e.highestQualification = "Select the highest qualification";
    req("institution", form.institution, "Enter the institution");
    req("specialization", form.specialization, "Enter the area of specialization");
    if (form.teachingSubjects.length < 1) e.teachingSubjects = "Choose at least one teaching subject";
    if (form.grades.length < 1) e.grades = "Choose at least one grade";
    req("kinName", form.kinName, "Enter a next of kin");
    if (!phoneOk(form.kinPhone)) e.kinPhone = "Enter a valid Kenyan phone number";
    if (!form.consentDataUse) e.consentDataUse = "Consent to data use is required";
    return e;
  };

  const focusFirstInvalid = () =>
    // Wait a tick so the error state has rendered and data-invalid is on the DOM.
    setTimeout(() => document.querySelector<HTMLElement>("[data-invalid='true']")?.focus(), 0);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving) return;

    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error(summarise(e));
      focusFirstInvalid();
      return;
    }

    setSaving(true);
    try {
      const name = `${form.firstName} ${form.surname}`.trim();
      let emailSent = true;

      if (onSubmit) {
        await onSubmit(form);
      } else {
        emailSent = (await registerTeacher(form)).login_email_sent;
      }

      toast.success(`${name} has been registered.`);
      if (form.sendLogin && !emailSent) {
        toast.error("The account was created, but the login email could not be sent.");
      }
      setForm(initialForm);
      setErrors({});
    } catch (err) {
      if (err instanceof ApiValidationError && Object.keys(err.errors).length) {
        setErrors(err.errors);
        toast.error(summarise(err.errors));
        focusFirstInvalid();
      } else {
        toast.error(err instanceof Error ? err.message : "Could not register the teacher. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const inv = (k: string) => (errors[k] ? { "data-invalid": "true", "aria-invalid": true } : {});
  const text = (id: keyof TeacherForm, label: string, extra?: { error?: boolean; type?: string; placeholder?: string; hint?: string; req?: boolean }) => (
    <Field id={id} label={`${label}${extra?.req ? " *" : ""}`} error={errors[id]} hint={extra?.hint}>
      <input
        id={id}
        type={extra?.type ?? "text"}
        placeholder={extra?.placeholder}
        value={form[id] as string}
        onChange={(e) => set(id, e.target.value as never)}
        {...inv(id)}
      />
    </Field>
  );
  const select = (id: keyof TeacherForm, label: string, options: string[], req?: boolean) => (
    <Field id={id} label={`${label}${req ? " *" : ""}`} error={errors[id]}>
      <select id={id} value={form[id] as string} onChange={(e) => set(id, e.target.value as never)} {...inv(id)}>
        <option value="">Select</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </Field>
  );

  return (
    <DashboardLayout
      role="HOI"
      user={{ name: "Head of Institution", roleLabel: "HOI" }}
      title="Register Teacher"
    >
      <div className="rl-page">
        <header className="rl-head">
          <h1>Register teacher</h1>
          <p>Add a new teacher to the Senior School Portal. Fields marked * are required.</p>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          {/* 1. Personal */}
          <section className="rl-card">
            <h2>Personal details</h2>
            <div className="rl-photo">
              <div className="rl-avatar">{photoUrl ? <img src={photoUrl} alt="Selected teacher" /> : <span>No photo</span>}</div>
              <div>
                <label htmlFor="photo" className="rl-btn">Upload photo</label>
                <input id="photo" type="file" accept="image/*" hidden {...inv("photo")} onChange={(e) => set("photo", e.target.files?.[0] ?? null)} />
                {errors.photo
                  ? <small className="rl-err" role="alert">{errors.photo}</small>
                  : <small>JPG or PNG, passport style, up to 2 MB.</small>}
              </div>
            </div>
            <div className="rl-grid">
              {text("firstName", "First name", { req: true })}
              {text("middleName", "Middle name")}
              {text("surname", "Surname", { req: true })}
              {select("gender", "Gender", ["Female", "Male"], true)}
              {text("dateOfBirth", "Date of birth", { type: "date", req: true })}
              {text("nationalId", "National ID number", { req: true })}
              {text("nationality", "Nationality")}
              {select("maritalStatus", "Marital status", MARITAL)}
              {text("phone", "Phone", { type: "tel", placeholder: "0712 345 678", req: true })}
              {text("altPhone", "Alternative phone", { type: "tel" })}
              {text("email", "Email", { type: "email", req: true, hint: "Used for portal login details" })}
              {text("address", "Home address / county")}
            </div>
          </section>

          {/* 2. Employment */}
          <section className="rl-card">
            <h2>Employment details</h2>
            <div className="rl-grid">
              {text("staffNo", "Staff number", { req: true })}
              {select("employmentType", "Employment type", EMPLOYMENT_TYPES, true)}
              {text("tscNo", isTsc ? "TSC number" : "TSC number (if any)", { req: isTsc })}
              {text("dateOfEmployment", "Date of employment", { type: "date", req: true })}
              {text("designation", "Designation", { req: true, placeholder: "e.g. Senior Teacher" })}
              {text("jobGroup", "Job group")}
              {select("department", "Department", DEPARTMENTS, true)}
              {text("kraPin", "KRA PIN", { placeholder: "A123456789Z" })}
              {text("nssfNo", "NSSF number")}
              {text("shaNo", "SHA number")}
            </div>
          </section>

          {/* 3. Qualifications */}
          <section className="rl-card">
            <h2>Qualifications</h2>
            <div className="rl-grid">
              {select("highestQualification", "Highest qualification", QUALIFICATIONS, true)}
              {text("institution", "Institution", { req: true })}
              {text("graduationYear", "Year of graduation", { placeholder: "e.g. 2018" })}
              {text("specialization", "Area of specialization", { req: true, placeholder: "e.g. Mathematics and Physics" })}
            </div>
            <div className="rl-photo" style={{ marginTop: 20, marginBottom: 0 }}>
              <div>
                <label htmlFor="certs" className="rl-btn">Upload certificates</label>
                <input id="certs" type="file" accept=".pdf,image/*" multiple hidden {...inv("certificates")} onChange={(e) => set("certificates", Array.from(e.target.files ?? []))} />
                {errors.certificates ? (
                  <small className="rl-err" role="alert">{errors.certificates}</small>
                ) : (
                  <small>
                    {form.certificates.length
                      ? `${form.certificates.length} file${form.certificates.length > 1 ? "s" : ""} selected: ${form.certificates.map((f) => f.name).join(", ")}`
                      : "PDF or image copies of academic and professional certificates (5 MB each)."}
                  </small>
                )}
              </div>
            </div>
          </section>

          {/* 4. Teaching assignment */}
          <section className="rl-card">
            <h2>Teaching assignment</h2>

            <fieldset className="rl-subjects" style={{ marginTop: 0 }} {...(errors.teachingSubjects ? { "data-invalid": "true", tabIndex: -1 } : {})}>
              <legend>Subjects taught *</legend>
              <div className="rl-checks">
                {SUBJECTS.map((s) => (
                  <label key={s} className="rl-check">
                    <input type="checkbox" checked={form.teachingSubjects.includes(s)} onChange={() => toggle("teachingSubjects", s)} />
                    {s}
                  </label>
                ))}
              </div>
              {errors.teachingSubjects && <small className="rl-err" role="alert">{errors.teachingSubjects}</small>}
            </fieldset>

            <fieldset className="rl-subjects" {...(errors.grades ? { "data-invalid": "true", tabIndex: -1 } : {})}>
              <legend>Grades taught *</legend>
              <div className="rl-checks">
                {GRADES.map((g) => (
                  <label key={g} className="rl-check">
                    <input type="checkbox" checked={form.grades.includes(g)} onChange={() => toggle("grades", g)} />
                    Grade {g}
                  </label>
                ))}
              </div>
              {errors.grades && <small className="rl-err" role="alert">{errors.grades}</small>}
            </fieldset>

            <div className="rl-grid" style={{ marginTop: 20 }}>
              <Field id="classTeacherOf" label="Class teacher of" error={errors.classTeacherOf} hint="Leave blank if not a class teacher">
                <select id="classTeacherOf" value={form.classTeacherOf} onChange={(e) => set("classTeacherOf", e.target.value)} {...inv("classTeacherOf")}>
                  <option value="">None</option>
                  {GRADES.flatMap((g) => STREAMS.map((s) => <option key={`${g}${s}`} value={`${g}${s}`}>Grade {g}{s}</option>))}
                </select>
              </Field>
            </div>
            <label className="rl-check" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={form.isHod} onChange={(e) => set("isHod", e.target.checked)} {...inv("isHod")} />
              This teacher is a head of department
            </label>
            {errors.isHod && <small className="rl-err" role="alert">{errors.isHod}</small>}
          </section>

          {/* 5. Next of kin */}
          <section className="rl-card">
            <h2>Next of kin</h2>
            <div className="rl-grid">
              {text("kinName", "Full name", { req: true })}
              {select("kinRelationship", "Relationship", RELATIONSHIPS)}
              {text("kinPhone", "Phone", { type: "tel", req: true })}
            </div>
          </section>

          {/* 6. Portal access & consent */}
          <section className="rl-card">
            <h2>Portal access and consent</h2>
            <label className="rl-check">
              <input type="checkbox" checked={form.sendLogin} onChange={(e) => set("sendLogin", e.target.checked)} />
              Create a Teacher account and email the login details to the address above.
            </label>
            <label className="rl-check">
              <input type="checkbox" checked={form.consentDataUse} onChange={(e) => set("consentDataUse", e.target.checked)} {...inv("consentDataUse")} />
              The teacher agrees that the school may collect and use this information for staff administration. *
            </label>
            {errors.consentDataUse && <small className="rl-err" role="alert">{errors.consentDataUse}</small>}
          </section>

          <div className="rl-actions">
            <button type="button" className="rl-btn" disabled={saving} onClick={() => { setForm(initialForm); setErrors({}); }}>Clear form</button>
            <button type="submit" className="rl-btn rl-primary" disabled={saving}>{saving ? "Saving…" : "Register teacher"}</button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default RegisterTeacher;