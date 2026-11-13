import React, { useEffect, useMemo, useState } from "react";

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

interface Props {
  onSubmit?: (data: LearnerForm) => void | Promise<void>;
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

const RELATIONSHIPS = ["Mother", "Father", "Guardian", "Sibling", "Grandparent", "Uncle / Aunt", "Other"];
const STREAMS = ["A", "B", "C", "D", "E", "F"];

const phoneOk = (v: string) => /^(?:\+254|0)[17]\d{8}$/.test(v.replace(/\s/g, ""));
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

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


function RegisterLearner({ onSubmit }: Props) {
  const [form, setForm] = useState<LearnerForm>(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

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

  const validate = (): Errors => {
    const e: Errors = {};
    const req = (k: string, v: string, msg: string) => { if (!v.trim()) e[k] = msg; };
    req("firstName", form.firstName, "Enter the learner's first name");
    req("surname", form.surname, "Enter the learner's surname");
    if (!form.gender) e.gender = "Select a gender";
    req("dateOfBirth", form.dateOfBirth, "Enter the date of birth");
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
    req("emergencyName", form.emergencyName, "Enter an emergency contact");
    if (!phoneOk(form.emergencyPhone)) e.emergencyPhone = "Enter a valid Kenyan phone number";
    if (!form.consentDataUse) e.consentDataUse = "Guardian consent to data use is required";
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    setDone(null);
    if (Object.keys(e).length) {
      const first = document.querySelector<HTMLElement>("[data-invalid='true']");
      first?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSubmit?.(form);
      setDone(`${form.firstName} ${form.surname} has been registered.`);
      setForm(initialForm);
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
        <Field id={`${prefix}-id`} label="National ID number">
          <input id={`${prefix}-id`} inputMode="numeric" value={g.nationalId} onChange={(e) => setGuardian(which, "nationalId", e.target.value)} />
        </Field>
        <Field id={`${prefix}-phone`} label={`Phone${required ? " *" : ""}`} error={errors[p("phone")]}>
          <input id={`${prefix}-phone`} type="tel" placeholder="0712 345 678" value={g.phone} onChange={(e) => setGuardian(which, "phone", e.target.value)} {...inv(p("phone"))} />
        </Field>
        <Field id={`${prefix}-alt`} label="Alternative phone">
          <input id={`${prefix}-alt`} type="tel" value={g.altPhone} onChange={(e) => setGuardian(which, "altPhone", e.target.value)} />
        </Field>
        <Field id={`${prefix}-email`} label="Email" error={errors[p("email")]}>
          <input id={`${prefix}-email`} type="email" value={g.email} onChange={(e) => setGuardian(which, "email", e.target.value)} {...inv(p("email"))} />
        </Field>
        <Field id={`${prefix}-occ`} label="Occupation">
          <input id={`${prefix}-occ`} value={g.occupation} onChange={(e) => setGuardian(which, "occupation", e.target.value)} />
        </Field>
        <Field id={`${prefix}-addr`} label="Home address / county">
          <input id={`${prefix}-addr`} value={g.address} onChange={(e) => setGuardian(which, "address", e.target.value)} />
        </Field>
      </div>
    );
  };

  return (
    <div className="rl-page">
      
      <header className="rl-head">
        <h1>Register learner</h1>
        <p>Add a new learner to the Senior School Portal. Fields marked * are required.</p>
      </header>

      {done && <div className="rl-ok" role="status">{done}</div>}

      <form onSubmit={handleSubmit} noValidate>
    
        <section className="rl-card">
          <h2>Learner details</h2>
          <div className="rl-photo">
            <div className="rl-avatar">{photoUrl ? <img src={photoUrl} alt="Selected learner" /> : <span>No photo</span>}</div>
            <div>
              <label htmlFor="photo" className="rl-btn">Upload photo</label>
              <input id="photo" type="file" accept="image/*" hidden onChange={(e) => set("photo", e.target.files?.[0] ?? null)} />
              <small>JPG or PNG, passport style.</small>
            </div>
          </div>
          <div className="rl-grid">
            <Field id="firstName" label="First name *" error={errors.firstName}>
              <input id="firstName" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} {...inv("firstName")} />
            </Field>
            <Field id="middleName" label="Middle name">
              <input id="middleName" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
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
            <Field id="nationality" label="Nationality">
              <input id="nationality" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
            </Field>
            <Field id="birthCert" label="Birth certificate number">
              <input id="birthCert" value={form.birthCertNo} onChange={(e) => set("birthCertNo", e.target.value)} />
            </Field>
            <Field id="upi" label="UPI (NEMIS)" hint="Unique Personal Identifier from NEMIS">
              <input id="upi" value={form.upi} onChange={(e) => set("upi", e.target.value)} />
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
            <Field id="prevSchool" label="Previous (junior) school">
              <input id="prevSchool" value={form.previousSchool} onChange={(e) => set("previousSchool", e.target.value)} />
            </Field>
            <Field id="kjsea" label="KJSEA index number">
              <input id="kjsea" value={form.kjseaIndexNo} onChange={(e) => set("kjseaIndexNo", e.target.value)} />
            </Field>
            <Field id="kjseaPerf" label="KJSEA performance summary">
              <input id="kjseaPerf" placeholder="e.g. Meeting expectations" value={form.kjseaPerformance} onChange={(e) => set("kjseaPerformance", e.target.value)} />
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
            <Field id="medical" label="Medical conditions">
              <textarea id="medical" rows={3} value={form.medicalConditions} onChange={(e) => set("medicalConditions", e.target.value)} />
            </Field>
            <Field id="allergies" label="Allergies">
              <textarea id="allergies" rows={3} value={form.allergies} onChange={(e) => set("allergies", e.target.value)} />
            </Field>
            <Field id="needs" label="Special needs or learning support">
              <textarea id="needs" rows={3} value={form.specialNeeds} onChange={(e) => set("specialNeeds", e.target.value)} />
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
          <button type="button" className="rl-btn" onClick={() => { setForm(initialForm); setErrors({}); setDone(null); }}>Clear form</button>
          <button type="submit" className="rl-btn rl-primary" disabled={saving}>{saving ? "Saving…" : "Register learner"}</button>
        </div>
      </form>
    </div>
  );
}




export default RegisterLearner;