/**
 * Every importer, by kind (#216). A new importer (calendar, B's course and
 * test formats) is added here and nowhere else.
 */

import "server-only";

import { staffImporter } from "./importers/staff";
import { studentsImporter } from "./importers/students";
import type { Importer } from "./types";

const IMPORTERS: Record<string, Importer<never>> = {
  [studentsImporter.kind]: studentsImporter as unknown as Importer<never>,
  [staffImporter.kind]: staffImporter as unknown as Importer<never>,
};

export function importerFor(kind: string): Importer | undefined {
  return IMPORTERS[kind] as unknown as Importer | undefined;
}

export function importerKinds(): Array<{ kind: string; title: string; template: Importer["template"] }> {
  return Object.values(IMPORTERS).map((i) => ({ kind: i.kind, title: i.title, template: i.template }));
}
