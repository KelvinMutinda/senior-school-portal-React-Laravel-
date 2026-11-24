import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { DashboardLayout, type LayoutUser, type Role } from "../Hoi/HoiDashboard";
import { registerLearner, ApiError } from "../api/Learner";
import { toast } from "../components/Toast";

/* ---------- Types ---------- */

export type Gender = "Female" | "Male" | "";
export type Pathway = "STEM" | "Social Sciences" | "Arts & Sports" | "";
export type Residence = "Day" | "Boarding" | "";

export interface Guardian {
  fullName: string;
  relationship: string;
  nationalId: string;
  phone: string;
  altPhone: string;
  email: string;
  occupation: string;
  address: string;
}

export interface LearnerForm {
  // Learner details
  firstName: string;
  middleName: string;
  surname: string;
  gender: Gender;
  dateOfBirth: string;
  nationality: string;
  birthCertNo: string;
  upi: string; // NEMIS Unique Personal Identifier
  photo: File | null;
  // Admission & academic
  admissionNo: string;
  admissionDate: string;
  grade: "10" | "11" | "12" | "";
  stream: string;
  pathway: Pathway;
  subjects: string[];
  residence: Residence;
  previousSchool: string;
  kjseaIndexNo: string;
  kjseaPerformance: string;
  // Guardians
  primaryGuardian: Guardian;
  secondaryGuardian: Guardian;
  // Health & emergency
  emergencyName: string;
  emergencyPhone: string;
  medicalConditions: string;
  allergies: string;
  specialNeeds: string;
  // Consent
  consentDataUse: boolean;
  consentAi: boolean;
  consentPhoto: boolean;
}

type Errors = Record<string, string>;

/** What the API returns on success. Custom onSubmit handlers may return nothing. */
export type SubmitResult =
  | { message?: string; learner?: { id: number; admission_no: string; name: string } }
  | void;

type SubmitFn = (data: LearnerForm) => SubmitResult | Promise<SubmitResult>;

interface Props {
  /** Defaults to the Laravel API call in src/api/learners.ts. */
  onSubmit?: SubmitFn;
  role?: Role; // who is registering the learner (sidebar follows this role)
  user?: LayoutUser;
  onNavigate?: (route: string, key: string) => void;
  onLogout?: () => void;
}

/* ---------- Constants ---------- */

const emptyGuardian: Guardian = {
  fullName: "",
  relationship: "",
  nationalId: "",
  phone: "",
  altPhone: "",
  email: "",
  occupation: "",
  address: "",
};

const initialForm: LearnerForm = {
  firstName: "",
  middleName: "",
  surname: "",
  gender: "",
  dateOfBirth: "",
  nationality: "Kenyan",
  birthCertNo: "",
  upi: "",
  photo: null,
  admissionNo: "",
  admissionDate: "",
  grade: "",
  stream: "",
  pathway: "",
  subjects: [],
  residence: "",
  previousSchool: "",
  kjseaIndexNo: "",
  kjseaPerformance: "",
  primaryGuardian: { ...emptyGuardian },
  secondaryGuardian: { ...emptyGuardian },
  emergencyName: "",
  emergencyPhone: "",
  medicalConditions: "",
  allergies: "",
  specialNeeds: "",
  consentDataUse: false,
  consentAi: false,
  consentPhoto: false,
};

const COMPULSORY = ["English", "Kiswahili / KSL", "Community Service Learning", "Physical Education"];

const ELECTIVES: Record<Exclude<Pathway, "">, string[]> = {
  STEM: ["Mathematics", "Biology", "Chemistry", "Physics", "Computer Science", "Agriculture"],
  "Social Sciences": ["History & Citizenship", "Geography", "CRE", "Business Studies", "Literature in English"],
  "Arts & Sports": ["Music", "Fine Art", "Theatre & Film", "Sports Science"],
};

const GENDERS = ["Female", "Male"];
const PATHWAYS = ["STEM", "Social Sciences", "Arts & Sports"];
const RESIDENCES = ["Day", "Boarding"];
const GRADES = ["10", "11", "12"];
const RELATIONSHIPS = ["Mother", "Father", "Guardian", "Sibling", "Grandparent", "Uncle / Aunt", "Other"];
const STREAMS = ["A", "B", "C", "D", "E", "F"];
const ROLE_LABEL: Record<Role, string> = {
  HOI: "Head of Institution",
  DEPUTY: "Deputy",
  TEACHER: "Teacher",
  FINANCE: "Finance",
};

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // the API allows 2 MB

const phoneOk = (v: string) => /^(?:\+254|0)[17]\d{8}$/.test(v.replace(/\s/g, ""));
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Laravel returns keys like "primaryGuardian.phone"; this form uses "pg.phone". */
function mapServerErrors(errs: Record<string, string[]>): Errors {
  const out: Errors = {};
  Object.entries(errs).forEach(([k, msgs]) => {
    const key = k
      .replace(/^primaryGuardian\./, "pg.")
      .replace(/^secondaryGuardian\./, "sg.")
      .replace(/^subjects\.\d+$/, "subjects");
    if (!out[key] && msgs?.[0]) out[key] = msgs[0];
  });
  return out;
}

const focusFirstInvalid = () =>
  requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-invalid='true']")?.focus());

