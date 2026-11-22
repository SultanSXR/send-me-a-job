# Chance of an offer, best-chance suggestions and profile advice

These are private to the user. Store them only in the job record (`chance`) and in `data/advice.json`. Never put a percentage, score or advice on the public link form, in a shared sheet or anywhere public. If a public feed lists suggestions, it may be ordered by chance, but it must not show the numbers.

## Estimating a chance (every job not yet applied to)

Research with web search:
1. **The advert.** List the essential and desirable requirements, location, closing date and any sponsorship wording.
2. **Hiring history.** Find places per year, and applications per place if published (graduate guides publish these for many employers). If the user needs sponsorship, check the employer's sponsorship record (in the UK, the gov.uk register of licensed sponsors). Note any record of hiring people with backgrounds like the user's.
3. **Market and competition.** Gauge applicant volume (e.g. "over 100 applicants") and current conditions in that sector and location.
4. **Past hires.** Only aggregate, public patterns: published intake profiles, "meet our trainees" pages, guides. Never record names or details of individuals, never open private social-media profiles, and never build a profile of a person.
5. **Work rights.** How likely the employer is to sponsor this role. If the user needs sponsorship, also check that the occupation is eligible and the salary meets the threshold (in the UK, the Skilled Worker occupation list and salary rules on gov.uk). Cut the score sharply if it clearly doesn't.

Use the user's own figures from `data/facts.json`: real results they entered strengthen the skills match. Treat employers in `data/targeting.json` `avoid` as ruled out, and those on its prefer lists as positives.

Combine the research as follows:
- Start from a base rate: offers ÷ applicants for this role. If that isn't published, use a typical figure for this kind of role and name its source.
- Adjust for the five factors.
- Be honest and calibrated. Graduate schemes and popular corporate roles usually convert about 1–5% of applicants. Never inflate a figure. If data is missing, say so and widen the range. Never invent a statistic.

Store:

```
chance = {
  percent, low, high, confidence: "low" | "medium" | "high",
  basis: "<base rate and its source>",
  summary: "<2 sentences: main reasons + one concrete thing that would raise the chance>",
  factors: [
    { name: "Skills match",         score: 0-100, note },
    { name: "Hiring history",       score: 0-100, note },
    { name: "Market & competition", score: 0-100, note },
    { name: "Past hires like you",  score: 0-100, note },
    { name: "Visa sponsorship",     score: 0-100, note }
  ],
  sources: [{ title, url }],   // 3–8 real pages you used
  updatedAt
}
```

Re-estimate when an estimate is older than 14 days.

When showing an estimate to the user, call it "an estimate from public information, not a prediction", and give the range and confidence alongside the percentage.

## Suggesting roles with the best chances

When finding new roles, aim where the user's chances are highest:
- employers that sponsor, if the user needs sponsorship;
- roles with more places per applicant;
- employers that say they welcome career changers or recruit from a wide range of universities;
- roles whose required experience the user actually meets;
- routes employers actually hire from (e.g. firms that recruit trainees mainly through vacation schemes);
- employers on the targeting prefer lists, never those in `avoid`. Add newly confirmed sponsors and newly found right-to-work-only schemes to `data/targeting.json`.

Check each role on the employer's own page and score it with the method above.

Rules for the suggestion list:
- Keep the best candidates, ranked by percent.
- Don't add one below the user's minimum (default 2%) unless the list would otherwise be nearly empty.
- When a new role beats an existing suggestion by 2+ points, retire the weaker one (status `replaced`), unless the user has already acted on it.
- Avoid short fixed-term contracts when sponsorship is needed, unless the employer says it sponsors.

## Advice: how to raise the chances

From the estimates of all open jobs, write up to 8 changes the user could make to their CV, LinkedIn, applications or targeting. Put the most impactful first, and base each one on patterns: factors that scored low, or requirements many roles share that the CV under-shows. Name the roles or employers behind each item, and deadlines where useful.

Never tell the user to claim anything untrue, and never add facts about them. If a change depends on a fact you don't have, write "if true, add …".

Changes to the master profile happen only after the user confirms them.
