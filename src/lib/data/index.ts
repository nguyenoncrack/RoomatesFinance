import { isSupabaseConfigured } from "@/lib/config";
import { DemoRepository } from "./demo-repository";
import type { Repository } from "./repository";
import { SupabaseRepository } from "./supabase-repository";

let repo: Repository | null = null;

export function getRepository(): Repository {
  repo ??= isSupabaseConfigured ? new SupabaseRepository() : new DemoRepository();
  return repo;
}

export function asDemo(r: Repository): DemoRepository | null {
  return r instanceof DemoRepository ? r : null;
}

export * from "./repository";
