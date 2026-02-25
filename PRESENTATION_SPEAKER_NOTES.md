# Presentation Speaker Notes (Image-First)

Use this as short talk tracks for each slide point.

## 1) Project Snapshot
- Point: One app to bundle/manage game libraries.
  - Say: "The core idea is one place to manage game libraries instead of jumping between launchers."
- Point: Integrates Steam, Epic, GOG flows.
  - Say: "The backend and UI include flows for Steam and Epic, plus GOG launch/library handling."
- Point: Split into frontend, backend, infra folders.
  - Say: "The repo is clearly split into app code and infrastructure: `gamedivers-site`, `backend/api`, `k8s`, and `clusters`."
- Point: Image cues.
  - Say: "Here you can see the app UI and the repo layout at a glance."

## 2) Tech Stack (Logo Slide)
- Point: Frontend stack.
  - Say: "Frontend is React plus TypeScript with Vite and Tailwind/PostCSS."
- Point: Backend stack.
  - Say: "Backend is Go, using Chi for routing and PostgreSQL access via pgx."
- Point: Infra stack.
  - Say: "Delivery is containerized with Docker and deployed on Kubernetes with Flux GitOps."
- Point: Image cues.
  - Say: "The logos and config snippets here are pulled from `package.json` and `go.mod`."

## 3) Architecture Flow
- Point: `/` for web and `/api` for backend.
  - Say: "Ingress routes website traffic on `/` and API traffic on `/api` on the same host."
- Point: External systems.
  - Say: "The API talks to Keycloak for auth, and to Steam, Epic, and ITAD for platform and pricing data."
- Point: Protected API routes.
  - Say: "Protected routes use JWT middleware that validates tokens against Keycloak JWKS."
- Point: Image cues.
  - Say: "The flow diagram matches the ingress and router files in the repository."

## 4) Auth & Identity (Keycloak)
- Point: Auth endpoints exist.
  - Say: "The API has register, login, refresh, logout, and profile endpoints under `/v1/auth`."
- Point: JWT verification.
  - Say: "Token validation is done server-side with issuer and audience checks."
- Point: Email verification behavior.
  - Say: "Email verification is configurable via environment setting `KEYCLOAK_REQUIRE_EMAIL_VERIFIED`."
- Point: Image cues.
  - Say: "Use the Keycloak screenshot here to show realm/client alignment with API config."

## 5) CI/CD + GitOps
- Point: Build on `main`.
  - Say: "On `main` pushes, GitHub Actions builds and pushes API and web images to GHCR."
- Point: Tag update flow.
  - Say: "The pipeline updates image tags in `k8s/kustomization.yaml` to the commit SHA."
- Point: Deploy PR + Flux reconcile.
  - Say: "It then opens a deploy PR, and Flux continuously reconciles the cluster from Git."
- Point: Image cues.
  - Say: "Show the Actions run plus Rancher workload view to connect CI output to running pods."

## 6) Security Setup
- Point: Encrypted secrets.
  - Say: "Kubernetes secrets are committed encrypted using SOPS and decrypted in-cluster by Flux."
- Point: Trivy scanning.
  - Say: "Trivy scans both the API image and Kubernetes manifests for high/critical issues."
- Point: CodeQL scanning.
  - Say: "CodeQL runs on push/PR and weekly to catch code-level security problems."
- Point: Image cues.
  - Say: "Use encrypted secret YAML and workflow screenshots to show this is enforced in repo."

## 7) Testing & Quality
- Point: Backend tests.
  - Say: "Go test files are present for handlers and store auth clients."
- Point: Frontend tests.
  - Say: "Frontend has Vitest-based unit tests for store-related utilities."
- Point: Type safety checks.
  - Say: "TypeScript is configured with strict checks like `noUnusedLocals` and `noFallthroughCasesInSwitch`."
- Point: Unknowns.
  - Say: "Coverage thresholds and lint policy are not clearly visible, so we treat those as unknown."

## 8) Build, Run, Deploy
- Point: Local run setup.
  - Say: "Local development is straightforward: Go API on `:8080`, Vite frontend on `:3000` with `/api` proxy."
- Point: Container runtime setup.
  - Say: "Both API and website use multi-stage Dockerfiles and non-root runtime settings."
- Point: Kubernetes runtime shape.
  - Say: "Current manifests define two deployments (API/web) and one Postgres statefulset."
- Point: Image cues.
  - Say: "This is where Rancher screenshots work best to show replicas, pods, and health checks."

## 9) Final Unknowns (Ask Team)
- Point: Branch/review process.
  - Say: "Branch strategy and PR approval rules are unknown from repo files."
- Point: Environment promotion.
  - Say: "Promotion flow across environments is unknown / not visible in repo."
- Point: QA policy.
  - Say: "Coverage targets and formal release policy should be confirmed manually with the team."
