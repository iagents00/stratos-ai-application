import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

export function checkProjectBoundary(root, env = process.env) {
  const expected = readJson(resolve(root, "project-identity.json"));
  const pkg = readJson(resolve(root, "package.json"));
  const errors = [];
  const compare = (label, actual, wanted) => {
    if (actual && actual !== wanted) errors.push(`${label}: se esperaba ${wanted}, recibido ${actual}`);
  };
  compare("Paquete", pkg.name, expected.packageName);
  compare("VERCEL_PROJECT_ID", env.VERCEL_PROJECT_ID, expected.vercelProjectId);
  compare("VERCEL_PROJECT_NAME", env.VERCEL_PROJECT_NAME, expected.vercelProjectName);

  const projectFile = resolve(root, ".vercel/project.json");
  if (existsSync(projectFile)) {
    const linked = readJson(projectFile);
    if (!linked.projectId) errors.push("El enlace de publicación no tiene projectId");
    compare("Proyecto enlazado", linked.projectId, expected.vercelProjectId);
    compare("Nombre enlazado", linked.projectName, expected.vercelProjectName);
    compare("Equipo enlazado", linked.orgId, expected.vercelOrgId);
  }
  const repoFile = resolve(root, ".vercel/repo.json");
  if (existsSync(repoFile)) {
    const linked = readJson(repoFile);
    const matches = (linked.projects || []).filter((project) => resolve(root, project.directory || ".") === resolve(root));
    if (matches.length !== 1) errors.push("La carpeta debe tener exactamente un proyecto de publicación");
    for (const project of matches) {
      compare("Proyecto del repositorio", project.id, expected.vercelProjectId);
      compare("Nombre del repositorio", project.name, expected.vercelProjectName);
      compare("Equipo del repositorio", project.orgId, expected.vercelOrgId);
    }
  }
  if (errors.length) throw new Error(`Publicación bloqueada: identidad de proyecto incorrecta.\n${errors.join("\n")}`);
  return expected;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const identity = checkProjectBoundary(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
    console.log(`Identidad verificada: ${identity.vercelProjectName}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
