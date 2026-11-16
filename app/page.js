"use client";
import { useState, useEffect, useRef } from "react";

const API = (process.env.NEXT_PUBLIC_API_URL || "https://sivabbbs123.pythonanywhere.com").replace(/\/$/, "");

// [code, label, minDigits, maxDigits] - keep in sync with backend COUNTRIES
const COUNTRIES = [
  ["+91", "India", 10, 10], ["+1", "USA / Canada", 10, 10], ["+44", "United Kingdom", 10, 10],
  ["+971", "UAE", 9, 9], ["+65", "Singapore", 8, 8], ["+61", "Australia", 9, 9],
  ["+966", "Saudi Arabia", 9, 9], ["+974", "Qatar", 8, 8], ["+60", "Malaysia", 9, 10],
  ["+94", "Sri Lanka", 9, 9], ["+49", "Germany", 10, 11], ["+977", "Nepal", 10, 10],
];

const OPT = {
  areaOfInterest: ["Executive education programme", "General management", "Leadership and strategy", "Finance and business analytics", "Operations and supply chain", "Digital transformation", "Other / Not sure yet"],
  learningMode: ["On-campus", "Online", "Hybrid", "Flexible / No preference"],
  startPeriod: ["As soon as available", "Within 3 months", "Within 6 months", "Later / Exploring options"],
  source: ["Institute website", "Social media", "Colleague / Friend", "Advertisement", "Education consultant", "Other"],
  qualification: ["Diploma", "Bachelor's Degree", "Master's Degree", "Professional Qualification", "Doctorate", "Other"],
  experience: ["Currently a student / Fresher", "Less than 2 years", "2–5 years", "6–10 years", "11–15 years", "More than 15 years"],
  contactTime: ["9 AM – 12 PM", "12 PM – 3 PM", "3 PM – 6 PM", "Any time"],
};

const INITIAL = { fullName: "", email: "", countryCode: "+91", phone: "", city: "", areaOfInterest: "", learningMode: "", startPeriod: "", source: "", qualification: "", specialisation: "", experience: "", designation: "", organisation: "", industry: "", message: "", contactTime: "", consent: false, hpField: "" };

