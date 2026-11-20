import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "phone-access-app";
export default defineRailway(() => {
  const phoneAccessApp = service("phone-access-app", {
    source: github("paruvez/phone-access-app", { branch: "main", commitSha: "846e64efc88227a677e186ff5f71660f922c8340", upstreamUrl: "https://github.com/paruvez/phone-access-app" }),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "server/Dockerfile" },
    healthcheck: "/health",
    healthcheckTimeout: 300,
    replicas: { "iad": 1 },
  });

  return project("amusing-motivation", {
    variables: { managed: true },
    resources: [phoneAccessApp],
  });
});
