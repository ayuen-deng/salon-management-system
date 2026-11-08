# HR Attendance and Leave Metrics

## Staff performance calculations (Phase 5)

- **Eligible visit** = a paid or closed visit with a positive final total, at least one non-complimentary service line, and no recorded refund or void adjustment. Cancelled, unpaid, refunded, voided, and complimentary-only visits are excluded.
- **Services completed** = completed service lines with `Start` and `Done` timestamps, `times_source = measured`, a live-entered visit, and an elapsed duration from 1 second through 300 minutes. Paper-entered and corrected/reported times are excluded. The same rule drives HR and Owner Staff performance figures.
- **People served** = distinct eligible visits in which the staff member completed at least one line. This is a visit count, not a customer identity or customer record. A customer with multiple eligible visits can count once per visit.
- **Average measured / expected service time** = arithmetic mean of measured elapsed minutes and the catalogue variant's expected minutes for eligible completed lines. Category averages use the same eligible lines.
- **Utilisation** = measured service minutes divided by recorded attendance hours, capped only by the underlying duration rule; no scheduled or guessed hours are added. A missing/zero attendance denominator displays as unavailable.
- **On-time rate** = clock-in days without late minutes divided by recorded clock-in days. Days with no clock-in are omitted. Team rate is attendance-day weighted.
- **Hours worked** = sum of the shared `hr_attendance_daily` recorded hours, including an explicitly in-progress current shift. No fixed shift length is inferred.
- **Target progress** = count of distinct eligible visits in the configured target window for that stylist, divided by the configured people target. This count is independent of the currently selected report range. It reports count progress only; commission or pay settings are never returned. No target is shown if none is configured.
- **Top categories and detail charts** use measured eligible lines only. The hourly pattern groups service starts by Africa/Kampala hour.
- **Role handling** = service measures apply to stylists (`staff`) only. Managers, HR, and receptionists receive attendance measures; service metrics display as not applicable.

The report is provided by a server-only database function shared by HR and Owner Staff views. Its response contains no customer IDs/contact details, service prices, visit totals, revenue, or commission fields. CSV and PDF exports use the visible HR filters and the same report values.

Phase 3 uses attendance clock taps, effective dated work policies, rota entries, approved leave, and HR-entered holidays. It does not infer clock-out times or a legal leave entitlement.

## Attendance calculations

- **Arrival offset** = first clock-in minus the applicable scheduled start, in minutes. Negative means early; positive means late. The saved attendance policy snapshot is used for days with clock-ins. A rota shift takes precedence over the location and role defaults.
- **Late minutes** = arrival offset beyond the configured late grace period. The grace period is not subtracted from the displayed arrival offset.
- **Departure offset** = last clock-out minus scheduled end, in minutes. Early departure is flagged only after the early-departure grace period; overtime is minutes after scheduled end.
- **Hours worked** = elapsed time from clock-in to clock-out, less recorded break intervals. Current shifts show elapsed hours as in progress. A past shift without clock-out is marked missed clock-out and has no guessed duration.
- **Punctuality** = on-time clock-in days divided by clock-in days in the selected period. Days on leave and days without clock-in are excluded.
- **Average arrival offset** = mean signed arrival offset for clock-in days. It is centered on scheduled start; negative is early and positive is late.
- **Expected hours** = scheduled shift duration for scheduled workdays in the selected period, excluding approved leave.
- **Unapproved absence** = explicit unapproved absence correction, or a scheduled day with no attendance and no approved leave. An unfinished current day is not counted as absent.

## Leave balances

- The leave year starts January 1 unless HR changes the month and day.
- Annual leave taken, approved upcoming, and pending are counted in scheduled working days between leave dates, excluding dates entered in the public holiday list.
- Remaining balance = configured entitlement minus approved annual leave already taken and approved upcoming days. Pending annual leave is shown separately and is not deducted from remaining days, but it is included when validating a new request so pending requests cannot collectively exceed the entitlement.
- A per-person entitlement override takes precedence over the role default. Blank means use the role default. If neither is configured, entitlement and remaining balance display as not configured.
- Unpaid leave and other approved leave do not reduce annual leave balance. Leave reasons and medical details are not captured in the leave form.

## Data history and access

Work-hour and annual-leave policy changes are saved with an effective date and a people-category audit entry. Attendance rows capture the applicable work-hours policy when first clocked in; subsequent policy edits do not rewrite those snapshots. HR views and writes go through HR-authorized server actions. Database write RPCs are granted only to `service_role` and validate that the actor is an active HR user.

## Scope limits

Entitlement values are intentionally unset until the salon owner confirms its policy. This screen does not claim a statutory entitlement or provide legal advice. Public holiday dates begin empty and must be maintained by HR.
