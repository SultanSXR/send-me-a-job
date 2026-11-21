# Filling in application forms

Use this only when the user asks you to apply. Their choice of jobs is what approves filling in those forms. Submitting needs a separate yes for each job.

## 1. List what's ready
Show a numbered list of `ready` jobs, soonest closing date first: Company – Role, track, closing date, visa sponsorship status, and form notes (account needed? questions?). Ask which ones to apply to. Do nothing for the jobs they don't pick.

## 2. For each picked job
1. **Files.** Find the pack's CV and cover letter, and read them so you know what you are submitting.
2. **Open the apply page** in a browser tool, if one is available.
3. **Accounts.** Never type a password or create an account. If the site needs one, ask the user to sign in or register in the browser, and wait. CAPTCHAs and email verification codes are theirs to do. If a verification link arrives by email for a submission they already approved, you may open it.
4. **Fill the form** only with profile facts and the pack's documents.
   - Anything the profile doesn't cover (phone, salary expectation, notice period, start date, relocation, references, individual grades): ask the user, all in one message for the job. Never guess. If they want to keep the answers, offer to add them to the profile.
   - Diversity / equal-opportunities questions: ask once per session how they want them answered (default "Prefer not to say").
   - Work-rights questions: answer with the profile's `workRights` sentence. Never tick that they have the right to work if the profile says they need sponsorship.
   - Free-text questions ("Why this firm?" etc.): draft answers from the profile and current, real facts about the employer. Stay within the word limit and check the count with code. Show the drafts to the user before entering them. If the employer has an AI-use policy, point it out once and let the user decide.
   - React-controlled inputs: if typed text doesn't stick, set the value with the native value setter and dispatch `input` and `change` events. Custom dropdowns (react-select and similar) usually open on mousedown on the control.
5. **Uploads.** Use the browser tool's file-upload ability. Without one, set the file input from JavaScript (build a `File` from the bytes, put it in a `DataTransfer`, assign it to `input.files`, dispatch `change`). If that fails, give the files to the user to attach.
6. **Stop before Submit.** In one message, list every value entered, the files attached, the free-text answers, and any terms, privacy or consent boxes that submitting will tick. Ask: "Submit this application to <Company>? (yes/no)".
7. **Submit only after a clear yes** for this job. Check the confirmation page, then set status `applied` and record any reference number.

## Finish
Sum up which applications went in, with their references, and which are waiting on the user and why.
