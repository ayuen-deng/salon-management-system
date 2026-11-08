# Live Demo Pre-Flight & Execution Checklist

## 1. 24 Hours Before Demo

- [ ] Remote Supabase project is active and healthy (`https://akwxbwhbaeckwmiwsxcf.supabase.co`).
- [ ] Run `npm run check:architecture` (Ensure 0 architectural violations).
- [ ] Run `npm run test` (Ensure 8/8 unit tests pass).
- [ ] Run `npm run build` (Verify complete build output without static generation errors).
- [ ] Run `npm run latency:check` (Confirm remote latency is < 1500ms).
- [ ] Test owner PIN login on mobile device: `owner` / `111111`.
- [ ] Review `docs/WHAT_NOT_TO_CLAIM.md` so no false promises on automated integrations are made.

## 2. 30 Minutes Before Demo

- [ ] Place laptop on salon counter with dual screens or tablet ready.
- [ ] Run `npm run demo:scenario morning` to ensure a clean slate at 08:00 AM.
- [ ] Have phone ready with Safari/Chrome logged into `/owner`.
- [ ] Have tablet ready at `/reception#tablet`.
- [ ] Have TV/Monitor ready at `/tv`.
- [ ] Preload printed sample paper forms from `/print` on the desk to demonstrate the outage safety net.
- [ ] Have MoMo statement sample (`demo/momo-statement.csv`) and catalogue CSV (`demo/catalogue-template.csv`) accessible on laptop.

## 3. During the Demo (Presenting to Godfrey Mugisha)

- [ ] Hand owner phone to Godfrey; let him view his monitor first.
- [ ] Walk through Aisha check-in on counter; point to instant update on his phone and counter tablet.
- [ ] Show multi-service handoff from Grace (Wash) to Sarah (Braiding).
- [ ] Demonstrate walkout exception and why tracking reasons prevents customer churn.
- [ ] Demonstrate manager discount approval over Mary's limit.
- [ ] Demonstrate Day Close with physical cash entry and show the "Undo Day Close" safeguard.
- [ ] Highlight the honest Integration Status Panel.

## 4. Immediately After Demo

- [ ] Run `npm run demo:reset` to clear test customer data.
- [ ] If Godfrey took the demo phone, use `npm run owner:rotate` to generate a new PIN or `npm run owner:disable` to lock the demo account.
- [ ] Note down Godfrey's answers to the questions in `docs/OWNER_DECISIONS.md`.
