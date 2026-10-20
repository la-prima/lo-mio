// Etiquetas Allure para cada test de Vitest (ver labels.ts).
import * as allure from "allure-js-commons";
import { beforeEach } from "vitest";
import { codeLabels } from "./labels.ts";

beforeEach(async ({ task }) => {
  const describes: string[] = [];
  for (let suite = task.suite; suite?.name; suite = suite.suite) describes.unshift(suite.name);
  const labels = codeLabels(task.file.filepath, describes, task.name);
  await allure.epic(labels.epic);
  await allure.feature(labels.feature);
  await allure.story(labels.story);
  await allure.tag(task.file.projectName === "integration" ? "integración" : "unit");
});