/** One validation routine shared by the single form and the Excel upload. */
function validateLearner(form: LearnerForm): Errors {
  const e: Errors = {};
  const req = (k: string, v: string, msg: string) => { if (!v.trim()) e[k] = msg; };
  req("firstName", form.firstName, "Enter the learner's first name");
  req("surname", form.surname, "Enter the learner's surname");
  if (!form.gender) e.gender = "Select a gender";
  req("dateOfBirth", form.dateOfBirth, "Enter the date of birth");
  if (form.photo && form.photo.size > MAX_PHOTO_BYTES) e.photo = "The photo must be 2 MB or smaller";
  req("admissionNo", form.admissionNo, "Enter the admission number");
  req("admissionDate", form.admissionDate, "Enter the admission date");
  if (!form.grade) e.grade = "Select a grade";
  req("stream", form.stream, "Select a stream");
  if (!form.pathway) e.pathway = "Select a pathway";
  else if (form.subjects.length < 3) e.subjects = "Choose at least 3 elective subjects";
  if (!form.residence) e.residence = "Select day or boarding";
  const g = form.primaryGuardian;
  req("pg.fullName", g.fullName, "Enter the guardian's full name");
  if (!g.relationship) e["pg.relationship"] = "Select the relationship";
  if (!phoneOk(g.phone)) e["pg.phone"] = "Enter a valid Kenyan phone number, e.g. 0712 345 678";
  if (g.email && !emailOk(g.email)) e["pg.email"] = "Enter a valid email address";
  // The second guardian is optional, but must be complete once started.
  const s = form.secondaryGuardian;
  if (s.fullName.trim()) {
    if (!s.relationship) e["sg.relationship"] = "Select the relationship";
    if (!phoneOk(s.phone)) e["sg.phone"] = "Enter a valid Kenyan phone number";
  }
  if (s.email && !emailOk(s.email)) e["sg.email"] = "Enter a valid email address";
  req("emergencyName", form.emergencyName, "Enter an emergency contact");
  if (!phoneOk(form.emergencyPhone)) e.emergencyPhone = "Enter a valid Kenyan phone number";
  if (!form.consentDataUse) e.consentDataUse = "Guardian consent to data use is required";
  return e;
}

/* ---------- Excel template definition ---------- */

interface Column {
  key: string; // learner field, or "pg.x" / "sg.x" for guardians
  header: string;
  required?: boolean;
  example: string;
  width?: number;
}

const COLUMNS: Column[] = [
  // Learner details
  { key: "firstName", header: "First name *", required: true, example: "Jane" },
  { key: "middleName", header: "Middle name", example: "Wanjiru" },
  { key: "surname", header: "Surname *", required: true, example: "Mwangi" },
  { key: "gender", header: "Gender *", required: true, example: "Female" },
  { key: "dateOfBirth", header: "Date of birth * (YYYY-MM-DD)", required: true, example: "2009-03-14", width: 22 },
  { key: "nationality", header: "Nationality", example: "Kenyan" },
  { key: "birthCertNo", header: "Birth certificate number", example: "12345678", width: 22 },
  { key: "upi", header: "UPI (NEMIS)", example: "ABC123XYZ" },
  // Admission & academic
  { key: "admissionNo", header: "Admission number *", required: true, example: "EXAMPLE", width: 20 },
  { key: "admissionDate", header: "Admission date * (YYYY-MM-DD)", required: true, example: "2026-01-12", width: 24 },
  { key: "grade", header: "Grade * (10, 11 or 12)", required: true, example: "10", width: 20 },
  { key: "stream", header: "Stream * (A-F)", required: true, example: "A" },
  { key: "pathway", header: "Pathway *", required: true, example: "STEM" },
  { key: "subjects", header: "Elective subjects * (comma separated, min 3)", required: true, example: "Mathematics, Biology, Chemistry", width: 40 },
  { key: "residence", header: "Day or boarding *", required: true, example: "Day" },
  { key: "previousSchool", header: "Previous (junior) school", example: "Chuka Junior School", width: 24 },
  { key: "kjseaIndexNo", header: "KJSEA index number", example: "", width: 20 },
  { key: "kjseaPerformance", header: "KJSEA performance summary", example: "Meeting expectations", width: 24 },
  // Primary guardian
  { key: "pg.fullName", header: "Primary guardian - Full name *", required: true, example: "Mary Mwangi", width: 26 },
  { key: "pg.relationship", header: "Primary guardian - Relationship *", required: true, example: "Mother", width: 26 },
  { key: "pg.nationalId", header: "Primary guardian - National ID", example: "23456789", width: 24 },
  { key: "pg.phone", header: "Primary guardian - Phone *", required: true, example: "0712345678", width: 24 },
  { key: "pg.altPhone", header: "Primary guardian - Alt phone", example: "", width: 24 },
  { key: "pg.email", header: "Primary guardian - Email", example: "mary@example.com", width: 24 },
  { key: "pg.occupation", header: "Primary guardian - Occupation", example: "Teacher", width: 26 },
  { key: "pg.address", header: "Primary guardian - Address / county", example: "Tharaka Nithi", width: 28 },
  // Secondary guardian
  { key: "sg.fullName", header: "Second guardian - Full name", example: "", width: 26 },
  { key: "sg.relationship", header: "Second guardian - Relationship", example: "", width: 26 },
  { key: "sg.nationalId", header: "Second guardian - National ID", example: "", width: 24 },
  { key: "sg.phone", header: "Second guardian - Phone", example: "", width: 24 },
  { key: "sg.altPhone", header: "Second guardian - Alt phone", example: "", width: 24 },
  { key: "sg.email", header: "Second guardian - Email", example: "", width: 24 },
  { key: "sg.occupation", header: "Second guardian - Occupation", example: "", width: 26 },
  { key: "sg.address", header: "Second guardian - Address / county", example: "", width: 28 },
  // Health & emergency
  { key: "emergencyName", header: "Emergency contact name *", required: true, example: "Peter Mwangi", width: 24 },
  { key: "emergencyPhone", header: "Emergency contact phone *", required: true, example: "0722333444", width: 24 },
  { key: "medicalConditions", header: "Medical conditions", example: "", width: 24 },
  { key: "allergies", header: "Allergies", example: "", width: 20 },
  { key: "specialNeeds", header: "Special needs or learning support", example: "", width: 28 },
  // Consent
  { key: "consentDataUse", header: "Consent: data use * (Yes/No)", required: true, example: "Yes", width: 24 },
  { key: "consentAi", header: "Consent: AI tools (Yes/No)", example: "Yes", width: 24 },
  { key: "consentPhoto", header: "Consent: photo use (Yes/No)", example: "Yes", width: 24 },
];

