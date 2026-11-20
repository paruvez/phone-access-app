import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "phone-access-app";
export default defineRailway(() => {
  const phoneAccessApp = service("phone-access-app", {
    source: github("paruvez/phone-access-app", { branch: "main", commitSha: "796815a803e2dce0637fdba3593f9fb1d3179a4c", rootDirectory: "server", upstreamUrl: "https://github.com/paruvez/phone-access-app" }),
    build: { buildCommand: "npm run build", buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    start: "node dist/index.js",
    healthcheck: "/health",
    healthcheckTimeout: 300,
    replicas: { "iad": 1 },
  });

  return project("amusing-motivation", {
    variables: { managed: true },
    resources: [phoneAccessApp],
  });
});
