# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Build and Run

Install dependencies first:

```bash
npm install
```

Run development server (accessible from other devices on your network):

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

Build for production:

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

## Firebase Hosting CI/CD (GitHub Actions)

This repo includes a workflow at `.github/workflows/firebase-hosting.yml`.

- On `pull_request` to `main`: builds and deploys a preview channel (`pr-<number>`), expiring in 7 days.
- On `push` to `main`: builds and deploys to the Firebase `live` channel.

Required GitHub repository secrets:

- `FIREBASE_PROJECT_ID`: your Firebase project ID.
- `FIREBASE_SERVICE_ACCOUNT`: the full JSON of a Firebase service account key with Hosting deploy permissions.

One-time setup to create service account key (example):

```bash
firebase login
firebase projects:list
gcloud iam service-accounts create github-firebase-deploy \
	--display-name="GitHub Firebase Deploy"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
	--member="serviceAccount:github-firebase-deploy@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
	--role="roles/firebasehosting.admin"
gcloud iam service-accounts keys create key.json \
	--iam-account="github-firebase-deploy@YOUR_PROJECT_ID.iam.gserviceaccount.com"
```

Then add:

- contents of `key.json` as `FIREBASE_SERVICE_ACCOUNT`
- your project ID as `FIREBASE_PROJECT_ID`

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