const normHeader = (s: string) => s.toLowerCase().replace(/\*/g, "").replace(/[^a-z0-9]/g, "");
const COLUMN_BY_HEADER: Record<string, Column> = Object.fromEntries(COLUMNS.map((c) => [normHeader(c.header), c]));
const labelOf = (key: string) => COLUMNS.find((c) => c.key === key)?.header.replace(/\s*\*/g, "").replace(/\s*\(.*\)$/, "") ?? key;

function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: the learner rows go here
  const ws = XLSX.utils.aoa_to_sheet([COLUMNS.map((c) => c.header), COLUMNS.map((c) => c.example)]);
  ws["!cols"] = COLUMNS.map((c) => ({ wch: c.width ?? 18 }));
  XLSX.utils.book_append_sheet(wb, ws, "Learners");

  // Sheet 2: instructions
  const instructions = [
    ["How to use this template"],
    [""],
    ["1. Fill one learner per row on the 'Learners' sheet. Do not rename or reorder the column headings."],
    ["2. Columns marked * are required."],
    ["3. Row 2 is an example (admission number EXAMPLE). It is skipped on upload, so overwrite or delete it."],
    ["4. Dates must be written as YYYY-MM-DD, e.g. 2009-03-14."],
    ["5. Phone numbers must be Kenyan, e.g. 0712345678 or +254712345678."],
    ["6. Elective subjects go in one cell, separated by commas, and must belong to the chosen pathway (see 'Allowed values')."],
    ["7. The second guardian is optional, but if you give a name, also give the relationship and phone."],
    ["8. Consent columns take Yes or No. Consent to data use must be Yes."],
    ["9. Photos cannot be uploaded from Excel. Add them later from the learner's profile."],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(instructions);
  wsInfo["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Instructions");

  // Sheet 3: allowed values
  const lists: [string, string[]][] = [
    ["Gender", GENDERS],
    ["Grade", GRADES],
    ["Stream", STREAMS],
    ["Pathway", PATHWAYS],
    ["Day or boarding", RESIDENCES],
    ["Relationship", RELATIONSHIPS],
    ["STEM electives", ELECTIVES.STEM],
    ["Social Sciences electives", ELECTIVES["Social Sciences"]],
    ["Arts & Sports electives", ELECTIVES["Arts & Sports"]],
    ["Consent", ["Yes", "No"]],
  ];
  const height = Math.max(...lists.map(([, v]) => v.length));
  const aoa: string[][] = [lists.map(([h]) => h)];
  for (let i = 0; i < height; i++) aoa.push(lists.map(([, v]) => v[i] ?? ""));
  const wsLists = XLSX.utils.aoa_to_sheet(aoa);
  wsLists["!cols"] = lists.map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(wb, wsLists, "Allowed values");

  XLSX.writeFile(wb, "learner-registration-template.xlsx");
}

/* ---------- Excel parsing ---------- */

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim();

const toStr = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    // +12h keeps the calendar day right whatever the timezone offset SheetJS applied
    return new Date(v.getTime() + 12 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  return String(v).trim();
};

const toDateStr = (raw: string): string => {
  const dmy = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return raw;
};

/** Excel drops the leading zero of phone numbers; put it back. */
const toPhone = (raw: string): string => {
  const v = raw.replace(/\s/g, "");
  if (/^[17]\d{8}$/.test(v)) return `0${v}`;
  if (/^254[17]\d{8}$/.test(v)) return `+${v}`;
  return v;
};

const toBool = (raw: string) => ["yes", "y", "true", "1", "x"].includes(raw.trim().toLowerCase());

const matchOption = (raw: string, options: string[]): string => options.find((o) => norm(o) === norm(raw)) ?? "";

