# Deployment Checklist (FE-11)

- [ ] `npm run lint` passes with 0 errors
- [ ] `npm run test:coverage` passes (≥50% component coverage)
- [ ] `npm run build` succeeds locally
- [ ] `ANTHROPIC_API_KEY` set in Vercel Environment Variables (never committed to git)
- [ ] Fallback mode verified when API key is absent/rate-limited
- [ ] Lighthouse mobile & desktop scores verified (≥85, target 90+)
- [ ] axe DevTools / WAVE accessibility audit shows 0 WCAG 2.1 AA violations

## Rollback Plan
1. In Vercel Dashboard → Deployments, select the previous healthy production deployment and click **Promote to Production**, OR
2. Revert the bad commit on `main` (`git revert HEAD && git push origin main`) to trigger automatic redeployment.