function validate(v) {
  const e = {};
  const name = v.fullName.trim();
  if (name.length < 2 || !/^[\p{L} .'-]+$/u.test(name) || !/\p{L}/u.test(name)) e.fullName = "Enter your full name using letters only (at least 2 characters).";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.email.trim())) e.email = "Enter a valid email address, e.g. name@example.com.";
  const c = COUNTRIES.find((x) => x[0] === v.countryCode);
  if (!c) e.phone = "Select a valid country code.";
  else {
    const [, , lo, hi] = c;
    if (!/^\d+$/.test(v.phone) || v.phone.length < lo || v.phone.length > hi || (c[0] === "+91" && !/^[6-9]/.test(v.phone)))
      e.phone = `Enter a valid ${lo === hi ? lo : `${lo}-${hi}`}-digit mobile number${c[0] === "+91" ? " starting with 6, 7, 8 or 9" : ""}.`;
  }
  if (v.city.trim().length < 2) e.city = "Enter your current city.";
  if (!v.areaOfInterest) e.areaOfInterest = "Select an area of interest.";
  if (!v.qualification) e.qualification = "Select your highest qualification.";
  if (!v.experience) e.experience = "Select your total work experience.";
  const m = v.message.trim().length;
  if (m < 10) e.message = "Tell us a little more (at least 10 characters).";
  else if (m > 1500) e.message = "Keep your message under 1500 characters.";
  if (!v.consent) e.consent = "Please confirm your agreement to continue.";
  return e;
}

// Defined OUTSIDE Page so React keeps the same component between renders.
// (Defining it inside Page re-created it on every keystroke, which unmounted the
// input and made it lose focus after one character.)
function Field({ k, label, req, full, hint, error, children }) {
  return (
    <div className={`field${full ? " full" : ""}`}>
      <label htmlFor={k}>{label} {req && <span className="required">*</span>}</label>
      {children}
      {error ? <p className="err" id={`${k}-err`} role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export default function Page() {
  const [v, setV] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [done, setDone] = useState(null);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  const notify = (type, text) => {
    setToast({ type, text });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 6000);
  };
  const set = (k, val) => {
    const next = { ...v, [k]: val };
    setV(next);
    // Re-check on change only for fields that already show an error
    // (the phone error depends on both country code and number)
    if (errors[k] || (k === "countryCode" && errors.phone)) {
      const now = validate(next);
      setErrors((p) => ({ ...p, [k]: now[k], ...(k === "countryCode" ? { phone: now.phone } : {}) }));
    }
  };
  const blur = (k) => setErrors((p) => ({ ...p, [k]: validate(v)[k] }));

  const props = (k, extra = {}) => ({
    id: k, name: k, value: v[k],
    onChange: (e) => set(k, e.target.value), onBlur: () => blur(k),
    "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `${k}-err` : undefined,
    className: errors[k] ? "bad" : undefined, ...extra,
  });

  const text = (k, label, o = {}) => (
    <Field k={k} label={label} req={o.req} hint={o.hint} error={errors[k]}>
      <input {...props(k)} type={o.type || "text"} placeholder={o.ph} autoComplete={o.ac} maxLength={o.max} />
    </Field>
  );
  const select = (k, label, ph, o = {}) => (
    <Field k={k} label={label} req={o.req} hint={o.hint} error={errors[k]}>
      <select {...props(k)}>
        <option value="">{ph}</option>
        {OPT[k].map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    </Field>
  );

  const country = COUNTRIES.find((x) => x[0] === v.countryCode) || COUNTRIES[0];

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    const found = validate(v);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      notify("error", "Some details need your attention. Please fix the highlighted fields.");
      document.getElementById(first)?.focus();
      return;
    }
    setLoading(true);
    try {
      const body = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === "string" ? x.trim() : x]));
      const res = await fetch(`${API}/api/enquiries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) { setDone(data.reference); setV(INITIAL); setErrors({}); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else if (res.status === 422) { setErrors(data.errors || {}); notify("error", data.message || "Please check the form."); }
      else if (res.status === 409) notify("info", data.message);
      else notify("error", "Something went wrong on our side. Please try again in a moment.");
    } catch {
      notify("error", "Can't reach the server. Check your internet connection and try again.");
    } finally { setLoading(false); }
  }

  return (
    <>
      <div className="topbar" />
      <header>
        <div className="brand-mark" aria-hidden="true">IIMT</div>
        <div className="eyebrow">Executive Education Enquiry</div>
        <h1>Explore Your Next Leadership Chapter</h1>
        <p>Share a few details and register your interest in executive education opportunities at IIM Tiruchirappalli.</p>
      </header>

      <main>
        <div className="notice">
          <strong>Important:</strong> This is an independently developed enquiry form and is not an official IIM Tiruchirappalli application or admission portal. Programme names and details should be confirmed through the Institute&apos;s official website.
        </div>

        <section className="form-card">
          {done ? (
            <div className="success" role="status">
              <div className="tick" aria-hidden="true">✓</div>
              <h2>Enquiry received</h2>
              <p>Thank you. Our team will respond using the email and phone number you provided.</p>
              <p className="ref">Reference number <strong>{done}</strong></p>
              <button type="button" onClick={() => setDone(null)}>Submit another enquiry</button>
            </div>
          ) : (
            <>
              <div className="form-intro">
                <h2>Prospective Applicant Enquiry Form</h2>
                <p>Fields marked with <span className="required">*</span> are mandatory. Please provide accurate contact information.</p>
              </div>
              <form onSubmit={submit} noValidate>
                <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="hpField" value={v.hpField} onChange={(e) => set("hpField", e.target.value)} />

                <fieldset>
                  <legend>01 &nbsp; Personal Information</legend>
                  <div className="grid">
                    {text("fullName", "Full Name", { req: 1, ph: "Enter your full name", ac: "name", max: 100 })}
                    {text("email", "Email Address", { req: 1, type: "email", ph: "name@example.com", ac: "email", max: 150 })}
                    <Field k="phone" label="Mobile Number" req error={errors.phone} hint={`Enter ${country[2] === country[3] ? country[2] : `${country[2]}-${country[3]}`} digits without the country code.`}>
                      <div className="phone">
                        <select aria-label="Country code" {...props("countryCode", { id: "countryCode", className: undefined, "aria-invalid": false, "aria-describedby": undefined, onBlur: undefined })}>
                          {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}
                        </select>
                        <input {...props("phone", { onChange: (e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, country[3])) })} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder={country[0] === "+91" ? "98765 43210" : "Mobile number"} />
                      </div>
                    </Field>
                    {text("city", "Current City", { req: 1, ph: "e.g. Chennai", ac: "address-level2", max: 80 })}
                  </div>
                </fieldset>

                <fieldset>
                  <legend>02 &nbsp; Programme Interest</legend>
                  <div className="grid">
                    {select("areaOfInterest", "Area of Interest", "Select an area", { req: 1, hint: "These are enquiry categories, not a confirmation that a specific programme is currently offered." })}
                    {select("learningMode", "Preferred Learning Mode", "Select preference")}
                    {select("startPeriod", "Preferred Start Period", "Select period")}
                    {select("source", "How did you hear about this enquiry?", "Select an option")}
                  </div>
                </fieldset>

                <fieldset>
                  <legend>03 &nbsp; Education and Professional Background</legend>
                  <div className="grid">
                    {select("qualification", "Highest Educational Qualification", "Select qualification", { req: 1 })}
                    {text("specialisation", "Specialisation / Field of Study", { ph: "e.g. Engineering, Commerce, Management", max: 100 })}
                    {select("experience", "Total Work Experience", "Select experience", { req: 1 })}
                    {text("designation", "Current Designation", { ph: "Your job title", ac: "organization-title", max: 100 })}
                    {text("organisation", "Current Organisation", { ph: "Company / organisation name", ac: "organization", max: 120 })}
                    {text("industry", "Industry", { ph: "e.g. IT, Banking, Manufacturing", max: 100 })}
                  </div>
                </fieldset>

                <fieldset>
                  <legend>04 &nbsp; Your Enquiry</legend>
                  <div className="grid">
                    <Field k="message" label="What would you like to know?" req full hint={`${v.message.length}/1500 characters`} error={errors.message}>
                      <textarea {...props("message")} maxLength={1500} placeholder="Tell us about the programme information you are looking for, eligibility, schedule, fees or admission process..." />
                    </Field>
                    {select("contactTime", "Preferred Time to Contact", "Select preferred time")}
                  </div>
                </fieldset>

                <label className={`consent${errors.consent ? " consent-bad" : ""}`} htmlFor="consent">
                  <input id="consent" type="checkbox" checked={v.consent} onChange={(e) => set("consent", e.target.checked)} aria-invalid={!!errors.consent} />
                  <span>I agree that the information provided may be used to respond to this enquiry. I understand that submitting this form does not constitute an application, admission, or guarantee of a place in any programme. <span className="required">*</span></span>
                </label>
                {errors.consent && <p className="err consent-err" role="alert">{errors.consent}</p>}

                <div className="submit-row">
                  <button type="submit" disabled={loading}>{loading ? <><span className="spin" /> Submitting...</> : <>Submit Enquiry <span aria-hidden="true">→</span></>}</button>
                  <div className="privacy">Please do not submit passwords, payment details, government identity numbers or other sensitive personal information.</div>
                </div>
              </form>
            </>
          )}
        </section>
      </main>

      <footer>Independent enquiry form concept · Verify all programme information with IIM Tiruchirappalli through its official channels.</footer>

      {toast && (
        <div className={`toast ${toast.type}`} role="status">
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss message">×</button>
        </div>
      )}
    </>
  );
}