function recordToLearner(cells: Record<string, string>): { form: LearnerForm; errors: Errors } {
  const extra: Errors = {};
  const c = (k: string) => cells[k] ?? "";

  const pickEnum = (key: string, options: string[], rawValue = c(key)): string => {
    if (!rawValue) return "";
    const m = matchOption(rawValue, options);
    if (!m) extra[key] = `Use one of: ${options.join(", ")}`;
    return m;
  };

  const pathway = pickEnum("pathway", PATHWAYS) as Pathway;

  const rawSubjects = c("subjects").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  let subjects: string[] = [];
  if (pathway) {
    const allowed = ELECTIVES[pathway as Exclude<Pathway, "">];
    const unknown: string[] = [];
    rawSubjects.forEach((s) => {
      const m = matchOption(s, allowed);
      if (m) { if (!subjects.includes(m)) subjects.push(m); } else unknown.push(s);
    });
    if (unknown.length) extra.subjects = `Not offered in ${pathway}: ${unknown.join(", ")}`;
  } else {
    subjects = rawSubjects;
  }

  const dob = toDateStr(c("dateOfBirth"));
  const adm = toDateStr(c("admissionDate"));
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) extra.dateOfBirth = "Use the format YYYY-MM-DD";
  if (adm && !/^\d{4}-\d{2}-\d{2}$/.test(adm)) extra.admissionDate = "Use the format YYYY-MM-DD";

  const guardian = (p: "pg" | "sg"): Guardian => ({
    fullName: c(`${p}.fullName`),
    relationship: pickEnum(`${p}.relationship`, RELATIONSHIPS),
    nationalId: c(`${p}.nationalId`),
    phone: toPhone(c(`${p}.phone`)),
    altPhone: toPhone(c(`${p}.altPhone`)),
    email: c(`${p}.email`),
    occupation: c(`${p}.occupation`),
    address: c(`${p}.address`),
  });

  const form: LearnerForm = {
    firstName: c("firstName"),
    middleName: c("middleName"),
    surname: c("surname"),
    gender: pickEnum("gender", GENDERS) as Gender,
    dateOfBirth: dob,
    nationality: c("nationality") || "Kenyan",
    birthCertNo: c("birthCertNo"),
    upi: c("upi"),
    photo: null,
    admissionNo: c("admissionNo"),
    admissionDate: adm,
    grade: pickEnum("grade", GRADES, c("grade").replace(/grade/i, "").trim()) as LearnerForm["grade"],
    stream: pickEnum("stream", STREAMS),
    pathway,
    subjects,
    residence: pickEnum("residence", RESIDENCES) as Residence,
    previousSchool: c("previousSchool"),
    kjseaIndexNo: c("kjseaIndexNo"),
    kjseaPerformance: c("kjseaPerformance"),
    primaryGuardian: guardian("pg"),
    secondaryGuardian: guardian("sg"),
    emergencyName: c("emergencyName"),
    emergencyPhone: toPhone(c("emergencyPhone")),
    medicalConditions: c("medicalConditions"),
    allergies: c("allergies"),
    specialNeeds: c("specialNeeds"),
    consentDataUse: toBool(c("consentDataUse")),
    consentAi: toBool(c("consentAi")),
    consentPhoto: toBool(c("consentPhoto")),
  };

  return { form, errors: { ...validateLearner(form), ...extra } };
}

/* ---------- Bulk upload component ---------- */

type RowStatus = "ready" | "invalid" | "saving" | "done" | "failed";

interface BulkRow {
  line: number; // row number in the Excel sheet
  form: LearnerForm;
  errors: Errors;
  status: RowStatus;
  message?: string;
}

const STATUS_LABEL: Record<RowStatus, string> = {
  ready: "Ready",
  invalid: "Needs fixing",
  saving: "Saving…",
  done: "Registered",
  failed: "Failed",
};

const STATUS_COLOR: Record<RowStatus, string> = {
  ready: "#1d4ed8",
  invalid: "#b91c1c",
  saving: "#6b7280",
  done: "#15803d",
  failed: "#b91c1c",
};

