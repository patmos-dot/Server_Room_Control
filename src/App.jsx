import { useState } from 'react';
import { supabase } from './supabaseClient';

const EMPTY = {
  fullName: '',
  email: '',
  activity: '',
  takingLaptops: null, // null = not answered yet, true / false once chosen
  serials: [''],
  laptopReason: '',
  returningLaptops: null, // null = not answered yet
  returnedCount: '',
  returnedCondition: '', // 'all_working' | 'some_need_repair' | 'all_need_repair'
  repairNotes: '',
  website: '', // honeypot: real people never see or fill this
};

const MAX_LAPTOPS = 20;
const cleanSerial = (s) => s.trim().toUpperCase().replace(/^ISOMO-/, '').replace(/\s+/g, '');

function validate(f) {
  const e = {};
  if (f.fullName.trim().length < 2) e.fullName = 'Please type your full name.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = 'Please type a valid email address.';
  if (f.activity.trim().length < 3) e.activity = 'Tell us what you are doing in the control room.';
  if (f.takingLaptops === null) e.takingLaptops = 'Please choose Yes or No.';
  if (f.takingLaptops) {
    const serials = f.serials.map(cleanSerial);
    if (serials.some((s) => !s)) e.serials = 'Fill in every serial number, or remove the empty one.';
    else if (new Set(serials).size !== serials.length) e.serials = 'The same serial number is listed twice.';
    if (f.laptopReason.trim().length < 3) e.laptopReason = 'Tell us why you are taking the laptop(s).';
  }
  if (f.returningLaptops === null) e.returningLaptops = 'Please choose Yes or No.';
  if (f.returningLaptops) {
    const n = Number(f.returnedCount);
    if (!Number.isInteger(n) || n < 1 || n > 50) e.returnedCount = 'Type how many laptops you are bringing back (1 to 50).';
    if (!f.returnedCondition) e.returnedCondition = 'Tell us if the laptops work or need repair.';
    else if (n === 1 && f.returnedCondition === 'some_need_repair')
      e.returnedCondition = 'For one laptop, choose "It works" or "It needs repair".';
  }
  return e;
}

