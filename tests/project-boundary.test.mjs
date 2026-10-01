import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkProjectBoundary } from "../scripts/check-project-boundary.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "project-boundary-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, data) => writeFileSync(join(root, file), JSON.stringify(data));
  mkdirSync(join(root, ".vercel"));
  write("project-identity.json", { packageName: "own-app", vercelProjectId: "prj_own", vercelProjectName: "own-project", vercelOrgId: "team_own" });
  write("package.json", { name: "own-app" });
  return { root, write };
}

test("permite el proyecto correcto y compilaciones sin enlace local", (t) => {
  const { root, write } = fixture(t);
  assert.doesNotThrow(() => checkProjectBoundary(root, {}));
  write(".vercel/project.json", { projectId: "prj_own", projectName: "own-project", orgId: "team_own" });
  assert.doesNotThrow(() => checkProjectBoundary(root, { VERCEL_PROJECT_ID: "prj_own" }));
});

test("bloquea un enlace a otro proyecto o equipo", (t) => {
  const { root, write } = fixture(t);
  write(".vercel/project.json", { projectId: "prj_foreign" });
  assert.throws(() => checkProjectBoundary(root, {}), /Publicación bloqueada/);
  write(".vercel/project.json", { projectId: "prj_own", orgId: "team_foreign" });
  assert.throws(() => checkProjectBoundary(root, {}), /Equipo enlazado/);
});

test("bloquea un proyecto cruzado declarado por Vercel", (t) => {
  const { root } = fixture(t);
  assert.throws(() => checkProjectBoundary(root, { VERCEL_PROJECT_ID: "prj_foreign" }), /VERCEL_PROJECT_ID/);
  assert.throws(() => checkProjectBoundary(root, { VERCEL_PROJECT_NAME: "foreign-project" }), /VERCEL_PROJECT_NAME/);
});

test("valida repo.json y rechaza enlaces ambiguos", (t) => {
  const { root, write } = fixture(t);
  const project = { id: "prj_own", name: "own-project", directory: ".", orgId: "team_own" };
  write(".vercel/repo.json", { projects: [project] });
  assert.doesNotThrow(() => checkProjectBoundary(root, {}));
  write(".vercel/repo.json", { projects: [{ ...project, id: "prj_foreign" }] });
  assert.throws(() => checkProjectBoundary(root, {}), /Proyecto del repositorio/);
  write(".vercel/repo.json", { projects: [project, project] });
  assert.throws(() => checkProjectBoundary(root, {}), /exactamente un proyecto/);
});