function BulkUpload({ onSubmit }: { onSubmit: SubmitFn }) {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (i: number, p: Partial<BulkRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const reset = () => {
    setRows([]);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets["Learners"] ?? wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("The workbook has no sheets.");

      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
      if (!records.length) {
        toast.error("The file is empty", "Add at least one learner row under the headings and try again.");
        reset();
        return;
      }

      // Check that the required headings are present
      const present = new Set(Object.keys(records[0]).map(normHeader));
      const missing = COLUMNS.filter((c) => c.required && !present.has(normHeader(c.header))).map((c) => labelOf(c.key));
      if (missing.length) {
        toast.error("Wrong template", `Missing columns: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}. Download the template and use it.`);
        reset();
        return;
      }

      const built: BulkRow[] = [];
      const seenAdm = new Map<string, number>();

      records.forEach((rec, idx) => {
        const cells: Record<string, string> = {};
        Object.entries(rec).forEach(([h, v]) => {
          const col = COLUMN_BY_HEADER[normHeader(h)];
          if (col) {
            const s = toStr(v);
            cells[col.key] = s;
          }
        });

        const isBlank = Object.values(cells).every((v) => !v);
        const isExample = (cells.admissionNo ?? "").toUpperCase() === "EXAMPLE";
        if (isBlank || isExample) return;

        const line = idx + 2; // +1 for the heading row, +1 because Excel rows start at 1
        const { form, errors } = recordToLearner(cells);

        const adm = form.admissionNo.trim().toLowerCase();
        if (adm) {
          if (seenAdm.has(adm)) errors.admissionNo = `Duplicate admission number (also on row ${seenAdm.get(adm)})`;
          else seenAdm.set(adm, line);
        }

        built.push({ line, form, errors, status: Object.keys(errors).length ? "invalid" : "ready" });
      });

      if (!built.length) {
        toast.error("No learners found", "Only the example row was in the file. Add real learners and try again.");
        reset();
        return;
      }

      setRows(built);
      setFileName(file.name);
      const bad = built.filter((r) => r.status === "invalid").length;
      if (bad) toast.error("Some rows need fixing", `${bad} of ${built.length} rows have problems. Fix them in Excel and upload again, or register the valid rows now.`);
      else toast.success("File checked", `${built.length} learners are ready to register.`);
    } catch {
      toast.error("Could not read the file", "Use the downloaded .xlsx template and make sure the file is not corrupted.");
      reset();
    } finally {
      setParsing(false);
    }
  };

  const runImport = async () => {
    const todo = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.status === "ready" || r.status === "failed");
    if (!todo.length) return;

    setImporting(true);
    let ok = 0;
    let bad = 0;
    let stopped = false;

    for (const { r, i } of todo) {
      patch(i, { status: "saving", message: undefined });
      try {
        await onSubmit(r.form);
        patch(i, { status: "done" });
        ok++;
      } catch (err) {
        bad++;
        if (err instanceof ApiError && err.status === 422) {
          const mapped = mapServerErrors(err.errors);
          const first = Object.entries(mapped)[0];
          patch(i, { status: "failed", message: first ? `${labelOf(first[0])}: ${first[1]}` : err.message });
        } else if (err instanceof ApiError && err.status === 401) {
          patch(i, { status: "failed", message: "Session expired" });
          toast.error("Please log in again", "Your session has expired. Rows not yet saved can be retried after logging in.");
          stopped = true;
        } else if (err instanceof ApiError && err.status === 403) {
          patch(i, { status: "failed", message: "Not allowed" });
          toast.error("Not allowed", "You do not have permission to register learners.");
          stopped = true;
        } else if (err instanceof ApiError) {
          patch(i, { status: "failed", message: err.message });
        } else {
          patch(i, { status: "failed", message: "Cannot reach the server" });
          toast.error("Cannot reach the server", "Check your connection and that the backend is running, then retry.");
          stopped = true;
        }
        if (stopped) break;
      }
    }

    setImporting(false);
    if (ok) toast.success("Upload finished", `${ok} ${ok === 1 ? "learner" : "learners"} registered${bad ? `, ${bad} failed` : ""}.`);
    else if (!stopped) toast.error("Nothing was registered", "Check the Issues column for each row.");
  };

  const counts = useMemo(() => {
    const c = { ready: 0, invalid: 0, done: 0, failed: 0 };
    rows.forEach((r) => { if (r.status in c) c[r.status as keyof typeof c]++; });
    return c;
  }, [rows]);

  const pending = counts.ready + counts.failed;

  const issues = (r: BulkRow): string => {
    if (r.message) return r.message;
    const e = Object.entries(r.errors);
    if (!e.length) return "";
    return e.map(([k, m]) => `${labelOf(k)}: ${m}`).join(" · ");
  };

  return (
    <div>
      <section className="rl-card">
        <h2>Upload learners from Excel</h2>
        <p className="rl-note">
          1. Download the template. 2. Fill one learner per row. 3. Upload it here, review the check results, then register.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <button type="button" className="rl-btn" onClick={downloadTemplate}>Download Excel template</button>
          <label htmlFor="bulk-file" className="rl-btn rl-primary" style={{ cursor: "pointer" }}>
            {parsing ? "Reading…" : "Choose filled Excel file"}
          </label>
          <input
            id="bulk-file"
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            disabled={parsing || importing}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {fileName && <small>{fileName}</small>}
        </div>
      </section>

      {rows.length > 0 && (
        <section className="rl-card">
          <h2>Check results</h2>
          <p className="rl-note">
            {rows.length} rows: {counts.ready} ready, {counts.invalid} need fixing
            {counts.done ? `, ${counts.done} registered` : ""}
            {counts.failed ? `, ${counts.failed} failed` : ""}.
          </p>

          <div style={{ overflow: "auto", maxHeight: 420, border: "1px solid #e5e7eb", borderRadius: 8, marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, background: "#f9fafb", textAlign: "left" }}>
                  <th style={{ padding: "8px 10px" }}>Row</th>
                  <th style={{ padding: "8px 10px" }}>Adm. no</th>
                  <th style={{ padding: "8px 10px" }}>Name</th>
                  <th style={{ padding: "8px 10px" }}>Grade / Pathway</th>
                  <th style={{ padding: "8px 10px" }}>Status</th>
                  <th style={{ padding: "8px 10px" }}>Issues</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} style={{ borderTop: "1px solid #e5e7eb", verticalAlign: "top" }}>
                    <td style={{ padding: "8px 10px" }}>{r.line}</td>
                    <td style={{ padding: "8px 10px" }}>{r.form.admissionNo || "-"}</td>
                    <td style={{ padding: "8px 10px" }}>{`${r.form.firstName} ${r.form.surname}`.trim() || "-"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {r.form.grade ? `Grade ${r.form.grade}` : "-"}{r.form.stream ? ` ${r.form.stream}` : ""}
                      {r.form.pathway ? ` · ${r.form.pathway}` : ""}
                    </td>
                    <td style={{ padding: "8px 10px", color: STATUS_COLOR[r.status], fontWeight: 600, whiteSpace: "nowrap" }}>
                      {STATUS_LABEL[r.status]}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#b91c1c", minWidth: 240 }}>{issues(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rl-actions" style={{ marginTop: 16 }}>
            <button type="button" className="rl-btn" onClick={reset} disabled={importing}>Clear</button>
            <button type="button" className="rl-btn rl-primary" onClick={runImport} disabled={importing || pending === 0}>
              {importing ? "Registering…" : `Register ${pending} ${pending === 1 ? "learner" : "learners"}`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- Component ---------- */

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


function RegisterLearner({ onSubmit = registerLearner, role = "HOI", user, onNavigate, onLogout }: Props) {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [form, setForm] = useState<LearnerForm>(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0); // bumping this remounts the form, which also clears the file input

  const photoUrl = useMemo(() => (form.photo ? URL.createObjectURL(form.photo) : null), [form.photo]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  const set = <K extends keyof LearnerForm>(key: K, value: LearnerForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setGuardian = (which: "primaryGuardian" | "secondaryGuardian", key: keyof Guardian, value: string) =>
    setForm((f) => ({ ...f, [which]: { ...f[which], [key]: value } }));

  const toggleSubject = (s: string) =>
    setForm((f) => ({
      ...f,
      subjects: f.subjects.includes(s) ? f.subjects.filter((x) => x !== s) : [...f.subjects, s],
    }));

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving) return;

    const e = validateLearner(form);
    setErrors(e);
    const count = Object.keys(e).length;
    if (count) {
      toast.error("Some details need attention", `Please fix the ${count} highlighted ${count === 1 ? "field" : "fields"} and try again.`);
      focusFirstInvalid();
      return;
    }

    setSaving(true);
    try {
      const result = await onSubmit(form);
      const name = `${form.firstName} ${form.surname}`.trim();
      toast.success(
        "Learner registered",
        result && result.learner
          ? `${result.learner.name} (Adm. ${result.learner.admission_no}) has been added to the portal.`
          : `${name} has been added to the portal.`,
      );
      setForm(initialForm);
      setErrors({});
      setFormKey((k) => k + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        // The server rejected specific fields: show them inline and in a toast.
        const mapped = mapServerErrors(err.errors);
        const n = Object.keys(mapped).length;
        setErrors(mapped);
        toast.error("Check the highlighted fields", n > 1 ? `${err.message} (and ${n - 1} more)` : err.message);
        focusFirstInvalid();
      } else if (err instanceof ApiError && err.status === 401) {
        toast.error("Please log in again", "Your session has expired.");
      } else if (err instanceof ApiError && err.status === 403) {
        toast.error("Not allowed", "You do not have permission to register learners.");
      } else if (err instanceof ApiError && err.status >= 500) {
        toast.error("Something went wrong", "The server could not save this learner, and nothing was saved. Try again, and tell the administrator if it keeps happening.");
      } else if (err instanceof ApiError) {
        toast.error("Could not register the learner", err.message);
      } else {
        toast.error("Cannot reach the server", "Check your connection and that the backend is running, then try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const inv = (k: string) => (errors[k] ? { "data-invalid": "true", "aria-invalid": true } : {});

  const guardianFields = (which: "primaryGuardian" | "secondaryGuardian", prefix: string, required: boolean) => {
    const g = form[which];
    const p = (k: keyof Guardian) => `${prefix}.${k}`;
    return (
      <div className="rl-grid">
        <Field id={`${prefix}-name`} label={`Full name${required ? " *" : ""}`} error={errors[p("fullName")]}>
          <input id={`${prefix}-name`} value={g.fullName} onChange={(e) => setGuardian(which, "fullName", e.target.value)} {...inv(p("fullName"))} />
        </Field>
        <Field id={`${prefix}-rel`} label={`Relationship${required ? " *" : ""}`} error={errors[p("relationship")]}>
          <select id={`${prefix}-rel`} value={g.relationship} onChange={(e) => setGuardian(which, "relationship", e.target.value)} {...inv(p("relationship"))}>
            <option value="">Select</option>
            {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field id={`${prefix}-id`} label="National ID number" error={errors[p("nationalId")]}>
          <input id={`${prefix}-id`} inputMode="numeric" value={g.nationalId} onChange={(e) => setGuardian(which, "nationalId", e.target.value)} {...inv(p("nationalId"))} />
        </Field>
        <Field id={`${prefix}-phone`} label={`Phone${required ? " *" : ""}`} error={errors[p("phone")]}>
          <input id={`${prefix}-phone`} type="tel" placeholder="0712 345 678" value={g.phone} onChange={(e) => setGuardian(which, "phone", e.target.value)} {...inv(p("phone"))} />
        </Field>
        <Field id={`${prefix}-alt`} label="Alternative phone" error={errors[p("altPhone")]}>
          <input id={`${prefix}-alt`} type="tel" value={g.altPhone} onChange={(e) => setGuardian(which, "altPhone", e.target.value)} {...inv(p("altPhone"))} />
        </Field>
        <Field id={`${prefix}-email`} label="Email" error={errors[p("email")]}>
          <input id={`${prefix}-email`} type="email" value={g.email} onChange={(e) => setGuardian(which, "email", e.target.value)} {...inv(p("email"))} />
        </Field>
        <Field id={`${prefix}-occ`} label="Occupation" error={errors[p("occupation")]}>
          <input id={`${prefix}-occ`} value={g.occupation} onChange={(e) => setGuardian(which, "occupation", e.target.value)} {...inv(p("occupation"))} />
        </Field>
        <Field id={`${prefix}-addr`} label="Home address / county" error={errors[p("address")]}>
          <input id={`${prefix}-addr`} value={g.address} onChange={(e) => setGuardian(which, "address", e.target.value)} {...inv(p("address"))} />
        </Field>
      </div>
    );
  };

  return (
    <DashboardLayout
      role={role}
      user={user ?? { name: "School Administrator", roleLabel: ROLE_LABEL[role] }}
      title="Register Learner"
      activeKey="students"
      onNavigate={onNavigate}
      onLogout={onLogout}
    >
      <div className="rl-page">

        <header className="rl-head">
          <h1>Register learner</h1>
          <p>Add a new learner to the Senior School Portal. Fields marked * are required.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" className={`rl-btn${mode === "single" ? " rl-primary" : ""}`} onClick={() => setMode("single")}>
              Single registration
            </button>
            <button type="button" className={`rl-btn${mode === "bulk" ? " rl-primary" : ""}`} onClick={() => setMode("bulk")}>
              Bulk upload (Excel)
            </button>
          </div>
        </header>

        {mode === "bulk" ? (
          <BulkUpload onSubmit={onSubmit} />
        ) : (
        <form key={formKey} onSubmit={handleSubmit} noValidate>

          <section className="rl-card">
            <h2>Learner details</h2>
            <div className="rl-photo">
              <div className="rl-avatar">{photoUrl ? <img src={photoUrl} alt="Selected learner" /> : <span>No photo</span>}</div>
              <div>
                <label htmlFor="photo" className="rl-btn">Upload photo</label>
                <input id="photo" type="file" accept="image/*" hidden onChange={(e) => set("photo", e.target.files?.[0] ?? null)} />
                <small>JPG or PNG, passport style, up to 2 MB.</small>
                {errors.photo && <small className="rl-err" role="alert">{errors.photo}</small>}
              </div>
            </div>
            <div className="rl-grid">
              <Field id="firstName" label="First name *" error={errors.firstName}>
                <input id="firstName" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} {...inv("firstName")} />
              </Field>
              <Field id="middleName" label="Middle name" error={errors.middleName}>
                <input id="middleName" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} {...inv("middleName")} />
              </Field>
              <Field id="surname" label="Surname *" error={errors.surname}>
                <input id="surname" value={form.surname} onChange={(e) => set("surname", e.target.value)} {...inv("surname")} />
              </Field>
              <Field id="gender" label="Gender *" error={errors.gender}>
                <select id="gender" value={form.gender} onChange={(e) => set("gender", e.target.value as Gender)} {...inv("gender")}>
                  <option value="">Select</option><option>Female</option><option>Male</option>
                </select>
              </Field>
              <Field id="dob" label="Date of birth *" error={errors.dateOfBirth}>
                <input id="dob" type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} {...inv("dateOfBirth")} />
              </Field>
              <Field id="nationality" label="Nationality" error={errors.nationality}>
                <input id="nationality" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} {...inv("nationality")} />
              </Field>
              <Field id="birthCert" label="Birth certificate number" error={errors.birthCertNo}>
                <input id="birthCert" value={form.birthCertNo} onChange={(e) => set("birthCertNo", e.target.value)} {...inv("birthCertNo")} />
              </Field>
              <Field id="upi" label="UPI (NEMIS)" hint="Unique Personal Identifier from NEMIS" error={errors.upi}>
                <input id="upi" value={form.upi} onChange={(e) => set("upi", e.target.value)} {...inv("upi")} />
              </Field>
            </div>
          </section>


          <section className="rl-card">
            <h2>Admission and academics</h2>
            <div className="rl-grid">
              <Field id="admNo" label="Admission number *" error={errors.admissionNo}>
                <input id="admNo" value={form.admissionNo} onChange={(e) => set("admissionNo", e.target.value)} {...inv("admissionNo")} />
              </Field>
              <Field id="admDate" label="Admission date *" error={errors.admissionDate}>
                <input id="admDate" type="date" value={form.admissionDate} onChange={(e) => set("admissionDate", e.target.value)} {...inv("admissionDate")} />
              </Field>
              <Field id="grade" label="Grade *" error={errors.grade}>
                <select id="grade" value={form.grade} onChange={(e) => set("grade", e.target.value as LearnerForm["grade"])} {...inv("grade")}>
                  <option value="">Select</option><option value="10">Grade 10</option><option value="11">Grade 11</option><option value="12">Grade 12</option>
                </select>
              </Field>
              <Field id="stream" label="Stream *" error={errors.stream}>
                <select id="stream" value={form.stream} onChange={(e) => set("stream", e.target.value)} {...inv("stream")}>
                  <option value="">Select</option>
                  {STREAMS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field id="pathway" label="Pathway *" error={errors.pathway}>
                <select id="pathway" value={form.pathway} onChange={(e) => { set("pathway", e.target.value as Pathway); set("subjects", []); }} {...inv("pathway")}>
                  <option value="">Select</option><option>STEM</option><option>Social Sciences</option><option>Arts & Sports</option>
                </select>
              </Field>
              <Field id="residence" label="Day or boarding *" error={errors.residence}>
                <select id="residence" value={form.residence} onChange={(e) => set("residence", e.target.value as Residence)} {...inv("residence")}>
                  <option value="">Select</option><option>Day</option><option>Boarding</option>
                </select>
              </Field>
              <Field id="prevSchool" label="Previous (junior) school" error={errors.previousSchool}>
                <input id="prevSchool" value={form.previousSchool} onChange={(e) => set("previousSchool", e.target.value)} {...inv("previousSchool")} />
              </Field>
              <Field id="kjsea" label="KJSEA index number" error={errors.kjseaIndexNo}>
                <input id="kjsea" value={form.kjseaIndexNo} onChange={(e) => set("kjseaIndexNo", e.target.value)} {...inv("kjseaIndexNo")} />
              </Field>
              <Field id="kjseaPerf" label="KJSEA performance summary" error={errors.kjseaPerformance}>
                <input id="kjseaPerf" placeholder="e.g. Meeting expectations" value={form.kjseaPerformance} onChange={(e) => set("kjseaPerformance", e.target.value)} {...inv("kjseaPerformance")} />
              </Field>
            </div>

            <fieldset className="rl-subjects" {...(errors.subjects ? { "data-invalid": "true", tabIndex: -1 } : {})}>
              <legend>Subjects</legend>
              <p className="rl-note">Compulsory: {COMPULSORY.join(", ")}.</p>
              {form.pathway ? (
                <div className="rl-checks">
                  {ELECTIVES[form.pathway].map((s) => (
                    <label key={s} className="rl-check">
                      <input type="checkbox" checked={form.subjects.includes(s)} onChange={() => toggleSubject(s)} />
                      {s}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="rl-note">Choose a pathway to see its elective subjects.</p>
              )}
              {errors.subjects && <small className="rl-err" role="alert">{errors.subjects}</small>}
            </fieldset>
          </section>


          <section className="rl-card">
            <h2>Primary parent / guardian</h2>
            {guardianFields("primaryGuardian", "pg", true)}
          </section>
          <section className="rl-card">
            <h2>Second parent / guardian <span className="rl-opt">optional</span></h2>
            {guardianFields("secondaryGuardian", "sg", false)}
          </section>


          <section className="rl-card">
            <h2>Health and emergency contact</h2>
            <div className="rl-grid">
              <Field id="emName" label="Emergency contact name *" error={errors.emergencyName}>
                <input id="emName" value={form.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} {...inv("emergencyName")} />
              </Field>
              <Field id="emPhone" label="Emergency contact phone *" error={errors.emergencyPhone}>
                <input id="emPhone" type="tel" value={form.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} {...inv("emergencyPhone")} />
              </Field>
              <Field id="medical" label="Medical conditions" error={errors.medicalConditions}>
                <textarea id="medical" rows={3} value={form.medicalConditions} onChange={(e) => set("medicalConditions", e.target.value)} {...inv("medicalConditions")} />
              </Field>
              <Field id="allergies" label="Allergies" error={errors.allergies}>
                <textarea id="allergies" rows={3} value={form.allergies} onChange={(e) => set("allergies", e.target.value)} {...inv("allergies")} />
              </Field>
              <Field id="needs" label="Special needs or learning support" error={errors.specialNeeds}>
                <textarea id="needs" rows={3} value={form.specialNeeds} onChange={(e) => set("specialNeeds", e.target.value)} {...inv("specialNeeds")} />
              </Field>
            </div>
          </section>

          {/* 5. Consent */}
          <section className="rl-card">
            <h2>Consent</h2>
            <label className="rl-check">
              <input type="checkbox" checked={form.consentDataUse} onChange={(e) => set("consentDataUse", e.target.checked)} {...inv("consentDataUse")} />
              The parent or guardian agrees that the school may collect and use this learner's data for school administration. *
            </label>
            {errors.consentDataUse && <small className="rl-err" role="alert">{errors.consentDataUse}</small>}
            <label className="rl-check">
              <input type="checkbox" checked={form.consentAi} onChange={(e) => set("consentAi", e.target.checked)} />
              The learner may use the AI Tutor, career guidance and study plan tools. Teachers can review AI output.
            </label>
            <label className="rl-check">
              <input type="checkbox" checked={form.consentPhoto} onChange={(e) => set("consentPhoto", e.target.checked)} />
              The school may use the learner's photo on the portal and ID card.
            </label>
          </section>

          <div className="rl-actions">
            <button
              type="button"
              className="rl-btn"
              disabled={saving}
              onClick={() => { setForm(initialForm); setErrors({}); setFormKey((k) => k + 1); }}
            >
              Clear form
            </button>
            <button type="submit" className="rl-btn rl-primary" disabled={saving}>{saving ? "Saving…" : "Register learner"}</button>
          </div>
        </form>
        )}
      </div>
    </DashboardLayout>
  );
}

export default RegisterLearner;