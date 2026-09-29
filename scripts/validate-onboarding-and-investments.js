const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const middleware = read('middleware.ts')
const domainRoute = read('app/api/onboarding/domain/route.ts')
const domainPicker = read('components/onboarding/domain-picker.tsx')
const profileForm = read('components/onboarding/first-time-profile.tsx')
const authForm = read('components/auth/phone-otp-form.tsx')
const investmentsRoute = read('app/api/investments/route.ts')

assert(/const publicPaths = \['\/login', '\/signup'\]/.test(middleware), 'Onboarding pages must require authentication')
assert(/isApiPath[\s\S]*Unauthorized[\s\S]*status: 401/.test(middleware), 'Unauthenticated API requests must return JSON 401')
assert(/export async function GET\(\)/.test(domainRoute), 'Domain route must expose the active domain catalog')
assert(/\.eq\('is_active', true\)/.test(domainRoute), 'Domain catalog and selection must reject inactive domains')
assert(!domainRoute.includes("onConflict: 'workspace_id,domain_id'"), 'Domain selection must not use a nonexistent conflict target')
assert(/fetch\("\/api\/onboarding\/domain"\)/.test(domainPicker), 'Domain picker must load the database catalog')
assert(/response\.text\(\)/.test(domainPicker), 'Domain picker must safely parse empty and non-JSON API responses')
assert(/response\.redirected[\s\S]*\/login/.test(domainPicker), 'Domain picker must detect stale auth redirects')
assert(!domainPicker.includes('financial-technology'), 'Domain picker must not retain stale hardcoded domain keys')
assert(/response\.text\(\)/.test(profileForm), 'Profile onboarding must safely parse empty and non-JSON API responses')
assert(/data:\s*signUpData/.test(authForm) && /!signUpData\.session/.test(authForm), 'Password signup must not enter onboarding before a session exists')
assert(!investmentsRoute.includes(".from('investments')"), 'Investments API must not query the nonexistent investments table')
assert(/\.from\('relationships'\)[\s\S]*\.eq\('relationship_type', 'invested_in'\)/.test(investmentsRoute), 'Investments API must use verified invested_in graph relationships')

if (failures.length) {
  console.error('ONBOARDING AND INVESTMENTS VALIDATION FAILED')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('ONBOARDING AND INVESTMENTS VALIDATION PASSED')