export default function App() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | done | failed
  const [doneAt, setDoneAt] = useState(null);

  const set = (key) => (ev) => setForm({ ...form, [key]: ev.target.value });

  const setSerial = (i, value) => {
    const serials = [...form.serials];
    serials[i] = value;
    setForm({ ...form, serials });
  };
  const addSerial = () =>
    form.serials.length < MAX_LAPTOPS && setForm({ ...form, serials: [...form.serials, ''] });
  const removeSerial = (i) => setForm({ ...form, serials: form.serials.filter((_, j) => j !== i) });

  async function handleSubmit(ev) {
    ev.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = document.querySelector('[aria-invalid="true"]');
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first?.focus?.({ preventScroll: true });
      return;
    }
    if (form.website) return; // a bot filled the hidden field; quietly drop it

    setStatus('sending');
    const row = {
      full_name: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      activity: form.activity.trim(),
      taking_laptops: form.takingLaptops,
      laptop_serials: form.takingLaptops ? form.serials.map(cleanSerial) : [],
      laptop_reason: form.takingLaptops ? form.laptopReason.trim() : null,
      // no timestamp here on purpose: the database stamps submitted_at itself
        returning_laptops: form.returningLaptops,
      returned_count: form.returningLaptops ? Number(form.returnedCount) : null,
      returned_condition: form.returningLaptops ? form.returnedCondition : null,
      repair_notes:
        form.returningLaptops && form.returnedCondition !== 'all_working' && form.repairNotes.trim()
          ? form.repairNotes.trim()
          : null,
    };

    const { error } = await supabase.from('control_room_entries').insert(row);
    if (error) {
      console.error(error);
      setStatus('failed');
      return;
    }
    setDoneAt(new Date());
    setStatus('done');
  }

  function startAgain() {
    setForm(EMPTY);
    setErrors({});
    setStatus('idle');
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="page">
      <main className="card">
        <header className="card-head">
          <img src="/isomo-white.png" alt="Isomo" className="logo" />
          <p className="tagline">A reading | A lesson | A new way of learning</p>
        </header>
        <div className="strip" />

        {status === 'done' ? (
          <section className="body done">
            <img src="/isomo-ring.png" alt="" className="done-ring" />
            <h1>Thank you, {form.fullName.trim().split(' ')[0]}.</h1>
            <p>
              Your control room entry is recorded
              {doneAt && (
                <>
                  {' '}at{' '}
                  <strong>
                    {doneAt.toLocaleString('en-GB', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali',
                    })}
                  </strong>
                </>
              )}
              .
            </p>
            {form.takingLaptops && (
              <p className="muted">
                Laptops logged: {form.serials.map(cleanSerial).join(', ')}
              </p>
            )}
            <button type="button" className="btn btn-ghost" onClick={startAgain}>
              Fill in another entry
            </button>
          </section>
        ) : (
          <form className="body" onSubmit={handleSubmit} noValidate>
            <h1>Control Room Log</h1>
            <p className="intro">
              Fill this in every time you use the control room. If you take a laptop, have it with
              you: you need its serial number.
            </p>
            <p className="intro muted">
              Who sees your answers: Isomo staff who manage the control room and its equipment.
            </p>

            <Field id="fullName" label="Full name" error={errors.fullName}>
              <input id="fullName" type="text" autoComplete="name" maxLength={255}
                value={form.fullName} onChange={set('fullName')}
                aria-invalid={!!errors.fullName} />
            </Field>

            <Field id="email" label="Email" hint="We use this if we need to reach you about this visit."
              error={errors.email}>
              <input id="email" type="email" inputMode="email" autoComplete="email" maxLength={255}
                placeholder="you@isomo.rw" value={form.email} onChange={set('email')}
                aria-invalid={!!errors.email} />
            </Field>

            <Field id="activity" label="What are you about to do in the control room?"
              hint="For example: collect a laptop for a circles, or return laptops for repair"
              error={errors.activity}>
              <textarea id="activity" rows={3} maxLength={2000}
                value={form.activity} onChange={set('activity')}
                aria-invalid={!!errors.activity} />
            </Field>

            <fieldset className="field" aria-invalid={!!errors.takingLaptops}>
              <legend className="label">Are you taking any laptops?<span className="req">*</span></legend>
              <div className="choices">
                {[['Yes', true], ['No', false]].map(([text, val]) => (
                  <label key={text} className={`choice ${form.takingLaptops === val ? 'on' : ''}`}>
                    <input type="radio" name="takingLaptops"
                      checked={form.takingLaptops === val}
                      onChange={() => setForm({ ...form, takingLaptops: val })} />
                    {text}
                  </label>
                ))}
              </div>
              {errors.takingLaptops && <p className="error">{errors.takingLaptops}</p>}
            </fieldset>

            {form.takingLaptops && (
              <div className="laptop-box">
                <div className="field">
                  <span className="label">
                    Laptop serial number{form.serials.length > 1 ? 's' : ''}<span className="req">*</span>
                  </span>
                  <p className="hint">
                    Open Settings &gt; System &gt; About. The device name looks like Isomo-XXXXXXX;
                    the part after "Isomo-" is the serial number. It is also printed on the sticker
                    under the laptop, after S/N. One box per laptop.
                  </p>
                  {form.serials.map((s, i) => (
                    <div className="serial-row" key={i}>
                      <span className="serial-num">{i + 1}</span>
                      <input type="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                        aria-label={`Serial number ${i + 1}`} maxLength={60}
                        value={s} onChange={(ev) => setSerial(i, ev.target.value)}
                        aria-invalid={!!errors.serials && !cleanSerial(s)} />
                      {form.serials.length > 1 && (
                        <button type="button" className="icon-btn" onClick={() => removeSerial(i)}
                          aria-label={`Remove serial number ${i + 1}`}>×</button>
                      )}
                    </div>
                  ))}
                  {form.serials.length < MAX_LAPTOPS && (
                    <button type="button" className="btn btn-add" onClick={addSerial}>
                      + Add another laptop
                    </button>
                  )}
                  {errors.serials && <p className="error">{errors.serials}</p>}
                </div>

                <Field id="laptopReason" label="Why are you taking the laptop(s)?"
                  error={errors.laptopReason}>
                  <textarea id="laptopReason" rows={3} maxLength={2000}
                    value={form.laptopReason} onChange={set('laptopReason')}
                    aria-invalid={!!errors.laptopReason} />
                </Field>
              </div>
            )}

              {/* ---- Bringing laptops back ---- */}
            <fieldset className="field" aria-invalid={!!errors.returningLaptops}>
              <legend className="label">Are you bringing back any laptops?<span className="req">*</span></legend>
              <div className="choices">
                {[['Yes', true], ['No', false]].map(([text, val]) => (
                  <label key={text} className={`choice ${form.returningLaptops === val ? 'on' : ''}`}>
                    <input type="radio" name="returningLaptops"
                      checked={form.returningLaptops === val}
                      onChange={() => setForm({ ...form, returningLaptops: val })} />
                    {text}
                  </label>
                ))}
              </div>
              {errors.returningLaptops && <p className="error">{errors.returningLaptops}</p>}
            </fieldset>

            {form.returningLaptops && (
              <div className="laptop-box return-box">
                <Field id="returnedCount" label="How many laptops are you bringing back?"
                  error={errors.returnedCount}>
                  <input id="returnedCount" type="number" inputMode="numeric" min={1} max={50}
                    className="count-input" value={form.returnedCount}
                    onChange={(ev) => {
                      const returnedCount = ev.target.value;
                      // "Some need repair" is not an option for one laptop, so clear it
                      const returnedCondition =
                        returnedCount === '1' && form.returnedCondition === 'some_need_repair'
                          ? '' : form.returnedCondition;
                      setForm({ ...form, returnedCount, returnedCondition });
                    }}
                    aria-invalid={!!errors.returnedCount} />
                </Field>

                <fieldset className="field" aria-invalid={!!errors.returnedCondition}>
                  <legend className="label">
                    {form.returnedCount === '1' ? 'Does the laptop work?' : 'Do the laptops work?'}
                    <span className="req">*</span>
                  </legend>
                  <p className="hint">Choose "needs repair" for anything wrong: screen, keyboard, battery, charger, won't turn on.</p>
                  <div className="choices">
                    {(form.returnedCount === '1'
                      ? [['It works', 'all_working'], ['It needs repair', 'all_need_repair']]
                      : [['All working', 'all_working'], ['Some need repair', 'some_need_repair'],
                         ['All need repair', 'all_need_repair']]
                    ).map(([text, val]) => (
                      <label key={val} className={`choice ${form.returnedCondition === val ? 'on' : ''}`}>
                        <input type="radio" name="returnedCondition"
                          checked={form.returnedCondition === val}
                          onChange={() => setForm({ ...form, returnedCondition: val })} />
                        {text}
                      </label>
                    ))}
                  </div>
                  {errors.returnedCondition && <p className="error">{errors.returnedCondition}</p>}
                </fieldset>

                {form.returnedCondition && form.returnedCondition !== 'all_working' && (
                  <div className="field">
                    <label className="label" htmlFor="repairNotes">What needs fixing? (optional)</label>
                    <p className="hint">Helps IT prepare the repair.</p>
                    <textarea id="repairNotes" rows={2} maxLength={2000}
                      value={form.repairNotes} onChange={set('repairNotes')} />
                  </div>
                )}
              </div>
            )}

            {/* Honeypot: hidden from people, tempting for bots */}
            <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true"
              name="website" value={form.website} onChange={set('website')} />

            {status === 'failed' && (
              <p className="error banner">
                Your entry did not save. Check your internet connection and press Submit again.
                If it keeps failing, tell a staff member.
              </p>
            )}

            <div className="actions">
              <button type="submit" className="btn btn-primary" disabled={status === 'sending'}>
                {status === 'sending' ? 'Saving…' : 'Submit'}
              </button>
            </div>
          </form>
        )}

        <footer className="card-foot">
          <span>Curious. Kind. Engaged.</span>
          <img src="/isomo-ring.png" alt="" />
        </footer>
      </main>
    </div>
  );
}

function Field({ id, label, hint, error, children }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}<span className="req">*</span></label>
      {hint && <p className="hint">{hint}</p>}
      {children}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
